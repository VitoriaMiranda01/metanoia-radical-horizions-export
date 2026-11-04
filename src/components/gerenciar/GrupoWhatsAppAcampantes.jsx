import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, MessageCircle } from 'lucide-react';
import { verGrupoAcampantes, definirGrupoAcampantes } from '@/services/acampantesService';

/**
 * Link do grupo de WhatsApp dos acampantes (Patrick, 04/11/2026, migration
 * 20261104d). Um link geral por edicao. O acampante so ve o botao "Entrar no
 * grupo" depois que o pagamento esta confirmado (tela de confirmacao do PIX e
 * consulta pelo CPF). Gravar exige a caixa "Gerenciar inscricoes"; sem ela o
 * organizador so ve.
 */
const dataHora = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
}) : '');

const GrupoWhatsAppAcampantes = () => {
  const { toast } = useToast();
  const [info, setInfo] = useState(null); // resposta de grupo_acampantes_ver
  const [aberto, setAberto] = useState(false);
  const [link, setLink] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    const r = await verGrupoAcampantes();
    setInfo(r?.ok ? r : null);
    return r;
  };
  useEffect(() => { carregar(); }, []);

  if (!info) return null;

  const abrir = () => { setLink(info.link || ''); setAberto(true); };

  const salvar = async (valor) => {
    setSalvando(true);
    const r = await definirGrupoAcampantes(valor);
    setSalvando(false);
    if (!r?.ok) {
      toast({ title: 'Não foi possível salvar', description: r?.erro, variant: 'destructive' });
      return;
    }
    await carregar();
    setAberto(false);
    toast({
      title: r.link ? 'Link do grupo salvo' : 'Link do grupo removido',
      description: r.link
        ? 'Os acampantes com pagamento confirmado já veem o botão para entrar no grupo.'
        : 'Os acampantes deixam de ver o botão do grupo.',
      className: 'bg-emerald-600 text-white',
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={abrir}
        data-dica="O link do grupo de WhatsApp que aparece para o acampante depois que o pagamento é confirmado."
        className="bg-black border-2 border-green-500 text-green-400 font-semibold hover:bg-green-600 hover:text-black"
      >
        <MessageCircle className="w-4 h-4 mr-2" />
        {info.link ? 'Grupo do WhatsApp dos acampantes' : 'Cadastrar grupo do WhatsApp dos acampantes'}
      </Button>

      <Dialog open={aberto} onOpenChange={(v) => !salvando && setAberto(v)}>
        <DialogContent className="bg-gray-900 border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Grupo do WhatsApp dos acampantes</DialogTitle>
            <DialogDescription className="text-gray-300">
              Um link só, para todos os acampantes da {info.edicao}ª edição. Ele aparece como o botão
              “Entrar no grupo do WhatsApp” só para quem já está com o pagamento confirmado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="linkGrupoAcampantes" className="text-white">Link de convite do grupo</Label>
            <Input
              id="linkGrupoAcampantes"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              disabled={!info.pode_editar || salvando}
              placeholder="https://chat.whatsapp.com/..."
              className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
            />
            <p className="text-xs text-gray-400">
              No WhatsApp: abra o grupo → nome do grupo → “Convidar via link” → “Copiar link”.
            </p>
            {info.link && (
              <p className="text-xs text-gray-400">
                Salvo por {info.atualizado_por || '—'} em {dataHora(info.atualizado_em)}.{' '}
                <a href={info.link} target="_blank" rel="noreferrer" className="text-blue-300 underline">Testar o link</a>
              </p>
            )}
            {!info.pode_editar && (
              <p className="text-xs text-amber-300">Você não tem permissão para mudar o link. Peça aos Desenvolvedores.</p>
            )}
          </div>

          {info.pode_editar && (
            <DialogFooter className="gap-2 sm:gap-2">
              {info.link && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={salvando}
                  onClick={() => salvar('')}
                  className="border-red-500/50 text-red-300 hover:bg-red-500/10"
                >
                  Remover link
                </Button>
              )}
              <Button
                type="button"
                disabled={salvando || !link.trim() || link.trim() === info.link}
                onClick={() => salvar(link)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default GrupoWhatsAppAcampantes;
