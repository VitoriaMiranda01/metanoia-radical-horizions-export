-- ---------------------------------------------------------------------------
-- Apoio da PORTARIA (Patrick, 24/10/2026)
--
-- Segundo tipo de conta de apoio (a primeira e a saude, 20261009a). A equipe
-- da portaria entra pelo mesmo login "Apoio" na sexta, sabado e domingo do
-- evento e ve UMA tela (/portaria):
--
--  * todos os acampantes e os equipantes da escala (ou que ja pagaram), com
--    nome completo, igreja e a situacao do pagamento (pago / em aberto);
--  * da BAIXA de quem paga na hora, em dinheiro ou cartao. Grava nas mesmas
--    colunas do pagamento manual do organizador (aparece em Pagamentos), com
--    "Portaria: <nome>" em pagamento_confirmado_por;
--  * desfaz so a baixa feita pela portaria (engano na hora); PIX e pagamento
--    lancado pela organizacao, nunca;
--  * escreve uma observacao livre por pessoa (portaria_observacoes) para a
--    organizacao ler.
--
-- A portaria NAO le nenhuma tabela direto (nenhuma RLS aceita 'apoio'): so o
-- que as funcoes abaixo entregam. Nada de CPF, telefone ou ficha de saude.
-- Conta excluida perde o acesso na hora, mesmo com o cracha ainda valido
-- (_portaria_logada confere a conta a cada chamada).
--
-- Contas de apoio agora sao CRIADAS e EXCLUIDAS pela tela (Configuracoes ->
-- Senhas), so pela conta de permissao maxima: criar_conta_apoio gera a senha
-- temporaria (a pessoa cria a propria no primeiro acesso, como ja era).
-- ---------------------------------------------------------------------------

