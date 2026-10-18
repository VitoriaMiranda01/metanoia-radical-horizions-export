-- Observacao opcional no "Confirmar pagamento" (18/10/2026, Patrick): quem
-- confirma pode anotar algo (ex.: "PIX da mae dele", "pagou metade"). Texto
-- livre, ate 300 letras, opcional. Colunas NULL de proposito (nunca NOT NULL
-- em equipantes: criar_inscricao usa jsonb_populate_record).
--
-- registrar_pagamento ganha p_observacao (com default, entao o site antigo,
-- que chama sem ela, continua funcionando). Desfazer e a virada de edicao
-- limpam a observacao junto com o resto.
alter table public.equipantes add column if not exists pagamento_observacao text;
alter table public.acampantes add column if not exists pagamento_observacao text;

do $mig$
declare
  v text;
begin
  v := pg_get_functiondef('public.registrar_pagamento(text, uuid, text, numeric, text, text)'::regprocedure);
  if position($a$p_meio text DEFAULT NULL::text)$a$ in v) = 0
     or position($a$  v_meio    text := nullif(lower(btrim(coalesce(p_meio, ''))), '');$a$ in v) = 0
     or position($a$pagamento_confirmado_por = v_quem, pagamento_meio = v_meio
     where id = p_id;$a$ in v) = 0
     or position($a$pagamento_confirmado_por = v_quem, pagamento_meio = v_meio
     where id = p_id and tipo = 'equipante';$a$ in v) = 0 then
    raise exception 'registrar_pagamento: trecho nao encontrado';
  end if;
  v := replace(v, $a$p_meio text DEFAULT NULL::text)$a$,
                  $b$p_meio text DEFAULT NULL::text, p_observacao text DEFAULT NULL::text)$b$);
  v := replace(v, $a$  v_meio    text := nullif(lower(btrim(coalesce(p_meio, ''))), '');$a$,
                  $b$  v_meio    text := nullif(lower(btrim(coalesce(p_meio, ''))), '');
  v_obs     text := left(nullif(btrim(coalesce(p_observacao, '')), ''), 300);$b$);
  v := replace(v, $a$pagamento_confirmado_por = v_quem, pagamento_meio = v_meio
     where id = p_id;$a$,
                  $b$pagamento_confirmado_por = v_quem, pagamento_meio = v_meio, pagamento_observacao = v_obs
     where id = p_id;$b$);
  v := replace(v, $a$pagamento_confirmado_por = v_quem, pagamento_meio = v_meio
     where id = p_id and tipo = 'equipante';$a$,
                  $b$pagamento_confirmado_por = v_quem, pagamento_meio = v_meio, pagamento_observacao = v_obs
     where id = p_id and tipo = 'equipante';$b$);
  drop function public.registrar_pagamento(text, uuid, text, numeric, text, text);
  execute v;

  v := pg_get_functiondef('public.desfazer_pagamento(text, uuid)'::regprocedure);
  if (length(v) - length(replace(v, 'pagamento_confirmado_por = null, pagamento_meio = null,', ''))) = 0 then
    raise exception 'desfazer_pagamento: trecho nao encontrado';
  end if;
  v := replace(v, 'pagamento_confirmado_por = null, pagamento_meio = null,',
                  'pagamento_confirmado_por = null, pagamento_meio = null, pagamento_observacao = null,');
  execute v;

  v := pg_get_functiondef('public.resetar_para_nova_edicao(integer, date, date)'::regprocedure);
  if position('    pagamento_meio           = null' in v) = 0 then
    raise exception 'resetar_para_nova_edicao: trecho nao encontrado';
  end if;
  v := replace(v, '    pagamento_meio           = null',
                  E'    pagamento_meio           = null,\n    pagamento_observacao     = null');
  execute v;
end
$mig$;

revoke all on function public.registrar_pagamento(text, uuid, text, numeric, text, text, text) from public, anon;
grant execute on function public.registrar_pagamento(text, uuid, text, numeric, text, text, text) to authenticated;
