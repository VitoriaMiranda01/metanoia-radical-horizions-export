import { supabase } from '@/services/supabaseClient';
import { comReenvio } from '@/services/serviceHelpers';

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
      dataNascimento: data.data_nascimento,
      idade: data.idade,  // campo calculado (public.idade), sempre a idade de hoje

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

// Mesmo bucket usado para o modelo de autorizacao para download
// (autorizacao-menor-idade-equipante), so que os arquivos enviados pelos
// responsaveis ficam dentro da pasta "envios/" para nao se misturar com o
// arquivo-modelo fixo que fica na raiz do bucket.
const PARENTAL_AUTH_BUCKET = 'autorizacao-menor-idade-equipante';

export const uploadParentalAuthFile = async (equipante_id, file, dono = {}) => {
  if (!equipante_id || !file) throw new Error("Parâmetros inválidos para upload");

  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `envios/${equipante_id}-${Math.random()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from(PARENTAL_AUTH_BUCKET)
      .upload(fileName, file);

    // O erro cru do Storage chegava inteiro na tela da pessoa -- ela via
    // "new row violates row-level security policy" e nao tinha o que fazer
    // com aquilo. A causa real fica no console, para quem for investigar.
    if (uploadError) {
      console.error('equipanteApi - upload no Storage', uploadError);
      throw new Error(
        'Não conseguimos guardar o arquivo. Tente de novo; se continuar, '
        + 'avise a organização.'
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from(PARENTAL_AUTH_BUCKET)
      .getPublicUrl(fileName);

    // O endereco do arquivo e gravado pelo servidor: quem envia a
    // autorizacao e um menor de idade que NAO esta logado, e escrever
    // direto na tabela leva 401 desde o travamento.
    const { data, error } = await supabase.rpc('registrar_autorizacao_pais', {
      p_id: equipante_id,
      p_url: publicUrlData?.publicUrl,
      p_cpf: dono.cpf ?? null,
      p_nome: dono.nome ?? null,
      p_nascimento: dono.nascimento ?? null,
    });

    if (error) throw error;
    if (!data?.ok) throw new Error(data?.erro || 'Não foi possível registrar a autorização.');

    return await getEquipanteWorkflow(equipante_id, dono);
  } catch (err) {
    console.error('equipanteApi - uploadParentalAuthFile', err, { equipante_id });
    throw new Error(err.message || 'Falha ao enviar a autorização');
  }
};

/**
 * "Já entregue": o menor declara que entregou a carta assinada em MAOS na
 * igreja, em vez de anexar o arquivo.
 *
 * Conclui a etapa na hora e libera o pagamento -- foi decisao explicita, para
 * nao travar o menor esperando a igreja. A conferencia do parceiro vem depois
 * e, se ele disser que nao recebeu, a declaracao cai e o pagamento volta a
 * travar (ver conferir_autorizacao_menor no banco).
 *
 * `entregue = false` desfaz, e so funciona enquanto ninguem conferiu.
 */
export const declararAutorizacaoEntregue = async (equipante_id, entregue, dono = {}) => {
  const { data, error } = await supabase.rpc('declarar_autorizacao_entregue', {
    p_id: equipante_id,
    p_entregue: entregue,
    p_cpf: dono.cpf ?? null,
    p_nome: dono.nome ?? null,
    p_nascimento: dono.nascimento ?? null,
  });

  if (error) throw new Error(error.message || 'Não foi possível registrar a entrega.');
  if (!data?.ok) throw new Error(data?.erro || 'Não foi possível registrar a entrega.');
  return await getEquipanteWorkflow(equipante_id, dono);
};

export const getEquipanteWorkflow = async (equipante_id, dono = {}) => {
  if (!equipante_id) return null;
  try {
    const { data, error } = await supabase.rpc('situacao_inscricao', {
      p_tipo: 'equipante',
      p_id: equipante_id,
      p_cpf: dono.cpf ?? null,
      p_nome: dono.nome ?? null,
      p_nascimento: dono.nascimento ?? null,
    });

    if (error) throw error;
    if (!data?.ok) throw new Error(data?.erro || 'Não foi possível carregar a situação da inscrição.');
    return data;
  } catch (err) {
    console.error('equipanteApi - getEquipanteWorkflow', err, { equipante_id });
    throw new Error(err.message || 'Falha ao buscar a situação da inscrição');
  }
};

export const getEquipantesByWorkflowStage = async () => {
  try {
    const { data, error } = await supabase
      .from('equipantes')
      .select('id, nome, cpf, data_nascimento, idade, parental_auth_file_url, status, scale_status, status_pagamento')
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

// Atualiza os dados cadastrais de um equipante (nome, contato, saude, igreja,
// familiar, experiencia etc.) a partir do botao "Editar" na tela de
// Gerenciar Inscricoes (EditarInscricaoModal.jsx). So os campos que vieram em
// `dados` sao alterados -- a tela so manda os campos daquela secao/formulario.
//
// Fora do escopo de proposito: pagamento, decisao de aprovacao
// (decidido_por/status -- tem tela propria, updateEquipanteStatus), escala/
// area de trabalho (OrganizerScalesPage) e o workflow da autorizacao de
// menor de idade -- editar esses por aqui poderia descolar o dado da tela
// que realmente controla aquele fluxo.
export const updateEquipante = async (equipanteId, dados) => {
  if (!equipanteId) {
    return { success: false, error: 'Equipante não informado' };
  }

  try {
    const { error } = await supabase
      .from('equipantes')
      .update(dados)
      .eq('id', equipanteId)
      .eq('tipo', 'equipante');

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('equipanteApi - updateEquipante', error, { equipanteId, dados });
    return { success: false, error: error.message || 'Erro ao tentar salvar as alterações.' };
  }
};

export const fetchEquipantesRaw = async () =>
  comReenvio(() => supabase.from('equipantes').select('*, idade'), { rotulo: 'equipantes' });

/**
 * Lista enxuta para o organizador ESCOLHER pessoas pelo nome (ex.: as areas
 * especiais Guia / Inimigo / Espirito Santo, em CpfsAreaEspecialManager.jsx).
 *
 * Traz so o necessario para identificar alguem na tela -- nome, CPF, igreja e
 * situacao da inscricao. O CPF vem porque continua sendo a CHAVE usada para
 * casar a pessoa na hora de alocar (nome nao serve de chave: dois equipantes
 * podem se chamar igual, e nome digitado com erro falharia em silencio). Na
 * tela, quem aparece e o nome; o CPF fica so como desempate.
 *
 * Sem filtro de status de proposito: o organizador pode pre-cadastrar
 * alguem para uma area especial antes mesmo da aprovacao (a tela mostra a
 * situacao ao lado do nome).
 */
export const fetchEquipantesParaSelecao = async () =>
  comReenvio(
    () => supabase
      .from('equipantes')
      .select('id, nome, cpf, igreja, status')
      .order('nome', { ascending: true }),
    { rotulo: 'equipantes para seleção' }
  );

/**
 * Aprova, rejeita ou devolve para pendente -- registrando QUEM decidiu.
 *
 * Era um UPDATE direto no campo "status", e por isso nao sobrava registro
 * nenhum do autor. Como a mesma tela e usada por organizador e por parceiro,
 * nem dava para saber de que lado veio a decisao.
 *
 * Agora quem escreve o nome e o servidor, lendo o cracha. De proposito: se o
 * nome viesse daqui, daria para assinar a aprovacao com o nome de outra
 * pessoa.
 *
 * Devolve { data: { status, decidido_por, decidido_por_tipo,
 * decidido_por_igreja, decidido_em } } para a tela mostrar na hora.
 */
export const updateEquipanteStatus = async (id, newStatus) => {
  const { data, error } = await supabase.rpc('decidir_inscricao', {
    p_id: id,
    p_status: newStatus
  });
  if (error) return { error };
  if (!data?.ok) return { error: new Error(data?.erro || 'Não foi possível registrar a decisão.') };
  return { data };
};

// Tabela geral dos organizadores: só mostra equipantes cuja inscrição já foi
// aprovada (pelo pastor/organizador, na tela de Aprovações). Inscrições
// pendentes ou rejeitadas ficam visíveis apenas na tela de Aprovações.
export const fetchEquipantesInscritos = async () =>
  comReenvio(
    () => supabase.from('equipantes').select('*, idade').eq('inscrito', true).eq('status', 'aprovado'),
    { rotulo: 'equipantes inscritos' }
  );

export const countEquipantesInscritos = async () =>
  comReenvio(
    () => supabase
      .from('equipantes')
      .select('*', { count: 'exact', head: true })
      .eq('inscrito', true)
      .eq('status', 'aprovado'),
    { rotulo: 'contagem de equipantes' }
  );

// O reset de edicao saiu daqui. Era um UPDATE solto do navegador que deixava
// para tras as escalas, as areas de trabalho e os rastros de pagamento da
// edicao velha -- e, junto com o DELETE de acampantes, eram duas chamadas
// separadas: se a segunda falhasse, a base ficava metade numa edicao e
// metade na outra. Agora e uma transacao so no servidor:
// organizerConfigService.resetarParaNovaEdicao -> resetar_para_nova_edicao.

// ---------------------------------------------------------------------------
// Conferencia das autorizacoes de menores.
//
// O menor conclui a etapa sozinho -- anexando o arquivo ou marcando "Já
// entregue". Depois a igreja (ou a organizacao) confirma que tem a carta em
// maos. Parceiro so enxerga os menores da propria igreja; organizador ve
// todos, inclusive quem escolheu OUTRA ou nao congrega e por isso nao tem
// parceiro nenhum para conferir.
// ---------------------------------------------------------------------------

export const fetchMenoresParaConferencia = async () => {
  const { data, error } = await comReenvio(
    () => supabase.rpc('menores_para_conferencia'),
    { rotulo: 'autorizações de menores' }
  );
  if (error) {
    console.error('equipanteApi - menores para conferência', error?.message || error);
    return { success: false, error: error.message || 'Erro ao carregar', itens: [] };
  }
  if (!data?.ok) return { success: false, error: data?.erro || 'Não foi possível carregar', itens: [] };
  return { success: true, itens: data.itens || [], papel: data.papel };
};

// conferida = false não é só tirar o visto: quando a autorização veio por
// declaração (sem arquivo), significa "não recebi esta carta" -- a declaração
// cai junto e o pagamento do menor volta a travar. Quem decide isso é o
// servidor; aqui só relatamos o que ele respondeu.
export const conferirAutorizacaoMenor = async (equipanteId, conferida) => {
  const { data, error } = await comReenvio(
    () => supabase.rpc('conferir_autorizacao_menor', {
      p_id: equipanteId,
      p_conferida: conferida
    }),
    { rotulo: 'conferência da autorização' }
  );
  if (error) return { success: false, error: error.message || 'Erro ao salvar' };
  if (!data?.ok) return { success: false, error: data?.erro || 'Não foi possível salvar' };
  return {
    success: true,
    conferida: !!data.conferida,
    declaracaoRemovida: !!data.declaracao_removida,
    por: data.por || null
  };
};
