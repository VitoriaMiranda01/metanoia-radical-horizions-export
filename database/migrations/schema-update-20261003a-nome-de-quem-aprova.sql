-- =============================================================================
-- Nome de quem aprova no carimbo do parceiro (03/10/2026)
--
-- Problema: tres aprovacoes da igreja 41 (02/10 15:12) sairam como
-- "responsavel nao identificado", embora a responsavel tivesse informado o
-- nome no primeiro acesso um minuto antes.
--
-- Causa: decidir_inscricao le o nome de igrejas_parceiras.responsavel_nome.
-- A versao de 12/09 do primeiro_acesso_parceiro gravava o nome ali e em
-- primeiro_acesso_parceiros; a reescrita de 15/09 (sem senha temporaria)
-- passou a gravar so em primeiro_acesso_parceiros, e o campo da igreja ficou
-- vazio para quem fez o primeiro acesso depois disso (igrejas 41 e 104).
--
-- Correcao:
--   1. primeiro_acesso_parceiro volta a gravar responsavel_nome na igreja;
--   2. decidir_inscricao, se o campo da igreja estiver vazio, usa o nome do
--      registro do primeiro acesso antes de cair em "nao identificado";
--   3. preenche o nome das igrejas que ficaram sem ele.
--
-- As decisoes ja gravadas NAO sao alteradas: o carimbo e uma foto do momento.
--
-- Troca so os trechos, sobre a definicao atual, para nao divergir do resto
-- das funcoes (e o create or replace preserva as permissoes).
-- =============================================================================

do $m$
declare
  d text;
begin
  d := pg_get_functiondef('public.primeiro_acesso_parceiro'::regproc);
  if position('set acesso_liberado = true' in d) = 0 then
    raise exception 'trecho nao encontrado em primeiro_acesso_parceiro';
  end if;
  execute replace(d, 'set acesso_liberado = true',
                     'set acesso_liberado = true, responsavel_nome = v_nome');

  d := pg_get_functiondef('public.decidir_inscricao'::regproc);
  if position('nullif(btrim(coalesce(v_igreja.responsavel_nome, '''')), ''''),' in d) = 0 then
    raise exception 'trecho nao encontrado em decidir_inscricao';
  end if;
  execute replace(d,
    'nullif(btrim(coalesce(v_igreja.responsavel_nome, '''')), ''''),',
    'nullif(btrim(coalesce(v_igreja.responsavel_nome, '''')), ''''),
                       (select nullif(btrim(pa.responsavel_nome), '''')
                          from public.primeiro_acesso_parceiros pa
                         where pa.codigo = v_igreja.codigo),');
end;
$m$;

update public.igrejas_parceiras i
   set responsavel_nome = pa.responsavel_nome
  from public.primeiro_acesso_parceiros pa
 where pa.codigo = i.codigo
   and nullif(btrim(coalesce(i.responsavel_nome, '')), '') is null
   and nullif(btrim(coalesce(pa.responsavel_nome, '')), '') is not null;
