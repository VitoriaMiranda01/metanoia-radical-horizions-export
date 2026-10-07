-- ---------------------------------------------------------------------------
-- Revisao de 07/10/2026: _inscricao_e_sua de 5 argumentos estava aberta.
--
-- A versao de 4 argumentos (20260912j) foi fechada para anon/authenticated,
-- mas a de 5 (com a data de nascimento, criada depois e reescrita em
-- 20261006l) ficou com a permissao padrao -- qualquer visitante podia chama-la
-- direto pela API e usar como "oraculo" (dado um id, testar nome e data de
-- nascimento ate acertar).
--
-- Ela so e usada por dentro de outras funcoes SECURITY DEFINER (situacao,
-- pagamento, revelar area, completar cadastro...), que rodam como o dono e
-- continuam podendo chama-la. Nenhuma tela chama direto.
-- ---------------------------------------------------------------------------

revoke all on function public._inscricao_e_sua(text, uuid, text, text, date) from public, anon, authenticated;
