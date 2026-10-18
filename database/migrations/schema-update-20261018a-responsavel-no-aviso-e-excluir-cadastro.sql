-- 18/10/2026 (Patrick):
--  1) O aviso da escala provisoria passa a dizer COM QUEM confirmar a presenca
--     quando a equipe da pessoa ja tem responsavel pela reuniao definido.
--     revelar_area e situacao_inscricao devolvem 'responsaveis' (nomes).
--  2) Excluir cadastro (duplicados): buscar, ver TUDO da pessoa e excluir com
--     confirmacao. So Desenvolvedores, Raquel e Dudu (_gere_escala). Quem ja
--     pagou nao sai (desfaz o pagamento antes). Antes de apagar, a ficha
--     inteira (e o que estava ligado a ela) vai para exclusoes_cadastro.

-- ------------------------------------------------------------ 1) responsavel
-- Responsaveis pela reuniao das equipes da pessoa (fora ela mesma e fora as
-- equipes em que ela e a lider). Marcador -> Invisivel; Perseguidos -> Selva.
create or replace function public._responsaveis_da_pessoa(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(distinct q.nome), '[]'::jsonb)
    from public.escalas s
    join public.responsaveis_reuniao r
      on r.area = case s.area_alocada when 'Marcador' then 'Invisível'
                                      when 'Perseguidos' then 'Selva'
                                      else s.area_alocada end
     and (r.cor is null or r.cor is not distinct from s.cor)
    join public.equipantes q on q.id = r.equipante_id
   where s.equipante_id = p_id
     and s.area_alocada <> 'Não será escalado'
     and r.equipante_id <> p_id
     and not public._eh_lider(s.area_alocada, s.atuacao);
$$;
revoke all on function public._responsaveis_da_pessoa(uuid) from public, anon, authenticated;

do $mig$
declare
  v text;
begin
  v := pg_get_functiondef('public.revelar_area(uuid,text,text,date)'::regprocedure);
  if position($a$    'nao_sera_escalado', false,$a$ in v) = 0 then raise exception 'revelar_area: trecho nao encontrado'; end if;
  v := replace(v, $a$    'nao_sera_escalado', false,$a$,
                  $b$    'nao_sera_escalado', false,
    'responsaveis', public._responsaveis_da_pessoa(p_id),$b$);
  execute v;

  v := pg_get_functiondef('public.situacao_inscricao(text,uuid,text,text,date)'::regprocedure);
  if position($a$    'reuniao_com', case$a$ in v) = 0 then raise exception 'situacao_inscricao: trecho nao encontrado'; end if;
  v := replace(v, $a$    'reuniao_com', case$a$,
                  $b$    'responsaveis_reuniao', case when v_lancada is not null
                                   and (select area_vista_em is not null from public.equipantes where id = p_id)
                                 then public._responsaveis_da_pessoa(p_id) else '[]'::jsonb end,
    'reuniao_com', case$b$);
  execute v;
end
$mig$;

-- ------------------------------------------------------------ 2) excluir
create table if not exists public.exclusoes_cadastro (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  inscricao_id uuid not null,
  nome text,
  cpf text,
  motivo text,
  excluido_por text,
  excluido_em timestamptz not null default now(),
  ficha jsonb not null
);
alter table public.exclusoes_cadastro enable row level security;
revoke all on public.exclusoes_cadastro from anon, authenticated;

