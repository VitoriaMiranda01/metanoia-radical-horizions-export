-- Presenca na reuniao de inscricao (08/11/2026, Patrick).
--
-- Logo depois do CPF, todo equipante (todos os dias e So Domingo) responde
-- "Voce esta presente na reuniao?":
--  * Sim  -> informa o codigo de inscricao da edicao (o mesmo de 20261107a);
--  * Nao  -> escreve a justificativa da ausencia (minimo 50 caracteres).
-- Depois segue o cadastro normalmente. A resposta fica na ficha e vai virar
-- criterio do alocar automatico (regra a ser feita depois pelo Patrick).
--
-- Acampante nao passa por aqui. Inscricao manual da organizacao tambem nao.
-- Pergunta de novo a cada inscricao (inclusive quem tem ficha anterior): a
-- virada zera as tres colunas.
--
-- Colunas novas SEM not null (criar_inscricao usa jsonb_populate_record).

alter table public.equipantes add column if not exists presente_reuniao_inscricao boolean;
alter table public.equipantes add column if not exists justificativa_ausencia_reuniao text;
alter table public.equipantes add column if not exists presenca_reuniao_em timestamptz;

-- criar_inscricao: troca a exigencia do codigo pela resposta da presenca.
-- Tela antiga (so manda o codigo valido) conta como "presente".
do $patch$
declare
  v_def text := pg_get_functiondef('public.criar_inscricao(text, jsonb, text)'::regprocedure);
  v_trocas text[][] := array[
    array[$a$  v_codigo  text;$a$,
          $n$  v_codigo  text;
  v_presente boolean;
  v_justif   text;$n$],
    array[$a$  -- Codigo de inscricao (20261107a): so equipante de todos os dias.
  if p_tipo = 'equipante' and not v_domingo then
    v_codigo := public._codigo_inscricao_valido(p_dados ->> 'codigo_inscricao');
    if v_codigo is null then
      raise exception 'CODIGO_INSCRICAO_INVALIDO';
    end if;
  end if;$a$,
          $n$  -- Presenca na reuniao de inscricao (20261108b), todo equipante:
  -- presente = codigo valido; ausente = justificativa de 50+ caracteres.
  if p_tipo = 'equipante' then
    v_presente := case p_dados ->> 'presente_reuniao'
                    when 'true' then true when 'false' then false else null end;
    v_codigo := public._codigo_inscricao_valido(p_dados ->> 'codigo_inscricao');
    if v_presente is null and v_codigo is not null then
      v_presente := true;
    end if;
    if v_presente is null then
      raise exception 'PRESENCA_REUNIAO_PENDENTE';
    elsif v_presente then
      if v_codigo is null then
        raise exception 'CODIGO_INSCRICAO_INVALIDO';
      end if;
      v_justif := null;
    else
      v_codigo := null;
      v_justif := btrim(regexp_replace(coalesce(p_dados ->> 'justificativa_ausencia_reuniao', ''), '\s+', ' ', 'g'));
      if length(v_justif) < 50 or length(v_justif) > 1000 then
        raise exception 'JUSTIFICATIVA_AUSENCIA_INVALIDA';
      end if;
    end if;
  end if;$n$],
    array[$a$        codigo_inscricao             = v_codigo,$a$,
          $n$        codigo_inscricao             = v_codigo,
        presente_reuniao_inscricao   = v_presente,
        justificativa_ausencia_reuniao = v_justif,
        presenca_reuniao_em          = now(),$n$],
    array[$a$    v_e.codigo_inscricao := v_codigo;$a$,
          $n$    v_e.codigo_inscricao := v_codigo;
    v_e.presente_reuniao_inscricao := v_presente;
    v_e.justificativa_ausencia_reuniao := v_justif;
    v_e.presenca_reuniao_em := now();$n$]
  ];
  i int;
begin
  for i in 1 .. array_length(v_trocas, 1) loop
    if (length(v_def) - length(replace(v_def, v_trocas[i][1], ''))) / length(v_trocas[i][1]) <> 1 then
      raise exception 'trecho % não encontrado em criar_inscricao', i;
    end if;
    v_def := replace(v_def, v_trocas[i][1], v_trocas[i][2]);
  end loop;
  execute v_def;
end;
$patch$;

-- Virada: a ficha que passa para a edicao nova pergunta de novo.
do $patch$
declare
  v_sig regprocedure := (select p.oid::regprocedure from pg_proc p
                           join pg_namespace n on n.oid = p.pronamespace
                          where n.nspname = 'public' and p.proname = 'resetar_para_nova_edicao');
  v_def text := pg_get_functiondef(v_sig);
  v_ancora text := $a$    codigo_inscricao       = null,$a$;
begin
  if (length(v_def) - length(replace(v_def, v_ancora, ''))) / length(v_ancora) <> 1 then
    raise exception 'trecho não encontrado em resetar_para_nova_edicao';
  end if;
  execute replace(v_def, v_ancora, v_ancora || E'\n    presente_reuniao_inscricao = null,\n    justificativa_ausencia_reuniao = null,\n    presenca_reuniao_em    = null,');
end;
$patch$;
