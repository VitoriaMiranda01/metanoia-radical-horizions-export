-- ---------------------------------------------------------------------------
-- Aviso "contato de emergencia errado" + central de notificacoes (sino)
-- em Gerenciar Inscricoes (Patrick, 06/10/2026).
--
-- 1. contatos_emergencia_pendentes(): acampantes com NUMERO no nome do
--    contato de emergencia, ou com o proprio WhatsApp como telefone de
--    emergencia (fichas de antes da regra 20261006c). So Raquel e
--    Desenvolvedores; os outros logins recebem null. Mesmo formato de
--    telefones_acampantes_pendentes().
--
-- 2. avisos_ocultos: o que cada organizador escolheu OCULTAR (o quadro
--    inteiro ou uma ficha so). Fica na conta -- vale em qualquer aparelho.
--    Chaves: 'quadro:<aviso>' e 'ficha:<aviso>:<id do acampante>'.
--    Ocultar so tira da tela: o sino continua mostrando e traz de volta.
-- ---------------------------------------------------------------------------

create or replace function public.contatos_emergencia_pendentes()
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
    select a.id, a.nome, a.whatsapp, a.contato_emergencia_nome,
           a.contato_emergencia_telefone, a.admin_responsavel, a.igreja,
           e.estrangeiro,
           array_remove(array[
             case when coalesce(a.contato_emergencia_nome, '') ~ '[0-9]' then 'nome' end,
             case when n.tel_emerg is not null and n.tel_emerg = n.tel_whats then 'mesmo_telefone' end
           ], null) as problemas
      from public.acampantes a
      cross join lateral (
        select nullif(regexp_replace(coalesce(a.cpf, ''), '\D', '', 'g'), '') is null as estrangeiro) e
      cross join lateral (
        select public._telefone_normalizado(a.contato_emergencia_telefone, true, e.estrangeiro) as tel_emerg,
               public._telefone_normalizado(a.whatsapp, false, e.estrangeiro) as tel_whats) n
  ) t
  where cardinality(t.problemas) > 0;

  return jsonb_build_object(
    'perfil', case when v_nome = 'raquel' then 'raquel' else 'desenvolvedores' end,
    'itens', v_itens);
end;
$fn$;
revoke all on function public.contatos_emergencia_pendentes() from public, anon;
grant execute on function public.contatos_emergencia_pendentes() to authenticated;


create table if not exists public.avisos_ocultos (
  organizador_id uuid not null references public.organizadores_auth(id) on delete cascade,
  chave          text not null,
  oculto_em      timestamptz not null default now(),
  primary key (organizador_id, chave)
);
comment on table public.avisos_ocultos is
  'Avisos de Gerenciar Inscricoes que cada organizador ocultou (quadro inteiro ou uma ficha). Continuam no sino.';
alter table public.avisos_ocultos enable row level security;
revoke all on public.avisos_ocultos from anon, authenticated;

create or replace function public.meus_avisos_ocultos()
returns jsonb
language sql stable security definer
set search_path to 'public'
as $fn$
  select coalesce(jsonb_agg(o.chave order by o.chave), '[]'::jsonb)
    from public.avisos_ocultos o
   where o.organizador_id = (select c.id from public._organizador_do_cracha() c);
$fn$;
revoke all on function public.meus_avisos_ocultos() from public, anon;
grant execute on function public.meus_avisos_ocultos() to authenticated;

create or replace function public.ocultar_aviso(p_chave text, p_oculto boolean)
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $fn$
declare
  v_id uuid := (select c.id from public._organizador_do_cracha() c);
begin
  if v_id is null then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores.');
  end if;
  if p_chave is null
     or p_chave !~ '^(quadro:[a-z_]+|ficha:[a-z_]+:[0-9a-f-]{36})$' then
    return jsonb_build_object('ok', false, 'erro', 'Aviso inválido.');
  end if;

  if coalesce(p_oculto, false) then
    insert into public.avisos_ocultos (organizador_id, chave) values (v_id, p_chave)
    on conflict (organizador_id, chave) do nothing;
  else
    delete from public.avisos_ocultos where organizador_id = v_id and chave = p_chave;
  end if;
  return jsonb_build_object('ok', true);
end;
$fn$;
revoke all on function public.ocultar_aviso(text, boolean) from public, anon;
grant execute on function public.ocultar_aviso(text, boolean) to authenticated;
