/**
 * Telefone: limpeza, conferencia e mascara.
 *
 * Os campos de telefone eram texto livre e chegaram numeros com digito a
 * mais, sem DDD e sem o 9 (03/10/2026). A MESMA regra vale no banco
 * (_telefone_normalizado, migration 20261003d) -- se mudar aqui, mude la.
 *
 *  - tira tudo que nao e digito, o +55 e o 0 antes do DDD;
 *  - celular: DDD existente + 9 + 8 digitos (11 digitos);
 *  - fixo (10 digitos, 3o digito de 2 a 5) so onde faz sentido: contato de
 *    emergencia, quem indicou;
 *  - quem se inscreve sem CPF (estrangeiro): 8 a 15 digitos, formato livre.
 */

const DDDS = new Set([
  '11', '12', '13', '14', '15', '16', '17', '18', '19', '21', '22', '24', '27', '28',
  '31', '32', '33', '34', '35', '37', '38', '41', '42', '43', '44', '45', '46', '47',
  '48', '49', '51', '53', '54', '55', '61', '62', '63', '64', '65', '66', '67', '68',
  '69', '71', '73', '74', '75', '77', '79', '81', '82', '83', '84', '85', '86', '87',
  '88', '89', '91', '92', '93', '94', '95', '96', '97', '98', '99',
]);

const EXEMPLO = 'Ex.: (21) 99999-9999.';

/** So os digitos, sem +55 e sem o 0 antes do DDD. */
export const digitosTelefone = (valor) => {
  let d = String(valor || '').replace(/\D/g, '');
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  if ((d.length === 11 || d.length === 12) && d.startsWith('0')) d = d.slice(1);
  return d;
};

/**
 * null quando o telefone esta certo; senao, o texto do problema para mostrar
 * a pessoa. Campo vazio nao e problema aqui (quem decide se e obrigatorio e
 * o formulario).
 */
export const problemaTelefone = (valor, { aceitaFixo = false, estrangeiro = false } = {}) => {
  const bruto = String(valor || '').trim();
  if (!bruto) return null;

  if (estrangeiro) {
    const n = bruto.replace(/\D/g, '').length;
    return n >= 8 && n <= 15
      ? null
      : 'Telefone incompleto. Use o formato internacional, ex.: +351 912 345 678.';
  }

  // Dois numeros no mesmo campo ("2499... / 2498..."): o campo e de um so.
  if (/[/;]|\bou\b/i.test(bruto) || bruto.replace(/\D/g, '').length >= 20) {
    return 'Informe só um número de WhatsApp.';
  }

  const d = digitosTelefone(bruto);
  if (d.length < 10) {
    return d.length >= 8 ? `Faltou o DDD. ${EXEMPLO}` : `Número incompleto. ${EXEMPLO}`;
  }
  if (d.length > 11) return `Tem dígitos a mais. ${EXEMPLO}`;
  if (!DDDS.has(d.slice(0, 2))) return `O DDD ${d.slice(0, 2)} não existe. Confira o número.`;
  if (d.length === 11) return d[2] === '9' ? null : `Celular começa com 9 depois do DDD. ${EXEMPLO}`;
  if (aceitaFixo && '2345'.includes(d[2])) return null;
  return `Faltou um dígito: celular tem o 9 depois do DDD. ${EXEMPLO}`;
};

/** "(21) 99999-9999" (ou "(21) 2417-0850"); formata tambem pela metade, enquanto digita. */
export const formatarTelefone = (valor) => {
  const d = String(valor || '').replace(/\D/g, '').slice(0, 11);
  if (!d) return '';
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  if (d.length <= 6) return `(${ddd}) ${resto}`;
  if (d.length <= 10) return `(${ddd}) ${resto.slice(0, 4)}-${resto.slice(4)}`;
  return `(${ddd}) ${resto.slice(0, 5)}-${resto.slice(5)}`;
};

/**
 * O que a mascara faz a cada tecla (ou colagem): tira o que nao e digito,
 * o +55 e o 0 de quem colou o numero inteiro, e para em 11 digitos.
 */
export const mascararTelefone = (valor) => {
  let d = String(valor || '').replace(/\D/g, '');
  if (d.length > 11) d = digitosTelefone(d);
  if (d.startsWith('0')) d = d.slice(1);
  return formatarTelefone(d.slice(0, 11));
};

/** Nome amigavel do campo, para as mensagens de erro do servidor. */
export const ROTULO_CAMPO_TELEFONE = {
  whatsapp: 'WhatsApp',
  contato_emergencia_telefone: 'telefone de emergência',
  quem_indicou_telefone: 'telefone de quem indicou',
  telefone_residencial: 'telefone residencial',
  telefone: 'telefone',
};
