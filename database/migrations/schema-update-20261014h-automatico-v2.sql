-- ---------------------------------------------------------------------------
-- Alocar automatico, versao 2 (14/10/2026, Patrick). Lista de ajustes:
--
--  1. Fotografia fica fora do automatico (precisa de equipamento proprio).
--  3. Quem foi tirado/movido A MAO de uma area nao volta para ela no
--     automatico (tabela escalas_saidas_manuais, preenchida por gatilho so
--     quando a saida vem de remover_alocacao / realocar_alocacao /
--     liberar_vaga_e_realocar; "Limpar área" e o "Desfazer" nao contam).
--  4. "Disponível para qualquer área": vai para uma area SORTEADA entre as
--     que tem vaga (antes: a de mais vaga).
--  5. Inscricao manual sem nenhuma opcao = disponivel para qualquer area.
--     Sem sexo informado, so vai para area sem limite por sexo.
--  4/9. Quem tem as 3 opcoes cheias (ou opcoes que nao sao areas da escala)
--     tambem vai para uma area sorteada, marcado "fora_das_opcoes" (a tela
--     mostra a etiqueta "Fora das opções").
--  6/8. Invisível e Marcador (e Pastor Invisível) entram com cor, equilibrando
--     quantidade e homens/mulheres por cor. distribuir_cores_area() faz o
--     mesmo para quem ja esta na area sem cor.
--  7. Pastor Invisível: o automatico completa a area ate o limite (15), 3 por
--     cor, misturando homens e mulheres. So pastores (cargo PASTOR(A) /
--     PASTOR(A) AUXILIAR ou e_pastor) -- quem esta no pre-cadastro entra
--     primeiro. A pessoa SAI das outras areas (outras pessoas podem ocupar o
--     lugar dela); quem e lider ou fixo em alguma area nao e escolhido. O
--     "Desfazer" devolve as areas antigas (lotes_alocacao_automatica_itens.
--     restaurar).
--
-- O motivo de cada colocacao fica em lotes_alocacao_automatica_itens.motivo;
-- escalas_automaticas_motivos() entrega {escala_id: motivo} so a organizador.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Saidas a mao
-- ---------------------------------------------------------------------------
create table if not exists public.escalas_saidas_manuais (
  equipante_id uuid not null,
  area         text not null,
  em           timestamptz not null default now(),
  por          text,
  edicao       integer,
  primary key (equipante_id, area)
);
alter table public.escalas_saidas_manuais enable row level security;
revoke all on public.escalas_saidas_manuais from anon, authenticated;

create or replace function public._edicao_atual()
returns integer
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select edicao_numero from public.configuracoes limit 1;
$fn$;

create or replace function public._saiu_a_mao(p_equipante uuid, p_area text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select exists (select 1 from public.escalas_saidas_manuais s
                  where s.equipante_id = p_equipante and s.area = p_area
                    and s.edicao is not distinct from public._edicao_atual());
$fn$;

create or replace function public._registrar_saida_manual()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_path text := ltrim(coalesce(current_setting('request.path', true), ''), '/');
begin
  -- Voltou para a area (a mao ou nao): deixa de contar como saida.
  if tg_op in ('INSERT', 'UPDATE') then
    delete from public.escalas_saidas_manuais
     where equipante_id = new.equipante_id and area = new.area_alocada;
  end if;
  if v_path in ('rpc/remover_alocacao', 'rpc/realocar_alocacao', 'rpc/liberar_vaga_e_realocar')
     and (tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.area_alocada is distinct from new.area_alocada)) then
    insert into public.escalas_saidas_manuais (equipante_id, area, em, por, edicao)
    values (old.equipante_id, old.area_alocada, now(), public._nome_organizador_logado(), public._edicao_atual())
    on conflict (equipante_id, area) do update
      set em = excluded.em, por = excluded.por, edicao = excluded.edicao;
  end if;
  return null;
end;
$fn$;

drop trigger if exists registrar_saida_manual on public.escalas;
create trigger registrar_saida_manual
  after insert or delete or update of area_alocada on public.escalas
  for each row execute function public._registrar_saida_manual();

