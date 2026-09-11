-- =====================================================================
-- Passo 2, Etapa 6 -- TRANCA AS TABELAS (achado C-1)
-- =====================================================================
--
-- ⚠️ NAO APLICAR SOZINHO. Este script so pode rodar DEPOIS de:
--    1) APP_JWT_SECRET estar com o JWT Secret legado DO PROJETO
--       (Settings -> JWT Keys -> Legacy JWT Secret), e
--    2) o site estar publicado enviando o cracha nas consultas
--       (supabaseClient.js com a opcao accessToken).
--
-- Se rodar antes, as telas de organizador e de parceiro ficam VAZIAS --
-- o banco deixa de responder para quem nao tem cracha valido.
--
-- COMO REVERTER (emergencia):
--    grant all on all tables in schema public to anon, authenticated;
--    create policy "Pode tudo" on public.<tabela> for all using (true) with check (true);
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Leitura do cracha
--
-- O PostgREST coloca as claims do token em request.jwt.claims. Estas
-- funcoes so leem de la -- nao sao SECURITY DEFINER, nao precisam ser:
-- quem decide o conteudo do token e a Edge Function de login, que assina
-- com o segredo do projeto. Um token forjado nao passa na verificacao de
-- assinatura e nunca chega aqui.
-- ---------------------------------------------------------------------
create or replace function public.jwt_papel()
returns text language sql stable
set search_path = public
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'user_role',
    ''
  );
$$;

create or replace function public.jwt_igreja()
returns text language sql stable
set search_path = public
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'igreja_codigo',
    ''
  );
$$;

create or replace function public.eh_organizador()
returns boolean language sql stable
set search_path = public
as $$
  select public.jwt_papel() in ('organizador', 'organizador-aprovador');
$$;

create or replace function public.eh_parceiro()
returns boolean language sql stable
set search_path = public
as $$
  select public.jwt_papel() = 'parceiro' and public.jwt_igreja() <> '';
$$;

grant execute on function public.jwt_papel()      to authenticated;
grant execute on function public.jwt_igreja()     to authenticated;
grant execute on function public.eh_organizador() to authenticated;
grant execute on function public.eh_parceiro()    to authenticated;


-- ---------------------------------------------------------------------
-- 2. Tira o acesso amplo de todo mundo
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'acampantes','equipantes','pagamentos','pix_sicoob','configuracoes',
    'cupons','escalas','limites_areas','limites_igrejas'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('drop policy if exists "Pode tudo" on public.%I', t);
  end loop;
end $$;


-- ---------------------------------------------------------------------
-- 3. Organizador: acesso operacional completo
--
-- Continua sendo o papel que toca tudo -- a diferenca e que agora isso
-- exige um cracha assinado pelo servidor, e nao apenas conhecer a chave
-- publica que vai no bundle JS.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'acampantes','equipantes','pagamentos','configuracoes',
    'cupons','escalas','limites_areas','limites_igrejas'
  ] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format($f$
      create policy "organizador faz tudo" on public.%I
      for all to authenticated
      using (public.eh_organizador())
      with check (public.eh_organizador())
    $f$, t);
  end loop;
end $$;


-- ---------------------------------------------------------------------
-- 4. Parceiro: SO os equipantes da propria igreja
--
-- ⚠️ CORRIGE UM VAZAMENTO REAL. Hoje a tela do parceiro chama
-- fetchEquipantesRaw() -- um select('*') que traz TODOS os equipantes --
-- e filtra pela igreja NO NAVEGADOR. Ou seja: cada uma das 146 igrejas
-- baixa a ficha completa de todos os equipantes (CPF, condicoes medicas,
-- medicamentos, contato de emergencia) e o navegador apenas esconde o
-- que nao e dela. Basta abrir as ferramentas do navegador para ver tudo.
--
-- A partir daqui o filtro e do banco: o parceiro simplesmente nao recebe
-- as linhas das outras igrejas.
--
-- A correspondencia e por prefixo "<codigo> - ", igual a regra que o
-- frontend ja usava (ex.: igreja "01 - MINISTERIO ARCA DA ALIANCA" para
-- o codigo de login "01").
-- ---------------------------------------------------------------------
create policy "parceiro ve so a propria igreja" on public.equipantes
for select to authenticated
using (
  public.eh_parceiro()
  and igreja is not null
  and igreja like public.jwt_igreja() || ' - %'
);

-- O parceiro aprova/rejeita inscricoes da propria igreja (updateEquipanteStatus).
create policy "parceiro atualiza so a propria igreja" on public.equipantes
for update to authenticated
using (
  public.eh_parceiro()
  and igreja is not null
  and igreja like public.jwt_igreja() || ' - %'
)
with check (
  public.eh_parceiro()
  and igreja is not null
  and igreja like public.jwt_igreja() || ' - %'
);


-- ---------------------------------------------------------------------
-- 5. Publico: so o que o formulario de inscricao precisa
--
-- Tudo o mais passa pelas funcoes controladas criadas na etapa 4
-- (config_publica, verificar_inscricao, ocupacao_igrejas, validar_cupom,
-- criar_inscricao, status_pagamento_pix).
--
-- limites_igrejas e a unica excecao: e so nome de igreja e um numero,
-- sem nenhum dado pessoal, e o seletor de igrejas do formulario le
-- direto. Mantida a leitura anonima de proposito.
-- ---------------------------------------------------------------------
grant select on public.limites_igrejas to anon, authenticated;

create policy "todos podem ler limites de igreja" on public.limites_igrejas
for select to anon, authenticated
using (true);


-- ---------------------------------------------------------------------
-- 6. pix_sicoob: ninguem pelo navegador
--
-- Quem escreve aqui sao as Edge Functions, com service_role, que ignora
-- RLS. O site consulta o status pela funcao status_pagamento_pix.
-- Nenhum grant, nenhuma policy -- fechado.
-- ---------------------------------------------------------------------


-- ---------------------------------------------------------------------
-- 7. Funcoes de alocacao de equipante: so organizador
--
-- Hoje qualquer visitante pode chamar e remanejar as escalas (achado N-5).
-- ---------------------------------------------------------------------
revoke all on function public.alocar_equipante_automaticamente(uuid) from anon, authenticated, public;
revoke all on function public.alocar_equipante_manualmente(uuid, text) from anon, authenticated, public;
revoke all on function public.liberar_vaga_e_realocar(uuid)          from anon, authenticated, public;
revoke all on function public.realocar_equipante(uuid, text)         from anon, authenticated, public;

grant execute on function public.alocar_equipante_automaticamente(uuid) to authenticated;
grant execute on function public.alocar_equipante_manualmente(uuid, text) to authenticated;
grant execute on function public.liberar_vaga_e_realocar(uuid)          to authenticated;
grant execute on function public.realocar_equipante(uuid, text)         to authenticated;


-- ---------------------------------------------------------------------
-- 8. Conferencia (rodar depois de aplicar)
-- ---------------------------------------------------------------------
-- Deve devolver ZERO linhas (nenhum privilegio para anon, exceto
-- limites_igrejas):
--
--   select table_name, privilege_type
--   from information_schema.role_table_grants
--   where table_schema = 'public' and grantee = 'anon'
--     and table_name <> 'limites_igrejas';
--
-- E, de fora, com a chave publica, isto deve responder 401:
--   GET /rest/v1/acampantes?select=*
--   GET /rest/v1/equipantes?select=*
