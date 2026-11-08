-- 07/11/2026 (Patrick): desfaz a 20261107a. O aviso "encerradas" volta a aparecer
-- sempre que as inscrições estão fechadas (só o texto curto mudou, no código).
-- config_publica volta ao conteúdo de 20261104e: menos bytes por chamada.
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
