import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Search, CheckCircle, AlertCircle, AlertTriangle, RefreshCw, Banknote, Gift, Download, MessageCircle, Copy, X, PhoneCall, CalendarClock, StickyNote, Pencil, Check, Undo2, FileText } from 'lucide-react';
import Layout from '@/components/Layout';
import NomeComBandeira from '@/components/common/NomeComBandeira';
import { exportRelacaoPagamentos } from '@/utils/excelExport';
import {
  fetchRelacaoDePagamentos,
  fetchPixTravados,
  registrarPagamento,
  desfazerPagamento,
  isentarInscricao,
  fetchCobrancas,
  fetchGruposEnviados,
  marcarGrupoEnviado,
  desmarcarGrupoEnviado,
  fetchEquipantesComPagamentoAberto,
  definirCobranca,
  removerCobranca
} from '@/services/paymentService';
import CobrancaDialog from '@/components/pagamentos/CobrancaDialog';
import ConfirmarPagamentoDialog from '@/components/pagamentos/ConfirmarPagamentoDialog';
import ResumoPagamentos from '@/components/pagamentos/ResumoPagamentos';
import FichaInscricaoDialog from '@/components/common/FichaInscricaoDialog';
import { fetchCoupons } from '@/services/couponsService';
import { fetchPricingConfig } from '@/services/organizerConfigService';
import { precoDoLoteHoje } from '@/utils/precoDoLote';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Paginacao, { usePaginacao } from '@/components/common/Paginacao';
import { formatarTelefone } from '@/utils/telefone';
import { linkWhatsApp } from '@/services/liderService';
import CabecalhoFiltroOrdem from '@/components/common/CabecalhoFiltroOrdem';
import { ordenarLista } from '@/utils/ordenacao';
import { normalizarBusca } from '@/utils/busca';

const formatarValor = (valor) => {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numero);
};

// Quem ainda deve: o que a pessoa fez na hora de pagar.
const FORMA_DE_QUEM_DEVE = { pix: 'PIX não concluído', manual: 'Manual', isento: 'Isento' };
// Quem ja pagou: por onde o dinheiro entrou.
const FORMA_DE_QUEM_PAGOU = { pix: 'PIX', manual: 'Em mãos', isento: 'Isento' };

// "2026-10-10" -> "10/10/2026"
const dataBR = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '');

// Dias de hoje ate a data combinada (negativo = ja passou).
const diasAte = (iso) => {
  const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((new Date(a, m - 1, d) - hoje) / 86400000);
};

