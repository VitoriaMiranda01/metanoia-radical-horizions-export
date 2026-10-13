import React, { useState } from 'react';
import { Loader2, Pin, X } from 'lucide-react';
import { WORK_AREAS } from '@/constants/workAreas';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { formatNomeExibicao } from '@/utils/formatters';
import { marcarAreaFixa } from '@/services/equipanteAllocationService';
import { cn } from '@/lib/utils';

/**
 * 📌 Fixo na área (Patrick, 13/10/2026): o "core" de cada área. A marca fica
 * na ficha do equipante e vale para as próximas edições; o "Alocar
 * automático" coloca os fixos antes de todo mundo, mesmo passando do limite.
 * A mesma pessoa pode ser fixa em mais de uma área.
 *
 * Fixar numa área em que a pessoa ainda não está já coloca ela lá (o banco
 * faz isso em marcar_area_fixa).
 */
const FixarAreaDialog = ({ equipante, area, fixasAtuais = [], onClose, onSalvo }) => {
  const { toast } = useToast();
  const [escolhidas, setEscolhidas] = useState(() => new Set(fixasAtuais.length ? fixasAtuais : [area]));
  const [outra, setOutra] = useState('');
  const [salvando, setSalvando] = useState(false);

  const nome = formatNomeExibicao(equipante.nome);
  const lista = [...escolhidas].sort((a, b) => (a === area ? -1 : b === area ? 1 : a.localeCompare(b, 'pt-BR')));
  const alternar = (a) => setEscolhidas(prev => {
    const n = new Set(prev);
    if (n.has(a)) n.delete(a); else n.add(a);
    return n;
  });
  const adicionarOutra = () => {
    if (!outra) return;
    setEscolhidas(prev => new Set(prev).add(outra));
    setOutra('');
  };

  const salvar = async () => {
    const antes = new Set(fixasAtuais);
    const marcar = [...escolhidas].filter(a => !antes.has(a));
    const desmarcar = fixasAtuais.filter(a => !escolhidas.has(a));
    if (marcar.length === 0 && desmarcar.length === 0) { onClose(); return; }

    setSalvando(true);
    const entrou = [];
    const avisos = [];
    const erros = [];
    for (const a of desmarcar) {
      const r = await marcarAreaFixa(equipante.id, a, false);
      if (!r.success) erros.push(`${a}: ${r.error}`);
    }
    for (const a of marcar) {
      const r = await marcarAreaFixa(equipante.id, a, true);
      if (!r.success) erros.push(`${a}: ${r.error}`);
      else {
        if (r.alocado) entrou.push(a);
        if (r.aviso) avisos.push(r.aviso);
      }
    }
    setSalvando(false);

    if (erros.length) {
      toast({ title: 'Nem tudo foi salvo', description: erros.join(' · '), variant: 'destructive' });
    } else {
      toast({
        title: escolhidas.size ? `📌 ${nome}: fixo em ${[...escolhidas].join(', ')}` : `${nome} não é mais fixo`,
        description: [
          entrou.length > 0 && `Já foi escalado também em ${entrou.join(', ')}.`,
          ...avisos
        ].filter(Boolean).join(' ') || undefined,
        className: avisos.length ? undefined : 'bg-green-600 text-white'
      });
    }
    onSalvo?.();
    onClose();
  };

  const disponiveis = WORK_AREAS.filter(a => !escolhidas.has(a) && a !== 'Não será escalado');

  return (
    <Dialog open onOpenChange={(v) => { if (!v && !salvando) onClose(); }}>
      <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pin className="h-4 w-4 text-amber-400" fill="currentColor" />
            Fixo na área
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            <strong className="text-white">{nome}</strong> entra primeiro no “Alocar automático”
            nas áreas marcadas, todo ano, mesmo passando do limite. A marca continua de uma
            edição para a outra.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {lista.length === 0 && (
            <p className="text-xs text-gray-500 italic">Nenhuma área marcada — salvar tira o alfinete.</p>
          )}
          {lista.map(a => (
            <div key={a} className="flex items-center justify-between gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
              <span className="text-sm flex items-center gap-2">
                <span>📌</span>{a}
                {a === area && <span className="text-[10px] text-gray-400">(esta área)</span>}
                {!fixasAtuais.includes(a) && <span className="text-[10px] text-amber-300">nova</span>}
              </span>
              <button type="button" onClick={() => alternar(a)} disabled={salvando}
                data-dica={`Deixar de ser fixo em ${a}.`}
                className="text-gray-400 hover:text-red-400">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          {!escolhidas.has(area) && (
            <button type="button" onClick={() => alternar(area)} disabled={salvando}
              className="w-full rounded-md border border-dashed border-white/20 px-3 py-2 text-left text-sm text-gray-300 hover:bg-white/5">
              + Fixar em {area}
            </button>
          )}
        </div>

        <div className="pt-1">
          <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-1.5">Fixo também em outra área</p>
          <div className="flex gap-2">
            <Select value={outra} onValueChange={setOutra}>
              <SelectTrigger className="h-9 flex-1 bg-black/40 border-white/20 text-white text-sm">
                <SelectValue placeholder="Escolher área..." />
              </SelectTrigger>
              <SelectContent>
                {disponiveis.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" onClick={adicionarOutra} disabled={!outra || salvando}
              className="h-9 bg-white/5 border-white/20 text-white hover:bg-white/10 hover:text-white">
              Adicionar
            </Button>
          </div>
          <p className="text-[11px] text-gray-500 mt-1.5">
            Se a pessoa ainda não está na área nova, ela já é escalada lá ao salvar.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={salvando} className="text-white hover:bg-white/10 hover:text-white">
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando} className={cn('bg-amber-600 hover:bg-amber-700 text-white')}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FixarAreaDialog;
