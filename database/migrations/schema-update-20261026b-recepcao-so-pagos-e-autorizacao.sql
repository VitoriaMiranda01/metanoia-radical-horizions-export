-- Recepcao dos acampantes: quem entra na chamada e autorizacao do menor
-- (26/10/2026, Patrick).
--
-- 1) Na chamada so aparece quem esta PAGO (isento conta como pago) ou com
--    PAGAMENTO AGENDADO, a mesma regra da tela de Pagamentos. Quem esta em
--    "Nao pagaram" (ou "Cobranca em andamento") nao aparece. Vale tambem para
--    os infiltrados (pagamento da ficha de equipante ou cobranca agendada).
--    Pagou ou agendou depois: aparece sozinho (a assinatura muda).
-- 2) Menor de idade: a segunda caixa deixa de ser "responsavel ciente" e vira
--    "entregou a autorizacao dos responsaveis" (em maos ou assinada na hora,
--    no papel). Mesma coluna (responsavel_ciente); so muda o texto do erro.
--    Todo menor precisa das duas caixas: termo + autorizacao.

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
  select 'equipante', e.id, e.nome, e.sexo, e.data_nascimento, e.igreja,
         coalesce(nullif(e.whatsapp, ''), e.telefone),
         s.cor, lower(coalesce(e.status_pagamento, '')) in ('confirmado', 'pago', 'completed'),
         true, e.contato_emergencia_nome, e.contato_emergencia_telefone, true
    from public.escalas s
    join public.equipantes e on e.id = s.equipante_id
   where s.area_alocada = 'Infiltrados'
     and s.cor is not null
     and exists (select 1 from public.configuracoes c where c.escala_oficial_em is not null)
     and (lower(coalesce(e.status_pagamento, '')) in ('confirmado', 'pago', 'completed')
          or exists (select 1 from public.cobrancas_equipantes c where c.equipante_id = e.id and c.status = 'agendado'));
$function$;

-- Auxiliar: continua sem EXECUTE para os logins (20261026a).
revoke all on function public._recepcao_participantes() from public, anon, authenticated;

do $$
declare
  v_def  text := pg_get_functiondef('public.recepcao_marcar_presenca(text,uuid,boolean,boolean)'::regprocedure);
  v_novo text;
begin
  if v_def like '%autorização dos responsáveis%' then return; end if;
  v_novo := replace(v_def,
    $a$'Menor de idade: marque "responsável ciente".'$a$,
    $a$'Menor de idade: marque "entregou a autorização dos responsáveis".'$a$);
  if v_novo = v_def then raise exception 'trecho não encontrado em recepcao_marcar_presenca'; end if;
  execute v_novo;
end $$;
