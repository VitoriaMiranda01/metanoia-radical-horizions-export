import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Loader2, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { revelarArea } from '@/services/equipantesService';

/**
 * "Ver qual área fui escalado": a revelacao animada da area, que substitui o
 * papel entregue a cada equipante (ideia do Patrick, 04/10/2026).
 *
 * Etapas: busca no servidor -> suspense curto -> a area aparece. Quem tem
 * pendencia na ficha nao chega a ver: o servidor devolve as pendencias e a
 * tela abre a correcao (onPendencias). Quem ficou "Não será escalado" ve uma
 * mensagem cuidadosa em vez da animacao.
 *
 * A area vem SEMPRE do servidor (escalas), a mesma fonte da lista impressa.
 */

const CORES_GRUPO = {
  Amarelo: '#facc15', Azul: '#3b82f6', Roxo: '#a855f7', Verde: '#22c55e', Vermelho: '#ef4444',
};

const SUSPENSE_MS = 1800;

const Brilhos = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden">
    {Array.from({ length: 18 }).map((_, i) => {
      const angulo = (i / 18) * Math.PI * 2;
      return (
        <motion.span
          key={i}
          className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full"
          style={{ background: ['#ef4444', '#22c55e', '#facc15', '#ffffff'][i % 4] }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: Math.cos(angulo) * 170, y: Math.sin(angulo) * 120, opacity: 0, scale: 0.4 }}
          transition={{ duration: 1.3, ease: 'easeOut', delay: 0.05 }}
        />
      );
    })}
  </div>
);

const RevelarAreaDialog = ({ equipanteId, dono, podePagar, onPagar, onPendencias, onClose }) => {
  const [etapa, setEtapa] = useState('buscando'); // buscando | suspense | revelado | fora | erro
  const [areas, setAreas] = useState([]);
  const [erro, setErro] = useState('');
  // O servidor ja respondeu com a area (e gravou que a pessoa viu).
  const viu = etapa === 'suspense' || etapa === 'revelado';
  const fechar = () => onClose?.(viu);

  useEffect(() => {
    let vivo = true;
    let timer;
    (async () => {
      try {
        const r = await revelarArea(equipanteId, dono);
        if (!vivo) return;
        if (r?.pendencias?.length) {
          onPendencias?.(r.pendencias);
          return;
        }
        if (!r?.ok) {
          setErro(r?.erro || 'Não foi possível buscar a sua área.');
          setEtapa('erro');
          return;
        }
        if (!r.areas?.length) {
          setEtapa('fora');
          return;
        }
        setAreas(r.areas);
        setEtapa('suspense');
        timer = setTimeout(() => { if (vivo) setEtapa('revelado'); }, SUSPENSE_MS);
      } catch (e) {
        if (vivo) { setErro(e.message); setEtapa('erro'); }
      }
    })();
    return () => { vivo = false; clearTimeout(timer); };
  }, [equipanteId, dono?.cpf, dono?.nome, dono?.nascimento]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="relative w-full max-w-md min-h-[360px] rounded-2xl border border-white/10 bg-gradient-to-b from-neutral-900 to-black shadow-2xl overflow-hidden flex flex-col">
        <button type="button" onClick={fechar} aria-label="Fechar"
          className="absolute right-3 top-3 z-10 text-gray-500 hover:text-white">
          <X className="w-5 h-5" />
        </button>

        <div className="flex-1 flex items-center justify-center p-8 text-center">
          <AnimatePresence mode="wait">
            {etapa === 'buscando' && (
              <motion.div key="buscando" exit={{ opacity: 0 }} className="flex flex-col items-center gap-3 text-gray-300">
                <Loader2 className="w-8 h-8 animate-spin" />
                Buscando a sua escala...
              </motion.div>
            )}

            {etapa === 'suspense' && (
              <motion.div key="suspense" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                className="flex flex-col items-center gap-6">
                <motion.div
                  className="h-24 w-24 rounded-full border-4 border-red-600/70"
                  animate={{ scale: [1, 1.15, 1], borderColor: ['#dc2626', '#16a34a', '#dc2626'] }}
                  transition={{ duration: 0.9, repeat: Infinity }}
                />
                <p className="text-xl font-semibold text-white tracking-wide">Você foi escalado em...</p>
              </motion.div>
            )}

            {etapa === 'revelado' && (
              <motion.div key="revelado" className="relative w-full flex flex-col items-center gap-4">
                <Brilhos />
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-gray-400">
                  <Sparkles className="w-4 h-4 text-yellow-400" />
                  {areas.length > 1 ? 'Suas áreas' : 'Sua área'}
                </motion.div>
                {areas.map((a, i) => (
                  <motion.div
                    key={`${a.area}-${i}`}
                    initial={{ opacity: 0, scale: 0.3 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 220, damping: 14, delay: 0.15 + i * 0.25 }}
                    className="flex flex-col items-center"
                  >
                    <span className="text-4xl sm:text-5xl font-extrabold uppercase text-white drop-shadow-[0_0_24px_rgba(220,38,38,0.55)]">
                      {a.area}
                    </span>
                    {(a.atuacao || a.cor) && (
                      <span className="mt-2 flex items-center gap-2 text-gray-300">
                        {a.atuacao}
                        {a.cor && (
                          <span className="inline-flex items-center gap-1.5 text-sm">
                            {a.atuacao ? '·' : ''}
                            <span className="h-3 w-3 rounded-full" style={{ background: CORES_GRUPO[a.cor] || '#999' }} />
                            {a.cor}
                          </span>
                        )}
                      </span>
                    )}
                  </motion.div>
                ))}
              </motion.div>
            )}

            {etapa === 'fora' && (
              <motion.div key="fora" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 text-gray-200">
                <p className="text-lg font-semibold text-white">Sua escala ainda precisa ser conversada</p>
                <p className="text-sm text-gray-300">Por favor, verifique a sua escala com o Dudu.</p>
              </motion.div>
            )}

            {etapa === 'erro' && (
              <motion.div key="erro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                <p className="text-white font-semibold">Não conseguimos mostrar a sua área agora</p>
                <p className="text-sm text-gray-400">{erro}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {(etapa === 'revelado' || etapa === 'fora' || etapa === 'erro') && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: etapa === 'revelado' ? 0.9 : 0 }}
            className="p-5 border-t border-white/10 flex flex-col gap-2">
            {etapa === 'revelado' && podePagar && (
              <Button onClick={onPagar} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-base">
                Seguir para o pagamento da taxa de alimentação <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            )}
            <Button variant="outline" onClick={fechar}
              className="w-full border-white/20 bg-transparent text-gray-300 hover:bg-white/10 hover:text-white">
              Fechar
            </Button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default RevelarAreaDialog;
