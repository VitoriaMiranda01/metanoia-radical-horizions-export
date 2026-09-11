-- =====================================================================
-- Passo 2, Etapa 4 -- funcoes publicas controladas (RPCs)
-- =====================================================================
--
-- POR QUE ISTO EXISTE
-- -------------------
-- Hoje o visitante deslogado fala DIRETO com as tabelas para se inscrever,
-- conferir se ja tem cadastro, ver preco e validar cupom. Isso obriga o
-- papel "anon" a ter acesso amplo -- e e por isso que a base inteira esta
-- legivel por qualquer um.
--
-- Estas funcoes substituem esses acessos diretos: cada uma devolve SO o que
-- a tela precisa. Depois que o site passar a usa-las, o acesso direto de
-- "anon" as tabelas pode ser revogado (script separado).
--
-- SEGURANCA
-- ---------
-- Todas sao SECURITY DEFINER com search_path fixo. SECURITY DEFINER faz a
-- funcao rodar com os privilegios do dono (postgres), ignorando RLS -- e
-- exatamente o que queremos: a funcao enxerga a tabela, quem chama nao.
-- O search_path fixo fecha a escalacao classica por tabela falsa.
--
-- ESTE SCRIPT E ADITIVO E NAO QUEBRA NADA.
-- Criar funcao nova nao altera o que ja existe. Enquanto o site nao usar
-- estas funcoes, tudo continua como esta. O passo que de fato tranca as
-- tabelas e outro arquivo, aplicado depois.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Helper interno: sorteio do grupo de trilha.
-- Antes isso era feito no navegador (escolherGrupoTrailha, em
-- acampantesService.js), o que exigia ler a tabela de acampantes inteira
-- so para contar. Agora o servidor decide.
-- ---------------------------------------------------------------------
create or replace function public._escolher_grupo_trailha(p_sexo text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  -- Entre os 5 grupos fixos, o que tem menos gente do mesmo sexo.
  select g.nome
  from (values ('Vermelho'),('Amarelo'),('Verde'),('Azul'),('Roxo')) as g(nome)
  left join public.acampantes a
    on a.grupo_trailha = g.nome
   and a.sexo is not distinct from p_sexo
  group by g.nome
  order by count(a.id) asc, g.nome asc
  limit 1;
$$;


-- ---------------------------------------------------------------------
-- 1) Configuracao publica
--
-- Devolve preco, datas e se as inscricoes estao abertas. NAO devolve as
-- colunas cpfs_area_guia / cpfs_area_inimigo / cpfs_area_espirito_santo,
-- que sao listas de CPF de uso interno e hoje vazam junto no select do site.
-- ---------------------------------------------------------------------
create or replace function public.config_publica()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'edicao_numero',                   c.edicao_numero,
    'data_evento_inicio',              c.data_evento_inicio,
    'data_evento_fim',                 c.data_evento_fim,
    'horario_saida_igreja',            c.horario_saida_igreja,
    'horario_retorno_sitio',           c.horario_retorno_sitio,
    'data_limite_inscricao_pagamento', c.data_limite_inscricao_pagamento,
    'inscricoes_acampantes',           c.inscricoes_acampantes,
    'inscricoes_equipantes',           c.inscricoes_equipantes,
    'acampante_pricing_periods',       coalesce(c.acampante_pricing_periods, '[]'::jsonb),
    'equipante_pricing_periods',       coalesce(c.equipante_pricing_periods, '[]'::jsonb),
    'limite_acampantes_por_igreja',    c.limite_acampantes_por_igreja,
    'max_acampantes',                  c.max_acampantes,
    'max_equipantes',                  c.max_equipantes,
    'max_acampantes_homens',           c.max_acampantes_homens,
    'max_acampantes_mulheres',         c.max_acampantes_mulheres,
    'updated_at',                      c.updated_at
  )
  from public.configuracoes c
  order by c.edicao_numero desc
  limit 1;
$$;


