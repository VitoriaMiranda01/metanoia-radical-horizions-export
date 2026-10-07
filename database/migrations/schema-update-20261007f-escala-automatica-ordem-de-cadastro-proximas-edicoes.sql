-- ---------------------------------------------------------------------------
-- Alocacao automatica: a fila passa a andar pela ORDEM DE CADASTRO a partir da
-- PROXIMA edicao. Nesta edicao (37) continua valendo a ordem de APROVACAO.
--
-- Pedido da Victoria, 06/10/2026 ("aprovacao depende de muita coisa -- coloca
-- como regra quem cadastrou primeiro"), combinado com o Patrick: vale para as
-- proximas edicoes; a atual segue com a regra antiga.
--
-- Por que nao deu para trocar so a ordem: a inscricao normal (criar_inscricao)
-- NUNCA gravou a hora do cadastro. equipantes.created_at fica NULL (a funcao
-- monta a linha com jsonb_populate_record e insere o registro inteiro, entao o
-- DEFAULT now() nao entra). Em 06/10/2026, 599 dos 670 aprovados estavam sem
-- data; so as 71 inscricoes manuais tinham. Essa data de quem ja se inscreveu
-- nao tem como ser recuperada -- por isso a regra antiga fica nesta edicao.
--
-- O que muda:
--   1. equipantes.inscrito_em: o momento em que a pessoa se inscreveu NA
--      EDICAO (cadastro novo, reinscricao de ficha antiga e inscricao manual).
--      A virada de edicao zera, e cada um grava de novo ao se inscrever.
--   2. configuracoes.escala_ordem: 'aprovacao' (padrao -- o que vale hoje) ou
--      'cadastro'. resetar_para_nova_edicao passa para 'cadastro'.
--   3. alocar_fila_automaticamente le a regra de escala_ordem. Nada mais muda:
--      passadas, teto por area, limite por sexo, areas so da diretoria e a
--      ultima passada do "qualquer area".
--
-- Para virar a regra antes da proxima edicao (nao precisa agora):
--   update public.configuracoes set escala_ordem = 'cadastro';
--
-- Mesmo molde de patch das migracoes anteriores: pega a definicao que esta no
-- banco, troca so os trechos abaixo e RECUSA se nao achar exatamente o numero
-- esperado de ocorrencias (nao sobrescreve uma funcao que ja mudou).
-- ---------------------------------------------------------------------------

create or replace function pg_temp._patch(p_fn regprocedure, p_de text, p_para text, p_vezes int default 1)
returns void
language plpgsql
as $fn$
declare
  d text := pg_get_functiondef(p_fn);
  n int := (length(d) - length(replace(d, p_de, ''))) / length(p_de);
begin
  if n <> p_vezes then
    raise exception 'patch %: esperava % ocorrencia(s) de [%], achou %', p_fn, p_vezes, left(p_de, 80), n;
  end if;
  execute replace(d, p_de, p_para);
end;
$fn$;

-- 1. Colunas novas ------------------------------------------------------------
alter table public.equipantes
  add column if not exists inscrito_em timestamptz;
comment on column public.equipantes.inscrito_em is
  'Momento em que a pessoa se inscreveu NESTA edicao. Zerado na virada de edicao. Define a ordem da alocacao automatica quando configuracoes.escala_ordem = ''cadastro''.';

alter table public.configuracoes
  add column if not exists escala_ordem text not null default 'aprovacao';
do $c$
begin
  if not exists (select 1 from pg_constraint where conname = 'configuracoes_escala_ordem_check') then
    alter table public.configuracoes
      add constraint configuracoes_escala_ordem_check check (escala_ordem in ('aprovacao', 'cadastro'));
  end if;
end
$c$;
comment on column public.configuracoes.escala_ordem is
  'Quem escolhe primeiro na alocacao automatica: ''aprovacao'' (quem foi aprovado antes) ou ''cadastro'' (quem se inscreveu antes). Vira ''cadastro'' na virada de edicao.';

-- 2. Inscricao normal: grava o momento do cadastro ----------------------------
-- Ficha nova.
select pg_temp._patch('public.criar_inscricao(text,jsonb,text)',
  $$    v_e.decidido_em := null;
    insert into public.equipantes select (v_e).*;$$,
  $$    v_e.decidido_em := null;
    -- Momento do cadastro: sempre o do servidor, nunca o que veio no JSON.
    v_e.created_at := now();
    v_e.inscrito_em := now();
    insert into public.equipantes select (v_e).*;$$);
-- Reinscricao de ficha de edicao anterior.
select pg_temp._patch('public.criar_inscricao(text,jsonb,text)',
  $$        decidido_em                  = null
      where id = v_atual.id;$$,
  $$        decidido_em                  = null,
        inscrito_em                  = now()
      where id = v_atual.id;$$);

-- 3. Inscricao manual: idem ---------------------------------------------------
select pg_temp._patch('public.inscricao_manual_equipante(jsonb)',
  $$    inscricao_manual_em  = now()
  where id = v_id;$$,
  $$    inscricao_manual_em  = now(),
    inscrito_em          = now()
  where id = v_id;$$);

-- 4. Virada de edicao: zera a data e liga a regra do cadastro ------------------
select pg_temp._patch('public.resetar_para_nova_edicao(integer)',
  $$    decidido_em            = null
  where tipo = 'equipante';$$,
  $$    decidido_em            = null,
    inscrito_em            = null
  where tipo = 'equipante';$$);
select pg_temp._patch('public.resetar_para_nova_edicao(integer)',
  $$    inscricoes_acampantes  = false
  where id is not null;$$,
  $$    inscricoes_acampantes  = false,
    escala_ordem           = 'cadastro'
  where id is not null;$$);

-- 5. Alocacao automatica: a ordem da fila segue escala_ordem ------------------
-- (passadas 1-3 e a passada do "qualquer area"). No modo 'cadastro' quem nao
-- tem inscrito_em cai na data de aprovacao, nunca na da ficha antiga.
select pg_temp._patch('public.alocar_fila_automaticamente()',
  $$order by coalesce(q.decidido_em, q.created_at) nulls last, q.nome$$,
  $$order by case when (select c.escala_ordem from public.configuracoes c limit 1) = 'cadastro'
                  then coalesce(q.inscrito_em, q.decidido_em, q.created_at)
                  else coalesce(q.decidido_em, q.created_at)
             end nulls last, q.nome$$, 2);
select pg_temp._patch('public.alocar_fila_automaticamente()',
  $$A ordem dentro da passada e a da aprovacao (quem foi
  -- aprovado antes escolhe antes); o nome so desempata.$$,
  $$A ordem dentro da passada vem de configuracoes.escala_ordem:
  -- 'aprovacao' (quem foi aprovado antes escolhe antes) ou 'cadastro' (quem se
  -- inscreveu antes escolhe antes); o nome so desempata.$$);
