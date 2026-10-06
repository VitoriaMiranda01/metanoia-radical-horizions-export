import React, { useEffect, useState } from 'react';
import { CalendarClock, Loader2, PhoneCall, Undo2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/**
 * Janela de "situacao da cobranca" de um acampante (pedido da Raquel,
 * 06/10/2026): Cobranca em andamento ou Pagamento agendado (com a data
 * combinada), mais uma observacao curta. Quem ja esta em cobranca tambem
 * pode voltar para "Nao pagaram" (marcou errado).
 */

const OPCOES = [
  { valor: 'em_cobranca', titulo: 'Cobrança em andamento', texto: 'Já falei com a pessoa e estou cobrando.', Icone: PhoneCall },
  { valor: 'agendado', titulo: 'Pagamento agendado', texto: 'A pessoa combinou uma data para pagar.', Icone: CalendarClock },
];

const MAX_OBS = 200;

const CobrancaDialog = ({ item, statusInicial, onSalvar, onRemover, onFechar }) => {
  const [status, setStatus] = useState(statusInicial || 'em_cobranca');
  const [data, setData] = useState('');
  const [obs, setObs] = useState('');
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);
  // Guarda a ultima pessoa para o nome nao sumir durante a animacao de fechar.
  const [pessoa, setPessoa] = useState(item);

  useEffect(() => {
    if (!item) return;
    setPessoa(item);
    setStatus(statusInicial || item.cobranca?.status || 'em_cobranca');
    setData(item.cobranca?.agendado_para || '');
    setObs(item.cobranca?.observacao || '');
    setErro(null);
    setSalvando(false);
  }, [item, statusInicial]);

  const salvar = async () => {
    if (status === 'agendado' && !data) {
      setErro('Escolha a data combinada.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await onSalvar(pessoa, status, data, obs.trim());
    } catch (e) {
      setErro(e.message);
      setSalvando(false);
    }
  };

  const remover = async () => {
    setSalvando(true);
    setErro(null);
    try {
      await onRemover(pessoa);
    } catch (e) {
      setErro(e.message);
      setSalvando(false);
    }
  };

  return (
    <Dialog open={!!item} onOpenChange={(aberto) => !aberto && !salvando && onFechar()}>
      <DialogContent className="bg-neutral-900 border-white/10 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Situação da cobrança</DialogTitle>
          <DialogDescription className="text-gray-400">{pessoa?.nome}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {OPCOES.map(({ valor, titulo, texto, Icone }) => (
            <button
              key={valor} type="button"
              onClick={() => { setStatus(valor); setErro(null); }}
              className={cn(
                'w-full flex items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                status === valor
                  ? 'border-blue-500/60 bg-blue-500/10'
                  : 'border-white/10 bg-white/5 hover:bg-white/10'
              )}
            >
              <Icone className={cn('w-5 h-5 mt-0.5 shrink-0', status === valor ? 'text-blue-400' : 'text-gray-400')} />
              <span>
                <span className="block text-sm font-medium text-white">{titulo}</span>
                <span className="block text-xs text-gray-400">{texto}</span>
              </span>
            </button>
          ))}
        </div>

        {status === 'agendado' && (
          <div className="space-y-1">
            <label htmlFor="cobranca-data" className="text-sm text-gray-300">Data combinada</label>
            <Input
              id="cobranca-data" type="date" value={data}
              onChange={(e) => { setData(e.target.value); setErro(null); }}
              className="bg-white/5 border-white/10 text-white [color-scheme:dark]"
            />
          </div>
        )}

        <div className="space-y-1">
          <label htmlFor="cobranca-obs" className="text-sm text-gray-300">Observação (opcional)</label>
          <Textarea
            id="cobranca-obs" rows={2} maxLength={MAX_OBS} value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Vai pagar metade dia 10"
            className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
          />
          <p className="text-[11px] text-gray-500 text-right">{obs.length}/{MAX_OBS}</p>
        </div>

        {erro && <p className="text-sm text-red-400">{erro}</p>}

        <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-2 pt-1">
          {pessoa?.cobranca && (
            <Button
              type="button" variant="ghost" onClick={remover} disabled={salvando}
              data-dica="Tira a pessoa da cobrança e ela volta para Não pagaram."
              className="text-gray-400 hover:text-white hover:bg-white/10 sm:mr-auto"
            >
              <Undo2 className="w-4 h-4 mr-1.5" />
              Voltar para Não pagaram
            </Button>
          )}
          <Button
            type="button" variant="outline" onClick={onFechar} disabled={salvando}
            className="border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/10 sm:ml-auto"
          >
            Cancelar
          </Button>
          <Button type="button" onClick={salvar} disabled={salvando} className="bg-blue-600 hover:bg-blue-700 text-white">
            {salvando && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CobrancaDialog;
