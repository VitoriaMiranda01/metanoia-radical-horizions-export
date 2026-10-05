-- ---------------------------------------------------------------------------
-- Escala provisoria x oficial, relacao do lider, chamada e troca de area
--
-- Pedido do Patrick em 05/10/2026.
--
-- O FLUXO
-- -------
--   1. Reuniao de inscricao.
--   2. O Dudu lanca a ESCALA PROVISORIA (configuracoes.escala_lancada_em --
--      a mesma coluna de antes). Cada um ve a sua area no site; cada lider
--      ve a relacao da sua area (ou da sua cor, nas areas divididas por cor).
--   3. Reuniao de escala: o lider faz a CHAMADA (presente / ausente). No fim
--      da relacao ele pode puxar, pelo CPF, quem esta inscrito e aprovado mas
--      sem area nenhuma (o caso de quem o Dudu direciona direto ao lider).
--   4. O Dudu lanca a ESCALA OFICIAL (configuracoes.escala_oficial_em). So
--      ai o pagamento da taxa abre.
--
-- Decisoes (Patrick, 05/10):
--   * "Organizador" aqui = Desenvolvedores, Raquel e Dudu (Eduardo). Os
--     outros logins de organizador nao lancam escala nem trocam area.
--   * Ausente nao sai da escala sozinho: aparece num quadro para os
--     organizadores decidirem (trocar de area, "Nao sera escalado"...).
--   * O lider so puxa quem esta SEM area. Trocar alguem de area e so com
--     os organizadores, pelo modulo "Trocar de área" da Geração de Escalas.
--   * O lider entra com um CODIGO de 6 digitos gerado pelo sistema: o
--     acompanhamento abre so com o CPF, e a relacao tem o telefone de toda
--     a equipe. 5 erros seguidos travam o codigo por 15 minutos.
--
-- A chamada guarda a AREA em que foi feita. Se a pessoa for trocada de
-- area, a marcacao antiga deixa de valer sozinha (o join exige a mesma
-- area) -- o novo lider faz a chamada dele.
-- ---------------------------------------------------------------------------

alter table public.configuracoes
  add column if not exists escala_oficial_em timestamptz;

comment on column public.configuracoes.escala_lancada_em is
  'Quando a escala PROVISORIA foi lancada. A partir dai cada equipante ve a sua area e os lideres veem a relacao da equipe. O pagamento ainda NAO abre.';
comment on column public.configuracoes.escala_oficial_em is
  'Quando a escala OFICIAL (final, depois da chamada) foi lancada. So a partir dai o pagamento da taxa abre.';

-- Quem incluiu a pessoa na area, quando nao foi a tela de escalas.
alter table public.escalas
  add column if not exists incluido_por text;


-- ---------------------------------------------------------------------
-- Quem pode mexer no lancamento / trocas (Desenvolvedores, Raquel, Dudu)
-- ---------------------------------------------------------------------
create or replace function public._gere_escala()
returns boolean
language sql stable security definer
set search_path to 'public'
as $fn$
  select lower(coalesce(public._nome_organizador_logado(), ''))
         in ('raquel', 'eduardo', 'desenvolvedores');
$fn$;
revoke all on function public._gere_escala() from public, anon, authenticated;

create or replace function public.pode_gerir_escala()
returns boolean
language sql stable security definer
set search_path to 'public'
as $fn$
  select public._gere_escala();
$fn$;
revoke all on function public.pode_gerir_escala() from public, anon;
grant execute on function public.pode_gerir_escala() to authenticated;


-- ---------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------
create table if not exists public.chamada_escala (
  escala_id          uuid primary key references public.escalas(id) on delete cascade,
  area               text not null,
  presente           boolean not null,
  marcado_por        text,
  marcado_em         timestamptz not null default now(),
  convite_enviado_em timestamptz
);
comment on table public.chamada_escala is
  'Chamada da reuniao de escala, uma linha por participacao (escalas.id). Vale so enquanto a pessoa continua na mesma area.';

create table if not exists public.codigos_lider (
  equipante_id       uuid primary key references public.equipantes(id) on delete cascade,
  codigo             text not null,
  criado_em          timestamptz not null default now(),
  tentativas_erradas int not null default 0,
  bloqueado_ate      timestamptz
);
comment on table public.codigos_lider is
  'Codigo de 6 digitos com que o lider abre a relacao da equipe no acompanhamento. Gerado pelos organizadores.';

create table if not exists public.grupos_lider (
  escala_id     uuid primary key references public.escalas(id) on delete cascade,
  link          text not null,
  atualizado_em timestamptz not null default now()
);
comment on table public.grupos_lider is
  'Link de convite do grupo de WhatsApp que o lider criou, por participacao de lider (escalas.id).';

alter table public.chamada_escala enable row level security;
alter table public.codigos_lider  enable row level security;
alter table public.grupos_lider   enable row level security;
revoke all on public.chamada_escala from anon, authenticated;
revoke all on public.codigos_lider  from anon, authenticated;
revoke all on public.grupos_lider   from anon, authenticated;


