import { supabase } from '@/services/supabaseClient';
import { withRetry } from '@/services/serviceHelpers';

// Não busca mais data_edicao_dia_inicio/dia_fim/mes/ano na tabela
// "organizadores" (removido em 2026-09-04, a pedido da usuaria). Motivo:
// essa tabela nunca chegou a ter nenhuma linha em producao (o
// saveConfiguracoes so fazia UPDATE nela, nunca INSERT, entao o valor
// nunca era persistido de verdade) e, na pratica, nao fazia falta --
// OrganizerConfigPage.jsx ja reconstroi dia/mes/ano a partir de
// data_evento_inicio/data_evento_fim (via parseDateString), que sao salvos
// corretamente aqui em "configuracoes". Nao ha motivo de negocio pra
// separar esses campos por organizador.
export const fetchConfiguracoes = async () => {
  return withRetry(async () => {
    try {
      if (!navigator.onLine) return { max_equipantes: 0, max_acampantes: 0, max_acampantes_homens: 0, max_acampantes_mulheres: 0, equipante_pricing_periods: [], acampante_pricing_periods: [], edicao_numero: '' };
      
      let configQuery = supabase.from('configuracoes').select('id, data_evento_inicio, data_evento_fim, horario_saida_igreja, horario_retorno_sitio, data_limite_inscricao_pagamento, max_equipantes, max_acampantes, updated_at, equipante_pricing_periods, acampante_pricing_periods, max_acampantes_homens, max_acampantes_mulheres, edicao_numero, cpfs_area_guia, cpfs_area_inimigo, cpfs_area_espirito_santo');
      
      const { data, error } = await configQuery.order('updated_at', { ascending: false }).limit(1).maybeSingle();
      if (error && !['PGRST205', '42P01', '42703'].includes(error.code)) {
        throw error;
      }

      const mergedConfig = {
        id: data?.id || '00000000-0000-0000-0000-000000000001',
        edicao_numero: data?.edicao_numero || '',
        max_equipantes: data?.max_equipantes ?? 0,
        max_acampantes: data?.max_acampantes ?? 0,
        max_acampantes_homens: data?.max_acampantes_homens ?? 0,
        max_acampantes_mulheres: data?.max_acampantes_mulheres ?? 0,
        horario_saida_igreja: data?.horario_saida_igreja || '',
        horario_retorno_sitio: data?.horario_retorno_sitio || '',
        data_limite_inscricao_pagamento: data?.data_limite_inscricao_pagamento || '',
        updated_at: data?.updated_at,
        equipante_pricing_periods: data?.equipante_pricing_periods || [],
        acampante_pricing_periods: data?.acampante_pricing_periods || [],
        cpfs_area_guia: data?.cpfs_area_guia || [],
        cpfs_area_inimigo: data?.cpfs_area_inimigo || [],
        cpfs_area_espirito_santo: data?.cpfs_area_espirito_santo || [],
        data_evento_inicio: data?.data_evento_inicio || '',
        data_evento_fim: data?.data_evento_fim || ''
      };

      return mergedConfig;
    } catch (error) {
      console.error("[fetchConfiguracoes] Fatal load error:", error);
      return { max_equipantes: 0, max_acampantes: 0, max_acampantes_homens: 0, max_acampantes_mulheres: 0, equipante_pricing_periods: [], acampante_pricing_periods: [], cpfs_area_guia: [], cpfs_area_inimigo: [], cpfs_area_espirito_santo: [], edicao_numero: '' };
    }
  });
};

