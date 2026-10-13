-- ---------------------------------------------------------------------------
-- Infiltrados nos grupos de trilha (Patrick, 12/10/2026).
--
-- Os infiltrados sao EQUIPANTES escalados na area "Infiltrados" com a cor do
-- grupo em que entram disfarcados. Depois da ESCALA OFICIAL lancada, eles
-- aparecem nos grupos de trilha e nas listas dos onibus como se fossem
-- acampantes (sigilo: nenhuma diferenca no que e impresso/exportado). No
-- sistema continuam equipantes -- nada e copiado para a tabela de acampantes;
-- a escala e a unica fonte (mudar a cor pela tela dos grupos muda a escala).
--
--  1. Infiltrados nao tem lider: sai a atuacao "Líder" da area.
--  2. infiltrados_nos_grupos(): os infiltrados da escala oficial com a cor.
--  3. Vinculos (20261012a) passam a aceitar infiltrado de um dos lados (ou
--     dos dois): as chaves deixam de apontar so para acampantes e um gatilho
--     apaga os vinculos de quem e apagado (acampante ou equipante).
--  4. A virada de edicao apaga os vinculos (os de infiltrado nao caem com os
--     acampantes).
-- ---------------------------------------------------------------------------

-- 1. Sem lider nos Infiltrados.
update public.escalas set atuacao = 'Infiltrado'
 where area_alocada = 'Infiltrados' and atuacao = 'Líder';
delete from public.atuacoes_areas
 where area_nome = 'Infiltrados' and atuacao = 'Líder';

-- 2. Os infiltrados para os grupos (so organizador).
create or replace function public.infiltrados_nos_grupos()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $fn$
declare
  v_oficial boolean;
begin
  if not public.eh_organizador() then
    raise exception 'Só organizadores veem os infiltrados.' using errcode = '42501';
  end if;

  select c.escala_oficial_em is not null into v_oficial from public.configuracoes c limit 1;
  if not coalesce(v_oficial, false) then
    return jsonb_build_object('oficial', false, 'infiltrados', '[]'::jsonb, 'sem_cor', 0);
  end if;

  return jsonb_build_object(
    'oficial', true,
    'infiltrados', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'escala_id', s.id, 'nome', e.nome, 'sexo', e.sexo, 'cpf', e.cpf,
        'whatsapp', coalesce(nullif(e.whatsapp, ''), e.telefone), 'nacionalidade', e.nacionalidade,
        'igreja', e.igreja, 'cor', s.cor) order by e.nome)
      from public.escalas s
      join public.equipantes e on e.id = s.equipante_id
      where s.area_alocada = 'Infiltrados' and s.cor is not null), '[]'::jsonb),
    'sem_cor', (select count(*) from public.escalas s
                 where s.area_alocada = 'Infiltrados' and s.cor is null)
  );
end;
$fn$;

revoke all on function public.infiltrados_nos_grupos() from public, anon;
grant execute on function public.infiltrados_nos_grupos() to authenticated;

-- 3. Vinculo com infiltrado.
alter table public.acampantes_vinculos drop constraint if exists acampantes_vinculos_acampante_a_fkey;
alter table public.acampantes_vinculos drop constraint if exists acampantes_vinculos_acampante_b_fkey;

-- Quem pode ter vinculo: acampante, ou equipante escalado em Infiltrados.
create or replace function public._pode_ter_vinculo(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select exists (select 1 from public.acampantes where id = p_id)
      or exists (select 1 from public.escalas where equipante_id = p_id and area_alocada = 'Infiltrados');
$fn$;
revoke all on function public._pode_ter_vinculo(uuid) from public, anon, authenticated;

create or replace function public._apagar_vinculos_da_pessoa()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  delete from public.acampantes_vinculos where acampante_a = old.id or acampante_b = old.id;
  return old;
end;
$fn$;
revoke all on function public._apagar_vinculos_da_pessoa() from public, anon, authenticated;

drop trigger if exists apagar_vinculos on public.acampantes;
create trigger apagar_vinculos after delete on public.acampantes
  for each row execute function public._apagar_vinculos_da_pessoa();
drop trigger if exists apagar_vinculos on public.equipantes;
create trigger apagar_vinculos after delete on public.equipantes
  for each row execute function public._apagar_vinculos_da_pessoa();

create or replace function pg_temp._patch(p regprocedure, de text, para text, vezes int)
returns void language plpgsql as $p$
declare d text := pg_get_functiondef(p); n int;
begin
  n := (length(d) - length(replace(d, de, ''))) / length(de);
  if n <> vezes then
    raise exception 'patch em %: esperava % ocorrencia(s) de [%], achei %', p, vezes, de, n;
  end if;
  execute replace(d, de, para);
end;
$p$;

select pg_temp._patch(
  'public.salvar_vinculo_acampantes(uuid,uuid,text,text,uuid)'::regprocedure,
  'if (select count(*) from public.acampantes where id in (p_a, p_b)) <> 2 then',
  'if not (public._pode_ter_vinculo(p_a) and public._pode_ter_vinculo(p_b)) then',
  1);

-- 4. Virada de edicao.
select pg_temp._patch(
  'public.resetar_para_nova_edicao(integer)'::regprocedure,
  'delete from public.acampantes where id is not null;',
  'delete from public.acampantes_vinculos where id is not null;' || chr(10)
    || '  delete from public.acampantes where id is not null;',
  1);
