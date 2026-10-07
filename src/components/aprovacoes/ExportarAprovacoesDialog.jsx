import React, { useMemo, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { FORMATOS, exportarAprovacoesDaIgreja, igrejasComInscritos } from '@/utils/exportAprovacoes';

const TEXTO_DA_SITUACAO = {
  pendente: { plural: 'pendentes', ficha: 'pendente' },
  aprovado: { plural: 'aprovadas', ficha: 'aprovada' },
  rejeitado: { plural: 'rejeitadas', ficha: 'rejeitada' },
};

/**
 * Janela do botao Exportar da Aprovacao de Equipantes: escolhe a igreja e o
 * formato de saida e baixa a lista da aba aberta (pendentes, aprovadas ou
 * rejeitadas) so daquela igreja -- para a organizacao mandar para ela e cobrar
 * as aprovacoes (Patrick, 07/10/2026). Formatos: ver FORMATOS em
 * utils/exportAprovacoes.js.
 */
const ExportarAprovacoesDialog = ({ aberto, onFechar, dados, situacao = 'pendente' }) => {
  const { toast } = useToast();
  const [igreja, setIgreja] = useState('');
  const [formato, setFormato] = useState('excel');
  const [gerando, setGerando] = useState(false);

  const textos = TEXTO_DA_SITUACAO[situacao] || TEXTO_DA_SITUACAO.pendente;
  const igrejas = useMemo(() => igrejasComInscritos(dados), [dados]);
  const escolhida = igrejas.find((i) => i.igreja === igreja);

  const exportar = () => {
    if (!escolhida) return;
    setGerando(true);
    try {
      const total = exportarAprovacoesDaIgreja({ dados, igreja, formato, situacao });
      toast({
        title: 'Planilha gerada',
        description: `${total} ${total === 1 ? 'inscrição' : 'inscrições'} de ${igreja}.`,
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
      <DialogContent className="bg-zinc-900 border border-white/10 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar inscrições</DialogTitle>
          <DialogDescription className="text-gray-400">
            Baixa as inscrições {textos.plural} da igreja escolhida, para enviar a ela.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-gray-200">Igreja</Label>
            <Select value={igreja} onValueChange={setIgreja}>
              <SelectTrigger className="bg-white/10 border-white/20 text-white">
                <SelectValue placeholder={igrejas.length ? 'Escolha a igreja' : 'Nenhuma inscrição nesta aba'} />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {igrejas.map((i) => (
                  <SelectItem key={i.igreja} value={i.igreja}>
                    {i.igreja} ({i.quantidade})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              O número entre parênteses é quantas inscrições {textos.plural} a igreja tem.
            </p>
          </div>

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
          <Button onClick={exportar} disabled={!escolhida || gerando} className="bg-green-600 hover:bg-green-700 text-white">
            {gerando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Exportar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExportarAprovacoesDialog;
