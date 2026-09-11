-- =====================================================================
-- Passo 1 da Fase 2 de seguranca: login no servidor
-- Revoga o acesso anonimo as tabelas de credencial
-- =====================================================================
--
-- PROBLEMA QUE ISSO RESOLVE (achado C-2 do DIAGNOSTICO_SEGURANCA.md)
-- ------------------------------------------------------------------
-- Ate aqui, o login era feito no navegador: o site fazia
--     supabase.from('organizadores_auth').select('*')
-- e comparava a senha com bcryptjs no cliente. Isso exigia que o papel
-- "anon" (chave publica, visivel no bundle JS de qualquer visitante)
-- pudesse ler essas tabelas -- ou seja, QUALQUER PESSOA na internet
-- conseguia baixar os hashes de senha de todos os administradores e de
-- todas as igrejas parceiras e quebra-los offline (agravado pelo custo
-- bcrypt 06, muito baixo).
--
-- PRE-REQUISITO OBRIGATORIO
-- -------------------------
-- Rodar este script SOMENTE DEPOIS que:
--   1) a Edge Function "login" estiver publicada no projeto, e
--   2) o segredo APP_JWT_SECRET estiver configurado, e
--   3) o site (frontend) que chama essa funcao estiver no ar.
-- Caso contrario o login para de funcionar, porque o navegador ainda
-- estaria tentando ler estas tabelas diretamente.
--
-- POR QUE O LOGIN CONTINUA FUNCIONANDO DEPOIS DISSO
-- -------------------------------------------------
-- A Edge Function usa a chave service_role (secreta, so no servidor),
-- que ignora RLS e estes GRANTs. Quem perde o acesso e apenas o
-- navegador. Validado em projeto de teste: com estes REVOKEs aplicados,
-- a leitura anonima responde 401 "permission denied for table", e o
-- login via funcao continua respondendo normalmente.
--
-- COMO REVERTER (se precisar voltar atras rapidamente)
-- ----------------------------------------------------
--   grant select on public.organizadores_auth to anon;
--   grant select on public.igrejas_parceiras  to anon;
-- (isso religa o acesso antigo -- use so em emergencia, pois reabre o
-- vazamento dos hashes.)
-- =====================================================================

-- Defesa em profundidade: garante RLS ligada nas duas tabelas.
alter table public.organizadores_auth enable row level security;
alter table public.igrejas_parceiras  enable row level security;

-- O ponto principal: tirar qualquer privilegio do papel publico/anonimo.
revoke all on public.organizadores_auth from anon;
revoke all on public.igrejas_parceiras  from anon;

-- Tambem revogado de "authenticated". Hoje ninguem no site usa esse papel
-- (o token emitido pela funcao de login ainda nao e enviado ao banco), mas no
-- Passo 2 ele passara a valer -- e sem isto QUALQUER pessoa logada, inclusive
-- uma igreja parceira, teria acesso total as senhas de todo mundo.
-- A Edge Function nao e afetada: ela usa service_role, que mantem os privilegios.
revoke all on public.organizadores_auth from authenticated;
revoke all on public.igrejas_parceiras  from authenticated;

-- Observacao: nao ha nenhuma outra parte do sistema lendo estas tabelas
-- pelo navegador -- a lista de igrejas usada nos formularios vem do
-- arquivo estatico src/constants/igrejas.js (IGREJAS_PARCEIRAS), nao
-- desta tabela. Conferido por busca em todo o src/ antes de aplicar.

-- Conferencia (deve devolver zero linhas):
--   select grantee, privilege_type
--   from information_schema.role_table_grants
--   where table_name in ('organizadores_auth','igrejas_parceiras')
--     and grantee in ('anon','authenticated');

-- =====================================================================
-- APLICADO EM PRODUCAO em 2026-09-11 (projeto yxootyzlpefyztiiacrs),
-- como a migracao "login_servidor_revoga_acesso_tabelas_credencial".
--
-- Estado ANTES (conferido): anon e authenticated tinham
-- DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE nas duas
-- tabelas -- ou seja, qualquer visitante podia ler, alterar e APAGAR as
-- senhas de todos os organizadores e de todas as igrejas.
--
-- Verificacao DEPOIS, feita de fora (navegador, com a chave publica):
--   GET    /rest/v1/organizadores_auth  -> 401 permission denied
--   DELETE /rest/v1/organizadores_auth  -> 401 permission denied
--   GET    /rest/v1/igrejas_parceiras   -> 401 permission denied
--   DELETE /rest/v1/igrejas_parceiras   -> 401 permission denied
--
-- Login testado no site real DEPOIS da revogacao, com contas reais:
--   organizador -> entra em /gerenciar, token emitido (user_role=organizador)
--   parceiro    -> entra em /parceiros, token emitido (user_role=parceiro)
--   logout      -> limpa o token em ambos os casos
--
-- Observacao: a policy permissiva "Pode tudo" (ALL / using true) continua
-- existindo nas duas tabelas, mas ficou inerte: sem GRANT, o Postgres barra
-- o acesso antes de avaliar a policy. Remove-la e um passo de limpeza para
-- a Fase 2.
-- =====================================================================
