-- 24/10/2026 (Patrick): LGPD do equipante, automatica.
--
-- O aviso de privacidade (AvisoPrivacidadeEquipante.jsx) promete:
--   * dados da edicao (saude, areas de trabalho e autorizacao do responsavel)
--     ate 12 meses apos o evento;
--   * cadastro (nome, CPF, contato, igreja -- a ficha inteira) ate 24 meses
--     apos a ultima participacao.
-- Ate aqui nada disso era apagado sozinho. Agora uma rotina diaria (pg_cron,
-- 03:30 de Brasilia, depois do backup das 03:00) apaga o que venceu.
--
-- Regras:
--   * "Edicao da pessoa" = equipantes.numero_edicao (gravado na inscricao;
--     a virada nao mexe). "Data do evento" = lgpd_edicoes.evento_fim dessa
--     edicao. Prazos: evento_fim + 12 meses / + 24 meses, no dia de Brasilia.
--   * Edicao sem data registrada, ou pessoa sem edicao: NUNCA apaga (fica na
--     contagem "sem data" do quadro).
--   * Arquivos da autorizacao: o banco nao pode apagar arquivo do Storage
--     (storage.protect_delete). A rotina poe na fila lgpd_arquivos_a_apagar e
--     chama a Edge Function lgpd-arquivos, que apaga pela API. So arquivos de
--     "envios/" (o modelo em branco do PDF fica no mesmo bucket e nunca sai).
--     Inclui os orfaos que a virada deixa (ela limpa o link, nao o arquivo).
--   * Registro do que foi apagado: so o CODIGO INTERNO (id), o tipo, a edicao
--     e a data -- sem nome, sem CPF (decisao do Patrick: o registro nao pode
--     virar outro dado pessoal). So a conta Desenvolvedores ve
--     (quadro "LGPD -- apagamentos automaticos" em Configuracoes).
--   * Aproveita e cumpre os 180 dias da auditoria (ja era a regra; a limpeza
--     so rodava por sorteio quando alguem mexia em algo).
--
-- Depois de aplicar, em CADA banco, gravar a URL da Edge Function:
--   insert into public.lgpd_config (url_funcao) values
--     ('https://<ref>.supabase.co/functions/v1/lgpd-arquivos')
--   on conflict (id) do update set url_funcao = excluded.url_funcao;
--   teste: oozwcfoidfqperbxnwkk  ·  oficial: yxootyzlpefyztiiacrs

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ------------------------------------------------------------ tabelas
create table if not exists public.lgpd_edicoes (
  numero        int primary key,
  evento_fim    date not null,
  registrado_em timestamptz not null default now()
);

create table if not exists public.lgpd_apagamentos (
  id     bigint generated always as identity primary key,
  em     timestamptz not null default now(),
  tipo   text not null check (tipo in ('dados_da_edicao', 'cadastro', 'arquivo_autorizacao')),
  codigo uuid,
  edicao int
);
create index if not exists lgpd_apagamentos_em_idx on public.lgpd_apagamentos (em desc);

create table if not exists public.lgpd_execucoes (
  id           bigint generated always as identity primary key,
  em           timestamptz not null default now(),
  dados_edicao int not null default 0,
  cadastros    int not null default 0,
  arquivos     int not null default 0,
  erro         text
);

create table if not exists public.lgpd_arquivos_a_apagar (
  bucket      text not null,
  nome        text not null,
  objeto_id   uuid,
  na_fila_em  timestamptz not null default now(),
  tentativas  int not null default 0,
  ultimo_erro text,
  primary key (bucket, nome)
);

create table if not exists public.lgpd_config (
  id         boolean primary key default true check (id),
  url_funcao text
);