-- O que ja foi feito a mao nesta edicao (pela auditoria).
insert into public.escalas_saidas_manuais (equipante_id, area, em, por, edicao)
select distinct on (x.eq, x.area) x.eq, x.area, x.em, x.organizador, public._edicao_atual()
  from (
    select (a.mudancas ->> 'equipante_id')::uuid as eq, a.mudancas ->> 'area_alocada' as area, a.em, a.organizador
      from public.auditoria a
     where a.tabela = 'escalas' and a.operacao = 'apagou' and a.em >= '2026-10-01'
       and a.origem in ('rpc/remover_alocacao', 'rpc/realocar_alocacao', 'rpc/liberar_vaga_e_realocar')
       and a.mudancas ? 'equipante_id' and a.mudancas ? 'area_alocada'
    union all
    select s.equipante_id, a.mudancas -> 'area_alocada' ->> 0, a.em, a.organizador
      from public.auditoria a
      join public.escalas s on s.id::text = a.registro_id
     where a.tabela = 'escalas' and a.operacao = 'alterou' and a.em >= '2026-10-01'
       and a.origem in ('rpc/remover_alocacao', 'rpc/realocar_alocacao', 'rpc/liberar_vaga_e_realocar')
       and jsonb_typeof(a.mudancas -> 'area_alocada') = 'array'
  ) x
 where x.eq is not null and x.area is not null
   and exists (select 1 from public.equipantes q where q.id = x.eq)
   and not exists (select 1 from public.escalas e where e.equipante_id = x.eq and e.area_alocada = x.area)
 order by x.eq, x.area, x.em desc
on conflict (equipante_id, area) do nothing;

-- ---------------------------------------------------------------------------
-- Lote: motivo e o que restaurar no "Desfazer"
-- ---------------------------------------------------------------------------
alter table public.lotes_alocacao_automatica_itens add column if not exists motivo text;
alter table public.lotes_alocacao_automatica_itens add column if not exists restaurar jsonb;

-- Pastor Invisível: 15 (3 por cor).
update public.limites_areas set limite_maximo = 15, updated_at = now()
 where area_nome = 'Pastor Invisível';

-- ---------------------------------------------------------------------------
-- Ajudantes
-- ---------------------------------------------------------------------------
create or replace function public._area_cor_automatica(p_area text)
returns boolean
language sql
immutable
set search_path to 'public'
as $fn$
  select p_area in ('Invisível', 'Marcador', 'Pastor Invisível');
$fn$;

-- A cor com menos gente na area; empate: menos gente do mesmo sexo; depois
-- sorteio. p_max: teto por cor (null = sem teto).
create or replace function public._cor_equilibrada(p_area text, p_sexo text, p_max integer default null)
returns text
language sql
volatile
security definer
set search_path to 'public'
as $fn$
  select c.cor
    from unnest(array['Amarelo', 'Azul', 'Roxo', 'Verde', 'Vermelho']) as c(cor)
   where p_max is null
      or (select count(*) from public.escalas e where e.area_alocada = p_area and e.cor = c.cor) < p_max
   order by (select count(*) from public.escalas e where e.area_alocada = p_area and e.cor = c.cor),
            (select count(*) from public.escalas e join public.equipantes q on q.id = e.equipante_id
              where e.area_alocada = p_area and e.cor = c.cor and q.sexo is not distinct from p_sexo),
            random()
   limit 1;
$fn$;

-- Uma area sorteada entre as que tem vaga para a pessoa: fora as da
-- diretoria, Fotografia e as que ela deixou a mao. Sem sexo: so areas sem
-- limite por sexo.
create or replace function public._area_aleatoria_com_vaga(p_equipante uuid, p_sexo text)
returns text
language sql
volatile
security definer
set search_path to 'public'
as $fn$
  select l.area_nome
    from public.limites_areas l
   where not l.somente_organizador
     and l.area_nome not in ('Disponível para qualquer área', 'Fotografia', 'Não será escalado')
     and (p_sexo in ('Feminino', 'Masculino') or (l.limite_homens is null and l.limite_mulheres is null))
     and (public._equipante_area_tem_vaga(l.area_nome, p_sexo)).tem_vaga
     and not public._saiu_a_mao(p_equipante, l.area_nome)
   order by random()
   limit 1;
$fn$;

