-- ---------------------------------------------------------------------------
-- Aviso "acampante sem tamanho de camisa" em Gerenciar Inscricoes (Patrick,
-- 06/10/2026). Entra junto com os outros dois avisos no quadro e no sino.
-- Sao fichas de antes da regra 20261006b (camisa obrigatoria). Mesmo formato
-- e mesmas permissoes de telefones_acampantes_pendentes(): so Raquel e
-- Desenvolvedores; os outros logins recebem null.
-- ---------------------------------------------------------------------------
create or replace function public.camisas_pendentes()
returns jsonb
language plpgsql stable security definer
set search_path to 'public'
as $fn$
declare
  v_nome text := lower(coalesce(public._nome_organizador_logado(), ''));
  v_itens jsonb;
begin
  if v_nome not in ('raquel', 'desenvolvedores') then
    return null;
  end if;

  select coalesce(jsonb_agg(t order by t.nome), '[]'::jsonb) into v_itens
  from (
    select a.id, a.nome, a.whatsapp, a.admin_responsavel, a.igreja, a.sexo
      from public.acampantes a
     where upper(btrim(coalesce(a.tamanho_camisa, ''))) not in ('PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG')
  ) t;

  return jsonb_build_object(
    'perfil', case when v_nome = 'raquel' then 'raquel' else 'desenvolvedores' end,
    'itens', v_itens);
end;
$fn$;
revoke all on function public.camisas_pendentes() from public, anon;
grant execute on function public.camisas_pendentes() to authenticated;
