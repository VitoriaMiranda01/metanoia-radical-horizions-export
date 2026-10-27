-- Equipe da Saude por grupo de trilha (27/10/2026, pedido da Vera via Patrick).
--
-- Cada profissional escalado em "Primeiros socorros - Saude" pode ser alocado em UM
-- grupo de trilha (Vermelho..Roxo) ou ficar sem grupo. A tela mostra a demanda
-- (patologias dos acampantes do grupo) ao lado de quem foi alocado; o sistema so
-- mostra, nao sugere nem decide.
--
-- Tabela a parte, ligada a ESCALA (nao ao equipante): vale so para a edicao e some
-- junto quando a escala some (on delete cascade na virada). Nao mexe em escalas,
-- nao e lida pelo automatico. Sem dado de saude: so o vinculo.
-- Quem grava: a Vera (apoio da saude) e organizadores -- o mesmo de
-- definir_especialidade_saude.

create table if not exists public.saude_equipe_grupo (
  escala_id uuid primary key references public.escalas(id) on delete cascade,
  grupo text not null check (grupo in ('Vermelho', 'Amarelo', 'Verde', 'Azul', 'Roxo')),
  atualizado_em timestamptz not null default now(),
  atualizado_por text
);
alter table public.saude_equipe_grupo enable row level security;
revoke all on public.saude_equipe_grupo from public, anon, authenticated;

-- grupo null (ou vazio) = tira da alocacao -------------------------------------------
create or replace function public.definir_grupo_saude(p_escala_id uuid, p_grupo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_grupo text := nullif(btrim(coalesce(p_grupo, '')), '');
  v_quem text;
begin
  if not (public.eh_apoio('saude') or public.eh_organizador()) then
    return jsonb_build_object('ok', false, 'erro', 'Acesso não autorizado.');
  end if;
  if not exists (select 1 from public.escalas s
                  where s.id = p_escala_id and s.area_alocada = 'Primeiros socorros - Saúde') then
    return jsonb_build_object('ok', false, 'erro', 'Essa pessoa não está na equipe da Saúde.');
  end if;
  if v_grupo is not null and v_grupo not in ('Vermelho', 'Amarelo', 'Verde', 'Azul', 'Roxo') then
    return jsonb_build_object('ok', false, 'erro', 'Grupo inválido.');
  end if;
  v_quem := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'nome',
                     nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub');
  if v_grupo is null then
    delete from public.saude_equipe_grupo where escala_id = p_escala_id;
  else
    insert into public.saude_equipe_grupo (escala_id, grupo, atualizado_por)
    values (p_escala_id, v_grupo, v_quem)
    on conflict (escala_id) do update
      set grupo = excluded.grupo, atualizado_em = now(), atualizado_por = excluded.atualizado_por;
  end if;
  return jsonb_build_object('ok', true, 'grupo', v_grupo);
end;
$$;
revoke all on function public.definir_grupo_saude(uuid, text) from public, anon;
grant execute on function public.definir_grupo_saude(uuid, text) to authenticated;

-- saude_equipe passa a mandar o grupo de cada profissional ------------------------------
do $mig$
declare
  v text;
begin
  v := pg_get_functiondef('public.saude_equipe()'::regprocedure);
  if position(E'''viu_area'', q.area_vista_em is not null,' in v) = 0 then
    raise exception 'saude_equipe: trecho nao encontrado';
  end if;
  if position('grupo_saude' in v) = 0 then
    v := replace(v, E'''viu_area'', q.area_vista_em is not null,',
      E'''grupo_saude'', (select g.grupo from public.saude_equipe_grupo g where g.escala_id = s.id),\n               ''viu_area'', q.area_vista_em is not null,');
    execute v;
  end if;
end
$mig$;
