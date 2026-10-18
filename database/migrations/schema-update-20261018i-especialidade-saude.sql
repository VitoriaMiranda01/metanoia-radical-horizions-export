-- Especialidade da equipe de Saude (18/10/2026, pedido da Verinha via Patrick).
--
-- 1. Lista de especialidades em tabela (especialidades_saude): Tecnico de
--    enfermagem, Enfermagem, Medico, Socorrista, Fisioterapeuta, Bombeiro e
--    Outro. "Outro" abre um campo para escrever; o que for escrito fica em
--    equipantes.especialidade_saude_outro e aparece num quadro para a
--    organizacao, que pode TORNAR FIXA uma resposta (vira opcao da lista e
--    quem escreveu aquilo passa para a opcao nova).
-- 2. Pendencia obrigatoria "especialidade_saude" para quem esta escalado em
--    "Primeiros socorros - Saude" -- so DEPOIS que a pessoa ja viu a area
--    (area_vista_em), para nao estragar a revelacao.
-- 3. completar_minha_inscricao aceita a especialidade (prova de dono).
-- 4. Proxima edicao: na inscricao, quem escolher Saude em qualquer das 3
--    opcoes tem de informar a especialidade (criar_inscricao + gatilho).
-- 5. saude_equipe(): a lista da equipe da Saude para a tela da Saude (login
--    Apoio da saude e organizadores), com idade, especialidade, WhatsApp e o
--    grupo da equipe. relacao_lider passa a mandar a especialidade de cada
--    membro (tag na relacao do lider).
-- Colunas novas em equipantes SEM NOT NULL (criar_inscricao usa
-- jsonb_populate_record -- ver o incidente de 15/10).

create table if not exists public.especialidades_saude (
  nome       text primary key,
  ordem      int not null default 100,
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now(),
  criado_por text
);
alter table public.especialidades_saude enable row level security;
revoke all on table public.especialidades_saude from anon, authenticated;

insert into public.especialidades_saude (nome, ordem) values
  ('Técnico de enfermagem', 10), ('Enfermagem', 20), ('Médico', 30), ('Socorrista', 40),
  ('Fisioterapeuta', 50), ('Bombeiro', 60), ('Outro', 1000)
on conflict (nome) do nothing;

alter table public.equipantes add column if not exists especialidade_saude text;
alter table public.equipantes add column if not exists especialidade_saude_outro text;
alter table public.equipantes add column if not exists especialidade_saude_em timestamptz;

-- Opcoes da lista (publica: o formulario de inscricao usa) ----------------------
create or replace function public.especialidades_saude_opcoes()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(nome order by ordem, nome), '[]'::jsonb)
    from public.especialidades_saude where ativo;
$$;
revoke all on function public.especialidades_saude_opcoes() from public;
grant execute on function public.especialidades_saude_opcoes() to anon, authenticated;

-- Mensagem de erro (ou null se esta tudo certo) ---------------------------------
create or replace function public._especialidade_saude_erro(p_esp text, p_outro text)
returns text language sql stable security definer set search_path = public as $$
  select case
    when nullif(btrim(coalesce(p_esp, '')), '') is null then 'Escolha a sua especialidade na área da saúde.'
    when not exists (select 1 from public.especialidades_saude x where x.nome = btrim(p_esp))
      then 'Escolha uma especialidade da lista.'
    when btrim(p_esp) = 'Outro' and length(btrim(coalesce(p_outro, ''))) < 2
      then 'Escreva qual é a sua especialidade.'
    when length(btrim(coalesce(p_outro, ''))) > 80 then 'Especialidade muito longa (até 80 letras).'
    when btrim(coalesce(p_outro, '')) ~ '[0-9]' then 'Escreva a especialidade só com letras.'
  end;
$$;
revoke all on function public._especialidade_saude_erro(text, text) from public, anon, authenticated;

-- Gatilho: nenhum caminho grava especialidade fora da lista ------------------------
create or replace function public._conferir_especialidade_saude()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_erro text;
begin
  new.especialidade_saude := nullif(btrim(coalesce(new.especialidade_saude, '')), '');
  if new.especialidade_saude is null then
    new.especialidade_saude_outro := null;
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
  if tg_op = 'INSERT' or new.especialidade_saude is distinct from old.especialidade_saude
     or new.especialidade_saude_outro is distinct from old.especialidade_saude_outro then
    new.especialidade_saude_em := now();
  end if;
  return new;
