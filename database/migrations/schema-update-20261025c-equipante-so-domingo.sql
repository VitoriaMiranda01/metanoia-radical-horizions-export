-- 20261025c -- Equipante que vai SÓ NO DOMINGO (Patrick, 25/10/2026)
--
-- Regra combinada:
--   * Inscrição própria, numa janela própria: por padrão de segunda a quarta
--     da semana do evento (datas ajustáveis em Configurações). Na janela, o CPF
--     sem inscrição nesta edição pergunta "todos os dias ou só domingo".
--   * Ficha igual à normal, SEM áreas de trabalho e sem área extra.
--   * Aprovada pela igreja como qualquer outra. Aprovada, a pessoa fica na
--     "área" Vão somente no domingo -- que NÃO é linha em `escalas`: ela nunca
--     entra na escala (provisória ou oficial), na chamada, nos grupos, no
--     automático nem na relação do líder. Aparece só na exportação Por área.
--   * Taxa de alimentação = 50% do lote do dia (desconto automático
--     'domingo', o mesmo caminho do pastor/infiltrado: PIX, tela, portaria).
--   * Paga depois de aprovada (não espera escala). Concluída = aprovada + paga.
--   * Etiqueta "Só Domingo" acompanha a pessoa a edição inteira; a virada de
--     edição zera a marca e a janela.
--   * Só equipante. Acampante não muda nada.

alter table public.equipantes add column if not exists so_domingo boolean default false;
comment on column public.equipantes.so_domingo is
  'Vai só no domingo (20261025c). Nunca entra em escalas; paga 50% do lote; zera na virada.';

alter table public.configuracoes
  add column if not exists domingo_inscricoes_inicio date,
  add column if not exists domingo_inscricoes_fim date;
comment on column public.configuracoes.domingo_inscricoes_inicio is
  'Início da inscrição "só domingo". Vazio = segunda-feira da semana do evento.';
comment on column public.configuracoes.domingo_inscricoes_fim is
  'Fim da inscrição "só domingo". Vazio = quarta-feira da semana do evento.';

-- Janela da inscrição de domingo (pública: a tela pergunta antes do formulário).
create or replace function public.janela_domingo()
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select jsonb_build_object(
    'inicio', x.i,
    'fim', x.f,
    'aberta', coalesce((now() at time zone 'America/Sao_Paulo')::date between x.i and x.f, false),
    'personalizada', x.personalizada)
  from (
    select coalesce(c.domingo_inscricoes_inicio,
                    date_trunc('week', coalesce(c.data_evento_fim, c.data_evento_inicio))::date) as i,
           coalesce(c.domingo_inscricoes_fim,
                    date_trunc('week', coalesce(c.data_evento_fim, c.data_evento_inicio))::date + 2) as f,
           (c.domingo_inscricoes_inicio is not null or c.domingo_inscricoes_fim is not null) as personalizada
      from public.configuracoes c
     order by c.edicao_numero desc
     limit 1) x;
$function$;
grant execute on function public.janela_domingo() to anon, authenticated;

create or replace function public._domingo_aberto()
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce((public.janela_domingo() ->> 'aberta')::boolean, false);
$function$;
revoke execute on function public._domingo_aberto() from public, anon;

-- Configurações: grava a janela (vazio = padrão segunda a quarta).
create or replace function public.definir_janela_domingo(p_inicio date, p_fim date)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores.');
  end if;
  if p_inicio is not null and p_fim is not null and p_fim < p_inicio then
    return jsonb_build_object('ok', false, 'erro', 'O fim da inscrição de domingo é antes do início.');
  end if;
  update public.configuracoes
     set domingo_inscricoes_inicio = p_inicio,
         domingo_inscricoes_fim = p_fim
   where id is not null;
  return jsonb_build_object('ok', true) || public.janela_domingo();
end;
$function$;
revoke execute on function public.definir_janela_domingo(date, date) from public, anon;
grant execute on function public.definir_janela_domingo(date, date) to authenticated;

-- Trava final: quem vai só no domingo nunca ganha linha em escalas, venha de
-- onde vier (manual, lote, automático, líder do módulo, inscrição manual).
create or replace function public._escalas_recusa_so_domingo()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if exists (select 1 from public.equipantes q where q.id = new.equipante_id and q.so_domingo is true) then
    raise exception 'SO_DOMINGO: esta pessoa vai só no domingo e não entra na escala.';
  end if;
  return new;
end;
$function$;
drop trigger if exists escalas_recusa_so_domingo on public.escalas;
create trigger escalas_recusa_so_domingo
  before insert or update of equipante_id on public.escalas
  for each row execute function public._escalas_recusa_so_domingo();

