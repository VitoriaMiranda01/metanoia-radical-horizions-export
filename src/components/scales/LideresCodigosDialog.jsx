import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, KeyRound, Loader2, Lock, MessageCircle, RefreshCw, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { casaBusca } from '@/utils/busca';
import { formatarTelefone } from '@/utils/telefone';
import { fetchCodigosLideres, gerarNovoCodigoLider } from '@/services/scalesService';
import { linkWhatsApp } from '@/services/liderService';

const SITE = 'https://metanoiaradicalserra.com.br/equipante';

const mensagem = (lider) => {
  const areas = (lider.areas || []).map((a) => `${a.area}${a.cor ? ` (${a.cor})` : ''}`).join(', ');
  return `Olá, ${(lider.nome || '').split(' ')[0]}! Você é líder de ${areas} no Metanoia Radical Serra.\n\n`
    + `Na reunião de escala, entre em ${SITE}, abra o acompanhamento da sua inscrição com o seu CPF `
    + `e toque em "Abrir minha equipe". Use o código de líder: *${lider.codigo}*\n\n`
    + 'Lá você faz a chamada da sua equipe. Não passe este código para ninguém.';
};

/**
 * Os codigos de 6 digitos com que cada lider abre a relacao da equipe no
 * acompanhamento (05/10/2026). Quem vira lider na escala ganha um codigo
 * sozinho, na primeira vez que esta janela abre. O organizador copia ou
 * manda pelo WhatsApp; "Novo código" invalida o anterior (lider que passou
 * o codigo adiante, ou que travou de tanto errar).
 */
const LideresCodigosDialog = ({ onClose }) => {
  const { toast } = useToast();
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [gerando, setGerando] = useState({});

  const carregar = async () => {
    setCarregando(true);
    const r = await fetchCodigosLideres();
    setCarregando(false);
    if (r.success) { setItens(r.data.itens || []); setErro(''); }
    else setErro(r.error);
  };

  useEffect(() => { carregar(); }, []);

  useEffect(() => {
    const aoTeclar = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onClose]);

  const filtrados = useMemo(() => itens.filter((l) =>
    casaBusca(busca, [l.nome, l.whatsapp, ...(l.areas || []).map((a) => `${a.area} ${a.cor || ''}`)])), [itens, busca]);

  const copiar = async (texto, rotulo) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast({ title: rotulo, className: 'bg-green-600 text-white' });
    } catch {
      toast({ title: 'Não consegui copiar', variant: 'destructive' });
    }
  };

  const novoCodigo = async (lider) => {
    setGerando((g) => ({ ...g, [lider.equipante_id]: true }));
    const r = await gerarNovoCodigoLider(lider.equipante_id);
    setGerando((g) => ({ ...g, [lider.equipante_id]: false }));
    if (!r.success) {
      toast({ title: 'Não foi possível gerar', description: r.error, variant: 'destructive' });
      return;
    }
    toast({ title: `Novo código de ${lider.nome}: ${r.data.codigo}`, description: 'O código antigo deixou de valer.' });
    carregar();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}>
      <div className="w-full max-w-3xl bg-zinc-900 border border-white/10 rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-amber-400" /> Líderes e códigos ({itens.length})
          </h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-xs text-gray-400">
            Cada líder abre a relação da equipe no acompanhamento da inscrição, com o CPF dele e este código.
            Quem aparece aqui é quem está com a atuação de líder na escala.
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar líder ou área..."
                className="pl-8 bg-black/40 border-white/20 text-white" />
            </div>
            <Button variant="outline" onClick={carregar} disabled={carregando} data-dica="Recarregar a lista de líderes."
              className="border-white/20 bg-transparent text-gray-300 hover:bg-white/10 hover:text-white">
              {carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </div>

          {erro && <p className="text-sm text-red-400">{erro}</p>}
          {!carregando && !erro && itens.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-6">
              Ninguém está como líder na escala ainda. Escolha o líder de cada área na coluna Atuação.
            </p>
          )}

          <div className="space-y-2 max-h-[28rem] overflow-y-auto overflow-x-hidden pr-1">
            {filtrados.map((l) => {
              const zap = linkWhatsApp(l.whatsapp, false, mensagem(l));
              return (
                <div key={l.equipante_id} className="bg-white/5 border border-white/10 rounded-md p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{l.nome}</p>
                    <p className="text-[11px] text-gray-400 truncate">
                      {(l.areas || []).map((a) => `${a.area}${a.cor ? ` · ${a.cor}` : ''}`).join(' / ')}
                      {l.whatsapp ? ` · ${formatarTelefone(l.whatsapp)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap sm:justify-end">
                    <span className="font-mono text-lg tracking-widest text-amber-300 bg-black/40 border border-white/10 rounded px-2 py-0.5">
                      {l.codigo}
                    </span>
                    {l.bloqueado && (
                      <span className="text-[11px] text-red-300 flex items-center gap-1" data-dica="Errou o código 5 vezes: travado por 15 minutos. Um código novo destrava.">
                        <Lock className="w-3.5 h-3.5" /> travado
                      </span>
                    )}
                    <Button size="sm" variant="outline" onClick={() => copiar(mensagem(l), 'Mensagem copiada')}
                      data-dica="Copiar a mensagem com o código e as instruções."
                      className="h-8 border-white/20 bg-transparent text-gray-300 hover:bg-white/10 hover:text-white">
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    {zap && (
                      <a href={zap} target="_blank" rel="noopener noreferrer"
                        data-dica="Abrir o WhatsApp do líder com a mensagem do código pronta."
                        className="h-8 px-2.5 inline-flex items-center rounded-md bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs">
                        <MessageCircle className="w-3.5 h-3.5 mr-1" /> Enviar
                      </a>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => novoCodigo(l)} disabled={gerando[l.equipante_id]}
                      data-dica="Gerar outro código. O código atual deixa de valer."
                      className="h-8 text-gray-400 hover:text-white hover:bg-white/10">
                      {gerando[l.equipante_id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Novo código'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default LideresCodigosDialog;
