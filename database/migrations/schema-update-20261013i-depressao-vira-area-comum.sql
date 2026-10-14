-- ---------------------------------------------------------------------------
-- Depressao deixa de ser area especial (Patrick, 13/10/2026: "Coloque a
-- depressão como area comum"). Sai da regra "uma area especial por pessoa"
-- (_area_especial): a pessoa pode estar na Depressao e em qualquer outra
-- area. Continua so da diretoria (limites_areas.somente_organizador = true):
-- nao entra no formulario de inscricao nem recebe ninguem pelo Alocar
-- automatico (so os fixos). Ninguem estava na Depressao e o pre-cadastro
-- dela estava vazio quando a mudanca entrou.
-- ---------------------------------------------------------------------------

create or replace function public._area_especial(p_area text)
 returns boolean
 language sql
 immutable
 set search_path to 'public'
as $function$
  select p_area in (
    'Guia', 'Inimigo', 'Espírito Santo', 'Infiltrados',
    'Família muçulmana', 'Apresentadores', 'Equipe de Manutenção', 'Pastor Invisível'
  );
$function$;
