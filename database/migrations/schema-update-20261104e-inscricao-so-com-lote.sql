-- Inscricao so com lote de preco vigente (04/11/2026)
--
-- Problema: o acampante preenchia a ficha inteira e, na hora de pagar,
-- recebia "Não há valor configurado para hoje" -- as inscricoes estavam
-- ligadas, mas nenhum lote de preco cobria a data de hoje.
--
-- Regra (Patrick): vale para todo o sistema. So existe inscricao se der
-- para pagar na sequencia. Entao:
--   1. criar_inscricao recusa (SEM_LOTE_HOJE) quando nao ha lote hoje,
--      para acampante, equipante e "só domingo" -- inclusive com chave
--      de teste (sem lote, o pagamento falharia do mesmo jeito).
--   2. Ligar as inscricoes (configuracoes.inscricoes_*) sem lote hoje e
--      recusado no banco (gatilho), nao so na tela.
--   3. config_publica passa a dizer se ha lote hoje (lote_*_hoje): o site
--      trata "ligado mas sem lote" como fechado. A janela do domingo so
--      fica aberta com lote de equipante hoje.
-- Lote de preco vencido com a chave ligada: o site mostra fechado e o
-- servidor recusa; a chave continua ligada (a organizacao ve o aviso).

-- Valor do periodo que cobre hoje, a partir de uma lista de periodos
-- (mesma regra de _valor_do_lote, que continua como esta).
create or replace function public._valor_hoje_em(p_periodos jsonb)
returns numeric
language plpgsql
stable
set search_path to 'public'
as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_item jsonb;
  v_ini date;
  v_fim date;
begin
  if p_periodos is null or jsonb_typeof(p_periodos) <> 'array' then
    return null;
  end if;
  for v_item in select * from jsonb_array_elements(p_periodos) loop
    begin
      v_ini := to_date(v_item ->> 'start_date', 'DD/MM/YYYY');
      v_fim := to_date(v_item ->> 'end_date',   'DD/MM/YYYY');
    exception when others then
      continue;
    end;
    if v_hoje between v_ini and v_fim then
      return nullif(btrim(v_item ->> 'value'), '')::numeric;
    end if;
  end loop;
  return null;
end;
$$;
revoke all on function public._valor_hoje_em(jsonb) from public, anon, authenticated;

-- 1. criar_inscricao: recusa sem lote hoje --------------------------------
do $$
declare
  v_def text := pg_get_functiondef('public.criar_inscricao'::regproc);
  v_trecho text := E'    raise exception ''INSCRICOES_FECHADAS'';\n  end if;\n';
begin
  if position(v_trecho in v_def) = 0 then
    raise exception 'criar_inscricao: trecho nao encontrado';
  end if;
  if position('SEM_LOTE_HOJE' in v_def) > 0 then
    return;  -- ja aplicada
  end if;
  execute replace(v_def, v_trecho, v_trecho || E'\n'
    || E'  -- Sem lote de preco hoje nao ha como pagar: nao cria a inscricao (20261104e).\n'
    || E'  if public._valor_do_lote(p_tipo) is null then\n'
    || E'    raise exception ''SEM_LOTE_HOJE'';\n'
    || E'  end if;\n');
end $$;

-- 2. Ligar inscricoes exige lote hoje ---------------------------------------
create or replace function public._tg_inscricoes_exigem_lote()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.inscricoes_acampantes is true
     and (tg_op = 'INSERT' or old.inscricoes_acampantes is not true)
     and public._valor_hoje_em(new.acampante_pricing_periods) is null then
    raise exception 'SEM_LOTE_HOJE_ACAMPANTE'
      using hint = 'Cadastre um lote de preço de acampante que cubra a data de hoje antes de abrir as inscrições.';
  end if;
  if new.inscricoes_equipantes is true
     and (tg_op = 'INSERT' or old.inscricoes_equipantes is not true)
     and public._valor_hoje_em(new.equipante_pricing_periods) is null then
    raise exception 'SEM_LOTE_HOJE_EQUIPANTE'
      using hint = 'Cadastre um lote de preço de equipante que cubra a data de hoje antes de abrir as inscrições.';
  end if;
  return new;
end;
$$;

drop trigger if exists inscricoes_exigem_lote on public.configuracoes;
create trigger inscricoes_exigem_lote
  before insert or update of inscricoes_acampantes, inscricoes_equipantes on public.configuracoes
  for each row execute function public._tg_inscricoes_exigem_lote();

-- 3a. config_publica: diz se ha lote hoje -----------------------------------
create or replace function public.config_publica()
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select jsonb_build_object(
    'edicao_numero', c.edicao_numero,
    'data_evento_inicio', c.data_evento_inicio,
    'data_evento_fim', c.data_evento_fim,
    'horario_saida_igreja', c.horario_saida_igreja,
    'horario_retorno_sitio', c.horario_retorno_sitio,
    'data_limite_inscricao_pagamento', c.data_limite_inscricao_pagamento,
    'inscricoes_acampantes', c.inscricoes_acampantes,
    'inscricoes_equipantes', c.inscricoes_equipantes,
    'lote_acampante_hoje', public._valor_hoje_em(c.acampante_pricing_periods) is not null,
    'lote_equipante_hoje', public._valor_hoje_em(c.equipante_pricing_periods) is not null,
    'acampante_pricing_periods', coalesce(c.acampante_pricing_periods, '[]'::jsonb),
    'equipante_pricing_periods', coalesce(c.equipante_pricing_periods, '[]'::jsonb),
    'limite_acampantes_por_igreja', c.limite_acampantes_por_igreja,
    'max_acampantes', c.max_acampantes,
    'max_equipantes', c.max_equipantes,
    'max_acampantes_homens', c.max_acampantes_homens,
    'max_acampantes_mulheres', c.max_acampantes_mulheres,
    'updated_at', c.updated_at
  )
  from public.configuracoes c order by c.edicao_numero desc limit 1;
$function$;

-- 3b. Janela do domingo so abre com lote de equipante hoje -------------------
create or replace function public.janela_domingo()
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select jsonb_build_object(
    'inicio', x.i,
    'fim', x.f,
    'aberta', coalesce((now() at time zone 'America/Sao_Paulo')::date between x.i and x.f, false)
              and x.tem_lote,
    'sem_lote', not x.tem_lote,
    'personalizada', x.personalizada)
  from (
    select coalesce(c.domingo_inscricoes_inicio,
                    date_trunc('week', coalesce(c.data_evento_fim, c.data_evento_inicio))::date) as i,
           coalesce(c.domingo_inscricoes_fim,
                    date_trunc('week', coalesce(c.data_evento_fim, c.data_evento_inicio))::date + 2) as f,
           (c.domingo_inscricoes_inicio is not null or c.domingo_inscricoes_fim is not null) as personalizada,
           public._valor_hoje_em(c.equipante_pricing_periods) is not null as tem_lote
      from public.configuracoes c
     order by c.edicao_numero desc
     limit 1) x;
$function$;
