-- Locais da reuniao de Leitura de Escala editaveis em Configuracoes
-- (19/10/2026, Patrick). Antes ficavam escritos no codigo
-- (src/constants/locaisReuniao.js, que agora so serve de reserva se a
-- consulta falhar). Areas secundarias nao se reunem e nao tem local.
--
-- locais_reuniao: area -> lugar (Espaco Social, Templo, Galeria...) e
-- detalhe opcional (Sala 01...). Leitura publica pela funcao locais_reuniao()
-- (a revelacao da area e a lista do lider usam); gravacao so organizador,
-- pela salvar_locais_reuniao (lista completa: o que nao vier e apagado).

create table if not exists public.locais_reuniao (
  area           text primary key,
  lugar          text not null,
  detalhe        text,
  atualizado_em  timestamptz not null default now(),
  atualizado_por text
);
alter table public.locais_reuniao enable row level security;
revoke all on table public.locais_reuniao from anon, authenticated;

insert into public.locais_reuniao (area, lugar, detalhe) values
  ('Cozinha', 'Espaço Social', 'Cozinha da igreja'),
  ('Copa', 'Espaço Social', 'Cozinha da igreja'),
  ('Segurança', 'Espaço Social', 'Sala 01'),
  ('Primeiros socorros - Saúde', 'Espaço Social', 'Sala 02'),
  ('Hospital (Cena teatral)', 'Espaço Social · Corredor I', 'Sala 07'),
  ('Igreja subterrânea', 'Espaço Social · Corredor I', 'Sala 06'),
  ('Guia', 'Espaço Social · Corredor I', 'Sala 05'),
  ('Espírito Santo', 'Espaço Social · Corredor I', 'Sala 05'),
  ('Inimigo', 'Espaço Social · Corredor I', 'Sala 05'),
  ('Pastor Invisível', 'Espaço Social · Corredor I', 'Sala 05'),
  ('Invisível', 'Espaço Social · Corredor I', 'Sala 05'),
  ('Marcador', 'Espaço Social · Corredor I', 'Sala 05'),
  ('Cracolândia', 'Espaço Social · Corredor II (dentro do Corredor I, lado direito)', 'Sala 03'),
  ('Selva', 'Espaço Social · Corredor II (dentro do Corredor I, lado direito)', 'Sala 04'),
  ('Perseguidos', 'Espaço Social · Corredor II (dentro do Corredor I, lado direito)', 'Sala 04'),
  ('Cristolândia', 'Templo', null),
  ('Pastor Enforcado', 'Templo', null),
  ('Depressão', 'Templo', null),
  ('Fotografia', 'Templo', null),
  ('Família', 'Templo', null),
  ('Túmulo', 'Templo', null),
  ('Infiltrados', 'Templo', null),
  ('Falsa baiana', 'Galeria', null),
  ('Logística', 'Galeria', null),
  ('Presídio', 'Galeria', null),
  ('Dia do arrebatamento da igreja', 'Galeria', null)
on conflict (area) do nothing;

-- { "Area": { "lugar": ..., "detalhe": ... }, ... }
create or replace function public.locais_reuniao()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(area, jsonb_build_object('lugar', lugar, 'detalhe', detalhe)), '{}'::jsonb)
    from public.locais_reuniao;
$$;
revoke all on function public.locais_reuniao() from public;
grant execute on function public.locais_reuniao() to anon, authenticated;

-- p_locais: [{ "area", "lugar", "detalhe" }] -- a lista COMPLETA.
create or replace function public.salvar_locais_reuniao(p_locais jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_quem text := coalesce(public._nome_organizador_logado(), 'organizador');
  v_n int;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores.');
  end if;
  if jsonb_typeof(coalesce(p_locais, '[]'::jsonb)) <> 'array' then
    return jsonb_build_object('ok', false, 'erro', 'Lista inválida.');
  end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p_locais, '[]'::jsonb)) x
              where length(btrim(coalesce(x ->> 'area', ''))) = 0
                 or length(btrim(coalesce(x ->> 'lugar', ''))) = 0
                 or length(x ->> 'lugar') > 120 or length(coalesce(x ->> 'detalhe', '')) > 120) then
    return jsonb_build_object('ok', false, 'erro', 'Toda área com local precisa do lugar (até 120 letras).');
  end if;

  delete from public.locais_reuniao l
   where not exists (select 1 from jsonb_array_elements(p_locais) x where btrim(x ->> 'area') = l.area);

  insert into public.locais_reuniao (area, lugar, detalhe, atualizado_em, atualizado_por)
  -- Area repetida na lista: vale a ultima.
  select distinct on (btrim(x ->> 'area'))
         btrim(x ->> 'area'), regexp_replace(btrim(x ->> 'lugar'), '\s+', ' ', 'g'),
         nullif(regexp_replace(btrim(coalesce(x ->> 'detalhe', '')), '\s+', ' ', 'g'), ''), now(), v_quem
    from jsonb_array_elements(p_locais) with ordinality as t(x, n)
   order by btrim(x ->> 'area'), n desc
  on conflict (area) do update
     set lugar = excluded.lugar, detalhe = excluded.detalhe,
         atualizado_em = case when (locais_reuniao.lugar, locais_reuniao.detalhe) is distinct from (excluded.lugar, excluded.detalhe)
                              then now() else locais_reuniao.atualizado_em end,
         atualizado_por = case when (locais_reuniao.lugar, locais_reuniao.detalhe) is distinct from (excluded.lugar, excluded.detalhe)
                               then v_quem else locais_reuniao.atualizado_por end;
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'total', (select count(*) from public.locais_reuniao));
end;
$$;
revoke all on function public.salvar_locais_reuniao(jsonb) from public, anon;
grant execute on function public.salvar_locais_reuniao(jsonb) to authenticated;
