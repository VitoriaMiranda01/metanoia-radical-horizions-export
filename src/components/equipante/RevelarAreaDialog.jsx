import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Loader2, Sparkles, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { revelarArea } from '@/services/equipantesService';
import AreasReveladas from './AreasReveladas';
import { listaDeResponsaveis } from '@/utils/formatters';
import { TEXTO_PRESENCA_APOS_REUNIAO } from '@/constants/textosPresenca';

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

// temEquipe + onVerEquipe (16/10/2026): quem conduz uma equipe (lider, responsavel
// pela reuniao, lider de area extra) vai direto para a lista dela.
const RevelarAreaDialog = ({ equipanteId, dono, podePagar, provisoria = false, reuniaoPassou = false, temEquipe = false, onVerEquipe, onPagar, onPendencias, onClose }) => {
  const [etapa, setEtapa] = useState('buscando'); // buscando | suspense | revelado | fora | erro
  const [areas, setAreas] = useState([]);
  const [extras, setExtras] = useState([]);
  // Quem conduz a reuniao da equipe da pessoa, se ja foi definido (18/10/2026).
  const [responsaveis, setResponsaveis] = useState([]);
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
        setExtras(r.extras || []);
        setResponsaveis(r.responsaveis || []);
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
      <div className="relative w-full max-w-md min-h-[360px] max-h-[92vh] rounded-2xl border border-white/10 bg-gradient-to-b from-neutral-900 to-black shadow-2xl overflow-hidden flex flex-col">
        <button type="button" onClick={fechar} aria-label="Fechar"
          className="absolute right-3 top-3 z-10 text-gray-500 hover:text-white">
          <X className="w-5 h-5" />
        </button>

        <div className="flex-1 flex items-center justify-center p-8 text-center overflow-y-auto">
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
                <AreasReveladas areas={areas} extras={extras} mostrarLocal={provisoria} />
              </motion.div>
            )}

            {etapa === 'fora' && (
              <motion.div key="fora" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 text-gray-200">
                <p className="text-lg font-semibold text-white">Seu nome não saiu na escala preliminar, procure a coordenação do projeto.</p>
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
            {etapa === 'revelado' && provisoria && (
              <p className="text-center text-sm text-amber-200/90 pb-1">
                {areas.some((a) => a.eh_lider)
                  ? 'Esta é a escala provisória. Como líder, confirme a sua própria presença na lista da sua equipe, logo abaixo do acompanhamento.'
                  : reuniaoPassou
                    ? TEXTO_PRESENCA_APOS_REUNIAO
                  : responsaveis.length > 0
                    ? `Esta é a escala provisória. Confirme sua presença com o(a) ${listaDeResponsaveis(responsaveis)} na reunião da sua área.`
                  : areas.some((a) => a.area === 'Marcador')
                    ? 'Esta é a escala provisória. Na reunião de leitura de escala, os Marcadores se reúnem com a liderança dos Invisíveis: procure-os para confirmar a sua presença.'
                    : areas.some((a) => a.area === 'Perseguidos')
                      ? 'Esta é a escala provisória. Na reunião de leitura de escala, os Perseguidos se reúnem com a liderança da Selva: procure-os para confirmar a sua presença.'
                      : 'Esta é a escala provisória. Confirme sua presença com o líder da sua área na reunião de escala.'}
              </p>
            )}
            {etapa === 'revelado' && (temEquipe || areas.some((a) => a.eh_lider)) && onVerEquipe && (
              <Button onClick={onVerEquipe}
                className="w-full py-6 text-base bg-amber-500/15 border border-amber-400/60 text-amber-100 hover:bg-amber-500/25">
                <Users className="mr-2 w-5 h-5" /> {areas.some((x) => x.eh_lider) ? 'Visualizar lista da equipe' : 'Ver a lista da minha equipe'}
              </Button>
            )}
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
