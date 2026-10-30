-- Infiltrado que nao pagou entra na recepcao (30/10/2026, Patrick).
--
-- 1) _recepcao_participantes: o infiltrado (escalado em "Infiltrados" com cor)
--    entra SEM a regra de pagamento. Acampante segue so pago, isento ou
--    agendado. Onibus e crachas usam a mesma lista (crachas ja incluiam todos).
-- 2) recepcao_lista manda 'pagamento_pendente' (infiltrado nao pago e sem
--    pagamento agendado) para a tela mostrar uma etiqueta discreta. Nao ha
--    etiqueta de infiltrado na recepcao (Bruna e Bim sabem pelo cracha 8).
-- 3) recepcao_versao muda quando o agendamento de equipante muda (a etiqueta
--    some sozinha nos aparelhos ao agendar ou pagar).

create or replace function public._recepcao_participantes()
 returns table (tipo text, id uuid, nome text, sexo text, nascimento date, igreja text, whatsapp text,
                grupo text, pago boolean, termo_inscricao boolean, emergencia_nome text,
                emergencia_telefone text, infiltrado boolean)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select 'acampante', a.id, a.nome, a.sexo, a.data_nascimento, a.igreja, a.whatsapp,
         a.grupo_trailha,
         lower(coalesce(a.status_pagamento, '')) in ('confirmado', 'pago', 'completed'),
         coalesce(a.termo_responsabilidade_aceito, false),
         a.contato_emergencia_nome, a.contato_emergencia_telefone, false
    from public.acampantes a
   where lower(coalesce(a.status_pagamento, '')) in ('confirmado', 'pago', 'completed')
      or exists (select 1 from public.cobrancas_acampantes c where c.acampante_id = a.id and c.status = 'agendado')
  union all
  select distinct on (e.id) 'equipante', e.id, e.nome, e.sexo, e.data_nascimento, e.igreja,
         coalesce(nullif(e.whatsapp, ''), e.telefone),
         s.cor, lower(coalesce(e.status_pagamento, '')) in ('confirmado', 'pago', 'completed'),
         true, e.contato_emergencia_nome, e.contato_emergencia_telefone, true
    from public.escalas s
    join public.equipantes e on e.id = s.equipante_id
   where s.area_alocada = 'Infiltrados'
     and s.cor is not null;
$function$;
revoke all on function public._recepcao_participantes() from public, anon, authenticated;

do $$
declare
  v_def  text := pg_get_functiondef('public.recepcao_lista()'::regprocedure);
  v_novo text;
begin
  if v_def like '%pagamento_pendente%' then return; end if;
  v_novo := replace(v_def,
    $a$'pago', p.pago, 'termo_inscricao', p.termo_inscricao,$a$,
    $a$'pago', p.pago, 'termo_inscricao', p.termo_inscricao,
        'pagamento_pendente', case when p.tipo = 'equipante' and not p.pago
          and not exists (select 1 from public.cobrancas_equipantes ce
                           where ce.equipante_id = p.id and ce.status = 'agendado') then true end,$a$);
  if v_novo = v_def then raise exception 'trecho não encontrado em recepcao_lista'; end if;
  execute v_novo;
end $$;

do $$
declare
  v_def  text := pg_get_functiondef('public.recepcao_versao()'::regprocedure);
  v_novo text;
begin
  if v_def like '%cobrancas_equipantes%' then return; end if;
  v_novo := replace(v_def,
    $a$(select data_evento_inicio::text from public.configuracoes limit 1)$a$,
    $a$(select data_evento_inicio::text from public.configuracoes limit 1),
    (select string_agg(c.equipante_id::text, ',' order by c.equipante_id)
       from public.cobrancas_equipantes c where c.status = 'agendado')$a$);
  if v_novo = v_def then raise exception 'trecho não encontrado em recepcao_versao'; end if;
  execute v_novo;
end $$;
