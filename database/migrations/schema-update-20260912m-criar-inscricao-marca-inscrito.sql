-- ---------------------------------------------------------------------------
-- criar_inscricao passa a gravar equipantes.inscrito = true
--
-- Achado pelo Patrick em 12/09/2026: depois de enviar a inscricao, ele
-- conseguiu voltar ao site e comecar um cadastro NOVO, como se nunca
-- tivesse se inscrito -- e criou uma segunda ficha.
--
-- A CAUSA
-- -------
-- A marca de "ja se inscreveu nesta edicao" era gravada pelo NAVEGADOR,
-- logo depois de criar a inscricao (updateEquipanteInscrito, um update
-- direto na tabela equipantes). Quem se inscreve nao esta logado -- entao,
-- desde o travamento das tabelas (20260911c), esse update levava 401. O
-- erro caia num catch que so mostrava um aviso generico, e a coluna
-- `inscrito` ficava nula.
--
-- Na volta, verificar_inscricao devolvia inscrito=false, e a tela
-- interpretava isso como "tem ficha de edicao anterior, mas ainda nao se
-- inscreveu nesta" -- mandando a pessoa preencher o formulario de novo.
--
-- A CORRECAO
-- ----------
-- A marca e gravada aqui dentro, junto com a propria insercao. Alem de
-- funcionar sem login, fica atomico: ou a inscricao existe ja marcada, ou
-- nao existe. Sumiu o estado intermediario "linha criada, sem a marca".
--
-- O restante da funcao nao muda -- e a mesma de
-- schema-update-20260912-criar-inscricao-valida.sql.
-- ---------------------------------------------------------------------------

create or replace function public.criar_inscricao(p_tipo text, p_dados jsonb)
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $function$
declare
  v_id uuid := gen_random_uuid();
  v_a public.acampantes;
  v_e public.equipantes;
  v_aberto boolean;
  v_nome text;
  v_metodo text;
begin
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' then
    raise exception 'DADOS_INVALIDOS';
  end if;

  -- 1. A janela de inscricao e decidida aqui, nao no navegador.
  select case when p_tipo = 'equipante' then c.inscricoes_equipantes
              else c.inscricoes_acampantes end
    into v_aberto
  from public.configuracoes c
  limit 1;

  if coalesce(v_aberto, false) is not true then
    raise exception 'INSCRICOES_FECHADAS';
  end if;

  -- 2. Minimo de dados para a ficha existir. CPF nao entra aqui de proposito:
  --    quem nao tem CPF (documento estrangeiro) se inscreve pela opcao
  --    "Nao tenho CPF" e paga pela via manual.
  v_nome := btrim(coalesce(p_dados ->> 'nome', ''));
  if length(v_nome) < 3 then
    raise exception 'NOME_OBRIGATORIO';
  end if;

  -- 3. Metodo de pagamento so pode ser o que o site oferece. 'isento' e
  --    decisao de organizador (tela de Pagamentos), nunca do proprio inscrito.
  v_metodo := p_dados ->> 'metodo_pagamento';
  if v_metodo is not null and v_metodo not in ('pix', 'manual') then
    v_metodo := null;
  end if;

  if p_tipo = 'equipante' then
    v_e := jsonb_populate_record(null::public.equipantes, p_dados);
    v_e.id := v_id;
    v_e.nome := v_nome;
    v_e.metodo_pagamento := v_metodo;
    v_e.status_pagamento := 'pendente';
    v_e.data_pagamento := null;
    v_e.id_transacao_sicoob := null;
    v_e.status := 'pendente';
    v_e.scale_status := 'pendente';
    -- A marca de "ja se inscreveu nesta edicao" e gravada AQUI.
    v_e.inscrito := true;
    insert into public.equipantes select (v_e).*;
  else
    v_a := jsonb_populate_record(null::public.acampantes, p_dados);
    v_a.id := v_id;
    v_a.nome := v_nome;
    v_a.metodo_pagamento := v_metodo;
    v_a.status_pagamento := 'pendente';
    v_a.data_pagamento := null;
    v_a.id_transacao_sicoob := null;
    v_a.txid_pix := null;
    v_a.observacoes_organizador := null;
    v_a.grupo_trailha := public._escolher_grupo_trailha(v_a.sexo);
    insert into public.acampantes select (v_a).*;
  end if;

  return jsonb_build_object('id', v_id);
end;
$function$;


-- ---------------------------------------------------------------------
-- CONFERENCIA
-- ---------------------------------------------------------------------
-- Inscricao criada pela RPC publica, e em seguida:
--   verificar_inscricao -> {"existe": true, "inscrito": true, ...}
--
-- Na tela, com o mesmo CPF: cai em "Acompanhamento da Inscricao", nao no
-- formulario de cadastro novo.
--
-- Ver tambem, no app, a mudanca de comportamento com as inscricoes
-- FECHADAS: a pagina deixou de ser bloqueada por inteiro. Quem ja se
-- inscreveu continua entrando para ver a situacao (e para pagar, o que
-- acontece justamente depois de as inscricoes fecharem); so quem NAO tem
-- inscricao e que ve "Inscricoes Encerradas".
-- ---------------------------------------------------------------------