-- 1. Area 'portaria' nas contas de apoio ---------------------------------------
do $$
declare r record;
begin
  for r in select conname from pg_constraint
            where conrelid = 'public.apoio_auth'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) ilike '%area%' loop
    execute format('alter table public.apoio_auth drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.apoio_auth add constraint apoio_auth_area_check
  check (area in ('saude', 'portaria'));
alter table public.apoio_auth add column if not exists criado_por text;

-- 2. Observacao da portaria -------------------------------------------------------
create table if not exists public.portaria_observacoes (
  tipo           text not null check (tipo in ('acampante', 'equipante')),
  inscricao_id   uuid not null,
  texto          text not null,
  atualizado_em  timestamptz not null default now(),
  atualizado_por text,
  primary key (tipo, inscricao_id)
);
alter table public.portaria_observacoes enable row level security;
revoke all on table public.portaria_observacoes from anon, authenticated;

-- 3. Quem esta logado como portaria (nome da conta; null = nao e portaria) ------
create or replace function public._portaria_logada()
returns text
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select c.nome
    from public.apoio_auth c
   where public.eh_apoio('portaria')
     and c.area = 'portaria'
     and c.senha is not null
     and c.id::text = coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')
   limit 1;
$fn$;
revoke all on function public._portaria_logada() from public, anon, authenticated;

-- Quem assina a acao: "Portaria: Nome" ou o nome do organizador.
create or replace function public._portaria_quem()
returns text
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select case
           when public._portaria_logada() is not null then 'Portaria: ' || public._portaria_logada()
           when public.eh_organizador() then coalesce(public._nome_organizador_logado(), 'organizador')
         end;
$fn$;
revoke all on function public._portaria_quem() from public, anon, authenticated;

-- 4. A lista da portaria ------------------------------------------------------------
create or replace function public.portaria_lista()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
begin
  if public._portaria_quem() is null then
    return jsonb_build_object('ok', false, 'erro', 'Acesso não autorizado.');
  end if;

  return jsonb_build_object('ok', true, 'pessoas', coalesce((
    select jsonb_agg(x order by x ->> 'nome') from (
      select jsonb_build_object(
               'tipo', 'acampante',
               'id', a.id,
               'nome', a.nome,
               'igreja', coalesce(nullif(btrim(a.admin_responsavel), ''), nullif(btrim(a.igreja), '')),
               'congrega', nullif(btrim(a.igreja), ''),
               'pago', lower(coalesce(a.status_pagamento, '')) in ('confirmado', 'pago', 'completed'),
               'metodo', lower(coalesce(a.metodo_pagamento, '')),
               'meio', a.pagamento_meio,
               'valor', a.pagamento_valor,
               'data_pagamento', a.data_pagamento,
               'confirmado_por', a.pagamento_confirmado_por,
               'observacao', o.texto,
               'observacao_por', o.atualizado_por,
               'observacao_em', o.atualizado_em) as x
        from public.acampantes a
        left join public.portaria_observacoes o on o.tipo = 'acampante' and o.inscricao_id = a.id
       where coalesce(a.tipo, 'acampante') = 'acampante'
      union all
      select jsonb_build_object(
               'tipo', 'equipante',
               'id', e.id,
               'nome', e.nome,
               'igreja', case when e.igreja = 'OUTRA' then coalesce(nullif(btrim(e.igreja_outra), ''), 'OUTRA')
                              else nullif(btrim(e.igreja), '') end,
               'congrega', null,
               'pago', lower(coalesce(e.status_pagamento, '')) in ('confirmado', 'pago', 'completed'),
               'metodo', lower(coalesce(e.metodo_pagamento, '')),
               'meio', e.pagamento_meio,
               'valor', e.pagamento_valor,
               'data_pagamento', e.data_pagamento,
               'confirmado_por', e.pagamento_confirmado_por,
               'observacao', o.texto,
               'observacao_por', o.atualizado_por,
               'observacao_em', o.atualizado_em)
        from public.equipantes e
        left join public.portaria_observacoes o on o.tipo = 'equipante' and o.inscricao_id = e.id
       where e.tipo = 'equipante'
         and (public._equipante_na_escala(e.id)
              or lower(coalesce(e.status_pagamento, '')) in ('confirmado', 'pago', 'completed'))
    ) t), '[]'::jsonb));
end;
$fn$;
revoke all on function public.portaria_lista() from public, anon;
grant execute on function public.portaria_lista() to authenticated;

-- 5. Valor sugerido para a baixa (lote do dia, com o desconto automatico de
--    pastor/infiltrado do equipante). So sugestao: a portaria confirma o valor.
create or replace function public.portaria_valor_previsto(p_tipo text, p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
declare
  v_preco numeric;
  v_desc  jsonb;
begin
  if public._portaria_quem() is null then
    return jsonb_build_object('ok', false, 'erro', 'Acesso não autorizado.');
  end if;
  if p_tipo not in ('acampante', 'equipante') then
    return jsonb_build_object('ok', false, 'erro', 'Tipo de inscrição inválido.');
  end if;
  v_preco := public._valor_do_lote(p_tipo);
  v_desc := public._desconto_automatico(p_tipo, p_id, v_preco);
  return jsonb_build_object(
    'ok', true,
    'preco', v_preco,
    'desconto', coalesce((v_desc ->> 'desconto')::numeric, 0),
    'motivo', v_desc ->> 'motivo',
    'valor', case when v_preco is null then null
                  else greatest(v_preco - coalesce((v_desc ->> 'desconto')::numeric, 0), 0) end);
end;
$fn$;
revoke all on function public.portaria_valor_previsto(text, uuid) from public, anon;
grant execute on function public.portaria_valor_previsto(text, uuid) to authenticated;

-- 6. Dar baixa (dinheiro ou cartao) ------------------------------------------------
create or replace function public.portaria_dar_baixa(p_tipo text, p_id uuid, p_meio text, p_valor numeric)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_quem   text := public._portaria_quem();
  v_meio   text := nullif(lower(btrim(coalesce(p_meio, ''))), '');
  v_valor  numeric := round(p_valor, 2);
  v_status text;
  v_nome   text;
  v_n      int;
begin
  if v_quem is null then
    return jsonb_build_object('ok', false, 'erro', 'Acesso não autorizado.');
  end if;
  if p_tipo not in ('acampante', 'equipante') then
    return jsonb_build_object('ok', false, 'erro', 'Tipo de inscrição inválido.');
  end if;
  if v_meio is null or v_meio not in ('dinheiro', 'cartao') then
    return jsonb_build_object('ok', false, 'erro', 'Escolha se o pagamento foi em dinheiro ou cartão.');
  end if;
  if v_valor is null or v_valor <= 0 or v_valor > 5000 then
    return jsonb_build_object('ok', false, 'erro', 'Informe o valor recebido (maior que zero).');
  end if;

  if p_tipo = 'acampante' then
    select status_pagamento, nome into v_status, v_nome
      from public.acampantes where id = p_id and coalesce(tipo, 'acampante') = 'acampante' for update;
  else
    select status_pagamento, nome into v_status, v_nome
      from public.equipantes where id = p_id and tipo = 'equipante' for update;
  end if;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada.');
  end if;
  if lower(coalesce(v_status, '')) in ('confirmado', 'pago', 'completed') then
    return jsonb_build_object('ok', false, 'erro', 'Esta inscrição já está paga.');
  end if;
  -- A portaria so recebe de equipante que esta na escala (mesma regra do PIX).
  -- O organizador segue podendo lancar fora dela pela tela de Pagamentos.
  if p_tipo = 'equipante' and not public._equipante_na_escala(p_id) then
    return jsonb_build_object('ok', false, 'erro',
      'Este equipante não está na escala. Peça para ele procurar a organização.');
  end if;

  if p_tipo = 'acampante' then
    update public.acampantes set
      status_pagamento = 'confirmado', metodo_pagamento = 'manual', data_pagamento = now(),
      pagamento_valor = v_valor, pagamento_cupom = null, pagamento_desconto = null,
      pagamento_confirmado_por = v_quem, pagamento_meio = v_meio,
      pagamento_observacao = 'Baixa na portaria'
     where id = p_id;
  else
    update public.equipantes set
      status_pagamento = 'confirmado', metodo_pagamento = 'manual', data_pagamento = now(),
      pagamento_valor = v_valor, pagamento_cupom = null, pagamento_desconto = null,
      pagamento_confirmado_por = v_quem, pagamento_meio = v_meio,
      pagamento_observacao = 'Baixa na portaria'
     where id = p_id and tipo = 'equipante';
  end if;
  get diagnostics v_n = row_count;

  return jsonb_build_object('ok', v_n = 1, 'nome', v_nome, 'confirmado_por', v_quem,
                            'valor', v_valor, 'meio', v_meio);
end;
$fn$;
revoke all on function public.portaria_dar_baixa(text, uuid, text, numeric) from public, anon;
grant execute on function public.portaria_dar_baixa(text, uuid, text, numeric) to authenticated;

-- 7. Desfazer baixa da portaria (so a feita na portaria) -----------------------------
create or replace function public.portaria_desfazer_baixa(p_tipo text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_quem   text := public._portaria_quem();
  v_status text;
  v_metodo text;
  v_por    text;
  v_nome   text;
begin
  if v_quem is null then
    return jsonb_build_object('ok', false, 'erro', 'Acesso não autorizado.');
  end if;
  if p_tipo not in ('acampante', 'equipante') then
    return jsonb_build_object('ok', false, 'erro', 'Tipo de inscrição inválido.');
  end if;

  if p_tipo = 'acampante' then
    select status_pagamento, lower(coalesce(metodo_pagamento, '')), pagamento_confirmado_por, nome
      into v_status, v_metodo, v_por, v_nome
      from public.acampantes where id = p_id and coalesce(tipo, 'acampante') = 'acampante' for update;
  else
    select status_pagamento, lower(coalesce(metodo_pagamento, '')), pagamento_confirmado_por, nome
      into v_status, v_metodo, v_por, v_nome
      from public.equipantes where id = p_id and tipo = 'equipante' for update;
  end if;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada.');
  end if;
  if lower(coalesce(v_status, '')) not in ('confirmado', 'pago', 'completed') then
    return jsonb_build_object('ok', false, 'erro', 'Esta inscrição não está como paga.');
  end if;
  if v_metodo <> 'manual' or coalesce(v_por, '') not like 'Portaria: %' then
    return jsonb_build_object('ok', false, 'erro',
      'Só dá para desfazer baixa feita na portaria. Este pagamento é com a organização.');
  end if;

  if p_tipo = 'acampante' then
    update public.acampantes set
      status_pagamento = 'pendente', data_pagamento = null,
      pagamento_valor = null, pagamento_cupom = null, pagamento_desconto = null,
      pagamento_confirmado_por = null, pagamento_meio = null, pagamento_observacao = null,
      pagamento_desfeito_em = now(), pagamento_desfeito_por = v_quem
     where id = p_id;
  else
    update public.equipantes set
      status_pagamento = 'pendente', data_pagamento = null,
      pagamento_valor = null, pagamento_cupom = null, pagamento_desconto = null,
      pagamento_confirmado_por = null, pagamento_meio = null, pagamento_observacao = null,
      pagamento_desfeito_em = now(), pagamento_desfeito_por = v_quem
     where id = p_id and tipo = 'equipante';
  end if;

  return jsonb_build_object('ok', true, 'nome', v_nome, 'desfeito_por', v_quem);
end;
$fn$;
revoke all on function public.portaria_desfazer_baixa(text, uuid) from public, anon;
grant execute on function public.portaria_desfazer_baixa(text, uuid) to authenticated;

-- 8. Observacao (texto vazio apaga) ---------------------------------------------------
create or replace function public.portaria_salvar_observacao(p_tipo text, p_id uuid, p_texto text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_quem  text := public._portaria_quem();
  v_texto text := left(nullif(btrim(coalesce(p_texto, '')), ''), 500);
begin
  if v_quem is null then
    return jsonb_build_object('ok', false, 'erro', 'Acesso não autorizado.');
  end if;
  if p_tipo not in ('acampante', 'equipante') then
    return jsonb_build_object('ok', false, 'erro', 'Tipo de inscrição inválido.');
  end if;
  if (p_tipo = 'acampante' and not exists (select 1 from public.acampantes where id = p_id))
     or (p_tipo = 'equipante' and not exists (select 1 from public.equipantes where id = p_id and tipo = 'equipante')) then
    return jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada.');
  end if;

  if v_texto is null then
    delete from public.portaria_observacoes where tipo = p_tipo and inscricao_id = p_id;
  else
    insert into public.portaria_observacoes (tipo, inscricao_id, texto, atualizado_em, atualizado_por)
    values (p_tipo, p_id, v_texto, now(), v_quem)
    on conflict (tipo, inscricao_id) do update
      set texto = excluded.texto, atualizado_em = now(), atualizado_por = excluded.atualizado_por;
  end if;

  return jsonb_build_object('ok', true, 'texto', v_texto, 'atualizado_por', v_quem);
end;
$fn$;
revoke all on function public.portaria_salvar_observacao(text, uuid, text) from public, anon;
grant execute on function public.portaria_salvar_observacao(text, uuid, text) to authenticated;

-- 9. Criar e excluir conta de apoio (so permissao maxima) ----------------------------
create or replace function public._mensagem_acesso_apoio(p_nome text, p_area text, p_senha text)
returns text
language sql
immutable
set search_path to 'public'
as $fn$
  select 'Acesso de apoio (' || case p_area when 'portaria' then 'portaria' else 'saúde' end ||
         ') do Metanoia Radical Serra.' || chr(10) || chr(10) ||
         'Site: https://metanoiaradicalserra.com.br/login' || chr(10) ||
         'Tipo de acesso: Apoio' || chr(10) ||
         'Usuário: ' || p_nome || chr(10) ||
         'Senha: ' || p_senha || chr(10) || chr(10) ||
         'Ao entrar, o sistema vai pedir para você criar a SUA senha ' ||
         '(mínimo 8 caracteres, com letras e números).';
$fn$;
revoke all on function public._mensagem_acesso_apoio(text, text, text) from public, anon, authenticated;

create or replace function public.criar_conta_apoio(p_nome text, p_area text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $fn$
declare
  v_nome  text := regexp_replace(btrim(coalesce(p_nome, '')), '\s+', ' ', 'g');
  v_area  text := lower(btrim(coalesce(p_area, '')));
  v_senha text;
begin
  if not public.eh_organizador_maximo() then
    return jsonb_build_object('ok', false, 'erro',
      'Apenas o login de permissão máxima pode criar contas de apoio.');
  end if;
  if v_area not in ('saude', 'portaria') then
    return jsonb_build_object('ok', false, 'erro', 'Escolha a área: saúde ou portaria.');
  end if;
  -- O nome e o usuario do login: so letras (com acento), ate duas palavras.
  -- Nada de numero ou simbolo (o login procura o nome com ilike).
  if v_nome !~ '^[A-Za-zÀ-ÖØ-öø-ÿ]{2,20}( [A-Za-zÀ-ÖØ-öø-ÿ]{2,20})?$' then
    return jsonb_build_object('ok', false, 'erro',
      'Use só o primeiro nome (ou nome e sobrenome), apenas letras. Ex.: "Carlos" ou "Carlos Souza".');
  end if;
  if exists (select 1 from public.apoio_auth where lower(nome) = lower(v_nome)) then
    return jsonb_build_object('ok', false, 'erro',
      format('Já existe uma conta de apoio "%s". Use também o sobrenome.', v_nome));
  end if;

  v_senha := public._gerar_senha_legivel();
  insert into public.apoio_auth (nome, area, senha, senha_definida, senha_atualizada_em, criado_por)
  values (v_nome, v_area, extensions.crypt(v_senha, extensions.gen_salt('bf', 12)), false, now(),
          public._nome_organizador_logado());

  return jsonb_build_object('ok', true, 'nome', v_nome, 'area', v_area, 'senha', v_senha,
                            'mensagem', public._mensagem_acesso_apoio(v_nome, v_area, v_senha));
end;
$fn$;
revoke all on function public.criar_conta_apoio(text, text) from public, anon;
grant execute on function public.criar_conta_apoio(text, text) to authenticated;

create or replace function public.excluir_conta_apoio(p_nome text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_alvo public.apoio_auth%rowtype;
begin
  if not public.eh_organizador_maximo() then
    return jsonb_build_object('ok', false, 'erro',
      'Apenas o login de permissão máxima pode excluir contas de apoio.');
  end if;
  select * into v_alvo from public.apoio_auth
   where lower(nome) = lower(btrim(coalesce(p_nome, ''))) limit 1;
  if v_alvo.id is null then
    return jsonb_build_object('ok', false, 'erro', 'Conta de apoio não encontrada.');
  end if;

  delete from public.apoio_auth where id = v_alvo.id;
  delete from public.login_tentativas where tipo = 'apoio' and identificador = lower(v_alvo.nome);

  return jsonb_build_object('ok', true, 'nome', v_alvo.nome);
end;
$fn$;
revoke all on function public.excluir_conta_apoio(text) from public, anon;
grant execute on function public.excluir_conta_apoio(text) to authenticated;

-- 10. Senha nova: mensagem pronta com a area certa ----------------------------------
do $$
declare
  v_def text := pg_get_functiondef('public.redefinir_senha_apoio(text)'::regprocedure);
  v_ini int := position('''mensagem'',' in v_def);
  v_fim int := position('(mínimo 8 caracteres, com letras e números).''' in v_def);
  v_novo text;
begin
  if v_ini = 0 or v_fim = 0 then
    raise exception 'redefinir_senha_apoio: trecho não encontrado';
  end if;
  v_fim := v_fim + length('(mínimo 8 caracteres, com letras e números).''');
  v_novo := substr(v_def, 1, v_ini - 1)
         || '''mensagem'', public._mensagem_acesso_apoio(v_alvo.nome, v_alvo.area, v_senha)'
         || substr(v_def, v_fim);
  execute v_novo;
end $$;

-- 11. A lista de contas mostra quem criou --------------------------------------------
create or replace function public.listar_contas_apoio()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
begin
  if not public.eh_organizador_maximo() then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'nome', c.nome,
             'area', c.area,
             'tem_senha', c.senha is not null,
             'senha_definida', c.senha_definida,
             'senha_atualizada_em', c.senha_atualizada_em,
             'ultimo_acesso', c.ultimo_acesso,
             'criado_em', c.criado_em,
             'criado_por', c.criado_por)
           order by c.area, c.nome)
      from public.apoio_auth c), '[]'::jsonb);
end;
$fn$;
