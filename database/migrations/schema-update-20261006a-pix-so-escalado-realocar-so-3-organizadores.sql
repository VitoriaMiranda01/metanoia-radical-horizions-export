-- ---------------------------------------------------------------------------
-- 06/10/2026, respostas do Patrick:
--
-- 1. "Realocar ficara restrito aos 3 organizadores" (Desenvolvedores,
--    Raquel e Dudu). Vale para mover (realocar_alocacao) e tirar
--    (remover_alocacao) alguem de uma area -- pelas funcoes E direto na
--    tabela: a politica "organizador faz tudo" deixava qualquer login de
--    organizador alterar/apagar linhas de escalas pela API. Ler e incluir
--    continua para todo organizador.
--
-- 2. A cobranca PIX passa a conferir no SERVIDOR se o equipante pode
--    pagar. Ate aqui so a tela escondia o botao: quem chamasse a funcao
--    sicoob-pix-create direto (com o proprio id) gerava cobranca antes de
--    ser aprovado e escalado. A regra e a mesma do "pode_pagar" de
--    situacao_inscricao: aprovado, escala provisoria lancada, numa area de
--    verdade, e menor com a autorizacao dos pais.
--    So a service_role (a Edge Function) executa.
-- ---------------------------------------------------------------------------

-- 2. Pode pagar?
create or replace function public._equipante_pode_pagar(p_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path to 'public'
as $fn$
declare
  e public.equipantes;
begin
  select * into e from public.equipantes where id = p_id and tipo = 'equipante';
  if e.id is null then
    return jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada.');
  end if;
  if coalesce(e.status, '') <> 'aprovado' then
    return jsonb_build_object('ok', false, 'erro',
      'Sua inscrição ainda não foi aprovada pela sua igreja. O pagamento abre depois da aprovação e da escala.');
  end if;
  if (select escala_lancada_em from public.configuracoes limit 1) is null
     or not exists (select 1 from public.escalas s
                     where s.equipante_id = p_id and s.area_alocada <> 'Não será escalado') then
    return jsonb_build_object('ok', false, 'erro',
      'O pagamento abre quando a escala sair e você estiver nela. Acompanhe pelo site.');
  end if;
  if coalesce(public.idade(e), 18) < 18
     and e.parental_auth_file_url is null and e.autorizacao_entregue_em is null then
    return jsonb_build_object('ok', false, 'erro',
      'Falta a autorização dos seus responsáveis. Entregue ou anexe no acompanhamento da inscrição.');
  end if;
  return jsonb_build_object('ok', true);
end;
$fn$;
revoke all on function public._equipante_pode_pagar(uuid) from public, anon, authenticated;
grant execute on function public._equipante_pode_pagar(uuid) to service_role;


-- 1a. realocar / remover: so os 3
do $do$
declare
  v_def text; v_velho text;
begin
  v_def := pg_get_functiondef('public.realocar_alocacao(uuid,text)'::regprocedure);
  v_velho := $v$  IF NOT public.eh_organizador() THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Apenas organizadores podem realocar.');
  END IF;$v$;
  if (length(v_def) - length(replace(v_def, v_velho, ''))) / length(v_velho) <> 1 then
    raise exception 'ancora de realocar_alocacao nao e unica';
  end if;
  execute replace(v_def, v_velho, $v$  IF NOT public._gere_escala() THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Só Desenvolvedores, Raquel e Dudu podem mudar alguém de área.');
  END IF;$v$);

  v_def := pg_get_functiondef('public.remover_alocacao(uuid)'::regprocedure);
  v_velho := $v$  IF NOT public.eh_organizador() THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Apenas organizadores podem remover.');
  END IF;$v$;
  if (length(v_def) - length(replace(v_def, v_velho, ''))) / length(v_velho) <> 1 then
    raise exception 'ancora de remover_alocacao nao e unica';
  end if;
  execute replace(v_def, v_velho, $v$  IF NOT public._gere_escala() THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Só Desenvolvedores, Raquel e Dudu podem tirar alguém de uma área.');
  END IF;$v$);
end;
$do$;


-- 1b. Tabela escalas: ler e incluir, todo organizador; alterar e apagar,
-- so os 3. (pode_gerir_escala ja e executavel por authenticated.)
drop policy if exists "organizador faz tudo" on public.escalas;

create policy "organizador le" on public.escalas
  for select to authenticated using (public.eh_organizador());
create policy "organizador inclui" on public.escalas
  for insert to authenticated with check (public.eh_organizador());
create policy "gestao da escala altera" on public.escalas
  for update to authenticated
  using (public.eh_organizador() and public.pode_gerir_escala())
  with check (public.eh_organizador() and public.pode_gerir_escala());
create policy "gestao da escala apaga" on public.escalas
  for delete to authenticated
  using (public.eh_organizador() and public.pode_gerir_escala());
