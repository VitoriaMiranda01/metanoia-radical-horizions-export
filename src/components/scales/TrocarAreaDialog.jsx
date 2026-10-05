import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Loader2, Repeat, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { WORK_AREAS } from '@/constants/workAreas';
import { nomeDaIgreja } from '@/constants/igrejas';
import { casaBusca } from '@/utils/busca';
import { trocarAreaEscala } from '@/services/scalesService';
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
 */
const TrocarAreaDialog = ({ allocations, inicial = null, onClose, onTrocado }) => {
  const { toast } = useToast();
  const [busca, setBusca] = useState('');
  const [escolhido, setEscolhido] = useState(inicial);
  // Quem foi separado por ausencia ja vem com a area de onde saiu sugerida.
  const sugestao = (a) => (a?.separadoDe && WORK_AREAS.includes(a.separadoDe) ? a.separadoDe : '');
  const [destino, setDestino] = useState(() => sugestao(inicial));
  const [salvando, setSalvando] = useState(false);

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

  const trocar = async () => {
    if (!escolhido || !destino) return;
    setSalvando(true);
    const r = await trocarAreaEscala(escolhido.escalaId, destino);
    setSalvando(false);
    if (!r.success) {
      toast({ title: 'Não foi possível trocar', description: r.error, variant: 'destructive' });
      return;
    }
    toast({
      title: 'Área trocada',
      description: `${escolhido.nome}: ${escolhido.allocatedArea} → ${destino}. Já está na relação do líder.`,
      className: 'bg-green-600 text-white'
    });
    setEscolhido(null);
    setDestino('');
    setBusca('');
    onTrocado?.();
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
                  <button key={a.escalaId} type="button" onClick={() => { setEscolhido(a); setDestino(sugestao(a)); }}
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
                  <Select value={destino} onValueChange={setDestino}>
                    <SelectTrigger className="h-10 bg-black/40 border-white/20 text-white">
                      <SelectValue placeholder="Escolher a nova área" />
                    </SelectTrigger>
                    <SelectContent>
                      {WORK_AREAS
                        .filter((area) => area !== escolhido.allocatedArea)
                        .map((area) => <SelectItem key={area} value={area}>{area}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                {escolhido.allocatedArea === 'Não será escalado'
                  ? <>A pessoa volta para a escala e entra na relação do líder da nova área.{escolhido.separadoDe ? ` Ela saiu de ${escolhido.separadoDe} por ausência na chamada.` : ''}</>
                  : `A pessoa sai da relação do líder de ${escolhido.allocatedArea} e entra na do líder da nova área.`}
                {' '}A atuação volta para a padrão da área nova.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setEscolhido(null)} className="text-gray-400 hover:text-white hover:bg-white/10">
                  Escolher outra pessoa
                </Button>
                <Button onClick={trocar} disabled={!destino || salvando}
                  className={cn('bg-cyan-600 hover:bg-cyan-700 text-white')}>
                  {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Trocar'}
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
