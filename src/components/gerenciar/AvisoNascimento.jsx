import React, { useState } from 'react';
import { CalendarX, EyeOff, Loader2, MessageCircle, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import CampoDataNascimento from '@/components/inscricao/CampoDataNascimento';
import { updateAcampante } from '@/services/acampantesService';
import { formatarTelefone, digitosTelefone } from '@/utils/telefone';
import { problemaNascimento } from '@/utils/validacoesInscricao';
import QuadroAviso from './QuadroAviso';

/**
 * Aviso em Gerenciar Inscricoes: acampante SEM DATA DE NASCIMENTO (Patrick,
 * 09/10/2026). A data e obrigatoria -- e dela que sai a idade que a equipe de
 * saude ve e quem precisa de autorizacao dos pais. Fichas de antes da trava
 * entraram sem data; a Raquel pergunta, preenche e salva ali mesmo, e a
 * ficha sai do quadro. Mesmo jeito dos outros avisos (AvisoCamisas).
 */

const hojeISO = () => new Date().toISOString().slice(0, 10);

const linkWhats = (valor) => {
  const d = digitosTelefone(valor);
  return d.length >= 10 && d.length <= 11 ? `https://wa.me/55${d}` : null;
};

const ItemNascimento = ({ item, onSalvo, onAbrirFicha, onOcultar }) => {
  const { toast } = useToast();
  const [data, setData] = useState('');
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    if (!data) {
      toast({ title: 'Informe a data de nascimento', description: 'Digite no formato dd/mm/aaaa.', variant: 'destructive' });
      return;
    }
    const problema = problemaNascimento(data);
    if (problema) {
      toast({ title: 'Confira a data de nascimento', description: problema, variant: 'destructive' });
      return;
    }
    setSalvando(true);
    const r = await updateAcampante(item.id, { data_nascimento: data });
    setSalvando(false);
    if (!r.success) {
      toast({ title: 'Não deu para salvar', description: r.error, variant: 'destructive' });
      return;
    }
    toast({ title: 'Data de nascimento salva', description: item.nome, className: 'bg-green-600 text-white' });
    onSalvo?.();
  };

  const whatsAcampante = linkWhats(item.whatsapp);

  return (
    <div className="rounded-md border border-red-500/25 bg-black/30 p-3 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-white font-medium">{item.nome}</p>
          <p className="text-xs text-gray-400">
            {item.admin_responsavel || item.igreja || 'sem igreja'}{item.sexo ? ` · ${item.sexo}` : ''}
            {' · '}{item.pago ? 'confirmado (pago)' : 'só inscrito'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {whatsAcampante && (
            <a
              href={whatsAcampante} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-green-500/40 px-2 h-8 text-xs text-green-300 hover:bg-green-500/10"
              data-dica="Conversar com o acampante no WhatsApp para perguntar a data de nascimento."
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
        <p className="text-xs text-red-200">Data de nascimento: <strong className="text-white">não informada</strong></p>
        <div className="flex items-center gap-2 ml-auto">
          <div className="w-40">
            <CampoDataNascimento
              id={`nasc-${item.id}`}
              max={hojeISO()}
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="h-9 bg-white/10 border-white/20 text-white [color-scheme:dark]"
            />
          </div>
          <Button data-dica="Gravar a data. A ficha sai deste quadro." onClick={salvar} disabled={salvando} className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white">
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
          </Button>
        </div>
      </div>
    </div>
  );
};

const AvisoNascimento = ({ aviso, onRecarregar, onOcultar, onOcultarFicha, onCorrigido, onAbrirFicha }) => {
  const itens = aviso?.visiveis || [];
  if (itens.length === 0 || aviso.oculto) return null;

  return (
    <QuadroAviso
      id="aviso-nascimento"
      cor="red"
      Icone={CalendarX}
      titulo={itens.length === 1
        ? '1 acampante está sem data de nascimento (obrigatória)'
        : `${itens.length} acampantes estão sem data de nascimento (obrigatória)`}
      explicacao={aviso.perfil === 'desenvolvedores'
        ? 'Este aviso está no perfil da Raquel para ela verificar. Se ela não conseguir, dá para corrigir por aqui também.'
        : 'Sem a data não há idade — a equipe de saúde precisa dela, e é ela que diz quem é menor. Pergunte ao acampante e preencha aqui mesmo: ao salvar, a ficha sai deste quadro.'}
      onOcultar={onOcultar}
      ocultas={aviso.fichasOcultas?.length || 0}
    >
      {itens.map((item) => (
        <ItemNascimento
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

export default AvisoNascimento;
