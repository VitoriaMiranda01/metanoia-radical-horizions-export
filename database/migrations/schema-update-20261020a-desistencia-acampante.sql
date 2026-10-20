-- 20/10/2026 (Patrick): desistencia do acampante.
--
-- O botao Excluir de Gerenciar Inscricoes apagava a linha direto (delete pela
-- API): sem guardar nada, sem conferir pagamento. Em 19/10 sairam 13 assim,
-- uma ja paga. Agora o organizador escolhe o motivo:
--
--  1) "O acampante desistiu de participar da edicao": a linha inteira MUDA DE
--     TABELA (acampantes -> acampantes_desistentes). Nada que le acampantes
--     precisa de filtro novo, o CPF (UNIQUE) e a vaga da igreja ficam livres,
--     e a virada de edicao (que apaga todos os acampantes) nao toca no arquivo.
--     Da para restaurar na mesma edicao. Numa inscricao futura, os dados
--     pessoais e o endereco voltam preenchidos (CPF + nome completo).
--  2) "Excluir o cadastro completamente": apaga a ficha, o arquivo de
--     desistente do mesmo CPF e o conteudo da auditoria dessa pessoa. Sobra so
--     um registro sem nome nem CPF em exclusoes_cadastro (quem, quando, motivo).
--     Os backups ja feitos ficam como estao (decisao do Patrick).
--
-- Regras (decisoes do Patrick, 20/10):
--  * qualquer organizador faz as duas;
--  * quem ja pagou nao sai (manual/isento: desfazer em Pagamentos antes; PIX
--    nao tem desfazer pela tela);
--  * PIX gerado e ainda valido tambem trava (senao o pagamento cairia numa
--    inscricao que nao existe mais);
--  * o arquivo de desistentes guarda por 180 dias contados da inscricao
--    (aviso de LGPD do formulario) e depois apaga sozinho.

-- ------------------------------------------------------------------ tabela
create table if not exists public.acampantes_desistentes (
  id            uuid primary key default gen_random_uuid(),
  acampante_id  uuid not null,
  cpf           text,                         -- so digitos
  nome          text,
  igreja        text,
  numero_edicao integer,
  observacao    text,
  desistiu_por  text,
  desistiu_em   timestamptz not null default now(),
  inscrito_em   timestamptz not null default now(),  -- base dos 180 dias
  ficha         jsonb not null,               -- a linha inteira de acampantes
  vinculos      jsonb not null default '[]'::jsonb,
  cobranca      jsonb
);
create index if not exists acampantes_desistentes_cpf on public.acampantes_desistentes (cpf);
alter table public.acampantes_desistentes enable row level security;
revoke all on public.acampantes_desistentes from anon, authenticated;

-- ------------------------------------------------------------ auxiliares
-- 180 dias contados da inscricao (aviso de LGPD do formulario do acampante).
create or replace function public._limpar_desistentes_vencidos()
returns void language sql security definer set search_path = public as $$
  delete from public.acampantes_desistentes
   where inscrito_em < now() - interval '180 days';
$$;

-- Por que este acampante nao pode sair agora (null = pode).
create or replace function public._acampante_bloqueio_saida(a public.acampantes)
returns text language plpgsql stable security definer set search_path = public as $$
begin
  if lower(coalesce(a.status_pagamento, '')) in ('pago', 'confirmado', 'completed') then
    if lower(coalesce(a.metodo_pagamento, '')) in ('manual', 'isento') then
      return 'Este acampante já tem pagamento confirmado. Desfaça o pagamento em Pagamentos antes.';
    end if;
    return 'Este acampante pagou pelo PIX, e esse pagamento não pode ser desfeito pela tela. Fale com os Desenvolvedores.';
  end if;
  if exists (select 1 from public.pix_sicoob x
              where x.inscricao_id = a.id and x.status = 'pendente'
                and coalesce(x.expires_at, x.created_at + interval '30 minutes') > now()) then
    return 'Este acampante tem um PIX gerado que ainda pode ser pago. Espere o PIX vencer (até 30 minutos) e tente de novo.';
  end if;
  return null;
end;
$$;

