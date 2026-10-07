-- ---------------------------------------------------------------------------
-- Contato de emergencia precisa ser OUTRA pessoa (revisao de 06/10/2026):
-- apareceu acampante com o proprio nome como contato de emergencia -- alem do
-- proprio WhatsApp, que ja era barrado (20261006c).
--
--   criar_inscricao               CONTATO_MESMO_NOME
--   contatos_emergencia_pendentes problema 'mesmo_nome' no quadro da Raquel
-- ---------------------------------------------------------------------------

create or replace function pg_temp._patch(p_fn regprocedure, p_de text, p_para text, p_vezes int default 1)
returns void
language plpgsql
as $fn$
declare
  d text := pg_get_functiondef(p_fn);
  n int := (length(d) - length(replace(d, p_de, ''))) / length(p_de);
begin
  if n <> p_vezes then
    raise exception 'patch %: esperava % ocorrencia(s) de [%], achou %', p_fn, p_vezes, left(p_de, 80), n;
  end if;
  execute replace(d, p_de, p_para);
end;
$fn$;

select pg_temp._patch('public.criar_inscricao(text,jsonb,text)',
$$    raise exception 'CONTATO_NOME_INVALIDO';
  end if;
$$,
$$    raise exception 'CONTATO_NOME_INVALIDO';
  end if;
  -- O contato nao pode ser a propria pessoa (20261006q).
  if public.unaccent_simples(lower(btrim(regexp_replace(coalesce(p_dados ->> 'contato_emergencia_nome', ''), '\s+', ' ', 'g'))))
     = public.unaccent_simples(lower(btrim(regexp_replace(coalesce(p_dados ->> 'nome', ''), '\s+', ' ', 'g')))) then
    raise exception 'CONTATO_MESMO_NOME';
  end if;
$$);

select pg_temp._patch('public.contatos_emergencia_pendentes()',
$$             case when coalesce(a.contato_emergencia_nome, '') ~ '[0-9]' then 'nome' end,$$,
$$             case when coalesce(a.contato_emergencia_nome, '') ~ '[0-9]' then 'nome' end,
             case when nullif(btrim(coalesce(a.contato_emergencia_nome, '')), '') is not null
                    and public.unaccent_simples(lower(btrim(regexp_replace(a.contato_emergencia_nome, '\s+', ' ', 'g'))))
                      = public.unaccent_simples(lower(btrim(regexp_replace(coalesce(a.nome, ''), '\s+', ' ', 'g'))))
                  then 'mesmo_nome' end,$$);