-- ---------------------------------------------------------------------
-- Ajudantes
-- ---------------------------------------------------------------------
create or replace function public._eh_lider(p_area text, p_atuacao text)
returns boolean
language sql stable security definer
set search_path to 'public'
as $fn$
  select exists (select 1 from public.atuacoes_areas a
                  where a.area_nome = p_area and a.atuacao = p_atuacao and a.eh_lider);
$fn$;
revoke all on function public._eh_lider(text, text) from public, anon, authenticated;

-- O que falta na ficha, do ponto de vista do lider: as pendencias que a
-- pessoa corrige sozinha (igreja, WhatsApp) mais a autorizacao dos pais de
-- quem e menor. A taxa NAO entra -- foi o combinado.
create or replace function public._pendencias_relacao(p_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path to 'public'
as $fn$
declare
  e public.equipantes;
  v jsonb := public._pendencias_equipante(p_id);
begin
  select * into e from public.equipantes where id = p_id;
  if e.id is not null
     and coalesce(public.idade(e), 18) < 18
     and e.parental_auth_file_url is null
     and e.autorizacao_entregue_em is null then
    v := v || jsonb_build_array(jsonb_build_object('tipo', 'autorizacao'));
  end if;
  return v;
end;
$fn$;
revoke all on function public._pendencias_relacao(uuid) from public, anon, authenticated;

-- A participacao S esta na equipe do lider L? Mesma area; nas areas por
-- cor, mesma cor -- quem esta sem cor aparece para todos os lideres da
-- area, para nao ficar sem ninguem fazendo a chamada.
create or replace function public._na_equipe(p_lider_escala uuid, p_escala uuid)
returns boolean
language sql stable security definer
set search_path to 'public'
as $fn$
  select exists (
    select 1 from public.escalas l join public.escalas s on s.area_alocada = l.area_alocada
     where l.id = p_lider_escala and s.id = p_escala
       and (not public._area_com_cor(l.area_alocada) or l.cor is null
            or s.cor is null or s.cor = l.cor));
$fn$;
revoke all on function public._na_equipe(uuid, uuid) from public, anon, authenticated;

-- Confere o lider: escala provisoria lancada, prova de dono (CPF, ou nome
-- + nascimento) e o codigo. Conta os erros do codigo. VOLATILE de
-- proposito: grava as tentativas.
create or replace function public._lider_autenticado(
  p_id uuid, p_cpf text, p_nome text, p_nascimento date, p_codigo text)
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $fn$
declare
  c public.codigos_lider;
  v_dado text := regexp_replace(coalesce(p_codigo, ''), '\D', '', 'g');
begin
  if (select escala_lancada_em from public.configuracoes limit 1) is null then
    return jsonb_build_object('ok', false, 'erro', 'A escala ainda não foi lançada.');
  end if;

  if not public._inscricao_e_sua('equipante', p_id, p_cpf, p_nome, p_nascimento) then
    return jsonb_build_object('ok', false, 'erro',
      'Confirme o CPF (ou o nome e a data de nascimento) usados na inscrição.');
  end if;

  if not exists (select 1 from public.escalas s
                  where s.equipante_id = p_id and public._eh_lider(s.area_alocada, s.atuacao)) then
    return jsonb_build_object('ok', false, 'erro', 'Você não está como líder na escala.');
  end if;

  select * into c from public.codigos_lider where equipante_id = p_id;
  if c.equipante_id is null then
    return jsonb_build_object('ok', false, 'erro',
      'Seu código de líder ainda não foi gerado. Peça à organização.');
  end if;

  if c.bloqueado_ate is not null and c.bloqueado_ate > now() then
    return jsonb_build_object('ok', false, 'bloqueado', true, 'erro', format(
      'Muitas tentativas erradas. Tente de novo em %s minuto(s).',
      greatest(1, ceil(extract(epoch from c.bloqueado_ate - now()) / 60)::int)));
  end if;

  if v_dado = '' or v_dado <> c.codigo then
    update public.codigos_lider
       set tentativas_erradas = case when c.tentativas_erradas + 1 >= 5 then 0
                                     else c.tentativas_erradas + 1 end,
           bloqueado_ate      = case when c.tentativas_erradas + 1 >= 5
                                     then now() + interval '15 minutes' else null end
     where equipante_id = p_id;
    return jsonb_build_object('ok', false, 'codigo_errado', true, 'erro',
      'Código incorreto. Confira o código que a organização te passou.');
  end if;

  if c.tentativas_erradas > 0 or c.bloqueado_ate is not null then
    update public.codigos_lider set tentativas_erradas = 0, bloqueado_ate = null
     where equipante_id = p_id;
  end if;

  return jsonb_build_object('ok', true,
    'nome', (select nome from public.equipantes where id = p_id));
end;
$fn$;
revoke all on function public._lider_autenticado(uuid, text, text, date, text) from public, anon, authenticated;

-- A participacao S esta na equipe de algum dos lugares em que P e lider?
-- Devolve a participacao de lider correspondente (ou null).
create or replace function public._lider_da_participacao(p_lider uuid, p_escala uuid)
returns uuid
language sql stable security definer
set search_path to 'public'
as $fn$
  select l.id from public.escalas l
   where l.equipante_id = p_lider
     and public._eh_lider(l.area_alocada, l.atuacao)
     and public._na_equipe(l.id, p_escala)
   limit 1;
$fn$;
revoke all on function public._lider_da_participacao(uuid, uuid) from public, anon, authenticated;

create or replace function public._codigo_novo()
returns text
language sql volatile
set search_path to 'public', 'extensions'
as $fn$
  select lpad(((get_byte(b, 0)::bigint << 24 | get_byte(b, 1) << 16
                | get_byte(b, 2) << 8 | get_byte(b, 3)) % 1000000)::text, 6, '0')
    from (select extensions.gen_random_bytes(4) as b) r;
$fn$;
revoke all on function public._codigo_novo() from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- Relacao do lider
-- ---------------------------------------------------------------------
create or replace function public.relacao_lider(
  p_id uuid, p_cpf text, p_nome text, p_nascimento date, p_codigo text)
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $fn$
declare
  v_auth jsonb := public._lider_autenticado(p_id, p_cpf, p_nome, p_nascimento, p_codigo);
  v_equipes jsonb;
begin
  if not (v_auth->>'ok')::boolean then
    return v_auth;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'escala_id', l.id,
           'area', l.area_alocada,
           'cor', case when public._area_com_cor(l.area_alocada) then l.cor end,
           'atuacao', l.atuacao,
           'grupo_link', (select g.link from public.grupos_lider g where g.escala_id = l.id),
           'membros', (
             select coalesce(jsonb_agg(jsonb_build_object(
                      'escala_id', s.id,
                      'equipante_id', q.id,
                      'nome', q.nome,
                      'igreja', q.igreja,
                      'igreja_outra', q.igreja_outra,
                      'whatsapp', q.whatsapp,
                      'estrangeiro', nullif(regexp_replace(coalesce(q.cpf,''), '\D', '', 'g'), '') is null,
                      'atuacao', s.atuacao,
                      'cor', s.cor,
                      'eh_lider', public._eh_lider(s.area_alocada, s.atuacao),
                      'eu', q.id = p_id,
                      'incluido_por', s.incluido_por,
                      'pendencias', public._pendencias_relacao(q.id),
                      'presente', c.presente,
                      'marcado_por', c.marcado_por,
                      'marcado_em', c.marcado_em,
                      'convite_enviado_em', c.convite_enviado_em)
                    order by q.nome), '[]'::jsonb)
               from public.escalas s
               join public.equipantes q on q.id = s.equipante_id
               left join public.chamada_escala c
                      on c.escala_id = s.id and c.area = s.area_alocada
              where public._na_equipe(l.id, s.id))
         ) order by l.area_alocada, l.cor), '[]'::jsonb)
    into v_equipes
    from public.escalas l
   where l.equipante_id = p_id
     and public._eh_lider(l.area_alocada, l.atuacao);

  return jsonb_build_object('ok', true,
    'lider', v_auth->>'nome',
    'escala_oficial', (select escala_oficial_em is not null from public.configuracoes limit 1),
    'equipes', v_equipes);