-- Tira o acampante do sistema (o que nao sai sozinho junto com a ficha).
create or replace function public._apagar_acampante(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.pix_sicoob where inscricao_id = p_id and status is distinct from 'pago';
  delete from public.pagamentos where acampante_id = p_id;
  delete from public.acampantes_vinculos where p_id in (acampante_a, acampante_b, origem_acampante);
  delete from public.acampantes where id = p_id;
end;
$$;

-- Opcao 2: nao sobra nome, CPF nem ficha. Apaga o arquivo de desistente e
-- esvazia o conteudo da auditoria dessa pessoa (fica so que houve a acao).
create or replace function public._apagar_rastros_acampante(p_id uuid, p_cpf text, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_cpf text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
begin
  delete from public.acampantes_desistentes
   where acampante_id = p_id or (v_cpf <> '' and cpf = v_cpf);
  update public.auditoria set registro = null, mudancas = null
   where registro_id = p_id::text;
  insert into public.exclusoes_cadastro (tipo, inscricao_id, nome, cpf, motivo, excluido_por, ficha)
  values ('acampante', p_id, null, null, btrim(p_motivo), public._nome_organizador_logado(),
          '{"removida": true}'::jsonb);
end;
$$;

-- ----------------------------------------------------- 1) desistencia
create or replace function public.desistir_acampante(p_id uuid, p_observacao text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a public.acampantes;
  v_erro text;
  v_inscrito timestamptz;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores.');
  end if;
  perform public._limpar_desistentes_vencidos();

  select * into a from public.acampantes where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Acampante não encontrado (talvez já tenha sido removido).');
  end if;
  v_erro := public._acampante_bloqueio_saida(a);
  if v_erro is not null then
    return jsonb_build_object('ok', false, 'erro', v_erro);
  end if;

  -- Data da inscricao: a tabela nao tem created_at. Usa o primeiro registro
  -- que houver (auditoria da inclusao, primeiro PIX); sem nada, hoje.
  v_inscrito := least(now(),
    (select min(u.em) from public.auditoria u
      where u.tabela = 'acampantes' and u.operacao = 'incluiu' and u.registro_id = p_id::text),
    (select min(x.created_at) from public.pix_sicoob x where x.inscricao_id = p_id));

  insert into public.acampantes_desistentes
    (acampante_id, cpf, nome, igreja, numero_edicao, observacao, desistiu_por, inscrito_em, ficha, vinculos, cobranca)
  -- acampantes.numero_edicao nunca foi preenchido: vale a edicao atual.
  values (a.id, nullif(regexp_replace(coalesce(a.cpf, ''), '\D', '', 'g'), ''), a.nome, a.igreja,
          coalesce(a.numero_edicao, public._edicao_atual()),
          nullif(btrim(coalesce(p_observacao, '')), ''), public._nome_organizador_logado(), v_inscrito,
          to_jsonb(a),
          (select coalesce(jsonb_agg(to_jsonb(v)), '[]'::jsonb) from public.acampantes_vinculos v
            where p_id in (v.acampante_a, v.acampante_b, v.origem_acampante)),
          (select to_jsonb(c) from public.cobrancas_acampantes c where c.acampante_id = p_id));

  perform public._apagar_acampante(p_id);
  return jsonb_build_object('ok', true, 'nome', a.nome);
end;
$$;

-- --------------------------------------------- 2) exclusao completa
create or replace function public.excluir_acampante_definitivo(p_id uuid, p_confirmacao text, p_motivo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a public.acampantes;
  v_erro text;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores.');
  end if;
  select * into a from public.acampantes where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Acampante não encontrado (talvez já tenha sido removido).');
  end if;
  if public._nome_comparavel(coalesce(p_confirmacao, '')) <> public._nome_comparavel(a.nome) then
    return jsonb_build_object('ok', false, 'erro', 'Para confirmar, digite o nome completo exatamente como está na ficha.');
  end if;
  if length(btrim(coalesce(p_motivo, ''))) < 3 then
    return jsonb_build_object('ok', false, 'erro', 'Escreva o motivo da exclusão.');
  end if;
  v_erro := public._acampante_bloqueio_saida(a);
  if v_erro is not null then
    return jsonb_build_object('ok', false, 'erro', v_erro);
  end if;

  perform public._apagar_acampante(p_id);
  perform public._apagar_rastros_acampante(p_id, a.cpf, p_motivo);
  return jsonb_build_object('ok', true, 'nome', a.nome);
end;
$$;

-- ------------------------------------------- lista de desistentes
create or replace function public.listar_desistentes()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores.');
  end if;
  perform public._limpar_desistentes_vencidos();
  return jsonb_build_object('ok', true, 'edicao_atual', public._edicao_atual(), 'itens', coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', d.id, 'acampante_id', d.acampante_id, 'nome', d.nome, 'cpf', d.cpf,
             'igreja', d.igreja, 'whatsapp', d.ficha ->> 'whatsapp',
             'numero_edicao', d.numero_edicao, 'observacao', d.observacao,
             'desistiu_por', d.desistiu_por, 'desistiu_em', d.desistiu_em,
             'apaga_em', d.inscrito_em + interval '180 days',
             'cpf_ativo', exists (select 1 from public.acampantes x
                                   where d.cpf is not null
                                     and regexp_replace(coalesce(x.cpf, ''), '\D', '', 'g') = d.cpf))
           order by d.desistiu_em desc)
      from public.acampantes_desistentes d), '[]'::jsonb));
