-- Acampante so uma vez (04/11/2026, Patrick)
--
-- Quem ficou PRESENTE na recepcao dos acampantes nao se inscreve de novo como
-- acampante. Ausente (inscrito sem presenca na recepcao) e desistente ficam
-- de fora: podem se inscrever de novo. Vale a partir da 37a edicao; as
-- anteriores sao ignoradas.
--
--  * Guarda so a "impressao digital" do CPF (HMAC-SHA256 com um segredo que
--    so o banco le): nao da para voltar ao CPF nem ao nome (LGPD).
--  * A virada grava os presentes ANTES de apagar acampantes e presencas.
--  * criar_inscricao recusa (JA_FOI_ACAMPANTE); a tela avisa ja no CPF
--    (acampante_ja_participou).
--  * Desenvolvedores liberam um CPF com motivo obrigatorio; a liberacao fica
--    registrada (quem, quando, motivo) e pode ser desfeita. Participar de
--    novo bloqueia de novo.

create table if not exists public.acampantes_segredo_cpf (
  id      boolean primary key default true check (id),
  segredo text not null
);
alter table public.acampantes_segredo_cpf enable row level security;
revoke all on public.acampantes_segredo_cpf from public, anon, authenticated;
insert into public.acampantes_segredo_cpf (segredo)
  values (encode(extensions.gen_random_bytes(32), 'hex'))
  on conflict (id) do nothing;

create table if not exists public.acampantes_ja_participaram (
  id               bigint generated always as identity primary key,
  impressao        text not null unique,
  edicao           int not null,
  registrado_em    timestamptz not null default now(),
  liberado_em      timestamptz,
  liberado_por     text,
  liberado_motivo  text
);
alter table public.acampantes_ja_participaram enable row level security;
revoke all on public.acampantes_ja_participaram from public, anon, authenticated;

