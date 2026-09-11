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

-- Observacao: nao ha nenhuma outra parte do sistema lendo estas tabelas
-- pelo navegador -- a lista de igrejas usada nos formularios vem do
-- arquivo estatico src/constants/igrejas.js (IGREJAS_PARCEIRAS), nao
-- desta tabela. Conferido por busca em todo o src/ antes de aplicar.

-- Conferencia (deve devolver zero privilegios para "anon"):
--   select grantee, privilege_type
--   from information_schema.role_table_grants
--   where table_name in ('organizadores_auth','igrejas_parceiras')
--     and grantee = 'anon';
