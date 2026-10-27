import React, { useEffect, useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { fetchChamadaPorSituacao } from '@/services/scalesService';
import { SITUACOES, contaNaChamada } from './ChamadaSituacaoLista';

/**
 * Exportar a chamada em PDF (27/10/2026, Patrick): situacao (presentes,
 * ausentes, sem chamada ou as tres) e area (todas ou uma). Segue a aba aberta
 * no quadro; Nome | Igreja | Telefone.
 */
const ChamadaExportar = ({ situacaoAberta, areas }) => {
  const { toast } = useToast();
  const [situacao, setSituacao] = useState(situacaoAberta || 'todas');
  const [area, setArea] = useState('');
  const [gerando, setGerando] = useState(false);

  useEffect(() => { setSituacao(situacaoAberta || 'todas'); }, [situacaoAberta]);

  const exportar = async () => {
    setGerando(true);
    try {
      const chaves = situacao === 'todas' ? Object.keys(SITUACOES) : [situacao];
      const respostas = await Promise.all(chaves.map((c) => fetchChamadaPorSituacao(c)));
      const falha = respostas.find((r) => !r.success);
      if (falha) throw new Error(falha.error);
      const secoes = chaves.map((c, i) => ({
        rotulo: SITUACOES[c].rotulo,
        pessoas: (respostas[i].data.pessoas || []).filter((p) => contaNaChamada(p.area) && (!area || p.area === area))
      }));
      const { exportarChamadaPdf } = await import('@/utils/chamadaPdf');
      const total = await exportarChamadaPdf(secoes, area);
      toast({ title: 'PDF da chamada pronto', description: `${total} ${total === 1 ? 'pessoa' : 'pessoas'} no arquivo.`, className: 'bg-green-600 text-white' });
    } catch (e) {
      toast({ title: 'Não deu para gerar o PDF', description: e?.message || 'Tente de novo.', variant: 'destructive' });
    } finally {
      setGerando(false);
    }
  };

  const seletor = 'h-8 rounded-md border border-white/20 bg-black/50 px-2 text-xs text-white';
  return (
    <div className="px-4 py-2 border-b border-white/10 flex flex-wrap items-center gap-2">
      <span className="text-xs text-gray-400">Exportar PDF (nome, igreja e telefone):</span>
      <select value={situacao} onChange={(e) => setSituacao(e.target.value)} aria-label="Situação" className={seletor}>
        <option value="todas">Presentes, ausentes e sem chamada</option>
        {Object.entries(SITUACOES).map(([k, s]) => <option key={k} value={k}>{s.rotulo}</option>)}
      </select>
      <select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Área" className={`${seletor} max-w-[14rem]`}>
        <option value="">Todas as áreas</option>
        {areas.map((a) => <option key={a} value={a}>{a}</option>)}
      </select>
      <Button size="sm" variant="outline" onClick={exportar} disabled={gerando}
        data-dica="Gera o PDF com a situação e a área escolhidas, com os dados mais recentes."
        className="h-8 border-cyan-500/40 bg-transparent text-cyan-300 hover:bg-cyan-500/15 hover:text-cyan-200">
        {gerando ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileDown className="h-4 w-4 mr-1" />} Exportar PDF
      </Button>
    </div>
  );
};

export default ChamadaExportar;
