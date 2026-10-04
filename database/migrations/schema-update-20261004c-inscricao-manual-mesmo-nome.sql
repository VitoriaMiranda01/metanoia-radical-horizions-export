-- =============================================================================
-- Inscricao manual: avisa quando ja existe inscrito com o mesmo nome
-- (revisao de 04/10/2026)
--
-- Todos os inscritos pelo link tem CPF. Se a inscricao manual vier sem CPF
-- (ou com outro) de alguem que ja se inscreveu, a pessoa ficaria duas vezes.
-- Agora, com o mesmo nome (sem acento, sem diferenca de maiusculas e de
-- espacos) ja inscrito, a funcao devolve quem e e so grava se a tela
-- confirmar que e outra pessoa (confirmar_mesmo_nome = true).
-- =============================================================================

create or replace function public._nome_comparavel(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select regexp_replace(lower(translate(btrim(coalesce(p, '')),
    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
    'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')), '\s+', ' ', 'g');
$$;

revoke all on function public._nome_comparavel(text) from public, anon, authenticated;

do $m$
declare
  d text;
  ancora constant text := '  v_id := coalesce(v_atual.id, gen_random_uuid());';
begin
  d := pg_get_functiondef('public.inscricao_manual_equipante(jsonb)'::regprocedure);
  if (length(d) - length(replace(d, ancora, ''))) / length(ancora) <> 1 then
    raise exception 'trecho nao encontrado (ou repetido) em inscricao_manual_equipante';
  end if;
  execute replace(d, ancora,
'  -- Mesmo nome ja inscrito (20261004c): so grava se a tela confirmar.
  if not coalesce((p_dados ->> ''confirmar_mesmo_nome'')::boolean, false) then
    declare
      v_igual record;
    begin
      select q.id, q.nome, q.igreja, q.igreja_outra, q.data_nascimento into v_igual
        from public.equipantes q
       where coalesce(q.inscrito, false)
         and q.id is distinct from v_atual.id
         and public._nome_comparavel(q.nome) = public._nome_comparavel(v_nome)
       limit 1;
      if v_igual.id is not null then
        return jsonb_build_object(''ok'', false, ''mesmo_nome'', jsonb_build_object(
          ''id'', v_igual.id, ''nome'', v_igual.nome,
          ''igreja'', case when upper(coalesce(v_igual.igreja, '''')) = ''OUTRA''
                         then ''OUTRA — '' || coalesce(v_igual.igreja_outra, '''') else v_igual.igreja end,
          ''nascimento'', v_igual.data_nascimento),
          ''erro'', ''Já existe uma inscrição com esse nome.'');
      end if;
    end;
  end if;

' || ancora);
end;
$m$;