do $$
declare t text;
begin
  foreach t in array array['lgpd_edicoes', 'lgpd_apagamentos', 'lgpd_execucoes', 'lgpd_arquivos_a_apagar', 'lgpd_config'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- ------------------------------------------------- historico das edicoes
-- A configuracao so guarda a edicao atual; o historico guarda a data do
-- evento de cada uma. Na virada o numero muda e a data fica a da anterior
-- ate alguem trocar: por isso so grava quando a DATA muda (ou na insercao),
-- e nunca uma data que nao seja depois das edicoes anteriores.
create or replace function public._lgpd_registrar_edicao()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.edicao_numero is null or new.data_evento_fim is null then
    return null;
  end if;
  if tg_op = 'UPDATE' and new.data_evento_fim is not distinct from old.data_evento_fim then
    return null;
  end if;
  if exists (select 1 from public.lgpd_edicoes
              where numero < new.edicao_numero and evento_fim >= new.data_evento_fim) then
    return null;
  end if;
  insert into public.lgpd_edicoes (numero, evento_fim)
  values (new.edicao_numero, new.data_evento_fim)
  on conflict (numero) do update set evento_fim = excluded.evento_fim, registrado_em = now();
  return null;
end;
$$;

drop trigger if exists lgpd_registrar_edicao on public.configuracoes;
create trigger lgpd_registrar_edicao
  after insert or update of edicao_numero, data_evento_fim on public.configuracoes
  for each row execute function public._lgpd_registrar_edicao();

insert into public.lgpd_edicoes (numero, evento_fim)
select edicao_numero, data_evento_fim from public.configuracoes
 where edicao_numero is not null and data_evento_fim is not null
on conflict (numero) do nothing;

-- ------------------------------------------------------------ auxiliares
create or replace function public._lgpd_hoje()
returns date language sql stable as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;

-- Data em que vence (null = edicao sem data: nunca vence).
create or replace function public._lgpd_prazo(p_edicao int, p_meses int)
returns date language sql stable security definer set search_path = public as $$
  select (evento_fim + make_interval(months => p_meses))::date
    from public.lgpd_edicoes where numero = p_edicao;
$$;

-- Tem algo dos "dados da edicao" ainda guardado?
create or replace function public._lgpd_tem_dados_edicao(e public.equipantes)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(e.tem_problema_saude, false) or e.condicoes_medicas is not null
      or coalesce(e.tem_restricao_alimentar, false) or e.restricoes_alimentares is not null
      or e.area_trabalho_opcao1 is not null or e.area_trabalho_opcao2 is not null
      or e.area_trabalho_opcao3 is not null or e.area_trabalho_extra is not null
      or e.parental_auth_file_url is not null or e.autorizacao_entregue_em is not null
      or e.autorizacao_conferida_em is not null or e.autorizacao_conferida_por is not null
      or exists (select 1 from public.disponibilidade_extra d where d.equipante_id = e.id)
      or exists (select 1 from public.escalas s where s.equipante_id = e.id);
$$;

-- Arquivos de autorizacao vencidos e que ninguem mais usa. O prazo de um
-- arquivo: a primeira edicao cujo evento e no dia do envio ou depois, + 12
-- meses. So "envios/" (o modelo em branco do PDF mora no mesmo bucket).
create or replace function public._lgpd_arquivos_vencidos(p_hoje date)
returns table (bucket text, nome text, objeto_id uuid)
language sql stable security definer set search_path = public, storage as $$
  select o.bucket_id, o.name, o.id
    from storage.objects o
   where o.bucket_id = 'autorizacao-menor-idade-equipante'
     and o.name like 'envios/%'
     and (select (min(x.evento_fim) + interval '12 months')::date
            from public.lgpd_edicoes x
           where x.evento_fim >= (o.created_at at time zone 'America/Sao_Paulo')::date) <= p_hoje
     and not exists (select 1 from public.equipantes e
                      where e.parental_auth_file_url like '%/' || o.name);
$$;

-- ------------------------------------------------------------ a rotina
-- p_hoje so para teste (simular a data); a rotina diaria chama sem nada.
create or replace function public.lgpd_rodar(p_hoje date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_hoje      date := coalesce(p_hoje, public._lgpd_hoje());
  v_cadastros int := 0;
  v_dados     int := 0;
  v_arquivos  int := 0;
  v_url       text;
  r           record;
begin
  begin
    -- 1) Cadastro inteiro: 24 meses apos a ultima participacao.
    for r in
      select e.id, e.numero_edicao from public.equipantes e
       where e.tipo = 'equipante'
         and public._lgpd_prazo(e.numero_edicao, 24) <= v_hoje
    loop
      delete from public.pix_sicoob where inscricao_id = r.id and status is distinct from 'pago';
      delete from public.pagamentos where equipante_id = r.id;
      delete from public.pedidos_acesso_cadastro where equipante_id = r.id;
      delete from public.portaria_entradas where equipante_id = r.id;
      delete from public.portaria_observacoes where inscricao_id = r.id;
      delete from public.portaria_registros where inscricao_id = r.id;
      delete from public.alteracoes_lider where equipante_id = r.id;
      delete from public.escalas_saidas_manuais where equipante_id = r.id;
      delete from public.lotes_alocacao_automatica_itens where equipante_id = r.id;
      delete from public.lotes_aprovacao_itens where equipante_id = r.id;
      update public.auditoria set registro = null, mudancas = null where registro_id = r.id::text;
      delete from public.equipantes where id = r.id;
      insert into public.lgpd_apagamentos (tipo, codigo, edicao) values ('cadastro', r.id, r.numero_edicao);
      v_cadastros := v_cadastros + 1;
    end loop;

    -- 2) Dados da edicao: 12 meses apos o evento.
    for r in
      select e.id, e.numero_edicao from public.equipantes e
       where e.tipo = 'equipante'
         and public._lgpd_prazo(e.numero_edicao, 12) <= v_hoje
         and public._lgpd_tem_dados_edicao(e)
    loop
      delete from public.disponibilidade_extra where equipante_id = r.id;
      delete from public.escalas where equipante_id = r.id;
      update public.equipantes set
        tem_problema_saude             = false,
        condicoes_medicas              = null,
        tem_restricao_alimentar        = false,
        restricoes_alimentares         = null,
        area_trabalho_opcao1           = null,
        area_trabalho_opcao2           = null,
        area_trabalho_opcao3           = null,
        area_trabalho_extra            = null,
        parental_auth_file_url         = null,
        autorizacao_entregue_em        = null,
        autorizacao_conferida_em       = null,
        autorizacao_conferida_por      = null,
        autorizacao_conferida_por_tipo = null
      where id = r.id;
      insert into public.lgpd_apagamentos (tipo, codigo, edicao) values ('dados_da_edicao', r.id, r.numero_edicao);
      v_dados := v_dados + 1;
    end loop;

    -- 3) Arquivos de autorizacao: para a fila (quem apaga e a Edge Function).
    insert into public.lgpd_arquivos_a_apagar (bucket, nome, objeto_id)
    select a.bucket, a.nome, a.objeto_id from public._lgpd_arquivos_vencidos(v_hoje) a
    on conflict (bucket, nome) do nothing;
    get diagnostics v_arquivos = row_count;

    -- 4) Auditoria: 180 dias (regra que ja existia).
    delete from public.auditoria where em < now() - interval '180 days';
  exception when others then
    insert into public.lgpd_execucoes (erro) values (sqlerrm);
    return jsonb_build_object('ok', false, 'erro', sqlerrm);
  end;

  insert into public.lgpd_execucoes (dados_edicao, cadastros, arquivos)
  values (v_dados, v_cadastros, v_arquivos);

  -- A fila pode ter sobra de dias anteriores: chama sempre que nao estiver vazia.
  select url_funcao into v_url from public.lgpd_config;
  if v_url is not null and exists (select 1 from public.lgpd_arquivos_a_apagar) then
    perform net.http_post(url := v_url, body := '{}'::jsonb,
                          headers := '{"Content-Type": "application/json"}'::jsonb);
  end if;

  return jsonb_build_object('ok', true, 'cadastros', v_cadastros, 'dados_da_edicao', v_dados,
                            'arquivos_na_fila', v_arquivos);
