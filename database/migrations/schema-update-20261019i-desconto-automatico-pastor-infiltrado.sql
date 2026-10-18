-- Desconto AUTOMATICO de 50% na taxa de alimentacao (19/10/2026, Patrick):
-- pastores (cadastrados como pastor -- _e_pastor) e infiltrados (escalados na
-- area Infiltrados) ja pagam com desconto, sem digitar cupom. Sempre em cima
-- do preco do DIA (_valor_do_lote): o lote muda e o desconto acompanha.
--
-- Como: os descontos automaticos sao os cupons RESTRITOS (so_pastor ou
-- so_infiltrado). O PASTOR ja existia; entra o INFILTRADO (50%). Assim o
-- organizador ve o mesmo cupom ao confirmar pagamento em maos, a tela de
-- Pagamentos mostra quem usou qual, e registrar_pagamento confere igual.
--  * _e_infiltrado(tipo, id): equipante escalado em Infiltrados.
--  * _cupom_para: cupom so_infiltrado so vale para infiltrado.
--  * _desconto_automatico(tipo, id, preco): o MAIOR desconto entre os cupons
--    restritos que valem para a pessoa (so equipante). A Edge Function do PIX
--    usa este (ou o cupom digitado, se for maior).
--  * meu_desconto_automatico(...): para a tela, com prova de dono; devolve o
--    preco oficial do dia, o desconto e o valor final.

alter table public.cupons add column if not exists so_infiltrado boolean not null default false;

create or replace function public._e_infiltrado(p_tipo text, p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_tipo = 'equipante'
     and exists (select 1 from public.escalas s where s.equipante_id = p_id and s.area_alocada = 'Infiltrados');
$$;
revoke all on function public._e_infiltrado(text, uuid) from public, anon, authenticated;

do $$
declare
  v_def text := pg_get_functiondef('public._cupom_para(text,text,uuid,numeric)'::regprocedure);
  v_novo text;
begin
  if v_def like '%so_infiltrado%' then return; end if;
  v_novo := replace(v_def,
$a$  v_desc := case when c.percentual is not null$a$,
$a$  if c.so_infiltrado and not public._e_infiltrado(p_tipo, p_id) then
    return jsonb_build_object('valido', false, 'desconto', 0, 'codigo', c.codigo, 'motivo', 'so_infiltrado');
  end if;
  v_desc := case when c.percentual is not null$a$);
  if v_novo = v_def then raise exception 'trecho não encontrado em _cupom_para'; end if;
  execute v_novo;
end $$;

do $$
declare
  v_def text := pg_get_functiondef('public.registrar_pagamento'::regproc);
  v_novo text;
begin
  if v_def like '%so_infiltrado%' then return; end if;
  v_novo := replace(v_def,
$a$          else format('O cupom %s não existe ou não está ativo.', v_cupom) end);$a$,
$a$          when 'so_infiltrado' then format('O cupom %s é só para infiltrados, e esta pessoa não está escalada em Infiltrados.', v_cupom)
          else format('O cupom %s não existe ou não está ativo.', v_cupom) end);$a$);
  if v_novo = v_def then raise exception 'trecho não encontrado em registrar_pagamento'; end if;
  execute v_novo;
end $$;

insert into public.cupons (codigo, desconto_fixo, ativo, edicao_numero, percentual, so_pastor, so_infiltrado)
select 'INFILTRADO', 0, true, (select max(edicao_numero) from public.configuracoes), 50, false, true
 where not exists (select 1 from public.cupons where upper(codigo) = 'INFILTRADO');

-- { desconto, codigo, percentual, motivo: 'pastor' | 'infiltrado' } ou desconto 0.
create or replace function public._desconto_automatico(p_tipo text, p_id uuid, p_preco numeric)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  c record;
  r jsonb;
  v_melhor jsonb := jsonb_build_object('desconto', 0);
begin
  if p_tipo <> 'equipante' or p_preco is null then return v_melhor; end if;
  for c in select x.codigo, x.so_pastor from public.cupons x
            where x.ativo is true and (x.so_pastor or x.so_infiltrado) loop
    r := public._cupom_para(c.codigo, p_tipo, p_id, p_preco);
    if (r ->> 'valido')::boolean and (r ->> 'desconto')::numeric > (v_melhor ->> 'desconto')::numeric then
      v_melhor := jsonb_build_object('desconto', (r ->> 'desconto')::numeric, 'codigo', r ->> 'codigo',
                                     'percentual', r -> 'percentual',
                                     'motivo', case when c.so_pastor then 'pastor' else 'infiltrado' end);
    end if;
  end loop;
  return v_melhor;
end;
$$;
revoke all on function public._desconto_automatico(text, uuid, numeric) from public, anon, authenticated;
grant execute on function public._desconto_automatico(text, uuid, numeric) to service_role;

-- Para a tela de pagamento (PIX e pagamento em maos), com prova de dono.
create or replace function public.meu_desconto_automatico(p_tipo text, p_id uuid, p_cpf text default null,
                                                          p_nome text default null, p_nascimento date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_preco numeric;
  v_auto jsonb;
begin
  if not public._inscricao_e_sua(p_tipo, p_id, p_cpf, p_nome, p_nascimento) then
    return jsonb_build_object('ok', false);
  end if;
  v_preco := public._valor_do_lote(p_tipo);
  v_auto := public._desconto_automatico(p_tipo, p_id, v_preco);
  return jsonb_build_object('ok', true, 'preco_oficial', v_preco,
    'desconto', (v_auto ->> 'desconto')::numeric,
    'valor_final', greatest(0, coalesce(v_preco, 0) - (v_auto ->> 'desconto')::numeric),
    'codigo', v_auto ->> 'codigo', 'percentual', v_auto -> 'percentual', 'motivo', v_auto ->> 'motivo');
end;
$$;
revoke all on function public.meu_desconto_automatico(text, uuid, text, text, date) from public;
grant execute on function public.meu_desconto_automatico(text, uuid, text, text, date) to anon, authenticated;

-- Confirmar pagamento (organizador): a lista de cupons diz tambem se e cupom
-- so de infiltrado, para a tela ja marcar o desconto automatico.
do $$
declare
  v_def text := pg_get_functiondef('public.cupons_do_pagamento(text,uuid)'::regprocedure);
  v_novo text;
begin
  if v_def like '%so_infiltrado%' then return; end if;
  v_novo := replace(v_def, $a$'so_pastor', c.so_pastor)$a$, $a$'so_pastor', c.so_pastor, 'so_infiltrado', c.so_infiltrado)$a$);
  if v_novo = v_def then raise exception 'trecho não encontrado em cupons_do_pagamento'; end if;
  execute v_novo;
end $$;
