-- Portaria: equipante "Só Domingo" ainda SEM APROVAÇÃO entra na lista (28/10/2026).
-- Regra do Patrick: quem se inscreveu para o domingo e não foi aprovado está sem a
-- carta de autorização pastoral. A portaria vê a pessoa com o aviso, cobra a carta
-- e pode receber o pagamento e liberar a entrada. Só o Só Domingo: os outros
-- pendentes e os rejeitados continuam fora (a pessoa consulta na Área do Equipante).

create or replace function public._so_domingo_sem_aprovacao(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select exists (select 1 from public.equipantes q
                  where q.id = p_id and q.tipo = 'equipante'
                    and q.so_domingo is true and q.status = 'pendente');
$fn$;

revoke all on function public._so_domingo_sem_aprovacao(uuid) from public, anon, authenticated;

do $$
declare
  v_def  text;
  v_novo text;
begin
  -- 1. Lista: entra na relação e leva a marca.
  v_def := pg_get_functiondef('public.portaria_lista()'::regprocedure);
  if v_def not like '%_so_domingo_sem_aprovacao%' then
    v_novo := replace(v_def,
      $a$             'so_domingo', coalesce(e.so_domingo, false),$a$,
      $a$             'so_domingo', coalesce(e.so_domingo, false),
             'sem_aprovacao', public._so_domingo_sem_aprovacao(e.id),$a$);
    v_novo := replace(v_novo,
      $a$       and (public._equipante_na_escala(e.id)$a$,
      $a$       and (public._equipante_na_escala(e.id)
            or public._so_domingo_sem_aprovacao(e.id)$a$);
    if v_novo = v_def or v_novo not like '%or public._so_domingo_sem_aprovacao(e.id)%'
       or v_novo not like '%''sem_aprovacao''%' then
      raise exception 'trecho não encontrado em portaria_lista';
    end if;
    execute v_novo;
  end if;

  -- 2. Pagar agora: aceita o Só Domingo sem aprovação.
  v_def := pg_get_functiondef('public.portaria_dar_baixa(text,uuid,text,numeric,boolean)'::regprocedure);
  if v_def not like '%_so_domingo_sem_aprovacao%' then
    v_novo := replace(v_def,
      $a$  if not public._equipante_na_escala(p_id) then$a$,
      $a$  if not public._equipante_na_escala(p_id) and not public._so_domingo_sem_aprovacao(p_id) then$a$);
    if v_novo = v_def then raise exception 'trecho não encontrado em portaria_dar_baixa'; end if;
    execute v_novo;
  end if;

  -- 3. Entrada: o pago já entra; o agendado sem aprovação também.
  v_def := pg_get_functiondef('public.portaria_liberar_entrada(uuid)'::regprocedure);
  if v_def not like '%_so_domingo_sem_aprovacao%' then
    v_novo := replace(v_def,
      $a$              and public._equipante_na_escala(p_id)) then$a$,
      $a$              and (public._equipante_na_escala(p_id) or public._so_domingo_sem_aprovacao(p_id))) then$a$);
    if v_novo = v_def then raise exception 'trecho não encontrado em portaria_liberar_entrada'; end if;
    execute v_novo;
  end if;

  -- 4. Versão: inscrever, aprovar ou rejeitar um Só Domingo atualiza a tela.
  v_def := pg_get_functiondef('public.portaria_versao()'::regprocedure);
  if v_def not like '%''pendente''%' then
    v_novo := replace(v_def,
      $a$    (select count(*)::text from public.equipantes e where e.so_domingo is true and e.status = 'aprovado')$a$,
      $a$    (select count(*)::text from public.equipantes e where e.so_domingo is true and e.status = 'aprovado'),
    (select coalesce(string_agg(e.id::text, ',' order by e.id), '')
       from public.equipantes e where e.so_domingo is true and e.status = 'pendente')$a$);
    if v_novo = v_def then raise exception 'trecho não encontrado em portaria_versao'; end if;
    execute v_novo;
  end if;
end $$;
