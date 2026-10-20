-- 20/10/2026 (Patrick): fecha o "apagar direto" de acampantes.
--
-- Ate a 20261020a, o botao Excluir fazia delete pela API, e a policy
-- "organizador faz tudo" (cmd *) deixava. Agora acampante so sai pelas
-- funcoes desistir_acampante / excluir_acampante_definitivo (e pela virada de
-- edicao), todas security definer -- nao dependem desta policy.
-- Aplicar so DEPOIS de o site novo estar no ar (o antigo ainda chamava delete).

drop policy if exists "organizador faz tudo" on public.acampantes;

create policy "organizador le" on public.acampantes
  for select to authenticated using (public.eh_organizador());
create policy "organizador inclui" on public.acampantes
  for insert to authenticated with check (public.eh_organizador());
create policy "organizador altera" on public.acampantes
  for update to authenticated using (public.eh_organizador()) with check (public.eh_organizador());

-- Sem policy de delete o Supabase so devolveria "0 linhas"; sem o privilegio,
-- a tentativa da erro de verdade.
revoke delete on public.acampantes from anon, authenticated;