end;
$$;

-- A Edge Function chama depois de apagar: o que sumiu do Storage sai da fila
-- e vira registro; o que ficou conta tentativa.
create or replace function public.lgpd_arquivos_conferir(p_erro text default null)
returns jsonb language plpgsql security definer set search_path = public, storage as $$
declare
  v_feitos int;
begin
  with feitos as (
    delete from public.lgpd_arquivos_a_apagar f
     where not exists (select 1 from storage.objects o where o.bucket_id = f.bucket and o.name = f.nome)
    returning f.objeto_id
  )
  insert into public.lgpd_apagamentos (tipo, codigo)
  select 'arquivo_autorizacao', objeto_id from feitos;
  get diagnostics v_feitos = row_count;

  -- WHERE obrigatorio: chamada pela API, o safeupdate recusa UPDATE sem WHERE.
  update public.lgpd_arquivos_a_apagar
     set tentativas = tentativas + 1, ultimo_erro = coalesce(p_erro, 'O arquivo continua no Storage.')
   where tentativas >= 0;

  return jsonb_build_object('ok', true, 'apagados', v_feitos);
end;
$$;

-- ------------------------------------------------- quadro (Desenvolvedores)
create or replace function public.lgpd_situacao()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_hoje date := public._lgpd_hoje();
begin
  if lower(coalesce(public._nome_organizador_logado(), '')) <> 'desenvolvedores' then
    return null;
  end if;

  return jsonb_build_object(
    'hoje', v_hoje,
    'ultima_execucao', (select to_jsonb(x) from public.lgpd_execucoes x order by x.id desc limit 1),
    'ultima_sem_erro', (select max(em) from public.lgpd_execucoes where erro is null),
    'edicoes', (select coalesce(jsonb_agg(jsonb_build_object(
                  'numero', x.numero, 'evento_fim', x.evento_fim,
                  'apaga_dados_em', public._lgpd_prazo(x.numero, 12),
                  'apaga_cadastro_em', public._lgpd_prazo(x.numero, 24),
                  'pessoas', (select count(*) from public.equipantes e
                               where e.tipo = 'equipante' and e.numero_edicao = x.numero))
                  order by x.numero desc), '[]'::jsonb) from public.lgpd_edicoes x),
    'sem_data', (select count(*) from public.equipantes e
                  where e.tipo = 'equipante' and public._lgpd_prazo(e.numero_edicao, 12) is null),
    'proximos', (select coalesce(jsonb_agg(p order by p->>'data', p->>'tipo'), '[]'::jsonb) from (
                   select jsonb_build_object('data', d, 'tipo', t, 'quantidade', count(*)) p
                     from (select public._lgpd_prazo(e.numero_edicao, 24) d, 'cadastro' t
                             from public.equipantes e where e.tipo = 'equipante'
                           union all
                           select public._lgpd_prazo(e.numero_edicao, 12), 'dados_da_edicao'
                             from public.equipantes e
                            where e.tipo = 'equipante' and public._lgpd_tem_dados_edicao(e)) z
                    where d is not null
                    group by d, t) s),
    'fila_arquivos', (select jsonb_build_object('quantidade', count(*), 'com_erro', count(*) filter (where tentativas > 0),
                                                'ultimo_erro', max(ultimo_erro))
                        from public.lgpd_arquivos_a_apagar),
    'totais', (select jsonb_build_object(
                 'dados_da_edicao', count(*) filter (where tipo = 'dados_da_edicao'),
                 'cadastro', count(*) filter (where tipo = 'cadastro'),
                 'arquivo_autorizacao', count(*) filter (where tipo = 'arquivo_autorizacao'))
                 from public.lgpd_apagamentos),
    'registros', (select coalesce(jsonb_agg(to_jsonb(a) order by a.id desc), '[]'::jsonb)
                    from (select * from public.lgpd_apagamentos order by id desc limit 200) a));
end;
$$;

-- ------------------------------------------------------------ permissoes
revoke all on function public._lgpd_registrar_edicao() from public, anon, authenticated;
revoke all on function public._lgpd_prazo(int, int) from public, anon, authenticated;
revoke all on function public._lgpd_tem_dados_edicao(public.equipantes) from public, anon, authenticated;
revoke all on function public._lgpd_arquivos_vencidos(date) from public, anon, authenticated;
revoke all on function public.lgpd_rodar(date) from public, anon, authenticated;
revoke all on function public.lgpd_arquivos_conferir(text) from public, anon, authenticated;
grant execute on function public.lgpd_arquivos_conferir(text) to service_role;
revoke all on function public.lgpd_situacao() from public, anon;
grant execute on function public.lgpd_situacao() to authenticated;

-- ------------------------------------------------------------ agenda
-- 06:30 UTC = 03:30 de Brasilia (o backup roda 03:00).
do $$
begin
  if exists (select 1 from cron.job where jobname = 'lgpd-diario') then
    perform cron.unschedule('lgpd-diario');
  end if;
  perform cron.schedule('lgpd-diario', '30 6 * * *', 'select public.lgpd_rodar()');
end $$;
