-- ---------------------------------------------------------------------------
-- O equipante so paga DEPOIS de ser escalado
--
-- Achado pelo Patrick em 12/09/2026, testando a inscricao como as pessoas
-- farao amanha: ele se inscreveu e caiu direto na tela de pagamento.
--
-- O DEFEITO
-- ---------
-- A tela "Acompanhamento da Inscricao" lia a tabela equipantes DIRETO
-- (getEquipanteWorkflow fazia um select). Quem esta se inscrevendo NAO esta
-- logado -- entao, desde o travamento das tabelas (20260911c), essa consulta
-- levava 401. O componente engolia o erro, a lista de etapas ficava vazia, e
-- o botao era liberado por causa disto:
--
--     [].every(etapa => etapa.status === 'ok')   // true em JavaScript
--
-- Uma lista vazia satisfaz "todas as etapas estao ok". Resultado: quem
-- acabava de se inscrever via a tela sem etapa nenhuma e com o botao
-- "Ir para Pagamento" ativo.
--
-- A REGRA (definida com o Patrick em 12/09/2026)
-- ----------------------------------------------
-- O equipante paga a taxa de alimentacao como ULTIMO passo, e so depois de
-- ser escalado numa area. A divulgacao das escalas acontece na segunda
-- reuniao de equipe. Ate la ele fica na tela de situacao, aguardando.
--
-- A CORRECAO
-- ----------
-- Duas funcoes publicas novas, com a MESMA prova de dono das funcoes de
-- pagamento (CPF, ou o nome de quem se inscreveu sem CPF):
--
--   situacao_inscricao        conta em que etapa a pessoa esta e, o mais
--                             importante, devolve `pode_pagar`. Quem decide
--                             isso e o SERVIDOR -- a tela nao calcula mais
--                             nada. Sem resposta, a tela assume false
--                             (falha fechada).
--
--   registrar_autorizacao_pais grava o arquivo do menor de idade. Escrever
--                             direto na tabela tambem levava 401, entao o
--                             upload do menor estava quebrado pelo mesmo
--                             motivo.
--
-- A AREA NAO E DEVOLVIDA de proposito: quem anuncia a escala e a reuniao,
-- nao o site. A pessoa so descobre que foi escalada porque o pagamento
-- abriu.
-- ---------------------------------------------------------------------------

create or replace function public.situacao_inscricao(
  p_tipo text, p_id uuid, p_cpf text default null, p_nome text default null
)
returns jsonb
language plpgsql stable security definer
set search_path to 'public'
as $fn$
declare
  q          record;
  v_escalado boolean;
  v_pago     boolean;
  v_menor    boolean;
begin
  -- Organizador logado tambem le, para a tela administrativa.
  if not (public.eh_organizador() or public._inscricao_e_sua(p_tipo, p_id, p_cpf, p_nome)) then
    return jsonb_build_object('ok', false, 'erro',
      'Confirme o CPF (ou o nome) usado na inscrição.');
  end if;

  if p_tipo <> 'equipante' then
    select a.nome, a.status_pagamento into q from public.acampantes a where a.id = p_id;
    if not found then
      return jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada.');
    end if;
    v_pago := lower(coalesce(q.status_pagamento,'')) in ('pago','confirmado','completed');
    return jsonb_build_object('ok', true, 'tipo', 'acampante', 'nome', q.nome,
                              'pago', v_pago, 'pode_pagar', not v_pago);
  end if;

  select e.nome, e.idade, e.status, e.status_pagamento, e.parental_auth_file_url
    into q
    from public.equipantes e
   where e.id = p_id and e.tipo = 'equipante';

  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada.');
  end if;

  -- Estar escalado e TER LINHA em escalas -- a mesma verdade que a tela do
  -- organizador usa. scale_status e so um espelho, pode ficar para tras.
  v_escalado := exists (select 1 from public.escalas s where s.equipante_id = p_id);
  v_pago     := lower(coalesce(q.status_pagamento,'')) in ('pago','confirmado','completed');
  v_menor    := coalesce(q.idade, 18) < 18;

  return jsonb_build_object(
    'ok', true,
    'tipo', 'equipante',
    'nome', q.nome,
    'menor_de_idade', v_menor,
    'autorizacao_pais_enviada', q.parental_auth_file_url is not null,
    'aprovacao', coalesce(q.status, 'pendente'),
    'escalado', v_escalado,
    'pago', v_pago,
    'pode_pagar', (coalesce(q.status,'') = 'aprovado')
                  and v_escalado
                  and (not v_menor or q.parental_auth_file_url is not null)
                  and not v_pago
  );
end;
$fn$;
revoke all on function public.situacao_inscricao(text, uuid, text, text) from public;
grant execute on function public.situacao_inscricao(text, uuid, text, text) to anon, authenticated;


create or replace function public.registrar_autorizacao_pais(
  p_id uuid, p_url text, p_cpf text default null, p_nome text default null
)
returns jsonb
language plpgsql security definer
set search_path to 'public'
as $fn$
declare v_afetadas int;
begin
  if not public._inscricao_e_sua('equipante', p_id, p_cpf, p_nome) then
    return jsonb_build_object('ok', false, 'erro',
      'Confirme o CPF (ou o nome) usado na inscrição.');
  end if;

  if coalesce(btrim(p_url),'') = '' then
    return jsonb_build_object('ok', false, 'erro', 'Arquivo não informado.');
  end if;

  update public.equipantes set parental_auth_file_url = p_url
   where id = p_id and tipo = 'equipante';

  get diagnostics v_afetadas = row_count;
  if v_afetadas = 0 then
    return jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada.');
  end if;

  return jsonb_build_object('ok', true);
end;
$fn$;
revoke all on function public.registrar_autorizacao_pais(uuid, text, text, text) from public;
grant execute on function public.registrar_autorizacao_pais(uuid, text, text, text) to anon, authenticated;


-- ---------------------------------------------------------------------
-- CONFERENCIA (4 equipantes de teste, um em cada etapa, chamando de fora
-- com a chave publica e o CPF de cada um)
-- ---------------------------------------------------------------------
--   aguarda a igreja ..... aprovacao=pendente escalado=false  pode_pagar=false
--   aprovado sem escala .. aprovacao=aprovado escalado=false  pode_pagar=false
--   escalado ............. aprovacao=aprovado escalado=true   pode_pagar=TRUE
--   menor escalado ....... sem autorizacao dos pais           pode_pagar=false
--
--   sem CPF nenhum ....... "Confirme o CPF (ou o nome)..."
--   CPF de outra pessoa .. "Confirme o CPF (ou o nome)..."
--
-- Na tela: o aprovado-sem-escala ve "Tudo certo até aqui. Agora é aguardar
-- a escala..." e NAO tem botao de pagamento; o escalado ve o botao "Pagar a
-- taxa de alimentação" e chega na Forma de Pagamento.
-- ---------------------------------------------------------------------