end;
$fn$;
revoke all on function public.relacao_lider(uuid, text, text, date, text) from public;
grant execute on function public.relacao_lider(uuid, text, text, date, text) to anon, authenticated;


-- Presente (true), ausente (false) ou desmarcar (null).
create or replace function public.lider_marcar_presenca(
  p_id uuid, p_cpf text, p_nome text, p_nascimento date, p_codigo text,
  p_escala_id uuid, p_presente boolean)
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $fn$
declare
  v_auth jsonb := public._lider_autenticado(p_id, p_cpf, p_nome, p_nascimento, p_codigo);
  v_area text;
begin
  if not (v_auth->>'ok')::boolean then
    return v_auth;
  end if;

  if public._lider_da_participacao(p_id, p_escala_id) is null then
    return jsonb_build_object('ok', false, 'erro', 'Esta pessoa não está na sua equipe.');
  end if;

  select area_alocada into v_area from public.escalas where id = p_escala_id;

  if p_presente is null then
    delete from public.chamada_escala where escala_id = p_escala_id;
  else
    insert into public.chamada_escala (escala_id, area, presente, marcado_por, marcado_em)
    values (p_escala_id, v_area, p_presente, v_auth->>'nome', now())
    on conflict (escala_id) do update
      set area = excluded.area,
          presente = excluded.presente,
          marcado_por = excluded.marcado_por,
          marcado_em = excluded.marcado_em,
          -- quem passou a ausente nao tem mais convite "valendo"
          convite_enviado_em = case when excluded.presente
                                    and chamada_escala.area = excluded.area
                                    then chamada_escala.convite_enviado_em end;
  end if;

  return jsonb_build_object('ok', true);
end;
$fn$;
revoke all on function public.lider_marcar_presenca(uuid, text, text, date, text, uuid, boolean) from public;
grant execute on function public.lider_marcar_presenca(uuid, text, text, date, text, uuid, boolean) to anon, authenticated;


-- Procura alguem pelo CPF para o lider puxar para a equipe. So devolve
-- nome e igreja -- e so de quem pode mesmo ser puxado.
create or replace function public._busca_para_lider(p_cpf_busca text)
returns jsonb
language plpgsql stable security definer
set search_path to 'public'
as $fn$
declare
  v_cpf text := regexp_replace(coalesce(p_cpf_busca, ''), '\D', '', 'g');
  q public.equipantes;
