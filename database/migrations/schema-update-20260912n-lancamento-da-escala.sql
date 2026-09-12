-- ---------------------------------------------------------------------------
-- Lancamento da escala, e a "cena" Nao sera escalado
--
-- Pedido do Patrick em 12/09/2026.
--
-- POR QUE
-- -------
-- Ate aqui, bastava o organizador alocar alguem numa area para essa pessoa
-- ver "Escala de trabalho: Concluido" e poder pagar. Mas a escala e montada
-- aos poucos, ao longo de dias -- e so vale quando a Direcao a ANUNCIA, na
-- reuniao de equipe. Alguem que fosse alocado no meio do processo veria a
-- escala antes da hora, e ainda poderia ser realocado depois.
--
-- Agora existe um passo explicito: LANCAR A ESCALA. Enquanto nao for
-- lancada, ninguem ve a etapa concluida nem consegue pagar, mesmo ja tendo
-- area.
--
-- A TRAVA
-- -------
-- Lancar so e possivel com a fila "A escalar" ZERADA. Todo aprovado precisa
-- ter um destino -- e por isso existe a area "Nao sera escalado": pode
-- acontecer de alguem aprovado pela igreja nao entrar na escala (excesso de
-- gente, por exemplo), e sem um lugar para essa pessoa a fila nunca zeraria.
--
-- Quem cai la ve, DEPOIS do lancamento, "Cancelado -- verificar com a
-- Direcao", e nunca abre o pagamento. Antes do lancamento ve a mesma frase
-- de quem esta aguardando: nada foi anunciado ainda.
--
-- A inscricao dessa pessoa continua 'aprovado' no banco (decisao do
-- Patrick): nada some das listas do organizador, e para voltar atras basta
-- realoca-la para uma area de verdade.
--
-- DESFAZER
-- --------
-- O lancamento pode ser desfeito. Quem ja pagou continua pago -- desfazer
-- nao mexe em pagamento nenhum; so volta a fechar o acesso de quem ainda
-- nao pagou.
--
-- ⚠️ ARMADILHA QUE PEGOU AQUI
-- ---------------------------
-- A primeira versao destas duas funcoes fazia "update configuracoes set ..."
-- SEM WHERE. Passou em todo teste por SQL e falhou pelo site: as conexoes do
-- site carregam a extensao "safeupdate" (session_preload_libraries do papel
-- authenticator), que recusa UPDATE/DELETE sem WHERE com o erro 21000. O
-- MCP roda como postgres, sem a extensao -- por isso nao aparecia.
--
-- Licao: RPC de organizador tem de ser testada pela API REST, com o cracha,
-- e nao so com "set local role authenticated".
-- ---------------------------------------------------------------------------

alter table public.configuracoes
  add column if not exists escala_lancada_em timestamptz;

comment on column public.configuracoes.escala_lancada_em is
  'Quando o organizador lancou a escala. Ate estar preenchido, NENHUM equipante ve a etapa "Escala de trabalho" concluida nem consegue pagar -- mesmo ja tendo area.';

-- Teto alto de proposito: esta area nunca pode barrar o organizador.
insert into public.limites_areas (area_nome, limite_maximo, somente_organizador)
values ('Não será escalado', 999, true)
on conflict (area_nome) do update
  set limite_maximo = excluded.limite_maximo,
      somente_organizador = excluded.somente_organizador,
      updated_at = now();

insert into public.atuacoes_areas (area_nome, atuacao, ordem, eh_padrao, eh_lider)
values ('Não será escalado', 'Verificar com a Direção', 1, true, false)
on conflict (area_nome, atuacao) do update
  set ordem = excluded.ordem, eh_padrao = excluded.eh_padrao;


-- ---------------------------------------------------------------------
-- Como esta a escala (painel da tela do organizador)
-- ---------------------------------------------------------------------
create or replace function public.situacao_escala()
returns jsonb
language plpgsql stable security definer
set search_path to 'public'
as $fn$
declare
  v_faltam int; v_escalados int; v_fora int; v_lancada timestamptz;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores.');
  end if;

  select c.escala_lancada_em into v_lancada from public.configuracoes c limit 1;

  select count(*) into v_faltam
    from public.equipantes q
   where q.tipo = 'equipante' and q.status = 'aprovado'
     and not exists (select 1 from public.escalas e where e.equipante_id = q.id);

  select count(*) into v_escalados
    from public.escalas e where e.area_alocada <> 'Não será escalado';

  select count(*) into v_fora
    from public.escalas e where e.area_alocada = 'Não será escalado';

  return jsonb_build_object('ok', true, 'lancada_em', v_lancada,
    'faltam', v_faltam, 'escalados', v_escalados, 'nao_serao_escalados', v_fora);
end;
$fn$;
revoke all on function public.situacao_escala() from public, anon;
grant execute on function public.situacao_escala() to authenticated;


