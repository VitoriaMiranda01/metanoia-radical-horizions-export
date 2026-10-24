-- ---------------------------------------------------------------------------
-- Desfazer pagamento de quem ja entrou pela portaria (revisao, 24/10/2026)
--
-- Na tela da portaria, o pagamento so se desfaz depois de desfazer a entrada.
-- Pela tela de Pagamentos (desfazer_pagamento, organizador) isso nao era
-- conferido: o equipante ficaria "Entrada liberada" com o pagamento em aberto.
-- Agora a mesma trava vale ali.
-- ---------------------------------------------------------------------------

do $$
declare v_def text := pg_get_functiondef('public.desfazer_pagamento(text, uuid)'::regprocedure);
begin
  if position('  if v_metodo = ''pix'' then' in v_def) = 0 then
    raise exception 'desfazer_pagamento: trecho não encontrado';
  end if;
  execute replace(v_def, '  if v_metodo = ''pix'' then',
    '  if p_tipo = ''equipante'' and exists (select 1 from public.portaria_entradas where equipante_id = p_id) then' || chr(10) ||
    '    return jsonb_build_object(''ok'', false, ''erro'',' || chr(10) ||
    '      ''Esta pessoa já entrou pela portaria. Desfaça a entrada na tela da Portaria antes de desfazer o pagamento.'');' || chr(10) ||
    '  end if;' || chr(10) ||
    '  if v_metodo = ''pix'' then');
end $$;
