-- ---------------------------------------------------------------------------
-- Permissoes por organizador (03/11/2026)
--
-- Pedido do Patrick: nem todo organizador tem acesso maximo. O login
-- Desenvolvedores marca, em Configuracoes > Organizadores > Permissoes, o que
-- cada um pode fazer, e desmarca quando quiser. Decidido com ele:
--
--   caixas (organizadores_auth.permissoes):
--     gerenciar_inscricoes  Gerenciar inscricoes (inclui camisas, avisos,
--                           vinculos e grupos de trilha dos acampantes)
--     inscricao_manual      Inscricao manual
--     aprovacao_equipe      Aprovacao da equipe
--     geracao_escala        Geracao de escala (alocar, chamada, fixos...)
--     responsavel_reuniao   Responsavel pela reuniao
--     troca_diaria          Troca de area depois de lancada
--     lancamento_escala     Lancar/desfazer a provisoria e a oficial
--     pagamentos            Pagamentos
--
--   SO Desenvolvedores (sem caixa): Configuracoes, Saude, Backup, Portaria,
--   Recepcao (com Crachas e Listas dos onibus) e Senhas dos parceiros.
--   Trocar a propria senha continua para todos.
--
--   contas que ja existiam ficam com o que tinham: Raquel e Eduardo (que
--   geravam escala e faziam inscricao manual pelo NOME) com tudo; os demais
--   com o que todo organizador fazia por completo. "Geracao de escala" NAO
--   foi marcada para eles: antes so alocavam, sem tirar/limpar/chamada.
--   Conta nova nasce sem nada.
--
-- Fim das permissoes pelo nome: _gere_escala, pode_inscrever_manual e os
-- avisos do "perfil da Raquel" passam a olhar a caixa.
--
-- O banco confere nas ACOES (funcoes). Leituras gerais continuam para todo
-- organizador (as telas sao escondidas); as areas so de Desenvolvedores
-- fecham inclusive a leitura.
-- ---------------------------------------------------------------------------

alter table public.organizadores_auth
  add column if not exists permissoes text[] not null default '{}';

create or replace function public._permissoes_organizador_validas()
returns text[]
language sql
immutable
as $fn$
  select array['gerenciar_inscricoes', 'inscricao_manual', 'aprovacao_equipe',
               'geracao_escala', 'responsavel_reuniao', 'troca_diaria',
               'lancamento_escala', 'pagamentos'];
$fn$;
revoke all on function public._permissoes_organizador_validas() from public, anon, authenticated;