-- ---------------------------------------------------------------------
-- 2) Conferir se ja existe inscricao
--
-- Substitui verificarCPF/verificarNome, que hoje fazem select('*') e
-- devolvem a FICHA INTEIRA de outra pessoa (endereco, condicoes medicas,
-- medicamentos, contato de emergencia) so para responder "ja existe?".
--
-- Devolve o minimo que o fluxo precisa: se existe, se ja pagou e -- apenas
-- quando NAO pagou -- o id e o nome, porque a tela leva a pessoa direto
-- para o pagamento pendente. Quem ja pagou nao recebe nada alem do "existe".
-- ---------------------------------------------------------------------
create or replace function public.verificar_inscricao(
  p_tipo text,
  p_cpf  text default null,
  p_nome text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id     uuid;
  v_nome   text;
  v_status text;
  v_pago   boolean;
  v_cpf    text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
begin
  if v_cpf = '' and coalesce(p_nome, '') = '' then
    return jsonb_build_object('existe', false, 'pago', false);
  end if;

  if p_tipo = 'equipante' then
    select e.id, e.nome, e.status_pagamento into v_id, v_nome, v_status
    from public.equipantes e
    where (v_cpf <> '' and regexp_replace(coalesce(e.cpf,''), '\D', '', 'g') = v_cpf)
       or (v_cpf =  '' and e.nome ilike p_nome)
    limit 1;
  else
    select a.id, a.nome, a.status_pagamento into v_id, v_nome, v_status
    from public.acampantes a
    where (v_cpf <> '' and regexp_replace(coalesce(a.cpf,''), '\D', '', 'g') = v_cpf)
       or (v_cpf =  '' and a.nome ilike p_nome)
    limit 1;
  end if;

  if v_id is null then
    return jsonb_build_object('existe', false, 'pago', false);
  end if;

  v_pago := lower(coalesce(v_status, '')) in ('pago', 'confirmado', 'completed');

  if v_pago then
    -- Quem ja pagou nao precisa continuar nada: nao devolvemos dado nenhum.
    return jsonb_build_object('existe', true, 'pago', true);
  end if;

  return jsonb_build_object(
    'existe', true,
    'pago',   false,
    'id',     v_id,
    'nome',   v_nome
  );
end;
$$;


-- ---------------------------------------------------------------------
-- 3) Ocupacao de vagas por igreja
--
-- Substitui fetchOcupacaoIgrejasAcampantes, que hoje baixa a coluna
-- admin_responsavel de TODOS os acampantes so para contar.
-- ---------------------------------------------------------------------
create or replace function public.ocupacao_igrejas()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg(t.igreja, t.qtd), '{}'::jsonb)
  from (
    select a.admin_responsavel as igreja, count(*) as qtd
    from public.acampantes a
    where a.admin_responsavel is not null
      and a.admin_responsavel <> ''
    group by a.admin_responsavel
  ) t;
$$;


-- ---------------------------------------------------------------------
-- 4) Validar cupom
--
-- Substitui findActiveCouponByCode, que hoje faz select('*') em "cupons" --
-- e, como a tabela e legivel, permite LISTAR todos os cupons e usar o de
-- maior desconto. Aqui so sai o desconto do codigo perguntado.
-- ---------------------------------------------------------------------
create or replace function public.validar_cupom(p_codigo text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select jsonb_build_object('valido', true, 'desconto', c.desconto_fixo)
     from public.cupons c
     where upper(c.codigo) = upper(trim(coalesce(p_codigo, '')))
       and c.ativo = true
     limit 1),
    jsonb_build_object('valido', false, 'desconto', 0)
  );
$$;


-- ---------------------------------------------------------------------
-- 5) Criar inscricao
--
-- Recebe o MESMO objeto que o site ja monta hoje (mapAcampanteToDb /
-- mapEquipanteToDb), entao nao exige reescrever o mapeamento do formulario.
-- O que muda e que o servidor passa a mandar nos campos sensiveis: status de
-- pagamento, dados de transacao, aprovacao e grupo de trilha -- nenhum deles
-- pode mais ser escolhido pelo navegador.
--
-- Devolve so o id. O site nao precisa de mais nada para seguir ao pagamento.
-- ---------------------------------------------------------------------
create or replace function public.criar_inscricao(p_tipo text, p_dados jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := gen_random_uuid();
  v_a  public.acampantes;
  v_e  public.equipantes;
begin
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' then
    raise exception 'DADOS_INVALIDOS';
  end if;

  if p_tipo = 'equipante' then
    v_e := jsonb_populate_record(null::public.equipantes, p_dados);

    v_e.id                  := v_id;
    v_e.status_pagamento    := 'pendente';
    v_e.data_pagamento      := null;
    v_e.id_transacao_sicoob := null;
    v_e.status              := 'pendente';   -- aprovacao pastoral
    v_e.scale_status        := 'pendente';

    insert into public.equipantes select (v_e).*;
  else
    v_a := jsonb_populate_record(null::public.acampantes, p_dados);

    v_a.id                       := v_id;
    v_a.status_pagamento         := 'pendente';
    v_a.data_pagamento           := null;
    v_a.id_transacao_sicoob      := null;
    v_a.txid_pix                 := null;
    v_a.observacoes_organizador  := null;
    -- Sorteio feito pelo servidor (ver _escolher_grupo_trailha).
    v_a.grupo_trailha            := public._escolher_grupo_trailha(v_a.sexo);

    insert into public.acampantes select (v_a).*;
  end if;

  return jsonb_build_object('id', v_id);
end;
$$;


-- ---------------------------------------------------------------------
-- Permissoes
--
-- O visitante deslogado precisa poder chamar estas funcoes -- e so elas.
-- O helper de sorteio NAO e exposto: so a criacao de inscricao o usa.
-- ---------------------------------------------------------------------
revoke all on function public._escolher_grupo_trailha(text) from public, anon, authenticated;

grant execute on function public.config_publica()                     to anon, authenticated;
grant execute on function public.verificar_inscricao(text,text,text)  to anon, authenticated;
grant execute on function public.ocupacao_igrejas()                   to anon, authenticated;
grant execute on function public.validar_cupom(text)                  to anon, authenticated;
grant execute on function public.criar_inscricao(text,jsonb)          to anon, authenticated;
