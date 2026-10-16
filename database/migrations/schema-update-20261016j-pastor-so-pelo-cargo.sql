-- Cupom "so para pastores": por enquanto vale SO PELO CARGO (16/10/2026).
--
-- Pedido do Patrick: "Ainda nao coloque essa validacao dos pastores parceiros,
-- pois a tela ainda nao foi preenchida totalmente."
--
-- Quem conta como pastor, a partir de agora:
--   cargo na igreja PASTOR(A) ou PASTOR(A) AUXILIAR (ou marcado "e_pastor").
-- A lista de Pastores Parceiros NAO entra na conta ate a tela estar completa.
--
-- Para voltar a considerar a lista (cargo OU CPF na lista), e so recriar a
-- funcao com o bloco "return v_cpf <> '' and exists (...)" de
-- schema-update-20261016i-cupom-so-pastor.sql.

create or replace function public._e_pastor(p_tipo text, p_id uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  v_cargo text;
  v_epastor boolean;
begin
  if p_tipo = 'equipante' then
    select upper(btrim(coalesce(e.cargo_igreja, ''))), coalesce(e.e_pastor, false)
      into v_cargo, v_epastor
      from public.equipantes e where e.id = p_id and e.tipo = 'equipante';
  else
    select upper(btrim(coalesce(a.cargo_igreja, ''))), false
      into v_cargo, v_epastor
      from public.acampantes a where a.id = p_id;
  end if;
  if not found then return false; end if;

  return v_cargo in ('PASTOR(A)', 'PASTOR(A) AUXILIAR') or v_epastor;
end;
$$;
