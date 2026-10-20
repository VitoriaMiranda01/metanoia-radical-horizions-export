import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, UserPlus } from 'lucide-react';
import Layout from '@/components/Layout';
import InscricoesStatsCards from '@/components/gerenciar/InscricoesStatsCards';
import InscricaoDetalhesModal from '@/components/common/InscricaoDetalhesModal';
import InscricoesTable from '@/components/gerenciar/InscricoesTable';
import TotalEdicaoTable from '@/components/gerenciar/TotalEdicaoTable';
import AcampantesTable from '@/components/gerenciar/AcampantesTable';
import GruposTrailhaCards from '@/components/gerenciar/GruposTrailhaCards';
import GruposTrailhaModal from '@/components/gerenciar/GruposTrailhaModal';
import VinculosAcampantesDialog from '@/components/gerenciar/VinculosAcampantesDialog';
import OnibusDialog from '@/components/gerenciar/OnibusDialog';
import { useVinculosAcampantes } from '@/hooks/useVinculosAcampantes';
import { textoDosVinculos } from '@/utils/vinculosAcampantes';
import AcampantesStatsCards from '@/components/gerenciar/AcampantesStatsCards';
import AcampantesDetailModal from '@/components/gerenciar/AcampantesDetailModal';
import EditarInscricaoModal from '@/components/gerenciar/EditarInscricaoModal';
import AvisoTelefonesAcampantes from '@/components/gerenciar/AvisoTelefonesAcampantes';
import AvisoContatoEmergencia from '@/components/gerenciar/AvisoContatoEmergencia';
import AvisoCamisas from '@/components/gerenciar/AvisoCamisas';
import AvisoCadastro from '@/components/gerenciar/AvisoCadastro';
import AvisoNascimento from '@/components/gerenciar/AvisoNascimento';
import PedidosAcessoQuadro from '@/components/gerenciar/PedidosAcessoQuadro';
import DuplicadosQuadro from '@/components/gerenciar/DuplicadosQuadro';
import CentralNotificacoes from '@/components/gerenciar/CentralNotificacoes';
import PendenciasEquipantes, { BotaoPendencias } from '@/components/gerenciar/PendenciasEquipantes';
import { fichasComPendencias } from '@/utils/pendenciasEquipante';
import { useAvisosInscricoes } from '@/hooks/useAvisosInscricoes';
import InscricaoManualDialog from '@/components/gerenciar/InscricaoManualDialog';
import RemoverAcampanteDialog from '@/components/gerenciar/RemoverAcampanteDialog';
import { getAcampantes, countAcampantes, realocarGrupoTrailha, salvarObservacaoAcampante, updateAcampante } from '@/services/acampantesService';
import { fetchEquipantesDaEdicao, fetchIdsEquipantesConfirmados, updateEquipante, podeInscreverManual } from '@/services/equipantesService';
import { fetchInfiltradosNosGrupos } from '@/services/infiltradosService';
import { definirCor } from '@/services/scalesService';
import { groupAcampantesByTrilha } from '@/utils/gruposTrailha';

