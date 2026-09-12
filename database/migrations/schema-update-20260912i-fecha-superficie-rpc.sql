-- ---------------------------------------------------------------------------
-- Fecha a superficie de RPC para o visitante anonimo
--
-- Achado na auditoria de 12/09/2026, antes da abertura das inscricoes.
--
-- O QUE ESTAVA ERRADO
-- -------------------
-- 34 funcoes do schema public eram chamaveis por qualquer visitante com a
-- chave publica do site -- entre elas redefinir_senha_parceiro,
-- redefinir_senha_organizador, liberar_primeiro_acesso,
-- listar_contas_parceiros e listar_organizadores.
--
-- A CAUSA: o Supabase configura um "alter default privileges" que da
-- EXECUTE a anon e authenticated em TODA funcao nova do schema public. Nas
-- migrations anteriores eu escrevi "revoke all on function ... from
-- public", que remove o grant de PUBLIC mas NAO o grant explicito de anon.
-- As funcoes antigas, vindas do export do Hostinger Horizons, tinham o
-- problema inverso: ainda com EXECUTE para PUBLIC.
--
-- NADA VAZOU. Todas as funcoes sensiveis conferem eh_organizador() ou
-- eh_organizador_maximo() por dentro. O teste de fora, com a chave publica,
-- confirmou antes da correcao:
--
--   listar_contas_parceiros ..... []
--   listar_organizadores ........ []
--   redefinir_senha_parceiro .... {"ok": false, "erro": "Apenas organizadores..."}
--   redefinir_senha_organizador . {"ok": false, "erro": "Apenas o login de permissão máxima..."}
--   liberar_primeiro_acesso ..... {"ok": false, "erro": "Apenas organizadores..."}
--   eh_organizador_maximo ....... false
--
-- Isto aqui e a segunda camada. Se um dia alguem editar uma dessas funcoes
-- e esquecer a checagem interna, o visitante ainda assim nao alcanca.
--
-- DEPOIS: 15 funcoes continuam abertas ao visitante, e todas precisam ser:
--   inscricao ... config_publica, ocupacao_igrejas, validar_cupom,
--                 verificar_inscricao, criar_inscricao,
--                 registrar_metodo_pagamento, finalizar_inscricao_gratuita,
--                 status_pagamento_pix
--   senha ....... trocar_senha_igreja, trocar_senha_organizador,
--                 solicitar_redefinicao_senha (a pessoa ainda nao esta
--                 logada nesses tres)
--   cracha ...... eh_organizador, eh_parceiro, jwt_papel, jwt_igreja
--                 (leem so o proprio token de quem chama; usadas pelas
--                 policies de RLS)
-- ---------------------------------------------------------------------------

-- 1. Auxiliares internos da escala
revoke execute on function public._area_com_mais_vaga(text)            from public, anon;
revoke execute on function public._atuacao_padrao(text)                from public, anon;
revoke execute on function public._equipante_area_tem_vaga(text, text) from public, anon;
revoke execute on function public._pode_escalar_equipante(uuid)        from public, anon;
grant  execute on function public._area_com_mais_vaga(text)            to authenticated;
grant  execute on function public._atuacao_padrao(text)                to authenticated;
grant  execute on function public._equipante_area_tem_vaga(text, text) to authenticated;
grant  execute on function public._pode_escalar_equipante(uuid)        to authenticated;