begin
  if length(v_cpf) <> 11 then
    return jsonb_build_object('ok', false, 'erro', 'Digite o CPF completo (11 números).');
  end if;

  select * into q from public.equipantes e
   where e.tipo = 'equipante'
     and regexp_replace(coalesce(e.cpf, ''), '\D', '', 'g') = v_cpf
   order by (e.status = 'aprovado') desc, e.created_at desc
   limit 1;

  if q.id is null then
    return jsonb_build_object('ok', false, 'erro',
      'Nenhuma inscrição com este CPF. A pessoa precisa se inscrever (ou peça ao Dudu a inscrição manual).');
  end if;
  if q.status = 'pendente' then
    return jsonb_build_object('ok', false, 'erro',
      'A inscrição desta pessoa ainda aguarda a aprovação da igreja. Fale com a organização.');
  end if;
  if q.status <> 'aprovado' then
    return jsonb_build_object('ok', false, 'erro',
      'A inscrição desta pessoa não foi aprovada. Fale com a organização.');
  end if;
  if exists (select 1 from public.escalas s where s.equipante_id = q.id) then
    return jsonb_build_object('ok', false, 'erro',
      'Esta pessoa já está escalada. Troca de área só com os organizadores.');
  end if;

  return jsonb_build_object('ok', true, 'equipante_id', q.id, 'nome', q.nome,
    'igreja', q.igreja, 'igreja_outra', q.igreja_outra, 'sexo', q.sexo);
end;
$fn$;
revoke all on function public._busca_para_lider(text) from public, anon, authenticated;

create or replace function public.lider_buscar_cpf(
  p_id uuid, p_cpf text, p_nome text, p_nascimento date, p_codigo text, p_cpf_busca text)
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $fn$
declare
  v_auth jsonb := public._lider_autenticado(p_id, p_cpf, p_nome, p_nascimento, p_codigo);
  v jsonb;
begin
  if not (v_auth->>'ok')::boolean then
    return v_auth;
  end if;
  v := public._busca_para_lider(p_cpf_busca);
  return v - 'equipante_id' - 'sexo';
end;
$fn$;
revoke all on function public.lider_buscar_cpf(uuid, text, text, date, text, text) from public;
grant execute on function public.lider_buscar_cpf(uuid, text, text, date, text, text) to anon, authenticated;

create or replace function public.lider_adicionar_por_cpf(
  p_id uuid, p_cpf text, p_nome text, p_nascimento date, p_codigo text,
  p_escala_lider uuid, p_cpf_busca text)
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $fn$
declare
  v_auth jsonb := public._lider_autenticado(p_id, p_cpf, p_nome, p_nascimento, p_codigo);
  l public.escalas;
  v jsonb;
  v_disp record;
  v_nova uuid;
begin
  if not (v_auth->>'ok')::boolean then
    return v_auth;
  end if;

  select * into l from public.escalas
   where id = p_escala_lider and equipante_id = p_id
     and public._eh_lider(area_alocada, atuacao);
  if l.id is null then
    return jsonb_build_object('ok', false, 'erro', 'Equipe não encontrada.');
  end if;

  perform pg_advisory_xact_lock(hashtext('alocacao_equipantes_areas'));

  v := public._busca_para_lider(p_cpf_busca);
  if not (v->>'ok')::boolean then
    return v;
  end if;

  select * into v_disp from public._equipante_area_tem_vaga(l.area_alocada, v->>'sexo');
  if not v_disp.tem_vaga then
    return jsonb_build_object('ok', false, 'erro', format(
      '%s. Fale com a organização para abrir vaga.', v_disp.motivo));
  end if;

  insert into public.escalas (equipante_id, area_alocada, atuacao, cor, incluido_por)
  values ((v->>'equipante_id')::uuid, l.area_alocada, public._atuacao_padrao(l.area_alocada),
          case when public._area_com_cor(l.area_alocada) then l.cor end,
          'Líder ' || (v_auth->>'nome'))
  returning id into v_nova;

  update public.equipantes set scale_status = 'ok' where id = (v->>'equipante_id')::uuid;

  -- Foi incluida pessoalmente na reuniao: ja entra como presente.
  insert into public.chamada_escala (escala_id, area, presente, marcado_por)
  values (v_nova, l.area_alocada, true, v_auth->>'nome');

  return jsonb_build_object('ok', true, 'nome', v->>'nome', 'area', l.area_alocada);
end;
$fn$;
revoke all on function public.lider_adicionar_por_cpf(uuid, text, text, date, text, uuid, text) from public;
grant execute on function public.lider_adicionar_por_cpf(uuid, text, text, date, text, uuid, text) to anon, authenticated;


-- Link de convite do grupo de WhatsApp (vazio apaga).
create or replace function public.lider_salvar_grupo(
  p_id uuid, p_cpf text, p_nome text, p_nascimento date, p_codigo text,
  p_escala_lider uuid, p_link text)
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $fn$
declare
  v_auth jsonb := public._lider_autenticado(p_id, p_cpf, p_nome, p_nascimento, p_codigo);
  v_link text := btrim(coalesce(p_link, ''));
