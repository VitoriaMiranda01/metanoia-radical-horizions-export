import React, { useState } from 'react';
import { Loader2, MessageCircle, PhoneOff, Pencil, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import TelefoneInput from '@/components/inscricao/TelefoneInput';
import { updateAcampante } from '@/services/acampantesService';
import QuadroAviso from './QuadroAviso';
import { problemaTelefone, formatarTelefone, digitosTelefone } from '@/utils/telefone';

/**
 * Aviso em Gerenciar Inscricoes: acampantes com o telefone de emergencia (ou
 * o WhatsApp) fora do padrao -- fichas de antes da protecao de 03/10/2026.
 *
 * A Raquel liga e corrige ali mesmo (campo + Salvar, ou "Abrir ficha"). A
 * conta Desenvolvedores ve o mesmo quadro, com o recado de que e a Raquel
 * quem esta cuidando. Para os outros logins o servidor devolve null.
 *
 * Quem decide o que esta errado e o banco (mesma regra do cadastro). Corrigiu,
 * a ficha sai do quadro na hora; sem nenhuma, o quadro some. Os dados vem do
 * useAvisosInscricoes (a pagina), que recarrega a cada 20s e cuida do
 * "Ocultar" -- o aviso oculto continua no sino de notificacoes.
 */

const ROTULO = {
  contato_emergencia_telefone: 'Telefone de emergência',
  whatsapp: 'WhatsApp do acampante',
};

const linkWhats = (valor) => {
  const d = digitosTelefone(valor);
  return d.length >= 10 && d.length <= 11 ? `https://wa.me/55${d}` : null;
};

const ItemAcampante = ({ item, onSalvo, onAbrirFicha, onOcultar }) => {
  const { toast } = useToast();
  const [valores, setValores] = useState({});
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    const alterados = {};
    for (const campo of item.campos) {
      const v = (valores[campo] || '').trim();
      if (!v) continue;
      const problema = problemaTelefone(v, {
        aceitaFixo: campo !== 'whatsapp', estrangeiro: item.estrangeiro,
      });
      if (problema) {
        toast({ title: `Confira o ${ROTULO[campo].toLowerCase()}`, description: problema, variant: 'destructive' });
        return;
      }
      alterados[campo] = v;
    }
    if (Object.keys(alterados).length === 0) {
      toast({ title: 'Digite o número correto', description: 'Preencha o campo antes de salvar.', variant: 'destructive' });
      return;
    }
    setSalvando(true);
    const r = await updateAcampante(item.id, alterados);
    setSalvando(false);
    if (!r.success) {
      toast({
        title: 'Não deu para salvar',
        description: String(r.error || '').includes('TELEFONE_INVALIDO')
          ? 'O número está incompleto ou com dígitos a mais. Ex.: (21) 99999-9999.'
          : r.error,
        variant: 'destructive',
      });
      return;
    }
    toast({ title: 'Telefone corrigido', description: item.nome, className: 'bg-green-600 text-white' });
    onSalvo?.();
  };

  const whatsAcampante = linkWhats(item.whatsapp);

  return (
    <div className="rounded-md border border-amber-500/25 bg-black/30 p-3 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-white font-medium">{item.nome}</p>
          <p className="text-xs text-gray-400">
            {item.admin_responsavel || item.igreja || 'sem igreja'}
            {item.contato_emergencia_nome ? ` · emergência: ${item.contato_emergencia_nome}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {whatsAcampante && (
            <a
              href={whatsAcampante} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-green-500/40 px-2 h-8 text-xs text-green-300 hover:bg-green-500/10"
              title="Conversar com o acampante no WhatsApp"
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

      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="grid gap-2 sm:grid-cols-2">
          {item.campos.map((campo) => {
            const atual = item[campo];
            const problema = problemaTelefone(atual, {
              aceitaFixo: campo !== 'whatsapp', estrangeiro: item.estrangeiro,
            }) || (atual ? null : 'Não informado.');
            return (
              <div key={campo} className="space-y-1">
                <p className="text-xs text-amber-200">
                  {ROTULO[campo]}: <strong className="text-white">{atual || '(vazio)'}</strong>
                  {problema ? <span className="text-amber-300/80"> — {problema.replace(/\s*Ex\.:.*$/, '')}</span> : null}
                </p>
                <TelefoneInput
                  id={`aviso-${item.id}-${campo}`}
                  name={campo}
                  value={valores[campo] || ''}
                  onChange={(e) => setValores((v) => ({ ...v, [campo]: e.target.value }))}
                  aceitaFixo={campo !== 'whatsapp'}
                  estrangeiro={item.estrangeiro}
                  placeholder="Número correto"
                  className="h-9"
                />
              </div>
            );
          })}
        </div>
        <Button data-dica="Gravar o número corrigido. A ficha sai deste quadro." onClick={salvar} disabled={salvando} className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white">
          {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
        </Button>
      </div>
    </div>
  );
};

const AvisoTelefonesAcampantes = ({ aviso, onRecarregar, onOcultar, onOcultarFicha, onCorrigido, onAbrirFicha }) => {
  // So as fichas que nao foram ocultadas uma a uma.
  const itens = aviso?.visiveis || [];
  if (itens.length === 0 || aviso.oculto) return null;

  return (
    <QuadroAviso
      id="aviso-telefones"
      cor="amber"
      Icone={PhoneOff}
      titulo={itens.length === 1
        ? '1 acampante está com telefone fora do padrão'
        : `${itens.length} acampantes estão com telefone fora do padrão`}
      explicacao={aviso.perfil === 'desenvolvedores'
        ? 'Este aviso está no perfil da Raquel para ela verificar. Se ela não conseguir, dá para corrigir por aqui também.'
        : 'Entre em contato com cada um e corrija aqui mesmo. Assim que salvar, a ficha sai deste quadro.'}
      onOcultar={onOcultar}
      ocultas={aviso.fichasOcultas?.length || 0}
    >
      {itens.map((item) => (
        <ItemAcampante
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

export default AvisoTelefonesAcampantes;
