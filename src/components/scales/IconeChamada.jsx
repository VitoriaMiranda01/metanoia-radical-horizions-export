import React, { useState } from 'react';
import { CheckCircle2, CircleDashed, Loader2, XCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/components/ui/use-toast';
import { marcarChamada, useChamada, usePodeMarcarChamada } from '@/services/chamadaStore';
import { cn } from '@/lib/utils';

/**
 * Icone da chamada ao lado do nome, na tabela de cada area (16/10/2026):
 *   verde  = presença confirmada
 *   X vermelho = ausente na leitura de escala
 *   tracejado escuro = chamada não registrada
 * So aparece depois que a provisoria e lancada. Clicar troca entre os tres
 * (quem gere a escala). Mesmo dado do lider e da janela da area.
 */
const OPCOES = [
  { valor: true, codigo: 'p', rotulo: 'Presença confirmada', Icone: CheckCircle2, cor: 'text-green-400' },
  { valor: false, codigo: 'a', rotulo: 'Ausente na leitura de escala', Icone: XCircle, cor: 'text-red-400' },
  { valor: null, codigo: '', rotulo: 'Chamada não registrada', Icone: CircleDashed, cor: 'text-gray-500' }
];

const IconeChamada = ({ escalaId, nome }) => {
  const { toast } = useToast();
  const estado = useChamada(escalaId);
  const podeMarcar = usePodeMarcarChamada();
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);

  if (estado === null) return null;

  const [codigo, por] = estado ? estado.split('|') : ['', ''];
  const atual = OPCOES.find((o) => o.codigo === codigo) || OPCOES[2];
  const dica = `${atual.rotulo}${codigo && por ? ` · marcado por ${por}` : ''}${podeMarcar ? ' (clique para mudar)' : ''}`;
  const Icone = salvando ? Loader2 : atual.Icone;
  const simbolo = <Icone className={cn('h-4 w-4', atual.cor, salvando && 'animate-spin')} />;

  if (!podeMarcar) {
    return <span className="shrink-0 inline-flex" data-dica={dica} aria-label={dica}>{simbolo}</span>;
  }

  const escolher = async (opcao) => {
    setAberto(false);
    if (opcao.codigo === codigo) return;
    setSalvando(true);
    const r = await marcarChamada(escalaId, opcao.valor);
    setSalvando(false);
    if (!r.success) toast({ title: 'Não deu para marcar a chamada', description: r.error, variant: 'destructive' });
    else toast({ title: `${(nome || '').split(' ')[0]}: ${opcao.rotulo.toLowerCase()}`, className: 'bg-green-600 text-white' });
  };

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button type="button" data-dica={dica} aria-label={dica} disabled={salvando}
          className="shrink-0 inline-flex rounded-full hover:bg-white/10 p-0.5 -m-0.5">
          {simbolo}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1.5 bg-neutral-900 border-white/20 text-white">
        <p className="px-2 pt-1 pb-1.5 text-[11px] text-gray-400">Chamada da reunião de escala</p>
        {OPCOES.map((o) => (
          <button key={o.codigo || 'nada'} type="button" onClick={() => escolher(o)}
            className={cn('flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm',
              o.codigo === codigo ? 'bg-white/10' : 'hover:bg-white/5')}>
            <o.Icone className={cn('h-4 w-4 shrink-0', o.cor)} /> {o.rotulo}
          </button>
        ))}
        {codigo && por && <p className="px-2 pt-1.5 text-[11px] text-gray-500">Marcado por {por}</p>}
      </PopoverContent>
    </Popover>
  );
};

export default IconeChamada;
