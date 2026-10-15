-- ---------------------------------------------------------------------------
-- Selos da organizacao FORA da ficha do equipante (15/10/2026, Patrick:
-- "Pastor(a) Diretor(a) não pode ser um campo nem que vá para a ficha dos
-- equipantes, ele é somente um indicador nosso").
--
-- equipantes.pastor_diretor e equipantes.selo_interno (20261014k/l) saem da
-- ficha -- a ficha volta a ser como era. Os selos passam a morar numa tabela
-- so da organizacao, que a inscricao nunca toca:
--   pastor_diretor -> coroa dourada (Bruno Couto, Ludmila Couto)
--   diretor        -> Diretoria
--   dev            -> Desenvolvedor
-- Leitura: selos_organizacao_listar(), so organizador.
-- ---------------------------------------------------------------------------
create table if not exists public.selos_organizacao (
  equipante_id uuid primary key references public.equipantes(id) on delete cascade,
  selo         text not null check (selo in ('pastor_diretor', 'diretor', 'dev')),
  marcado_em   timestamptz not null default now(),
  marcado_por  text
);
alter table public.selos_organizacao enable row level security;
revoke all on public.selos_organizacao from anon, authenticated;

insert into public.selos_organizacao (equipante_id, selo, marcado_por)
select id, 'pastor_diretor', 'Desenvolvedores' from public.equipantes where pastor_diretor is true
on conflict (equipante_id) do nothing;
insert into public.selos_organizacao (equipante_id, selo, marcado_por)
select id, selo_interno, 'Desenvolvedores' from public.equipantes where selo_interno in ('diretor', 'dev')
on conflict (equipante_id) do nothing;

alter table public.equipantes drop column if exists pastor_diretor;
alter table public.equipantes drop constraint if exists equipantes_selo_interno_valido;
alter table public.equipantes drop column if exists selo_interno;

create or replace function public.selos_organizacao_listar()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
begin
  if not public.eh_organizador() then
    return '{}'::jsonb;
  end if;
  return coalesce((select jsonb_object_agg(equipante_id, selo) from public.selos_organizacao), '{}'::jsonb);
end;
$fn$;
revoke all on function public.selos_organizacao_listar() from public, anon;
grant execute on function public.selos_organizacao_listar() to authenticated;
