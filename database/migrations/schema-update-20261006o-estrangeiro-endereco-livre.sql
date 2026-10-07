-- ---------------------------------------------------------------------------
-- Estrangeiro (inscricao sem CPF) mora fora do Brasil: o CEP de 8 numeros e o
-- estado brasileiro nao valem para ele (Patrick, 06/10/2026, ajuste da
-- 20261006n). Para quem tem CPF continua tudo igual.
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

select pg_temp._patch('public._dados_inscricao_validos(jsonb,text)',
$$  if p_tipo <> 'equipante' then$$,
$$  if p_tipo <> 'equipante'
     and nullif(regexp_replace(coalesce(p_dados ->> 'cpf', ''), '\D', '', 'g'), '') is not null then$$);

select pg_temp._patch('public.cadastro_acampantes_pendentes()',
$$          case when regexp_replace(coalesce(a.cep, ''), '\D', '', 'g') !~ '^\d{8}$' then 'cep' end,
          case when not public._uf_valida(upper(btrim(coalesce(a.estado, '')))) then 'estado' end,$$,
$$          case when nullif(regexp_replace(coalesce(a.cpf, ''), '\D', '', 'g'), '') is not null
                 and regexp_replace(coalesce(a.cep, ''), '\D', '', 'g') !~ '^\d{8}$' then 'cep' end,
          case when nullif(regexp_replace(coalesce(a.cpf, ''), '\D', '', 'g'), '') is not null
                 and not public._uf_valida(upper(btrim(coalesce(a.estado, '')))) then 'estado' end,$$);
