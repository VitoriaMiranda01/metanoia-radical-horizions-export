import React, { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { linkGrupoAcampantes } from '@/services/publicDataService';

/**
 * Botao "Entrar no grupo do WhatsApp" para o acampante PAGO (Patrick,
 * 04/11/2026, migration 20261104d). O servidor so devolve o link para
 * inscricao paga, provada pelo CPF ou pelo txid do PIX pago. Logo depois do
 * PIX a confirmacao pode levar um instante para gravar: tenta de novo algumas
 * vezes antes de desistir.
 */
const BotaoGrupoAcampantes = ({ cpf, txid }) => {
  const [estado, setEstado] = useState({ carregando: true, pago: false, link: null });
  const temProva = !!(String(cpf || '').replace(/\D/g, '').length === 11 || txid);

  useEffect(() => {
    if (!temProva) { setEstado({ carregando: false, pago: false, link: null }); return undefined; }
    let ativo = true;
    let tentativa = 0;
    let timer;
    const perguntar = async () => {
      tentativa += 1;
      try {
        const r = await linkGrupoAcampantes({ cpf: cpf || null, txid: txid || null });
        if (!ativo) return;
        if (r?.pago || tentativa >= 4) {
          setEstado({ carregando: false, pago: !!r?.pago, link: r?.link || null });
          return;
        }
      } catch (err) {
        console.error('linkGrupoAcampantes', err?.message || err);
        if (!ativo) return;
        if (tentativa >= 4) { setEstado({ carregando: false, pago: false, link: null }); return; }
      }
      timer = setTimeout(perguntar, 3000);
    };
    perguntar();
    return () => { ativo = false; clearTimeout(timer); };
  }, [cpf, txid, temProva]);

  if (estado.carregando || !estado.pago) return null;

  if (!estado.link) {
    return (
      <p className="text-sm text-gray-300 bg-white/5 border border-white/10 rounded-lg p-3">
        O link do grupo do WhatsApp dos acampantes vai aparecer aqui assim que a organização liberar.
        Volte a consultar pelo seu CPF.
      </p>
    );
  }

  return (
    <a
      href={estado.link}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-center gap-2 w-full h-12 rounded-md bg-[#25D366] hover:bg-[#1ebe5b] text-black font-semibold transition-colors"
    >
      <MessageCircle className="w-5 h-5" />
      Entrar no grupo do WhatsApp
    </a>
  );
};

export default BotaoGrupoAcampantes;
