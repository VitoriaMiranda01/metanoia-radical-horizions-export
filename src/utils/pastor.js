/**
 * "É pastor?" (Patrick, 12/10/2026). O formulario de equipante nao pergunta
 * isso diretamente: a resposta esta no "Cargo na Igreja" (cargo_igreja), com
 * as opcoes PASTOR(A) e PASTOR(A) AUXILIAR. A coluna e_pastor do banco nao e
 * preenchida por nenhum formulario (ficava "Não" para todo mundo) -- so conta
 * quando alguem a marca a mao no Editar inscricao.
 *
 * Usado na ficha (InscricaoDetalhesModal) e na planilha da Aprovacao.
 */
export const ehPastorTexto = (item) => {
  const cargo = String(item?.cargo_igreja || '').toUpperCase().trim();
  if (cargo === 'PASTOR(A) AUXILIAR') return 'Sim (pastor auxiliar)';
  if (cargo === 'PASTOR(A)' || item?.e_pastor === true) return 'Sim';
  return 'Não';
};
