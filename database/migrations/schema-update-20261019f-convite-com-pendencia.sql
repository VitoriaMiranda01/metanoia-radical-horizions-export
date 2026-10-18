-- Convite do grupo de WhatsApp liberado para quem esta PRESENTE mesmo com
-- pendencia no cadastro (19/10/2026, Patrick): a pendencia continua aparecendo
-- na relacao, mas nao trava mais o convite. Continua exigindo a presenca.
do $$
declare
  v_def text := pg_get_functiondef('public.lider_marcar_convite(uuid,text,text,date,uuid)'::regprocedure);
  v_novo text;
begin
  if v_def not like '%_pendencias_relacao%' then return; end if;
  v_novo := replace(v_def,
$a$  if jsonb_array_length(public._pendencias_relacao(v_eq)) > 0 then
    return jsonb_build_object('ok', false, 'erro', 'A pessoa ainda tem pendência no cadastro.');
  end if;
$a$, '');
  if v_novo = v_def then
    raise exception 'trecho não encontrado em lider_marcar_convite';
  end if;
  execute v_novo;
end $$;
