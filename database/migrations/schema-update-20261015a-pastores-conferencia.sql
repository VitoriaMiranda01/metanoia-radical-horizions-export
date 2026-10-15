-- ---------------------------------------------------------------------------
-- Conferencia do de-para dos Pastores Parceiros (15/10/2026, Patrick).
--
-- Quem veio da planilha mostra "Na planilha: ..." embaixo da igreja. Depois
-- de conferir, o organizador marca "Conferido" e a linha some. Fica no banco
-- (vale para todos) e pode ser desfeito.
-- ---------------------------------------------------------------------------
alter table public.pastores_parceiros add column if not exists conferido_em  timestamptz;
alter table public.pastores_parceiros add column if not exists conferido_por text;

create or replace function public.conferir_pastor(p_id uuid, p_conferido boolean default true)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_nome text;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores.');
  end if;
  update public.pastores_parceiros
     set conferido_em  = case when p_conferido then now() end,
         conferido_por = case when p_conferido then coalesce(public._nome_organizador_logado(), 'organizador') end
   where id = p_id and removido_em is null
  returning nome into v_nome;
  if v_nome is null then
    return jsonb_build_object('ok', false, 'erro', 'Pastor não encontrado. Atualize a lista e tente de novo.');
  end if;
  return jsonb_build_object('ok', true, 'nome', v_nome);
end;
$fn$;

revoke all on function public.conferir_pastor(uuid, boolean) from public, anon;
grant execute on function public.conferir_pastor(uuid, boolean) to authenticated;

create or replace function public.pastores_listar()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores.');
  end if;

  return jsonb_build_object('ok', true, 'pastores', coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', p.id, 'nome', p.nome, 'cpf', p.cpf, 'telefone', p.telefone,
             'igreja_id', p.igreja_id,
             'igreja_codigo', i.codigo, 'igreja_nome', i.nome,
             'igreja_digitada', p.igreja_digitada,
             'origem', p.origem, 'respondido_em', p.respondido_em,
             'conferido_em', p.conferido_em, 'conferido_por', p.conferido_por,
             'criado_em', p.criado_em, 'criado_por', p.criado_por,
             'atualizado_em', p.atualizado_em, 'atualizado_por', p.atualizado_por)
           order by (i.codigo is null) desc, case when i.codigo ~ '^\d+$' then i.codigo::int end, p.nome)
      from public.pastores_parceiros p
      left join public.igrejas_parceiras i on i.id = p.igreja_id
     where p.removido_em is null), '[]'::jsonb));
end;
$fn$;
