-- ---------------------------------------------------------------------------
-- Selo 'dev_rosa' (24/10/2026, Patrick): o mesmo icone de Dev (</>), em rosa,
-- so para a Victoria Fernandes. Fora a cor, vale como 'dev'.
-- Quem recebe o selo e definido a mao em selos_organizacao (nao mora aqui).
-- ---------------------------------------------------------------------------
alter table public.selos_organizacao drop constraint if exists selos_organizacao_selo_check;
alter table public.selos_organizacao
  add constraint selos_organizacao_selo_check
  check (selo in ('pastor_diretor', 'diretor', 'dev', 'dev_rosa'));