-- Tudo da pessoa: a ficha inteira e o que esta ligado a ela.
create or replace function public.ficha_para_exclusao(p_tipo text, p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_ficha jsonb;
  v_nome text;
  v_cpf text;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores.');
  end if;
  if p_tipo = 'equipante' then
    select to_jsonb(e), e.nome, regexp_replace(coalesce(e.cpf, ''), '\D', '', 'g')
      into v_ficha, v_nome, v_cpf from public.equipantes e where e.id = p_id;
  elsif p_tipo = 'acampante' then
    select to_jsonb(a), a.nome, regexp_replace(coalesce(a.cpf, ''), '\D', '', 'g')
      into v_ficha, v_nome, v_cpf from public.acampantes a where a.id = p_id;
  else
    return jsonb_build_object('ok', false, 'erro', 'Tipo inválido.');
  end if;
  if v_ficha is null then
    return jsonb_build_object('ok', false, 'erro', 'Cadastro não encontrado.');
  end if;

  return jsonb_build_object('ok', true, 'tipo', p_tipo, 'id', p_id, 'ficha', v_ficha,
    'pago', lower(coalesce(v_ficha->>'status_pagamento', '')) in ('pago', 'confirmado', 'completed'),
    'escalas', (select coalesce(jsonb_agg(jsonb_build_object('area', s.area_alocada, 'atuacao', s.atuacao, 'cor', s.cor,
                                  'incluido_por', s.incluido_por, 'desde', s.created_at) order by s.created_at), '[]'::jsonb)
                  from public.escalas s where p_tipo = 'equipante' and s.equipante_id = p_id),
    'areas_fixas', (select coalesce(jsonb_agg(f.area), '[]'::jsonb)
                      from public.equipantes_areas_fixas f where p_tipo = 'equipante' and f.equipante_id = p_id),
    'responsavel_reuniao_de', (select coalesce(jsonb_agg(r.area || coalesce(' · ' || r.cor, '')), '[]'::jsonb)
                                 from public.responsaveis_reuniao r where p_tipo = 'equipante' and r.equipante_id = p_id),
    'lider_area_extra', (select coalesce(jsonb_agg(x.area), '[]'::jsonb)
                           from public.lideres_area_extra x where p_tipo = 'equipante' and x.equipante_id = p_id),
    'areas_extras', (select coalesce(jsonb_agg(jsonb_build_object('area', d.area, 'aprovado', d.aprovado)), '[]'::jsonb)
                       from public.disponibilidade_extra d where p_tipo = 'equipante' and d.equipante_id = p_id),
    'pix', (select coalesce(jsonb_agg(jsonb_build_object('valor', x.valor, 'status', x.status, 'criado', x.created_at) order by x.created_at), '[]'::jsonb)
              from public.pix_sicoob x where x.inscricao_id = p_id),
    'pedidos_acesso', (select count(*) from public.pedidos_acesso_cadastro pa where p_tipo = 'equipante' and pa.equipante_id = p_id),
    'vinculos', (select count(*) from public.acampantes_vinculos v
                  where p_tipo = 'acampante' and p_id in (v.acampante_a, v.acampante_b, v.origem_acampante)),
    -- outras fichas parecidas (mesmo CPF ou mesmo nome): para conferir o duplicado
    'parecidos', (select coalesce(jsonb_agg(jsonb_build_object('tipo', x.tipo, 'id', x.id, 'nome', x.nome, 'cpf', x.cpf,
                                    'igreja', x.igreja, 'manual_por', x.manual_por, 'areas', x.areas) order by x.nome), '[]'::jsonb)
                    from (select 'equipante' tipo, e.id, e.nome, e.cpf, e.igreja, e.inscricao_manual_por manual_por,
                                 (select jsonb_agg(s.area_alocada) from public.escalas s where s.equipante_id = e.id) areas
                            from public.equipantes e
                           where e.id <> p_id and coalesce(e.inscrito, false)
                             and ((v_cpf <> '' and regexp_replace(coalesce(e.cpf, ''), '\D', '', 'g') = v_cpf)
                                  or public._nome_comparavel(e.nome) = public._nome_comparavel(v_nome))
                          union all
                          select 'acampante', a.id, a.nome, a.cpf, a.igreja, null, null
                            from public.acampantes a
                           where a.id <> p_id
                             and ((v_cpf <> '' and regexp_replace(coalesce(a.cpf, ''), '\D', '', 'g') = v_cpf)
                                  or public._nome_comparavel(a.nome) = public._nome_comparavel(v_nome))) x),
    'pode_excluir', public._gere_escala());
end;
$$;

-- Busca para o modulo (equipantes e acampantes).
create or replace function public.buscar_cadastros_exclusao(p_termo text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  t text := btrim(coalesce(p_termo, ''));
  d text := regexp_replace(t, '\D', '', 'g');
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores.');
  end if;
  if length(t) < 3 then
    return jsonb_build_object('ok', true, 'itens', '[]'::jsonb);
  end if;
  return jsonb_build_object('ok', true, 'itens', coalesce((
    select jsonb_agg(x order by x->>'nome') from (
      select jsonb_build_object('tipo', 'equipante', 'id', e.id, 'nome', e.nome, 'cpf', e.cpf, 'igreja', e.igreja,
               'igreja_outra', e.igreja_outra, 'status', e.status, 'inscrito', e.inscrito,
               'manual_por', e.inscricao_manual_por, 'pago', lower(coalesce(e.status_pagamento, '')) in ('pago', 'confirmado', 'completed'),
               'areas', (select jsonb_agg(s.area_alocada) from public.escalas s where s.equipante_id = e.id)) x
        from public.equipantes e
       where e.tipo = 'equipante'
         and (public._nome_comparavel(e.nome) like '%' || public._nome_comparavel(t) || '%'
              or (length(d) >= 3 and regexp_replace(coalesce(e.cpf, ''), '\D', '', 'g') like '%' || d || '%'))
      union all
      select jsonb_build_object('tipo', 'acampante', 'id', a.id, 'nome', a.nome, 'cpf', a.cpf, 'igreja', a.igreja,
               'pago', lower(coalesce(a.status_pagamento, '')) in ('pago', 'confirmado', 'completed'))
        from public.acampantes a
       where public._nome_comparavel(a.nome) like '%' || public._nome_comparavel(t) || '%'
          or (length(d) >= 3 and regexp_replace(coalesce(a.cpf, ''), '\D', '', 'g') like '%' || d || '%')
      limit 60) s(x)), '[]'::jsonb));
end;
$$;

-- Exclui de vez. p_confirmacao: o nome completo da pessoa, digitado.
create or replace function public.excluir_cadastro(p_tipo text, p_id uuid, p_confirmacao text, p_motivo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_ficha jsonb;
  v_quem text := public._nome_organizador_logado();
begin
  if not public._gere_escala() then
    return jsonb_build_object('ok', false, 'erro', 'Só Desenvolvedores, Raquel e Dudu excluem cadastros.');
  end if;
  v_ficha := public.ficha_para_exclusao(p_tipo, p_id);
  if not (v_ficha->>'ok')::boolean then
    return v_ficha;
  end if;
  if public._nome_comparavel(coalesce(p_confirmacao, '')) <> public._nome_comparavel(v_ficha->'ficha'->>'nome') then
    return jsonb_build_object('ok', false, 'erro', 'Para confirmar, digite o nome completo exatamente como está na ficha.');
  end if;
  if length(btrim(coalesce(p_motivo, ''))) < 3 then
    return jsonb_build_object('ok', false, 'erro', 'Escreva o motivo da exclusão.');
  end if;
  if (v_ficha->>'pago')::boolean then
    return jsonb_build_object('ok', false, 'erro',
      'Este cadastro já tem pagamento confirmado. Desfaça o pagamento em Pagamentos antes de excluir.');
  end if;

  insert into public.exclusoes_cadastro (tipo, inscricao_id, nome, cpf, motivo, excluido_por, ficha)
  values (p_tipo, p_id, v_ficha->'ficha'->>'nome', v_ficha->'ficha'->>'cpf', btrim(p_motivo), v_quem, v_ficha);

  -- o que nao apaga sozinho junto com a ficha
  delete from public.pix_sicoob where inscricao_id = p_id;
  if p_tipo = 'equipante' then
    delete from public.pagamentos where equipante_id = p_id;
    delete from public.pedidos_acesso_cadastro where equipante_id = p_id;
    delete from public.equipantes where id = p_id;
  else
    delete from public.pagamentos where acampante_id = p_id;
    delete from public.acampantes_vinculos where p_id in (acampante_a, acampante_b, origem_acampante);
    delete from public.acampantes where id = p_id;
  end if;

  return jsonb_build_object('ok', true, 'nome', v_ficha->'ficha'->>'nome');
end;
$$;

revoke all on function public.ficha_para_exclusao(text, uuid) from public, anon;
grant execute on function public.ficha_para_exclusao(text, uuid) to authenticated;
revoke all on function public.buscar_cadastros_exclusao(text) from public, anon;
grant execute on function public.buscar_cadastros_exclusao(text) to authenticated;
revoke all on function public.excluir_cadastro(text, uuid, text, text) from public, anon;
grant execute on function public.excluir_cadastro(text, uuid, text, text) to authenticated;