export const updatePricingPeriods = async (type, periods) => {
  try {
    if (!navigator.onLine) throw new Error("Você está offline. Verifique sua conexão.");
    
    const column = type === 'equipante' ? 'equipante_pricing_periods' : 'acampante_pricing_periods';
    
    const { data: existing, error: checkError } = await supabase
      .from('configuracoes')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (checkError) throw checkError;

    let data, error;
    if (existing?.id) {
      ({ data, error } = await supabase
        .from('configuracoes')
        .update({ [column]: periods, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single());
    } else {
      ({ data, error } = await supabase
        .from('configuracoes')
        .insert({ [column]: periods, updated_at: new Date().toISOString() })
        .select()
        .single());
    }

    if (error) throw error;
    return data;
  } catch (error) {
    console.error(`[updatePricingPeriods] Error updating ${type} periods:`, error);
    throw error;
  }
};

// Salva a lista de CPFs escolhidos pro organizador pra uma das 3 areas
// especiais (Guia, Inimigo, Espirito Santo), que nao aparecem no
// formulario de equipante. Mesmo padrao de updatePricingPeriods: salva
// direto na tabela configuracoes, de forma independente do botao "Salvar
// Configuracoes Gerais". Por enquanto isso so registra a informacao --
// nenhuma logica de alocacao usa esses dados ainda (pedido explicito da
// usuaria nesta etapa).
const CPFS_AREA_COLUMN_MAP = {
  guia: 'cpfs_area_guia',
  inimigo: 'cpfs_area_inimigo',
  espirito_santo: 'cpfs_area_espirito_santo'
};

export const updateCpfsAreaEspecial = async (area, cpfs) => {
  try {
    if (!navigator.onLine) throw new Error("Você está offline. Verifique sua conexão.");

    const column = CPFS_AREA_COLUMN_MAP[area];
    if (!column) throw new Error(`Área especial desconhecida: ${area}`);

    const { data: existing, error: checkError } = await supabase
      .from('configuracoes')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (checkError) throw checkError;

    let data, error;
    if (existing?.id) {
      ({ data, error } = await supabase
        .from('configuracoes')
        .update({ [column]: cpfs, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single());
    } else {
      ({ data, error } = await supabase
        .from('configuracoes')
        .insert({ [column]: cpfs, updated_at: new Date().toISOString() })
        .select()
        .single());
    }

    if (error) throw error;
    return data;
  } catch (error) {
    console.error(`[updateCpfsAreaEspecial] Error updating ${area} CPFs:`, error);
    throw error;
  }
};

// Busca so os CPFs configurados pras 3 areas especiais (Guia, Inimigo,
// Espirito Santo), usado pelo botao "Alocar Áreas Especiais" na tela de
// escalas (src/pages/OrganizerScalesPage.jsx) -- select enxuto, sem trazer
// o resto da configuracao geral que essa tela nao usa. Chaves batem com
// AREAS_ESPECIAIS (src/constants/workAreas.js): guia, inimigo,
// espirito_santo.
export const fetchCpfsAreasEspeciais = async () => {
  try {
    const { data, error } = await supabase
      .from('configuracoes')
      .select('cpfs_area_guia, cpfs_area_inimigo, cpfs_area_espirito_santo')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return {
      guia: data?.cpfs_area_guia || [],
      inimigo: data?.cpfs_area_inimigo || [],
      espirito_santo: data?.cpfs_area_espirito_santo || []
    };
  } catch (error) {
    console.error('[fetchCpfsAreasEspeciais] Error:', error);
    return { guia: [], inimigo: [], espirito_santo: [] };
  }
};

export const saveConfiguracoes = async (config) => {
  try {
    if (!navigator.onLine) throw new Error("Você está offline. Verifique sua conexão.");
    
    const { data: existing, error: checkError } = await supabase
      .from('configuracoes')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (checkError) throw checkError;

    const payloadBase = { 
      edicao_numero: config.edicao_numero ? parseInt(config.edicao_numero, 10) : null,
      max_equipantes: parseInt(config.max_equipantes, 10) || 0,
      max_acampantes: parseInt(config.max_acampantes, 10) || 0,
      max_acampantes_homens: parseInt(config.max_acampantes_homens, 10) || 0,
      max_acampantes_mulheres: parseInt(config.max_acampantes_mulheres, 10) || 0,
      horario_saida_igreja: config.horario_saida_igreja || null,
      horario_retorno_sitio: config.horario_retorno_sitio || null,
      data_limite_inscricao_pagamento: config.data_limite_inscricao_pagamento || null,
      data_evento_inicio: config.data_evento_inicio || null,
      data_evento_fim: config.data_evento_fim || null,
      updated_at: new Date().toISOString() 
    };

    let data, error;
    if (existing?.id) {
      ({ data, error } = await supabase
        .from('configuracoes')
        .update(payloadBase)
        .eq('id', existing.id)
        .select()
        .single());
    } else {
      ({ data, error } = await supabase
        .from('configuracoes')
        .insert(payloadBase)
        .select()
        .single());
    }

    if (error) throw error;

    // Não grava mais data_edicao_dia_inicio/dia_fim/mes/ano na tabela
    // "organizadores" (removido em 2026-09-04 -- ver comentário em
    // fetchConfiguracoes). O dado que realmente importa (a data do evento)
    // já foi salvo acima, em data_evento_inicio/data_evento_fim.

    return data;
  } catch (error) {
    console.error("[saveConfiguracoes] Fatal Error:", error);
    throw error;
  }
};

export const fetchEventoDatas = async () => {
  return supabase
    .from('configuracoes')
    .select('data_evento_inicio, data_evento_fim, edicao_numero')
    .limit(1)
    .single();
};

export const subscribeToConfiguracoesChanges = (channelName, onChange) => {
  const channel = supabase
    .channel(channelName)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracoes' }, onChange)
    .subscribe();

  return () => supabase.removeChannel(channel);
};

export const fetchConfiguracoesEvento = async () => {
  return supabase
    .from('configuracoes')
    .select('data_evento_inicio, data_evento_fim, horario_saida_igreja, horario_retorno_sitio, data_limite_inscricao_pagamento, updated_at')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
};

export const fetchPricingConfig = async (edicao_numero) => {
  let query = supabase
    .from('configuracoes')
    .select('valor_acampante, valor_equipante, acampante_pricing_periods, equipante_pricing_periods');

  if (edicao_numero) {
    query = query.eq('edicao_numero', edicao_numero);
  } else {
    query = query.order('edicao_numero', { ascending: false }).limit(1);
  }

  return query.maybeSingle();
};
