/**
 * Recusas de dado invalido do banco, em portugues (Patrick, 06/10/2026).
 *
 * O banco barra dado fora do padrao em dois lugares -- criar_inscricao
 * (_dados_inscricao_validos) e o gatilho _validar_ficha, que vale para
 * qualquer gravacao nas fichas (migrations 20261006m a r). Os dois levantam
 * o mesmo codigo; aqui cada codigo vira a frase que a pessoa le.
 *
 * Quem acrescentar uma regra nova no banco acrescenta o codigo aqui tambem
 * (ver database/VALIDACOES.md).
 */

const MENSAGENS = {
  NOME_INVALIDO: 'Confira o nome: use só letras (sem números ou símbolos), com nome e sobrenome.',
  CPF_INVALIDO: 'CPF inválido: confira os números do CPF.',
  CPF_OBRIGATORIO: 'Informe o CPF (quem é estrangeiro informa a nacionalidade).',
  SEXO_INVALIDO: 'Escolha o sexo.',
  NASCIMENTO_INVALIDO: 'Confira a data de nascimento: a idade que ela dá não parece certa.',
  EMAIL_INVALIDO: 'E-mail inválido: confira, por exemplo nome@exemplo.com.',
  PROFISSAO_INVALIDA: 'A profissão não leva números.',
  CEP_INVALIDO: 'Confira o CEP: são 8 números.',
  ESTADO_INVALIDO: 'Escolha o estado na lista.',
  CIDADE_INVALIDA: 'Confira a cidade: não leva números.',
  CAMISA_INVALIDA: 'Escolha o tamanho da camisa na lista.',
  CONTATO_NOME_INVALIDO: 'Confira o nome do contato de emergência: use só letras (sem números).',
  CONTATO_MESMO_NOME: 'O contato de emergência precisa ser outra pessoa — não pode ser o próprio inscrito.',
  IGREJA_OBRIGATORIA: 'Escolha a igreja que você frequenta (ou "Não se aplica").',
  IGREJA_OUTRA_OBRIGATORIA: 'Escreva o nome da igreja.',
  PARENTESCO_OBRIGATORIO: 'Responda se tem algum conhecido ou familiar que vai como acampante.',
  FAMILIAR_OBRIGATORIO: 'Escreva o nome do conhecido ou familiar.',
  AREAS_OBRIGATORIAS: 'Escolha as 3 opções de área de trabalho.',
  IGREJA_OUTRA_ENCERRADA: 'A opção "OUTRA" não existe mais nesta edição: escolha a sua igreja na lista.',
  IGREJA_DIVERSOS_ENCERRADA: 'A opção "DIVERSOS" não existe mais nesta edição: escolha a igreja responsável na lista.',
};

const CAMPO_DE_TEXTO = {
  pastor_nome: 'do pastor',
  quem_indicou_nome: 'de quem indicou',
  nome_familiar_conhecido: 'do familiar / conhecido',
  familiar_nome: 'do conhecido / familiar',
};

/** A frase para o codigo contido em `mensagem`, ou null se nao for uma recusa de dado. */
export const mensagemDeErro = (mensagem) => {
  const texto = String(mensagem ?? '');
  const campo = (texto.match(/NOME_TEXTO_INVALIDO:(\w+)/) || [])[1];
  if (campo) {
    return `Confira o nome ${CAMPO_DE_TEXTO[campo] || ''}: use só letras, sem números ou símbolos.`.replace('nome :', 'nome:');
  }
  // Codigos mais longos primeiro (CONTATO_NOME_INVALIDO contem NOME_INVALIDO).
  const codigo = Object.keys(MENSAGENS).sort((a, b) => b.length - a.length).find((c) => texto.includes(c));
  return codigo ? MENSAGENS[codigo] : null;
};