-- "Está na escala" para efeito de pagamento/portaria: quem vai só no domingo e
-- foi aprovado conta como dentro (sem isso os gatilhos do PIX transformariam o
-- pagamento dele em "fora da escala").
create or replace function public._equipante_na_escala(p_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select (exists (select 1 from public.escalas s
                   where s.equipante_id = p_id and s.area_alocada <> 'Não será escalado')
          and not exists (select 1 from public.escalas s
                           where s.equipante_id = p_id and s.area_alocada = 'Não será escalado'))
      or exists (select 1 from public.equipantes q
                  where q.id = p_id and q.so_domingo is true and q.status = 'aprovado');
$function$;

-- Paga depois da aprovação, sem esperar escala.
create or replace function public._equipante_pode_pagar(p_id uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  e public.equipantes;
begin
  select * into e from public.equipantes where id = p_id and tipo = 'equipante';
  if e.id is null then
    return jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada.');
  end if;
  if coalesce(e.status, '') <> 'aprovado' then
    return jsonb_build_object('ok', false, 'erro',
      'Sua inscrição ainda não foi aprovada pela sua igreja. O pagamento abre depois da aprovação e da escala.');
  end if;
  if not coalesce(e.so_domingo, false)
     and ((select escala_lancada_em from public.configuracoes limit 1) is null
          or not exists (select 1 from public.escalas s
                          where s.equipante_id = p_id and s.area_alocada <> 'Não será escalado')) then
    return jsonb_build_object('ok', false, 'erro',
      'O pagamento abre quando a escala sair e você estiver nela. Acompanhe pelo site.');
  end if;
  if coalesce(public.idade(e), 18) < 18
     and e.parental_auth_file_url is null and e.autorizacao_entregue_em is null then
    return jsonb_build_object('ok', false, 'erro',
      'Falta a autorização dos seus responsáveis. Entregue ou anexe no acompanhamento da inscrição.');
  end if;
  return jsonb_build_object('ok', true);
end;
$function$;

-- Concluída: domingo = aprovada + paga; o resto segue a regra da oficial.
create or replace function public._inscricao_concluida(p_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce((
    select e.status = 'aprovado'
       and lower(coalesce(e.status_pagamento, '')) in ('pago', 'confirmado', 'completed')
       and (coalesce(e.so_domingo, false)
            or ((select c.escala_oficial_em from public.configuracoes c limit 1) is not null
                and exists (select 1 from public.escalas s
                             where s.equipante_id = p_id and s.area_alocada <> 'Não será escalado')
                and not exists (select 1 from public.escalas s
                                 where s.equipante_id = p_id and s.area_alocada = 'Não será escalado')))
      from public.equipantes e where e.id = p_id and e.tipo = 'equipante'), false);
$function$;

-- 50% do lote do dia para quem vai só no domingo. Pastor/infiltrado continuam;
-- vale o MAIOR desconto (não soma).
create or replace function public._desconto_automatico(p_tipo text, p_id uuid, p_preco numeric)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  c record;
  r jsonb;
  v_melhor jsonb := jsonb_build_object('desconto', 0);
begin
  if p_tipo <> 'equipante' or p_preco is null then return v_melhor; end if;
  if exists (select 1 from public.equipantes q where q.id = p_id and q.so_domingo is true) then
    v_melhor := jsonb_build_object('desconto', round(p_preco * 0.5, 2), 'codigo', 'SO_DOMINGO',
                                   'percentual', 50, 'motivo', 'domingo');
  end if;
  for c in select x.codigo, x.so_pastor from public.cupons x
            where x.ativo is true and (x.so_pastor or x.so_infiltrado) loop
    r := public._cupom_para(c.codigo, p_tipo, p_id, p_preco);
    if (r ->> 'valido')::boolean and (r ->> 'desconto')::numeric > (v_melhor ->> 'desconto')::numeric then
      v_melhor := jsonb_build_object('desconto', (r ->> 'desconto')::numeric, 'codigo', r ->> 'codigo',
                                     'percentual', r -> 'percentual',
                                     'motivo', case when c.so_pastor then 'pastor' else 'infiltrado' end);
    end if;
  end loop;
  return v_melhor;
end;
$function$;

-- Remendos nas funções grandes (trecho a trecho; para se não achar o trecho).
create or replace function pg_temp._troca(p_def text, p_de text, p_para text, p_onde text)
 returns text language plpgsql as $f$
begin
  if position(p_de in p_def) = 0 then
    raise exception 'trecho não encontrado em %: %', p_onde, left(p_de, 80);
  end if;
  return replace(p_def, p_de, p_para);
end;
$f$;

do $$
declare
  d text;
begin
  -- criar_inscricao: janela própria, áreas zeradas, marca gravada.
  d := pg_get_functiondef('public.criar_inscricao(text,jsonb,text)'::regprocedure);
  d := pg_temp._troca(d, E'  v_edicao  int;\nbegin',
    E'  v_edicao  int;\n  v_domingo boolean := false;\nbegin', 'criar_inscricao');
  d := pg_temp._troca(d,
    E'  if coalesce(v_aberto, false) is not true\n     and not public.liberacao_valida(p_chave, p_tipo) then\n    raise exception ''INSCRICOES_FECHADAS'';\n  end if;',
    E'  v_domingo := p_tipo = ''equipante''\n'
    || E'               and lower(coalesce(p_dados ->> ''so_domingo'', '''')) in (''true'', ''t'', ''sim'');\n'
    || E'  if v_domingo then\n'
    || E'    if not public._domingo_aberto() and not public.liberacao_valida(p_chave, p_tipo) then\n'
    || E'      raise exception ''INSCRICOES_DOMINGO_FECHADAS'';\n'
    || E'    end if;\n'
    || E'    p_dados := p_dados || jsonb_build_object(''so_domingo'', true,\n'
    || E'      ''area_trabalho_opcao1'', null, ''area_trabalho_opcao2'', null, ''area_trabalho_opcao3'', null,\n'
    || E'      ''area_trabalho_extra'', null);\n'
    || E'  elsif coalesce(v_aberto, false) is not true\n     and not public.liberacao_valida(p_chave, p_tipo) then\n    raise exception ''INSCRICOES_FECHADAS'';\n  end if;',
    'criar_inscricao');
  d := pg_temp._troca(d,
    E'        area_trabalho_extra          = v_e.area_trabalho_extra,\n',
    E'        area_trabalho_extra          = v_e.area_trabalho_extra,\n        so_domingo                   = v_domingo,\n',
    'criar_inscricao');
  d := pg_temp._troca(d, E'    v_e.inscrito := true;\n',
    E'    v_e.inscrito := true;\n    v_e.so_domingo := v_domingo;\n', 'criar_inscricao');
  execute d;

  -- Áreas obrigatórias só para quem vai todos os dias.
  d := pg_get_functiondef('public._dados_inscricao_validos(jsonb,text)'::regprocedure);
  d := pg_temp._troca(d,
    E'    if nullif(btrim(coalesce(p_dados ->> ''area_trabalho_opcao1'', '''')), '''') is null\n',
    E'    if lower(coalesce(p_dados ->> ''so_domingo'', '''')) not in (''true'', ''t'', ''sim'')\n'
    || E'       and (nullif(btrim(coalesce(p_dados ->> ''area_trabalho_opcao1'', '''')), '''') is null\n',
    '_dados_inscricao_validos');
  d := pg_temp._troca(d,
    E'''area_trabalho_opcao3'', '''')), '''') is null then\n      return ''AREAS_OBRIGATORIAS'';',
    E'''area_trabalho_opcao3'', '''')), '''') is null) then\n      return ''AREAS_OBRIGATORIAS'';',
    '_dados_inscricao_validos');
  execute d;

  -- Acompanhamento: marca, pagamento sem escala, confirmação sempre visível.
  d := pg_get_functiondef('public.situacao_inscricao(text,uuid,text,text,date)'::regprocedure);
  d := pg_temp._troca(d,
    E'  select e.nome, public.idade(e) as idade, e.status, e.status_pagamento,\n',
    E'  select e.nome, public.idade(e) as idade, e.status, e.status_pagamento, e.so_domingo,\n',
    'situacao_inscricao');
  d := pg_temp._troca(d,
    E'    ''ok'', true, ''tipo'', ''equipante'', ''nome'', q.nome,\n',
    E'    ''ok'', true, ''tipo'', ''equipante'', ''nome'', q.nome,\n    ''so_domingo'', coalesce(q.so_domingo, false),\n',
    'situacao_inscricao');
  d := pg_temp._troca(d,
    E'''confirmacao_visivel'', (v_oficial is not null',
    E'''confirmacao_visivel'', (coalesce(q.so_domingo, false) or v_oficial is not null',
    'situacao_inscricao');
  d := pg_temp._troca(d,
    E'                  and v_escalado\n',
    E'                  and (v_escalado or coalesce(q.so_domingo, false))\n',
    'situacao_inscricao');
  execute d;

  -- Portaria: a etiqueta vai junto (a pessoa já entra pela _equipante_na_escala).
  d := pg_get_functiondef('public.portaria_lista()'::regprocedure);
  d := pg_temp._troca(d,
    E'             ''na_escala'', public._equipante_na_escala(e.id),\n',
    E'             ''na_escala'', public._equipante_na_escala(e.id),\n             ''so_domingo'', coalesce(e.so_domingo, false),\n',
    'portaria_lista');
  execute d;

  -- Fila "A escalar" e automático: quem vai só no domingo não está na fila.
  d := pg_get_functiondef('public.alocar_fila_automaticamente()'::regprocedure);
  d := pg_temp._troca(d, E'q.status = ''aprovado''', E'q.status = ''aprovado'' and q.so_domingo is not true',
    'alocar_fila_automaticamente');
  execute d;

  d := pg_get_functiondef('public.situacao_escala()'::regprocedure);
  d := pg_temp._troca(d, E'q.status = ''aprovado''', E'q.status = ''aprovado'' and q.so_domingo is not true',
    'situacao_escala');
  execute d;

  d := pg_get_functiondef('public.resumo_antes_da_oficial()'::regprocedure);
  d := pg_temp._troca(d,
    E'where q.tipo = ''equipante'' and q.status = ''aprovado''\n',
    E'where q.tipo = ''equipante'' and q.status = ''aprovado'' and q.so_domingo is not true\n',
    'resumo_antes_da_oficial');
  execute d;

  d := pg_get_functiondef('public.alocar_equipante_automaticamente(uuid)'::regprocedure);
  d := pg_temp._troca(d, E'SELECT id, nome, sexo, status,\n', E'SELECT id, nome, sexo, status, so_domingo,\n',
    'alocar_equipante_automaticamente');
  d := pg_temp._troca(d, E'IF v_equipante.status <> ''aprovado'' THEN',
    E'IF v_equipante.status <> ''aprovado'' OR v_equipante.so_domingo IS TRUE THEN',
    'alocar_equipante_automaticamente');
  execute d;

  d := pg_get_functiondef('public.alocar_equipante_manualmente(uuid,text,boolean)'::regprocedure);
  d := pg_temp._troca(d, E'SELECT id, nome, sexo, status INTO v_equipante',
    E'SELECT id, nome, sexo, status, so_domingo INTO v_equipante', 'alocar_equipante_manualmente');
  d := pg_temp._troca(d,
    E'    RETURN QUERY SELECT false, ''Equipante ainda não está aprovado''::text; RETURN;\n  END IF;\n',
    E'    RETURN QUERY SELECT false, ''Equipante ainda não está aprovado''::text; RETURN;\n  END IF;\n'
    || E'  IF v_equipante.so_domingo IS TRUE THEN\n'
    || E'    RETURN QUERY SELECT false, ''Vai só no domingo: não entra na escala.''::text; RETURN;\n  END IF;\n',
    'alocar_equipante_manualmente');
  execute d;

  d := pg_get_functiondef('public.lider_modulo_buscar(uuid,text,text,date,text,text)'::regprocedure);
  d := pg_temp._troca(d,
    E'where e.tipo = ''equipante'' and e.status = ''aprovado''\n',
    E'where e.tipo = ''equipante'' and e.status = ''aprovado'' and e.so_domingo is not true\n',
    'lider_modulo_buscar');
  execute d;

  -- Sem áreas não é pendência para quem vai só no domingo (senão o
  -- acompanhamento abria "Complete o seu cadastro — escolha as 3 áreas").
  d := pg_get_functiondef('public._pendencias_equipante(uuid)'::regprocedure);
  d := pg_temp._troca(d,
    E'     and not exists (select 1 from public.escalas s where s.equipante_id = p_id) then\n    v := v || jsonb_build_array(jsonb_build_object(''tipo'', ''areas''));',
    E'     and not coalesce(e.so_domingo, false)\n     and not exists (select 1 from public.escalas s where s.equipante_id = p_id) then\n    v := v || jsonb_build_array(jsonb_build_object(''tipo'', ''areas''));',
    '_pendencias_equipante');
  execute d;

  -- Portaria recarrega quando alguém do domingo é aprovado (ou deixa de ser).
  d := pg_get_functiondef('public.portaria_versao()'::regprocedure);
  d := pg_temp._troca(d,
    E'    (select count(*)::text from public.equipantes e where e.tipo = ''equipante'')\n  )) end;',
    E'    (select count(*)::text from public.equipantes e where e.tipo = ''equipante''),\n'
    || E'    (select count(*)::text from public.equipantes e where e.so_domingo is true and e.status = ''aprovado'')\n  )) end;',
    'portaria_versao');
  execute d;

  -- Virada de edição: a marca e a janela não passam para a próxima.
  d := pg_get_functiondef('public.resetar_para_nova_edicao(integer,date,date)'::regprocedure);
  d := pg_temp._troca(d,
    E'    pagamento_observacao     = null\n  where tipo = ''equipante'';',
    E'    pagamento_observacao     = null,\n    so_domingo               = false\n  where tipo = ''equipante'';',
    'resetar_para_nova_edicao');
  d := pg_temp._troca(d,
    E'    reuniao_leitura_escala_em = p_reuniao_leitura\n  where id is not null;',
    E'    reuniao_leitura_escala_em = p_reuniao_leitura,\n    domingo_inscricoes_inicio = null,\n    domingo_inscricoes_fim    = null\n  where id is not null;',
    'resetar_para_nova_edicao');
  execute d;
end;
$$;
