import { supabase } from '@/services/supabaseClient';
import { validateLimiteArea } from '@/utils/validation';

/**
 * Helper functions for managing area limits.
 * Now includes robust validation and full field handling.
 */

export const fetchLimitesAreas = async () => {
  try {
    const { data, error } = await supabase
      .from('limites_areas')
      .select('area_nome, limite_maximo, limite_mulheres, limite_homens, updated_at');
    
    if (error) {
      if (error.code === '42P01') {
        console.warn("Table 'limites_areas' does not exist. Returning empty limits.");
        return {};
      }
      throw error;
    }
    
    const limitsMap = {};
    if (data) {
      data.forEach(item => {
        limitsMap[item.area_nome] = {
          limiteMaximo: item.limite_maximo,
          limiteMulheres: item.limite_mulheres || null,
          limiteHomens: item.limite_homens || null
        };
      });
    }
    
    return limitsMap;
  } catch (error) {
    console.error("Erro ao buscar limites de áreas:", error);
    return {};
  }
};

export const saveLimiteArea = async (areaNome, limiteMaximo) => {
  const validation = validateLimiteArea(areaNome, limiteMaximo);
  if (!validation.isValid) {
    throw new Error(validation.errors.join(', '));
  }

  try {
    const { data, error } = await supabase
      .from('limites_areas')
      .upsert({ 
        area_nome: areaNome, 
        limite_maximo: parseInt(limiteMaximo),
        updated_at: new Date()
      }, { onConflict: 'area_nome' })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error saving limit area:", error);
    throw new Error(error.message || "Failed to save area limit");
  }
};

export const saveLimiteAreaComGenero = async (areaNome, limiteMaximo, limiteMulheres, limiteHomens) => {
  const max = parseInt(limiteMaximo);
  const mul = limiteMulheres ? parseInt(limiteMulheres) : null;
  const hom = limiteHomens ? parseInt(limiteHomens) : null;

  if (isNaN(max) || max < 1) {
    throw new Error("Limite máximo inválido.");
  }

  if (mul !== null && hom !== null && (mul + hom > max)) {
    throw new Error("A soma dos limites de homens e mulheres não pode exceder a capacidade total.");
  }

  try {
    const { data, error } = await supabase
      .from('limites_areas')
      .upsert({ 
        area_nome: areaNome, 
        limite_maximo: max,
        limite_mulheres: mul,
        limite_homens: hom,
        updated_at: new Date()
      }, { onConflict: 'area_nome' })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error saving limit area with gender:", error);
    throw new Error(error.message || "Failed to save area limit");
  }
};

export const getLimiteArea = (areaNome, limitsMap, defaultLimit = 5) => {
  if (!limitsMap || typeof limitsMap !== 'object') return defaultLimit;
  const limitObj = limitsMap[areaNome];
  if (limitObj && typeof limitObj === 'object') return limitObj.limiteMaximo !== undefined ? limitObj.limiteMaximo : defaultLimit;
  return limitObj !== undefined ? limitObj : defaultLimit;
};

export const getLimiteAreaComGenero = (areaNome, limitsMap, defaultLimit = 5) => {
  const limitObj = limitsMap[areaNome] || {};
  return {
    limiteMaximo: limitObj.limiteMaximo || defaultLimit,
    limiteMulheres: limitObj.limiteMulheres || null,
    limiteHomens: limitObj.limiteHomens || null,
  };
};

export const getOcupacaoArea = (currentCount, limit) => {
  const numericLimit = Math.max(0, limit);
  return {
    isFull: currentCount >= numericLimit,
    isOverloaded: currentCount > numericLimit,
    remaining: Math.max(0, numericLimit - currentCount),
    percentage: numericLimit > 0 ? Math.round((currentCount / numericLimit) * 100) : (currentCount > 0 ? 100 : 0)
  };
};