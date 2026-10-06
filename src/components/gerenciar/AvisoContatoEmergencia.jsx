import React, { useState } from 'react';
import { Loader2, MessageCircle, Pencil, ShieldAlert, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import TelefoneInput from '@/components/inscricao/TelefoneInput';
import { updateAcampante } from '@/services/acampantesService';
import QuadroAviso from './QuadroAviso';
import { problemaTelefone, formatarTelefone, digitosTelefone } from '@/utils/telefone';
import {
  limparNomeContato, problemaNomeContato, mesmoTelefone, AVISO_MESMO_TELEFONE
} from '@/utils/contatoEmergencia';

/**
 * Aviso em Gerenciar Inscricoes: acampantes com o CONTATO DE EMERGENCIA
 * errado -- numero escrito no lugar do nome, ou o proprio WhatsApp repetido
 * como telefone de emergencia (fichas de antes da regra de 06/10/2026).
 *
 * Mesmo jeito do aviso de telefones (AvisoTelefonesAcampantes): a Raquel liga
 * para o acampante, preenche o nome e o telefone certos e salva ali mesmo; a
 * ficha sai do quadro, e sem nenhuma o quadro some. Desenvolvedores ve igual,
 * com o recado de que o aviso e da Raquel. Para os outros logins o servidor
 * devolve null. Os dados vem do useAvisosInscricoes (a pagina), que
 * recarrega a cada 20s e cuida do "Ocultar" (o aviso continua no sino).
 */

const linkWhats = (valor) => {
  const d = digitosTelefone(valor);
  return d.length >= 10 && d.length <= 11 ? `https://wa.me/55${d}` : null;
};

const ItemContato = ({ item, onSalvo, onAbrirFicha, onOcultar }) => {
  const { toast } = useToast();
  const nomeServe = !item.problemas.includes('nome');
  const telServe = !item.problemas.includes('mesmo_telefone')
    && !problemaTelefone(item.contato_emergencia_telefone, { aceitaFixo: true, estrangeiro: item.estrangeiro });
  // O que ja esta certo vem preenchido; o que esta errado vem vazio.
  const [nome, setNome] = useState(nomeServe ? (item.contato_emergencia_nome || '') : '');
  const [telefone, setTelefone] = useState(telServe
    ? (item.estrangeiro ? item.contato_emergencia_telefone : formatarTelefone(digitosTelefone(item.contato_emergencia_telefone)))
    : '');
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    const n = nome.trim();
    if (!n) {
      toast({ title: 'Preencha o nome do contato', variant: 'destructive' });
      return;
    }
    const pNome = problemaNomeContato(n);
    if (pNome) {
      toast({ title: 'Confira o nome do contato', description: pNome, variant: 'destructive' });
      return;
    }
    if (!telefone.trim()) {
      toast({ title: 'Preencha o telefone de emergência', variant: 'destructive' });
      return;
    }
    const pTel = problemaTelefone(telefone, { aceitaFixo: true, estrangeiro: item.estrangeiro });
    if (pTel) {
      toast({ title: 'Confira o telefone de emergência', description: pTel, variant: 'destructive' });
      return;
    }
    if (mesmoTelefone(telefone, item.whatsapp)) {
      toast({ title: 'Confira o telefone de emergência', description: 'Precisa ser de outra pessoa — diferente do WhatsApp do acampante.', variant: 'destructive' });
      return;
    }
    setSalvando(true);
    const r = await updateAcampante(item.id, { contato_emergencia_nome: n, contato_emergencia_telefone: telefone });
    setSalvando(false);
    if (!r.success) {
      toast({ title: 'Não deu para salvar', description: r.error, variant: 'destructive' });
      return;
    }
    toast({ title: 'Contato de emergência corrigido', description: item.nome, className: 'bg-green-600 text-white' });
    onSalvo?.();
  };

  const whatsAcampante = linkWhats(item.whatsapp);

  return (
    <div className="rounded-md border border-orange-500/25 bg-black/30 p-3 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-white font-medium">{item.nome}</p>
          <p className="text-xs text-gray-400">{item.admin_responsavel || item.igreja || 'sem igreja'}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {whatsAcampante && (
            <a
              href={whatsAcampante} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-green-500/40 px-2 h-8 text-xs text-green-300 hover:bg-green-500/10"
              data-dica="Conversar com o acampante no WhatsApp para pedir o contato certo."
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

      <div className="text-xs text-orange-200 space-y-0.5">
        <p>
          Hoje está: nome <strong className="text-white">{item.contato_emergencia_nome || '(vazio)'}</strong>
          {' · '}telefone <strong className="text-white">{item.contato_emergencia_telefone ? formatarTelefone(digitosTelefone(item.contato_emergencia_telefone)) : '(vazio)'}</strong>
        </p>
        {item.problemas.includes('nome') && <p className="text-orange-300/90">— O nome do contato tem números (parece um telefone).</p>}
        {item.problemas.includes('mesmo_telefone') && <p className="text-orange-300/90">— O telefone de emergência é o próprio WhatsApp do acampante.</p>}
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
        <div className="space-y-1">
          <Input
            value={nome}
            onChange={(e) => setNome(limparNomeContato(e.target.value))}
            placeholder="Nome do contato (só letras)"
            className="h-9 bg-white/10 border-white/20 text-white placeholder:text-white/50"
          />
        </div>
        <div className="space-y-1">
          <TelefoneInput
            id={`contato-${item.id}`}
            name="contato_emergencia_telefone"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            aceitaFixo
            estrangeiro={item.estrangeiro}
            placeholder="Telefone do contato"
            className="h-9"
          />
          {mesmoTelefone(telefone, item.whatsapp) && <p className="text-xs text-red-300">{AVISO_MESMO_TELEFONE}</p>}
        </div>
        <Button data-dica="Gravar o contato corrigido. A ficha sai deste quadro." onClick={salvar} disabled={salvando} className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white">
          {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
        </Button>
      </div>
    </div>
  );
};

const AvisoContatoEmergencia = ({ aviso, onRecarregar, onOcultar, onOcultarFicha, onCorrigido, onAbrirFicha }) => {
  // So as fichas que nao foram ocultadas uma a uma.
  const itens = aviso?.visiveis || [];
  if (itens.length === 0 || aviso.oculto) return null;

  return (
    <QuadroAviso
      id="aviso-contatos"
      cor="orange"
      Icone={ShieldAlert}
      titulo={itens.length === 1
        ? '1 acampante está com o contato de emergência errado'
        : `${itens.length} acampantes estão com o contato de emergência errado`}
      explicacao={aviso.perfil === 'desenvolvedores'
        ? 'Este aviso está no perfil da Raquel para ela verificar. Se ela não conseguir, dá para corrigir por aqui também.'
        : 'Número no lugar do nome, ou o próprio telefone do acampante como emergência. Peça o nome e o telefone de outra pessoa e corrija aqui mesmo — ao salvar, a ficha sai deste quadro.'}
      onOcultar={onOcultar}
      ocultas={aviso.fichasOcultas?.length || 0}
    >
      {itens.map((item) => (
        <ItemContato
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

export default AvisoContatoEmergencia;
