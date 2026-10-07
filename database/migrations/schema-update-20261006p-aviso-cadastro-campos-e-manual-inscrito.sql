-- ---------------------------------------------------------------------------
-- Ajustes da revisao (Patrick, 06/10/2026):
--
-- 1. cadastro_acampantes_pendentes passa a devolver o valor de hoje de cada
--    campo com problema: o quadro de Gerenciar Inscricoes mostra "como esta"
--    e deixa corrigir ali mesmo, no mesmo padrao dos avisos de telefone e de
--    contato de emergencia.
-- 2. verificar_inscricao: "completar_manual" (entrar pelo nome sem data de
--    nascimento) so vale para ficha manual da edicao atual (inscrito) -- a
--    mesma regra que ja vale para ha_manuais e reivindicar_cadastro_manual.
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

select pg_temp._patch('public.cadastro_acampantes_pendentes()',
$$    select a.id, a.nome, a.whatsapp, a.admin_responsavel, a.igreja, p.problemas$$,
$$    select a.id, a.nome, a.whatsapp, a.admin_responsavel, a.igreja, p.problemas,
           a.sexo, a.data_nascimento, a.email, a.cep, a.estado, a.cidade,
           a.pastor_nome, a.quem_indicou_nome, a.nome_familiar_conhecido, a.profissao$$);

select pg_temp._patch('public.verificar_inscricao(text,text,text)',
$$            and e.data_nascimento is null)$$,
$$            and e.data_nascimento is null
            and coalesce(e.inscrito, false))$$);
