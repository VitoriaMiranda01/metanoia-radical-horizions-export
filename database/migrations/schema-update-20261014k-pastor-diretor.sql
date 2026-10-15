-- ---------------------------------------------------------------------------
-- Pastor(a) Diretor(a) (14/10/2026, Patrick): os diretores do retiro, que tem
-- tambem cadastro de organizador. Selo proprio ao lado do nome (coroa), no
-- lugar do selo de pastor. Nao contam como pastor para o Pastor Invisível
-- automatico (que olha cargo_igreja / e_pastor).
-- ---------------------------------------------------------------------------
alter table public.equipantes
  add column if not exists pastor_diretor boolean not null default false;

comment on column public.equipantes.pastor_diretor is
  'Pastor(a) Diretor(a) do retiro: selo proprio (coroa) ao lado do nome.';

-- Marcados a pedido (Bruno Couto e Ludmila Couto), pela tela/SQL com registro
-- na auditoria -- ver o historico da conversa de 14/10/2026.
