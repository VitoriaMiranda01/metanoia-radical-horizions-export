import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckSquare, Loader2, Search, Square, Users, X } from 'lucide-react';
import GrupoTrilhaTag from '@/components/common/GrupoTrilhaTag';
import { CORES_GRUPO, areaTemCor } from '@/constants/workAreas';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { nomeDaIgreja } from '@/constants/igrejas';
import { casaBusca } from '@/utils/busca';
import { alocarEmLoteNaArea } from '@/services/equipanteAllocationService';
import { cn } from '@/lib/utils';

/**
 * "Alocar em lote" de uma area (Patrick, 12/10/2026): marca varias pessoas da
 * fila "A escalar" e coloca todas na area de uma vez.
 *
 * Limite so avisa (13/10/2026): da para marcar alem das vagas (total e por
 * sexo, a mesma regra do banco: com limite so de homens, mulher conta como
 * acima do limite, e vice-versa). A tela mostra o aviso e confirma; ai manda
 * forcar = true. Sem passar das vagas, o banco confere de novo pessoa a
 * pessoa (alocar_em_lote_na_area) e devolve quem nao coube.
 */

const OPCAO = ['1ª opção', '2ª opção', '3ª opção'];
const ehMulher = (p) => String(p.sexo || '').toLowerCase() === 'feminino';

// Vagas por sexo pela regra do banco (_equipante_area_tem_vaga).
const vagasPorSexo = (limitObj, mulheres, homens) => {
  const lm = limitObj.limiteMulheres;
  const lh = limitObj.limiteHomens;
  const efM = lm == null && lh != null ? 0 : lm;
  const efH = lh == null && lm != null ? 0 : lh;
  return {
    mulheres: efM == null ? Infinity : Math.max(0, efM - mulheres),
    homens: efH == null ? Infinity : Math.max(0, efH - homens),
  };
};

