-- Gerenciar a lista de especialidades da Saude (24/10/2026, pedido do Patrick).
--
-- Quadro "Especialidades da lista" no fim da aba "Equipe da Saude": a Vera
-- (apoio da saude) e os organizadores ADICIONAM, RENOMEIAM e EXCLUEM opcoes
-- da tabela especialidades_saude. As opcoes valem na hora para a inscricao,
-- o completar cadastro e o lapis da tela da Saude (especialidades_saude_opcoes).
--   * Renomear: quem tinha a especialidade (principal ou adicional) passa junto
--     para o nome novo.
--   * Excluir: sem ninguem vinculado, exclui direto. Com gente vinculada, a
--     primeira chamada (p_confirmar = false) so devolve QUEM perde o vinculo;
--     a tela mostra e pergunta; a segunda (p_confirmar = true) exclui. Quem
--     tinha a excluida como principal fica com a 1a adicional como principal
--     (ou sem especialidade -- e a pendencia volta para quem esta na Saude).
--   * "Outro" e fixa: nao renomeia nem exclui.
-- O "Tornar fixa" do quadro do Outro segue so de organizador.

-- Nome valido (normalizado) ou erro -------------------------------------------------
create or replace function public._especialidade_saude_nome(p_nome text)
returns text language plpgsql immutable set search_path = public as $$
declare
  v text := regexp_replace(btrim(coalesce(p_nome, '')), '\s+', ' ', 'g');
begin
  if length(v) < 2 then raise exception 'ESPECIALIDADE: Escreva o nome da especialidade.'; end if;
  if length(v) > 80 then raise exception 'ESPECIALIDADE: Nome muito longo (até 80 letras).'; end if;
  if v ~ '[0-9]' then raise exception 'ESPECIALIDADE: Escreva o nome só com letras.'; end if;
  if lower(v) = 'outro' then raise exception 'ESPECIALIDADE: "Outro" já existe e é fixo.'; end if;
  return upper(left(v, 1)) || substr(v, 2);
end;
$$;
revoke all on function public._especialidade_saude_nome(text) from public, anon, authenticated;

-- Lista para o quadro (com quantas pessoas tem cada uma) ----------------------------
create or replace function public.especialidades_saude_gerenciar()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.eh_apoio('saude') or public.eh_organizador()) then
    return jsonb_build_object('ok', false, 'erro', 'Acesso não autorizado.');
  end if;
  return jsonb_build_object('ok', true, 'lista', coalesce((
    select jsonb_agg(jsonb_build_object(
             'nome', s.nome, 'ativo', s.ativo, 'criado_por', s.criado_por,
             'pessoas', (select count(*) from public.equipantes q
                          where q.especialidade_saude = s.nome or s.nome = any(q.especialidades_saude_adicionais)))
           order by s.ordem, s.nome)
      from public.especialidades_saude s
     where s.nome <> 'Outro'), '[]'::jsonb));
end;
$$;
revoke all on function public.especialidades_saude_gerenciar() from public, anon;
grant execute on function public.especialidades_saude_gerenciar() to authenticated;

