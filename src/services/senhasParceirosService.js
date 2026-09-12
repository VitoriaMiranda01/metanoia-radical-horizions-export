import { supabase } from '@/services/supabaseClient';
import { comReenvio } from '@/services/serviceHelpers';

/**
 * Senhas das igrejas parceiras.
 *
 * Todo o trabalho de verdade acontece no banco (ver
 * database/migrations/schema-update-20260911d-senhas-parceiros.sql). Aqui e
 * so a ponte -- de proposito: a decisao de quem pode fazer o que nao pode
 * depender do navegador, que e justamente o lado que nao da para confiar.
 *
 * As funcoes de organizador conferem o cracha (eh_organizador) dentro do
 * banco. Se alguem chamar sem ser organizador, volta { ok: false } -- nao
 * adianta burlar a tela.
 */

// Alguns erros de rede sao passageiros; comReenvio so repete nesses casos
// (ver serviceHelpers.js). Chamadas que ESCREVEM senha entram aqui tambem
// porque sao idempotentes o suficiente: repetir "trocar senha" com os mesmos
// dados ou da o mesmo resultado, ou falha dizendo que a senha atual nao
// confere -- nunca cria nada duplicado.
const chamar = async (funcao, args, rotulo) => {
  const { data, error } = await comReenvio(
    () => supabase.rpc(funcao, args),
    { rotulo }
  );
  if (error) throw error;
  return data;
};

/**
 * Troca feita pelo proprio parceiro. A prova de identidade e a senha atual --
 * por isso funciona antes de a pessoa estar logada de fato (primeiro acesso).
 */
export const trocarSenhaIgreja = async (codigo, senhaAtual, senhaNova) =>
  chamar('trocar_senha_igreja', {
    p_codigo: String(codigo || '').trim(),
    p_senha_atual: senhaAtual,
    p_senha_nova: senhaNova,
  }, 'troca de senha');

/**
 * Pedido de ajuda de quem esqueceu a senha.
 *
 * NAO devolve nem envia senha nenhuma: so cria um aviso na tela dos
 * organizadores. A resposta e sempre a mesma, exista o codigo ou nao --
 * senao isso viraria uma forma de descobrir quais codigos existem.
 */
export const solicitarRedefinicaoSenha = async (codigo) =>
  chamar('solicitar_redefinicao_senha', {
    p_codigo: String(codigo || '').trim(),
  }, 'pedido de nova senha');

// --- daqui para baixo, so organizador ---------------------------------------

export const listarContasParceiros = async () =>
  chamar('listar_contas_parceiros', undefined, 'contas dos parceiros');

export const liberarPrimeiroAcesso = async (codigo, liberar = true) =>
  chamar('liberar_primeiro_acesso', {
    p_codigo: String(codigo || '').trim(),
    p_liberar: liberar,
  }, 'liberação de acesso');

/**
 * Gera uma senha nova para a igreja e devolve em texto claro UMA VEZ, para o
 * organizador copiar e mandar no WhatsApp. Ela nao fica guardada em texto
 * claro em lugar nenhum -- se a tela for fechada, e so gerar outra.
 */
export const redefinirSenhaParceiro = async (codigo) =>
  chamar('redefinir_senha_parceiro', {
    p_codigo: String(codigo || '').trim(),
  }, 'nova senha do parceiro');

export const descartarSolicitacaoSenha = async (codigo) =>
  chamar('descartar_solicitacao_senha', {
    p_codigo: String(codigo || '').trim(),
  }, 'descarte de pedido');

// ---------------------------------------------------------------------------
// Senhas dos ORGANIZADORES
//
// Mesma ideia das igrejas, com duas diferencas decididas com o Patrick em
// 12/09/2026:
//
//  - nao existe "esqueci minha senha": sao 8 pessoas que se conhecem, e
//    pedir ao login de permissao maxima e mais simples e mais seguro que um
//    botao automatico;
//  - a conta "Desenvolvedores" e a de permissao maxima -- so ela enxerga a
//    lista e gera senha para os outros. Quem manda nisso e o banco
//    (eh_organizador_maximo), nao a tela.
// ---------------------------------------------------------------------------

/** Troca feita pelo proprio organizador; a prova de identidade e a senha atual. */
export const trocarSenhaOrganizador = async (nome, senhaAtual, senhaNova) =>
  chamar('trocar_senha_organizador', {
    p_nome: String(nome || '').trim(),
    p_senha_atual: senhaAtual,
    p_senha_nova: senhaNova,
  }, 'troca de senha do organizador');

/** true so para a conta de permissao maxima. Serve para a tela decidir o que mostrar. */
export const souOrganizadorMaximo = async () =>
  chamar('eh_organizador_maximo', undefined, 'permissão do organizador');

export const listarOrganizadores = async () =>
  chamar('listar_organizadores', undefined, 'lista de organizadores');

/** Gera senha nova para OUTRO organizador. Devolve a senha em texto uma vez so. */
export const redefinirSenhaOrganizador = async (nome) =>
  chamar('redefinir_senha_organizador', {
    p_nome: String(nome || '').trim(),
  }, 'nova senha do organizador');