begin
  if not (v_auth->>'ok')::boolean then
    return v_auth;
  end if;

  if not exists (select 1 from public.escalas
                  where id = p_escala_lider and equipante_id = p_id
                    and public._eh_lider(area_alocada, atuacao)) then
    return jsonb_build_object('ok', false, 'erro', 'Equipe não encontrada.');
  end if;

  if v_link = '' then
    delete from public.grupos_lider where escala_id = p_escala_lider;
    return jsonb_build_object('ok', true, 'link', null);
  end if;

  v_link := regexp_replace(v_link, '\?.*$', '');
  if v_link !~ '^https://chat\.whatsapp\.com/(invite/)?[A-Za-z0-9]{15,30}$' then
    return jsonb_build_object('ok', false, 'erro',
      'Cole o link de convite do grupo (começa com https://chat.whatsapp.com/).');
  end if;

  insert into public.grupos_lider (escala_id, link) values (p_escala_lider, v_link)
  on conflict (escala_id) do update set link = excluded.link, atualizado_em = now();

  return jsonb_build_object('ok', true, 'link', v_link);
end;
$fn$;
revoke all on function public.lider_salvar_grupo(uuid, text, text, date, text, uuid, text) from public;
grant execute on function public.lider_salvar_grupo(uuid, text, text, date, text, uuid, text) to anon, authenticated;

-- Anota que o convite foi enviado. So para quem esta presente e sem
-- pendencia -- e o "gatilho" combinado.
create or replace function public.lider_marcar_convite(
  p_id uuid, p_cpf text, p_nome text, p_nascimento date, p_codigo text, p_escala_id uuid)
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $fn$
declare
  v_auth jsonb := public._lider_autenticado(p_id, p_cpf, p_nome, p_nascimento, p_codigo);
  v_eq uuid;
begin
  if not (v_auth->>'ok')::boolean then
    return v_auth;
  end if;
  if public._lider_da_participacao(p_id, p_escala_id) is null then
    return jsonb_build_object('ok', false, 'erro', 'Esta pessoa não está na sua equipe.');
  end if;

  select s.equipante_id into v_eq from public.escalas s where s.id = p_escala_id;
  if jsonb_array_length(public._pendencias_relacao(v_eq)) > 0 then
    return jsonb_build_object('ok', false, 'erro', 'A pessoa ainda tem pendência no cadastro.');
  end if;

  update public.chamada_escala c
     set convite_enviado_em = now()
    from public.escalas s
   where c.escala_id = p_escala_id and s.id = c.escala_id
     and c.area = s.area_alocada and c.presente;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Marque a presença antes de enviar o convite.');
  end if;
  return jsonb_build_object('ok', true);
end;
$fn$;
revoke all on function public.lider_marcar_convite(uuid, text, text, date, text, uuid) from public;
grant execute on function public.lider_marcar_convite(uuid, text, text, date, text, uuid) to anon, authenticated;


-- ---------------------------------------------------------------------
-- Organizadores: codigos dos lideres
-- ---------------------------------------------------------------------
create or replace function public.codigos_lideres()
returns jsonb
language plpgsql security definer
set search_path to 'public', 'extensions'
as $fn$
begin
  if not public._gere_escala() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas Desenvolvedores, Raquel e Dudu.');
  end if;

  -- Gera para quem virou lider e ainda nao tem.
  insert into public.codigos_lider (equipante_id, codigo)
  select distinct s.equipante_id, public._codigo_novo()
    from public.escalas s
   where public._eh_lider(s.area_alocada, s.atuacao)
     and not exists (select 1 from public.codigos_lider c where c.equipante_id = s.equipante_id)
  on conflict (equipante_id) do nothing;

  return jsonb_build_object('ok', true, 'itens', (
    select coalesce(jsonb_agg(x order by x->>'nome'), '[]'::jsonb) from (
      select jsonb_build_object(
               'equipante_id', q.id, 'nome', q.nome, 'whatsapp', q.whatsapp,
               'codigo', c.codigo,
               'bloqueado', c.bloqueado_ate is not null and c.bloqueado_ate > now(),
               'areas', (select jsonb_agg(jsonb_build_object(
                                 'area', s.area_alocada, 'cor', s.cor, 'atuacao', s.atuacao)
                               order by s.area_alocada)
                           from public.escalas s
                          where s.equipante_id = q.id
                            and public._eh_lider(s.area_alocada, s.atuacao))) as x
        from public.codigos_lider c
        join public.equipantes q on q.id = c.equipante_id
       where exists (select 1 from public.escalas s
                      where s.equipante_id = q.id
                        and public._eh_lider(s.area_alocada, s.atuacao))
    ) t));
end;
$fn$;
revoke all on function public.codigos_lideres() from public, anon;
grant execute on function public.codigos_lideres() to authenticated;

