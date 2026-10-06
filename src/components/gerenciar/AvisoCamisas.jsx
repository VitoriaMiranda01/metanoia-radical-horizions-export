import React, { useState } from 'react';
import { EyeOff, Loader2, MessageCircle, Pencil, Shirt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { updateAcampante } from '@/services/acampantesService';
import { formatarTelefone, digitosTelefone } from '@/utils/telefone';
import QuadroAviso from './QuadroAviso';

/**
 * Aviso em Gerenciar Inscricoes: acampante SEM TAMANHO DE CAMISA (fichas de
 * antes da camisa virar obrigatoria, 06/10/2026). Mesmo jeito dos outros
 * avisos: a Raquel pergunta o tamanho, escolhe e salva ali mesmo; a ficha
 * sai do quadro. Os dados vem do useAvisosInscricoes (a pagina).
 */

const TAMANHOS = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG'];

const linkWhats = (valor) => {
  const d = digitosTelefone(valor);
  return d.length >= 10 && d.length <= 11 ? `https://wa.me/55${d}` : null;
};

const ItemCamisa = ({ item, onSalvo, onAbrirFicha, onOcultar }) => {
  const { toast } = useToast();
  const [tamanho, setTamanho] = useState('');
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    if (!tamanho) {
      toast({ title: 'Escolha o tamanho da camisa', variant: 'destructive' });
      return;
    }
    setSalvando(true);
    const r = await updateAcampante(item.id, { tamanho_camisa: tamanho });
    setSalvando(false);
    if (!r.success) {
      toast({ title: 'Não deu para salvar', description: r.error, variant: 'destructive' });
      return;
    }
    toast({ title: `Camisa ${tamanho} anotada`, description: item.nome, className: 'bg-green-600 text-white' });
    onSalvo?.();
  };

  const whatsAcampante = linkWhats(item.whatsapp);

  return (
    <div className="rounded-md border border-purple-500/25 bg-black/30 p-3 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-white font-medium">{item.nome}</p>
          <p className="text-xs text-gray-400">{item.admin_responsavel || item.igreja || 'sem igreja'}{item.sexo ? ` · ${item.sexo}` : ''}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {whatsAcampante && (
            <a
              href={whatsAcampante} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-green-500/40 px-2 h-8 text-xs text-green-300 hover:bg-green-500/10"
              data-dica="Conversar com o acampante no WhatsApp para perguntar o tamanho."
            >
              <MessageCircle className="w-3.5 h-3.5" /> {formatarTelefone(digitosTelefone(item.whatsapp))}
            </a>
          )}
          <Button
            size="sm" variant="outline" onClick={() => onAbrirFicha?.(item.id)}
            data-dica="Abrir a ficha completa deste acampante para editar."
            className="h-8 border-white/20 bg-transparent text-gray-300 hover:bg-white/10 hover:text-white"
          >
            <Pencil className="w-3.5 h-3.5 mr-1" /> Abrir ficha
          </Button>
          {onOcultar && (
            <Button
              size="sm" variant="ghost" onClick={onOcultar}
              data-dica="Ocultar só esta ficha. Ela continua no sino de notificações, de onde dá para trazer de volta."
              className="h-8 px-2 text-gray-500 hover:text-white hover:bg-white/10"
            >
              <EyeOff className="w-3.5 h-3.5 mr-1" /> Ocultar
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-purple-200">Tamanho da camisa: <strong className="text-white">não informado</strong></p>
        <div className="flex items-center gap-2 ml-auto">
          <Select value={tamanho} onValueChange={setTamanho}>
            <SelectTrigger className="h-9 w-32 bg-white/10 border-white/20 text-white">
              <SelectValue placeholder="Tamanho" />
            </SelectTrigger>
            <SelectContent>
              {TAMANHOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button data-dica="Gravar o tamanho. A ficha sai deste quadro." onClick={salvar} disabled={salvando} className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white">
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
          </Button>
        </div>
      </div>
    </div>
  );
};

const AvisoCamisas = ({ aviso, onRecarregar, onOcultar, onOcultarFicha, onCorrigido, onAbrirFicha }) => {
  // So as fichas que nao foram ocultadas uma a uma.
  const itens = aviso?.visiveis || [];
  if (itens.length === 0 || aviso.oculto) return null;

  return (
    <QuadroAviso
      id="aviso-camisas"
      cor="purple"
      Icone={Shirt}
      titulo={itens.length === 1
        ? '1 acampante está sem tamanho de camisa'
        : `${itens.length} acampantes estão sem tamanho de camisa`}
      explicacao={aviso.perfil === 'desenvolvedores'
        ? 'Este aviso está no perfil da Raquel para ela verificar. Se ela não conseguir, dá para corrigir por aqui também.'
        : 'Inscrição de antes da camisa virar obrigatória. Pergunte o tamanho e escolha aqui mesmo — ao salvar, a ficha sai deste quadro.'}
      onOcultar={onOcultar}
      ocultas={aviso.fichasOcultas?.length || 0}
    >
      {itens.map((item) => (
        <ItemCamisa
          key={item.id}
          item={item}
          onAbrirFicha={onAbrirFicha}
          onOcultar={onOcultarFicha ? () => onOcultarFicha(item.id) : undefined}
          onSalvo={() => { onRecarregar?.(); onCorrigido?.(); }}
        />
      ))}
    </QuadroAviso>
  );
};

export default AvisoCamisas;
