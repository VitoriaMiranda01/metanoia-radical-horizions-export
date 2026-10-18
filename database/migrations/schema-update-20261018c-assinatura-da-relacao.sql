-- Relacao do lider leve para o dia da Leitura de Escala (~1000 acessos), 18/10/2026.
--
-- Antes: o celular do lider baixava a lista INTEIRA (50-70 KB) a cada 15 s (4 s
-- nas equipes com dois responsaveis), mudasse algo ou nao. Agora o celular
-- pergunta so a ASSINATURA (um md5 de 32 letras) do estado das suas equipes; a
-- lista inteira so vem quando a assinatura muda (ou a cada 60 s, por garantia).
--
-- _assinatura_relacao(p_id): membros (linha, area, atuacao, cor), chamada
-- (presente, convite), link do grupo, responsaveis e as areas extras. A
-- pertenca a equipe e escrita direto (sem chamar _na_equipe_de por linha) para
-- usar o indice de escalas por area.

create or replace function public._assinatura_relacao(p_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select md5(coalesce((
    select string_agg(t.area || '|' || coalesce(t.cor, '') || ':' || t.estado, ';' order by t.area, t.cor)
      from (
        select e.area, e.cor,
               coalesce((select string_agg(s.id::text || ',' || s.area_alocada || ',' || coalesce(s.atuacao, '') || ','
                                           || coalesce(s.cor, '') || ',' || coalesce(c.presente::text, '-') || ','
                                           || coalesce(c.convite_enviado_em::text, '-'), '/' order by s.id)
                           from public.escalas s
                           left join public.chamada_escala c on c.escala_id = s.id
                          where (s.area_alocada = e.area
                                 or (e.area = 'Invisível' and s.area_alocada = 'Marcador')
                                 or (e.area = 'Selva' and s.area_alocada = 'Perseguidos'))
                            and (not public._area_com_cor(e.area) or e.cor is null or s.cor is null or s.cor = e.cor)), '')
               || '#' || coalesce((select g.link from public.grupos_lider g where g.escala_id = e.chave_grupo), '')
               || '#' || coalesce((select string_agg(r.equipante_id::text, ',' order by r.equipante_id)
                                     from public.responsaveis_reuniao r
                                    where r.area = e.area and r.cor is not distinct from e.cor), '') as estado
          from public._equipes_do(p_id) e
      ) t), '')
    || '@' || coalesce((
      select string_agg(d.area || ',' || d.equipante_id::text || ',' || coalesce(d.aprovado::text, '-') || ','
                        || coalesce(d.decidido_por_tipo, ''), '/' order by d.area, d.equipante_id)
        from public.disponibilidade_extra d
       where d.area in (select x.area from public.lideres_area_extra x where x.equipante_id = p_id)), ''));
$$;
revoke all on function public._assinatura_relacao(uuid) from public, anon, authenticated;

create or replace function public.relacao_lider_assinatura(p_id uuid, p_cpf text, p_nome text, p_nascimento date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_auth jsonb := public._lider_autenticado(p_id, p_cpf, p_nome, p_nascimento);
begin
  if not (v_auth->>'ok')::boolean then
    return v_auth;
  end if;
  return jsonb_build_object('ok', true, 'assinatura', public._assinatura_relacao(p_id));
end;
$$;
revoke all on function public.relacao_lider_assinatura(uuid, text, text, date) from public;
grant execute on function public.relacao_lider_assinatura(uuid, text, text, date) to anon, authenticated;

-- A relacao inteira tambem devolve a assinatura (o celular guarda e compara).
do $mig$
declare
  v text;
begin
  v := pg_get_functiondef('public.relacao_lider(uuid,text,text,date)'::regprocedure);
  if position($a$    'lider', v_auth->>'nome',$a$ in v) = 0 then raise exception 'relacao_lider: trecho nao encontrado'; end if;
  v := replace(v, $a$    'lider', v_auth->>'nome',$a$,
                  $b$    'lider', v_auth->>'nome',
    'assinatura', public._assinatura_relacao(p_id),$b$);
  execute v;
end
$mig$;