create or replace function public.gerar_novo_codigo_lider(p_equipante_id uuid)
returns jsonb
language plpgsql security definer
set search_path to 'public', 'extensions'
as $fn$
declare v text := public._codigo_novo();
begin
  if not public._gere_escala() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas Desenvolvedores, Raquel e Dudu.');
  end if;
  update public.codigos_lider
     set codigo = v, criado_em = now(), tentativas_erradas = 0, bloqueado_ate = null
   where equipante_id = p_equipante_id;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Líder não encontrado.');
  end if;
  return jsonb_build_object('ok', true, 'codigo', v);
end;
$fn$;
revoke all on function public.gerar_novo_codigo_lider(uuid) from public, anon;
grant execute on function public.gerar_novo_codigo_lider(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- Organizadores: chamada (quadro de ausentes e andamento por area)
-- ---------------------------------------------------------------------
create or replace function public.chamada_da_escala()
returns jsonb
language plpgsql stable security definer
set search_path to 'public'
as $fn$
begin
  if not public._gere_escala() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas Desenvolvedores, Raquel e Dudu.');
  end if;

  return jsonb_build_object('ok', true,
    'ausentes', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'escala_id', s.id, 'equipante_id', q.id, 'nome', q.nome,
               'whatsapp', q.whatsapp, 'igreja', q.igreja, 'igreja_outra', q.igreja_outra,
               'cpf', q.cpf, 'area', s.area_alocada, 'cor', s.cor, 'atuacao', s.atuacao,
               'marcado_por', c.marcado_por, 'marcado_em', c.marcado_em)
             order by s.area_alocada, q.nome), '[]'::jsonb)
        from public.chamada_escala c
        join public.escalas s on s.id = c.escala_id and s.area_alocada = c.area
        join public.equipantes q on q.id = s.equipante_id
       where not c.presente),
    'por_area', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'area', area, 'total', total, 'presentes', presentes, 'ausentes', ausentes)
             order by area), '[]'::jsonb)
        from (
          select s.area_alocada as area, count(*) as total,
                 count(*) filter (where c.presente) as presentes,
                 count(*) filter (where c.presente = false) as ausentes
            from public.escalas s
            left join public.chamada_escala c on c.escala_id = s.id and c.area = s.area_alocada
           where s.area_alocada <> 'Não será escalado'
           group by s.area_alocada) t));
end;
$fn$;
revoke all on function public.chamada_da_escala() from public, anon;
grant execute on function public.chamada_da_escala() to authenticated;


-- ---------------------------------------------------------------------
-- Organizadores: trocar alguem de area (modulo "Trocar de área")
-- ---------------------------------------------------------------------
create or replace function public.trocar_area_escala(p_escala_id uuid, p_nova_area text)
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $fn$
declare r jsonb;
begin
  if not public._gere_escala() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas Desenvolvedores, Raquel e Dudu.');
  end if;
  if (select escala_lancada_em from public.configuracoes limit 1) is null then
    return jsonb_build_object('ok', false, 'erro',
      'A troca de área abre depois que a escala provisória for lançada.');
  end if;

  r := public.realocar_alocacao(p_escala_id, p_nova_area);
  if (r->>'ok')::boolean then
    update public.escalas set incluido_por = 'Troca: ' || public._nome_organizador_logado()
     where id = p_escala_id;
  end if;
  return r;
end;
$fn$;
revoke all on function public.trocar_area_escala(uuid, text) from public, anon;
grant execute on function public.trocar_area_escala(uuid, text) to authenticated;


-- ---------------------------------------------------------------------
-- Lancamentos: provisoria (lancar_escala, de sempre) e oficial
-- ---------------------------------------------------------------------
create or replace function public.lancar_escala()
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $fn$
declare
  v_faltam    int;
  v_escalados int;
  v_id        uuid;
begin
  if not public._gere_escala() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas Desenvolvedores, Raquel e Dudu podem lançar a escala.');
  end if;

  select count(*) into v_faltam
    from public.equipantes q
   where q.tipo = 'equipante' and q.status = 'aprovado'
     and not exists (select 1 from public.escalas e where e.equipante_id = q.id);

  if v_faltam > 0 then
    return jsonb_build_object('ok', false, 'faltam', v_faltam, 'erro',
      format('Ainda há %s equipante(s) sem destino. Distribua todos (ou marque como "Não será escalado") antes de lançar.', v_faltam));
  end if;

  select count(distinct e.equipante_id) into v_escalados
    from public.escalas e
   where e.area_alocada <> 'Não será escalado';

  if v_escalados = 0 then
    return jsonb_build_object('ok', false, 'escalados', 0, 'erro',
      'Não há ninguém escalado. Coloque pelo menos um equipante em uma área antes de lançar a escala.');
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

create or replace function public.desfazer_lancamento_escala()
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $fn$
declare v_id uuid; v_oficial timestamptz;
begin
  if not public._gere_escala() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas Desenvolvedores, Raquel e Dudu podem desfazer o lançamento.');
  end if;
  select c.id, c.escala_oficial_em into v_id, v_oficial from public.configuracoes c limit 1;
  if v_id is null then
    return jsonb_build_object('ok', false, 'erro', 'Configuração não encontrada.');
  end if;
  if v_oficial is not null then
    return jsonb_build_object('ok', false, 'erro',
      'A escala oficial já foi lançada. Desfaça primeiro o lançamento da oficial.');
  end if;
  update public.configuracoes set escala_lancada_em = null where id = v_id;
  return jsonb_build_object('ok', true);
