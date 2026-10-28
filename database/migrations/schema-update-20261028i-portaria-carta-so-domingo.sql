-- Portaria: Só Domingo sem aprovação precisa ter a CARTA recebida antes de pagar/entrar (28/10/2026).
-- Regra do Patrick: aprovado no módulo de Aprovação = igreja já autorizou (carta entregue).
-- Só Domingo ainda pendente: a portaria toca em "Receber carta" (observação pode ficar vazia);
-- só depois liberam "Pagar agora" ou, se já pagou, "Liberar entrada". A própria portaria desfaz
-- a carta marcada por engano (enquanto a pessoa não tiver entrado). A trava é no banco.

create table if not exists public.portaria_cartas (
  equipante_id uuid primary key references public.equipantes(id) on delete cascade,
  recebida_em  timestamptz not null default now(),
  recebida_por text not null
);
alter table public.portaria_cartas enable row level security;
revoke all on table public.portaria_cartas from anon, authenticated;

alter table public.portaria_registros drop constraint if exists portaria_registros_acao_check;
alter table public.portaria_registros add constraint portaria_registros_acao_check
  check (acao in ('baixa', 'desfeita', 'entrada', 'entrada_desfeita', 'carta', 'carta_desfeita'));

-- Pendente de carta = Só Domingo sem aprovação e sem carta registrada.
create or replace function public._so_domingo_falta_carta(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select public._so_domingo_sem_aprovacao(p_id)
     and not exists (select 1 from public.portaria_cartas c where c.equipante_id = p_id);
$fn$;
revoke all on function public._so_domingo_falta_carta(uuid) from public, anon, authenticated;

create or replace function public.portaria_receber_carta(p_id uuid, p_texto text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_quem  text := public._portaria_quem();
  v_texto text := left(nullif(btrim(coalesce(p_texto, '')), ''), 500);
  v_nome  text;
begin
  if v_quem is null then
    return jsonb_build_object('ok', false, 'erro', 'Acesso não autorizado.');
  end if;
  select nome into v_nome from public.equipantes where id = p_id and tipo = 'equipante' for update;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada.');
  end if;
  if not public._so_domingo_sem_aprovacao(p_id) then
    return jsonb_build_object('ok', false, 'erro',
      'Esta pessoa não precisa de carta (já está aprovada ou não é Só Domingo).');
  end if;
  if exists (select 1 from public.portaria_cartas where equipante_id = p_id) then
    return jsonb_build_object('ok', false, 'erro', 'A carta desta pessoa já foi recebida.');
  end if;

  insert into public.portaria_cartas (equipante_id, recebida_em, recebida_por) values (p_id, now(), v_quem);
  if v_texto is not null then
    insert into public.portaria_observacoes (tipo, inscricao_id, texto, atualizado_em, atualizado_por)
    values ('equipante', p_id, v_texto, now(), v_quem)
    on conflict (tipo, inscricao_id) do update
      set texto = excluded.texto, atualizado_em = now(), atualizado_por = excluded.atualizado_por;
  end if;
  insert into public.portaria_registros (quem, acao, tipo, inscricao_id, nome)
  values (v_quem, 'carta', 'equipante', p_id, v_nome);

  return jsonb_build_object('ok', true, 'nome', v_nome, 'recebida_por', v_quem);
end;
$fn$;
revoke all on function public.portaria_receber_carta(uuid, text) from public, anon;
grant execute on function public.portaria_receber_carta(uuid, text) to authenticated;

create or replace function public.portaria_desfazer_carta(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_quem text := public._portaria_quem();
  v_nome text;
begin
  if v_quem is null then
    return jsonb_build_object('ok', false, 'erro', 'Acesso não autorizado.');
  end if;
  select nome into v_nome from public.equipantes where id = p_id and tipo = 'equipante' for update;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada.');
  end if;
  if exists (select 1 from public.portaria_entradas where equipante_id = p_id) then
    return jsonb_build_object('ok', false, 'erro',
      'Esta pessoa já entrou. Desfaça a entrada antes de desfazer a carta.');
  end if;
  delete from public.portaria_cartas where equipante_id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Esta pessoa não está com a carta recebida.');
  end if;
  insert into public.portaria_registros (quem, acao, tipo, inscricao_id, nome)
  values (v_quem, 'carta_desfeita', 'equipante', p_id, v_nome);

  return jsonb_build_object('ok', true, 'nome', v_nome);
end;
$fn$;
revoke all on function public.portaria_desfazer_carta(uuid) from public, anon;
grant execute on function public.portaria_desfazer_carta(uuid) to authenticated;

do $$
declare
  v_def  text;
  v_novo text;
begin
  -- Lista: marca de carta (recebida ou não) em cada pessoa.
  v_def := pg_get_functiondef('public.portaria_lista()'::regprocedure);
  if v_def not like '%carta_recebida%' then
    v_novo := replace(v_def,
      $a$             'sem_aprovacao', public._so_domingo_sem_aprovacao(e.id),$a$,
      $a$             'sem_aprovacao', public._so_domingo_sem_aprovacao(e.id),
             'carta_recebida', exists (select 1 from public.portaria_cartas c where c.equipante_id = e.id),
             'carta_em', (select c.recebida_em from public.portaria_cartas c where c.equipante_id = e.id),
             'carta_por', (select c.recebida_por from public.portaria_cartas c where c.equipante_id = e.id),$a$);
    if v_novo = v_def then raise exception 'trecho não encontrado em portaria_lista'; end if;
    execute v_novo;
  end if;

  -- Pagar agora: exige a carta.
  v_def := pg_get_functiondef('public.portaria_dar_baixa(text,uuid,text,numeric,boolean)'::regprocedure);
  if v_def not like '%_so_domingo_falta_carta%' then
    v_novo := replace(v_def,
      $a$  if not public._equipante_na_escala(p_id) and not public._so_domingo_sem_aprovacao(p_id) then$a$,
      $a$  if public._so_domingo_falta_carta(p_id) then
    return jsonb_build_object('ok', false, 'erro',
      'Falta receber a carta de autorização pastoral. Toque em "Receber carta" antes de cobrar.');
  end if;
  if not public._equipante_na_escala(p_id) and not public._so_domingo_sem_aprovacao(p_id) then$a$);
    if v_novo = v_def then raise exception 'trecho não encontrado em portaria_dar_baixa'; end if;
    execute v_novo;
  end if;

  -- Liberar entrada (pago ou agendado): exige a carta.
  v_def := pg_get_functiondef('public.portaria_liberar_entrada(uuid)'::regprocedure);
  if v_def not like '%_so_domingo_falta_carta%' then
    v_novo := replace(v_def,
      $a$  if public._e_infiltrado('equipante', p_id) then$a$,
      $a$  if public._so_domingo_falta_carta(p_id) then
    return jsonb_build_object('ok', false, 'erro',
      'Falta receber a carta de autorização pastoral. Toque em "Receber carta" antes de liberar a entrada.');
  end if;

  if public._e_infiltrado('equipante', p_id) then$a$);
    if v_novo = v_def then raise exception 'trecho não encontrado em portaria_liberar_entrada'; end if;
    execute v_novo;
  end if;

  -- Versão: receber/desfazer carta atualiza a tela dos outros aparelhos.
  v_def := pg_get_functiondef('public.portaria_versao()'::regprocedure);
  if v_def not like '%portaria_cartas%' then
    v_novo := replace(v_def,
      $a$    (select count(*)::text from public.equipantes e where e.tipo = 'equipante'),$a$,
      $a$    (select count(*)::text from public.equipantes e where e.tipo = 'equipante'),
    (select count(*)::text from public.portaria_cartas),$a$);
    if v_novo = v_def then raise exception 'trecho não encontrado em portaria_versao'; end if;
    execute v_novo;
  end if;

  -- Virada de edição: cartas da edição velha saem junto com as entradas.
  v_def := pg_get_functiondef('public.resetar_para_nova_edicao(integer,date,date)'::regprocedure);
  if v_def not like '%delete from public.portaria_cartas%' then
    v_novo := replace(v_def,
      $a$  delete from public.portaria_entradas where equipante_id is not null;$a$,
      $a$  delete from public.portaria_entradas where equipante_id is not null;
  delete from public.portaria_cartas where equipante_id is not null;$a$);
    if v_novo = v_def then raise exception 'trecho não encontrado em resetar_para_nova_edicao'; end if;
    execute v_novo;
  end if;
end $$;
