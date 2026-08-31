import { supabase } from '@/services/supabaseClient';

export const searchEquipanteByCPF = async (cpf) => {
  try {
    if (!cpf || cpf.replace(/\D/g, '').length !== 11) return null;

    const cpfNormalizado = cpf.replace(/\D/g, '');

    const { data, error } = await supabase
      .from('equipantes')
      .select('*')
      .eq('cpf', cpfNormalizado)
      .eq('tipo', 'equipante')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('equipanteApi - searchEquipanteByCPF', error);
      return null;
    }

    if (!data) return null;

    return {
      id: data.id,

      // Dados pessoais
      nome: data.nome,
      cpf: data.cpf,
      sexo: data.sexo,
      whatsapp: data.whatsapp,
      telefoneResidencial: data.telefone_residencial,
      idade: data.idade,

      // Endereço
      cep: data.cep,
      endereco: data.endereco,
      numero: data.numero,
      complemento: data.complemento,
      bairro: data.bairro,
      cidade: data.cidade,
      estado: data.estado,

      // Saúde
      temProblemaSaude: data.tem_problema_saude,
      condicoesMedicas: data.condicoes_medicas,
      temRestricaoAlimentar: data.tem_restricao_alimentar,
      restricoesAlimentares: data.restricoes_alimentares,

      // Igreja
      igreja: data.igreja,
      ePastor: data.e_pastor,
      ePastorOutro: data.e_pastor_outro,
      pastor: data.pastor_nome,
      estaAfastado: data.esta_afastado,
      cargoIgreja: data.cargo_igreja,
      cargoIgrejaOutro: data.cargo_igreja_outro,

      // Participação
      frequentaEBD: data.frequenta_ebd,
      frequentaGrupoCuidado: data.frequenta_grupo_cuidado,

      // Habilidades
      voceCanta: data.voce_canta,
      tocaInstrumento: data.toca_instrumento,

      // Familiar
      familiarTrabalhando: data.familiar_trabalhando,
      familiarTrabalhandoOutro: data.familiar_trabalhando_outro,
      parentesco: data.parentesco,
      familiarNome: data.familiar_nome,

      // Acampante
      qualRadicalAcampante: data.qual_radical_acampante,
      qualRadicalAcampanteOutro: data.qual_radical_acampante_outro,

      // Experiência
      numeroEdicaoParticipou: data.numero_edicao_participou,
      jaTrabalhouEquipe: data.ja_trabalhou_equipe,
      edicaoTrabalhou: data.edicao_trabalhou,
      desejaTrabalharEdicao: data.deseja_trabalhar_edicao,

      // Autorização
      autorizacaoImagemEquipante: data.autorizacao_imagem,

      // Emergência
      contatoEmergencia: data.contato_emergencia_nome,
      telefoneEmergencia: data.contato_emergencia_telefone,

      // Áreas de trabalho
      areaTrabalhoOpcao1: data.area_trabalho_opcao1,
      areaTrabalhoOpcao2: data.area_trabalho_opcao2,
      areaTrabalhoOpcao3: data.area_trabalho_opcao3,
      areaTrabalhoExtra: data.area_trabalho_extra,

      // Outros
      metodoPagamento: data.metodo_pagamento,

      // Status
      status: data.status,
      status_pagamento: data.status_pagamento,
      inscrito: data.inscrito
    };

  } catch (err) {
    console.error('equipanteApi - searchEquipanteByCPF', err);
    return null;
  }
};

export const updateWorkflowStage = async (equipante_id, updates) => {
  if (!equipante_id) throw new Error("ID de equipante ausente");
  
  try {
    const { data, error } = await supabase
      .from('equipantes')
      .update(updates)
      .eq('id', equipante_id)
      .eq('tipo', 'equipante')
      .select()
      .single();
      
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('equipanteApi - updateWorkflowStage', err, { equipante_id, updates });
    throw new Error('Falha ao atualizar o status da etapa');
  }
};

export const uploadParentalAuthFile = async (equipante_id, file) => {
  if (!equipante_id || !file) throw new Error("Parâmetros inválidos para upload");

  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${equipante_id}-${Math.random()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('equipante-authorizations')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from('equipante-authorizations')
      .getPublicUrl(fileName);

    const { data, error } = await supabase
      .from('equipantes')
      .update({
        parental_auth_file_url: publicUrlData.publicUrl
      })
      .eq('id', equipante_id)
      .eq('tipo', 'equipante')
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('equipanteApi - uploadParentalAuthFile', err, { equipante_id });
    throw new Error('Erro ao realizar o upload da autorização');
  }
};

export const getEquipanteWorkflow = async (equipante_id) => {
  if (!equipante_id) return null;
  try {
    const { data, error } = await supabase
      .from('equipantes')
      .select('id, nome, cpf, idade, parental_auth_file_url, status, scale_status, status_pagamento')
      .eq('id', equipante_id)
      .eq('tipo', 'equipante')
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('equipanteApi - getEquipanteWorkflow', err, { equipante_id });
    throw new Error('Falha ao buscar fluxo de trabalho do equipante');
  }
};

export const getEquipantesByWorkflowStage = async () => {
  try {
    const { data, error } = await supabase
      .from('equipantes')
      .select('id, nome, cpf, idade, parental_auth_file_url, status, scale_status, status_pagamento')
      .eq('tipo', 'equipante')

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('equipanteApi - getEquipantesByWorkflowStage', err);
    throw new Error('Falha ao buscar equipantes para workflow');
  }
};

export const updateEquipanteInscrito = async (equipante_id) => {
  if (!equipante_id) throw new Error("ID de equipante ausente");
  try {
    const { data, error } = await supabase
      .from('equipantes')
      .update({ inscrito: true })
      .eq('id', equipante_id)
      .eq('tipo', 'equipante')
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('equipanteApi - updateEquipanteInscrito', err, { equipante_id });
    throw new Error('Não foi possível atualizar status inscrito');
  }
};

export const fetchEquipantesRaw = async () => {
  return supabase.from('equipantes').select('*');
};

export const updateEquipanteStatus = async (id, newStatus) => {
  return supabase.from('equipantes').update({ status: newStatus }).eq('id', id);
};

// Tabela geral dos organizadores: só mostra equipantes cuja inscrição já foi
// aprovada (pelo pastor/organizador, na tela de Aprovações). Inscrições
// pendentes ou rejeitadas ficam visíveis apenas na tela de Aprovações.
export const fetchEquipantesInscritos = async () => {
  return supabase.from('equipantes').select('*').eq('inscrito', true).eq('status', 'aprovado');
};

export const countEquipantesInscritos = async () => {
  return supabase
    .from('equipantes')
    .select('*', { count: 'exact', head: true })
    .eq('inscrito', true)
    .eq('status', 'aprovado');
};

export const resetEquipantesInscricoes = async () => {
  try {
    const { data, error } = await supabase
      .from('equipantes')
      .update({inscrito: false, status_pagamento: 'pendente', scale_status: 'pendente', status: 'pendente', parental_auth_file_url: null})
      .eq('tipo', 'equipante')
      .select('id');
      
    if (error) throw error;
    
    return { success: true, count: data ? data.length : 0 };
  } catch (error) {
    console.error("Error resetting equipantes inscriptions:", error);
    throw error;
  }
};