-- ---------------------------------------------------------------------
-- Lancar / desfazer  (note o WHERE -- ver a armadilha no topo)
-- ---------------------------------------------------------------------
create or replace function public.lancar_escala()
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $fn$
declare v_faltam int; v_id uuid;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores podem lançar a escala.');
  end if;

  select count(*) into v_faltam
    from public.equipantes q
   where q.tipo = 'equipante' and q.status = 'aprovado'
     and not exists (select 1 from public.escalas e where e.equipante_id = q.id);

  if v_faltam > 0 then
    return jsonb_build_object('ok', false, 'faltam', v_faltam, 'erro',
      format('Ainda há %s equipante(s) sem destino. Distribua todos (ou marque como "Não será escalado") antes de lançar.', v_faltam));
  end if;

  select c.id into v_id from public.configuracoes c limit 1;
  if v_id is null then
    return jsonb_build_object('ok', false, 'erro', 'Configuração não encontrada.');
  end if;

  update public.configuracoes set escala_lancada_em = now() where id = v_id;

  return jsonb_build_object('ok', true,
    'lancada_em', (select escala_lancada_em from public.configuracoes where id = v_id));
end;
$fn$;
revoke all on function public.lancar_escala() from public, anon;
grant execute on function public.lancar_escala() to authenticated;

create or replace function public.desfazer_lancamento_escala()
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $fn$
declare v_id uuid;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores podem desfazer o lançamento.');
  end if;

  select c.id into v_id from public.configuracoes c limit 1;
  if v_id is null then
    return jsonb_build_object('ok', false, 'erro', 'Configuração não encontrada.');
  end if;

  update public.configuracoes set escala_lancada_em = null where id = v_id;

  return jsonb_build_object('ok', true);
end;
$fn$;
revoke all on function public.desfazer_lancamento_escala() from public, anon;
grant execute on function public.desfazer_lancamento_escala() to authenticated;


-- ---------------------------------------------------------------------
-- A situacao do equipante passa a depender do lancamento
-- ---------------------------------------------------------------------
create or replace function public.situacao_inscricao(
  p_tipo text, p_id uuid, p_cpf text default null, p_nome text default null
)
returns jsonb
language plpgsql stable security definer
set search_path to 'public'
as $fn$
declare
  q record; v_area text; v_lancada timestamptz;
  v_fora boolean; v_escalado boolean; v_pago boolean; v_menor boolean;
begin
  if not (public.eh_organizador() or public._inscricao_e_sua(p_tipo, p_id, p_cpf, p_nome)) then
    return jsonb_build_object('ok', false, 'erro',
      'Confirme o CPF (ou o nome) usado na inscrição.');
  end if;

  if p_tipo <> 'equipante' then
    select a.nome, a.status_pagamento into q from public.acampantes a where a.id = p_id;
    if not found then
      return jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada.');
    end if;
    v_pago := lower(coalesce(q.status_pagamento,'')) in ('pago','confirmado','completed');
    return jsonb_build_object('ok', true, 'tipo', 'acampante', 'nome', q.nome,
                              'pago', v_pago, 'pode_pagar', not v_pago);
  end if;

  select e.nome, e.idade, e.status, e.status_pagamento, e.parental_auth_file_url
    into q
    from public.equipantes e
   where e.id = p_id and e.tipo = 'equipante';

  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada.');
  end if;

  select s.area_alocada into v_area from public.escalas s where s.equipante_id = p_id;
  select c.escala_lancada_em into v_lancada from public.configuracoes c limit 1;

  v_pago  := lower(coalesce(q.status_pagamento,'')) in ('pago','confirmado','completed');
  v_menor := coalesce(q.idade, 18) < 18;

  -- So conta como escalado depois do lancamento, e so em area de verdade.
  v_fora     := v_lancada is not null and v_area = 'Não será escalado';
  v_escalado := v_lancada is not null and v_area is not null and v_area <> 'Não será escalado';

  return jsonb_build_object(
    'ok', true, 'tipo', 'equipante', 'nome', q.nome,
    'menor_de_idade', v_menor,
    'autorizacao_pais_enviada', q.parental_auth_file_url is not null,
    'aprovacao', coalesce(q.status, 'pendente'),
    'escala_lancada', v_lancada is not null,
    'escalado', v_escalado,
    'nao_sera_escalado', v_fora,
    'pago', v_pago,
    'pode_pagar', (coalesce(q.status,'') = 'aprovado')
                  and v_escalado
                  and (not v_menor or q.parental_auth_file_url is not null)
                  and not v_pago
  );
end;
$fn$;
revoke all on function public.situacao_inscricao(text, uuid, text, text) from public;
grant execute on function public.situacao_inscricao(text, uuid, text, text) to anon, authenticated;


-- ---------------------------------------------------------------------
-- CONFERENCIA (pela tela, com cracha de organizador de verdade)
-- ---------------------------------------------------------------------
--   lancar com 1 na fila ..... recusado, "Ainda há 1 equipante(s) sem destino"
--   botao na tela ............ "Lançar escala (faltam 1)", desabilitado
--   fila zerada .............. "Todos distribuídos. A escala já pode ser lançada."
--   dialogo .................. "os 3 equipantes escalados vão poder iniciar o
--                               pagamento" + "A pessoa marcada como Não será
--                               escalado vai ver Cancelado..."
--   lancar ................... "Escala lançada em 12/09/2026, 13:31 — os
--                               escalados já podem pagar."
--   equipante escalado ....... pode_pagar = true
--   equipante "nao sera" ..... "Cancelado — verificar com a Direção",
--                               etapa Escala = Rejeitado, sem botao de pagar
--   desfazer ................. volta tudo para "aguardando a escala"
-- ---------------------------------------------------------------------
