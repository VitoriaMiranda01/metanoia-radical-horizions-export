-- ---------------------------------------------------------------------------
-- Selo interno ao lado do nome (14/10/2026, Patrick): controle interno, NAO
-- aparece no formulario de inscricao nem no "Editar inscricao".
--   'diretor' -> Diretoria do retiro (icone proprio)
--   'dev'     -> Desenvolvedor do sistema
-- Pastor(a) Diretor(a) continua em equipantes.pastor_diretor (coroa).
-- ---------------------------------------------------------------------------
alter table public.equipantes
  add column if not exists selo_interno text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'equipantes_selo_interno_valido') then
    alter table public.equipantes
      add constraint equipantes_selo_interno_valido check (selo_interno is null or selo_interno in ('diretor', 'dev'));
  end if;
end $$;

comment on column public.equipantes.selo_interno is
  'Controle interno: diretor (Diretoria) ou dev (Desenvolvedor). Icone ao lado do nome.';
