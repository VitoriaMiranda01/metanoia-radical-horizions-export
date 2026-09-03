import { supabase } from '@/services/supabaseClient';
import { AREAS_ESPECIAIS } from '@/constants/workAreas';

// Camada de service pra alocacao automatica/manual de equipantes em areas de
// trabalho. Toda a decisao (preferencias, capacidade, limite por sexo,
// concorrencia) mora na funcao do banco (alocar_equipante_automaticamente /
// alocar_equipante_manualmente — ver database/migrations/schema-update-
// 20260831-alocacao-equipantes.sql); este arquivo so chama a funcao certa e
// normaliza o retorno pro resto do app.

// Chamada automaticamente logo apos um equipante ser aprovado (ver
// ApprovalsView.jsx). Nunca lanca excecao pro chamador — se a alocacao falhar
// por qualquer motivo de infra, a aprovacao em si ja aconteceu e nao deve
// ficar bloqueada por causa disso (mesmo padrao ja usado pro sorteio de
// grupo de trilha do acampante, em criarInscricao).
export const alocarEquipanteAutomaticamente = async (equipanteId) => {
  if (!equipanteId) {
    return { success: false, error: 'ID de equipante ausente' };
  }

  try {
    const { data, error } = await supabase.rpc('alocar_equipante_automaticamente', {
      p_equipante_id: equipanteId
    });

    if (error) throw error;

    const resultado = Array.isArray(data) ? data[0] : data;

    return {
      success: true,
      alocado: !!resultado?.alocado,
      area: resultado?.area_alocada || null
    };
  } catch (error) {
    console.error('equipanteAllocationApi - alocarEquipanteAutomaticamente', error, { equipanteId });
    return { success: false, error: error.message || 'Erro ao tentar alocar equipante automaticamente' };
  }
};

// Alocacao manual: organizador escolhe a area de alguem que esta na lista de
// espera. A funcao do banco confere de novo, na hora, se a vaga realmente
// ainda existe (capacidade total + limite do sexo) antes de gravar — por
// isso o retorno pode vir com sucesso=false mesmo que a tela achasse que
// havia vaga (ex: outro organizador ocupou a vaga um instante antes).
export const alocarEquipanteManualmente = async (equipanteId, area) => {
  if (!equipanteId || !area) {
    return { success: false, error: 'Equipante ou área não informados' };
  }

  try {
    const { data, error } = await supabase.rpc('alocar_equipante_manualmente', {
      p_equipante_id: equipanteId,
      p_area: area
    });

    if (error) throw error;

    const resultado = Array.isArray(data) ? data[0] : data;

    if (!resultado?.sucesso) {
      return { success: false, error: resultado?.mensagem || 'Não foi possível alocar' };
    }

    return { success: true };
  } catch (error) {
    console.error('equipanteAllocationApi - alocarEquipanteManualmente', error, { equipanteId, area });
    return { success: false, error: error.message || 'Erro ao tentar alocar equipante manualmente' };
  }
};

// Cancelamento de um equipante ja aprovado (organizador clica em "Rejeitar"
// na aba "Aprovadas" da tela de Aprovacoes, apos confirmar num dialogo).
// Chamada pelo app logo apos o UPDATE que muda equipantes.status pra
// 'rejeitado'. Se o equipante tinha uma linha em escalas, ela e apagada
// (libera a vaga) e em seguida a funcao tenta alocar o primeiro compativel
// da lista de espera (por ordem de chegada) nessa vaga liberada — tudo
// dentro da funcao do banco (liberar_vaga_e_realocar, ver
// database/migrations/schema-update-20260901-liberacao-vaga-cancelamento.sql),
// protegido pela mesma trava usada nas outras alocacoes. Nunca lanca
// excecao pro chamador — mesmo espirito das outras funcoes desta camada: o
// cancelamento em si ja aconteceu e nao deve ficar bloqueado por causa de
// uma falha aqui.
export const liberarVagaERealocar = async (equipanteId) => {
  if (!equipanteId) {
    return { success: false, error: 'ID de equipante ausente' };
  }

  try {
    const { data, error } = await supabase.rpc('liberar_vaga_e_realocar', {
      p_equipante_id: equipanteId
    });

    if (error) throw error;

    const resultado = Array.isArray(data) ? data[0] : data;

    return {
      success: true,
      vagaLiberada: !!resultado?.vaga_liberada,
      areaLiberada: resultado?.area_liberada || null,
      novoAlocadoId: resultado?.novo_alocado_id || null,
      novoAlocadoNome: resultado?.novo_alocado_nome || null,
      novoAlocadoArea: resultado?.novo_alocado_area || null
    };
  } catch (error) {
    console.error('equipanteAllocationApi - liberarVagaERealocar', error, { equipanteId });
    return { success: false, error: error.message || 'Erro ao tentar liberar vaga e realocar' };
  }
};

