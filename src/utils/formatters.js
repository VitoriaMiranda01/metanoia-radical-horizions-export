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

/**
 * Idade em anos completos a partir da data de nascimento ("AAAA-MM-DD").
 *
 * A idade deixou de ser um campo guardado: um numero gravado envelhece, e a
 * cada edicao a idade de todo mundo ficava um ano errada -- justo o dado que
 * decide quem e menor de 18 e precisa da autorizacao dos pais. O que fica
 * guardado e a data de nascimento, que nao muda; a idade e conta feita na
 * hora, aqui e no banco (funcao public.idade).
 *
 * Devolve null quando nao da para calcular, para a tela poder mostrar "-"
 * em vez de um numero inventado.
 */
export function calcularIdade(dataNascimento) {
  if (!dataNascimento) return null;

  const partes = String(dataNascimento).slice(0, 10).split('-');
  if (partes.length !== 3) return null;

  const [ano, mes, dia] = partes.map(Number);
  if (!ano || !mes || !dia) return null;

  const hoje = new Date();
  let idade = hoje.getFullYear() - ano;

  // Ainda nao fez aniversario este ano.
  const mesAtual = hoje.getMonth() + 1;
  if (mesAtual < mes || (mesAtual === mes && hoje.getDate() < dia)) idade -= 1;

  return idade >= 0 && idade < 130 ? idade : null;
}
