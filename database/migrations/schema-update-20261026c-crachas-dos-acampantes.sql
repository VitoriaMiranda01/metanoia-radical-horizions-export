-- Crachas dos acampantes (26/10/2026, Patrick).
--
-- Modulo "Crachas" em Gerenciar Inscricoes (so organizador). Quem ganha cracha
-- e a MESMA lista da recepcao e dos onibus (_recepcao_participantes: pago,
-- isento ou com pagamento agendado; infiltrados da escala oficial com cor).
-- O cracha leva nome completo, cor do grupo e um numero: o tamanho da camisa
-- (1 PP, 2 P, 3 M, 4 G, 5 GG, 6 XG, 7 XXG) ou 8 para TODO infiltrado -- e so
-- por esse numero que a equipe reconhece o infiltrado.
--
-- Nome, cor e camisa nao sao copiados: o modulo muda a propria ficha (nome e
-- camisa do acampante, nome do equipante infiltrado; a cor pela troca de
-- grupo / cor da escala). Aqui so fica o controle de impressao: o que saiu
-- no ultimo cracha impresso de cada um, para a tela mostrar "impresso" ou
-- "mudou depois de impresso -- reimprimir".
--
-- A linha sai junto com a ficha (LGPD/desistencia/exclusao) e a virada de
-- edicao limpa tudo.

create table if not exists public.crachas_impressos (
  id           bigserial primary key,
  acampante_id uuid unique references public.acampantes(id) on delete cascade,
  equipante_id uuid unique references public.equipantes(id) on delete cascade,
  nome         text not null,
  grupo        text,
  numero       int not null check (numero between 1 and 8),
  impresso_em  timestamptz not null default now(),
  impresso_por text,
  vezes        int not null default 1,
  constraint crachas_impressos_uma_pessoa check ((acampante_id is null) <> (equipante_id is null))
);

alter table public.crachas_impressos enable row level security;
revoke all on public.crachas_impressos from anon, authenticated;
revoke all on sequence public.crachas_impressos_id_seq from anon, authenticated;

-- Lista do modulo: quem esta na recepcao + camisa + ultimo cracha impresso.
create or replace function public.crachas_lista()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Só organizadores gerenciam os crachás.');
  end if;

  return jsonb_build_object(
    'ok', true,
    'pessoas', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'tipo', p.tipo, 'id', p.id, 'nome', p.nome, 'grupo', p.grupo,
        'infiltrado', case when p.infiltrado then true end,
        'camisa', case when p.tipo = 'acampante' then a.tamanho_camisa end,
        'impresso', case when c.id is not null then jsonb_build_object(
          'nome', c.nome, 'grupo', c.grupo, 'numero', c.numero,
          'em', c.impresso_em, 'por', c.impresso_por, 'vezes', c.vezes) end
      )) order by p.nome)
      from public._recepcao_participantes() p
      left join public.acampantes a on p.tipo = 'acampante' and a.id = p.id
      left join public.crachas_impressos c
        on (p.tipo = 'acampante' and c.acampante_id = p.id) or (p.tipo = 'equipante' and c.equipante_id = p.id)
    ), '[]'::jsonb)
  );
end;
$function$;

-- p_itens: [{tipo, id, nome, grupo, numero}] -- o que acabou de ser impresso.
create or replace function public.crachas_marcar_impressos(p_itens jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_quem text := coalesce(public._nome_organizador_logado(), 'organizador');
  v_qtd  int := 0;
  v_item jsonb;
  v_aid  uuid;
  v_eid  uuid;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Só organizadores gerenciam os crachás.');
  end if;
  if jsonb_typeof(p_itens) is distinct from 'array' or jsonb_array_length(p_itens) = 0 then
    return jsonb_build_object('ok', false, 'erro', 'Nenhum crachá para marcar.');
  end if;
  if exists (
       select 1 from jsonb_array_elements(p_itens) x
        where x ->> 'tipo' not in ('acampante', 'equipante')
           or (x ->> 'id') !~* '^[0-9a-f-]{36}$'
           or coalesce(btrim(x ->> 'nome'), '') = ''
           or (x ->> 'numero') !~ '^[1-8]$'
           or not public._recepcao_participa(x ->> 'tipo', (x ->> 'id')::uuid)) then
    return jsonb_build_object('ok', false, 'erro', 'A lista mudou enquanto a tela estava aberta. Feche e abra de novo.');
  end if;

  for v_item in select distinct on (e ->> 'tipo', e ->> 'id') e from jsonb_array_elements(p_itens) e loop
    v_aid := case when v_item ->> 'tipo' = 'acampante' then (v_item ->> 'id')::uuid end;
    v_eid := case when v_item ->> 'tipo' = 'equipante' then (v_item ->> 'id')::uuid end;
    update public.crachas_impressos
       set nome = btrim(v_item ->> 'nome'), grupo = nullif(btrim(v_item ->> 'grupo'), ''),
           numero = (v_item ->> 'numero')::int, impresso_em = now(), impresso_por = v_quem, vezes = vezes + 1
     where (v_aid is not null and acampante_id = v_aid) or (v_eid is not null and equipante_id = v_eid);
    if not found then
      insert into public.crachas_impressos (acampante_id, equipante_id, nome, grupo, numero, impresso_por)
      values (v_aid, v_eid, btrim(v_item ->> 'nome'), nullif(btrim(v_item ->> 'grupo'), ''), (v_item ->> 'numero')::int, v_quem);
    end if;
    v_qtd := v_qtd + 1;
  end loop;
  return jsonb_build_object('ok', true, 'marcados', v_qtd);
end;
$function$;

-- Voltar para "nao impresso" (marcou sem querer, a folha se perdeu...).
create or replace function public.crachas_desmarcar_impresso(p_tipo text, p_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Só organizadores gerenciam os crachás.');
  end if;
  delete from public.crachas_impressos
   where (p_tipo = 'acampante' and acampante_id = p_id) or (p_tipo = 'equipante' and equipante_id = p_id);
  return jsonb_build_object('ok', true);
end;
$function$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.crachas_lista()', 'public.crachas_marcar_impressos(jsonb)',
    'public.crachas_desmarcar_impresso(text,uuid)']
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- Virada de edicao limpa os crachas impressos ----------------------------------
do $$
declare
  v_def  text := pg_get_functiondef('public.resetar_para_nova_edicao(integer,date,date)'::regprocedure);
  v_novo text;
begin
  if v_def like '%delete from public.crachas_impressos%' then return; end if;
  v_novo := replace(v_def,
    $a$  delete from public.onibus_pessoas where id is not null;
$a$,
    $a$  delete from public.onibus_pessoas where id is not null;
  delete from public.crachas_impressos where id is not null;  -- 20261026c
$a$);
  if v_novo = v_def then raise exception 'trecho não encontrado em resetar_para_nova_edicao'; end if;
  execute v_novo;
end $$;