-- A pergunta que o resto do banco faz: o organizador logado pode isso?
-- Desenvolvedores pode tudo.
create or replace function public.org_pode(p_permissao text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select public.eh_organizador_maximo()
      or coalesce((select p_permissao = any(o.permissoes)
                     from public._organizador_do_cracha() o
                    where o.id is not null), false);
$fn$;
revoke all on function public.org_pode(text) from public, anon;
grant execute on function public.org_pode(text) to authenticated;

-- O que a tela precisa saber para montar o menu.
create or replace function public.minhas_permissoes()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select case when not public.eh_organizador() then null
         when public.eh_organizador_maximo() then
           jsonb_build_object('maximo', true,
                              'permissoes', to_jsonb(public._permissoes_organizador_validas()))
         else
           jsonb_build_object('maximo', false,
                              'permissoes', coalesce((select to_jsonb(o.permissoes)
                                                        from public._organizador_do_cracha() o
                                                       where o.id is not null), '[]'::jsonb))
         end;
$fn$;
revoke all on function public.minhas_permissoes() from public, anon;
grant execute on function public.minhas_permissoes() to authenticated;

create or replace function public.definir_permissoes_organizador(p_nome text, p_permissoes text[])
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_alvo public.organizadores_auth%rowtype;
  v_novas text[];
begin
  if not public.eh_organizador_maximo() then
    return jsonb_build_object('ok', false, 'erro',
      'Apenas o login de permissão máxima define as permissões.');
  end if;
  select * into v_alvo from public.organizadores_auth
   where lower(nome) = lower(btrim(coalesce(p_nome, ''))) limit 1;
  if v_alvo.id is null then
    return jsonb_build_object('ok', false, 'erro', 'Organizador não encontrado.');
  end if;
  if v_alvo.nome ilike 'Desenvolvedores' then
    return jsonb_build_object('ok', false, 'erro',
      'A conta Desenvolvedores sempre tem acesso a tudo.');
  end if;
  if exists (select 1 from unnest(coalesce(p_permissoes, '{}')) x
              where x <> all (public._permissoes_organizador_validas())) then
    return jsonb_build_object('ok', false, 'erro', 'Permissão desconhecida. Atualize a página.');
  end if;

  select coalesce(array_agg(x order by array_position(public._permissoes_organizador_validas(), x)), '{}')
    into v_novas
    from (select distinct x from unnest(coalesce(p_permissoes, '{}')) x) t;

  update public.organizadores_auth set permissoes = v_novas where id = v_alvo.id;

  return jsonb_build_object('ok', true, 'nome', v_alvo.nome, 'permissoes', to_jsonb(v_novas));
end;
$fn$;
revoke all on function public.definir_permissoes_organizador(text, text[]) from public, anon;
grant execute on function public.definir_permissoes_organizador(text, text[]) to authenticated;

-- A lista de Configuracoes passa a mandar as caixas de cada um.
drop function if exists public.listar_organizadores();
create function public.listar_organizadores()
returns table(nome text, senha_definida boolean, senha_atualizada_em timestamptz,
              ultimo_acesso timestamptz, protecao_forte boolean, eh_o_maximo boolean,
              permissoes text[])
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select o.nome,
         o.senha_definida,
         o.senha_atualizada_em,
         o.ultimo_acesso,
         substring(o.senha from 1 for 7) = '$2a$12$',
         o.nome ilike 'Desenvolvedores',
         o.permissoes
    from public.organizadores_auth o
   where public.eh_organizador_maximo()
   order by (o.nome ilike 'Desenvolvedores') desc, o.nome;
$fn$;
revoke all on function public.listar_organizadores() from public, anon;
grant execute on function public.listar_organizadores() to authenticated;

-- Contas que ja existiam (ver cabecalho).
update public.organizadores_auth
   set permissoes = public._permissoes_organizador_validas()
 where lower(nome) in ('raquel', 'eduardo');
update public.organizadores_auth
   set permissoes = array['gerenciar_inscricoes', 'aprovacao_equipe', 'responsavel_reuniao', 'pagamentos']
 where lower(nome) not in ('raquel', 'eduardo', 'desenvolvedores');

-- Permissoes que eram pelo nome.
create or replace function public._gere_escala()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select public.org_pode('geracao_escala');
$fn$;

create or replace function public.pode_inscrever_manual()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select public.org_pode('inscricao_manual');
$fn$;

-- ---------------------------------------------------------------------------
-- Troca das checagens dentro das funcoes. Cada troca exige achar o trecho
-- (senao para tudo, como nos outros patches).
-- ---------------------------------------------------------------------------
do $do$
declare
  -- eh_organizador() -> caixa (ou so Desenvolvedores em "__maximo").
  v_mapa jsonb := jsonb_build_object(
    'gerenciar_inscricoes', jsonb_build_array(
      'desistir_acampante', 'excluir_acampante_definitivo',
      'duplicado_resolver', 'pedido_acesso_resolver',
      'salvar_vinculo_acampantes', 'excluir_vinculo_acampantes', 'ignorar_sugestao_vinculo'),
    'aprovacao_equipe', jsonb_build_array(
      'decidir_inscricao', 'aprovar_em_lote', 'desfazer_lote_aprovacao',
      'definir_so_domingo_pendente', 'conferir_autorizacao_menor'),
    'geracao_escala', jsonb_build_array(
      'alocar_em_lote_na_area', 'alocar_equipante_manualmente', 'alocar_fila_automaticamente',
      'desfazer_alocacao_automatica', 'definir_atuacao_alocacao', 'definir_atuacao_na_area',
      'definir_cor_alocacao', 'definir_cor_na_area', 'distribuir_cores_area',
      'decidir_disponibilidade_extra', 'definir_lider_area_extra', 'remover_lider_area_extra'),
    'responsavel_reuniao', jsonb_build_array(
      'definir_responsavel_reuniao', 'definir_responsavel_em_bloco', 'remover_responsavel_reuniao'),
    'pagamentos', jsonb_build_array('registrar_pagamento', 'desfazer_pagamento'),
    '__maximo', jsonb_build_array(
      -- portaria e recepcao (o organizador entra por _portaria_quem/_recepcao_quem)
      '_portaria_quem', '_recepcao_quem', 'recepcao_reabrir_chamada', 'recepcao_chamada_aviso',
      'recepcao_desfazer_presenca', 'recepcao_marcar_presenca', 'recepcao_lista',
      'onibus_desfazer_divisao', 'onibus_fechar_divisao', 'onibus_mover', 'onibus_salvar_config',
      'crachas_lista', 'crachas_marcar_impressos', 'crachas_desmarcar_impresso',
      -- saude
      'saude_acampantes', 'saude_equipe', 'especialidade_saude_adicionar',
      'especialidade_saude_excluir', 'especialidade_saude_renomear',
      'especialidades_saude_gerenciar', 'especialidades_saude_outros',
      'definir_especialidade_saude', 'definir_grupo_saude', 'tornar_especialidade_fixa',
      -- senhas dos parceiros
      'liberar_primeiro_acesso', 'redefinir_senha_parceiro', 'descartar_solicitacao_senha',
      'listar_contas_parceiros', 'definir_igrejas_da_conta', 'criar_igreja_parceira',
      -- configuracoes
      'definir_datas_reunioes', 'definir_janela_domingo', 'salvar_locais_reuniao',
      'cadastrar_igreja', 'editar_igreja', 'adicionar_igreja_extra', 'remover_igreja_extra',
      'vincular_outra_igreja', 'remover_pastor', 'conferir_pastor',
      'resetar_para_nova_edicao', 'listar_desistentes', 'restaurar_desistente', 'apagar_desistente',
      'buscar_cadastros_exclusao')
  );
  -- _gere_escala() -> caixa propria.
  v_mapa_gere jsonb := jsonb_build_object(
    'lancamento_escala', jsonb_build_array(
      'lancar_escala', 'desfazer_lancamento_escala', 'lancar_escala_oficial', 'desfazer_escala_oficial'),
    'troca_diaria', jsonb_build_array('trocar_area_escala'),
    -- o resumo aparece na confirmacao de lancar a oficial
    'geracao_escala|lancamento_escala', jsonb_build_array('resumo_antes_da_oficial'),
    '__maximo', jsonb_build_array('excluir_cadastro', 'ficha_para_exclusao'));
  -- Estas conferem "_nome_organizador_logado() is null": sem a caixa, o nome
  -- vem nulo e a propria funcao recusa.
  v_pagamentos_pelo_nome text[] := array[
    'cobranca_definir', 'cobranca_remover', 'cobranca_definir_inscricao', 'cobranca_remover_inscricao',
    'debito_autorizar', 'debito_quitar', 'debito_retirar',
    'grupo_enviado_marcar', 'grupo_enviado_desmarcar'];
  r record; v_fn text; v_oid oid; v_def text; v_novo text; v_expr text; v_achou boolean;
begin
  foreach v_fn in array v_pagamentos_pelo_nome loop
    v_achou := false;
    for v_oid in select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = v_fn loop
      v_def := pg_get_functiondef(v_oid);
      v_novo := regexp_replace(v_def, '(public\.)?\m_nome_organizador_logado\(\)',
        $t$(case when public.org_pode('pagamentos') then public._nome_organizador_logado() end)$t$, 'g');
      if v_novo <> v_def then
        execute v_novo;
        v_achou := true;
      end if;
    end loop;
    if not v_achou then
      raise exception 'trecho nao encontrado: _nome_organizador_logado() em %', v_fn;
    end if;
  end loop;

  for r in select key, value from jsonb_each(v_mapa) loop
    v_expr := case when r.key = '__maximo' then 'public.eh_organizador_maximo()'
                   else format('public.org_pode(%L)', r.key) end;
    for v_fn in select jsonb_array_elements_text(r.value) loop
      v_achou := false;
      for v_oid in select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = v_fn loop
        v_def := pg_get_functiondef(v_oid);
        v_novo := regexp_replace(v_def, '(public\.)?\meh_organizador\(\)', v_expr, 'g');
        if v_novo <> v_def then
          execute v_novo;
          v_achou := true;
        end if;
      end loop;
      if not v_achou then
        raise exception 'trecho nao encontrado: eh_organizador() em %', v_fn;
      end if;
    end loop;
  end loop;

  for r in select key, value from jsonb_each(v_mapa_gere) loop
    v_expr := case when r.key = '__maximo' then 'public.eh_organizador_maximo()'
                   else '(' || (select string_agg(format('public.org_pode(%L)', k), ' or ')
                                  from unnest(string_to_array(r.key, '|')) k) || ')' end;
    for v_fn in select jsonb_array_elements_text(r.value) loop
      v_achou := false;
      for v_oid in select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = v_fn loop
        v_def := pg_get_functiondef(v_oid);
        v_novo := regexp_replace(v_def, '(public\.)?\m_gere_escala\(\)', v_expr, 'g');
        if v_novo <> v_def then
          execute v_novo;
          v_achou := true;
        end if;
      end loop;
      if not v_achou then
        raise exception 'trecho nao encontrado: _gere_escala() em %', v_fn;
      end if;
    end loop;
  end loop;

  -- Avisos do "perfil da Raquel" (camisa, contato de emergencia, telefones,
  -- cadastro, nascimento): agora quem tem Gerenciar inscricoes.
  for v_fn in select unnest(array['camisas_pendentes', 'contatos_emergencia_pendentes',
                                  'telefones_acampantes_pendentes', 'cadastro_acampantes_pendentes',
                                  'nascimentos_pendentes']) loop
    select p.oid into v_oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = v_fn;
    v_def := pg_get_functiondef(v_oid);
    v_novo := replace(v_def, $t$if v_nome not in ('raquel', 'desenvolvedores') then$t$,
                             $t$if not public.org_pode('gerenciar_inscricoes') then$t$);
    v_novo := replace(v_novo, $t$case when v_nome = 'raquel' then 'raquel' else 'desenvolvedores' end$t$,
                              $t$case when public.eh_organizador_maximo() then 'desenvolvedores' else 'organizador' end$t$);
    if v_novo = v_def or position('org_pode' in v_novo) = 0 or position($t$then 'raquel'$t$ in v_novo) > 0 then
      raise exception 'trecho nao encontrado: perfil da Raquel em %', v_fn;
    end if;
    execute v_novo;
  end loop;

  -- Mensagens que citavam nomes.
  for v_oid in select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'public'
                  and (p.prosrc like '%Desenvolvedores, Raquel e Dudu%'
                       or p.prosrc like '%Só Raquel, Eduardo e Desenvolvedores fazem inscrição manual.%') loop
    v_def := pg_get_functiondef(v_oid);
    v_novo := regexp_replace(v_def,
      '(Só|Apenas) Desenvolvedores, Raquel e Dudu[^'']*',
      'Você não tem permissão para isso. Peça aos Desenvolvedores.', 'g');
    v_novo := replace(v_novo, 'Só Raquel, Eduardo e Desenvolvedores fazem inscrição manual.',
                      'Você não tem permissão para fazer inscrição manual. Peça aos Desenvolvedores.');
    execute v_novo;
  end loop;
end
$do$;

-- ---------------------------------------------------------------------------
-- Tabelas editadas direto pela tela.
-- ---------------------------------------------------------------------------
-- configuracoes: Configuracoes (so Desenvolvedores) e os CPFs das areas
-- especiais na Geracao de escala. Leitura segue para todos.
drop policy if exists "organizador faz tudo" on public.configuracoes;
create policy "organizador le" on public.configuracoes for select
  using ((select public.eh_organizador()));
create policy "gestao altera" on public.configuracoes for all
  using ((select public.eh_organizador_maximo()) or (select public.org_pode('geracao_escala')))
  with check ((select public.eh_organizador_maximo()) or (select public.org_pode('geracao_escala')));

-- cupons e limites por igreja: so Configuracoes.
drop policy if exists "organizador faz tudo" on public.cupons;
create policy "organizador le" on public.cupons for select
  using ((select public.eh_organizador()));
create policy "desenvolvedores altera" on public.cupons for all
  using ((select public.eh_organizador_maximo()))
  with check ((select public.eh_organizador_maximo()));

drop policy if exists "organizador faz tudo" on public.limites_igrejas;
create policy "organizador le" on public.limites_igrejas for select
  using ((select public.eh_organizador()));
create policy "desenvolvedores altera" on public.limites_igrejas for all
  using ((select public.eh_organizador_maximo()))
  with check ((select public.eh_organizador_maximo()));

-- limites por area e fotos da trilha: Geracao de escala.
drop policy if exists "organizador faz tudo" on public.limites_areas;
create policy "organizador le" on public.limites_areas for select
  using ((select public.eh_organizador()));
create policy "gestao altera" on public.limites_areas for all
  using ((select public.org_pode('geracao_escala')))
  with check ((select public.org_pode('geracao_escala')));

drop policy if exists "Fotos da trilha: organizador" on public.fotos_trilha;
create policy "Fotos da trilha: organizador le" on public.fotos_trilha for select
  using ((select public.eh_organizador()));
create policy "Fotos da trilha: gestao altera" on public.fotos_trilha for all
  using ((select public.org_pode('geracao_escala')))
  with check ((select public.org_pode('geracao_escala')));
