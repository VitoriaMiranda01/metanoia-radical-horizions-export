-- Pastor puxado da igreja na inscricao (18/10/2026, Patrick).
--
-- Quando o equipante (ou acampante) escolhe/escreve a igreja e ela ja tem
-- pastor no quadro "Pastores Parceiros" (Configuracoes), o formulario preenche
-- o nome do pastor. Igreja sem pastor mapeado: a pessoa preenche, como antes.
--
-- Devolve SO os nomes (nada de CPF/telefone) dos pastores ativos da igreja.
-- Aceita "64 - METODISTA CENTENARIO" (codigo da lista) ou o nome escrito
-- (acampante escreve a igreja que frequenta a mao) -- comparado sem acento,
-- sem caixa e sem espacos sobrando.
create or replace function public.pastores_da_igreja(p_igreja text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with alvo as (
    select i.id
      from public.igrejas_parceiras i
     where nullif(btrim(coalesce(p_igreja, '')), '') is not null
       and (
         (p_igreja ~ '^\s*\d+\s*-' and i.codigo::text = btrim(split_part(p_igreja, '-', 1)))
         or upper(translate(regexp_replace(btrim(i.nome), '\s+', ' ', 'g'),
                  'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
                  'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'))
          = upper(translate(regexp_replace(btrim(p_igreja), '\s+', ' ', 'g'),
                  'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
                  'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'))
       )
     limit 1
  )
  select coalesce(jsonb_agg(distinct btrim(p.nome)), '[]'::jsonb)
    from public.pastores_parceiros p
    join alvo on alvo.id = p.igreja_id
   where p.removido_em is null
     and nullif(btrim(p.nome), '') is not null;
$$;
revoke all on function public.pastores_da_igreja(text) from public;
grant execute on function public.pastores_da_igreja(text) to anon, authenticated;
