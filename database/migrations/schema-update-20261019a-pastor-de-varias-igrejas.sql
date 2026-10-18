-- Um pastor responsavel por MAIS DE UMA igreja (Patrick, 19/10/2026; caso do
-- Julio Cesar Coutinho Reis Herculano, que ja tem a conta de parceiro da 17).
--
-- Em vez de criar outra conta, a conta (login) que ele ja usa passa a
-- responder tambem pelas igrejas vinculadas: ao entrar com o codigo 17 ele ve,
-- aprova e confere as inscricoes da 17 E das igrejas vinculadas a ela.
--
--  * igrejas_responsavel_extra: igreja vinculada -> conta que responde por
--    ela. Uma igreja so pode estar vinculada a UMA conta (chave primaria).
--  * igrejas_do_parceiro(): os codigos que o parceiro logado enxerga (a
--    propria + as vinculadas). Substitui o "igreja like <codigo> - %" na regra
--    de leitura de equipantes, em decidir_inscricao, conferir_autorizacao_menor,
--    menores_para_conferencia e _pode_escalar_equipante.
--  * A igreja vinculada continua com a conta dela (se tiver): o vinculo so
--    ACRESCENTA quem pode responder por ela.
--  * Na decisao, "decidido_por_igreja" passa a ser a igreja DA PESSOA (antes
--    era a da conta, que era sempre a mesma).

create table if not exists public.igrejas_responsavel_extra (
  igreja_codigo text primary key,
  conta_codigo  text not null,
  criado_em     timestamptz not null default now(),
  criado_por    text,
  constraint igrejas_responsavel_extra_diferente check (igreja_codigo <> conta_codigo)
);
create index if not exists igrejas_responsavel_extra_conta on public.igrejas_responsavel_extra (conta_codigo);
alter table public.igrejas_responsavel_extra enable row level security;
revoke all on table public.igrejas_responsavel_extra from anon, authenticated;

-- Codigos que o parceiro logado enxerga ------------------------------------------
create or replace function public.igrejas_do_parceiro()
returns text[] language sql stable security definer set search_path = public as $$
  select case when public.jwt_igreja() = '' then '{}'::text[]
              else array[public.jwt_igreja()]
                   || coalesce((select array_agg(x.igreja_codigo order by x.igreja_codigo)
                                  from public.igrejas_responsavel_extra x
                                 where x.conta_codigo = public.jwt_igreja()), '{}'::text[])
         end;
$$;
revoke all on function public.igrejas_do_parceiro() from public, anon;
grant execute on function public.igrejas_do_parceiro() to authenticated;

-- Para a tela do parceiro: codigo e nome de cada igreja que ele responde.
create or replace function public.minhas_igrejas_parceiro()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('codigo', i.codigo, 'nome', i.nome) order by lpad(i.codigo, 4, '0')), '[]'::jsonb)
    from public.igrejas_parceiras i
   where public.eh_parceiro() and i.codigo = any(public.igrejas_do_parceiro());
$$;
revoke all on function public.minhas_igrejas_parceiro() from public, anon;
grant execute on function public.minhas_igrejas_parceiro() to authenticated;

-- Regra de leitura das fichas ----------------------------------------------------
drop policy if exists "parceiro ve so a propria igreja" on public.equipantes;
create policy "parceiro ve so a propria igreja" on public.equipantes
  for select to authenticated
  using (public.eh_parceiro() and igreja is not null
         and split_part(igreja, ' - ', 1) = any ((select public.igrejas_do_parceiro())::text[]));

-- Funcoes que conferiam a igreja da conta ----------------------------------------
do $mig$
declare
  v text;
begin
  v := pg_get_functiondef('public._pode_escalar_equipante(uuid)'::regprocedure);
  if position($a$q.igreja like public.jwt_igreja() || ' - %'$a$ in v) = 0 then
    raise exception '_pode_escalar_equipante: trecho nao encontrado';
  end if;
  v := replace(v, $a$q.igreja like public.jwt_igreja() || ' - %'$a$,
                  $b$split_part(q.igreja, ' - ', 1) = any (public.igrejas_do_parceiro())$b$);
  execute v;

  v := pg_get_functiondef('public.menores_para_conferencia()'::regprocedure);
  if position($a$(e.igreja is not null and e.igreja like v_prefixo)$a$ in v) = 0 then
    raise exception 'menores_para_conferencia: trecho nao encontrado';
  end if;
  v := replace(v, $a$(e.igreja is not null and e.igreja like v_prefixo)$a$,
                  $b$(e.igreja is not null and split_part(e.igreja, ' - ', 1) = any (public.igrejas_do_parceiro()))$b$);
  execute v;

  v := pg_get_functiondef('public.conferir_autorizacao_menor(uuid,boolean)'::regprocedure);
  if position($a$v_alvo.igreja not like (public.jwt_igreja() || ' - %')$a$ in v) = 0 then
    raise exception 'conferir_autorizacao_menor: trecho nao encontrado';
  end if;
  v := replace(v, $a$v_alvo.igreja not like (public.jwt_igreja() || ' - %')$a$,
                  $b$not (split_part(v_alvo.igreja, ' - ', 1) = any (public.igrejas_do_parceiro()))$b$);
  execute v;

  v := pg_get_functiondef('public.decidir_inscricao(uuid,text)'::regprocedure);
  if position($a$v_alvo.igreja not like (public.jwt_igreja() || ' - %')$a$ in v) = 0
     or position($a$    v_ig   := v_igreja.codigo || ' - ' || v_igreja.nome;$a$ in v) = 0 then
    raise exception 'decidir_inscricao: trecho nao encontrado';
  end if;
  v := replace(v, $a$v_alvo.igreja not like (public.jwt_igreja() || ' - %')$a$,
                  $b$not (split_part(v_alvo.igreja, ' - ', 1) = any (public.igrejas_do_parceiro()))$b$);
  v := replace(v, $a$    v_ig   := v_igreja.codigo || ' - ' || v_igreja.nome;$a$,
                  $b$    v_ig   := coalesce((select i2.codigo || ' - ' || i2.nome from public.igrejas_parceiras i2
                          where i2.codigo = split_part(v_alvo.igreja, ' - ', 1) limit 1),
                        v_igreja.codigo || ' - ' || v_igreja.nome);$b$);
  execute v;
