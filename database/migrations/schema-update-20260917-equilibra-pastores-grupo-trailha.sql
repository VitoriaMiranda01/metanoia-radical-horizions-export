-- Equilibra a quantidade de pastores entre os grupos de trilha, na hora da
-- inscricao do acampante.
--
-- "E pastor" = quem marcou 'PASTOR(A)' ou 'PASTOR(A) AUXILIAR' no campo
-- "Cargo na igreja" da propria inscricao (acampantes.cargo_igreja) -- nao
-- existe (nem foi criado) um campo booleano separado; o dado ja e
-- preenchido pelo proprio inscrito, sem precisar mudar o formulario.
--
-- Pedido do Patrick: para quem e pastor, o grupo com MENOS pastores ganha
-- -- mesmo que isso nao seja o grupo com menos gente daquele sexo (pastor
-- tem prioridade sobre o equilibrio por sexo). Para quem nao e pastor,
-- nada muda: a conta de pastores empata em zero entre os cinco grupos (a
-- condicao do FILTER usa p_cargo_igreja, que e o mesmo pra todo o grupo
-- na mesma chamada, entao ou conta em todos ou em nenhum) e o desempate
-- cai direto no sexo, exatamente como sempre foi.
--
-- So vale para quem se inscreve DAQUI PRA FRENTE -- nao reprocessa quem ja
-- tem grupo_trailha preenchido.
create or replace function public._escolher_grupo_trailha(p_sexo text, p_cargo_igreja text default null)
 returns text
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select g.nome
  from (values ('Vermelho'),('Amarelo'),('Verde'),('Azul'),('Roxo')) as g(nome)
  left join public.acampantes a
    on a.grupo_trailha = g.nome
  group by g.nome
  order by
    count(a.id) filter (
      where p_cargo_igreja in ('PASTOR(A)', 'PASTOR(A) AUXILIAR')
        and a.cargo_igreja in ('PASTOR(A)', 'PASTOR(A) AUXILIAR')
    ) asc,
    count(a.id) filter (where a.sexo is not distinct from p_sexo) asc,
    g.nome asc
  limit 1;
$function$;

