-- Virada de edicao limpa a portaria da edicao velha (25/10/2026, Patrick).
-- Antes, portaria_entradas e portaria_observacoes sobreviviam a virada: na
-- edicao nova todo mundo que entrou na anterior aparecia como "Entrada
-- liberada", com a observacao antiga. portaria_registros (historico de baixas e
-- entradas) fica: e registro, e sai pela LGPD.
-- Vem DEPOIS do debito (20261025e), que usa portaria_entradas para marcar
-- "entrou pela portaria".

do $$
declare
  v_def  text := pg_get_functiondef('public.resetar_para_nova_edicao(integer,date,date)'::regprocedure);
  v_novo text;
begin
  if v_def like '%delete from public.portaria_entradas%' then return; end if;
  v_novo := replace(v_def,
    $a$  delete from public.cobrancas_equipantes where equipante_id is not null;
$a$,
    $a$  delete from public.cobrancas_equipantes where equipante_id is not null;

  -- Portaria da edicao velha (20261025f).
  delete from public.portaria_entradas where equipante_id is not null;
  delete from public.portaria_observacoes where inscricao_id is not null;
$a$);
  if v_novo = v_def then raise exception 'trecho não encontrado em resetar_para_nova_edicao'; end if;
  execute v_novo;
end $$;
