/**
 * Validation helpers for data integrity before DB operations
 */

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

export const validateConfiguracoes = (config) => {
  const errors = [];
  
  if (config.max_equipantes === undefined || config.max_equipantes === null || config.max_equipantes < 0) {
    errors.push("O limite de equipantes deve ser um número positivo.");
  }
  
  if (config.max_acampantes === undefined || config.max_acampantes === null || config.max_acampantes < 0) {
    errors.push("O limite de acampantes deve ser um número positivo.");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateLimiteArea = (areaNome, limiteMaximo) => {
  const errors = [];

  if (!areaNome || typeof areaNome !== 'string' || areaNome.trim() === '') {
    errors.push("Nome da área inválido.");
  }

  // Ensure limit is parsed as integer for check
  const limit = parseInt(limiteMaximo, 10);
  if (isNaN(limit) || limit < 0) {
    errors.push("O limite deve ser um número inteiro não negativo.");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateEscala = (allocation) => {
  const errors = [];

  if (!allocation.equipante_id) {
    errors.push("ID do equipante é obrigatório.");
  }

  if (!allocation.area_alocada) {
    errors.push("Área alocada é obrigatória.");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateInscricoesStatus = (status) => {
  const errors = [];
  
  if (typeof status.equipantes !== 'boolean' && status.equipantes !== undefined) {
    errors.push("Status de equipantes deve ser booleano.");
  }
  
  if (typeof status.acampantes !== 'boolean' && status.acampantes !== undefined) {
    errors.push("Status de acampantes deve ser booleano.");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};
