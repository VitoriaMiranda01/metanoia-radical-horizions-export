/**
 * Validation helpers for data integrity before DB operations
 */

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