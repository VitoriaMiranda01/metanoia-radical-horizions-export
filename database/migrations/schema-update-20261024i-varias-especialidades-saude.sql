-- Mais de uma especialidade na Saude (24/10/2026, pedido do Patrick/Verinha).
--
-- A especialidade principal continua em equipantes.especialidade_saude (+ o
-- texto do "Outro" em especialidade_saude_outro, intocado); as DEMAIS ficam na
-- coluna nova especialidades_saude_adicionais (text[], so opcoes da lista, sem
-- "Outro"). Assim nada do que ja le a principal quebra.
--
-- Quem marca varias:
--   * quem ja esta inscrito: so a Vera (apoio da saude) e os organizadores, na
--     tela da Saude (definir_especialidade_saude ganha p_adicionais);
--   * inscricoes novas: a propria pessoa, no formulario (criar_inscricao).
--   A pendencia do acompanhamento (completar_minha_inscricao) segue com uma so.
-- Fica na ficha da pessoa (ligada ao CPF): a reinscricao so troca se a pessoa
-- escolher Saude de novo (sem a chave, jsonb_populate_record mantem o que
-- havia) e a virada de edicao nao mexe.
-- Coluna nova SEM NOT NULL (criar_inscricao usa jsonb_populate_record).

alter table public.equipantes add column if not exists especialidades_saude_adicionais text[];

-- Gatilho: valida e arruma as adicionais (sem repetir a principal, sem
-- "Outro", na ordem da lista) ------------------------------------------------------
create or replace function public._conferir_especialidade_saude()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_erro text;
  v_ruim text;
begin
  new.especialidade_saude := nullif(btrim(coalesce(new.especialidade_saude, '')), '');
  if new.especialidade_saude is null then
    new.especialidade_saude_outro := null;
    new.especialidades_saude_adicionais := null;
    return new;
  end if;
  if new.especialidade_saude = 'Outro' then
    new.especialidade_saude_outro := regexp_replace(btrim(coalesce(new.especialidade_saude_outro, '')), '\s+', ' ', 'g');
  else
    new.especialidade_saude_outro := null;
  end if;
  v_erro := public._especialidade_saude_erro(new.especialidade_saude, new.especialidade_saude_outro);
  if v_erro is not null then
    raise exception 'ESPECIALIDADE_SAUDE_INVALIDA: %', v_erro;
  end if;

  if new.especialidades_saude_adicionais is not null then
    select x into v_ruim
      from unnest(new.especialidades_saude_adicionais) x
     where nullif(btrim(coalesce(x, '')), '') is not null
       and (btrim(x) = 'Outro' or not exists (select 1 from public.especialidades_saude s where s.nome = btrim(x)))
     limit 1;
    if v_ruim is not null then
      raise exception 'ESPECIALIDADE_SAUDE_INVALIDA: Escolha uma especialidade da lista.';
    end if;
    new.especialidades_saude_adicionais := (
      select array_agg(s.nome order by s.ordem, s.nome)
        from public.especialidades_saude s
       where s.nome <> 'Outro' and s.nome <> new.especialidade_saude
         and s.nome in (select btrim(x) from unnest(new.especialidades_saude_adicionais) x));
  end if;

  if tg_op = 'INSERT' or new.especialidade_saude is distinct from old.especialidade_saude
     or new.especialidade_saude_outro is distinct from old.especialidade_saude_outro
     or new.especialidades_saude_adicionais is distinct from old.especialidades_saude_adicionais then
    new.especialidade_saude_em := now();
  end if;
  return new;
end;
$$;
drop trigger if exists conferir_especialidade_saude on public.equipantes;
create trigger conferir_especialidade_saude
  before insert or update of especialidade_saude, especialidade_saude_outro, especialidades_saude_adicionais on public.equipantes
  for each row execute function public._conferir_especialidade_saude();

