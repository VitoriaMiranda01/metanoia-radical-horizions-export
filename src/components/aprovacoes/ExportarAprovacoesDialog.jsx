import React, { useEffect, useMemo, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { FORMATOS, exportarAprovacoes, igrejasComInscritos } from '@/utils/exportAprovacoes';
import SeletorIgrejas from './SeletorIgrejas';

const PLURAL_DA_SITUACAO = { pendente: 'pendentes', aprovado: 'aprovadas', rejeitado: 'rejeitadas' };

/**
 * Janela do botao Exportar da Aprovacao de Equipantes: escolhe uma ou mais
 * igrejas (ou todas) e o formato de saida e baixa a lista da aba aberta
 * (pendentes, aprovadas ou rejeitadas) -- para a organizacao mandar para a
 * igreja e cobrar as aprovacoes (Patrick, 07/10/2026). Formatos: ver FORMATOS
 * em utils/exportAprovacoes.js.
 *
 * `dados` ja vem filtrado pela pagina: parceiro so recebe a propria igreja
 * (e o banco tambem so entrega a ela, por RLS), organizador recebe todas.
 */
const ExportarAprovacoesDialog = ({ aberto, onFechar, dados, situacao = 'pendente' }) => {
  const { toast } = useToast();
  const { isParceiro } = useAuth();
  const [escolhidas, setEscolhidas] = useState([]);
  const [formato, setFormato] = useState('excel');
  const [gerando, setGerando] = useState(false);

  const plural = PLURAL_DA_SITUACAO[situacao] || PLURAL_DA_SITUACAO.pendente;
  const igrejas = useMemo(() => igrejasComInscritos(dados), [dados]);
  // O parceiro so tem a propria igreja: ja vai escolhida, sem seletor.
  const selecao = isParceiro ? igrejas.map((i) => i.igreja) : escolhidas;
  const todas = !isParceiro && igrejas.length > 0 && igrejas.every((i) => escolhidas.includes(i.igreja));

  // Cada vez que a janela abre, comeca sem nada marcado. (So quando abre: a
  // lista da tela se atualiza sozinha a cada 30 s e nao pode zerar a escolha.)
  useEffect(() => { if (aberto) setEscolhidas([]); }, [aberto]);

  const exportar = () => {
    if (selecao.length === 0) return;
    setGerando(true);
    try {
      const r = exportarAprovacoes({ dados, igrejas: selecao, todas, formato, situacao });
      toast({
        title: 'Planilha gerada',
        description: `${r.linhas} ${r.linhas === 1 ? 'inscrição' : 'inscrições'} de ${r.igrejas} ${r.igrejas === 1 ? 'igreja' : 'igrejas'}.`,
      });
      onFechar();
    } catch (e) {
      toast({ title: 'Não deu para exportar', description: e.message, variant: 'destructive' });
    } finally {
      setGerando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(abrir) => { if (!abrir) onFechar(); }}>
      <DialogContent className="bg-zinc-900 border border-white/10 text-white sm:max-w-md max-h-[92vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>{isParceiro ? 'Exportar inscrições da sua igreja' : 'Exportar inscrições'}</DialogTitle>
          <DialogDescription className="text-gray-400">
            {isParceiro
              ? `Baixa a planilha das inscrições ${plural} da sua igreja.`
              : `Baixa as inscrições ${plural} das igrejas escolhidas, para enviar a elas.`}
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-4 py-2">
          {isParceiro ? (
            <div className="min-w-0 space-y-2">
              <Label className="text-gray-200">Igreja</Label>
              <div className="rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm">
                {igrejas.length === 0
                  ? <span className="text-white/50">Nenhuma inscrição nesta aba.</span>
                  : igrejas.map((i) => (
                    <div key={i.igreja} className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate">{i.igreja}</span>
                      <span className="shrink-0 tabular-nums text-white/60">{i.quantidade}</span>
                    </div>
                  ))}
              </div>
              <p className="text-xs text-gray-500">O número é quantas inscrições {plural} a sua igreja tem.</p>
            </div>
          ) : (
            <div className="min-w-0 space-y-2">
              <Label className="text-gray-200">Igrejas</Label>
              <SeletorIgrejas
                opcoes={igrejas}
                selecionadas={escolhidas}
                onChange={setEscolhidas}
                rotuloQuantidade={`inscrições ${plural}`}
              />
              <p className="text-xs text-gray-500">
                Digite para buscar e marque quantas quiser. O número ao lado de cada igreja é quantas inscrições {plural} ela tem.
                Com mais de uma igreja, o arquivo vem com uma aba para cada uma.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-gray-200">Formato de saída</Label>
            <Select value={formato} onValueChange={setFormato}>
              <SelectTrigger className="bg-white/10 border-white/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FORMATOS).map(([chave, f]) => (
                  <SelectItem key={chave} value={chave}>{f.rotulo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onFechar} className="bg-transparent border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white">
            Cancelar
          </Button>
          <Button onClick={exportar} disabled={selecao.length === 0 || gerando} className="bg-green-600 hover:bg-green-700 text-white">
            {gerando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Exportar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExportarAprovacoesDialog;
