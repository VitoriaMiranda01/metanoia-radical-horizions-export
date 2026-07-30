import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

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
 * Validates a CPF using the official Brazilian algorithm (check digits).
 * Accepts formatted (XXX.XXX.XXX-XX) or unformatted (11 digits) CPF.
 * Returns true if valid, false otherwise.
 */
export function validateCPF(cpf) {
  if (!cpf) return false;
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  // Reject all-same-digit CPFs (e.g. 111.111.111-11)
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const calc = (factor) => {
    let sum = 0;
    for (let i = 0; i < factor - 1; i++) {
      sum += parseInt(digits[i]) * (factor - i);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 || remainder === 11 ? 0 : remainder;
  };

  return calc(10) === parseInt(digits[9]) && calc(11) === parseInt(digits[10]);
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