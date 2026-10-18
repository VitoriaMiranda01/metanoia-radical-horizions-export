import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Loader2, Repeat, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { WORK_AREAS, CORES_GRUPO, areaTemCor } from '@/constants/workAreas';
import GrupoTrilhaTag from '@/components/common/GrupoTrilhaTag';
import { nomeDaIgreja } from '@/constants/igrejas';
import { casaBusca } from '@/utils/busca';
import { trocarAreaEscala, definirAtuacao, definirCor } from '@/services/scalesService';
import { cn } from '@/lib/utils';

/**
 * "Trocar de área" (pedido do Patrick, 05/10/2026). Abre depois que a escala
 * provisoria e lancada, e so para Desenvolvedores, Raquel e Dudu -- o banco
 * confere (trocar_area_escala).
 *
 * Procura a pessoa (nome, igreja ou CPF), mostra a area atual (X) e a troca
 * para a area escolhida (Y). Ela some da relacao do lider de X e aparece na
 * do lider de Y na hora; a chamada feita em X deixa de valer.
 *
 * Quem esta em duas areas aparece duas vezes -- troca-se uma participacao
 * de cada vez.
 *
 * Cor do grupo (12/10/2026): se a area nova trabalha por cor, a cor e
 * escolhida aqui, na mesma troca -- a da area antiga nao vai junto. Sem cor
 * e permitido (13/10/2026: aviso, nao bloqueio), mas a tela avisa -- e no
 * Infiltrados a pessoa so entra nos grupos de trilha e nos onibus com cor.
 *
 * Atuacao e cor (18/10/2026): a atuacao da area nova tambem e escolhida aqui
 * (quando a area tem mais de uma), e cada cor mostra quantas pessoas ja tem.
 * Escolhendo a MESMA area, a pessoa fica onde esta e so muda a atuacao e/ou a
 * cor (a chamada nao se perde).
 */
