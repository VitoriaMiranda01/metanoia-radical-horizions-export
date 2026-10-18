-- relacao_lider mais rapida (18/10/2026): a lista de membros de cada equipe
-- testava _na_equipe_de linha por linha da escala inteira. Agora a pertenca e
-- escrita direto (usa o indice de escalas por area). Resultado conferido igual
-- para os 21 lideres/responsaveis da base de teste; 13 equipes: 213 -> 46 ms.
do $mig$
declare
  v text;
begin
  v := pg_get_functiondef('public.relacao_lider(uuid,text,text,date)'::regprocedure);
  if position($a$              where public._na_equipe_de(e.area, e.cor, s.id))$a$ in v) = 0 then
    raise exception 'relacao_lider: trecho nao encontrado';
  end if;
  v := replace(v, $a$              where public._na_equipe_de(e.area, e.cor, s.id))$a$,
    $b$              where (s.area_alocada = e.area
                     or (e.area = 'Invisível' and s.area_alocada = 'Marcador')
                     or (e.area = 'Selva' and s.area_alocada = 'Perseguidos'))
                and (not public._area_com_cor(e.area) or e.cor is null or s.cor is null or s.cor = e.cor))$b$);
  execute v;
end
$mig$;
