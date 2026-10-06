-- ---------------------------------------------------------------------------
-- Nomes de acampantes e equipantes sempre "Capitalizados" (Patrick,
-- 06/10/2026): "PATRICK RIOS GOMES DO NASCIMENTO" vira
-- "Patrick Rios Gomes do Nascimento". A pessoa pode digitar como quiser;
-- o banco guarda padronizado.
--
-- Regra (_nome_proprio), a mesma do formatNomeExibicao da tela:
--   * cada palavra com a primeira letra maiuscula e o resto minusculo;
--   * de, da, do, das, dos, e -- minusculos (menos se forem a 1a palavra);
--   * maiuscula tambem depois de hifen e apostrofo: "Ana-Clara", "D'Ávila";
--   * algarismos romanos (II, III, IV...) em maiusculo.
--
-- Vale para quem se inscreve ou e editado daqui para frente (gatilho) e foi
-- aplicada nos nomes que ja existiam. Os nomes como estavam ficam guardados
-- em nomes_antes_padronizacao, para voltar atras se precisar.
-- ---------------------------------------------------------------------------

create or replace function public._nome_proprio(p_nome text)
returns text
language plpgsql immutable
set search_path to 'public'
as $fn$
declare
  v text;
  w text;
  saida text[] := '{}';
  pos int := 0;
  c text;
  montada text;
  maiuscula boolean;
  k int;
begin
  if p_nome is null then
    return null;
  end if;
  v := lower(btrim(regexp_replace(p_nome, '\s+', ' ', 'g')));
  if v = '' then
    return p_nome;
  end if;

  foreach w in array string_to_array(v, ' ') loop
    pos := pos + 1;
    if pos > 1 and w in ('de', 'da', 'do', 'das', 'dos', 'e') then
      saida := saida || w;
      continue;
    end if;
    if w ~ '^(ii|iii|iv|vi|vii|viii|ix|xi|xii)$' then
      saida := saida || upper(w);
      continue;
    end if;
    montada := '';
    maiuscula := true;
    for k in 1 .. length(w) loop
      c := substr(w, k, 1);
      montada := montada || case when maiuscula then upper(c) else c end;
      maiuscula := c in ('-', '''', '’');
    end loop;
    saida := saida || montada;
  end loop;

  return array_to_string(saida, ' ');
end;
$fn$;

create or replace function public._padroniza_nome()
returns trigger
language plpgsql
set search_path to 'public'
as $fn$
begin
  if new.nome is not null then
    new.nome := public._nome_proprio(new.nome);
  end if;
  return new;
end;
$fn$;

drop trigger if exists padroniza_nome on public.acampantes;
create trigger padroniza_nome
  before insert or update of nome on public.acampantes
  for each row execute function public._padroniza_nome();

drop trigger if exists padroniza_nome on public.equipantes;
create trigger padroniza_nome
  before insert or update of nome on public.equipantes
  for each row execute function public._padroniza_nome();

-- Copia dos nomes como estavam, antes de padronizar.
create table if not exists public.nomes_antes_padronizacao (
  tabela        text not null,
  id            uuid not null,
  nome_original text,
  guardado_em   timestamptz not null default now(),
  primary key (tabela, id)
);
alter table public.nomes_antes_padronizacao enable row level security;
revoke all on public.nomes_antes_padronizacao from anon, authenticated;

insert into public.nomes_antes_padronizacao (tabela, id, nome_original)
select 'acampantes', a.id, a.nome from public.acampantes a
 where a.nome is not null and a.nome <> public._nome_proprio(a.nome)
on conflict (tabela, id) do nothing;

insert into public.nomes_antes_padronizacao (tabela, id, nome_original)
select 'equipantes', e.id, e.nome from public.equipantes e
 where e.nome is not null and e.nome <> public._nome_proprio(e.nome)
on conflict (tabela, id) do nothing;

update public.acampantes set nome = public._nome_proprio(nome)
 where nome is not null and nome <> public._nome_proprio(nome);

update public.equipantes set nome = public._nome_proprio(nome)
 where nome is not null and nome <> public._nome_proprio(nome);
