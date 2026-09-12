-- ---------------------------------------------------------------------------
-- criar_inscricao: conferir a abertura das inscricoes e os dados minimos
--
-- ENCONTRADO NO TESTE COMPLETO DE 11/09/2026
-- ------------------------------------------
-- A funcao aceitava qualquer coisa vinda da API publica:
--
--   1. gravava inscricao mesmo com as inscricoes FECHADAS. A chave
--      "Inscricoes abertas" (Configuracoes) so era respeitada pelo
--      navegador; chamando a API direto dava para se inscrever fora da
--      janela -- antes da abertura ou depois do prazo;
--   2. aceitava ficha VAZIA, sem nome, CPF ou igreja. Um robo podia encher a
--      tabela de linhas em branco na vespera do dia da abertura;
--   3. deixava o proprio inscrito mandar metodo_pagamento = 'isento',
--      aparecendo para o organizador como uma isencao que ninguem concedeu.
--
-- Os campos de status (status_pagamento, status, scale_status, datas e ids de
-- transacao) ja eram forcados pelo servidor desde o Passo 2 e continuam.
--
-- CPF nao e obrigatorio de proposito: quem nao tem CPF (documento
-- estrangeiro) se inscreve pela opcao "Nao tenho CPF" e paga pela via manual.
-- A unicidade do CPF continua garantida pela constraint da tabela.
-- ---------------------------------------------------------------------------
create or replace function public.criar_inscricao(p_tipo text, p_dados jsonb)
returns jsonb
language plpgsql
security definer
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

  -- 2. Minimo de dados para a ficha existir.
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
