-- =============================================================================
-- Telefone validado e padronizado (03/10/2026)
--
-- Os campos de telefone eram texto livre: 9 WhatsApps de equipante e 5
-- telefones de acampante chegaram com digito a mais, sem DDD ou sem o 9.
-- Tres camadas: mascara no formulario, conferencia no envio e, aqui, o banco.
--
-- Regra (igual a de src/utils/telefone.js):
--   - tira tudo que nao e digito, o +55 e o 0 antes do DDD;
--   - celular: DDD existente + 9 + 8 digitos (11 digitos);
--   - fixo (10 digitos, 3o digito 2 a 5) so onde faz sentido: emergencia,
--     quem indicou, telefone residencial;
--   - quem se inscreve sem CPF (estrangeiro): 8 a 15 digitos, formato livre.
--   Grava so os digitos (estrangeiro com "+" na frente quando veio com +).
--
-- O gatilho so age quando o telefone e GRAVADO ou ALTERADO: os numeros
-- antigos que ninguem mexeu continuam como estao, e o organizador consegue
-- salvar outras alteracoes da ficha sem ser barrado por eles.
--
-- criar_inscricao confere o WhatsApp SEMPRE (e o telefone de emergencia do
-- acampante), para a reinscricao obrigar a corrigir o numero antigo errado.
-- =============================================================================

create or replace function public._telefone_normalizado(
  p_valor text, p_aceita_fixo boolean, p_estrangeiro boolean)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  d text := regexp_replace(coalesce(p_valor, ''), '\D', '', 'g');
begin
  if d = '' then
    return null;
  end if;

  if p_estrangeiro then
    if length(d) between 8 and 15 then
      return case when btrim(p_valor) like '+%' then '+' || d else d end;
    end if;
    return null;
  end if;

  if length(d) in (12, 13) and d like '55%' then d := substr(d, 3); end if;
  if length(d) in (11, 12) and d like '0%' then d := substr(d, 2); end if;

  if length(d) not in (10, 11) then return null; end if;
  if substr(d, 1, 2) not in (
      '11','12','13','14','15','16','17','18','19','21','22','24','27','28',
      '31','32','33','34','35','37','38','41','42','43','44','45','46','47',
      '48','49','51','53','54','55','61','62','63','64','65','66','67','68',
      '69','71','73','74','75','77','79','81','82','83','84','85','86','87',
      '88','89','91','92','93','94','95','96','97','98','99') then
    return null;
  end if;

  if length(d) = 11 then
    return case when substr(d, 3, 1) = '9' then d end;
  end if;
  return case when p_aceita_fixo and substr(d, 3, 1) in ('2', '3', '4', '5') then d end;
end;
$$;


-- Confere e padroniza um campo; levanta TELEFONE_INVALIDO:<campo>.
create or replace function public._telefone_do_campo(
  p_valor text, p_campo text, p_aceita_fixo boolean, p_estrangeiro boolean)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v text;
begin
  if nullif(btrim(coalesce(p_valor, '')), '') is null then
    return null;
  end if;
  v := public._telefone_normalizado(p_valor, p_aceita_fixo, p_estrangeiro);
  if v is null then
    raise exception 'TELEFONE_INVALIDO:%', p_campo;
  end if;
  return v;
end;
$$;


-- SECURITY DEFINER: o organizador que edita a ficha pela tela nao tem
-- permissao de chamar as funcoes auxiliares diretamente.
create or replace function public._padronizar_telefones()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estrangeiro boolean :=
    nullif(regexp_replace(coalesce(new.cpf, ''), '\D', '', 'g'), '') is null;
  v_novo jsonb := to_jsonb(new);
  v_velho jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  c record;
begin
  for c in
    select * from (values
      ('whatsapp', false),
      ('contato_emergencia_telefone', true),
      ('quem_indicou_telefone', true),
      ('telefone_residencial', true),
      ('telefone', true)
    ) as t(campo, aceita_fixo)
  loop
    if v_novo ? c.campo
       and (tg_op = 'INSERT' or (v_novo ->> c.campo) is distinct from (v_velho ->> c.campo)) then
      v_novo := jsonb_set(v_novo, array[c.campo],
        coalesce(to_jsonb(public._telefone_do_campo(v_novo ->> c.campo, c.campo, c.aceita_fixo, v_estrangeiro)),
                 'null'::jsonb));
    end if;
  end loop;

  new := jsonb_populate_record(new, v_novo);
  return new;
end;
$$;

drop trigger if exists trg_equipantes_telefones on public.equipantes;
create trigger trg_equipantes_telefones
  before insert or update on public.equipantes
  for each row execute function public._padronizar_telefones();

drop trigger if exists trg_acampantes_telefones on public.acampantes;
create trigger trg_acampantes_telefones
  before insert or update on public.acampantes
  for each row execute function public._padronizar_telefones();


-- criar_inscricao: o WhatsApp e obrigatorio e conferido sempre (mesmo que a
-- reinscricao traga o mesmo numero de antes); no acampante, tambem o
-- telefone de emergencia.
do $m$
declare
  d text;
  ancora constant text := '  v_metodo := p_dados ->> ''metodo_pagamento'';';
begin
  d := pg_get_functiondef('public.criar_inscricao(text,jsonb,text)'::regprocedure);
  if (length(d) - length(replace(d, ancora, ''))) / length(ancora) <> 1 then
    raise exception 'trecho nao encontrado (ou repetido) em criar_inscricao';
  end if;
  execute replace(d, ancora,
'  -- Telefones (20261003d). O gatilho padroniza ao gravar; aqui garante que
  -- o WhatsApp exista e esteja certo mesmo quando nao mudou.
  if public._telefone_normalizado(p_dados ->> ''whatsapp'', false,
       nullif(regexp_replace(coalesce(p_dados ->> ''cpf'', ''''), ''\D'', '''', ''g''), '''') is null) is null then
    raise exception ''TELEFONE_INVALIDO:whatsapp'';
  end if;
  if p_tipo <> ''equipante''
     and public._telefone_normalizado(p_dados ->> ''contato_emergencia_telefone'', true,
       nullif(regexp_replace(coalesce(p_dados ->> ''cpf'', ''''), ''\D'', '''', ''g''), '''') is null) is null then
    raise exception ''TELEFONE_INVALIDO:contato_emergencia_telefone'';
  end if;

' || ancora);
end;
$m$;

revoke all on function public._telefone_normalizado(text, boolean, boolean) from public, anon, authenticated;
revoke all on function public._telefone_do_campo(text, text, boolean, boolean) from public, anon, authenticated;
revoke all on function public._padronizar_telefones() from public, anon, authenticated;
