-- ---------------------------------------------------------------------------
-- Gatilho validar_ficha volta a deixar o organizador salvar (07/10/2026)
--
-- Sintoma (Raquel, 07/10 17:33): em Pagamentos, "Confirmar pagamento" -> OK
-- dava "Não foi possível concluir a operação" e a pessoa continuava como nao
-- paga. No banco: permission denied for function _nome_pessoa_valido.
--
-- Causa: _validar_ficha() (gatilho de acampantes e equipantes, 20261006r)
-- rodava com a permissao de quem esta logado, e chama _cpf_valido,
-- _nome_pessoa_valido, _nome_simples_valido, _email_valido e _uf_valida, que
-- foram fechadas para anon/authenticated (20261006l, m, n). O Postgres confere
-- a permissao de todas as funcoes da expressao ao prepara-la, mesmo as que
-- nao chegam a rodar -- entao QUALQUER update feito pelo site (confirmar
-- pagamento, isentar, editar ficha, trocar grupo de trilha...) falhava, mesmo
-- sem mexer em nome/CPF. As RPCs security definer (criar_inscricao etc.)
-- nao eram afetadas.
--
-- Correcao: o gatilho passa a rodar como dono (security definer), como os
-- outros gatilhos dessas tabelas (_auditar, _padronizar_telefones). As
-- funcoes internas continuam fechadas para o navegador. O gatilho nao depende
-- de quem esta logado (so compara a linha nova com a antiga), e o
-- search_path ja era fixo em public.
-- ---------------------------------------------------------------------------

alter function public._validar_ficha() security definer;
alter function public._validar_ficha() set search_path to 'public';