const TrocarAreaDialog = ({ allocations, atuacoesPorArea = {}, inicial = null, onClose, onTrocado }) => {
  const { toast } = useToast();
  const [busca, setBusca] = useState('');
  const [escolhido, setEscolhido] = useState(inicial);
  // Quem foi separado por ausencia ja vem com a area de onde saiu sugerida.
  const sugestao = (a) => (a?.separadoDe && WORK_AREAS.includes(a.separadoDe) ? a.separadoDe : '');
  const [destino, setDestino] = useState(() => sugestao(inicial));
  const [cor, setCor] = useState('');
  const [atuacao, setAtuacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const mesmaArea = !!escolhido && destino === escolhido.allocatedArea;
  const atuacoesDestino = destino ? (atuacoesPorArea[destino] || []) : [];
  const atuacaoPadrao = atuacoesDestino.find((a) => a.ehPadrao)?.atuacao || atuacoesDestino[0]?.atuacao || '';
  const atuacaoFinal = atuacao || atuacaoPadrao;
  const atuacaoSemCor = atuacoesDestino.some((a) => a.atuacao === atuacaoFinal && a.semCor);
  const destinoTemCor = areaTemCor(destino) && !atuacaoSemCor;
  const ehInfiltrados = destino === 'Infiltrados';
  const mudarDestino = (area) => {
    setDestino(area);
    // Mesma area: parte do que a pessoa ja tem; area nova: padrao e sem cor.
    if (escolhido && area === escolhido.allocatedArea) {
      setAtuacao(escolhido.atuacao || '');
      setCor(escolhido.cor || '');
    } else {
      setAtuacao('');
      setCor('');
    }
  };
  const contarCor = (c) => allocations.filter((a) => a.allocatedArea === destino && a.cor === c).length;
  const nadaMudou = mesmaArea
    && (atuacaoFinal || '') === (escolhido.atuacao || atuacaoPadrao || '')
    && (destinoTemCor ? (cor || '') === (escolhido.cor || '') : true);

  useEffect(() => {
    const aoTeclar = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onClose]);

  const encontrados = useMemo(() => {
    if (!busca.trim()) return [];
    return allocations
      .filter((a) => casaBusca(busca, [a.nome, nomeDaIgreja(a), a.igreja, a.igreja_outra, a.cpf]))
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'))
      .slice(0, 30);
  }, [busca, allocations]);

  const limpar = () => {
    setEscolhido(null);
    setDestino('');
    setCor('');
    setAtuacao('');
    setBusca('');
    onTrocado?.();
  };

  // Mesma area: so atuacao e/ou cor, sem trocar a linha da escala.
  const ajustarNaMesmaArea = async () => {
    setSalvando(true);
    const falhas = [];
    try {
      if ((atuacaoFinal || '') !== (escolhido.atuacao || '')) {
        const r = await definirAtuacao(escolhido.escalaId, atuacaoFinal);
        if (!r.success) falhas.push(`a atuação (${r.error})`);
      }
      if (destinoTemCor && (cor || '') !== (escolhido.cor || '')) {
        const r = await definirCor(escolhido.escalaId, cor || null);
        if (!r?.ok) falhas.push(`a cor (${r?.erro || 'erro'})`);
      }
    } catch (e) {
      falhas.push(e?.message || 'erro de conexão');
    }
    setSalvando(false);
    if (falhas.length) {
      toast({ title: 'Não foi possível salvar', description: `Não deu para mudar ${falhas.join(' e ')}.`, variant: 'destructive' });
      return;
    }
    toast({
      title: 'Atualizado',
      description: `${escolhido.nome}: ${destino}${atuacaoFinal ? ` · ${atuacaoFinal}` : ''}${destinoTemCor && cor ? ` (${cor})` : ''}. Já está na relação do líder.`,
      className: 'bg-green-600 text-white'
    });
    limpar();
  };

  const trocar = async () => {
    if (!escolhido || !destino) return;
    if (mesmaArea) { await ajustarNaMesmaArea(); return; }
    setSalvando(true);
    let r = await trocarAreaEscala(escolhido.escalaId, destino, destinoTemCor ? cor : null);
    // Area cheia (13/10/2026): no manual o limite so avisa.
    if (!r.success && r.data?.sem_vaga && window.confirm(
      `${destino}: ${r.error}.\n\nTrocar ${escolhido.nome} para lá mesmo assim? Na alocação manual o limite é só aviso.`
    )) {
      r = await trocarAreaEscala(escolhido.escalaId, destino, destinoTemCor ? cor : null, true);
    } else if (!r.success && r.data?.sem_vaga) {
      setSalvando(false);
      return;
    }
    if (!r.success) {
      setSalvando(false);
      toast({ title: 'Não foi possível trocar', description: r.error, variant: 'destructive' });
      return;
    }
    // A troca deixa a atuacao padrao da area nova; se escolheu outra, grava.
    let aviso = '';
    if (atuacao && atuacao !== atuacaoPadrao) {
      const ra = await definirAtuacao(escolhido.escalaId, atuacao);
      if (!ra.success) aviso = ` Mas a atuação ficou a padrão (${ra.error}).`;
    }
    setSalvando(false);
    toast({
      title: 'Área trocada',
      description: `${escolhido.nome}: ${escolhido.allocatedArea} → ${destino}${atuacaoFinal ? ` · ${aviso ? atuacaoPadrao : atuacaoFinal}` : ''}${destinoTemCor && cor ? ` (${cor})` : ''}. Já está na relação do líder.${aviso}`,
      className: aviso ? undefined : 'bg-green-600 text-white',
      variant: aviso ? 'destructive' : undefined
    });
    limpar();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}>
      <div className="w-full max-w-2xl bg-zinc-900 border border-white/10 rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Repeat className="w-5 h-5 text-cyan-400" /> Trocar de área
          </h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {!escolhido ? (
            <>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
                <Input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por nome, igreja ou CPF..."
                  className="pl-8 bg-black/40 border-white/20 text-white" />
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {busca.trim() && encontrados.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">Ninguém escalado corresponde a “{busca}”.</p>
                )}
                {encontrados.map((a) => (
                  <button key={a.escalaId} type="button" onClick={() => { setEscolhido(a); setDestino(sugestao(a)); setCor(''); setAtuacao(''); }}
                    className="w-full text-left bg-white/5 hover:bg-white/10 border border-white/10 rounded-md p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{a.nome}</p>
                      <p className="text-[11px] text-gray-500 truncate">{nomeDaIgreja(a) || '—'}</p>
                    </div>
                    <span className="text-[11px] px-2 py-1 rounded border border-green-500/30 bg-green-500/10 text-green-200 shrink-0">
                      {a.allocatedArea}{a.atuacao ? ` · ${a.atuacao}` : ''}
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="bg-white/5 border border-white/10 rounded-md p-3">
                <p className="text-white font-medium">{escolhido.nome}</p>
                <p className="text-xs text-gray-500">{nomeDaIgreja(escolhido) || '—'}</p>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1">
                  <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">De</p>
                  <div className="h-10 px-3 flex items-center rounded-md border border-white/10 bg-black/30 text-gray-200 text-sm">
                    {escolhido.allocatedArea}
                  </div>
                </div>
                <ArrowRight className="hidden sm:block w-5 h-5 text-gray-500 mt-5" />
                <div className="flex-1">
                  <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">Para</p>
                  <Select value={destino} onValueChange={mudarDestino}>
                    <SelectTrigger className="h-10 bg-black/40 border-white/20 text-white">
                      <SelectValue placeholder="Escolher a nova área" />
                    </SelectTrigger>
                    <SelectContent>
                      {escolhido.allocatedArea !== 'Não será escalado' && WORK_AREAS.includes(escolhido.allocatedArea) && (
                        <SelectItem value={escolhido.allocatedArea}>
                          {escolhido.allocatedArea} (mesma área — só atuação/cor)
                        </SelectItem>
                      )}
                      {WORK_AREAS
                        .filter((area) => area !== escolhido.allocatedArea)
                        .map((area) => <SelectItem key={area} value={area}>{area}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {atuacoesDestino.length > 1 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] uppercase tracking-wider text-gray-500">Atuação</p>
                  <Select value={atuacaoFinal} onValueChange={setAtuacao}>
                    <SelectTrigger className="h-10 bg-black/40 border-white/20 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {atuacoesDestino.map((a) => (
                        <SelectItem key={a.atuacao} value={a.atuacao}>
                          {a.ehLider ? `★ ${a.atuacao}` : a.atuacao}{a.atuacao === atuacaoPadrao ? ' (padrão)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {destino && areaTemCor(destino) && atuacaoSemCor && (
                <p className="text-xs text-gray-500">A atuação “{atuacaoFinal}” não usa cor de grupo.</p>
              )}
              {destinoTemCor && (
                <div className="space-y-1.5">
                  <p className="text-[11px] uppercase tracking-wider text-gray-500">
                    Cor do grupo <span className="normal-case tracking-normal text-gray-600">· o número é quantos já estão em cada cor</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Cor do grupo">
                    {CORES_GRUPO.map((c) => (
                      <button
                        key={c} type="button" role="radio" aria-checked={cor === c} onClick={() => setCor(c)}
                        className={cn('rounded-full pl-0.5 pr-2 py-0.5 border-2 transition-colors inline-flex items-center gap-1', cor === c ? 'border-white' : 'border-transparent hover:border-white/30')}
                      >
                        <GrupoTrilhaTag grupo={c} />
                        <span className="text-xs text-gray-400 tabular-nums">{contarCor(c)}</span>
                      </button>
                    ))}
                    <button
                      type="button" role="radio" aria-checked={!cor} onClick={() => setCor('')}
                      className={cn('rounded-full px-2.5 py-0.5 text-xs border-2', !cor ? 'border-white text-white' : 'border-white/10 text-gray-400 hover:border-white/30')}
                    >
                      Sem cor
                    </button>
                  </div>
                  {!cor ? (
                    <p className="text-xs text-amber-300">
                      ⚠ {destino} é dividida por cor. Sem cor, a pessoa fica com aviso até alguém escolher a cor na coluna Cor
                      {ehInfiltrados ? ' — e o infiltrado não aparece nos grupos de trilha nem nos ônibus.' : '.'}
                    </p>
                  ) : ehInfiltrados && (
                    <p className="text-xs text-gray-500">O infiltrado entra nesse grupo de trilha e no ônibus dele, como acampante.</p>
                  )}
                </div>
              )}
              <p className="text-xs text-gray-500">
                {mesmaArea
                  ? `A pessoa continua em ${destino} (a presença marcada pelo líder não se perde); muda só a atuação e/ou a cor.`
                  : <>
                      {escolhido.allocatedArea === 'Não será escalado'
                        ? <>A pessoa volta para a escala e entra na relação do líder da nova área.{escolhido.separadoDe ? ` Ela saiu de ${escolhido.separadoDe} por ausência na chamada.` : ''}</>
                        : `A pessoa sai da relação do líder de ${escolhido.allocatedArea} e entra na do líder da nova área.`}
                      {' '}A atuação é a escolhida acima{destinoTemCor ? ' e a cor também (a da área antiga não vai junto)' : ''}.
                    </>}
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setEscolhido(null)} className="text-gray-400 hover:text-white hover:bg-white/10">
                  Escolher outra pessoa
                </Button>
                <Button onClick={trocar} disabled={!destino || salvando || nadaMudou}
                  className={cn('bg-cyan-600 hover:bg-cyan-700 text-white')}>
                  {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : mesmaArea ? 'Salvar' : 'Trocar'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default TrocarAreaDialog;