end;
$$;

-- Volta para a inscricao (so na mesma edicao). Mesmo id, cobranca e vinculos
-- cujo outro lado ainda existe.
create or replace function public.restaurar_desistente(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d public.acampantes_desistentes;
  v jsonb;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores.');
  end if;
  select * into d from public.acampantes_desistentes where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Registro não encontrado.');
  end if;
  if d.numero_edicao is distinct from public._edicao_atual() then
    return jsonb_build_object('ok', false, 'erro',
      'Só dá para restaurar na mesma edição em que a pessoa desistiu. Numa edição nova, ela se inscreve de novo e os dados pessoais voltam preenchidos.');
  end if;
  if exists (select 1 from public.acampantes x where x.id = d.acampante_id)
     or (d.cpf is not null and exists (select 1 from public.acampantes x
                                        where regexp_replace(coalesce(x.cpf, ''), '\D', '', 'g') = d.cpf)) then
    return jsonb_build_object('ok', false, 'erro',
      'Esta pessoa já tem uma inscrição ativa (se inscreveu de novo). Não há o que restaurar.');
  end if;

  begin
    insert into public.acampantes
    select (jsonb_populate_record(null::public.acampantes, d.ficha)).*;
  exception when others then
    return jsonb_build_object('ok', false, 'erro', 'Não deu para restaurar: ' || sqlerrm);
  end;

  if d.cobranca is not null then
    insert into public.cobrancas_acampantes
    select (jsonb_populate_record(null::public.cobrancas_acampantes, d.cobranca)).*
    on conflict do nothing;
  end if;

  for v in select value from jsonb_array_elements(d.vinculos) loop
    if exists (select 1 from public.acampantes x where x.id = (v ->> 'acampante_a')::uuid)
       and exists (select 1 from public.acampantes x where x.id = (v ->> 'acampante_b')::uuid) then
      if v ->> 'origem_acampante' is not null
         and not exists (select 1 from public.acampantes x where x.id = (v ->> 'origem_acampante')::uuid) then
        v := jsonb_set(v, '{origem_acampante}', 'null'::jsonb);
      end if;
      insert into public.acampantes_vinculos
      select (jsonb_populate_record(null::public.acampantes_vinculos, v)).*
      on conflict do nothing;
    end if;
  end loop;

  delete from public.acampantes_desistentes where id = p_id;
  return jsonb_build_object('ok', true, 'nome', d.nome);
end;
$$;

-- Opcao 2 aplicada a quem ja esta no arquivo de desistentes.
create or replace function public.apagar_desistente(p_id uuid, p_confirmacao text, p_motivo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d public.acampantes_desistentes;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores.');
  end if;
  select * into d from public.acampantes_desistentes where id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Registro não encontrado.');
  end if;
  if public._nome_comparavel(coalesce(p_confirmacao, '')) <> public._nome_comparavel(d.nome) then
    return jsonb_build_object('ok', false, 'erro', 'Para confirmar, digite o nome completo exatamente como está na ficha.');
  end if;
  if length(btrim(coalesce(p_motivo, ''))) < 3 then
    return jsonb_build_object('ok', false, 'erro', 'Escreva o motivo da exclusão.');
  end if;
  perform public._apagar_rastros_acampante(d.acampante_id, d.cpf, p_motivo);
  return jsonb_build_object('ok', true, 'nome', d.nome);
end;
$$;

-- ------------------------------------- reinscricao (formulario publico)
-- So diz se existe; os dados so saem com CPF **e** nome completo, como na
-- ficha_para_reinscricao do equipante.
create or replace function public.acampante_tem_ficha_anterior(p_cpf text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_cpf text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
begin
  if length(v_cpf) <> 11 then
    return jsonb_build_object('ok', true, 'existe', false);
  end if;
  perform public._limpar_desistentes_vencidos();
  return jsonb_build_object('ok', true, 'existe',
    exists (select 1 from public.acampantes_desistentes d where d.cpf = v_cpf));
end;
$$;

-- Devolve SO dados pessoais e endereco (decisao do Patrick). Saude, contato
-- de emergencia, igreja, camisa, indicacao e termos sao preenchidos de novo.
create or replace function public.ficha_acampante_para_reinscricao(p_cpf text, p_nome text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_cpf text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  f jsonb;
begin
  if length(v_cpf) <> 11 or length(btrim(coalesce(p_nome, ''))) < 3 then
    return jsonb_build_object('ok', false, 'erro', 'Informe o CPF e o nome completo usados na inscrição anterior.');
  end if;
  perform public._limpar_desistentes_vencidos();

  if exists (select 1 from public.acampantes x where regexp_replace(coalesce(x.cpf, ''), '\D', '', 'g') = v_cpf) then
    return jsonb_build_object('ok', false, 'ja_inscrito', true, 'erro', 'Você já está inscrito nesta edição.');
  end if;

  select d.ficha into f
    from public.acampantes_desistentes d
   where d.cpf = v_cpf
     and public._nome_comparavel(d.nome) = public._nome_comparavel(p_nome)
   order by d.desistiu_em desc
   limit 1;
  if f is null then
    return jsonb_build_object('ok', false, 'erro',
      'Não encontramos uma inscrição anterior com esse CPF e esse nome. Confira o nome completo, ou preencha o formulário do zero.');
  end if;

  return jsonb_build_object('ok', true, 'ficha', jsonb_build_object(
    'nome', f ->> 'nome', 'cpf', f ->> 'cpf', 'sexo', f ->> 'sexo',
    'data_nascimento', f ->> 'data_nascimento', 'whatsapp', f ->> 'whatsapp',
    'email', f ->> 'email', 'estado_civil', f ->> 'estado_civil',
    'nacionalidade', f ->> 'nacionalidade', 'profissao', f ->> 'profissao',
    'cep', f ->> 'cep', 'endereco', f ->> 'endereco', 'numero', f ->> 'numero',
    'complemento', f ->> 'complemento', 'bairro', f ->> 'bairro',
    'cidade', f ->> 'cidade', 'estado', f ->> 'estado'));
end;
$$;

-- ------------------- "Excluir cadastro" (Configuracoes) deixa de apagar acampante
do $mig$
declare
  v text;
begin
  v := pg_get_functiondef('public.excluir_cadastro(text,uuid,text,text)'::regprocedure);
  if position($a$  v_ficha := public.ficha_para_exclusao(p_tipo, p_id);$a$ in v) = 0 then
    raise exception 'excluir_cadastro: trecho nao encontrado';
  end if;
  v := replace(v, $a$  v_ficha := public.ficha_para_exclusao(p_tipo, p_id);$a$,
                  $b$  if p_tipo = 'acampante' then
    return jsonb_build_object('ok', false, 'erro',
      'Acampante sai pelo botão Remover: "Desistiu da edição" ou "Excluir o cadastro completamente".');
  end if;
  v_ficha := public.ficha_para_exclusao(p_tipo, p_id);$b$);
  execute v;
end
$mig$;

-- ------------------------------------------------------------ permissoes
revoke all on function public._limpar_desistentes_vencidos() from public, anon, authenticated;
revoke all on function public._acampante_bloqueio_saida(public.acampantes) from public, anon, authenticated;
revoke all on function public._apagar_acampante(uuid) from public, anon, authenticated;
revoke all on function public._apagar_rastros_acampante(uuid, text, text) from public, anon, authenticated;

revoke all on function public.desistir_acampante(uuid, text) from public, anon;
revoke all on function public.excluir_acampante_definitivo(uuid, text, text) from public, anon;
revoke all on function public.listar_desistentes() from public, anon;
revoke all on function public.restaurar_desistente(uuid) from public, anon;
revoke all on function public.apagar_desistente(uuid, text, text) from public, anon;
grant execute on function public.desistir_acampante(uuid, text) to authenticated;
grant execute on function public.excluir_acampante_definitivo(uuid, text, text) to authenticated;
grant execute on function public.listar_desistentes() to authenticated;
grant execute on function public.restaurar_desistente(uuid) to authenticated;
grant execute on function public.apagar_desistente(uuid, text, text) to authenticated;

revoke all on function public.acampante_tem_ficha_anterior(text) from public;
revoke all on function public.ficha_acampante_para_reinscricao(text, text) from public;
grant execute on function public.acampante_tem_ficha_anterior(text) to anon, authenticated;
grant execute on function public.ficha_acampante_para_reinscricao(text, text) to anon, authenticated;
