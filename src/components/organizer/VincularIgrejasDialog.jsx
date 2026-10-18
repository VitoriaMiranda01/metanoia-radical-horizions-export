import React, { useEffect, useMemo, useState } from 'react';
import { Link2, Loader2, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { normalizarBusca } from '@/utils/busca';
import { definirIgrejasDaConta } from '@/services/senhasParceirosService';
import { cn } from '@/lib/utils';

/**
 * "Igrejas" na coluna Ações de Senhas dos Parceiros (19/10/2026): o pastor que
 * ja tem a conta de uma igreja passa a responder tambem por outras, com o
 * MESMO login (caso do Julio, conta 17). Marca as igrejas e salva -- a
 * desmarcada sai. Igreja que ja e de outra conta (ou que responde por outras)
 * aparece travada, dizendo qual.
 */
const VincularIgrejasDialog = ({ conta, contas, vinculos, onFechar, onSalvo }) => {
  const { toast } = useToast();
  const [busca, setBusca] = useState('');
  const [marcadas, setMarcadas] = useState([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (conta) setMarcadas(vinculos.filter((v) => v.conta_codigo === conta.codigo).map((v) => v.igreja_codigo));
    setBusca('');
  }, [conta, vinculos]);

  // Por que cada igreja nao pode ser marcada (ou null).
  const trava = useMemo(() => {
    const t = {};
    vinculos.forEach((v) => {
      if (conta && v.conta_codigo !== conta.codigo) t[v.igreja_codigo] = `já é da conta ${v.conta_codigo}`;
    });
    new Set(vinculos.map((v) => v.conta_codigo)).forEach((c) => {
      if (conta && c !== conta.codigo) t[c] = 'responde por outras igrejas';
    });
    return t;
  }, [vinculos, conta]);

  const contaEhVinculada = conta && vinculos.find((v) => v.igreja_codigo === conta.codigo);

  const lista = useMemo(() => {
    const q = normalizarBusca(busca);
    return contas
      .filter((c) => c.codigo !== conta?.codigo)
      .filter((c) => !q || normalizarBusca(c.nome).includes(q) || String(c.codigo).includes(q))
      // As ja marcadas primeiro, para ver de cara o que esta vinculado.
      .sort((a, b) => (marcadas.includes(b.codigo) - marcadas.includes(a.codigo))
        || String(a.codigo).padStart(4, '0').localeCompare(String(b.codigo).padStart(4, '0')));
  }, [contas, conta, busca, marcadas]);

  const alternar = (codigo) => setMarcadas((m) => (m.includes(codigo) ? m.filter((x) => x !== codigo) : [...m, codigo]));

  const salvar = async () => {
    setSalvando(true);
    try {
      const r = await definirIgrejasDaConta(conta.codigo, marcadas);
      if (!r?.ok) {
        toast({ title: 'Não deu certo', description: r?.erro, variant: 'destructive' });
        return;
      }
      toast({
        title: 'Igrejas atualizadas',
        description: marcadas.length
          ? `A conta ${conta.codigo} agora responde também por ${marcadas.length} ${marcadas.length === 1 ? 'igreja' : 'igrejas'}.`
          : `A conta ${conta.codigo} responde só pela própria igreja.`,
        className: 'bg-green-600 text-white',
      });
      onSalvo?.();
    } catch {
      toast({ title: 'Erro de conexão', description: 'Tente de novo.', variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  const responsavel = conta?.responsavel_nome;

  return (
    <Dialog open={!!conta} onOpenChange={(v) => !v && !salvando && onFechar()}>
      <DialogContent className="bg-neutral-950 border-white/10 text-white sm:max-w-xl max-h-[90dvh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-5 pb-3 border-b border-white/10 text-left">
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-sky-300" /> Igrejas da conta {conta?.codigo}
          </DialogTitle>
          <DialogDescription className="text-gray-400 text-sm">
            {conta?.nome}{responsavel ? <> · <span className="text-gray-200">{responsavel}</span></> : null}.
            {' '}Quem entra com o código <strong className="text-white">{conta?.codigo}</strong> passa a ver e aprovar
            também as inscrições das igrejas marcadas, com a mesma senha.
          </DialogDescription>
        </DialogHeader>

        {contaEhVinculada ? (
          <p className="p-5 text-sm text-amber-300">
            Esta igreja já está vinculada à conta {contaEhVinculada.conta_codigo}. Para mudar, abra “Igrejas” na conta {contaEhVinculada.conta_codigo}.
          </p>
        ) : (
          <>
            <div className="px-5 py-3 border-b border-white/10 space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar igreja por nome ou código"
                  className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-gray-500" />
              </div>
              <p className="text-xs text-gray-400">{marcadas.length} {marcadas.length === 1 ? 'igreja marcada' : 'igrejas marcadas'}</p>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-white/5">
              {lista.length === 0 && <p className="p-6 text-center text-sm text-gray-500">Nenhuma igreja com esse texto.</p>}
              {lista.map((c) => {
                const motivo = trava[c.codigo];
                const marcada = marcadas.includes(c.codigo);
                return (
                  <label key={c.codigo}
                    className={cn('flex items-center gap-3 px-5 py-2.5 min-h-[44px]', motivo ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-white/5', marcada && 'bg-sky-500/10')}>
                    <Checkbox checked={marcada} disabled={!!motivo} onCheckedChange={() => alternar(c.codigo)} aria-label={`${c.codigo} - ${c.nome}`} />
                    <span className="font-mono text-xs text-gray-400 w-8 shrink-0">{c.codigo}</span>
                    <span className="flex-1 min-w-0 text-sm text-gray-200 truncate">{c.nome}</span>
                    {motivo && <span className="text-[11px] text-amber-300 shrink-0">{motivo}</span>}
                  </label>
                );
              })}
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 p-4 border-t border-white/10">
          <Button variant="ghost" onClick={onFechar} disabled={salvando} className="text-gray-300 hover:text-white hover:bg-white/10">Cancelar</Button>
          {!contaEhVinculada && (
            <Button onClick={salvar} disabled={salvando} className="bg-sky-600 hover:bg-sky-700 text-white">
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VincularIgrejasDialog;
