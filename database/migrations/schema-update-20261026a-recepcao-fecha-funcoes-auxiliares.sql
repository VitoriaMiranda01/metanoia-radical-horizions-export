-- Revisao da recepcao dos acampantes (26/10/2026). A 20261025g liberou as
-- funcoes auxiliares (_recepcao_*) para qualquer login: chamando
-- _recepcao_participantes() direto, um parceiro, a portaria ou a saude leria
-- nome, telefone, nascimento e contato de emergencia de todos os acampantes e
-- quem e infiltrado. Igual a portaria (_portaria_quem, _portaria_logada), as
-- auxiliares so rodam por dentro das funcoes da tela (SECURITY DEFINER).

do $$
declare f text;
begin
  foreach f in array array[
    'public._recepcao_logada()', 'public._recepcao_quem()', 'public._recepcao_menor(date)',
    'public._recepcao_participantes()', 'public._recepcao_participa(text,uuid)',
    'public._recepcao_chamada_fechada()']
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;