-- Adicionar ---------------------------------------------------------------------------
create or replace function public.especialidade_saude_adicionar(p_nome text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_nome text;
  v_existe text;
begin
  if not (public.eh_apoio('saude') or public.eh_organizador()) then
    return jsonb_build_object('ok', false, 'erro', 'Acesso não autorizado.');
  end if;
  begin
    v_nome := public._especialidade_saude_nome(p_nome);
  exception when raise_exception then
    return jsonb_build_object('ok', false, 'erro', replace(sqlerrm, 'ESPECIALIDADE: ', ''));
  end;
  select nome into v_existe from public.especialidades_saude
   where lower(public.unaccent_simples(nome)) = lower(public.unaccent_simples(v_nome)) limit 1;
  if v_existe is not null then
    update public.especialidades_saude set ativo = true where nome = v_existe and not ativo;
    if found then
      return jsonb_build_object('ok', true, 'nome', v_existe, 'reativada', true);
    end if;
    return jsonb_build_object('ok', false, 'erro', format('“%s” já está na lista.', v_existe));
  end if;
  insert into public.especialidades_saude (nome, ordem, criado_por)
  values (v_nome, (select coalesce(max(ordem), 60) + 10 from public.especialidades_saude where nome <> 'Outro'),
          coalesce(public._nome_organizador_logado(), case when public.eh_apoio('saude') then 'Apoio da saúde' end));
  return jsonb_build_object('ok', true, 'nome', v_nome);
end;
$$;
revoke all on function public.especialidade_saude_adicionar(text) from public, anon;
grant execute on function public.especialidade_saude_adicionar(text) to authenticated;

-- Renomear (quem tem a especialidade vai junto) -------------------------------------
create or replace function public.especialidade_saude_renomear(p_nome text, p_novo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_antigo text := btrim(coalesce(p_nome, ''));
  v_novo text;
  v_n int;
begin
  if not (public.eh_apoio('saude') or public.eh_organizador()) then
    return jsonb_build_object('ok', false, 'erro', 'Acesso não autorizado.');
  end if;
  if v_antigo = 'Outro' then
    return jsonb_build_object('ok', false, 'erro', '"Outro" é fixo e não pode ser renomeado.');
  end if;
  perform 1 from public.especialidades_saude where nome = v_antigo for update;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Especialidade não encontrada. Recarregue a tela.');
  end if;
  begin
    v_novo := public._especialidade_saude_nome(p_novo);
  exception when raise_exception then
    return jsonb_build_object('ok', false, 'erro', replace(sqlerrm, 'ESPECIALIDADE: ', ''));
  end;
  if v_novo = v_antigo then
    return jsonb_build_object('ok', true, 'nome', v_novo, 'pessoas', 0);
  end if;
  if exists (select 1 from public.especialidades_saude
              where nome <> v_antigo and lower(public.unaccent_simples(nome)) = lower(public.unaccent_simples(v_novo))) then
    return jsonb_build_object('ok', false, 'erro', format('Já existe “%s” na lista.', v_novo));
  end if;

  -- Primeiro a lista (o gatilho dos equipantes confere o nome novo nela).
  update public.especialidades_saude set nome = v_novo where nome = v_antigo;
  update public.equipantes q
     set especialidade_saude = case when q.especialidade_saude = v_antigo then v_novo else q.especialidade_saude end,
         especialidades_saude_adicionais = array_replace(q.especialidades_saude_adicionais, v_antigo, v_novo)
   where q.especialidade_saude = v_antigo or v_antigo = any(q.especialidades_saude_adicionais);
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'nome', v_novo, 'pessoas', v_n);
end;
$$;
revoke all on function public.especialidade_saude_renomear(text, text) from public, anon;
grant execute on function public.especialidade_saude_renomear(text, text) to authenticated;

-- Excluir (com gente vinculada, pede confirmacao mostrando quem) -------------------
create or replace function public.especialidade_saude_excluir(p_nome text, p_confirmar boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_nome text := btrim(coalesce(p_nome, ''));
  v_pessoas jsonb;
  v_n int;
begin
  if not (public.eh_apoio('saude') or public.eh_organizador()) then
    return jsonb_build_object('ok', false, 'erro', 'Acesso não autorizado.');
  end if;
  if v_nome = 'Outro' then
    return jsonb_build_object('ok', false, 'erro', '"Outro" é fixo e não pode ser excluído.');
  end if;
  perform 1 from public.especialidades_saude where nome = v_nome for update;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Especialidade não encontrada. Recarregue a tela.');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'nome', q.nome,
           'principal', q.especialidade_saude = v_nome,
           'na_saude', exists (select 1 from public.escalas s
                                where s.equipante_id = q.id and s.area_alocada = 'Primeiros socorros - Saúde'))
         order by q.nome), '[]'::jsonb)
    into v_pessoas
    from public.equipantes q
   where q.especialidade_saude = v_nome or v_nome = any(q.especialidades_saude_adicionais);

  if jsonb_array_length(v_pessoas) > 0 and not coalesce(p_confirmar, false) then
    return jsonb_build_object('ok', true, 'precisa_confirmar', true, 'nome', v_nome, 'pessoas', v_pessoas);
  end if;

  -- Tira o vinculo ANTES de apagar da lista (o gatilho confere as que sobram).
  -- Principal excluida: a 1a adicional que sobrar vira a principal.
  update public.equipantes q
     set especialidade_saude = case when q.especialidade_saude = v_nome
                                    then (array_remove(q.especialidades_saude_adicionais, v_nome))[1]
                                    else q.especialidade_saude end,
         especialidades_saude_adicionais = nullif(array_remove(q.especialidades_saude_adicionais, v_nome), '{}')
   where q.especialidade_saude = v_nome or v_nome = any(q.especialidades_saude_adicionais);
  get diagnostics v_n = row_count;
  delete from public.especialidades_saude where nome = v_nome;
  return jsonb_build_object('ok', true, 'excluida', true, 'nome', v_nome, 'pessoas', v_n);
end;
$$;
revoke all on function public.especialidade_saude_excluir(text, boolean) from public, anon;
grant execute on function public.especialidade_saude_excluir(text, boolean) to authenticated;
