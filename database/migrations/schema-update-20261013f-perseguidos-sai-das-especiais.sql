-- ---------------------------------------------------------------------------
-- Perseguidos deixa de ser area especial (Patrick, 13/10/2026): e
-- complementar a Selva e fica na tela logo abaixo dela, como area comum. Sai
-- da regra "uma area especial por pessoa" (_area_especial). Continua so da
-- diretoria (limites_areas.somente_organizador = true): nao volta para o
-- formulario de inscricao nem recebe ninguem pelo Alocar automatico (so os
-- fixos).
-- ---------------------------------------------------------------------------

create or replace function public._area_especial(p_area text)
 returns boolean
 language sql
 immutable
 set search_path to 'public'
as $function$
  select p_area in (
    'Guia', 'Inimigo', 'Espírito Santo', 'Depressão', 'Infiltrados',
    'Família muçulmana', 'Apresentadores', 'Equipe de Manutenção', 'Pastor Invisível'
  );
$function$;