-- Impressao digital do CPF (so digitos). Nulo se nao tem 11 digitos.
create or replace function public._impressao_cpf_acampante(p_cpf text)
returns text language sql stable security definer
set search_path to 'public', 'extensions' as $$
  select case when length(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g')) = 11 then
    encode(extensions.hmac(regexp_replace(p_cpf, '\D', '', 'g'),
                           (select s.segredo from public.acampantes_segredo_cpf s), 'sha256'), 'hex')
  end;
$$;
revoke all on function public._impressao_cpf_acampante(text) from public, anon, authenticated;

create or replace function public._acampante_bloqueado(p_cpf text)
returns boolean language sql stable security definer
set search_path to 'public' as $$
  select exists (select 1 from public.acampantes_ja_participaram j
                  where j.impressao = public._impressao_cpf_acampante(p_cpf)
                    and j.liberado_em is null);
$$;
revoke all on function public._acampante_bloqueado(text) from public, anon, authenticated;

-- Grava os presentes da recepcao (chamado pela virada). Devolve quantos.
create or replace function public._registrar_acampantes_presentes(p_edicao int)
returns int language plpgsql security definer
set search_path to 'public' as $$
declare v_n int;
begin
  insert into public.acampantes_ja_participaram (impressao, edicao)
  select distinct public._impressao_cpf_acampante(a.cpf), p_edicao
    from public.recepcao_presencas rp
    join public.acampantes a on a.id = rp.acampante_id
   where rp.acampante_id is not null
     and public._impressao_cpf_acampante(a.cpf) is not null
  on conflict (impressao) do update
     set edicao = excluded.edicao, registrado_em = now(),
         liberado_em = null, liberado_por = null, liberado_motivo = null;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke all on function public._registrar_acampantes_presentes(int) from public, anon, authenticated;

-- Tela do acampante: so diz sim/nao.
create or replace function public.acampante_ja_participou(p_cpf text)
returns jsonb language sql stable security definer
set search_path to 'public' as $$
  select jsonb_build_object('bloqueado', public._acampante_bloqueado(p_cpf));
$$;
revoke all on function public.acampante_ja_participou(text) from public;
grant execute on function public.acampante_ja_participou(text) to anon, authenticated;

-- Desenvolvedores: liberar um CPF.
create or replace function public.liberar_cpf_acampante(p_cpf text, p_motivo text)
returns jsonb language plpgsql security definer
set search_path to 'public' as $$
declare
  v_imp    text := public._impressao_cpf_acampante(p_cpf);
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_n      int;
begin
  if not public.eh_organizador_maximo() then
    return jsonb_build_object('ok', false, 'erro', 'Só a conta Desenvolvedores libera CPF.');
  end if;
  if v_imp is null or not public._cpf_valido(p_cpf) then
    return jsonb_build_object('ok', false, 'erro', 'CPF inválido.');
  end if;
  if v_motivo is null or length(v_motivo) < 5 then
    return jsonb_build_object('ok', false, 'erro', 'Escreva o motivo da liberação.');
  end if;
  if length(v_motivo) > 300 then
    return jsonb_build_object('ok', false, 'erro', 'Motivo com mais de 300 caracteres.');
  end if;
  update public.acampantes_ja_participaram
     set liberado_em = now(), liberado_por = 'Desenvolvedores', liberado_motivo = v_motivo
   where impressao = v_imp and liberado_em is null;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    if exists (select 1 from public.acampantes_ja_participaram where impressao = v_imp) then
      return jsonb_build_object('ok', false, 'erro', 'Esse CPF já está liberado.');
    end if;
    return jsonb_build_object('ok', false, 'erro',
      'Esse CPF não está na lista de quem já foi acampante (a partir da 37ª edição).');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.liberar_cpf_acampante(text, text) from public, anon;
grant execute on function public.liberar_cpf_acampante(text, text) to authenticated;

create or replace function public.desfazer_liberacao_acampante(p_id bigint)
returns jsonb language plpgsql security definer
set search_path to 'public' as $$
declare v_n int;
begin
  if not public.eh_organizador_maximo() then
    return jsonb_build_object('ok', false, 'erro', 'Só a conta Desenvolvedores mexe nas liberações.');
  end if;
  update public.acampantes_ja_participaram
     set liberado_em = null, liberado_por = null, liberado_motivo = null
   where id = p_id and liberado_em is not null;
  get diagnostics v_n = row_count;
  if v_n = 0 then return jsonb_build_object('ok', false, 'erro', 'Essa liberação não existe mais.'); end if;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.desfazer_liberacao_acampante(bigint) from public, anon;
grant execute on function public.desfazer_liberacao_acampante(bigint) to authenticated;

-- Resumo para Configuracoes: quantos por edicao + as liberacoes.
create or replace function public.acampantes_bloqueio_resumo()
returns jsonb language plpgsql stable security definer
set search_path to 'public' as $$
begin
  if not public.eh_organizador_maximo() then
    return jsonb_build_object('ok', false, 'erro', 'Só a conta Desenvolvedores.');
  end if;
  return jsonb_build_object('ok', true,
    'por_edicao', coalesce((select jsonb_agg(jsonb_build_object('edicao', x.edicao, 'bloqueados', x.n) order by x.edicao)
                              from (select edicao, count(*) n from public.acampantes_ja_participaram
                                     where liberado_em is null group by edicao) x), '[]'::jsonb),
    'liberados', coalesce((select jsonb_agg(jsonb_build_object('id', j.id, 'edicao', j.edicao,
                              'liberado_em', j.liberado_em, 'liberado_por', j.liberado_por,
                              'motivo', j.liberado_motivo) order by j.liberado_em desc)
                             from public.acampantes_ja_participaram j where j.liberado_em is not null), '[]'::jsonb));
end;
$$;
revoke all on function public.acampantes_bloqueio_resumo() from public, anon;
grant execute on function public.acampantes_bloqueio_resumo() to authenticated;

-- criar_inscricao: acampante que ja participou nao entra.
do $$
declare
  v_def  text := pg_get_functiondef('public.criar_inscricao(text,jsonb,text)'::regprocedure);
  v_alvo text := '  v_a := jsonb_populate_record(null::public.acampantes, p_dados);';
  v_novo text;
begin
  if (length(v_def) - length(replace(v_def, v_alvo, ''))) / length(v_alvo) <> 1 then
    raise exception 'trecho não encontrado (ou repetido) em criar_inscricao';
  end if;
  v_novo := replace(v_def, v_alvo,
    E'  -- Acampante so uma vez (20261104b).\n'
    || E'  if public._acampante_bloqueado(p_dados ->> ''cpf'') then\n'
    || E'    raise exception ''JA_FOI_ACAMPANTE'';\n'
    || E'  end if;\n\n'
    || v_alvo);
  execute v_novo;
end;
$$;

-- Virada: grava os presentes antes de apagar presencas e acampantes.
do $$
declare
  v_def  text := pg_get_functiondef(
    'public.resetar_para_nova_edicao(integer,date,date,date,date,date)'::regprocedure);
  v_alvo text := '  on conflict (equipante_id, edicao) do nothing;';
  v_novo text;
begin
  if (length(v_def) - length(replace(v_def, v_alvo, ''))) / length(v_alvo) <> 1 then
    raise exception 'trecho não encontrado (ou repetido) em resetar_para_nova_edicao';
  end if;
  if position('recepcao_presencas' in v_def) < position(v_alvo in v_def) then
    raise exception 'as presencas sao apagadas antes do ponto de gravacao';
  end if;
  v_novo := replace(v_def, v_alvo,
    v_alvo || E'\n\n'
    || E'  -- Acampante so uma vez (20261104b): presentes na recepcao.\n'
    || E'  perform public._registrar_acampantes_presentes(coalesce(v_edicao_ant, 0));');
  execute v_novo;
end;
$$;