-- 2. Acoes de organizador
revoke execute on function public.listar_contas_parceiros()              from public, anon;
revoke execute on function public.listar_organizadores()                 from public, anon;
revoke execute on function public.redefinir_senha_parceiro(text)         from public, anon;
revoke execute on function public.redefinir_senha_organizador(text)      from public, anon;
revoke execute on function public.liberar_primeiro_acesso(text, boolean) from public, anon;
revoke execute on function public.descartar_solicitacao_senha(text)      from public, anon;
revoke execute on function public.eh_organizador_maximo()                from public, anon;
grant  execute on function public.listar_contas_parceiros()              to authenticated;
grant  execute on function public.listar_organizadores()                 to authenticated;
grant  execute on function public.redefinir_senha_parceiro(text)         to authenticated;
grant  execute on function public.redefinir_senha_organizador(text)      to authenticated;
grant  execute on function public.liberar_primeiro_acesso(text, boolean) to authenticated;
grant  execute on function public.descartar_solicitacao_senha(text)      to authenticated;
grant  execute on function public.eh_organizador_maximo()                to authenticated;

-- 3. Sobras do export do Hostinger Horizons e funcoes de gatilho.
--
--    is_admin() referencia public.users, que NAO EXISTE neste banco -- e
--    codigo morto que veio junto no export. Fica revogada em vez de
--    apagada para nao mexer em nada as vesperas da abertura; vale apagar
--    depois do acampamento.
--
--    Gatilho nao precisa de EXECUTE do usuario que escreve na tabela: o
--    Postgres nao confere isso. Tirar daqui so remove as funcoes da API
--    REST. Conferido depois: criar_inscricao continua funcionando, e o
--    gatilho de limite por igreja continua barrando.
revoke execute on function public.is_admin()                            from public, anon, authenticated;
revoke execute on function public.rls_auto_enable()                     from public, anon, authenticated;
revoke execute on function public.handle_new_auth_user_public_users()   from public, anon, authenticated;
revoke execute on function public.handle_new_user_acampante()           from public, anon, authenticated;
revoke execute on function public.set_updated_at()                      from public, anon, authenticated;
revoke execute on function public.update_updated_at_column()            from public, anon, authenticated;
revoke execute on function public.update_workflow_updated_at_column()   from public, anon, authenticated;
revoke execute on function public._acampantes_verificar_limite_igreja() from public, anon, authenticated;

-- 4. search_path fixo nas 5 que estavam sem (alerta do linter do Supabase).
--    Sem isso, quem conseguisse criar um objeto num schema anterior no
--    caminho de busca poderia sequestrar o nome de uma tabela ou funcao
--    usada dentro delas.
alter function public.handle_new_user_acampante()            set search_path to 'public';
alter function public.set_updated_at()                       set search_path to 'public';
alter function public.update_updated_at_column()             set search_path to 'public';
alter function public.update_workflow_updated_at_column()    set search_path to 'public';
alter function public._acampantes_verificar_limite_igreja()  set search_path to 'public';


-- ---------------------------------------------------------------------
-- CONFERENCIA DEPOIS DE APLICAR (feita de fora, com a chave publica)
-- ---------------------------------------------------------------------
-- Continuam funcionando:
--   config_publica ........ 200      status_pagamento_pix .. 200
--   ocupacao_igrejas ...... 200      limites_igrejas ....... 200
--   validar_cupom ......... 200      criar_inscricao ....... 200 (criou e apagou)
--   verificar_inscricao ... 200      gatilho do limite ..... barrou como devia
--
-- Passaram a responder 42501 "permission denied for function":
--   listar_contas_parceiros, listar_organizadores,
--   redefinir_senha_parceiro, redefinir_senha_organizador,
--   liberar_primeiro_acesso, descartar_solicitacao_senha,
--   eh_organizador_maximo, is_admin, _area_com_mais_vaga,
--   _atuacao_padrao, _equipante_area_tem_vaga, _pode_escalar_equipante
--
-- Leitura direta de tabela com a chave publica: 401 em todas as 13
-- (acampantes, equipantes, escalas, pagamentos, pix_sicoob, configuracoes,
-- cupons, limites_areas, organizadores_auth, igrejas_parceiras,
-- config_senhas, solicitacoes_senha, atuacoes_areas). So limites_igrejas
-- responde 200, de proposito -- e nome de igreja e um numero, e o seletor
-- do formulario le direto.
-- ---------------------------------------------------------------------