// Data combinada com a cor do prazo: vermelho venceu, amarelo hoje.
const DataCombinada = ({ iso }) => {
  if (!iso) return <span className="text-gray-500">—</span>;
  const dias = diasAte(iso);
  const [texto, classe] = dias < 0
    ? [`venceu há ${-dias} ${dias === -1 ? 'dia' : 'dias'}`, 'bg-red-500/15 text-red-300 border-red-500/30']
    : dias === 0
      ? ['hoje', 'bg-amber-500/15 text-amber-300 border-amber-500/30']
      : [`em ${dias} ${dias === 1 ? 'dia' : 'dias'}`, 'bg-white/5 text-gray-300 border-white/10'];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap ${classe}`}>
      {dataBR(iso)} · {texto}
    </span>
  );
};

// Quando o pagamento entrou (PIX: a hora em que o banco avisou, segundos
// depois de pago; em maos/isento: a hora em que o organizador confirmou),
// no horario de Brasilia (Patrick, 08/10/2026).
const dataHoraBR = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  const fuso = { timeZone: 'America/Sao_Paulo' };
  return `${d.toLocaleDateString('pt-BR', fuso)} às ${d.toLocaleTimeString('pt-BR', { ...fuso, hour: '2-digit', minute: '2-digit' })}`;
};

// Texto de cada coluna, o mesmo da tela: e por ele que o funil filtra e a
// seta ordena (pedido do Patrick, 06/10/2026).
const valorDaColuna = (item, chave) => {
  switch (chave) {
    case 'tipo': return item.tipo === 'acampante' ? 'Acampante' : 'Equipante';
    case 'whatsapp':
      if (!item.whatsapp) return '';
      return item.nacionalidade ? String(item.whatsapp) : formatarTelefone(item.whatsapp);
    case 'forma': {
      if (!item.quitado) return FORMA_DE_QUEM_DEVE[item.metodo_pagamento] || 'Não escolheu';
      return FORMA_DE_QUEM_PAGOU[String(item.metodo_pagamento || '').toLowerCase()] || 'Não informado';
    }
    // Aba Pagos: forma e quem confirmou numa coluna so ("Em mãos · Raquel"),
    // para a tabela caber na tela sem cortar (Patrick, 08/10/2026).
    case 'pagamento': {
      const forma = valorDaColuna(item, 'forma');
      const quem = item.confirmado_por && item.confirmado_por !== 'PIX automático' ? item.confirmado_por : null;
      return quem ? `${forma} · ${quem}` : forma;
    }
    case 'valor': return item.valor_pago === null || item.valor_pago === undefined ? 'Sem valor registrado' : formatarValor(item.valor_pago);
    case 'cupom': return item.cupom_usado || 'Sem cupom';
    case 'confirmado_por': return item.confirmado_por || '—';
    case 'pago_em': return item.data_pagamento ? new Date(item.data_pagamento).toLocaleDateString('pt-BR') : '';
    case 'motivo': return item.motivo || '';
    case 'desde': return item.cobranca?.marcado_em ? new Date(item.cobranca.marcado_em).toLocaleDateString('pt-BR') : '';
    case 'agendado_para': return dataBR(item.cobranca?.agendado_para);
    case 'grupo': return item.grupo?.em ? `${new Date(item.grupo.em).toLocaleDateString('pt-BR')} · ${item.grupo.por}` : '';
    default: return String(item[chave] || '');
  }
};

// WhatsApp da pessoa (pedido da Raquel, 06/10/2026): para mandar o link do
// grupo sem ter que voltar em outra tela. O numero abre a conversa no
// WhatsApp; o botao ao lado copia.
const CelulaWhatsApp = ({ item, onCopiar, onAbrir }) => {
  if (!item.whatsapp) return <span className="text-gray-600">—</span>;
  const estrangeiro = !!item.nacionalidade;
  const texto = estrangeiro ? item.whatsapp : formatarTelefone(item.whatsapp);
  const link = linkWhatsApp(item.whatsapp, estrangeiro);
  return (
    <div className="flex items-center gap-1 whitespace-nowrap">
      {link ? (
        <a
          href={link} target="_blank" rel="noopener noreferrer"
          onClick={onAbrir}
          data-dica={onAbrir ? 'Abrir a conversa no WhatsApp (fica registrado que o convite do grupo foi enviado).' : 'Abrir a conversa no WhatsApp'}
          className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 hover:underline"
        >
          <MessageCircle className="w-4 h-4" />
          {texto}
        </a>
      ) : (
        <span className="text-gray-300">{texto}</span>
      )}
      <Button
        type="button" variant="ghost" size="sm"
        onClick={() => onCopiar(texto)}
        data-dica="Copiar o número" aria-label="Copiar o número"
        className="h-7 w-7 p-0 text-gray-500 hover:text-white hover:bg-white/10"
      >
        <Copy className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
};

// "Grupo do WhatsApp" (Raquel, 06/10/2026): quem ja recebeu o convite, o dia e
// quem mandou -- para nao ter que rolar a lista procurando ate onde foi.
const CelulaGrupo = ({ item, onMarcar, onDesmarcar, ocupado }) => {
  if (item.grupo?.em) {
    const quando = new Date(item.grupo.em).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    });
    return (
      <div className="flex items-center gap-1.5 whitespace-nowrap">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs text-emerald-300">
          <Check className="w-3.5 h-3.5" /> Enviado {quando} · {item.grupo.por}
        </span>
        <Button
          type="button" variant="ghost" size="sm" disabled={ocupado}
          onClick={() => onDesmarcar(item)}
          data-dica="Tirar a marca de enviado (marcou sem querer, ou vai mandar de novo)."
          aria-label="Desfazer envio"
          className="h-7 w-7 p-0 text-gray-500 hover:text-white hover:bg-white/10"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
      <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs text-amber-300">
        Falta enviar
      </span>
      <Button
        type="button" variant="ghost" size="sm" disabled={ocupado}
        onClick={() => onMarcar(item)}
        data-dica="Marcar como enviado sem abrir o WhatsApp (por exemplo, se você mandou por outro lugar)."
        className="h-7 px-2 text-xs text-gray-400 hover:text-white hover:bg-white/10"
      >
        Marcar enviado
      </Button>
    </div>
  );
};

const PagamentosPendentesPage = () => {
  // Todo mundo, pago ou nao -- e daqui que saem a aba "Pagos" e a
  // planilha do portao. A tela so mostrava pendentes, entao quem pagava
  // sumia e nao existia lista nenhuma de quem ja tinha pago.
  const [relacao, setRelacao] = useState([]);
  const [travados, setTravados] = useState([]);
  // Cobranca dos acampantes que nao pagaram: { acampante_id: {...} }.
  const [cobrancas, setCobrancas] = useState({});
  // Convite do grupo de WhatsApp ja enviado: { id da ficha: { em, por } }.
  const [gruposEnviados, setGruposEnviados] = useState({});
  const [filtroGrupo, setFiltroGrupo] = useState('todos'); // 'todos' | 'faltam'
  const [confirmandoLote, setConfirmandoLote] = useState(false);
  const [gravandoGrupo, setGravandoGrupo] = useState(false);
  // Equipantes que ja podem pagar (estao na escala lancada).
  const [equipantesLiberados, setEquipantesLiberados] = useState(new Set());
  // Janela de cobranca aberta: { item, status } ou null.
  const [dialogo, setDialogo] = useState(null);
  // Janela de "Confirmar pagamento": { item, forma, valorLote, valorCobrado } ou null.
  const [confirmacao, setConfirmacao] = useState(null);
  // Cupons (para escolher na confirmacao) e lotes de preco (valor sugerido).
  const [cupons, setCupons] = useState([]);
  const [lotes, setLotes] = useState({ acampante: [], equipante: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterText, setFilterText] = useState('');
  const [aba, setAba] = useState('nao');
  const [tipoFiltro, setTipoFiltro] = useState('all');
  // Funil e seta de cada coluna. Cada aba tem colunas e valores diferentes,
  // entao trocar de aba comeca sem filtro e sem ordem.
  const [filtrosColuna, setFiltrosColuna] = useState({});
  const [ordem, setOrdem] = useState(null);
  useEffect(() => {
    setFiltrosColuna({});
    setOrdem(null);
  }, [aba]);
  const [processingId, setProcessingId] = useState(null);
  const [acaoPendente, setAcaoPendente] = useState(null); // { id, tipo, acao }
  const { toast } = useToast();

  const carregar = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pixTravados, todos, cobr, liberados, grupos] = await Promise.all([
        fetchPixTravados(),
        fetchRelacaoDePagamentos(),
        fetchCobrancas(),
        fetchEquipantesComPagamentoAberto(),
        fetchGruposEnviados()
      ]);
      setGruposEnviados(grupos);
      setEquipantesLiberados(liberados);
      setTravados(pixTravados);
      setRelacao(todos);
      setCobrancas(cobr);
    } catch (err) {
      console.error('[Pagamentos] Erro ao carregar:', err);
      setError('Falha ao carregar os pagamentos. Verifique sua conexão.');
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os pagamentos.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
    fetchCoupons().then(({ data }) => setCupons(data || [])).catch(() => {});
    fetchPricingConfig().then(({ data }) => {
      if (data) setLotes({ acampante: data.acampante_pricing_periods || [], equipante: data.equipante_pricing_periods || [] });
    }).catch(() => {});
  }, []);

  const executarAcao = async (id, tipo, acao) => {
    setProcessingId(id);
    try {
      const { error: err } = await isentarInscricao(tipo, id);

      if (err) throw err;

      toast({
        title: 'Isenção registrada',
        description: 'A inscrição foi marcada como isenta da taxa.',
        className: 'bg-emerald-600 text-white border-none'
      });

      setAcaoPendente(null);
      // Recarrega para que a pessoa saia das duas listas de uma vez.
      await carregar();
    } catch (err) {
      console.error('[Pagamentos] Erro ao liberar:', err);
      toast({
        title: 'Erro',
        description: err?.message || 'Não foi possível concluir a operação.',
        variant: 'destructive'
      });
    } finally {
      setProcessingId(null);
    }
  };

  // Confirmar pagamento (janela): em maos ou PIX travado. O erro volta para a
  // janela, que mostra a mensagem do servidor.
  const abrirConfirmacao = (item) => {
    const travado = aba === 'travados';
    setConfirmacao({
      item: travado ? { ...item, id: item.inscricao_id } : item,
      forma: travado ? 'pix' : 'manual',
      valorLote: precoDoLoteHoje(lotes[item.tipo]),
      valorCobrado: travado ? Number(item.valor) : null,
    });
  };

  const confirmarPagamento = async (pedido, valor, cupom) => {
    const { data, error: err } = await registrarPagamento(pedido.item.tipo, pedido.item.id, pedido.forma, valor, cupom);
    if (err) throw err;
    setConfirmacao(null);
    toast({
      title: 'Pagamento confirmado',
      description: `${pedido.item.nome}: ${formatarValor(valor)}${cupom ? ` com o cupom ${cupom}` : ''}. Foi para a aba Pagos.`,
      className: 'bg-emerald-600 text-white border-none'
    });
    await carregar();
    return data;
  };

  // Desfazer pagamento confirmado por engano (Patrick, 08/10/2026): so em
  // maos e isencao; a pessoa volta para "Nao pagaram". Confirmacao na propria
  // linha, como o isentar.
  const [desfazendo, setDesfazendo] = useState(null); // id em confirmacao
  // Ficha de inscricao aberta pelo icone ao lado do nome: { tipo, id } ou null.
  const [fichaAberta, setFichaAberta] = useState(null);
  const [desfazendoAgora, setDesfazendoAgora] = useState(false);
  const podeDesfazer = (item) => ['manual', 'isento'].includes(String(item.metodo_pagamento || '').toLowerCase());

  const desfazer = async (item) => {
    setDesfazendoAgora(true);
    const { error: err } = await desfazerPagamento(item.tipo, item.id);
    setDesfazendoAgora(false);
    setDesfazendo(null);
    if (err) {
      toast({ title: 'Não deu para desfazer', description: err.message, variant: 'destructive' });
      return;
    }
    toast({
      title: 'Pagamento desfeito',
      description: `${item.nome} voltou para a aba Não pagaram.`,
    });
    await carregar();
  };

  // Todo mundo com a cobranca junto (so acampante tem cobranca).
  const comCobranca = useMemo(() => relacao.map((i) => ({
    ...i,
    ...(i.tipo === 'acampante' && cobrancas[i.id] ? { cobranca: cobrancas[i.id] } : {}),
    ...(gruposEnviados[i.id] ? { grupo: gruposEnviados[i.id] } : {}),
  })), [relacao, cobrancas, gruposEnviados]);

  const pagos = useMemo(() => comCobranca.filter((i) => i.quitado), [comCobranca]);
  // Pagou e ainda nao recebeu o convite do grupo.
  const semGrupo = useMemo(() => pagos.filter((i) => !i.grupo).length, [pagos]);

  const recarregarGrupos = async () => setGruposEnviados(await fetchGruposEnviados());

  // Clicou no WhatsApp de quem pagou: registra o envio (a conversa abre
  // normalmente; o registro corre ao lado e nao atrapalha).
  const registrarEnvio = async (item) => {
    if (item.grupo) return;
    try {
      await marcarGrupoEnviado(item.tipo, [item.id]);
      await recarregarGrupos();
    } catch (err) {
      toast({ title: 'Não deu para registrar o envio', description: err.message, variant: 'destructive' });
    }
  };

  const desmarcarEnvio = async (item) => {
    setGravandoGrupo(true);
    try {
      await desmarcarGrupoEnviado(item.tipo, item.id);
      await recarregarGrupos();
    } catch (err) {
      toast({ title: 'Não deu para desfazer', description: err.message, variant: 'destructive' });
    } finally {
      setGravandoGrupo(false);
    }
  };

  // Quem ainda deve (opcao B, aprovada em 06/10/2026: a antiga aba
  // "Pagamentos manuais" entrou aqui -- o funil da coluna Forma separa os
  // manuais). Acampante: todos. Equipante: so quem ja pode pagar (esta na
  // escala lancada) e escolheu pagar em maos -- antes da escala o pagamento
  // nem abriu para ele. A cobranca de equipante fica para depois.
  const devendo = useMemo(() => comCobranca.filter((i) => !i.quitado
    && (i.tipo === 'acampante'
      || (equipantesLiberados.has(i.id) && ['manual', 'isento'].includes(i.metodo_pagamento)))),
  [comCobranca, equipantesLiberados]);
  const naoPagaram = useMemo(() => devendo.filter((i) => !i.cobranca), [devendo]);
  const emCobranca = useMemo(() => devendo.filter((i) => i.cobranca?.status === 'em_cobranca'), [devendo]);
  const agendados = useMemo(() => devendo.filter((i) => i.cobranca?.status === 'agendado'), [devendo]);
  const vencidos = useMemo(() => agendados.filter((i) => diasAte(i.cobranca.agendado_para) < 0).length, [agendados]);

  const salvarCobranca = async (item, status, data, obs) => {
    await definirCobranca(item.id, status, data, obs);
    setCobrancas(await fetchCobrancas());
    setDialogo(null);
    toast({
      title: status === 'agendado' ? 'Pagamento agendado' : 'Cobrança em andamento',
      description: item.nome,
      className: 'bg-emerald-600 text-white border-none'
    });
  };

  const tirarDaCobranca = async (item) => {
    await removerCobranca(item.id);
    setCobrancas(await fetchCobrancas());
    setDialogo(null);
    toast({ title: 'Voltou para Não pagaram', description: item.nome, className: 'bg-emerald-600 text-white border-none' });
  };

  const copiarNumero = async (numero) => {
    try {
      await navigator.clipboard.writeText(numero);
      toast({ title: 'Número copiado', description: numero, className: 'bg-emerald-600 text-white border-none' });
    } catch (_) {
      toast({ title: 'Não deu para copiar', description: numero, variant: 'destructive' });
    }
  };

  const exportarRelacao = () => {
    try {
      const r = exportRelacaoPagamentos(comCobranca);
      toast({
        title: 'Planilha gerada',
        description: `${r.pagaram} de ${r.total} já pagaram. A aba "Ainda não pagaram" traz o resto.`,
        className: 'bg-emerald-600 text-white'
      });
    } catch (err) {
      toast({
        title: 'Não deu para exportar',
        description: err.message,
        variant: 'destructive'
      });
    }
  };

  const baseDaAba = {
    nao: naoPagaram,
    cobranca: emCobranca,
    agendado: agendados,
    pagos,
    travados,
  }[aba] || naoPagaram;

  const filtrarColuna = (chave, valores) => setFiltrosColuna((f) => ({ ...f, [chave]: valores }));
  const temFiltroColuna = Object.values(filtrosColuna).some((v) => v && v.length > 0);
  const cabecalho = (titulo, chave) => (
    <CabecalhoFiltroOrdem
      titulo={titulo} chave={chave} dados={baseDaAba} valorDe={valorDaColuna}
      filtros={filtrosColuna} onFiltrar={filtrarColuna} ordem={ordem} onOrdenar={setOrdem}
    />
  );

  const linhas = useMemo(() => {
    // Sem diferenca de maiuscula nem de acento ("joao" acha "João").
    const busca = normalizarBusca(filterText);
    const digitos = busca.replace(/\D/g, '');

    const filtradas = baseDaAba.filter((item) => {
      const cpf = String(item.cpf || '');
      const whats = String(item.whatsapp || '').replace(/\D/g, '');
      const casaBusca = !busca || normalizarBusca(item.nome).includes(busca) || cpf.includes(busca)
        || (digitos.length >= 3 && cpf.replace(/\D/g, '').includes(digitos))
        || (digitos.length >= 4 && whats.includes(digitos));
      const casaTipo = tipoFiltro === 'all' || item.tipo === tipoFiltro;
      const casaGrupo = aba !== 'pagos' || filtroGrupo === 'todos' || !item.grupo;
      const casaColunas = Object.entries(filtrosColuna).every(([chave, valores]) =>
        !valores || valores.length === 0 || valores.includes(valorDaColuna(item, chave)));
      return casaBusca && casaTipo && casaGrupo && casaColunas;
    });
    // Agendados: sem seta escolhida, a data mais proxima vem primeiro.
    const ordemFinal = ordem || (aba === 'agendado' ? { chave: 'agendado_para', direcao: 'asc' } : null);
    return ordenarLista(filtradas, ordemFinal, valorDaColuna);
  }, [baseDaAba, filterText, tipoFiltro, filtrosColuna, ordem, aba, filtroGrupo]);

  // Pagina a lista já filtrada. No dia do evento essa tela pode ter centenas
  // de pendentes — desenhar tudo de uma vez trava celular mais simples.
  const paginacao = usePaginacao(linhas);

  const colunas = aba === 'pagos' ? 7 : 6;
  const faltamNaLista = aba === 'pagos' ? linhas.filter((i) => !i.grupo) : [];

  const marcarLote = async () => {
    setGravandoGrupo(true);
    try {
      for (const tipo of ['acampante', 'equipante']) {
        const ids = faltamNaLista.filter((i) => i.tipo === tipo).map((i) => i.id);
        if (ids.length) await marcarGrupoEnviado(tipo, ids);
      }
      await recarregarGrupos();
      toast({
        title: 'Marcados como enviados',
        description: `${faltamNaLista.length} ${faltamNaLista.length === 1 ? 'pessoa' : 'pessoas'}.`,
        className: 'bg-emerald-600 text-white border-none'
      });
    } catch (err) {
      toast({ title: 'Não deu para marcar', description: err.message, variant: 'destructive' });
    } finally {
      setGravandoGrupo(false);
      setConfirmandoLote(false);
    }
  };

  const Acoes = ({ item }) => {
    const emConfirmacao = acaoPendente?.id === item.id;
    const ocupado = processingId === item.id;
    const idInscricao = aba === 'travados' ? item.inscricao_id : item.id;

    if (!idInscricao) {
      return <span className="text-sm text-gray-500">Inscrição não localizada</span>;
    }

    if (emConfirmacao) {
      return (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400 mr-1 font-medium">
            {acaoPendente.acao === 'isentar' ? 'Isentar da taxa?' : 'Confirmar pagamento?'}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAcaoPendente(null)}
            disabled={ocupado}
            className="h-8 px-3 border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/10"
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={() => executarAcao(idInscricao, item.tipo, acaoPendente.acao)}
            disabled={ocupado}
            className="h-8 px-4 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {ocupado ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'OK'}
          </Button>
        </div>
      );
    }

    // A aba Pagos nao tem coluna de acoes: a data do pagamento fica na coluna
    // Pagamento.

    const botaoCobranca = 'h-8 px-2.5 border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/10';
    const cobravel = item.tipo === 'acampante' && aba !== 'travados';

    return (
      <div className="flex flex-wrap 2xl:flex-nowrap items-center gap-x-2 gap-y-1.5">
        {cobravel && (
          <div className="flex items-center gap-2 whitespace-nowrap">
            {aba === 'nao' && (
              <Button
                size="sm" variant="outline" className={botaoCobranca}
                onClick={() => setDialogo({ item, status: 'em_cobranca' })}
                data-dica="Marcar que você já entrou em contato e está cobrando."
              >
                <PhoneCall className="w-4 h-4 mr-1.5" />
                Em cobrança
              </Button>
            )}
            {aba === 'cobranca' && (
              <Button
                size="sm" variant="outline" className={botaoCobranca}
                onClick={() => setDialogo({ item, status: 'em_cobranca' })}
                data-dica="Editar a observação ou voltar para Não pagaram."
              >
                <Pencil className="w-4 h-4 mr-1.5" />
                Editar
              </Button>
            )}
            <Button
              size="sm" variant="outline" className={botaoCobranca}
              onClick={() => setDialogo({ item, status: 'agendado' })}
              data-dica={aba === 'agendado' ? 'Mudar a data combinada ou a observação.' : 'A pessoa combinou uma data para pagar.'}
            >
              <CalendarClock className="w-4 h-4 mr-1.5" />
              {aba === 'agendado' ? 'Remarcar' : 'Agendar'}
            </Button>
          </div>
        )}
        <div className="flex items-center gap-2 whitespace-nowrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAcaoPendente({ id: item.id, tipo: item.tipo, acao: 'isentar' })}
            data-dica="Dispensar esta pessoa da taxa (fica como quitado sem pagar). Pede confirmação."
            className="h-8 px-3 border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/10"
          >
            <Gift className="w-4 h-4 mr-1.5" />
            Isentar
          </Button>
          <Button
            size="sm"
            onClick={() => abrirConfirmacao(item)}
            data-dica={aba === 'travados'
              ? 'O PIX foi pago mas não confirmou sozinho: marca como pago (com o valor da cobrança).'
              : 'Confirmar que o pagamento foi recebido (dinheiro, depósito...): informe o valor e o cupom, se houve.'}
            className="h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all"
          >
            <CheckCircle className="w-4 h-4 mr-1.5" />
            Confirmar pagamento
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Layout largo>
      <Helmet>
        <title>Pagamentos - Metanoia Radical</title>
      </Helmet>

      <div className="py-8">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Banknote className="w-8 h-8 text-blue-500" />
            <h1 className="text-3xl font-bold text-white">Pagamentos</h1>
          </div>
          <p className="text-gray-400">
            Confirme pagamentos, acompanhe a cobrança de quem não pagou e registre isenções.
          </p>
        </motion.div>

        {travados.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-amber-500/10 border border-amber-500/40 rounded-lg p-4 flex items-start gap-3"
          >
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="text-amber-300 font-semibold">
                {travados.length} {travados.length === 1 ? 'cobrança precisa' : 'cobranças precisam'} de atenção
              </p>
              <p className="text-gray-300 mt-0.5">
                São PIX em que o dinheiro entrou (ou pode ter entrado) e a inscrição não liberou sozinha.
                Confira na aba <strong>Precisam de atenção</strong>.
              </p>
            </div>
          </motion.div>
        )}

        {error ? (
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Erro ao carregar dados</h3>
            <p className="text-gray-300 mb-4">{error}</p>
            <Button onClick={carregar} variant="outline" className="border-red-500 text-red-500 hover:bg-red-500/10 bg-transparent h-11">
              <RefreshCw className="w-4 h-4 mr-2" />
              Tentar Novamente
            </Button>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-black/60 glass-effect rounded-xl border border-white/10 overflow-hidden flex flex-col"
          >
            <div className="p-4 md:p-6 border-b border-white/10 flex flex-col gap-4">
              <Tabs value={aba} onValueChange={setAba}>
                <TabsList className="bg-white/5 border border-white/10 w-full md:w-auto h-auto flex flex-wrap">
                  <TabsTrigger
                    value="nao"
                    data-dica="Quem ainda não pagou e ninguém está cobrando ainda. Inclui quem escolheu pagar em mãos."
                    className="flex-1 md:flex-none data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-400"
                  >
                    Não pagaram ({naoPagaram.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="cobranca"
                    data-dica="Quem já foi procurado e está sendo cobrado."
                    className="flex-1 md:flex-none data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-300 text-gray-400"
                  >
                    Cobrança em andamento ({emCobranca.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="agendado"
                    data-dica="Quem combinou uma data para pagar. Data vencida fica em vermelho."
                    className="flex-1 md:flex-none data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-300 text-gray-400"
                  >
                    Pagamento agendado ({agendados.length})
                    {vencidos > 0 && (
                      <span className="ml-1.5 rounded-full bg-red-500/20 text-red-300 px-1.5 text-[11px]">
                        {vencidos} {vencidos === 1 ? 'venceu' : 'venceram'}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="pagos"
                    data-dica="Quem já está com o pagamento quitado."
                    className="flex-1 md:flex-none data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-300 text-gray-400"
                  >
                    Pagos ({pagos.length})
                    {semGrupo > 0 && (
                      <span className="ml-1.5 rounded-full bg-amber-500/20 text-amber-300 px-1.5 text-[11px]">
                        {semGrupo} sem grupo
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="travados"
                    data-dica="PIX que pode ter sido pago mas não confirmou sozinho. Confira e confirme o pagamento."
                    className="flex-1 md:flex-none data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300 text-gray-400"
                  >
                    Precisam de atenção ({travados.length})
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex flex-col md:flex-row md:flex-wrap gap-4 justify-between items-start md:items-center">
                <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-3 w-full md:w-auto">
                <Tabs value={tipoFiltro} onValueChange={setTipoFiltro} className="w-full md:w-auto">
                  <TabsList className="bg-white/5 border border-white/10 w-full md:w-auto flex">
                    <TabsTrigger value="all" className="flex-1 md:flex-none data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-400">Todos</TabsTrigger>
                    <TabsTrigger value="acampante" className="flex-1 md:flex-none data-[state=active]:bg-green-600/20 data-[state=active]:text-green-400 text-gray-400">Acampantes</TabsTrigger>
                    <TabsTrigger value="equipante" className="flex-1 md:flex-none data-[state=active]:bg-red-600/20 data-[state=active]:text-red-400 text-gray-400">Equipantes</TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* Convite do grupo de WhatsApp (so na aba Pagos). */}
                {aba === 'pagos' && (
                  <>
                    <Tabs value={filtroGrupo} onValueChange={setFiltroGrupo} className="w-full md:w-auto">
                      <TabsList className="bg-white/5 border border-white/10 w-full md:w-auto flex">
                        <TabsTrigger value="todos" className="flex-1 md:flex-none data-[state=active]:bg-white/10 data-[state=active]:text-white text-gray-400">Todos os pagos</TabsTrigger>
                        <TabsTrigger value="faltam" className="flex-1 md:flex-none data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300 text-gray-400">
                          Falta enviar o grupo ({semGrupo})
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                    {faltamNaLista.length > 0 && (
                      confirmandoLote ? (
                        <span className="inline-flex items-center gap-2 text-sm text-gray-300">
                          Marcar {faltamNaLista.length} como enviados?
                          <Button size="sm" disabled={gravandoGrupo} onClick={marcarLote} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white">Sim</Button>
                          <Button size="sm" variant="ghost" disabled={gravandoGrupo} onClick={() => setConfirmandoLote(false)} className="h-8 text-gray-300 hover:bg-white/10">Não</Button>
                        </span>
                      ) : (
                        <Button
                          size="sm" variant="outline" onClick={() => setConfirmandoLote(true)}
                          data-dica="Marca de uma vez todos os que estão na lista como 'convite do grupo enviado' (por exemplo, quem você já avisou antes deste registro existir)."
                          className="h-9 whitespace-nowrap shrink-0 border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/10"
                        >
                          <Check className="w-4 h-4 mr-1.5" /> Marcar {faltamNaLista.length} como enviados
                        </Button>
                      )
                    )}
                  </>
                )}
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                  {temFiltroColuna && (
                    <Button
                      variant="ghost"
                      onClick={() => setFiltrosColuna({})}
                      data-dica="Tira os filtros das colunas e volta a mostrar a lista inteira."
                      className="h-11 text-red-400 hover:text-red-300 hover:bg-black/10 border border-red-500/20 shrink-0"
                    >
                      <X className="w-4 h-4 md:mr-2" />
                      <span className="hidden md:inline">Limpar filtros</span>
                    </Button>
                  )}
                  <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Buscar por nome, CPF ou WhatsApp..."
                      value={filterText}
                      onChange={(e) => setFilterText(e.target.value)}
                      className="pl-9 h-11 bg-white/5 border-white/10 text-white w-full placeholder:text-gray-500 focus-visible:ring-blue-500"
                    />
                  </div>
                  {/* A planilha que vai para o portao: todo mundo, com
                      PAGOU / NÃO PAGOU numa coluna so. */}
                  <Button
                    variant="outline"
                    onClick={exportarRelacao}
                    data-dica="Baixa a planilha com todo mundo e se já pagou (para conferir no portão)."
                    disabled={loading || relacao.length === 0}
                    className="h-11 border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/5 shrink-0"
                  >
                    <Download className="w-4 h-4 md:mr-2" />
                    <span className="hidden md:inline">Exportar</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={carregar}
                    disabled={loading}
                    className="h-11 border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/5 shrink-0"
                    aria-label="Atualizar lista"
                    data-dica="Buscar a lista de novo, com os últimos pagamentos."
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
            </div>

            {aba === 'pagos' && (
              <ResumoPagamentos
                pagos={tipoFiltro === 'all' ? pagos : pagos.filter((i) => i.tipo === tipoFiltro)}
                cupomFiltrado={(filtrosColuna.cupom || []).length === 1 ? filtrosColuna.cupom[0] : null}
                onFiltrarCupom={(codigo) => filtrarColuna('cupom', codigo ? [codigo] : [])}
              />
            )}

            <div className="p-0 overflow-x-auto">
              <Table>
                <TableHeader className="bg-white/5">
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="min-w-[13rem]">{cabecalho('Nome', 'nome')}</TableHead>
                    <TableHead>{cabecalho('CPF', 'cpf')}</TableHead>
                    <TableHead>{cabecalho('Tipo', 'tipo')}</TableHead>
                    <TableHead>{cabecalho('WhatsApp', 'whatsapp')}</TableHead>
                    <TableHead>
                      {aba === 'pagos'
                        ? cabecalho('Pagamento', 'pagamento')
                        : aba === 'travados'
                        ? cabecalho('Motivo', 'motivo')
                        : aba === 'cobranca'
                          ? cabecalho('Em cobrança desde', 'desde')
                          : aba === 'agendado'
                            ? cabecalho('Data combinada', 'agendado_para')
                            : cabecalho('Forma de pagamento', 'forma')}
                    </TableHead>
                    {aba === 'pagos' && (
                      <>
                        <TableHead>{cabecalho('Valor pago', 'valor')}</TableHead>
                        <TableHead>{cabecalho('Grupo do WhatsApp', 'grupo')}</TableHead>
                      </>
                    )}
                    {aba !== 'pagos' && <TableHead className="w-px text-gray-300">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableCell colSpan={colunas} className="h-32 text-center text-gray-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                        Buscando pagamentos...
                      </TableCell>
                    </TableRow>
                  ) : linhas.length === 0 ? (
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableCell colSpan={colunas} className="h-32 text-center text-gray-400">
                        {aba === 'travados'
                          ? 'Nenhuma cobrança travada. Tudo certo por aqui.'
                          : aba === 'pagos'
                            ? 'Ninguém pagou ainda para os filtros atuais.'
                            : aba === 'cobranca'
                              ? 'Ninguém em cobrança. Use "Em cobrança" na aba Não pagaram.'
                              : aba === 'agendado'
                                ? 'Nenhum pagamento agendado. Use "Agendar" na aba Não pagaram.'
                                : 'Ninguém devendo para os filtros atuais.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginacao.itensDaPagina.map((item) => (
                      <TableRow key={item.id} className="border-white/10 hover:bg-white/5 transition-colors">
                        <TableCell className="font-medium text-white">
                          <span className="inline-flex items-start gap-1.5">
                            <NomeComBandeira nome={item.nome} nacionalidade={item.nacionalidade} />
                            {(aba === 'travados' ? item.inscricao_id : item.id) && (
                              <button
                                type="button"
                                onClick={() => setFichaAberta({ tipo: item.tipo, id: aba === 'travados' ? item.inscricao_id : item.id })}
                                data-dica="Abrir a ficha de inscrição (dá para editar dali)."
                                aria-label={`Abrir a ficha de ${item.nome}`}
                                className="mt-px shrink-0 rounded p-0.5 text-gray-500 hover:text-blue-300 hover:bg-white/10"
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                            )}
                          </span>
                          {item.cobranca?.observacao && aba !== 'nao' && (
                            <p className="mt-1 flex items-start gap-1 text-xs font-normal text-gray-400 max-w-xs">
                              <StickyNote className="w-3.5 h-3.5 mt-px shrink-0" />
                              <span className="break-words">{item.cobranca.observacao}</span>
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-gray-400 whitespace-nowrap">{item.cpf}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`capitalize border-none ${item.tipo === 'acampante' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}
                          >
                            {item.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          <CelulaWhatsApp
                            item={item} onCopiar={copiarNumero}
                            onAbrir={aba === 'pagos' ? () => registrarEnvio(item) : undefined}
                          />
                        </TableCell>
                        <TableCell className="text-gray-300 text-sm">
                          {aba === 'travados' ? (
                            <div className="flex flex-col">
                              <span className={item.status === 'divergente' ? 'text-amber-400 font-medium' : 'text-gray-300'}>
                                {item.motivo}
                              </span>
                              <span className="text-gray-500 text-xs mt-0.5">
                                Cobrado: {formatarValor(item.valor)}
                              </span>
                            </div>
                          ) : aba === 'cobranca' ? (
                            <span className="text-gray-400 whitespace-nowrap">
                              {valorDaColuna(item, 'desde')}
                              <span className="text-gray-500"> · {item.cobranca?.marcado_por}</span>
                            </span>
                          ) : aba === 'agendado' ? (
                            <DataCombinada iso={item.cobranca?.agendado_para} />
                          ) : aba === 'pagos' ? (
                            <div className="flex flex-col whitespace-nowrap">
                              <span className="text-gray-300">{valorDaColuna(item, 'pagamento')}</span>
                              <span className="text-gray-500 text-xs mt-0.5">{dataHoraBR(item.data_pagamento) || '—'}</span>
                              {podeDesfazer(item) && (
                                desfazendo === item.id ? (
                                  <span className="mt-1 inline-flex items-center gap-1 text-xs">
                                    <span className="text-amber-300 mr-0.5">Voltar para não pago?</span>
                                    <button
                                      type="button" disabled={desfazendoAgora} onClick={() => setDesfazendo(null)}
                                      className="px-1.5 py-0.5 rounded text-gray-300 hover:bg-white/10 hover:text-white"
                                    >
                                      Não
                                    </button>
                                    <button
                                      type="button" disabled={desfazendoAgora} onClick={() => desfazer(item)}
                                      className="px-1.5 py-0.5 rounded bg-red-600 hover:bg-red-700 text-white"
                                    >
                                      {desfazendoAgora ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Sim'}
                                    </button>
                                  </span>
                                ) : (
                                  <button
                                    type="button" onClick={() => setDesfazendo(item.id)}
                                    data-dica="Confirmou por engano? A pessoa volta para Não pagaram (valor, cupom e quem confirmou são apagados)."
                                    className="mt-1 inline-flex items-center gap-1 w-fit text-xs text-gray-500 hover:text-red-300"
                                  >
                                    <Undo2 className="w-3 h-3" /> Desfazer pagamento
                                  </button>
                                )
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">{valorDaColuna(item, 'forma')}</span>
                          )}
                        </TableCell>
                        {aba === 'pagos' && (
                          <>
                            <TableCell className="text-sm whitespace-nowrap">
                              <div className="flex flex-col items-start gap-1">
                                {item.valor_pago === null || item.valor_pago === undefined
                                  ? <span className="text-gray-600" data-dica="Pago antes de 08/10/2026, quando o valor ainda não era registrado.">—</span>
                                  : <span className="text-white font-medium">{formatarValor(item.valor_pago)}</span>}
                                {item.cupom_usado && (
                                  <Badge variant="outline" className="border-pink-500/40 bg-pink-500/10 text-pink-300 text-[11px] px-2 py-0">
                                    {item.cupom_usado}{item.desconto ? ` · −${formatarValor(item.desconto)}` : ''}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                          </>
                        )}
                        {aba === 'pagos' && (
                          <TableCell className="text-sm">
                            <CelulaGrupo item={item} onMarcar={registrarEnvio} onDesmarcar={desmarcarEnvio} ocupado={gravandoGrupo} />
                          </TableCell>
                        )}
                        {aba !== 'pagos' && (
                          <TableCell>
                            <Acoes item={item} />
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <Paginacao {...paginacao} />
          </motion.div>
        )}

        {fichaAberta && (
          <FichaInscricaoDialog
            tipo={fichaAberta.tipo}
            id={fichaAberta.id}
            onClose={() => setFichaAberta(null)}
            onSalvo={carregar}
          />
        )}

        <ConfirmarPagamentoDialog
          pedido={confirmacao}
          cupons={cupons}
          onConfirmar={confirmarPagamento}
          onFechar={() => setConfirmacao(null)}
        />

        <CobrancaDialog
          item={dialogo?.item || null}
          statusInicial={dialogo?.status}
          onSalvar={salvarCobranca}
          onRemover={tirarDaCobranca}
          onFechar={() => setDialogo(null)}
        />
      </div>
    </Layout>
  );
};

export default PagamentosPendentesPage;