end;
$fn$;

create or replace function public.lancar_escala_oficial()
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $fn$
declare v_id uuid; v_prov timestamptz; v_faltam int;
begin
  if not public._gere_escala() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas Desenvolvedores, Raquel e Dudu podem lançar a escala oficial.');
  end if;
  select c.id, c.escala_lancada_em into v_id, v_prov from public.configuracoes c limit 1;
  if v_id is null then
    return jsonb_build_object('ok', false, 'erro', 'Configuração não encontrada.');
  end if;
  if v_prov is null then
    return jsonb_build_object('ok', false, 'erro', 'Lance primeiro a escala provisória.');
  end if;

  -- Quem entrou na fila depois da provisoria (inscricao manual, por
  -- exemplo) precisa de destino antes da oficial.
  select count(*) into v_faltam
    from public.equipantes q
   where q.tipo = 'equipante' and q.status = 'aprovado'
     and not exists (select 1 from public.escalas e where e.equipante_id = q.id);
  if v_faltam > 0 then
    return jsonb_build_object('ok', false, 'faltam', v_faltam, 'erro',
      format('Ainda há %s equipante(s) sem destino. Distribua todos antes de lançar a oficial.', v_faltam));
  end if;

  update public.configuracoes set escala_oficial_em = now() where id = v_id;
  return jsonb_build_object('ok', true,
    'oficial_em', (select escala_oficial_em from public.configuracoes where id = v_id));
end;
$fn$;
revoke all on function public.lancar_escala_oficial() from public, anon;
grant execute on function public.lancar_escala_oficial() to authenticated;

create or replace function public.desfazer_escala_oficial()
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $fn$
declare v_id uuid;
begin
  if not public._gere_escala() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas Desenvolvedores, Raquel e Dudu.');
  end if;
  select c.id into v_id from public.configuracoes c limit 1;
  if v_id is null then
    return jsonb_build_object('ok', false, 'erro', 'Configuração não encontrada.');
  end if;
  update public.configuracoes set escala_oficial_em = null where id = v_id;
  return jsonb_build_object('ok', true);
end;
$fn$;
revoke all on function public.desfazer_escala_oficial() from public, anon;
grant execute on function public.desfazer_escala_oficial() to authenticated;


create or replace function public.situacao_escala()
returns jsonb
language plpgsql stable security definer
set search_path to 'public'
as $fn$
declare
  v_faltam int; v_escalados int; v_fora int; v_participacoes int;
  v_lancada timestamptz; v_oficial timestamptz;
  v_presentes int; v_ausentes int; v_sem_chamada int; v_lideres int;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores.');
  end if;

  select c.escala_lancada_em, c.escala_oficial_em into v_lancada, v_oficial
    from public.configuracoes c limit 1;

  select count(*) into v_faltam
    from public.equipantes q
   where q.tipo = 'equipante' and q.status = 'aprovado'
     and not exists (select 1 from public.escalas e where e.equipante_id = q.id);

  -- PESSOAS com ao menos uma area de verdade.
  select count(distinct e.equipante_id) into v_escalados
    from public.escalas e where e.area_alocada <> 'Não será escalado';

  -- PESSOAS cuja unica situacao e "nao sera escalado".
  select count(*) into v_fora from (
    select e.equipante_id from public.escalas e
     group by e.equipante_id
    having bool_and(e.area_alocada = 'Não será escalado')
  ) s;

  -- Linhas, para a tela poder mostrar "N pessoas em M funcoes".
  select count(*) into v_participacoes from public.escalas;

  -- Chamada, por PARTICIPACAO (quem esta em duas areas e chamado duas vezes).
  select count(*) filter (where c.presente),
         count(*) filter (where c.presente = false),
         count(*) filter (where c.escala_id is null)
    into v_presentes, v_ausentes, v_sem_chamada
    from public.escalas s
    left join public.chamada_escala c on c.escala_id = s.id and c.area = s.area_alocada
   where s.area_alocada <> 'Não será escalado';

  select count(distinct s.equipante_id) into v_lideres
    from public.escalas s where public._eh_lider(s.area_alocada, s.atuacao);

  return jsonb_build_object('ok', true, 'lancada_em', v_lancada, 'oficial_em', v_oficial,
    'faltam', v_faltam, 'escalados', v_escalados,
    'nao_serao_escalados', v_fora, 'participacoes', v_participacoes,
    'presentes', v_presentes, 'ausentes', v_ausentes, 'sem_chamada', v_sem_chamada,
    'lideres', v_lideres,
    'pode_gerir', public._gere_escala());
end;
$fn$;


