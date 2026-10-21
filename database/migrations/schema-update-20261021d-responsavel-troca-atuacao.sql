-- Responsavel pela reuniao tambem troca a atuacao (21/10/2026, Patrick): em
-- TODAS as areas, nao so na Fotografia. Antes so o lider recebia a lista de
-- atuacoes (relacao_lider) e so ele podia gravar a troca (lider_trocar_atuacao).
-- Continuam valendo: Guia sem troca, area precisa de 2+ atuacoes alem do lider,
-- atuacao de lider so os organizadores trocam.

do $mig$
declare
  v_def text;
  v_novo text;
begin
  -- 1. relacao_lider: lista de atuacoes para lider E responsavel.
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p
   where p.proname = 'relacao_lider' and p.pronamespace = 'public'::regnamespace;
  v_novo := replace(v_def,
    $t$'atuacoes', case when e.papel = 'lider' and e.area <> 'Guia'$t$,
    $t$'atuacoes', case when e.area <> 'Guia'$t$);
  if v_novo = v_def then
    raise exception 'relacao_lider: trecho nao encontrado';
  end if;
  execute v_novo;

  -- 2. lider_trocar_atuacao: aceita o responsavel pela reuniao da equipe.
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p
   where p.proname = 'lider_trocar_atuacao' and p.pronamespace = 'public'::regnamespace;
  v_novo := replace(v_def,
    $t$where e.papel = 'lider' and e.area = s.area_alocada$t$,
    $t$where e.area = s.area_alocada$t$);
  if v_novo = v_def then
    raise exception 'lider_trocar_atuacao: trecho nao encontrado';
  end if;
  v_novo := replace(v_novo,
    $t$'Só o líder da área troca a atuação.'$t$,
    $t$'Só o líder ou o responsável pela reunião troca a atuação.'$t$);
  execute v_novo;
end
$mig$;