const GerenciarInscricoesPage = () => {
  const { toast } = useToast();
  
  const [inscricoes, setInscricoes] = useState([]);
  // Pedidos de acesso e duplicados (16/10/2026): resolver um pode mudar o outro.
  const [versaoFichas, setVersaoFichas] = useState(0);
  const [acampantesList, setAcampantesList] = useState([]);
  
  const [totalAcampantes, setTotalAcampantes] = useState(0);
  // Ids dos confirmados na chamada da reuniao de escala (null = nao disponivel).
  const [idsConfirmados, setIdsConfirmados] = useState(null);
  // Aba aberta. Estado (e nao defaultValue) porque os quadros de cima trocam
  // de aba: Equipantes inscritos/confirmados -> Equipantes, Acampantes ->
  // Acampantes.
  const [aba, setAba] = useState('acampantes');
  const abasRef = useRef(null);
  // Situacao mostrada na lista de equipantes. Comeca em Aprovados, que era o
  // que esta tela mostrava antes; Pendentes e Rejeitados sao para corrigir a
  // ficha (igreja errada etc.) -- aprovar continua na tela de Aprovacoes.
  const [situacaoEquipantes, setSituacaoEquipantes] = useState('aprovado');

  const [loadingAcampantes, setLoadingAcampantes] = useState(false);
  const [errorAcampantes, setErrorAcampantes] = useState(null);
  
  const [selectedInscricao, setSelectedInscricao] = useState(null);
  const [inscricaoParaEditar, setInscricaoParaEditar] = useState(null);
  const [searchTermEquipantes, setSearchTermEquipantes] = useState('');

  const [acampanteToDeactivate, setAcampanteToDeactivate] = useState(null);
  
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [statsModalTitle, setStatsModalTitle] = useState('');
  const [statsModalData, setStatsModalData] = useState([]);
  // Ficha aberta a partir da lista de uma metrica: ao fechar, a lista volta.
  const [voltarParaMetrica, setVoltarParaMetrica] = useState(false);
  // Cadastros com pendencias dos equipantes (18/10/2026). Ao abrir uma ficha
  // a partir dela, a janela fecha e volta quando a ficha fecha.
  const [pendenciasAberto, setPendenciasAberto] = useState(false);
  const [voltarParaPendencias, setVoltarParaPendencias] = useState(false);
  
  const [refreshReports, setRefreshReports] = useState(0);

  // Inscricao manual: o botao so aparece para quem o servidor libera
  // (Raquel, Eduardo e Desenvolvedores).
  const [podeManual, setPodeManual] = useState(false);
  const [manualAberta, setManualAberta] = useState(false);
  // Avisa o quadro de telefones que uma ficha de acampante foi salva.
  const [acampanteSalvoEm, setAcampanteSalvoEm] = useState(0);
  // Avisos de fichas com problema (Raquel e Desenvolvedores) + o sino.
  const avisosInscricoes = useAvisosInscricoes(acampanteSalvoEm);
  // Infiltrados (12/10/2026): equipantes escalados em "Infiltrados" com a cor
  // do grupo. Depois da escala oficial entram nos grupos de trilha e nos
  // onibus como se fossem acampantes (sigilo), mas continuam equipantes --
  // nao entram na tabela, nos quadros nem nas contagens de acampantes.
  const [infiltrados, setInfiltrados] = useState({ oficial: false, lista: [], semCor: 0 });
  const carregarInfiltrados = async () => {
    const r = await fetchInfiltradosNosGrupos();
    if (r.success) setInfiltrados({ oficial: r.oficial, lista: r.infiltrados, semCor: r.semCor });
  };
  // Quem esta nos grupos de trilha: acampantes + infiltrados.
  const participantes = useMemo(() => [...acampantesList, ...infiltrados.lista], [acampantesList, infiltrados.lista]);
  // Vinculos entre acampantes nos grupos de trilha (12/10/2026): quem nao
  // deveria ficar no mesmo grupo. Esta tela e so de organizador. Vale
  // tambem com infiltrado.
  const vinc = useVinculosAcampantes(participantes);
  const [vinculosAberto, setVinculosAberto] = useState(false);
  // Listas dos onibus (12/10/2026).
  const [onibusAberto, setOnibusAberto] = useState(false);

  useEffect(() => {
    carregarEquipantes();
    fetchAcampantesSupabase();
    carregarInfiltrados();
    buscarTotais();
    podeInscreverManual().then(setPodeManual);
  }, []);

  const carregarEquipantes = async () => {
  try {
    const { data, error } = await fetchEquipantesDaEdicao();

    if (error) throw error;

    setInscricoes(data || []);
  } catch (error) {
    console.error('Erro ao carregar equipantes:', error);
    setInscricoes([]);
  }
};

  const fetchAcampantesSupabase = async () => {
    setLoadingAcampantes(true);
    setErrorAcampantes(null);
    try {
      const data = await getAcampantes();
      setAcampantesList(data || []);
      setRefreshReports(prev => prev + 1);
    } catch (error) {
      console.error("Erro ao buscar acampantes:", error);
      setErrorAcampantes("Falha ao carregar lista de acampantes. Verifique sua conexão.");
      toast({ 
        title: "Erro de Conexão", 
        description: "Não foi possível carregar os dados do servidor.",
        variant: "destructive"
      });
    } finally {
      setLoadingAcampantes(false);
    }
  };

  const buscarTotais = async () => {
    try {
      // Os equipantes sao contados pela propria lista (carregarEquipantes),
      // para o quadro e a lista mostrarem sempre o mesmo numero.
      const { count: acampantesCount, error: acampantesError } = await countAcampantes();

      if (acampantesError) throw acampantesError;

      setTotalAcampantes(acampantesCount || 0);
      setIdsConfirmados(await fetchIdsEquipantesConfirmados());
    } catch (error) {
      console.error('Erro ao buscar totais:', error);
    }
  };

  const handleDeleteAcampante = (acampante) => {
    setAcampanteToDeactivate(acampante);
  };

  // A exportacao de acampantes e equipantes agora e feita dentro de cada
  // tabela (ver handleExport em AcampantesTable.jsx / InscricoesTable.jsx),
  // que tem acesso direto aos dados ja filtrados na tela e as colunas
  // marcadas em "Colunas" -- substituiu essa funcao, que exportava uma
  // lista fixa de colunas (incluindo Email/Pastor/Status, que nem apareciam
  // mais na tabela) e sempre a lista completa, ignorando os filtros.

  // A busca fica na tabela (InscricoesTable, utils/busca.js). Filtrar aqui
  // antes, so por nome/e-mail/telefone, fazia a busca pela igreja nao achar
  // ninguem (04/10/2026). A lista vai inteira.
  const filterInscricoes = (list) => list;

  const { equipantes, equipantesConfirmados, filteredEquipantes, contagemSituacao } = useMemo(() => {
    const equipantes = inscricoes.filter(i => i.tipo === 'equipante');
    const confirmados = new Set(idsConfirmados || []);
    const equipantesConfirmados = equipantes.filter((i) => confirmados.has(i.id));
    const contagemSituacao = { aprovado: 0, pendente: 0, rejeitado: 0, todos: equipantes.length, confirmados: equipantesConfirmados.length };
    equipantes.forEach((i) => {
      if (contagemSituacao[i.status] !== undefined) contagemSituacao[i.status] += 1;
    });
    let daSituacao;
    if (situacaoEquipantes === 'todos') daSituacao = equipantes;
    else if (situacaoEquipantes === 'confirmados') daSituacao = equipantesConfirmados;
    else daSituacao = equipantes.filter((i) => i.status === situacaoEquipantes);
    return {
      equipantes,
      equipantesConfirmados,
      contagemSituacao,
      filteredEquipantes: filterInscricoes(daSituacao, searchTermEquipantes),
    };
  }, [inscricoes, searchTermEquipantes, situacaoEquipantes, idsConfirmados]);

  const fichasPendentes = useMemo(() => fichasComPendencias(equipantes), [equipantes]);

  // Clique nos quadros de cima: abre a aba (e a situacao) e desce ate ela.
  const abrirPeloQuadro = (chave) => {
    if (chave === 'acampantes') {
      setAba('acampantes');
    } else {
      setAba('equipantes');
      setSituacaoEquipantes(chave === 'confirmados' ? 'confirmados' : 'todos');
    }
    requestAnimationFrame(() => abasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const allocatedGroups = useMemo(() => {
    return groupAcampantesByTrilha(participantes);
  }, [participantes]);
  // O grupo aberto e sempre lido da lista atual (antes era uma copia tirada
  // no clique, que precisava ser refeita a cada mudanca).
  const grupoAberto = selectedGroup ? (allocatedGroups[selectedGroup.name] || []) : [];

  // Coluna "Não pode ficar com" da tabela/planilha de acampantes.
  const acampantesDaTabela = useMemo(() => {
    if (!vinc.vinculos.length) return acampantesList;
    return acampantesList.map((a) => {
      const texto = textoDosVinculos(vinc.porAcampante.get(a.id), vinc.porId);
      return texto ? { ...a, vinculos_grupo: texto } : a;
    });
  }, [acampantesList, vinc.vinculos, vinc.porAcampante, vinc.porId]);

  // Aviso do Editar inscricao ao trocar o grupo.
  const avisoDoGrupo = (acampanteId, grupo) => (vinc.carregado ? vinc.avisoParaGrupo(acampanteId, grupo) : []);

  const handleViewDetails = (acampante) => {
    const adapted = {
      ...acampante,
      telefone: acampante.whatsapp,
      contatoEmergencia: acampante.contato_emergencia_nome,
      telefoneEmergencia: acampante.contato_emergencia_telefone,
      experienciaAnterior: acampante.experiencia_anterior,
      motivacao: acampante.motivacao,
      condicoesMedicas: acampante.condicoes_medicas,
      restricoesAlimentares: acampante.restricoes_alimentares
    };
    setSelectedInscricao(adapted);
  };

  const handleGroupClick = (groupName) => {
    setSelectedGroup({ name: groupName });
    setIsGroupModalOpen(true);
  };

  // Realocacao manual de grupo de trilha, chamada pelo botao "Realocar" no
  // modal de um grupo (GruposTrailhaModal.jsx). Depois de salvar, busca a
  // lista de novo; o grupo aberto (grupoAberto) e recalculado sozinho.
  const handleRealocarGrupoTrailha = async (acampante, novoGrupo) => {
    // Infiltrado: o grupo dele e a cor na escala -- muda la (a tela de
    // Geracao de Escalas mostra a mesma coisa).
    let result;
    if (acampante.infiltrado) {
      try {
        const r = await definirCor(acampante.escala_id, novoGrupo);
        result = r?.ok ? { success: true } : { success: false, error: r?.erro };
      } catch (e) {
        result = { success: false, error: e.message };
      }
    } else {
      result = await realocarGrupoTrailha(acampante.id, novoGrupo);
    }

    if (result.success) {
      toast({
        title: acampante.infiltrado ? "Infiltrado realocado" : "Acampante realocado",
        description: `${acampante.nome} foi movido para o grupo ${novoGrupo}.`,
      });

      if (acampante.infiltrado) {
        await carregarInfiltrados();
      } else {
        const data = await getAcampantes();
        setAcampantesList(data || []);
      }
    } else {
      toast({
        title: "Erro ao realocar",
        description: result.error || "Não foi possível realocar o acampante.",
        variant: "destructive",
      });
    }

    return result;
  };

  // Salva a observacao breve escrita pelo organizador sobre um acampante,
  // direto no card dele dentro do modal de um grupo de trilha. Atualiza
  // acampantesList na hora, sem refetch -- e so um campo de texto.
  const handleSalvarObservacaoAcampante = async (acampante, observacao) => {
    const result = await salvarObservacaoAcampante(acampante.id, observacao);

    if (result.success) {
      toast({
        title: "Observação salva",
        description: `Observação de ${acampante.nome} foi atualizada.`,
      });

      setAcampantesList(prev =>
        prev.map(a => (a.id === acampante.id ? { ...a, observacoes_organizador: observacao } : a))
      );
    } else {
      toast({
        title: "Erro ao salvar observação",
        description: result.error || "Não foi possível salvar a observação.",
        variant: "destructive",
      });
    }

    return result;
  };

  // Abre o modal de edicao (EditarInscricaoModal.jsx) para um acampante ou
  // equipante -- os dois vem daqui, o modal decide o que mostrar olhando
  // para inscricao.tipo.
  const handleEditarInscricao = (item) => {
    setInscricaoParaEditar(item);
  };

  // Salva as alteracoes feitas no modal de edicao. Depois de salvar, busca a
  // lista de novo (mesmo padrao ja usado em confirmarDesativacaoAcampante /
  // handleRealocarGrupoTrailha) para a tabela refletir o dado atualizado.
  const handleSalvarEdicaoInscricao = async (id, dadosAlterados) => {
    const ehEquipante = inscricaoParaEditar?.tipo === 'equipante';
    const resultado = ehEquipante
      ? await updateEquipante(id, dadosAlterados)
      : await updateAcampante(id, dadosAlterados);

    if (resultado.success) {
      if (ehEquipante) {
        await carregarEquipantes();
      } else {
        await fetchAcampantesSupabase();
        setAcampanteSalvoEm(Date.now());
      }
    }

    return resultado;
  };

  const handleStatsCardClick = (title, data) => {
    setStatsModalTitle(title);
    setStatsModalData(data);
    setIsStatsModalOpen(true);
  };

  return (
    <>
      <Helmet>
        <title>Gerenciar Inscrições - Metanoia Radical</title>
        <meta name="description" content="Gerencie todas as inscrições do projeto Metanoia Radical" />
      </Helmet>

      <Layout largo="tela">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="relative text-center mb-8">
            {/* Central de notificacoes: so para quem ve os avisos. */}
            {avisosInscricoes.temAcesso && (
              <div className="absolute right-0 top-0">
                <CentralNotificacoes
                  avisos={avisosInscricoes.avisos}
                  total={avisosInscricoes.total}
                  onMostrar={avisosInscricoes.mostrar}
                  onMostrarFicha={avisosInscricoes.mostrarFicha}
                />
              </div>
            )}
            <h1 className="text-3xl font-bold text-white mb-2">Gerenciar Inscrições</h1>
            {podeManual && (
              <Button
                onClick={() => setManualAberta(true)}
                data-dica="Cadastrar um equipante que não se inscreveu pelo link. Só o nome é obrigatório."
                className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <UserPlus className="w-4 h-4 mr-2" /> Inscrição manual de equipante
              </Button>
            )}
          </div>

          {/* Pedidos de acesso ao cadastro e possiveis duplicados (16/10/2026). */}
          <PedidosAcessoQuadro onMudou={() => { carregarEquipantes(); setVersaoFichas((v) => v + 1); }} />
          <DuplicadosQuadro atualizar={versaoFichas} onMudou={() => carregarEquipantes()} />

          {/* Primeiro: data de nascimento e obrigatoria (09/10/2026). */}
          <AvisoNascimento
            aviso={avisosInscricoes.avisos.find((a) => a.chave === 'nascimento')}
            onRecarregar={avisosInscricoes.recarregar}
            onOcultar={() => avisosInscricoes.ocultar('nascimento')}
            onOcultarFicha={(id) => avisosInscricoes.ocultarFicha('nascimento', id)}
            onCorrigido={fetchAcampantesSupabase}
            onAbrirFicha={(id) => {
              const acampante = acampantesList.find((a) => a.id === id);
              if (acampante) setInscricaoParaEditar(acampante);
            }}
          />

          <AvisoTelefonesAcampantes
            aviso={avisosInscricoes.avisos.find((a) => a.chave === 'telefones')}
            onRecarregar={avisosInscricoes.recarregar}
            onOcultar={() => avisosInscricoes.ocultar('telefones')}
            onOcultarFicha={(id) => avisosInscricoes.ocultarFicha('telefones', id)}
            onCorrigido={fetchAcampantesSupabase}
            onAbrirFicha={(id) => {
              const acampante = acampantesList.find((a) => a.id === id);
              if (acampante) setInscricaoParaEditar(acampante);
            }}
          />

          <AvisoContatoEmergencia
            aviso={avisosInscricoes.avisos.find((a) => a.chave === 'contatos')}
            onRecarregar={avisosInscricoes.recarregar}
            onOcultar={() => avisosInscricoes.ocultar('contatos')}
            onOcultarFicha={(id) => avisosInscricoes.ocultarFicha('contatos', id)}
            onCorrigido={fetchAcampantesSupabase}
            onAbrirFicha={(id) => {
              const acampante = acampantesList.find((a) => a.id === id);
              if (acampante) setInscricaoParaEditar(acampante);
            }}
          />

          <AvisoCadastro
            aviso={avisosInscricoes.avisos.find((a) => a.chave === 'cadastro')}
            onRecarregar={avisosInscricoes.recarregar}
            onCorrigido={fetchAcampantesSupabase}
            onOcultar={() => avisosInscricoes.ocultar('cadastro')}
            onOcultarFicha={(id) => avisosInscricoes.ocultarFicha('cadastro', id)}
            onAbrirFicha={(id) => {
              const acampante = acampantesList.find((a) => a.id === id);
              if (acampante) setInscricaoParaEditar(acampante);
            }}
          />

          <AvisoCamisas
            aviso={avisosInscricoes.avisos.find((a) => a.chave === 'camisas')}
            onRecarregar={avisosInscricoes.recarregar}
            onOcultar={() => avisosInscricoes.ocultar('camisas')}
            onOcultarFicha={(id) => avisosInscricoes.ocultarFicha('camisas', id)}
            onCorrigido={fetchAcampantesSupabase}
            onAbrirFicha={(id) => {
              const acampante = acampantesList.find((a) => a.id === id);
              if (acampante) setInscricaoParaEditar(acampante);
            }}
          />
          
          <InscricoesStatsCards
            equipantesInscritos={equipantes.length}
            equipantesConfirmados={idsConfirmados === null ? null : equipantesConfirmados.length}
            acampantes={totalAcampantes}
            onAbrir={abrirPeloQuadro}
          />

          <Tabs ref={abasRef} value={aba} onValueChange={setAba} className="space-y-6 scroll-mt-4">
            <TabsList className="grid w-full grid-cols-3 bg-white/10">
              <TabsTrigger value="acampantes" className="data-[state=active]:bg-green-600">
                Acampantes ({totalAcampantes})
              </TabsTrigger>
              <TabsTrigger value="equipantes" className="data-[state=active]:bg-red-600">
                Equipantes ({equipantes.length})
              </TabsTrigger>
              <TabsTrigger value="total" className="data-[state=active]:bg-blue-600">
                Total da edição ({totalAcampantes + equipantesConfirmados.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="acampantes">
              {errorAcampantes ? (
                <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6 text-center">
                  <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">Erro ao carregar dados</h3>
                  <p className="text-gray-300 mb-4">{errorAcampantes}</p>
                  <Button onClick={fetchAcampantesSupabase} variant="outline" className="border-red-500 text-red-500 hover:bg-red-500/10">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Tentar Novamente
                  </Button>
                </div>
              ) : (
                <>
                  <div className="mb-8">
                    <AcampantesStatsCards 
                      acampantes={acampantesList}
                      loading={loadingAcampantes}
                      onCardClick={handleStatsCardClick}
                    />
                  </div>

                  <div className="mb-8">
                    <GruposTrailhaCards 
                      groupsData={allocatedGroups} 
                      onGroupClick={handleGroupClick}
                      conflitosPorGrupo={vinc.conflitosPorGrupo}
                      resumoVinculos={vinc.carregado ? { sugestoes: vinc.sugestoes.length, conflitos: vinc.conflitos.length } : null}
                      onAbrirVinculos={() => setVinculosAberto(true)}
                      onAbrirOnibus={() => setOnibusAberto(true)}
                      infiltradosSemCor={infiltrados.oficial ? infiltrados.semCor : 0}
                    />
                  </div>

                  <AcampantesTable
                    data={acampantesDaTabela}
                    loading={loadingAcampantes}
                    onViewDetails={handleViewDetails}
                    onDelete={handleDeleteAcampante}
                    onEdit={handleEditarInscricao}
                  />
                </>
              )}
            </TabsContent>

            <TabsContent value="equipantes">
              <InscricoesTable 
                dados={filteredEquipantes} 
                tipo="equipantes" 
                onSelect={setSelectedInscricao} 
                onEdit={handleEditarInscricao}
                searchTerm={searchTermEquipantes}
                onSearchChange={setSearchTermEquipantes}
                situacao={situacaoEquipantes}
                onSituacaoChange={setSituacaoEquipantes}
                contagemSituacao={contagemSituacao}
                antesDeColunas={<BotaoPendencias total={fichasPendentes.length} onClick={() => setPendenciasAberto(true)} />}
              />
            </TabsContent>

            <TabsContent value="total">
              <TotalEdicaoTable
                acampantes={acampantesList}
                equipantesConfirmados={equipantesConfirmados}
                confirmadosDisponivel={idsConfirmados !== null}
                onVerAcampante={handleViewDetails}
                onVerEquipante={setSelectedInscricao}
              />
            </TabsContent>
          </Tabs>

          {selectedInscricao && (
            <InscricaoDetalhesModal
              inscricao={selectedInscricao}
              onClose={() => {
                setSelectedInscricao(null);
                if (voltarParaMetrica) { setVoltarParaMetrica(false); setIsStatsModalOpen(true); }
                if (voltarParaPendencias) { setVoltarParaPendencias(false); setPendenciasAberto(true); }
              }}
            />
          )}

          {inscricaoParaEditar && (
            <EditarInscricaoModal
              inscricao={inscricaoParaEditar}
              onClose={() => {
                setInscricaoParaEditar(null);
                if (voltarParaPendencias) { setVoltarParaPendencias(false); setPendenciasAberto(true); }
              }}
              onSave={handleSalvarEdicaoInscricao}
              avisoDoGrupo={avisoDoGrupo}
              vinc={vinc}
              onRealocar={handleRealocarGrupoTrailha}
            />
          )}

          <PendenciasEquipantes
            aberto={pendenciasAberto}
            onFechar={() => setPendenciasAberto(false)}
            lista={fichasPendentes}
            onEditar={(ficha) => { setPendenciasAberto(false); setVoltarParaPendencias(true); setInscricaoParaEditar(ficha); }}
            onVer={(ficha) => { setPendenciasAberto(false); setVoltarParaPendencias(true); setSelectedInscricao(ficha); }}
          />

          {manualAberta && (
            <InscricaoManualDialog
              onClose={() => setManualAberta(false)}
              onCriado={() => { carregarEquipantes(); buscarTotais(); }}
            />
          )}

          {selectedGroup && (
            <GruposTrailhaModal 
              isOpen={isGroupModalOpen}
              onClose={() => setIsGroupModalOpen(false)}
              groupName={selectedGroup.name}
              groupData={grupoAberto}
              onRealocar={handleRealocarGrupoTrailha}
              onSalvarObservacao={handleSalvarObservacaoAcampante}
              vinc={vinc}
            />
          )}

          <OnibusDialog
            isOpen={onibusAberto}
            onClose={() => setOnibusAberto(false)}
            acampantes={participantes}
          />

          <VinculosAcampantesDialog
            isOpen={vinculosAberto}
            onClose={() => setVinculosAberto(false)}
            vinc={vinc}
            onRealocar={handleRealocarGrupoTrailha}
          />

          <AcampantesDetailModal
            isOpen={isStatsModalOpen}
            onClose={() => setIsStatsModalOpen(false)}
            title={statsModalTitle}
            acampantes={statsModalData}
            onVerFicha={(acampante) => {
              // As duas janelas nao ficam abertas juntas: fecha a lista,
              // abre a ficha, e a lista volta quando a ficha fechar.
              setIsStatsModalOpen(false);
              setVoltarParaMetrica(true);
              handleViewDetails(acampante);
            }}
          />

          {/* Remover acampante (20/10/2026): desistencia (guarda os dados) ou
              exclusao completa. Antes apagava direto, sem guardar nada. */}
          <RemoverAcampanteDialog
            acampante={acampanteToDeactivate}
            onClose={() => setAcampanteToDeactivate(null)}
            onRemovido={fetchAcampantesSupabase}
          />

        </motion.div>
      </Layout>
    </>
  );
};

export default GerenciarInscricoesPage;