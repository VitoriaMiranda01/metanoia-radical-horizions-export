-- =============================================================================
-- Remove as policies "Pode tudo" (02/10/2026)
--
-- Tres policies antigas, FOR ALL TO public USING (true):
--
--   pix_sicoob         "Pode tudo pix" -- ATIVA para leitura: authenticated tem
--                      grant de SELECT, entao qualquer login (inclusive parceiro)
--                      lia as cobrancas PIX de todo mundo.
--   igrejas_parceiras  "Pode tudo"     -- adormecida (anon/authenticated sem grant)
--   organizadores_auth "Pode tudo"     -- adormecida (anon/authenticated sem grant)
--
-- As adormecidas guardam as senhas: se um dia alguem desse grant nessas
-- tabelas, a policy abriria leitura e escrita para todos na hora.
--
-- Quem usa essas tabelas e nao depende das policies:
--   - Edge Functions (login, sicoob-pix-create, sicoob-webhook-handler): service_role;
--   - funcoes do banco (status_pagamento_pix, contadores_do_menu, senhas...):
--     todas SECURITY DEFINER;
--   - tela Pagamentos Pendentes (fetchPixTravados): organizador, coberta por
--     "organizador le cobrancas".
--
-- Para desfazer:
--   create policy "Pode tudo pix" on public.pix_sicoob as permissive for all to public using (true);
--   create policy "Pode tudo" on public.igrejas_parceiras as permissive for all to public using (true) with check (true);
--   create policy "Pode tudo" on public.organizadores_auth as permissive for all to public using (true) with check (true);
-- =============================================================================

drop policy if exists "Pode tudo pix" on public.pix_sicoob;
drop policy if exists "Pode tudo" on public.igrejas_parceiras;
drop policy if exists "Pode tudo" on public.organizadores_auth;