const AlocarEmLoteDialog = ({ area, limitObj, ocupados, mulheres, homens, fila = [], onClose, onAlocado }) => {
  const { toast } = useToast();
  const [modo, setModo] = useState('escolheram');
  const [busca, setBusca] = useState('');
  const [marcados, setMarcados] = useState(() => new Set());
  const [salvando, setSalvando] = useState(false);
  // Area dividida por cor (13/10/2026): a cor pode ir para todos de uma vez.
  // Sem cor e permitido, mas fica o aviso.
  const comCor = areaTemCor(area);
  const [cor, setCor] = useState('');

  const vagas = Math.max(0, (limitObj?.limiteMaximo || 0) - ocupados);
  const porSexo = vagasPorSexo(limitObj || {}, mulheres, homens);

  // Qual opcao (0, 1, 2) a pessoa deu para esta area; -1 se nao escolheu.
  const opcaoDe = (p) => [p.area_trabalho_opcao1, p.area_trabalho_opcao2, p.area_trabalho_opcao3].indexOf(area);

  const escolheramQtd = useMemo(() => fila.filter((p) => opcaoDe(p) >= 0).length, [fila, area]); // eslint-disable-line react-hooks/exhaustive-deps

  const lista = useMemo(() => fila
    .filter((p) => (modo === 'escolheram' ? opcaoDe(p) >= 0 : true))
    .filter((p) => casaBusca(busca, [p.nome, nomeDaIgreja(p), p.igreja_outra, p.cpf]))
    .sort((a, b) => {
      const oa = opcaoDe(a); const ob = opcaoDe(b);
      const ra = oa < 0 ? 9 : oa; const rb = ob < 0 ? 9 : ob;
      return ra - rb || String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
    }), [fila, modo, busca, area]); // eslint-disable-line react-hooks/exhaustive-deps

  const escolhidos = useMemo(() => fila.filter((p) => marcados.has(p.id)), [fila, marcados]);
  const mulheresMarcadas = escolhidos.filter(ehMulher).length;
  const homensMarcados = escolhidos.length - mulheresMarcadas;

  // Ainda cabe esta pessoa dentro do limite? (Nao trava mais: so avisa.)
  const cabe = (p) => {
    if (escolhidos.length >= vagas) return false;
    return ehMulher(p) ? mulheresMarcadas < porSexo.mulheres : homensMarcados < porSexo.homens;
  };

  // Quanto a selecao passa do limite (total e por sexo).
  const acimaTotal = Math.max(0, escolhidos.length - vagas);
  const acimaMulheres = porSexo.mulheres === Infinity ? 0 : Math.max(0, mulheresMarcadas - porSexo.mulheres);
  const acimaHomens = porSexo.homens === Infinity ? 0 : Math.max(0, homensMarcados - porSexo.homens);
  const passaDoLimite = acimaTotal > 0 || acimaMulheres > 0 || acimaHomens > 0;
  const textoAcima = [
    acimaTotal > 0 && `${acimaTotal} acima do limite da área`,
    acimaMulheres > 0 && `${acimaMulheres} ${acimaMulheres === 1 ? 'mulher' : 'mulheres'} acima do limite`,
    acimaHomens > 0 && `${acimaHomens} ${acimaHomens === 1 ? 'homem' : 'homens'} acima do limite`,
  ].filter(Boolean).join(' · ');

  const alternar = (p) => setMarcados((s) => {
    const n = new Set(s);
    if (n.has(p.id)) n.delete(p.id); else n.add(p.id);
    return n;
  });

  // Marca os primeiros da lista (na ordem mostrada) ate completar as vagas.
  const marcarAteEncher = () => {
    const n = new Set(marcados);
    let m = mulheresMarcadas; let h = homensMarcados;
    for (const p of lista) {
      if (n.size >= vagas) break;
      if (n.has(p.id)) continue;
      if (ehMulher(p)) { if (m >= porSexo.mulheres) continue; m += 1; } else { if (h >= porSexo.homens) continue; h += 1; }
      n.add(p.id);
    }
    setMarcados(n);
  };

  const alocar = async () => {
    if (!escolhidos.length) return;
    if (passaDoLimite && !window.confirm(
      `${area}: ${textoAcima}.\n\nAlocar as ${escolhidos.length} pessoas mesmo assim? Na alocação manual o limite é só aviso.`
    )) return;
    setSalvando(true);
    // Na ordem da lista (quem escolheu a area como 1ª opcao primeiro).
    const ordem = lista.filter((p) => marcados.has(p.id)).map((p) => p.id);
    const resto = escolhidos.map((p) => p.id).filter((id) => !ordem.includes(id));
    const r = await alocarEmLoteNaArea(area, [...ordem, ...resto], comCor ? cor : null, passaDoLimite);
    setSalvando(false);
    if (!r.success) {
      toast({ title: 'Não foi possível alocar', description: r.error, variant: 'destructive' });
      return;
    }
    toast({
      title: `${r.alocados} ${r.alocados === 1 ? 'pessoa alocada' : 'pessoas alocadas'} em ${area}${comCor && cor ? ` (${cor})` : ''}`,
      description: r.recusados.length
        ? `Não couberam: ${r.recusados.map((x) => `${x.nome} (${x.motivo})`).join(' · ')}`
        : undefined,
      variant: r.recusados.length ? 'destructive' : undefined,
      className: r.recusados.length ? undefined : 'bg-green-600 text-white',
    });
    onAlocado?.();
    onClose();
  };

  const textoSexo = [
    porSexo.mulheres !== Infinity && `${porSexo.mulheres} para mulheres`,
    porSexo.homens !== Infinity && `${porSexo.homens} para homens`,
  ].filter(Boolean).join(' · ');

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent overlayClassName="bg-black/70" className="bg-neutral-900 border-white/10 text-white sm:max-w-2xl max-h-[90vh] flex flex-col gap-3">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Users className="w-5 h-5" />Alocar em lote — {area}</DialogTitle>
          <DialogDescription className="text-gray-400">
            {ocupados}/{limitObj?.limiteMaximo} ocupados · <span className={cn('font-medium', vagas ? 'text-emerald-300' : 'text-red-300')}>{vagas} {vagas === 1 ? 'vaga' : 'vagas'}</span>
            {textoSexo && <> ({textoSexo})</>}. Marque quem vem da fila “A escalar”. Passar do limite é permitido, com aviso.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex gap-1.5" role="group" aria-label="Quem mostrar">
            {[['escolheram', `Escolheram ${area}`, escolheramQtd], ['todos', 'Toda a fila', fila.length]].map(([k, rotulo, n]) => (
              <button
                key={k} type="button" onClick={() => setModo(k)} aria-pressed={modo === k}
                className={cn('h-9 px-3 rounded-md border text-xs whitespace-nowrap',
                  modo === k ? 'border-white/30 bg-white/15 text-white' : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10')}
              >
                {rotulo} <span className="text-gray-500 tabular-nums">{n}</span>
              </button>
            ))}
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome, igreja ou CPF..."
              className="h-9 pl-8 pr-8 bg-white/5 border-white/10 text-white placeholder:text-gray-500" />
            {busca && (
              <button type="button" onClick={() => setBusca('')} aria-label="Limpar a busca" className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {comCor && (
          <div className="space-y-1.5">
            <p className="text-xs text-gray-400">Cor do grupo para todos que entrarem</p>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Cor do grupo">
              {CORES_GRUPO.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={cor === c} onClick={() => setCor(c)}
                  className={cn('rounded-full p-0.5 border-2', cor === c ? 'border-white' : 'border-transparent hover:border-white/30')}>
                  <GrupoTrilhaTag grupo={c} />
                </button>
              ))}
              <button type="button" role="radio" aria-checked={!cor} onClick={() => setCor('')}
                className={cn('rounded-full px-2.5 py-0.5 text-xs border-2', !cor ? 'border-white text-white' : 'border-white/10 text-gray-400 hover:border-white/30')}>
                Sem cor
              </button>
            </div>
            {!cor && (
              <p className="flex items-start gap-1.5 text-xs text-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {area} é dividida por cor. Sem cor, as pessoas ficam com aviso até alguém escolher a cor de cada uma na coluna Cor.
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 text-xs text-gray-400">
          <span className={cn(passaDoLimite && 'text-amber-300')}>{escolhidos.length} de {vagas} {vagas === 1 ? 'vaga' : 'vagas'} marcadas</span>
          <div className="flex gap-3">
            <button type="button" onClick={marcarAteEncher} disabled={!vagas || !lista.length}
              data-dica="Marcar os primeiros da lista (quem escolheu esta área como 1ª opção vem antes) até completar as vagas."
              className="hover:text-white disabled:opacity-40">Marcar até completar</button>
            {escolhidos.length > 0 && <button type="button" onClick={() => setMarcados(new Set())} className="hover:text-white">Limpar</button>}
          </div>
        </div>

        {passaDoLimite && (
          <p className="flex items-start gap-1.5 text-xs text-amber-300 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{textoAcima}. Dá para alocar assim mesmo — vai pedir confirmação.</span>
          </p>
        )}

        <div className="flex-1 min-h-0 max-h-[50vh] overflow-y-auto pr-1 space-y-1">
          {!lista.length && (
            <p className="text-center py-8 text-gray-500">
              {busca ? 'Ninguém da fila bate com a busca.' : modo === 'escolheram' ? `Ninguém na fila escolheu ${area}. Veja “Toda a fila”.` : 'A fila “A escalar” está vazia.'}
            </p>
          )}
          {lista.map((p) => {
            const marcado = marcados.has(p.id);
            // Marcar esta pessoa passaria do limite: so um aviso no item.
            const acima = !marcado && !cabe(p);
            const op = opcaoDe(p);
            return (
              <button
                key={p.id} type="button" onClick={() => alternar(p)}
                data-dica={acima ? 'Marcar esta pessoa passa do limite da área (é permitido, com aviso).' : undefined}
                className={cn('w-full flex items-center gap-3 rounded-md px-3 py-2 text-left border',
                  marcado ? 'border-blue-500/50 bg-blue-500/10' : 'border-white/5 bg-white/5 hover:bg-white/10',
                  acima && 'opacity-60')}
              >
                {marcado ? <CheckSquare className="w-4 h-4 text-blue-400 shrink-0" /> : <Square className="w-4 h-4 text-gray-500 shrink-0" />}
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-white truncate">{p.nome}</span>
                  <span className="block text-[11px] text-gray-500 truncate">{nomeDaIgreja(p) || '—'}</span>
                </span>
                {op >= 0 && <span className="text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/30 text-emerald-300 shrink-0">{OPCAO[op]}</span>}
                <span className={cn('text-[10px] shrink-0', ehMulher(p) ? 'text-pink-300' : 'text-blue-300')}>{ehMulher(p) ? 'F' : 'M'}</span>
              </button>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose} className="text-gray-300 hover:text-white hover:bg-white/10">Cancelar</Button>
          <Button onClick={alocar} disabled={!escolhidos.length || salvando}
            className={cn('text-white', passaDoLimite ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700')}>
            {salvando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {passaDoLimite && <AlertTriangle className="w-4 h-4 mr-1.5" />}
            Alocar {escolhidos.length || ''} {escolhidos.length === 1 ? 'pessoa' : 'pessoas'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AlocarEmLoteDialog;
