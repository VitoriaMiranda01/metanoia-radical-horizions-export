-- 24/10/2026 (Patrick): alarme do backup sincronizado com a LGPD automatica.
--
-- O backup (Edge Function backup-diario, 03:00) dispara "queda brusca" quando
-- uma tabela com 10+ registros perde mais de 20% de um dia para o outro: o
-- backup de antes vai para retidos/ (para sempre) e o GitHub manda e-mail.
-- O apagamento automatico da LGPD (03:30, 20261024n) vai, um dia, apagar uma
-- edicao inteira de uma vez -- e isso nao pode virar alarme.
--
-- Agora:
--   * lgpd_rodar conta os registros de todas as tabelas (as mesmas do backup)
--     antes e depois e grava em lgpd_execucoes.removidos quanto saiu de cada.
--   * lgpd_removidos_desde(t): soma do que a LGPD apagou desde t, por tabela.
--     O backup chama com o horario do backup anterior e, antes de disparar,
--     devolve esses registros a conta: so e queda se ainda cair mais de 20%.
--     A queda explicada pela LGPD fica em backup_execucoes.quedas_lgpd (sem
--     alarme, sem retidos/, sem e-mail) e aparece no quadro de Backups.
--   * Se a consulta falhar, o backup segue como antes (alarme por seguranca).

alter table public.lgpd_execucoes add column if not exists removidos jsonb;
alter table public.backup_execucoes add column if not exists quedas_lgpd jsonb;

-- Registros de cada tabela do public (o mesmo conjunto do backup_dados).
create or replace function public._lgpd_contagens()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_tab record;
  v_n   bigint;
  v     jsonb := '{}'::jsonb;
begin
  for v_tab in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p')
  loop
    execute format('select count(*) from public.%I', v_tab.relname) into v_n;
    v := v || jsonb_build_object(v_tab.relname, v_n);
  end loop;
  return v;
end;
$$;

create or replace function public.lgpd_rodar(p_hoje date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_hoje      date := coalesce(p_hoje, public._lgpd_hoje());
  v_cadastros int := 0;
  v_dados     int := 0;
  v_arquivos  int := 0;
  v_url       text;
  v_antes     jsonb;
  v_depois    jsonb;
  v_removidos jsonb;
  r           record;
begin
  begin
    v_antes := public._lgpd_contagens();

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

    -- Quanto saiu de cada tabela: o alarme do backup desconta isso.
    v_depois := public._lgpd_contagens();
    select coalesce(jsonb_object_agg(k, (v_antes ->> k)::bigint - coalesce((v_depois ->> k)::bigint, 0)), '{}'::jsonb)
      into v_removidos
      from jsonb_object_keys(v_antes) k
     where (v_antes ->> k)::bigint > coalesce((v_depois ->> k)::bigint, 0);
  exception when others then
    insert into public.lgpd_execucoes (erro) values (sqlerrm);
    return jsonb_build_object('ok', false, 'erro', sqlerrm);
  end;

  insert into public.lgpd_execucoes (dados_edicao, cadastros, arquivos, removidos)
  values (v_dados, v_cadastros, v_arquivos, v_removidos);

  -- A fila pode ter sobra de dias anteriores: chama sempre que nao estiver vazia.
  select url_funcao into v_url from public.lgpd_config;
  if v_url is not null and exists (select 1 from public.lgpd_arquivos_a_apagar) then
    perform net.http_post(url := v_url, body := '{}'::jsonb,
                          headers := '{"Content-Type": "application/json"}'::jsonb);
  end if;

  return jsonb_build_object('ok', true, 'cadastros', v_cadastros, 'dados_da_edicao', v_dados,
                            'arquivos_na_fila', v_arquivos, 'removidos', v_removidos);
end;
$$;

-- Soma, por tabela, do que a LGPD apagou depois de p_desde.
create or replace function public.lgpd_removidos_desde(p_desde timestamptz)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(k, n), '{}'::jsonb)
    from (select k, sum(v::bigint) n
            from public.lgpd_execucoes x, jsonb_each_text(coalesce(x.removidos, '{}'::jsonb)) as t(k, v)
           where x.em > p_desde and x.erro is null
           group by k) s;
$$;

-- O quadro de Backups mostra a queda que a LGPD explicou.
do $$
declare v text;
begin
  v := pg_get_functiondef('public.situacao_backup()'::regprocedure);
  if position($a$'supabase_ok', e.supabase_ok, 'github_ok', e.github_ok, 'erro', e.erro$a$ in v) = 0 then
    raise exception 'situacao_backup: trecho não encontrado';
  end if;
  v := replace(v, $a$'supabase_ok', e.supabase_ok, 'github_ok', e.github_ok, 'erro', e.erro$a$,
                  $b$'supabase_ok', e.supabase_ok, 'github_ok', e.github_ok, 'erro', e.erro,
               'quedas_lgpd', e.quedas_lgpd$b$);
  execute v;
end $$;

revoke all on function public._lgpd_contagens() from public, anon, authenticated;
revoke all on function public.lgpd_rodar(date) from public, anon, authenticated;
revoke all on function public.lgpd_removidos_desde(timestamptz) from public, anon, authenticated;
grant execute on function public.lgpd_removidos_desde(timestamptz) to service_role;
