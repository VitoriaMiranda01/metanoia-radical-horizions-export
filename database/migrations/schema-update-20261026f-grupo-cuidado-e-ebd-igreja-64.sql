-- 26/10/2026 -- Igreja 64 (Metodista Centenario): Grupo de Cuidado e EBD separados.
--
-- Pedido do Patrick: para quem frequenta a 64, a pergunta unica "Frequenta Grupo
-- de Cuidado, Celula ou EBD?" vira duas -- Grupo de Cuidado (SIM/NAO; SIM pede o
-- nome do lider do grupo) e Escola Biblica (EBD) (SIM/NAO). As duas sao
-- obrigatorias e vem DESMARCADAS de proposito (inclusive na reinscricao: a tela
-- nao preenche com a resposta antiga). As respostas vao para a tela de
-- Aprovacoes, para a igreja analisar antes de aprovar.
--
-- Colunas:
--   frequenta_grupo_cuidado  -- para a 64 passa a ser SO o Grupo de Cuidado
--                               (nas demais igrejas segue a pergunta combinada)
--   frequenta_ebd            -- ja existia, sem tela; agora e a resposta da 64
--   lider_grupo_cuidado      -- NOVA, texto, sem NOT NULL (criar_inscricao usa
--                               jsonb_populate_record)
--
-- Regras (camada 3, _dados_inscricao_validos): equipante que congrega na igreja
-- de codigo 64 precisa mandar frequenta_grupo_cuidado e frequenta_ebd como
-- true/false (vazio = GRUPO_CUIDADO_OBRIGATORIO / EBD_OBRIGATORIA) e, com grupo
-- SIM, o nome do lider (LIDER_GRUPO_OBRIGATORIO; so letras).
-- Camada 4 (_validar_ficha): o nome do lider segue a regra dos nomes de outras
-- pessoas (NOME_TEXTO_INVALIDO:lider_grupo_cuidado) em qualquer gravacao.
-- criar_inscricao: a reinscricao passa a gravar lider_grupo_cuidado.

alter table public.equipantes add column if not exists lider_grupo_cuidado text;

-- frequenta_ebd nunca foi perguntado por tela nenhuma: os "false" que existem
-- (77 no oficial em 26/10) sao o DEFAULT, nao resposta. Zerados, e sem default,
-- para a Aprovacao saber quem respondeu a pergunta nova (preenchido) e nao
-- mostrar "EBD: Nao" para quem nunca respondeu.
alter table public.equipantes alter column frequenta_ebd drop default;
update public.equipantes set frequenta_ebd = null where frequenta_ebd is not null;

comment on column public.equipantes.lider_grupo_cuidado is
  'Nome do lider do Grupo de Cuidado (so igreja 64, quando frequenta_grupo_cuidado = true). 20261026f';

-- Camada 3 -------------------------------------------------------------------
do $$
declare
  v_def text := pg_get_functiondef('public._dados_inscricao_validos(jsonb,text)'::regprocedure);
  v_novo text;
  v_trecho text := $t$    if lower(coalesce(p_dados ->> 'so_domingo', '')) not in ('true', 't', 'sim')
       and (nullif(btrim(coalesce(p_dados ->> 'area_trabalho_opcao1', '')), '') is null$t$;
begin
  if position(v_trecho in v_def) = 0 then
    raise exception 'trecho nao encontrado em _dados_inscricao_validos';
  end if;
  v_novo := replace(v_def, v_trecho, $n$    -- Igreja 64 (20261026f): Grupo de Cuidado e EBD separados e obrigatorios.
    if lower(coalesce(p_dados ->> 'esta_afastado', '')) in ('true', 't', 'sim')
       and btrim(coalesce(p_dados ->> 'igreja', '')) ~ '^0*64 - ' then
      if lower(coalesce(p_dados ->> 'frequenta_grupo_cuidado', '')) not in ('true', 'false', 't', 'f') then
        return 'GRUPO_CUIDADO_OBRIGATORIO';
      end if;
      if lower(p_dados ->> 'frequenta_grupo_cuidado') in ('true', 't')
         and nullif(btrim(coalesce(p_dados ->> 'lider_grupo_cuidado', '')), '') is null then
        return 'LIDER_GRUPO_OBRIGATORIO';
      end if;
      if lower(coalesce(p_dados ->> 'frequenta_ebd', '')) not in ('true', 'false', 't', 'f') then
        return 'EBD_OBRIGATORIA';
      end if;
    end if;
$n$ || v_trecho);
  v_novo := replace(v_novo,
    $a$array['pastor_nome', 'quem_indicou_nome', 'nome_familiar_conhecido', 'familiar_nome']$a$,
    $a$array['pastor_nome', 'quem_indicou_nome', 'nome_familiar_conhecido', 'familiar_nome', 'lider_grupo_cuidado']$a$);
  if position('''lider_grupo_cuidado'']' in v_novo) = 0 then
    raise exception 'trecho nao encontrado (lista de nomes) em _dados_inscricao_validos';
  end if;
  execute v_novo;
end $$;

-- Camada 4 -------------------------------------------------------------------
do $$
declare
  v_def text := pg_get_functiondef('public._validar_ficha()'::regprocedure);
  v_trecho text := $t$array['pastor_nome', 'familiar_nome', 'quem_indicou_nome', 'nome_familiar_conhecido']$t$;
begin
  if position(v_trecho in v_def) = 0 then
    raise exception 'trecho nao encontrado em _validar_ficha';
  end if;
  execute replace(v_def, v_trecho,
    $n$array['pastor_nome', 'familiar_nome', 'quem_indicou_nome', 'nome_familiar_conhecido', 'lider_grupo_cuidado']$n$);
end $$;

-- Reinscricao ----------------------------------------------------------------
do $$
declare
  v_def text := pg_get_functiondef('public.criar_inscricao(text,jsonb,text)'::regprocedure);
  v_trecho text := $t$        frequenta_grupo_cuidado      = v_e.frequenta_grupo_cuidado,$t$;
begin
  if position(v_trecho in v_def) = 0 then
    raise exception 'trecho nao encontrado em criar_inscricao';
  end if;
  execute replace(v_def, v_trecho, v_trecho || $n$
        lider_grupo_cuidado          = v_e.lider_grupo_cuidado,$n$);
end $$;
