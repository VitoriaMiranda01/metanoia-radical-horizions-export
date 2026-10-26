-- 20261026e -- Ausente "mantido na área" passa a ser PRESENTE (Patrick, 26/10/2026).
--
-- Antes: "Manter na área" so gravava mantido_em/mantido_por e a pessoa
-- seguia presente = false -> contava como ausente no topo, no "Por área",
-- na aba Ausentes e no resumo (178 ausentes x 177 a definir).
-- Agora: manter = presente definido pela organizacao (marcado_por
-- "Nome (organização)"). mantido_em/mantido_por ficam como registro de que
-- faltou e foi mantido. Se o lider marcar ausente de novo, o mantido some
-- (regra que ja existia no on conflict) e volta a ficar "a definir".

-- 1. Manter = marcar presente pela organizacao.
do $$
declare
  v_def text := pg_get_functiondef('public._decidir_ausente(uuid, text)'::regprocedure);
  v_old text := 'set mantido_em = now(), mantido_por = public._nome_organizador_logado()';
  v_new text := 'set presente = true,
           marcado_por = coalesce(public._nome_organizador_logado(), ''organização'') || '' (organização)'',
           marcado_em = now(),
           mantido_em = now(), mantido_por = public._nome_organizador_logado()';
begin
  if position(v_old in v_def) = 0 then
    raise exception 'trecho não encontrado em _decidir_ausente';
  end if;
  execute replace(v_def, v_old, v_new);
end $$;

-- 2. Lista "mantidos" da chamada: agora sao presentes que tinham faltado.
do $$
declare
  v_def text := pg_get_functiondef('public.chamada_da_escala()'::regprocedure);
  v_old text := 'where not c.presente and c.mantido_em is not null';
begin
  if position(v_old in v_def) = 0 then
    raise exception 'trecho não encontrado em chamada_da_escala';
  end if;
  execute replace(v_def, v_old, 'where c.presente and c.mantido_em is not null');
end $$;

-- 3. Quem ja foi mantido vira presente.
update public.chamada_escala
   set presente = true,
       marcado_por = coalesce(mantido_por, 'organização') || ' (organização)',
       marcado_em = mantido_em
 where not presente and mantido_em is not null;
