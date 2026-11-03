import React, { useEffect, useState } from 'react';
import { ShieldCheck, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { PERMISSOES, definirPermissoesOrganizador } from '@/services/permissoesService';

/**
 * Caixas de permissao de um organizador (03/11/2026). So a conta
 * Desenvolvedores abre (o banco confere de novo). Vale na proxima tela que
 * a pessoa abrir, sem precisar sair do site.
 */
const PermissoesOrganizadorDialog = ({ organizador, onClose, onSalvo }) => {
  const { toast } = useToast();
  const [marcadas, setMarcadas] = useState([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setMarcadas(organizador?.permissoes || []);
  }, [organizador]);

  const alternar = (chave, ligado) => {
    setMarcadas((atual) => (ligado ? [...new Set([...atual, chave])] : atual.filter((c) => c !== chave)));
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      const r = await definirPermissoesOrganizador(organizador.nome, marcadas);
      if (!r?.ok) {
        toast({ title: 'Não deu certo', description: r?.erro, variant: 'destructive' });
        return;
      }
      toast({
        title: `Permissões de ${r.nome} salvas`,
        description: 'Vale na próxima tela que a pessoa abrir.',
        className: 'bg-emerald-600 text-white',
      });
      onSalvo?.(r.permissoes || []);
      onClose();
    } catch (err) {
      console.error('PermissoesOrganizadorDialog - salvar', err?.message || err);
      toast({ title: 'Erro de conexão', description: 'Tente de novo.', variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  const todas = marcadas.length === PERMISSOES.length;

  return (
    <Dialog open={!!organizador} onOpenChange={(aberto) => { if (!aberto && !salvando) onClose(); }}>
      <DialogContent className="bg-zinc-900 border border-white/10 text-white sm:max-w-lg max-h-[92vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            Permissões de {organizador?.nome}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Marque o que esta pessoa pode acessar. Configurações, Saúde, Backup, Portaria, Recepção
            (com Crachás e Listas dos ônibus) e Senhas dos parceiros ficam só com os Desenvolvedores.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <button type="button" onClick={() => setMarcadas(todas ? [] : PERMISSOES.map((p) => p.chave))}
            className="text-xs text-blue-300 hover:text-blue-200 underline underline-offset-2">
            {todas ? 'Desmarcar todas' : 'Marcar todas'}
          </button>
          {PERMISSOES.map((p) => {
            const id = `perm-${p.chave}`;
            const ligado = marcadas.includes(p.chave);
            return (
              <label key={p.chave} htmlFor={id}
                className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                  ligado ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                <Checkbox id={id} checked={ligado} disabled={salvando}
                  onCheckedChange={(v) => alternar(p.chave, v === true)} className="mt-0.5" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-white">{p.rotulo}</span>
                  <span className="block text-xs text-gray-400">{p.descricao}</span>
                </span>
              </label>
            );
          })}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={salvando}
            className="border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/10">
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {salvando ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Salvar permissões'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PermissoesOrganizadorDialog;
