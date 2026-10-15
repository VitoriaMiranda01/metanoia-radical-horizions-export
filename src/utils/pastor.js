/**
 * "É pastor?" (Patrick, 12/10/2026). O formulario de equipante nao pergunta
 * isso diretamente: a resposta esta no "Cargo na Igreja" (cargo_igreja), com
 * as opcoes PASTOR(A) e PASTOR(A) AUXILIAR. A coluna e_pastor do banco nao e
 * preenchida por nenhum formulario (ficava "Não" para todo mundo) -- so conta
 * quando alguem a marca a mao no Editar inscricao.
 *
 * Usado na ficha (InscricaoDetalhesModal) e na planilha da Aprovacao.
 */
// "Pastor" / "Pastora" (com " auxiliar" quando for o caso), ou null. Usado no
// selo ao lado do nome (13/10/2026). O genero vem do sexo da ficha.
// Pastor(a) Diretor(a) do retiro (14/10/2026, coluna equipantes.pastor_diretor):
// marcado a mao; vale mais que o "Cargo na Igreja".
export const ehPastorDiretor = (item) => item?.pastor_diretor === true;

export const tituloPastor = (item) => {
  if (ehPastorDiretor(item)) return item?.sexo === 'Feminino' ? 'Pastora Diretora' : 'Pastor Diretor';
  const cargo = String(item?.cargo_igreja || '').toUpperCase().trim();
  const auxiliar = cargo === 'PASTOR(A) AUXILIAR';
  if (!auxiliar && cargo !== 'PASTOR(A)' && item?.e_pastor !== true) return null;
  const titulo = item?.sexo === 'Feminino' ? 'Pastora' : 'Pastor';
  return auxiliar ? `${titulo} auxiliar` : titulo;
};

export const ehPastorTexto = (item) => {
  if (ehPastorDiretor(item)) return item?.sexo === 'Feminino' ? 'Sim (pastora diretora)' : 'Sim (pastor diretor)';
  const cargo = String(item?.cargo_igreja || '').toUpperCase().trim();
  if (cargo === 'PASTOR(A) AUXILIAR') return 'Sim (pastor auxiliar)';
  if (cargo === 'PASTOR(A)' || item?.e_pastor === true) return 'Sim';
  return 'Não';
};
