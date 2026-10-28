import React, { useCallback, useEffect, useState } from 'react';
import { CheckCheck, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { linkWhatsApp } from '@/services/liderService';
import { fetchMensagensChamada, registrarMensagemChamada } from '@/services/scalesService';

/**
 * Mensagem pelo WhatsApp para quem ficou ausente ou sem chamada na reuniao de
 * escala (28/10/2026, Patrick). O botao abre o WhatsApp de quem esta mexendo
 * com o texto pronto; quem aperta enviar e o organizador.
 *
 * Referencia de 40 a cada 24h por login (migration 20261028c): mensagens em
 * sequencia para quem nao tem o numero salvo travaram o WhatsApp de varios
 * lideres no convite do grupo -- com ou sem link, o risco e o mesmo. So AVISA,
 * nao trava (20261028d): varias pessoas usam o login de Desenvolvedores, cada
 * uma com o proprio WhatsApp.
 */

const CHAVE_NOME = 'chamada_mensagem_remetente';
// Contas que nao sao uma pessoa: nao entram na mensagem como "Aqui é ...".
const CONTAS_GENERICAS = ['desenvolvedores'];

const dataHora = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

export const textoMensagem = (p, tipo, remetente) => {
  const primeiro = String(p.nome || '').trim().split(/\s+/)[0] || '';
  const quem = String(remetente || '').trim();
  const situacao = tipo === 'sem'
    ? 'Não encontramos a sua presença registrada na chamada da reunião de leitura da escala.'
    : 'Você ficou como ausente na chamada da reunião de leitura da escala.';
  return `Olá, ${primeiro}! Aqui é ${quem ? `${quem}, ` : ''}da organização do Metanoia Radical Serra. ${situacao} `
    + 'Precisamos saber se você realmente vai servir nesta edição ou não. Pode nos responder, por favor?';
};

export const useMensagensChamada = () => {
  const { toast } = useToast();
  const [estado, setEstado] = useState(null);
  const [remetente, setRemetenteState] = useState(() => {
    try { return localStorage.getItem(CHAVE_NOME) || ''; } catch { return ''; }
  });

  const recarregar = useCallback(async () => {
    const r = await fetchMensagensChamada();
    if (!r.success) return;
    setEstado(r.data);
    // Primeira vez neste navegador: sugere o nome da conta (se for de uma pessoa).
    setRemetenteState((atual) => {
      if (atual) return atual;
      const nome = r.data.remetente || '';
      return CONTAS_GENERICAS.includes(nome.trim().toLowerCase()) ? '' : nome;
    });
  }, []);

  useEffect(() => { recarregar(); }, [recarregar]);

  const setRemetente = (v) => {
    setRemetenteState(v);
    try { localStorage.setItem(CHAVE_NOME, v); } catch { /* sem storage */ }
  };

  const envios = estado?.envios;
  const passou = !!envios && Number(envios.usados) >= Number(envios.limite);

  // Abre o WhatsApp na hora (depois de um await o navegador bloquearia a
  // janela) e registra em seguida.
  const enviar = async (p, tipo) => {
    const link = linkWhatsApp(p.whatsapp, false, textoMensagem(p, tipo, remetente));
    if (!link) {
      toast({ title: 'Telefone inválido', description: `${p.nome} não tem um WhatsApp válido na ficha.`, variant: 'destructive' });
      return;
    }
    window.open(link, '_blank', 'noopener,noreferrer');
    const r = await registrarMensagemChamada(p.escala_id, tipo);
    if (!r.success) toast({ title: 'Mensagem não registrada', description: r.error, variant: 'destructive' });
    recarregar();
  };

  return { estado, envios, passou, remetente, setRemetente, enviar, enviadas: estado?.enviadas || {} };
};

// Barra acima das listas: o nome que vai na mensagem e a conta do limite.
export const RemetenteMensagem = ({ mensagens }) => {
  const { envios, passou, remetente, setRemetente } = mensagens;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-md border border-green-500/20 bg-green-500/5 px-3 py-2 mb-3">
      <MessageCircle className="h-4 w-4 text-green-400 shrink-0 hidden sm:block" />
      <label className="text-xs text-gray-300 shrink-0" htmlFor="chamada-remetente">Seu nome na mensagem:</label>
      <Input id="chamada-remetente" value={remetente} onChange={(e) => setRemetente(e.target.value)}
        placeholder="Ex.: Raquel" maxLength={40}
        className="h-8 bg-black/40 border-white/20 text-white sm:w-48" />
      {envios && (
        <span className={cn('text-[11px] sm:ml-auto', passou ? 'text-amber-300 font-medium' : 'text-gray-400')}
          data-dica={`Contado por login (todos que usam esta conta juntos). Acima de ${envios.limite} em 24 horas, o WhatsApp de quem está enviando pode travar por spam. Não bloqueia: só avisa.`}>
          {passou
            ? `⚠ Este login já mandou ${envios.usados} mensagens em 24 h (referência: ${envios.limite}). Cuidado: o WhatsApp pode travar o seu número.`
            : `${envios.usados} de ${envios.limite} mensagens nas últimas 24 h (este login)`}
        </span>
      )}
    </div>
  );
};

export const BotaoMensagem = ({ p, tipo, mensagens }) => {
  const { enviar, enviadas } = mensagens;
  const ja = enviadas[p.escala_id];
  return (
    <Button size="sm" variant="outline" onClick={() => enviar(p, tipo)} disabled={!p.whatsapp}
      data-dica={ja
        ? `Mensagem já enviada ${dataHora(ja.em)}${ja.por ? ` por ${ja.por}` : ''}${ja.vezes > 1 ? ` (${ja.vezes} vezes)` : ''}. Clique para mandar de novo.`
        : 'Abrir o WhatsApp com a mensagem pronta perguntando se a pessoa vai nesta edição.'}
      className={cn('h-8 bg-transparent',
        ja ? 'border-white/20 text-gray-400 hover:bg-white/10 hover:text-white'
          : 'border-green-500/40 text-green-300 hover:bg-green-500/15 hover:text-green-200')}>
      {ja ? <CheckCheck className="h-3.5 w-3.5 mr-1" /> : <MessageCircle className="h-3.5 w-3.5 mr-1" />}
      {ja ? 'Mensagem enviada' : 'Mensagem'}
    </Button>
  );
};
