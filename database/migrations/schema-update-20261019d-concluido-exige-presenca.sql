-- Inscricao do equipante so fica CONCLUIDA com pagamento + presenca
-- confirmada na reuniao de escala (19/10/2026, Patrick). Antes bastava pagar:
-- quem pagava antes da chamada via "Inscrição Confirmada!" sem ter
-- confirmado presenca.
--
-- _presenca_equipante(): mesma regra de situacao_inscricao ('presente' |
-- 'ausente' | null), conta so as areas principais (ou a secundaria, se nao
-- houver principal).
--
-- verificar_inscricao ganha 'concluido'. Pago e nao concluido agora recebe
-- id e nome (como quem nao pagou) para entrar no acompanhamento; so quem esta
-- concluido continua sem dado nenhum devolvido. Acampante: concluido = pago.

create or replace function public._presenca_equipante(p_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select case when bool_or(c.presente = false) then 'ausente'
              when count(c.escala_id) > 0 and count(c.escala_id) = count(*)
                   and bool_and(c.presente) then 'presente' end
    from public.escalas s
    left join public.chamada_escala c on c.escala_id = s.id and c.area = s.area_alocada
   where s.equipante_id = p_id and s.area_alocada <> 'Não será escalado'
     and (public._area_principal(s.area_alocada)
          or not exists (select 1 from public.escalas p
                          where p.equipante_id = p_id and public._area_principal(p.area_alocada)));
$$;
revoke all on function public._presenca_equipante(uuid) from public, anon, authenticated;

do $$
declare
  v_def text := pg_get_functiondef('public.verificar_inscricao(text,text,text)'::regprocedure);
  v_novo text;
begin
  if v_def like '%''concluido''%' then return; end if;

  v_novo := replace(v_def,
$a$  if v_pago then
    return jsonb_build_object('existe', true, 'pago', true, 'inscrito', v_inscrito);
  end if;

  return jsonb_build_object(
    'existe', true, 'pago', false,$a$,
$a$  if v_pago and (p_tipo <> 'equipante' or public._presenca_equipante(v_id) = 'presente') then
    return jsonb_build_object('existe', true, 'pago', true, 'concluido', true, 'inscrito', v_inscrito);
  end if;

  return jsonb_build_object(
    'existe', true, 'pago', v_pago, 'concluido', false,$a$);
  if v_novo = v_def then
    raise exception 'trecho não encontrado em verificar_inscricao';
  end if;
  execute v_novo;
end $$;