-- Unico lugar que chama _escolher_grupo_trailha (confirmado via
-- pg_get_functiondef antes desta migration): agora manda tambem o cargo
-- na igreja, que ja esta disponivel em v_a nesse ponto (jsonb_populate_record
-- ja rodou logo acima).
create or replace function public.criar_inscricao(p_tipo text, p_dados jsonb, p_chave text DEFAULT NULL::text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare
  v_id      uuid := gen_random_uuid();
  v_a       public.acampantes;
  v_e       public.equipantes;
  v_atual   public.equipantes%rowtype;
  v_aberto  boolean;
  v_nome    text;
  v_metodo  text;
  v_cpf     text;
  v_edicao  int;
begin
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' then
    raise exception 'DADOS_INVALIDOS';
  end if;

  select case when p_tipo = 'equipante' then c.inscricoes_equipantes
              else c.inscricoes_acampantes end,
         c.edicao_numero
    into v_aberto, v_edicao
  from public.configuracoes c
  limit 1;

  if coalesce(v_aberto, false) is not true
     and not public.liberacao_valida(p_chave, p_tipo) then
    raise exception 'INSCRICOES_FECHADAS';
  end if;

  v_nome := btrim(coalesce(p_dados ->> 'nome', ''));
  if length(v_nome) < 3 then
    raise exception 'NOME_OBRIGATORIO';
  end if;

  v_metodo := p_dados ->> 'metodo_pagamento';
  if v_metodo is not null and v_metodo not in ('pix', 'manual') then
    v_metodo := null;
  end if;

  if p_tipo = 'equipante' then
    v_cpf := nullif(regexp_replace(coalesce(p_dados ->> 'cpf', ''), '\D', '', 'g'), '');

    if v_cpf is not null then
      select * into v_atual
        from public.equipantes q
       where regexp_replace(coalesce(q.cpf,''), '\D', '', 'g') = v_cpf
       limit 1;
    end if;

    if v_atual.id is not null then
      if coalesce(v_atual.inscrito, false) then
        raise exception 'JA_INSCRITO';
      end if;

      v_e := jsonb_populate_record(v_atual, p_dados);

      update public.equipantes set
        nome                         = v_nome,
        sexo                         = v_e.sexo,
        data_nascimento              = v_e.data_nascimento,
        whatsapp                     = v_e.whatsapp,
        telefone_residencial         = v_e.telefone_residencial,
        telefone                     = v_e.telefone,
        tem_problema_saude           = v_e.tem_problema_saude,
        condicoes_medicas            = v_e.condicoes_medicas,
        tem_restricao_alimentar      = v_e.tem_restricao_alimentar,
        restricoes_alimentares       = v_e.restricoes_alimentares,
        igreja                       = v_e.igreja,
        igreja_outra                 = v_e.igreja_outra,
        e_pastor                     = v_e.e_pastor,
        e_pastor_outro               = v_e.e_pastor_outro,
        pastor_nome                  = v_e.pastor_nome,
        esta_afastado                = v_e.esta_afastado,
        cargo_igreja                 = v_e.cargo_igreja,
        cargo_igreja_outro           = v_e.cargo_igreja_outro,
        frequenta_ebd                = v_e.frequenta_ebd,
        frequenta_grupo_cuidado      = v_e.frequenta_grupo_cuidado,
        voce_canta                   = v_e.voce_canta,
        toca_instrumento             = v_e.toca_instrumento,
        familiar_trabalhando         = v_e.familiar_trabalhando,
        familiar_trabalhando_outro   = v_e.familiar_trabalhando_outro,
        parentesco                   = v_e.parentesco,
        familiar_nome                = v_e.familiar_nome,
        qual_radical_acampante       = v_e.qual_radical_acampante,
        qual_radical_acampante_outro = v_e.qual_radical_acampante_outro,
        numero_edicao_participou     = v_e.numero_edicao_participou,
        ja_trabalhou_equipe          = v_e.ja_trabalhou_equipe,
        edicao_trabalhou             = v_e.edicao_trabalhou,
        autorizacao_imagem           = v_e.autorizacao_imagem,
        contato_emergencia_nome      = v_e.contato_emergencia_nome,
        contato_emergencia_telefone  = v_e.contato_emergencia_telefone,
        area_trabalho_opcao1         = v_e.area_trabalho_opcao1,
        area_trabalho_opcao2         = v_e.area_trabalho_opcao2,
        area_trabalho_opcao3         = v_e.area_trabalho_opcao3,
        area_trabalho_extra          = v_e.area_trabalho_extra,
        -- daqui para baixo quem manda e o servidor
        tipo                         = 'equipante',
        status                       = 'pendente',
        scale_status                 = 'pendente',
        inscrito                     = true,
        numero_edicao                = v_edicao,
        metodo_pagamento             = v_metodo,
        status_pagamento             = 'pendente',
        data_pagamento               = null,
        id_transacao_sicoob          = null,
        txid_pix                     = null,
        parental_auth_file_url       = null,
        decidido_por                 = null,
        decidido_por_tipo            = null,
        decidido_por_igreja          = null,
        decidido_em                  = null
      where id = v_atual.id;

      return jsonb_build_object('id', v_atual.id, 'reinscricao', true);
    end if;

    v_e := jsonb_populate_record(null::public.equipantes, p_dados);
    v_e.id := v_id;
    v_e.nome := v_nome;
    v_e.tipo := 'equipante';
    v_e.metodo_pagamento := v_metodo;
    v_e.status_pagamento := 'pendente';
    v_e.data_pagamento := null;
    v_e.id_transacao_sicoob := null;
    v_e.txid_pix := null;
    v_e.parental_auth_file_url := null;
    v_e.status := 'pendente';
    v_e.scale_status := 'pendente';
    v_e.numero_edicao := v_edicao;
    v_e.inscrito := true;
    v_e.decidido_por := null;
    v_e.decidido_por_tipo := null;
    v_e.decidido_por_igreja := null;
    v_e.decidido_em := null;
    insert into public.equipantes select (v_e).*;
    return jsonb_build_object('id', v_id, 'reinscricao', false);
  end if;

  v_a := jsonb_populate_record(null::public.acampantes, p_dados);
  v_a.id := v_id;
  v_a.nome := v_nome;
  v_a.metodo_pagamento := v_metodo;
  v_a.status_pagamento := 'pendente';
  v_a.data_pagamento := null;
  v_a.id_transacao_sicoob := null;
  v_a.txid_pix := null;
  v_a.observacoes_organizador := null;
  v_a.grupo_trailha := public._escolher_grupo_trailha(v_a.sexo, v_a.cargo_igreja);
  insert into public.acampantes select (v_a).*;

  return jsonb_build_object('id', v_id, 'reinscricao', false);
end;
$function$;

-- CREATE OR REPLACE com uma lista de parametros diferente cria uma funcao
-- SEPARADA em vez de substituir (Postgres identifica funcao por nome +
-- tipos dos argumentos) -- a versao antiga de 1 argumento (so sexo, sem
-- pastor) fica orfa depois do CREATE OR REPLACE acima. Ninguem mais chama
-- ela (unico call site, criar_inscricao, ja manda os 2 argumentos), entao
-- e so lixo -- remove antes que alguem chame ela por engano e volte a nao
-- equilibrar pastores.
drop function if exists public._escolher_grupo_trailha(text);