end
$mig$;

-- Organizador: os vinculos ---------------------------------------------------------
create or replace function public.vinculos_responsavel_igrejas()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.eh_organizador() then '[]'::jsonb else coalesce((
    select jsonb_agg(jsonb_build_object(
             'igreja_codigo', x.igreja_codigo, 'igreja_nome', ig.nome,
             'conta_codigo', x.conta_codigo, 'conta_nome', ct.nome,
             'responsavel', coalesce(nullif(btrim(ct.responsavel_nome), ''), pa.responsavel_nome),
             'criado_em', x.criado_em, 'criado_por', x.criado_por)
           order by lpad(x.conta_codigo, 4, '0'), lpad(x.igreja_codigo, 4, '0'))
      from public.igrejas_responsavel_extra x
      left join public.igrejas_parceiras ig on ig.codigo = x.igreja_codigo
      left join public.igrejas_parceiras ct on ct.codigo = x.conta_codigo
      left join public.primeiro_acesso_parceiros pa on pa.codigo = x.conta_codigo), '[]'::jsonb) end;
$$;
revoke all on function public.vinculos_responsavel_igrejas() from public, anon;
grant execute on function public.vinculos_responsavel_igrejas() to authenticated;

-- Define a lista COMPLETA de igrejas extras de uma conta (tira as que sairam,
-- poe as novas). Igreja ja vinculada a OUTRA conta: recusa, dizendo qual.
create or replace function public.definir_igrejas_da_conta(p_conta text, p_igrejas text[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_conta   text := btrim(coalesce(p_conta, ''));
  v_lista   text[] := array(select distinct btrim(x) from unnest(coalesce(p_igrejas, '{}'::text[])) x
                             where btrim(x) <> '' and btrim(x) <> btrim(coalesce(p_conta, '')));
  v_quem    text := coalesce(public._nome_organizador_logado(), 'organizador');
  v_conflito text;
  v_falta   text;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores.');
  end if;
  if not exists (select 1 from public.igrejas_parceiras where codigo = v_conta) then
    return jsonb_build_object('ok', false, 'erro', 'Conta não encontrada.');
  end if;
  select string_agg(x, ', ') into v_falta
    from unnest(v_lista) x where not exists (select 1 from public.igrejas_parceiras i where i.codigo = x);
  if v_falta is not null then
    return jsonb_build_object('ok', false, 'erro', format('Igreja não encontrada: %s.', v_falta));
  end if;
  -- A conta escolhida nao pode ser, ela mesma, vinculada a outra.
  if exists (select 1 from public.igrejas_responsavel_extra where igreja_codigo = v_conta) and cardinality(v_lista) > 0 then
    return jsonb_build_object('ok', false, 'erro', format(
      'A igreja %s já está vinculada à conta %s. Vincule as igrejas à conta principal.', v_conta,
      (select conta_codigo from public.igrejas_responsavel_extra where igreja_codigo = v_conta)));
  end if;
  select string_agg(x.igreja_codigo || ' (já é da conta ' || x.conta_codigo || ')', ', ') into v_conflito
    from public.igrejas_responsavel_extra x
   where x.igreja_codigo = any (v_lista) and x.conta_codigo <> v_conta;
  if v_conflito is not null then
    return jsonb_build_object('ok', false, 'erro', format('Já vinculada a outra conta: %s. Desvincule lá primeiro.', v_conflito));
  end if;
  -- Igreja que e conta principal de outras nao vira vinculada.
  select string_agg(distinct x.conta_codigo, ', ') into v_conflito
    from public.igrejas_responsavel_extra x where x.conta_codigo = any (v_lista);
  if v_conflito is not null then
    return jsonb_build_object('ok', false, 'erro', format('A igreja %s já responde por outras igrejas; ela não pode ser vinculada.', v_conflito));
  end if;

  delete from public.igrejas_responsavel_extra
   where conta_codigo = v_conta and not (igreja_codigo = any (v_lista));
  insert into public.igrejas_responsavel_extra (igreja_codigo, conta_codigo, criado_por)
  select x, v_conta, v_quem from unnest(v_lista) x
  on conflict (igreja_codigo) do nothing;

  return jsonb_build_object('ok', true, 'conta', v_conta, 'igrejas', to_jsonb(v_lista));
end;
$$;
revoke all on function public.definir_igrejas_da_conta(text, text[]) from public, anon;
grant execute on function public.definir_igrejas_da_conta(text, text[]) to authenticated;
