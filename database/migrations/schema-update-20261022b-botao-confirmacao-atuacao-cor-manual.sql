-- Botao "Confirmar inscricao" com pendencias + atuacao e cor na inscricao
-- manual (22/10/2026, Patrick).
--
-- 1) _inscricao_concluida passa a exigir a aprovacao da igreja (havia escalado
--    na oficial sem aprovacao).
-- 2) situacao_inscricao devolve:
--    - 'concluida': a mesma regra do servidor (a tela nao recalcula);
--    - 'confirmacao_visivel': o botao aparece a partir do dia seguinte a
--      reuniao de leitura (Configuracoes), ou antes disso se a oficial ja saiu,
--      ou sempre se a data nao estiver preenchida.
-- 3) inscricao_manual_equipante (com a oficial lancada): atuacao obrigatoria
--    quando a area tem mais de uma (com uma so, vai ela); cor obrigatoria nas
--    areas de cor (exceto atuacao sem cor e atuacao de lider).

create or replace function public._inscricao_concluida(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select e.status = 'aprovado'
       and lower(coalesce(e.status_pagamento, '')) in ('pago', 'confirmado', 'completed')
       and case when (select c.escala_oficial_em from public.configuracoes c limit 1) is not null
                then exists (select 1 from public.escalas s
                              where s.equipante_id = p_id and s.area_alocada <> 'Não será escalado')
                     and not exists (select 1 from public.escalas s
                                      where s.equipante_id = p_id and s.area_alocada = 'Não será escalado')
                else coalesce(public._presenca_equipante(p_id), '') = 'presente'
           end
      from public.equipantes e where e.id = p_id and e.tipo = 'equipante'), false);
$$;
revoke all on function public._inscricao_concluida(uuid) from public, anon, authenticated;

do $$
declare
  v_def text := pg_get_functiondef('public.situacao_inscricao(text,uuid,text,text,date)'::regprocedure);
  v_novo text;
begin
  if v_def like '%confirmacao_visivel%' then return; end if;
  v_novo := replace(v_def,
    $a$    'reuniao_leitura_passou', public._reuniao_leitura_passou(),$a$,
    $a$    'reuniao_leitura_passou', public._reuniao_leitura_passou(),
    'concluida', public._inscricao_concluida(p_id),
    'confirmacao_visivel', (v_oficial is not null or public._reuniao_leitura_passou()
                            or (select c.reuniao_leitura_escala_em from public.configuracoes c limit 1) is null),$a$);
  if v_novo = v_def then raise exception 'trecho não encontrado em situacao_inscricao'; end if;
  execute v_novo;
end $$;

do $$
declare
  v_def text := pg_get_functiondef('public.inscricao_manual_equipante(jsonb)'::regprocedure);
  v_novo text;
begin
  if v_def like '%atuacao_oficial%' then return; end if;

  v_novo := replace(v_def,
    $a$  v_aloc    record;
begin$a$,
    $a$  v_aloc    record;
  v_atu     text := nullif(btrim(coalesce(p_dados ->> 'atuacao_oficial', '')), '');
  v_cor     text := nullif(btrim(coalesce(p_dados ->> 'cor_oficial', '')), '');
  v_n_atu   int;
  v_r       jsonb;
begin$a$);
  if v_novo = v_def then raise exception 'trecho não encontrado (declare)'; end if;
  v_def := v_novo;

  v_novo := replace(v_def,
    $a$        'A escala oficial já foi lançada: escolha a área em que a pessoa vai trabalhar.');
    end if;
  end if;$a$,
    $a$        'A escala oficial já foi lançada: escolha a área em que a pessoa vai trabalhar.');
    end if;
    -- Atuacao: com mais de uma na area, o organizador escolhe; com uma so, vai ela.
    select count(*) into v_n_atu from public.atuacoes_areas a where a.area_nome = v_area_of;
    if v_n_atu = 1 then
      select a.atuacao into v_atu from public.atuacoes_areas a where a.area_nome = v_area_of;
    elsif v_n_atu > 1 and (v_atu is null or not exists (
            select 1 from public.atuacoes_areas a where a.area_nome = v_area_of and a.atuacao = v_atu)) then
      return jsonb_build_object('ok', false, 'erro', format('Escolha a atuação da pessoa em %s.', v_area_of));
    elsif v_n_atu = 0 then
      v_atu := null;
    end if;
    -- Cor: so nas areas de cor, e nao para atuacao sem cor ou de lider.
    if public._area_com_cor(v_area_of)
       and not exists (select 1 from public.atuacoes_areas a
                        where a.area_nome = v_area_of and a.atuacao = v_atu and (a.sem_cor or a.eh_lider)) then
      if v_cor is null or v_cor not in ('Amarelo', 'Azul', 'Roxo', 'Verde', 'Vermelho') then
        return jsonb_build_object('ok', false, 'erro', format('Escolha a cor do grupo em %s.', v_area_of));
      end if;
    elsif not public._area_com_cor(v_area_of)
       or exists (select 1 from public.atuacoes_areas a
                   where a.area_nome = v_area_of and a.atuacao = v_atu and a.sem_cor) then
      v_cor := null;
    end if;
  end if;$a$);
  if v_novo = v_def then raise exception 'trecho não encontrado (checagem)'; end if;
  v_def := v_novo;

  v_novo := replace(v_def,
    $a$      raise exception 'Não deu para alocar em %: %', v_area_of, v_aloc.mensagem;
    end if;$a$,
    $a$      raise exception 'Não deu para alocar em %: %', v_area_of, v_aloc.mensagem;
    end if;
    if v_atu is not null then
      v_r := public.definir_atuacao_na_area(v_id, v_area_of, v_atu);
      if not coalesce((v_r ->> 'ok')::boolean, false) then
        raise exception 'Não deu para gravar a atuação: %', v_r ->> 'erro';
      end if;
    end if;
    if v_cor is not null then
      v_r := public.definir_cor_na_area(v_id, v_area_of, v_cor);
      if not coalesce((v_r ->> 'ok')::boolean, false) then
        raise exception 'Não deu para gravar a cor: %', v_r ->> 'erro';
      end if;
    end if;$a$);
  if v_novo = v_def then raise exception 'trecho não encontrado (gravacao)'; end if;
  execute v_novo;
end $$;
