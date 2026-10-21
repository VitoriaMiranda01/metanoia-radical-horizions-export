-- 21/10/2026 (Patrick): quadro da chamada dinamico.
--
-- O quadro "Chamada da reuniao de escala" so tinha os numeros (presentes /
-- ausentes / sem chamada) -- nao dava para saber QUEM estava sem chamada sem
-- abrir area por area. chamada_por_situacao devolve a lista de uma situacao,
-- por PARTICIPACAO (quem esta em duas areas aparece duas vezes), com as mesmas
-- regras da conta de situacao_escala: tudo menos "Nao sera escalado".
--   p_situacao: 'presentes' | 'ausentes' | 'sem'
-- So le; a marcacao continua por organizador_marcar_presenca.

create or replace function public.chamada_por_situacao(p_situacao text)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $fn$
begin
  if not public._gere_escala() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas Desenvolvedores, Raquel e Dudu.');
  end if;
  if p_situacao is null or p_situacao not in ('presentes', 'ausentes', 'sem') then
    return jsonb_build_object('ok', false, 'erro', 'Situação inválida.');
  end if;

  return jsonb_build_object('ok', true,
    'situacao', p_situacao,
    'pessoas', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'escala_id', s.id, 'equipante_id', q.id, 'nome', q.nome,
               'whatsapp', q.whatsapp, 'igreja', q.igreja, 'igreja_outra', q.igreja_outra,
               'area', s.area_alocada, 'cor', s.cor, 'atuacao', s.atuacao,
               'eh_lider', public._eh_lider(s.area_alocada, s.atuacao),
               'pago', lower(coalesce(q.status_pagamento,'')) in ('pago','confirmado','completed'),
               'presente', c.presente, 'marcado_por', c.marcado_por, 'marcado_em', c.marcado_em,
               'mantido', c.mantido_em is not null)
             order by s.area_alocada, q.nome), '[]'::jsonb)
        from public.escalas s
        join public.equipantes q on q.id = s.equipante_id
        left join public.chamada_escala c on c.escala_id = s.id and c.area = s.area_alocada
       where s.area_alocada <> 'Não será escalado'
         and case p_situacao
               when 'presentes' then c.presente is true
               when 'ausentes'  then c.presente is false
               else c.escala_id is null
             end));
end;
$fn$;

revoke all on function public.chamada_por_situacao(text) from public, anon;
grant execute on function public.chamada_por_situacao(text) to authenticated;
