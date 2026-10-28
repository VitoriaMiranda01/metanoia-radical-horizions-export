import React, { useEffect, useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { fetchChamadaPorSituacao } from '@/services/scalesService';
import { SITUACOES, contaNaChamada } from './ChamadaSituacaoLista';

/**
 * Exportar a chamada em PDF (27/10/2026, Patrick). Em 28/10/2026 virou um PDF
 * por area (ordem alfabetica) com todo mundo junto e a coluna Presenca; quem
 * gera marca as situacoes e as colunas que quer, e escolhe todas as areas ou
 * uma. As colunas marcadas ficam lembradas neste navegador. Segue a aba aberta
 * no quadro para as situacoes.
 */
const CHAVE_COLUNAS = 'chamada_pdf_colunas';
const PADRAO = ['nome', 'igreja', 'telefone', 'presenca'];
const ORDEM_SITUACOES = ['presentes', 'ausentes', 'sem'];

const colunasSalvas = () => {
  try {
    const salvas = JSON.parse(localStorage.getItem(CHAVE_COLUNAS) || 'null');
    if (Array.isArray(salvas) && salvas.length) return salvas;
  } catch { /* sem storage */ }
  return PADRAO;
};

const Marca = ({ marcado, onChange, children }) => (
  <label className="flex items-center gap-1 text-xs text-gray-200 cursor-pointer select-none">
    <input type="checkbox" checked={marcado} onChange={onChange} className="h-3.5 w-3.5 accent-cyan-500" />
    {children}
  </label>
);

const ChamadaExportar = ({ situacaoAberta, areas }) => {
  const { toast } = useToast();
  const [situacoes, setSituacoes] = useState(situacaoAberta ? [situacaoAberta] : ORDEM_SITUACOES);
  const [colunas, setColunas] = useState(colunasSalvas);
  const [area, setArea] = useState('');
  const [gerando, setGerando] = useState(false);
  const [colunasDisponiveis, setColunasDisponiveis] = useState(null);

  useEffect(() => { setSituacoes(situacaoAberta ? [situacaoAberta] : ORDEM_SITUACOES); }, [situacaoAberta]);

  // Carrega o modulo so quando a barra aparece: o PDF (jspdf) fica para o clique.
  useEffect(() => {
    import('@/utils/chamadaPdf').then((m) => setColunasDisponiveis(m.COLUNAS));
  }, []);

  const alternar = (lista, setLista, chave, ordem) => {
    const nova = lista.includes(chave) ? lista.filter((x) => x !== chave) : [...lista, chave];
    const ordenada = ordem.filter((x) => nova.includes(x));
    setLista(ordenada);
    return ordenada;
  };

  const alternarColuna = (chave) => {
    const ordenada = alternar(colunas, setColunas, chave, Object.keys(colunasDisponiveis));
    try { localStorage.setItem(CHAVE_COLUNAS, JSON.stringify(ordenada)); } catch { /* sem storage */ }
  };

  const exportar = async () => {
    if (!situacoes.length) { toast({ title: 'Marque ao menos uma situação', variant: 'destructive' }); return; }
    if (!colunas.length) { toast({ title: 'Marque ao menos uma coluna', variant: 'destructive' }); return; }
    setGerando(true);
    try {
      const respostas = await Promise.all(situacoes.map((c) => fetchChamadaPorSituacao(c)));
      const falha = respostas.find((r) => !r.success);
      if (falha) throw new Error(falha.error);
      const pessoas = situacoes.flatMap((c, i) => (respostas[i].data.pessoas || [])
        .filter((p) => contaNaChamada(p.area) && (!area || p.area === area))
        .map((p) => ({ ...p, situacao: c })));
      const { exportarChamadaPdf } = await import('@/utils/chamadaPdf');
      const total = await exportarChamadaPdf({ pessoas, colunas, situacoes, area });
      toast({ title: 'PDF da chamada pronto', description: `${total} ${total === 1 ? 'pessoa' : 'pessoas'} no arquivo.`, className: 'bg-green-600 text-white' });
    } catch (e) {
      toast({ title: 'Não deu para gerar o PDF', description: e?.message || 'Tente de novo.', variant: 'destructive' });
    } finally {
      setGerando(false);
    }
  };

  const seletor = 'h-8 rounded-md border border-white/20 bg-black/50 px-2 text-xs text-white';
  return (
    <div className="px-4 py-2 border-b border-white/10 space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="text-xs text-gray-400 w-24 shrink-0">PDF · situação:</span>
        {ORDEM_SITUACOES.map((k) => (
          <Marca key={k} marcado={situacoes.includes(k)} onChange={() => alternar(situacoes, setSituacoes, k, ORDEM_SITUACOES)}>
            {SITUACOES[k].rotulo}
          </Marca>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="text-xs text-gray-400 w-24 shrink-0">PDF · colunas:</span>
        {colunasDisponiveis && Object.entries(colunasDisponiveis).map(([k, c]) => (
          <Marca key={k} marcado={colunas.includes(k)} onChange={() => alternarColuna(k)}>{c.rotulo}</Marca>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-400 w-24 shrink-0">PDF · área:</span>
        <select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Área" className={`${seletor} max-w-[14rem]`}>
          <option value="">Todas as áreas (uma faixa por área)</option>
          {areas.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <Button size="sm" variant="outline" onClick={exportar} disabled={gerando || !colunasDisponiveis}
          data-dica="Gera o PDF por área, em ordem alfabética, com as situações e colunas marcadas e os dados mais recentes."
          className="h-8 border-cyan-500/40 bg-transparent text-cyan-300 hover:bg-cyan-500/15 hover:text-cyan-200">
          {gerando ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileDown className="h-4 w-4 mr-1" />} Exportar PDF
        </Button>
      </div>
    </div>
  );
};

export default ChamadaExportar;
