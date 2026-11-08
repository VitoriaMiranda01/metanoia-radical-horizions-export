-- 07/11/2026 (Patrick): o aviso "inscrições de equipante encerradas" só aparece
-- a partir de 1 dia depois da Reunião de Inscrição (Configurações > Reuniões da
-- edição). config_publica passa a devolver a data e o booleano já calculado no
-- horário de Brasília. Sem data cadastrada = false (aviso escondido).
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
    'reuniao_inscricao_em', c.reuniao_inscricao_em,
    'aviso_encerradas_liberado',
      coalesce((now() at time zone 'America/Sao_Paulo')::date >= c.reuniao_inscricao_em + 1, false),
    'updated_at', c.updated_at
  )
  from public.configuracoes c order by c.edicao_numero desc limit 1;
$function$;
