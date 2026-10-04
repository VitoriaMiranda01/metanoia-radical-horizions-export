-- =============================================================================
-- Exportar a lista de igrejas (04/10/2026, pedido do Patrick)
--
-- Botao "Exportar lista de igrejas" em Configuracoes. A lista do formulario e
-- a constante IGREJAS_PARCEIRAS (no site) + igrejas_extras (as que a
-- organizacao adiciona). Esta funcao entrega, so para organizador, o que a
-- tela nao consegue montar sozinha: as igrejas adicionadas (com quem
-- adicionou), quantos inscritos cada igreja tem e o que foi escrito em OUTRA.
-- =============================================================================

create or replace function public.relatorio_igrejas()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.eh_organizador() then
    return null;
  end if;

  return jsonb_build_object(
    'extras', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'nome', x.nome, 'criada_por', x.criada_por, 'criada_em', x.criada_em)
               order by x.nome), '[]'::jsonb)
        from public.igrejas_extras x),
    -- Sem igreja tambem conta (linha propria), para o total bater com os inscritos.
    'equipantes', (
      select coalesce(jsonb_object_agg(t.igreja, jsonb_build_object(
               'inscritos', t.inscritos, 'aprovados', t.aprovados)), '{}'::jsonb)
        from (select coalesce(nullif(btrim(coalesce(e.igreja, '')), ''), '(sem igreja informada)') igreja,
                     count(*) inscritos,
                     count(*) filter (where e.status = 'aprovado') aprovados
                from public.equipantes e
               where e.tipo = 'equipante' and coalesce(e.inscrito, false)
               group by 1) t),
    'acampantes', (
      select coalesce(jsonb_object_agg(t.igreja, t.qtd), '{}'::jsonb)
        from (select coalesce(nullif(btrim(coalesce(a.admin_responsavel, '')), ''), '(sem igreja informada)') igreja,
                     count(*) qtd
                from public.acampantes a
               group by 1) t),
    'outra', (
      select coalesce(jsonb_agg(jsonb_build_object('escrito', t.escrito, 'quantos', t.qtd)
               order by t.qtd desc, t.escrito), '[]'::jsonb)
        from (select upper(regexp_replace(btrim(coalesce(e.igreja_outra, '')), '\s+', ' ', 'g')) escrito,
                     count(*) qtd
                from public.equipantes e
               where e.tipo = 'equipante' and coalesce(e.inscrito, false)
                 and upper(coalesce(e.igreja, '')) = 'OUTRA'
               group by 1) t)
  );
end;
$$;

revoke all on function public.relatorio_igrejas() from public, anon;
grant execute on function public.relatorio_igrejas() to authenticated;