-- ---------------------------------------------------------------------------
-- Alocar automatico
-- ---------------------------------------------------------------------------
create or replace function public.alocar_fila_automaticamente()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  c_pi       constant text := 'Pastor Invisível';
  v_pessoa   record;
  v_cand     record;
  v_area     text;
  v_destino  text;
  v_cor      text;
  v_vaga     record;
  v_por_opcao int[] := array[0, 0, 0];
  v_coringa  int := 0;
  v_sem_opcao_aloc int := 0;
  v_fora     int := 0;
  v_pastores int := 0;
  v_fixos    int := 0;
  v_fila     uuid[];
  v_areas_fixos text[] := '{}';
  v_passo    int;
  v_sobraram int;
  v_lote     uuid;
  v_escala   uuid;
  v_ordem    text := (select c.escala_ordem from public.configuracoes c limit 1);
  -- Pastor Invisível
  v_pi_alvo  int;
  v_pi_atual int;
  v_pi_f     int;
  v_pi_m     int;
  v_meta_f   int;
  v_meta_m   int;
  v_cap_cor  int;
  v_sexo_alvo text;
  v_pre      jsonb;
  v_rest     jsonb;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro',
      'Apenas organizadores podem alocar pelas preferências.');
  end if;

  perform pg_advisory_xact_lock(hashtext('alocacao_equipantes_areas'));

  insert into public.lotes_alocacao_automatica (feito_por)
  values (public._nome_organizador_logado()) returning id into v_lote;

  -- Passada zero: os fixos (como antes; nao entram no lote).
  select coalesce(array_agg(q.id), '{}') into v_fila
    from public.equipantes q
   where q.tipo = 'equipante'
     and q.status = 'aprovado'
     and not exists (select 1 from public.escalas e where e.equipante_id = q.id);

  for v_pessoa in
    select f.equipante_id as id, f.area, q.sexo
      from public.equipantes_areas_fixas f
      join public.equipantes q on q.id = f.equipante_id
     where f.equipante_id = any(v_fila)
       and exists (select 1 from public.limites_areas l where l.area_nome = f.area)
     order by q.nome, f.marcado_em
  loop
    continue when exists (select 1 from public.escalas e
                           where e.equipante_id = v_pessoa.id and e.area_alocada = v_pessoa.area);
    continue when public._area_especial(v_pessoa.area) and exists (
      select 1 from public.escalas e
       where e.equipante_id = v_pessoa.id and public._area_especial(e.area_alocada));

    select * into v_vaga from public._equipante_area_tem_vaga(v_pessoa.area, v_pessoa.sexo);
    continue when not v_vaga.tem_vaga;

    insert into public.escalas (equipante_id, area_alocada, atuacao)
    values (v_pessoa.id, v_pessoa.area, public._atuacao_padrao(v_pessoa.area));
    update public.equipantes set scale_status = 'ok' where id = v_pessoa.id;

    v_fixos := v_fixos + 1;
    if not v_pessoa.area = any(v_areas_fixos) then
      v_areas_fixos := v_areas_fixos || v_pessoa.area;
    end if;
  end loop;

  -- Pastor Invisível: completa ate o limite, 3 por cor, homens e mulheres
  -- equilibrados. Antes das opcoes: as vagas que os pastores deixam nas areas
  -- comuns ja ficam para a fila.
  select coalesce(l.limite_maximo, 0) into v_pi_alvo from public.limites_areas l where l.area_nome = c_pi;
  v_pi_alvo := coalesce(v_pi_alvo, 0);
  select count(*), count(*) filter (where q.sexo = 'Feminino'), count(*) filter (where q.sexo = 'Masculino')
    into v_pi_atual, v_pi_f, v_pi_m
    from public.escalas e join public.equipantes q on q.id = e.equipante_id
   where e.area_alocada = c_pi;
  v_meta_f  := v_pi_alvo / 2;
  v_meta_m  := v_pi_alvo - v_meta_f;
  v_cap_cor := greatest(1, ceil(v_pi_alvo / 5.0)::int);
  select coalesce(c.cpfs_area_pastor_invisivel, '[]'::jsonb) into v_pre from public.configuracoes c limit 1;
  v_pre := coalesce(v_pre, '[]'::jsonb);

  while v_pi_atual < v_pi_alvo loop
    v_sexo_alvo := case
      when v_pi_f < v_meta_f and (v_pi_m >= v_meta_m or v_pi_f * v_meta_m <= v_pi_m * v_meta_f) then 'Feminino'
      when v_pi_m < v_meta_m then 'Masculino'
      else 'Feminino' end;

    select q.id, q.sexo into v_cand
      from public.equipantes q
     where q.tipo = 'equipante' and q.status = 'aprovado'
       and (upper(btrim(coalesce(q.cargo_igreja, ''))) in ('PASTOR(A)', 'PASTOR(A) AUXILIAR')
            or q.e_pastor is true
            or (regexp_replace(coalesce(q.cpf, ''), '\D', '', 'g') <> ''
                and v_pre ? regexp_replace(coalesce(q.cpf, ''), '\D', '', 'g'))
            or v_pre ? ('id:' || q.id::text))
       and not exists (select 1 from public.escalas e
                        where e.equipante_id = q.id and e.area_alocada in (c_pi, 'Não será escalado'))
       -- Lider em alguma area nao sai de la.
       and not exists (select 1 from public.escalas e
                         join public.atuacoes_areas a on a.area_nome = e.area_alocada and a.atuacao = e.atuacao
                        where e.equipante_id = q.id and a.eh_lider)
       -- Fixo 📌 tambem nao.
       and not exists (select 1 from public.equipantes_areas_fixas f where f.equipante_id = q.id)
       and not public._saiu_a_mao(q.id, c_pi)
     order by ((regexp_replace(coalesce(q.cpf, ''), '\D', '', 'g') <> ''
                and v_pre ? regexp_replace(coalesce(q.cpf, ''), '\D', '', 'g'))
               or v_pre ? ('id:' || q.id::text)) desc,
              (q.sexo is not distinct from v_sexo_alvo) desc,
              (q.sexo is null),
              random()
     limit 1;
    exit when not found;

    -- O que ele tinha (para o Desfazer). A linha da Recepção Sítio criada
    -- pela regra do Guia volta sozinha com o Guia.
    select coalesce(jsonb_agg(jsonb_build_object('area', e.area_alocada, 'atuacao', e.atuacao,
                                                 'cor', e.cor, 'incluido_por', e.incluido_por)), '[]'::jsonb)
      into v_rest
      from public.escalas e
     where e.equipante_id = v_cand.id and coalesce(e.incluido_por, '') <> 'Regra: Guia';

    delete from public.escalas where equipante_id = v_cand.id;

    v_cor := public._cor_equilibrada(c_pi, v_cand.sexo, v_cap_cor);
    insert into public.escalas (equipante_id, area_alocada, atuacao, cor)
    values (v_cand.id, c_pi, public._atuacao_padrao(c_pi), v_cor)
    returning id into v_escala;
    update public.equipantes set scale_status = 'ok' where id = v_cand.id;

    insert into public.lotes_alocacao_automatica_itens (lote_id, escala_id, equipante_id, area, motivo, restaurar)
    values (v_lote, v_escala, v_cand.id, c_pi, 'pastor_invisivel',
            case when v_rest = '[]'::jsonb then null else v_rest end);

    v_pastores := v_pastores + 1;
    v_pi_atual := v_pi_atual + 1;
    if v_cand.sexo = 'Feminino' then v_pi_f := v_pi_f + 1;
    elsif v_cand.sexo = 'Masculino' then v_pi_m := v_pi_m + 1;
    else v_pi_m := v_pi_m + 1;
    end if;
  end loop;

  -- Passadas 1, 2 e 3: a opcao de mesmo numero.
  for v_passo in 1..3 loop
    for v_pessoa in
      select q.id, q.sexo,
             case v_passo
               when 1 then q.area_trabalho_opcao1
               when 2 then q.area_trabalho_opcao2
               else        q.area_trabalho_opcao3
             end as escolha
        from public.equipantes q
       where q.tipo = 'equipante'
         and q.status = 'aprovado'
         and not exists (select 1 from public.escalas e where e.equipante_id = q.id)
       order by case when v_ordem = 'cadastro'
                  then coalesce(q.inscrito_em, q.decidido_em, q.created_at)
                  else coalesce(q.decidido_em, q.created_at)
             end nulls last, q.nome
    loop
      v_area := public._area_canonica(v_pessoa.escolha);
      continue when v_area is null;
      continue when v_area in ('Disponível para qualquer área', 'Fotografia');
      continue when exists (
        select 1 from public.limites_areas l
         where l.area_nome = v_area and l.somente_organizador);
      continue when public._saiu_a_mao(v_pessoa.id, v_area);

      select * into v_vaga from public._equipante_area_tem_vaga(v_area, v_pessoa.sexo);
      continue when not v_vaga.tem_vaga;

      v_cor := case when public._area_cor_automatica(v_area)
                    then public._cor_equilibrada(v_area, v_pessoa.sexo) end;
      insert into public.escalas (equipante_id, area_alocada, atuacao, cor)
      values (v_pessoa.id, v_area, public._atuacao_padrao(v_area), v_cor)
      returning id into v_escala;
      update public.equipantes set scale_status = 'ok' where id = v_pessoa.id;

      insert into public.lotes_alocacao_automatica_itens (lote_id, escala_id, equipante_id, area, motivo)
      values (v_lote, v_escala, v_pessoa.id, v_area, 'opcao' || v_passo);

      v_por_opcao[v_passo] := v_por_opcao[v_passo] + 1;
    end loop;
  end loop;

  -- Quem sobrou vai para uma area sorteada com vaga, nesta ordem:
  --   1) marcou "Disponível para qualquer área";
  --   2) nao marcou nenhuma opcao (inscricao manual) -- e como disponivel;
  --   3) as opcoes estavam cheias -- "fora_das_opcoes" (etiqueta na tela).
  for v_pessoa in
    select s.id, s.sexo, s.motivo from (
    select q.id, q.sexo, q.nome,
           case when v_ordem = 'cadastro'
             then coalesce(q.inscrito_em, q.decidido_em, q.created_at)
             else coalesce(q.decidido_em, q.created_at)
           end as quando,
           case
             when 'Disponível para qualquer área' in (
                    coalesce(public._area_canonica(q.area_trabalho_opcao1), ''),
                    coalesce(public._area_canonica(q.area_trabalho_opcao2), ''),
                    coalesce(public._area_canonica(q.area_trabalho_opcao3), '')) then 'disponivel'
             when public._area_canonica(q.area_trabalho_opcao1) is null
              and public._area_canonica(q.area_trabalho_opcao2) is null
              and public._area_canonica(q.area_trabalho_opcao3) is null then 'sem_opcao'
             else 'fora_das_opcoes'
           end as motivo
      from public.equipantes q
     where q.tipo = 'equipante'
       and q.status = 'aprovado'
       and not exists (select 1 from public.escalas e where e.equipante_id = q.id)
    ) s
     order by s.motivo <> 'disponivel', s.motivo <> 'sem_opcao', s.quando nulls last, s.nome
  loop
    v_destino := public._area_aleatoria_com_vaga(v_pessoa.id, v_pessoa.sexo);
    continue when v_destino is null;

    v_cor := case when public._area_cor_automatica(v_destino)
                  then public._cor_equilibrada(v_destino, v_pessoa.sexo) end;
    insert into public.escalas (equipante_id, area_alocada, atuacao, cor)
    values (v_pessoa.id, v_destino, public._atuacao_padrao(v_destino), v_cor)
    returning id into v_escala;
    update public.equipantes set scale_status = 'ok' where id = v_pessoa.id;

    insert into public.lotes_alocacao_automatica_itens (lote_id, escala_id, equipante_id, area, motivo)
    values (v_lote, v_escala, v_pessoa.id, v_destino, v_pessoa.motivo);

    if v_pessoa.motivo = 'disponivel' then v_coringa := v_coringa + 1;
    elsif v_pessoa.motivo = 'sem_opcao' then v_sem_opcao_aloc := v_sem_opcao_aloc + 1;
    else v_fora := v_fora + 1;
    end if;
  end loop;

  update public.lotes_alocacao_automatica
     set total = (select count(*) from public.lotes_alocacao_automatica_itens where lote_id = v_lote)
   where id = v_lote;
  if not exists (select 1 from public.lotes_alocacao_automatica_itens where lote_id = v_lote) then
    delete from public.lotes_alocacao_automatica where id = v_lote;
    v_lote := null;
  end if;

  select count(*) into v_sobraram
    from public.equipantes q
   where q.tipo = 'equipante'
     and q.status = 'aprovado'
     and not exists (select 1 from public.escalas e where e.equipante_id = q.id);

  return jsonb_build_object(
    'ok', true,
    'alocados',  v_fixos + v_pastores + v_por_opcao[1] + v_por_opcao[2] + v_por_opcao[3]
                 + v_coringa + v_sem_opcao_aloc + v_fora,
    'fixos',     v_fixos,
    'pastores',  v_pastores,
    'opcao1',    v_por_opcao[1],
    'opcao2',    v_por_opcao[2],
    'opcao3',    v_por_opcao[3],
    'coringa',   v_coringa,
    'sem_opcao_alocados', v_sem_opcao_aloc,
    'fora_das_opcoes', v_fora,
    'sobraram',  v_sobraram,
    'sem_opcao', (select count(*) from public.equipantes q
                     where q.tipo = 'equipante' and q.status = 'aprovado'
                       and not exists (select 1 from public.escalas e where e.equipante_id = q.id)
                       and public._area_canonica(q.area_trabalho_opcao1) is null
                       and public._area_canonica(q.area_trabalho_opcao2) is null
                       and public._area_canonica(q.area_trabalho_opcao3) is null),
    'opcoes_cheias', v_sobraram - (select count(*) from public.equipantes q
                     where q.tipo = 'equipante' and q.status = 'aprovado'
                       and not exists (select 1 from public.escalas e where e.equipante_id = q.id)
                       and public._area_canonica(q.area_trabalho_opcao1) is null
                       and public._area_canonica(q.area_trabalho_opcao2) is null
                       and public._area_canonica(q.area_trabalho_opcao3) is null),
    'acima_do_limite', coalesce((
      select jsonb_agg(l.area_nome order by l.area_nome)
        from public.limites_areas l
       where l.area_nome = any(v_areas_fixos)
         and (select count(*) from public.escalas e where e.area_alocada = l.area_nome) > l.limite_maximo
    ), '[]'::jsonb),
    'lote',      v_lote);
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Desfazer: tambem devolve os pastores as areas de antes.
-- ---------------------------------------------------------------------------
create or replace function public.desfazer_alocacao_automatica()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_quem      text := public._nome_organizador_logado();
  v_total     int;
  v_desfeitos int;
  v_restaurar jsonb;
  r           record;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores podem desfazer a alocação automática.');
  end if;
  if (select escala_lancada_em from public.configuracoes limit 1) is not null then
    return jsonb_build_object('ok', false, 'erro',
      'A escala provisória já foi lançada: a alocação automática não pode mais ser desfeita. Ajuste pela troca de área.');
  end if;

  perform pg_advisory_xact_lock(hashtext('alocacao_equipantes_areas'));

  select count(*) into v_total
    from public.lotes_alocacao_automatica_itens i
    join public.lotes_alocacao_automatica l on l.id = i.lote_id
   where l.desfeito_em is null;
  if v_total = 0 then
    return jsonb_build_object('ok', false, 'erro', 'Não há alocação automática para desfazer.');
  end if;

  -- O que devolver: so de quem continua onde o automatico colocou.
  select coalesce(jsonb_agg(jsonb_build_object('eq', i.equipante_id, 'linhas', i.restaurar)), '[]'::jsonb)
    into v_restaurar
    from public.lotes_alocacao_automatica_itens i
    join public.lotes_alocacao_automatica l on l.id = i.lote_id
   where l.desfeito_em is null and i.restaurar is not null
     and exists (select 1 from public.escalas e where e.id = i.escala_id and e.area_alocada = i.area);

  with ativos as (
    select i.escala_id, i.area
      from public.lotes_alocacao_automatica_itens i
      join public.lotes_alocacao_automatica l on l.id = i.lote_id
     where l.desfeito_em is null
  ), apagados as (
    delete from public.escalas e
     using ativos d
     where e.id = d.escala_id and e.area_alocada = d.area
    returning e.equipante_id
  )
  select count(*) into v_desfeitos from apagados;

  for r in select (x ->> 'eq')::uuid as eq, x -> 'linhas' as linhas from jsonb_array_elements(v_restaurar) x loop
    insert into public.escalas (equipante_id, area_alocada, atuacao, cor, incluido_por)
    select r.eq, y ->> 'area', y ->> 'atuacao', y ->> 'cor', y ->> 'incluido_por'
      from jsonb_array_elements(r.linhas) y
    on conflict (equipante_id, area_alocada) do nothing;
    update public.equipantes set scale_status = 'ok' where id = r.eq;
  end loop;

  update public.equipantes q set scale_status = 'pendente'
   where q.id in (select i.equipante_id
                    from public.lotes_alocacao_automatica_itens i
                    join public.lotes_alocacao_automatica l on l.id = i.lote_id
                   where l.desfeito_em is null)
     and not exists (select 1 from public.escalas e where e.equipante_id = q.id);

  update public.lotes_alocacao_automatica l
     set desfeito_em = now(), desfeito_por = v_quem,
         desfeitos = (select count(*) from public.lotes_alocacao_automatica_itens d
                       where d.lote_id = l.id
                         and not exists (select 1 from public.escalas e where e.id = d.escala_id)),
         mantidos  = (select count(*) from public.lotes_alocacao_automatica_itens d
                       where d.lote_id = l.id
                         and exists (select 1 from public.escalas e where e.id = d.escala_id))
   where l.desfeito_em is null;

  return jsonb_build_object('ok', true, 'desfeitos', v_desfeitos, 'mantidos', v_total - v_desfeitos);
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Motivo de cada colocacao do automatico (so organizador).
-- ---------------------------------------------------------------------------
create or replace function public.escalas_automaticas_motivos()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
begin
  if not public.eh_organizador() then
    return '{}'::jsonb;
  end if;
  return coalesce((
    select jsonb_object_agg(i.escala_id, coalesce(i.motivo, 'automatico'))
      from public.lotes_alocacao_automatica_itens i
      join public.lotes_alocacao_automatica l on l.id = i.lote_id
      join public.escalas e on e.id = i.escala_id and e.area_alocada = i.area
     where l.desfeito_em is null
  ), '{}'::jsonb);
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Distribuir cores para quem esta na area SEM cor (botao na tela).
-- ---------------------------------------------------------------------------
create or replace function public.distribuir_cores_area(p_area text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  r   record;
  v_n int := 0;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores podem distribuir as cores.');
  end if;
  perform pg_advisory_xact_lock(hashtext('alocacao_equipantes_areas'));
  for r in
    select e.id, q.sexo
      from public.escalas e join public.equipantes q on q.id = e.equipante_id
     where e.area_alocada = p_area and e.cor is null
       -- Lider (ex.: lider geral) e atuacao sem cor ficam como estao.
       and not exists (select 1 from public.atuacoes_areas a
                        where a.area_nome = e.area_alocada and a.atuacao = e.atuacao
                          and (a.eh_lider or a.sem_cor))
     order by random()
  loop
    update public.escalas set cor = public._cor_equilibrada(p_area, r.sexo) where id = r.id;
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'coloridos', v_n);
end;
$fn$;

revoke all on function public.alocar_fila_automaticamente()  from public, anon;
revoke all on function public.desfazer_alocacao_automatica() from public, anon;
revoke all on function public.escalas_automaticas_motivos()  from public, anon;
revoke all on function public.distribuir_cores_area(text)     from public, anon;
grant execute on function public.alocar_fila_automaticamente()  to authenticated;
grant execute on function public.desfazer_alocacao_automatica() to authenticated;
grant execute on function public.escalas_automaticas_motivos()  to authenticated;
grant execute on function public.distribuir_cores_area(text)     to authenticated;
revoke all on function public._registrar_saida_manual() from public, anon, authenticated;
revoke all on function public._area_aleatoria_com_vaga(uuid, text) from public, anon, authenticated;
revoke all on function public._cor_equilibrada(text, text, integer) from public, anon, authenticated;
revoke all on function public._saiu_a_mao(uuid, text) from public, anon, authenticated;