-- ---------------------------------------------------------------------
-- O que o equipante ve: pagamento so na oficial; lider_de; presenca
-- ---------------------------------------------------------------------
create or replace function public.situacao_inscricao(p_tipo text, p_id uuid, p_cpf text DEFAULT NULL::text, p_nome text DEFAULT NULL::text, p_nascimento date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  q record; v_lancada timestamptz; v_oficial timestamptz;
  v_tem_area boolean; v_tem_real boolean;
  v_fora boolean; v_escalado boolean; v_pago boolean; v_menor boolean;
  v_autorizado boolean;
  v_lider_de jsonb; v_presenca text;
begin
  if not (public.eh_organizador()
          or public._inscricao_e_sua(p_tipo, p_id, p_cpf, p_nome, p_nascimento)) then
    return jsonb_build_object('ok', false, 'erro',
      'Confirme o CPF (ou o nome e a data de nascimento) usados na inscrição.');
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

  select e.nome, public.idade(e) as idade, e.status, e.status_pagamento,
         e.parental_auth_file_url,
         e.autorizacao_entregue_em, e.autorizacao_conferida_em,
         e.autorizacao_conferida_por
    into q
    from public.equipantes e
   where e.id = p_id and e.tipo = 'equipante';

  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada.');
  end if;

  select c.escala_lancada_em, c.escala_oficial_em into v_lancada, v_oficial
    from public.configuracoes c limit 1;

  select count(*) > 0,
         count(*) filter (where s.area_alocada <> 'Não será escalado') > 0
    into v_tem_area, v_tem_real
    from public.escalas s where s.equipante_id = p_id;

  v_pago  := lower(coalesce(q.status_pagamento,'')) in ('pago','confirmado','completed');
  v_menor := coalesce(q.idade, 18) < 18;

  -- Os dois caminhos valem: anexou o arquivo, ou entregou a carta em maos.
  v_autorizado := q.parental_auth_file_url is not null
               or q.autorizacao_entregue_em is not null;

  -- "escalado" desde a PROVISORIA: e ela que mostra a area e manda a pessoa
  -- para a reuniao de escala. O pagamento espera a OFICIAL.
  v_escalado := v_lancada is not null and v_tem_real;
  v_fora     := v_lancada is not null and v_tem_area and not v_tem_real;

  if v_lancada is not null then
    select coalesce(jsonb_agg(jsonb_build_object('area', s.area_alocada,
             'cor', case when public._area_com_cor(s.area_alocada) then s.cor end)
             order by s.area_alocada), '[]'::jsonb)
      into v_lider_de
      from public.escalas s
     where s.equipante_id = p_id and public._eh_lider(s.area_alocada, s.atuacao);

    -- Presenca na reuniao de escala: 'presente' se todas as areas
    -- marcaram presente, 'ausente' se alguma marcou ausente, null se ainda
    -- nao houve chamada.
    select case when bool_or(c.presente = false) then 'ausente'
                when count(c.escala_id) > 0 and count(c.escala_id) = count(*)
                     and bool_and(c.presente) then 'presente' end
      into v_presenca
      from public.escalas s
      left join public.chamada_escala c on c.escala_id = s.id and c.area = s.area_alocada
     where s.equipante_id = p_id and s.area_alocada <> 'Não será escalado';
  end if;

  return jsonb_build_object(
    'ok', true, 'tipo', 'equipante', 'nome', q.nome,
    'menor_de_idade', v_menor,
    'autorizacao_pais_enviada',   v_autorizado,
    'autorizacao_arquivo',        q.parental_auth_file_url is not null,
    'autorizacao_entregue_maos',  q.autorizacao_entregue_em is not null,
    'autorizacao_conferida',      q.autorizacao_conferida_em is not null,
    'autorizacao_conferida_por',  q.autorizacao_conferida_por,
    'aprovacao', coalesce(q.status, 'pendente'),
    'escala_lancada', v_lancada is not null,
    'escala_oficial', v_oficial is not null,
    'escalado', v_escalado,
    'nao_sera_escalado', v_fora,
    'lider_de', coalesce(v_lider_de, '[]'::jsonb),
    'presenca', v_presenca,
    'pendencias', public._pendencias_equipante(p_id),
    'area_vista', (select area_vista_em is not null from public.equipantes where id = p_id),
    'pago', v_pago,
    'pode_pagar', (coalesce(q.status,'') = 'aprovado')
                  and v_escalado
                  and v_oficial is not null
                  and (not v_menor or v_autorizado)
                  and not v_pago
  );
end;
$function$;


-- ---------------------------------------------------------------------
-- Nova edicao: zera a oficial e os codigos dos lideres tambem
-- ---------------------------------------------------------------------
do $do$
declare
  v_def text := pg_get_functiondef('public.resetar_para_nova_edicao(integer)'::regprocedure);
  v_ancora text := '    escala_lancada_em      = null,';
begin
  if (length(v_def) - length(replace(v_def, v_ancora, ''))) / length(v_ancora) <> 1 then
    raise exception 'ancora do resetar_para_nova_edicao nao e unica';
  end if;
  v_def := replace(v_def, v_ancora, v_ancora || E'\n    escala_oficial_em      = null,');

  v_ancora := '  delete from public.escalas where id is not null;';
  if (length(v_def) - length(replace(v_def, v_ancora, ''))) / length(v_ancora) <> 1 then
    raise exception 'ancora 2 do resetar_para_nova_edicao nao e unica';
  end if;
  v_def := replace(v_def, v_ancora,
    E'  delete from public.codigos_lider where equipante_id is not null;\n' || v_ancora);
  execute v_def;
end;
$do$;
