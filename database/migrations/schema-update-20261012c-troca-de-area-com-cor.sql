-- ---------------------------------------------------------------------------
-- Troca de area com a cor do grupo (Patrick, 12/10/2026).
--
-- O PROBLEMA: quem mudava de area levava junto a cor da area antiga, se a
-- nova tambem usasse cor. Um substituto vindo da Fotografia (Azul) virava
-- infiltrado ja no grupo Azul sem ninguem escolher -- e entrava nos grupos de
-- trilha e nos onibus no lugar errado.
--
-- O CONSERTO:
--  1. realocar_alocacao (o "Realocar" da grade e a volta de ausentes) nao
--     carrega mais a cor: mudou de area, a cor zera. Nas areas com cor ela
--     e escolhida de novo na coluna Cor (os grupos avisam infiltrado sem cor).
--  2. trocar_area_escala ("Trocar de área", pos-lancamento) recebe a cor junto
--     -- a janela pede a cor quando o destino usa cor. Para Infiltrados a cor e
--     obrigatoria: o infiltrado entra direto no grupo certo, num passo so.
-- ---------------------------------------------------------------------------

create or replace function pg_temp._patch(p regprocedure, de text, para text, vezes int)
returns void language plpgsql as $p$
declare d text := pg_get_functiondef(p); n int;
begin
  n := (length(d) - length(replace(d, de, ''))) / length(de);
  if n <> vezes then
    raise exception 'patch em %: esperava % ocorrencia(s) de [%], achei %', p, vezes, de, n;
  end if;
  execute replace(d, de, para);
end;
$p$;

-- 1.
select pg_temp._patch(
  'public.realocar_alocacao(uuid,text)'::regprocedure,
  'cor = case when public._area_com_cor(v_nova) then cor else null end',
  'cor = null',
  1);

-- 2.
drop function if exists public.trocar_area_escala(uuid, text);

create or replace function public.trocar_area_escala(p_escala_id uuid, p_nova_area text, p_cor text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r      jsonb;
  v_nova text := public._area_canonica(p_nova_area);
  v_cor  text := nullif(btrim(coalesce(p_cor, '')), '');
begin
  if not public._gere_escala() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas Desenvolvedores, Raquel e Dudu.');
  end if;
  if (select escala_lancada_em from public.configuracoes limit 1) is null then
    return jsonb_build_object('ok', false, 'erro',
      'A troca de área abre depois que a escala provisória for lançada.');
  end if;
  if v_cor is not null and v_cor not in ('Amarelo', 'Azul', 'Roxo', 'Verde', 'Vermelho') then
    return jsonb_build_object('ok', false, 'erro', format('"%s" não é uma cor de grupo.', v_cor));
  end if;
  if v_nova = 'Infiltrados' and v_cor is null then
    return jsonb_build_object('ok', false, 'erro',
      'Escolha a cor do grupo em que o infiltrado vai entrar.');
  end if;

  r := public.realocar_alocacao(p_escala_id, p_nova_area);
  if (r->>'ok')::boolean then
    update public.escalas
       set incluido_por = 'Troca: ' || public._nome_organizador_logado(),
           separado_de = case when area_alocada = 'Não será escalado' then separado_de end,
           separado_em = case when area_alocada = 'Não será escalado' then separado_em end,
           cor = case when public._area_com_cor(area_alocada) then v_cor end
     where id = p_escala_id;
    r := r || jsonb_build_object('cor',
      (select cor from public.escalas where id = p_escala_id));
  end if;
  return r;
end;
$function$;

revoke all on function public.trocar_area_escala(uuid, text, text) from public, anon;
grant execute on function public.trocar_area_escala(uuid, text, text) to authenticated;
