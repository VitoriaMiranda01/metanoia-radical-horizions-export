-- Ficha anterior so pelo CPF (04/11/2026, Patrick)
--
-- Pedido: quem digita um CPF que ja tem ficha cai DIRETO no formulario
-- preenchido -- sem a tela "Você já participou antes" pedindo o nome completo.
-- Quem nao tem CPF preenche do zero (nao muda nada aqui).
--
-- Risco aceito pelo Patrick (04/11): quem souber o CPF de alguem ve a ficha
-- anterior dessa pessoa (contato, saude, igreja, contato de emergencia).
--
--  * ficha_para_reinscricao: p_nome passa a ser OPCIONAL. Vazio = so CPF.
--    Informado, ainda precisa bater (compatibilidade).
--  * resetar_para_nova_edicao: quem foi escalado na edicao que terminou fica
--    com edicao_trabalhou = essa edicao SEMPRE (antes so preenchia se estava
--    vazio, e a ficha ficava com uma edicao velha).

create or replace function public.ficha_para_reinscricao(p_cpf text, p_nome text default null)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  e        public.equipantes%rowtype;
  v_cpf    text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_nome   text := public.unaccent_simples(
                     lower(btrim(regexp_replace(coalesce(p_nome, ''), '\s+', ' ', 'g'))));
  v_conf   boolean;
begin
  if length(v_cpf) <> 11 then
    return jsonb_build_object('ok', false, 'erro',
      'Informe o CPF usado na inscrição anterior.');
  end if;

  select * into e
    from public.equipantes q
   where regexp_replace(coalesce(q.cpf,''), '\D', '', 'g') = v_cpf
     and q.tipo = 'equipante'
   limit 1;

  if not found
     or (v_nome <> '' and public.unaccent_simples(
          lower(btrim(regexp_replace(coalesce(e.nome,''), '\s+', ' ', 'g')))) <> v_nome)
  then
    return jsonb_build_object('ok', false, 'erro',
      'Não encontramos uma inscrição anterior com esse CPF. '
      || 'Preencha o formulário do zero.');
  end if;

  if coalesce(e.inscrito, false) then
    return jsonb_build_object('ok', false, 'ja_inscrito', true, 'erro',
      'Você já está inscrito nesta edição.');
  end if;

  v_conf := e.inscricao_manual_em is null or e.ficha_confirmada_em is not null;

  return jsonb_build_object('ok', true, 'ficha', jsonb_build_object(
    'nome',                         e.nome,
    'cpf',                          e.cpf,
    'sexo',                         e.sexo,
    'data_nascimento',              e.data_nascimento,
    'whatsapp',                     e.whatsapp,
    'telefone_residencial',         e.telefone_residencial,
    'telefone',                     e.telefone,
    'tem_problema_saude',           case when v_conf then e.tem_problema_saude end,
    'condicoes_medicas',            e.condicoes_medicas,
    'tem_restricao_alimentar',      case when v_conf then e.tem_restricao_alimentar end,
    'restricoes_alimentares',       e.restricoes_alimentares,
    'igreja',                       e.igreja,
    'igreja_outra',                 e.igreja_outra,
    'e_pastor',                     e.e_pastor,
    'e_pastor_outro',               e.e_pastor_outro,
    'pastor_nome',                  e.pastor_nome,
    'esta_afastado',                e.esta_afastado,
    'cargo_igreja',                 e.cargo_igreja,
    'cargo_igreja_outro',           e.cargo_igreja_outro,
    'frequenta_ebd',                e.frequenta_ebd,
    'frequenta_grupo_cuidado',      case when v_conf then e.frequenta_grupo_cuidado end,
    'voce_canta',                   case when v_conf then e.voce_canta end,
    'toca_instrumento',             case when v_conf then e.toca_instrumento end,
    'familiar_trabalhando',         e.familiar_trabalhando,
    'familiar_trabalhando_outro',   e.familiar_trabalhando_outro,
    'parentesco',                   e.parentesco,
    'familiar_nome',                e.familiar_nome,
    'qual_radical_acampante',       e.qual_radical_acampante,
    'qual_radical_acampante_outro', e.qual_radical_acampante_outro,
    'numero_edicao_participou',     e.numero_edicao_participou,
    'ja_trabalhou_equipe',          case when v_conf or e.ja_trabalhou_equipe then e.ja_trabalhou_equipe end,
    'edicao_trabalhou',             e.edicao_trabalhou,
    'autorizacao_imagem',           e.autorizacao_imagem,
    'contato_emergencia_nome',      e.contato_emergencia_nome,
    'contato_emergencia_telefone',  e.contato_emergencia_telefone
  ));
end;
$function$;

do $$
declare
  v_def  text := pg_get_functiondef(
    'public.resetar_para_nova_edicao(integer,date,date,date,date,date)'::regprocedure);
  v_novo text;
begin
  v_novo := regexp_replace(v_def,
    'edicao_trabalhou\s*=\s*coalesce\(nullif\(btrim\(coalesce\(q\.edicao_trabalhou,''''\)\), ''''\),\s*v_edicao_ant::text\)',
    'edicao_trabalhou    = v_edicao_ant::text');
  if v_novo = v_def then
    raise exception 'trecho não encontrado em resetar_para_nova_edicao (edicao_trabalhou)';
  end if;
  execute v_novo;
end;
$$;
