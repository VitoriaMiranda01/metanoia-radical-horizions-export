// Formatação e normalização de dados (sem I/O, sem validação de regra de negócio)

export function formatCPF(cpf) {
  if (!cpf) return '';
  const cleaned = cpf.replace(/\D/g, '');
  return cleaned
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .replace(/(-\d{2})\d+?$/, '$1');
}

/**
 * Formata um nome so para exibicao (nao altera o dado salvo no banco --
 * varios nomes estao gravados em CAIXA ALTA). Capitaliza a primeira letra
 * de cada palavra, mantendo minusculos os conectivos comuns em nomes
 * portugueses ("da", "de", "do" etc), exceto quando sao a primeira palavra.
 * Usado no grid de equipantes por area de trabalho (EquipantesGridDisplay).
 */
const CONECTIVOS_NOME = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

export function formatNomeExibicao(nome) {
  if (!nome) return '';
  return nome
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((palavra, index) => {
      if (index > 0 && CONECTIVOS_NOME.has(palavra)) return palavra;
      return palavra.charAt(0).toUpperCase() + palavra.slice(1);
    })
    .join(' ');
}

/**
 * Converts various values (strings 'SIM'/'NÃO', 'true'/'false', etc) to a proper boolean.
 * Useful for normalizing form data before sending to the database.
 */
export function toBoolean(value) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  if (value === null || value === undefined) return false;
  
  if (typeof value === 'string') {
    const normalized = value.toUpperCase().trim();
    return normalized === 'SIM' || normalized === 'S' || normalized === 'YES' || normalized === 'ON';
  }
  
  return Boolean(value);
}