// Realocacao: organizador troca a area de um equipante que JA esta alocado
// (diferente de alocarEquipanteManualmente, que so serve pra quem ainda esta
// na lista de espera -- a funcao do banco recusa explicitamente qualquer
// equipante que ja tenha linha em escalas). A funcao do banco
// (realocar_equipante, ver database/migrations/schema-update-20260903-
// realocar-equipante.sql) confere vaga na area de destino (capacidade +
// limite por sexo) com a mesma trava de concorrencia das outras alocacoes,
// e so entao atualiza a linha existente em escalas (mesma linha, so troca
// area_alocada -- nao apaga e recria).
export const realocarEquipante = async (equipanteId, novaArea) => {
  if (!equipanteId || !novaArea) {
    return { success: false, error: 'Equipante ou área não informados' };
  }

  try {
    const { data, error } = await supabase.rpc('realocar_equipante', {
      p_equipante_id: equipanteId,
      p_nova_area: novaArea
    });

    if (error) throw error;

    const resultado = Array.isArray(data) ? data[0] : data;

    if (!resultado?.sucesso) {
      return { success: false, error: resultado?.mensagem || 'Não foi possível realocar' };
    }

    return { success: true, areaAnterior: resultado?.area_anterior || null };
  } catch (error) {
    console.error('equipanteAllocationApi - realocarEquipante', error, { equipanteId, novaArea });
    return { success: false, error: error.message || 'Erro ao tentar realocar equipante' };
  }
};

// Acao em lote do botao "Alocar Áreas Especiais" (tela de escalas): pra
// cada uma das 3 areas especiais (Guia, Inimigo, Espirito Santo), compara
// os CPFs configurados em Configuracoes (cpfs_area_guia/inimigo/
// espirito_santo, buscados via fetchCpfsAreasEspeciais em
// organizerConfigService.js) com o CPF de cada equipante aprovado. Quando
// acha uma correspondencia:
//   - se o equipante ja esta alocado em outra area, realoca pra area
//     especial configurada via realocarEquipante -- ou seja, passa pela
//     MESMA checagem de vaga/limite de sexo da area de destino que ja
//     vale pra qualquer outra realocacao manual (nao ha bypass de
//     capacidade so por vir desta acao em lote);
//   - se ja esta alocado NA PROPRIA area especial, nao faz nada (conta
//     como "ja estava correto", nao e erro);
//   - se o equipante ainda nao tem nenhuma alocacao (esta na lista de
//     espera), esta acao NAO mexe nele -- "realocar" pressupoe uma area
//     de origem. Ele so sera movido numa proxima execucao deste botao,
//     depois de ganhar uma alocacao inicial (automatica ao ser aprovado,
//     ou manual). Isso e reportado separadamente pro organizador saber
//     que precisa de uma acao antes.
//   - se o CPF configurado nao bate com nenhum equipante aprovado
//     (pessoa nao inscrita, ainda pendente de aprovacao, ou CPF digitado
//     errado em Configuracoes), e reportado como "nao encontrado".
// Roda uma realocacao de cada vez (sequencial, nao em paralelo) -- alem de
// mais simples, evita qualquer disputa entre chamadas desta mesma acao em
// lote (a checagem de vaga em si ja e protegida pela trava do banco,
// igual as outras alocacoes).
export const alocarAreasEspeciaisPorCpf = async (cpfsPorArea, equipantesAprovados, allocations) => {
  const normalizarCpf = (cpf) => (cpf || '').replace(/\D/g, '');

  // Mapa mutavel: vai sendo atualizado a cada realocacao bem-sucedida
  // dentro deste mesmo loop, pra que, no caso raro de um CPF aparecer
  // configurado em mais de uma area especial por engano, a segunda
  // passada ja veja a area mais recente (nao a original antes desta
  // acao em lote).
  const alocacaoPorEquipanteId = new Map((allocations || []).map(a => [a.id, a]));
  const equipantePorCpf = new Map(
    (equipantesAprovados || [])
      .filter(eq => normalizarCpf(eq.cpf))
      .map(eq => [normalizarCpf(eq.cpf), eq])
  );

  const resultado = {
    movidos: [],
    jaNaAreaCorreta: [],
    aindaNaoAlocados: [],
    naoEncontrados: [],
    falhas: []
  };

  for (const area of AREAS_ESPECIAIS) {
    const cpfsConfigurados = cpfsPorArea?.[area.key] || [];

    for (const cpfConfigurado of cpfsConfigurados) {
      const equipante = equipantePorCpf.get(normalizarCpf(cpfConfigurado));

      if (!equipante) {
        resultado.naoEncontrados.push({ cpf: cpfConfigurado, area: area.label });
        continue;
      }

      const alocacaoAtual = alocacaoPorEquipanteId.get(equipante.id);

      if (!alocacaoAtual) {
        resultado.aindaNaoAlocados.push({ nome: equipante.nome, cpf: cpfConfigurado, area: area.label });
        continue;
      }

      if (alocacaoAtual.allocatedArea === area.label) {
        resultado.jaNaAreaCorreta.push({ nome: equipante.nome, area: area.label });
        continue;
      }

      const realoc = await realocarEquipante(equipante.id, area.label);
      if (realoc.success) {
        resultado.movidos.push({ nome: equipante.nome, de: alocacaoAtual.allocatedArea, para: area.label });
        alocacaoPorEquipanteId.set(equipante.id, { ...alocacaoAtual, allocatedArea: area.label });
      } else {
        resultado.falhas.push({ nome: equipante.nome, area: area.label, erro: realoc.error });
      }
    }
  }

  return resultado;
};

// Lista de espera: equipantes aprovados que ainda nao tem linha em escalas.
// Calculada ao vivo (nao persistida em lugar nenhum) a partir de duas
// consultas que ja existiam (fetchApprovedEquipantes/fetchAllAllocations,
// em scalesService.js) — reaproveitadas aqui pra nao duplicar logica de
// busca, so a comparacao muda.
export const fetchListaEspera = async (equipantesAprovados, alocacoesAtuais) => {
  const idsAlocados = new Set((alocacoesAtuais || []).map(a => a.id));
  return (equipantesAprovados || []).filter(eq => !idsAlocados.has(eq.id));
};
