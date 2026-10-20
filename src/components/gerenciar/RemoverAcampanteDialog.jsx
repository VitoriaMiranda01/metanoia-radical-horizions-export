import React, { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, Trash2, UserMinus } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { bloqueioDeSaida, desistirAcampante, excluirAcampanteDefinitivo } from '@/services/desistenciaService';

/**
 * Remover acampante (20/10/2026, Patrick): o organizador escolhe o motivo.
 *  1) Desistiu da edicao -> vai para o arquivo de desistentes (recuperavel).
 *  2) Excluir completamente -> nada fica no sistema (nome digitado + motivo).
 * As regras de verdade sao do banco (desistir_acampante /
 * excluir_acampante_definitivo); aqui so se avisa antes.
 *
 * acampante: { id, nome, status_pagamento, metodo_pagamento } ou null.
 */
const semAcento = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

const Opcao = ({ ativa, onClick, cor, icone: Icone, titulo, children }) => (
  <button type="button" onClick={onClick}
    className={cn('w-full text-left rounded-lg border p-3 transition-colors',
      ativa
        ? (cor === 'red' ? 'border-red-500/60 bg-red-500/10' : 'border-amber-500/60 bg-amber-500/10')
        : 'border-white/10 bg-white/5 hover:bg-white/10')}>
    <span className="flex items-start gap-3">
      <span className={cn('mt-0.5 h-4 w-4 shrink-0 rounded-full border-2',
        ativa ? (cor === 'red' ? 'border-red-400 bg-red-400' : 'border-amber-400 bg-amber-400') : 'border-gray-500')} />
      <span className="space-y-1 min-w-0">
        <span className={cn('flex items-center gap-2 font-semibold', cor === 'red' ? 'text-red-200' : 'text-amber-200')}>
          <Icone className="h-4 w-4" /> {titulo}
        </span>
        <span className="block text-sm text-gray-300">{children}</span>
      </span>
    </span>
  </button>
);

const RemoverAcampanteDialog = ({ acampante, onClose, onRemovido }) => {
  const { toast } = useToast();
  const [opcao, setOpcao] = useState(null); // 'desistencia' | 'exclusao'
  const [observacao, setObservacao] = useState('');
  const [motivo, setMotivo] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    setOpcao(null); setObservacao(''); setMotivo(''); setConfirmacao(''); setEnviando(false);
  }, [acampante?.id]);

  const bloqueio = bloqueioDeSaida(acampante);
  const nomeConfere = !!acampante?.nome && semAcento(confirmacao) === semAcento(acampante.nome);
  const pode = !bloqueio && !enviando && (
    opcao === 'desistencia' || (opcao === 'exclusao' && nomeConfere && motivo.trim().length >= 3));

  const executar = async () => {
    setEnviando(true);
    const r = opcao === 'desistencia'
      ? await desistirAcampante(acampante.id, observacao.trim())
      : await excluirAcampanteDefinitivo(acampante.id, confirmacao, motivo.trim());
    setEnviando(false);
    if (!r.ok) {
      toast({ title: 'Não foi removido', description: r.erro, variant: 'destructive' });
      return;
    }
    toast(opcao === 'desistencia'
      ? { title: `${r.nome} saiu da edição`, description: 'Os dados ficaram guardados em Configurações → Acampantes que desistiram.' }
      : { title: `Cadastro de ${r.nome} excluído`, description: 'Os dados foram retirados do sistema.' });
    onRemovido?.();
    onClose();
  };

  return (
    <Dialog open={!!acampante} onOpenChange={(v) => { if (!v && !enviando) onClose(); }}>
      <DialogContent className="bg-zinc-900 border border-gray-800 text-white max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Remover inscrição</DialogTitle>
          <DialogDescription className="text-gray-400">
            Por que <strong className="text-white">{acampante?.nome}</strong> vai sair?
          </DialogDescription>
        </DialogHeader>

        {bloqueio ? (
          <p className="text-sm text-amber-200 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {bloqueio}
          </p>
        ) : (
          <div className="space-y-3">
            <Opcao ativa={opcao === 'desistencia'} onClick={() => setOpcao('desistencia')} cor="amber" icone={UserMinus}
              titulo="O acampante desistiu de participar da edição">
              Ele deixa de aparecer em todas as telas, mas os dados ficam guardados e dá para recuperar
              (Configurações → Acampantes que desistiram). Se ele se inscrever de novo, os dados pessoais e o
              endereço voltam preenchidos; o resto é preenchido de novo. Os dados são apagados sozinhos
              180 dias depois da inscrição.
            </Opcao>
            {opcao === 'desistencia' && (
              <div className="space-y-1.5 pl-7">
                <Label className="text-gray-300">Observação (opcional)</Label>
                <Input value={observacao} onChange={(e) => setObservacao(e.target.value)} maxLength={200}
                  placeholder="Ex.: avisou pelo WhatsApp que não vai mais"
                  className="bg-black/40 border-white/20 text-white" />
              </div>
            )}

            <Opcao ativa={opcao === 'exclusao'} onClick={() => setOpcao('exclusao')} cor="red" icone={Trash2}
              titulo="Excluir o cadastro completamente">
              Retira todos os dados desta pessoa do sistema. Não tem volta.
            </Opcao>
            {opcao === 'exclusao' && (
              <div className="space-y-3 pl-7">
                <div className="space-y-1.5">
                  <Label className="text-gray-300">Motivo</Label>
                  <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200}
                    placeholder="Ex.: cadastro feito por engano; pediu a exclusão dos dados"
                    className="bg-black/40 border-white/20 text-white" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-gray-300">Para confirmar, digite o nome completo: <strong className="text-white">{acampante?.nome}</strong></Label>
                  <Input value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} placeholder="Nome completo"
                    className={cn('bg-black/40 text-white', confirmacao && !nomeConfere ? 'border-red-500/60' : 'border-white/20')} />
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={enviando}
            className="bg-transparent border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white">
            Cancelar
          </Button>
          {!bloqueio && (
            <Button onClick={executar} disabled={!pode}
              className={opcao === 'exclusao' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-amber-600 hover:bg-amber-700 text-white'}>
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" />
                : opcao === 'exclusao' ? 'Excluir completamente' : 'Confirmar desistência'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RemoverAcampanteDialog;
