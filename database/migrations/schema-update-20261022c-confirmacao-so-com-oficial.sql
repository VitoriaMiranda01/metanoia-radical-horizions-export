-- Confirmacao da inscricao so com a escala oficial (22/10/2026, Patrick).
-- Antes da oficial a regra ainda aceitava "pago + presenca", e o botao
-- "Confirmar inscricao" ficava verde sem a oficial lancada (visto pelo Patrick
-- com a propria inscricao). Agora concluido = aprovado + pago + estar na
-- escala oficial (area real, sem "Nao sera escalado"). Sem a oficial lancada,
-- ninguem conclui.
create or replace function public._inscricao_concluida(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select e.status = 'aprovado'
       and lower(coalesce(e.status_pagamento, '')) in ('pago', 'confirmado', 'completed')
       and (select c.escala_oficial_em from public.configuracoes c limit 1) is not null
       and exists (select 1 from public.escalas s
                    where s.equipante_id = p_id and s.area_alocada <> 'Não será escalado')
       and not exists (select 1 from public.escalas s
                        where s.equipante_id = p_id and s.area_alocada = 'Não será escalado')
      from public.equipantes e where e.id = p_id and e.tipo = 'equipante'), false);
$$;
revoke all on function public._inscricao_concluida(uuid) from public, anon, authenticated;
