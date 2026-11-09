-- 20261109b -- Observacao da aprovacao (equipantes)
--
-- Pedido do Patrick (09/11/2026): um campo de anotacao na Aprovacao da
-- equipe. NAO e obrigatorio para aprovar nem para rejeitar; e so um
-- adicional. Quem escreve e le: organizadores (com aprovacao_equipe) e
-- parceiros da igreja da ficha -- a mesma regra de quem aprova
-- (_quem_decide_equipante). Pode ser editada sempre (pendente, aprovada ou
-- rejeitada). Aparece na Aprovacao e na ficha, junto do "Aprovado por".
--
-- Quem gravou e quando: carimbados pelo servidor a partir do cracha (como o
-- decidido_por), nunca pelo navegador.
--
-- Colunas SEM NOT NULL (criar_inscricao usa jsonb_populate_record; ver o
-- incidente de 15/10).
--
-- Guarda (gatilho): so a funcao salvar_observacao_aprovacao muda estas
-- colunas. Assim o formulario publico (criar_inscricao, que popula a linha a
-- partir do JSON enviado) nao consegue gravar uma observacao, e um UPDATE
-- direto na tabela tambem nao. Na virada (inscrito true -> false) a
-- observacao sai junto, como o "Aprovado por". O desfazer_virada desliga os
-- gatilhos e devolve a linha inteira, observacao inclusive.

alter table public.equipantes
  add column if not exists observacao_aprovacao        text,
  add column if not exists observacao_aprovacao_por    text,
  add column if not exists observacao_aprovacao_origem text,
  add column if not exists observacao_aprovacao_em     timestamptz;

create or replace function public._observacao_aprovacao_guarda()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if coalesce(current_setting('metanoia.salvando_observacao', true), '') = 'sim' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.observacao_aprovacao        := null;
    new.observacao_aprovacao_por    := null;
    new.observacao_aprovacao_origem := null;
    new.observacao_aprovacao_em     := null;
    return new;
  end if;

  -- Virada: a ficha deixa de ser inscricao desta edicao.
  if old.inscrito is true and new.inscrito is not true then
    new.observacao_aprovacao        := null;
    new.observacao_aprovacao_por    := null;
    new.observacao_aprovacao_origem := null;
    new.observacao_aprovacao_em     := null;
    return new;
  end if;

  new.observacao_aprovacao        := old.observacao_aprovacao;
  new.observacao_aprovacao_por    := old.observacao_aprovacao_por;
  new.observacao_aprovacao_origem := old.observacao_aprovacao_origem;
  new.observacao_aprovacao_em     := old.observacao_aprovacao_em;
  return new;
end;
$function$;
revoke all on function public._observacao_aprovacao_guarda() from public, anon, authenticated;

drop trigger if exists observacao_aprovacao_guarda on public.equipantes;
create trigger observacao_aprovacao_guarda
  before insert or update on public.equipantes
  for each row execute function public._observacao_aprovacao_guarda();

create or replace function public.salvar_observacao_aprovacao(p_id uuid, p_texto text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_alvo   public.equipantes%rowtype;
  v_quem   jsonb;
  v_texto  text := nullif(btrim(coalesce(p_texto, '')), '');
  v_nome   text;
  v_origem text;
  v_quando timestamptz := now();
begin
  if v_texto is not null and char_length(v_texto) > 1000 then
    return jsonb_build_object('ok', false, 'erro', 'A observação pode ter no máximo 1000 caracteres.');
  end if;

  select * into v_alvo
    from public.equipantes e
   where e.id = p_id and e.tipo = 'equipante';
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Inscrição não encontrada.');
  end if;
  if v_alvo.inscrito is not true then
    return jsonb_build_object('ok', false, 'erro', 'Esta pessoa ainda não se inscreveu nesta edição.');
  end if;

  v_quem := public._quem_decide_equipante(v_alvo.igreja);
  if not (v_quem ->> 'ok')::boolean then
    return jsonb_build_object('ok', false, 'erro',
      case when (v_quem ->> 'erro') like 'Só %' then 'Só organizadores e parceiros podem escrever a observação.'
           else v_quem ->> 'erro' end);
  end if;
  v_nome   := v_quem ->> 'nome';
  v_origem := case when v_quem ->> 'tipo' = 'parceiro'
                   then coalesce(v_quem ->> 'igreja', 'igreja parceira')
                   else 'organizador' end;

  perform set_config('metanoia.salvando_observacao', 'sim', true);
  update public.equipantes set
    observacao_aprovacao        = v_texto,
    observacao_aprovacao_por    = case when v_texto is null then null else v_nome end,
    observacao_aprovacao_origem = case when v_texto is null then null else v_origem end,
    observacao_aprovacao_em     = case when v_texto is null then null else v_quando end
  where id = p_id;
  perform set_config('metanoia.salvando_observacao', '', true);

  return jsonb_build_object(
    'ok', true,
    'observacao_aprovacao', v_texto,
    'observacao_aprovacao_por', case when v_texto is null then null else v_nome end,
    'observacao_aprovacao_origem', case when v_texto is null then null else v_origem end,
    'observacao_aprovacao_em', case when v_texto is null then null else v_quando end);
end;
$function$;
revoke all on function public.salvar_observacao_aprovacao(uuid, text) from public, anon;
grant execute on function public.salvar_observacao_aprovacao(uuid, text) to authenticated;
