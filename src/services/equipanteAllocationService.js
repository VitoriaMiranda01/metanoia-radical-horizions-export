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

// Move UMA participacao de area. Endereçada pelo id da LINHA em escalas
// (escalaId), nao pela pessoa: desde 12/09/2026 a mesma pessoa pode estar em
// mais de uma area, entao "realocar o fulano" deixou de ser sem ambiguidade.
export const realocarAlocacao = async (escalaId, novaArea) => {
  if (!escalaId || !novaArea) {
    return { success: false, error: 'Alocação ou área não informadas' };
  }
  try {
    const { data, error } = await supabase.rpc('realocar_alocacao', {
      p_escala_id: escalaId,
      p_nova_area: novaArea
    });
    if (error) throw error;
    if (!data?.ok) return { success: false, error: data?.erro || 'Não foi possível realocar' };
    return { success: true, areaAnterior: data.area_anterior };
  } catch (error) {
    console.error('equipanteAllocationApi - realocarAlocacao', error, { escalaId, novaArea });
    return { success: false, error: error.message || 'Erro ao realocar' };
  }
};

// Tira a pessoa de UMA area. Se era a unica, ela volta para a fila "A
// escalar" -- e por isso o botao pede confirmacao na tela.
export const removerAlocacao = async (escalaId) => {
  if (!escalaId) return { success: false, error: 'Alocação não informada' };
  try {
    const { data, error } = await supabase.rpc('remover_alocacao', { p_escala_id: escalaId });
    if (error) throw error;
    if (!data?.ok) return { success: false, error: data?.erro || 'Não foi possível remover' };
    return { success: true, area: data.area, restam: data.restam };
  } catch (error) {
    console.error('equipanteAllocationApi - removerAlocacao', error, { escalaId });
    return { success: false, error: error.message || 'Erro ao remover' };
  }
};

// Acao em lote do botao "Alocar Áreas Especiais" (tela de escalas): pra
// cada uma das 3 areas especiais (Guia, Inimigo, Espirito Santo), compara
// os CPFs configurados em Configuracoes (cpfs_area_guia/inimigo/
// espirito_santo, buscados via fetchCpfsAreasEspeciais em
// organizerConfigService.js) com o CPF de cada equipante aprovado. Quando
// acha uma correspondencia:
//   - se o equipante ja esta alocado em outra area, MOVE a participacao
//     dele para a area especial -- passa pela mesma checagem de vaga e de
//     limite por sexo de qualquer outra realocacao. Desde 12/09/2026 uma
//     pessoa pode ter mais de uma area; aqui movemos a PRIMEIRA delas, que
//     e o comportamento de sempre (na pratica este botao roda no comeco da
//     distribuicao, quando quase ninguem tem duas);
//   - se ja esta na propria area especial, nao faz nada (conta como "ja
//     estava correto", nao e erro);
//   - se ainda nao tem alocacao nenhuma, aloca DIRETO na area especial;
//   - se o CPF configurado nao bate com nenhum equipante aprovado (pessoa
//     nao inscrita, ainda pendente, ou CPF digitado errado), e reportado
//     como "nao encontrado".
// Roda uma de cada vez (sequencial), pelo mesmo motivo de antes.
export const alocarAreasEspeciaisPorCpf = async (cpfsPorArea, equipantesAprovados, allocations) => {
  const normalizarCpf = (cpf) => (cpf || '').replace(/\D/g, '');

  // Mapa mutavel: vai sendo atualizado a cada realocacao bem-sucedida
  // dentro deste mesmo loop, pra que, no caso raro de um CPF aparecer
  // configurado em mais de uma area especial por engano, a segunda
  // passada ja veja a area mais recente (nao a original antes desta
  // acao em lote).
  // Guarda a PRIMEIRA participacao de cada pessoa: e ela que sera movida.
  const alocacaoPorEquipanteId = new Map();
  (allocations || []).forEach(a => {
    if (!alocacaoPorEquipanteId.has(a.id)) alocacaoPorEquipanteId.set(a.id, a);
  });
  const equipantePorCpf = new Map(
    (equipantesAprovados || [])
      .filter(eq => normalizarCpf(eq.cpf))
      .map(eq => [normalizarCpf(eq.cpf), eq])
  );

  const resultado = {
    movidos: [],
    alocadosDiretamente: [],
    jaNaAreaCorreta: [],
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
        const alocacao = await alocarEquipanteManualmente(equipante.id, area.label);
        if (alocacao.success) {
          resultado.alocadosDiretamente.push({ nome: equipante.nome, area: area.label });
          alocacaoPorEquipanteId.set(equipante.id, { id: equipante.id, allocatedArea: area.label });
        } else {
          resultado.falhas.push({ nome: equipante.nome, area: area.label, erro: alocacao.error });
        }
        continue;
      }

      if (alocacaoAtual.allocatedArea === area.label) {
        resultado.jaNaAreaCorreta.push({ nome: equipante.nome, area: area.label });
        continue;
      }

      const realoc = await realocarAlocacao(alocacaoAtual.escalaId, area.label);
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