-- Vera / organizador: principal + adicionais. p_adicionais null = nao mexe
-- nas adicionais (tela antiga em cache continua funcionando) ----------------------
drop function if exists public.definir_especialidade_saude(uuid, text, text);
create or replace function public.definir_especialidade_saude(p_equipante_id uuid, p_especialidade text, p_outro text default null,
                                                              p_adicionais text[] default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_erro text;
  v_esp text := nullif(btrim(coalesce(p_especialidade, '')), '');
  v_outro text := case when btrim(coalesce(p_especialidade, '')) = 'Outro'
                       then regexp_replace(btrim(coalesce(p_outro, '')), '\s+', ' ', 'g') end;
  v_adic text[];
begin
  if not (public.eh_apoio('saude') or public.eh_organizador()) then
    return jsonb_build_object('ok', false, 'erro', 'Acesso não autorizado.');
  end if;
  if v_esp is not null then
    v_erro := public._especialidade_saude_erro(v_esp, v_outro);
    if v_erro is not null then
      return jsonb_build_object('ok', false, 'erro', v_erro);
    end if;
  end if;
  update public.equipantes set especialidade_saude = v_esp, especialidade_saude_outro = v_outro,
         especialidades_saude_adicionais = case when p_adicionais is null then especialidades_saude_adicionais else p_adicionais end
   where id = p_equipante_id and tipo = 'equipante'
  returning especialidades_saude_adicionais into v_adic;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Equipante não encontrado.');
  end if;
  return jsonb_build_object('ok', true, 'especialidade', v_esp, 'outro', v_outro, 'adicionais', coalesce(to_jsonb(v_adic), '[]'::jsonb));
end;
$$;
revoke all on function public.definir_especialidade_saude(uuid, text, text, text[]) from public, anon;
grant execute on function public.definir_especialidade_saude(uuid, text, text, text[]) to authenticated;

-- criar_inscricao, saude_equipe, relacao_lider -----------------------------------
do $mig$
declare
  v text;
begin
  -- criar_inscricao: a reinscricao grava as adicionais junto com a principal
  -- (v_e = ficha antiga + o que veio; sem a chave, fica a antiga). A
  -- inscricao nova ja grava pela jsonb_populate_record.
  v := pg_get_functiondef('public.criar_inscricao(text,jsonb,text)'::regprocedure);
  if position(E'        especialidade_saude_outro    = v_e.especialidade_saude_outro,\n' in v) = 0 then
    raise exception 'criar_inscricao: trecho nao encontrado';
  end if;
  v := replace(v, E'        especialidade_saude_outro    = v_e.especialidade_saude_outro,\n',
    E'        especialidade_saude_outro    = v_e.especialidade_saude_outro,\n        especialidades_saude_adicionais = v_e.especialidades_saude_adicionais,\n');
  execute v;

  v := pg_get_functiondef('public.saude_equipe()'::regprocedure);
  if position(E'''especialidade_outro'', q.especialidade_saude_outro,' in v) = 0 then
    raise exception 'saude_equipe: trecho nao encontrado';
  end if;
  v := replace(v, E'''especialidade_outro'', q.especialidade_saude_outro,',
    E'''especialidade_outro'', q.especialidade_saude_outro,\n               ''especialidades_adicionais'', coalesce(to_jsonb(q.especialidades_saude_adicionais), ''[]''::jsonb),');
  execute v;

  v := pg_get_functiondef('public.relacao_lider(uuid,text,text,date)'::regprocedure);
  if position(E'''especialidade_saude_outro'', q.especialidade_saude_outro)' in v) = 0 then
    raise exception 'relacao_lider: trecho nao encontrado';
  end if;
  v := replace(v, E'''especialidade_saude_outro'', q.especialidade_saude_outro)',
    E'''especialidade_saude_outro'', q.especialidade_saude_outro,\n                      ''especialidades_saude_adicionais'', q.especialidades_saude_adicionais)');
  execute v;
end
$mig$;
