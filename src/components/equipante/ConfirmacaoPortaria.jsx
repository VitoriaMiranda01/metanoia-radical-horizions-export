import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Relogio ao vivo (22/10/2026): mostra que a tela esta aberta agora, e nao e um
// print. A conferencia de verdade e no acesso de apoio da portaria.
const agoraEmBrasilia = () => new Date().toLocaleString('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', second: '2-digit'
});

const RelogioAoVivo = () => {
  const [agora, setAgora] = useState(agoraEmBrasilia);
  useEffect(() => {
    const t = setInterval(() => setAgora(agoraEmBrasilia()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <p className="font-mono text-base text-white tabular-nums flex items-center justify-center gap-2">
      <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" aria-hidden="true" />
      {agora.replace(',', ' ·')}
    </p>
  );
};

// Tela que a pessoa apresenta na portaria no dia da edicao. O nome completo
// vem do servidor, que so o entrega a quem concluiu (ver
// confirmacao_portaria_equipante) -- esta tela nao decide nada sozinha.
const ConfirmacaoPortaria = ({ nome, onVoltar }) => (
  <motion.div
    initial={{ scale: 0.95, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    className="bg-green-600/20 border border-green-500/50 p-8 rounded-lg text-center space-y-5"
  >
    <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
      <CheckCircle className="w-10 h-10 text-green-500" />
    </div>
    <p className="text-green-300 text-sm font-semibold uppercase tracking-widest">Entrada liberada</p>
    <h2 className="text-3xl font-bold text-white">Inscrição Confirmada!</h2>
    <div className="text-green-100 text-lg space-y-3 max-w-xl mx-auto">
      <p>
        Parabéns{nome ? <>, <strong className="text-white">{nome}</strong></> : ''}! Sua inscrição está confirmada.
      </p>
      <p>Apresente esta tela na portaria para liberar o acesso.</p>
    </div>
    <RelogioAoVivo />
    <Button variant="outline" className="mt-2" onClick={onVoltar}>
      <ArrowLeft className="w-4 h-4 mr-2" /> Voltar à Área do Equipante
    </Button>
  </motion.div>
);

export default ConfirmacaoPortaria;
