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