end;
$$;
drop trigger if exists conferir_especialidade_saude on public.equipantes;
create trigger conferir_especialidade_saude
  before insert or update of especialidade_saude, especialidade_saude_outro on public.equipantes
  for each row execute function public._conferir_especialidade_saude();

-- Pendencia + completar + inscricao + relacao do lider ----------------------------
do $mig$
declare
  v text;
  n int;
begin
  -- _pendencias_equipante: a pendencia nova, so para quem ja viu a area.
  v := pg_get_functiondef('public._pendencias_equipante(uuid)'::regprocedure);
  n := (length(v) - length(replace(v, E'\n  return v;\nend;', ''))) / length(E'\n  return v;\nend;');
  if n <> 1 then raise exception '_pendencias_equipante: trecho nao encontrado (%)', n; end if;
  v := replace(v, E'\n  return v;\nend;', $b$
  if e.area_vista_em is not null
     and exists (select 1 from public.escalas s
                  where s.equipante_id = p_id and s.area_alocada = 'Primeiros socorros - Saúde')
     and public._especialidade_saude_erro(e.especialidade_saude, e.especialidade_saude_outro) is not null then
    v := v || jsonb_build_array(jsonb_build_object('tipo', 'especialidade_saude',
      'valor', e.especialidade_saude, 'outro', e.especialidade_saude_outro));
  end if;

  return v;
end;$b$);
  execute v;

  -- completar_minha_inscricao: aceita a especialidade.
  v := pg_get_functiondef('public.completar_minha_inscricao(uuid,text,text,date,jsonb)'::regprocedure);
  if position('  s_parentesco text; s_familiar text; s_a1 text; s_a2 text; s_a3 text;' in v) = 0
     or position(E'      area_trabalho_opcao3 = coalesce(s_a3, q.area_trabalho_opcao3)\n    where q.id = p_id;' in v) = 0
     or position(E'  begin\n    update public.equipantes q set' in v) = 0
     or position(E'  if jsonb_array_length(v_log) > coalesce(jsonb_array_length(e.autocorrecoes), 0) then' in v) = 0 then
    raise exception 'completar_minha_inscricao: trecho nao encontrado';
  end if;
  v := replace(v, '  s_parentesco text; s_familiar text; s_a1 text; s_a2 text; s_a3 text;',
    E'  s_parentesco text; s_familiar text; s_a1 text; s_a2 text; s_a3 text;\n  s_esp text; s_esp_outro text;');
  v := replace(v, E'  begin\n    update public.equipantes q set', $b$  if v_pend @> '[{"tipo":"especialidade_saude"}]' and btrim(coalesce(d ->> 'especialidade_saude', '')) <> '' then
    s_esp := btrim(d ->> 'especialidade_saude');
    s_esp_outro := case when s_esp = 'Outro'
                        then regexp_replace(btrim(coalesce(d ->> 'especialidade_saude_outro', '')), '\s+', ' ', 'g') end;
    v_tmp := public._especialidade_saude_erro(s_esp, s_esp_outro);
    if v_tmp is not null then
      return jsonb_build_object('ok', false, 'erro', v_tmp);
    end if;
  end if;

  begin
    update public.equipantes q set$b$);
  v := replace(v, E'      area_trabalho_opcao3 = coalesce(s_a3, q.area_trabalho_opcao3)\n    where q.id = p_id;',
    $b$      area_trabalho_opcao3 = coalesce(s_a3, q.area_trabalho_opcao3),
      especialidade_saude  = coalesce(s_esp, q.especialidade_saude),
      especialidade_saude_outro = case when s_esp is not null then s_esp_outro else q.especialidade_saude_outro end
    where q.id = p_id;$b$);
  v := replace(v, E'  if jsonb_array_length(v_log) > coalesce(jsonb_array_length(e.autocorrecoes), 0) then',
    $b$  if s_esp is not null then
    v_log := v_log || jsonb_build_array(jsonb_build_object('campo', 'especialidade_saude', 'antes', e.especialidade_saude,
      'depois', s_esp || case when s_esp_outro is not null then ' — ' || s_esp_outro else '' end, 'em', v_agora));
  end if;
  if jsonb_array_length(v_log) > coalesce(jsonb_array_length(e.autocorrecoes), 0) then$b$);
  execute v;

  -- criar_inscricao: Saude em qualquer opcao exige a especialidade; a
  -- reinscricao (CPF que ja existia) grava a especialidade tambem.
  v := pg_get_functiondef('public.criar_inscricao(text,jsonb,text)'::regprocedure);
  if position(E'      raise exception ''IGREJA_OBRIGATORIA'';\n    end if;\n' in v) = 0
     or position(E'        area_trabalho_opcao3         = v_e.area_trabalho_opcao3,\n' in v) = 0 then
    raise exception 'criar_inscricao: trecho nao encontrado';
  end if;
  v := replace(v, E'      raise exception ''IGREJA_OBRIGATORIA'';\n    end if;\n', $b$      raise exception 'IGREJA_OBRIGATORIA';
    end if;

    if 'Primeiros socorros - Saúde' in (coalesce(p_dados ->> 'area_trabalho_opcao1', ''),
                                        coalesce(p_dados ->> 'area_trabalho_opcao2', ''),
                                        coalesce(p_dados ->> 'area_trabalho_opcao3', ''))
       and public._especialidade_saude_erro(p_dados ->> 'especialidade_saude', p_dados ->> 'especialidade_saude_outro') is not null then
      raise exception 'ESPECIALIDADE_SAUDE_OBRIGATORIA';
    end if;
$b$);
  v := replace(v, E'        area_trabalho_opcao3         = v_e.area_trabalho_opcao3,\n',
    E'        area_trabalho_opcao3         = v_e.area_trabalho_opcao3,\n        especialidade_saude          = v_e.especialidade_saude,\n        especialidade_saude_outro    = v_e.especialidade_saude_outro,\n');
  execute v;

  -- relacao_lider: a especialidade de cada membro (tag na relacao).
  v := pg_get_functiondef('public.relacao_lider(uuid,text,text,date)'::regprocedure);
  if position(E'''convite_enviado_em'', c.convite_enviado_em)\n                    order by q.nome)' in v) = 0 then
    raise exception 'relacao_lider: trecho nao encontrado';
  end if;
  v := replace(v, E'''convite_enviado_em'', c.convite_enviado_em)\n                    order by q.nome)',
    E'''convite_enviado_em'', c.convite_enviado_em,\n                      ''especialidade_saude'', q.especialidade_saude,\n                      ''especialidade_saude_outro'', q.especialidade_saude_outro)\n                    order by q.nome)');
  execute v;
end
$mig$;

-- Lista da equipe da Saude (tela da Saude) ------------------------------------------
create or replace function public.saude_equipe()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_org boolean := public.eh_organizador();
begin
  if not (public.eh_apoio('saude') or v_org) then
    return jsonb_build_object('ok', false, 'erro', 'Acesso não autorizado.');
  end if;
  if not v_org and (select escala_lancada_em from public.configuracoes limit 1) is null then
    return jsonb_build_object('ok', true, 'lancada', false, 'equipe', '[]'::jsonb, 'opcoes', public.especialidades_saude_opcoes());
  end if;

  return jsonb_build_object('ok', true, 'lancada', true,
    'opcoes', public.especialidades_saude_opcoes(),
    'grupo_link', (select g.link from public.grupos_lider g join public.escalas s on s.id = g.escala_id
                    where s.area_alocada = 'Primeiros socorros - Saúde' and nullif(btrim(coalesce(g.link, '')), '') is not null
                    order by g.atualizado_em desc nulls last limit 1),
    'equipe', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', q.id,
               'escala_id', s.id,
               'nome', q.nome,
               'idade', public.idade(q),
               'data_nascimento', q.data_nascimento,
               'sexo', q.sexo,
               'igreja', q.igreja,
               'igreja_outra', q.igreja_outra,
               'whatsapp', q.whatsapp,
               'estrangeiro', nullif(regexp_replace(coalesce(q.cpf, ''), '\D', '', 'g'), '') is null,
               'atuacao', s.atuacao,
               'eh_lider', public._eh_lider(s.area_alocada, s.atuacao),
               'especialidade', q.especialidade_saude,
               'especialidade_outro', q.especialidade_saude_outro,
               'viu_area', q.area_vista_em is not null,
               'contato_emergencia_nome', q.contato_emergencia_nome,
               'contato_emergencia_telefone', q.contato_emergencia_telefone)
             order by public._eh_lider(s.area_alocada, s.atuacao) desc, q.nome)
        from public.escalas s
        join public.equipantes q on q.id = s.equipante_id
       where s.area_alocada = 'Primeiros socorros - Saúde'), '[]'::jsonb));
end;
$$;
revoke all on function public.saude_equipe() from public, anon;
grant execute on function public.saude_equipe() to authenticated;

-- Organizador ou a lider da Saude corrige a especialidade de alguem ----------------
create or replace function public.definir_especialidade_saude(p_equipante_id uuid, p_especialidade text, p_outro text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_erro text;
  v_esp text := nullif(btrim(coalesce(p_especialidade, '')), '');
  v_outro text := case when btrim(coalesce(p_especialidade, '')) = 'Outro'
                       then regexp_replace(btrim(coalesce(p_outro, '')), '\s+', ' ', 'g') end;
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
  update public.equipantes set especialidade_saude = v_esp, especialidade_saude_outro = v_outro
   where id = p_equipante_id and tipo = 'equipante';
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Equipante não encontrado.');
  end if;
  return jsonb_build_object('ok', true, 'especialidade', v_esp, 'outro', v_outro);
end;
$$;
revoke all on function public.definir_especialidade_saude(uuid, text, text) from public, anon;
grant execute on function public.definir_especialidade_saude(uuid, text, text) to authenticated;

-- Quadro do "Outro": o que foi escrito, quantas vezes e por quem --------------------
create or replace function public.especialidades_saude_outros()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.eh_apoio('saude') or public.eh_organizador()) then
    return jsonb_build_object('ok', false, 'erro', 'Acesso não autorizado.');
  end if;
  return jsonb_build_object('ok', true, 'outros', coalesce((
    select jsonb_agg(jsonb_build_object('texto', t.texto, 'quantos', t.quantos, 'nomes', t.nomes) order by t.quantos desc, t.texto)
      from (select min(q.especialidade_saude_outro) as texto, count(*) as quantos,
                   jsonb_agg(q.nome order by q.nome) as nomes
              from public.equipantes q
             where q.especialidade_saude = 'Outro' and nullif(btrim(coalesce(q.especialidade_saude_outro, '')), '') is not null
             group by lower(public.unaccent_simples(q.especialidade_saude_outro))) t), '[]'::jsonb));
end;
$$;
revoke all on function public.especialidades_saude_outros() from public, anon;
grant execute on function public.especialidades_saude_outros() to authenticated;

-- Tornar fixa uma resposta do "Outro" (so organizador) ------------------------------
create or replace function public.tornar_especialidade_fixa(p_texto text, p_nome text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_nome text := regexp_replace(btrim(coalesce(nullif(btrim(coalesce(p_nome, '')), ''), p_texto, '')), '\s+', ' ', 'g');
  v_n int;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores.');
  end if;
  if length(v_nome) < 2 or length(v_nome) > 80 or v_nome ~ '[0-9]' then
    return jsonb_build_object('ok', false, 'erro', 'Nome da especialidade inválido.');
  end if;
  if lower(v_nome) = 'outro' then
    return jsonb_build_object('ok', false, 'erro', '"Outro" já existe.');
  end if;
  v_nome := upper(left(v_nome, 1)) || substr(v_nome, 2);
  insert into public.especialidades_saude (nome, ordem, criado_por)
  values (v_nome, (select coalesce(max(ordem), 60) + 10 from public.especialidades_saude where nome <> 'Outro'),
          public._nome_organizador_logado())
  on conflict (nome) do update set ativo = true;
  update public.equipantes q
     set especialidade_saude = v_nome, especialidade_saude_outro = null
   where q.especialidade_saude = 'Outro'
     and lower(public.unaccent_simples(btrim(q.especialidade_saude_outro))) = lower(public.unaccent_simples(btrim(p_texto)));
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'nome', v_nome, 'pessoas', v_n);
end;
$$;
revoke all on function public.tornar_especialidade_fixa(text, text) from public, anon;
grant execute on function public.tornar_especialidade_fixa(text, text) to authenticated;
