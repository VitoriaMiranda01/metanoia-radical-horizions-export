import React from 'react';
import { motion } from 'framer-motion';
import { Crown, Truck } from 'lucide-react';
import { ehAreaPrincipal } from '@/constants/workAreas';
import { rotuloAreaExtra } from '@/constants/areasExtra';

/**
 * As areas de uma pessoa, como aparecem na revelacao (15/10/2026, Patrick):
 *  - as PRINCIPAIS em destaque, uma debaixo da outra, do mesmo tamanho;
 *  - embaixo, menores, as secundarias e as Areas Extras aprovadas.
 * Quem so tem secundaria ve a secundaria em destaque.
 *
 * animado=false: a mesma coisa, sem animacao (escala oficial, que mostra
 * direto, sem o misterio).
 */

export const CORES_GRUPO = {
  Amarelo: '#facc15', Azul: '#3b82f6', Roxo: '#a855f7', Verde: '#22c55e', Vermelho: '#ef4444',
};

const BolinhaCor = ({ cor }) => (
  <span className="inline-flex items-center gap-1.5 text-sm">
    <span className="h-3 w-3 rounded-full" style={{ background: CORES_GRUPO[cor] || '#999' }} />
    {cor}
  </span>
);

// "Líder" puro ja aparece no selo; "Carcereiro / Líder" continua aparecendo.
const atuacaoVisivel = (a) => (a.atuacao && !(a.eh_lider && a.atuacao === 'Líder') ? a.atuacao : null);

const Detalhe = ({ a }) => {
  const atuacao = atuacaoVisivel(a);
  if (!atuacao && !a.cor) return null;
  return (
    <span className="mt-2 flex items-center justify-center gap-2 text-gray-300 flex-wrap">
      {atuacao}
      {a.cor && <>{atuacao ? '·' : ''}<BolinhaCor cor={a.cor} /></>}
    </span>
  );
};

const SeloLider = ({ animado, atraso }) => {
  const classe = 'mt-3 inline-flex items-center gap-2 rounded-full border border-yellow-400/60 bg-yellow-400/15 px-4 py-1.5 text-base font-bold uppercase tracking-widest text-yellow-300 shadow-[0_0_24px_rgba(250,204,21,0.35)]';
  const conteudo = <><Crown className="w-5 h-5" /> Você é o líder</>;
  if (!animado) return <span className={classe}>{conteudo}</span>;
  return (
    <motion.span
      initial={{ opacity: 0, y: 10, scale: 0.6 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 12, delay: atraso }}
      className={classe}
    >
      {conteudo}
    </motion.span>
  );
};

const AreasReveladas = ({ areas = [], extras = [], animado = true }) => {
  let principais = areas.filter((a) => a.principal ?? ehAreaPrincipal(a.area));
  let secundarias = areas.filter((a) => !(a.principal ?? ehAreaPrincipal(a.area)));
  if (principais.length === 0) { principais = secundarias; secundarias = []; }
  const temEmbaixo = secundarias.length > 0 || extras.length > 0;
  const atrasoEmbaixo = 0.4 + principais.length * 0.25;

  const Bloco = animado ? motion.div : 'div';
  const animacao = (i) => (animado ? {
    initial: { opacity: 0, scale: 0.3 },
    animate: { opacity: 1, scale: 1 },
    transition: { type: 'spring', stiffness: 220, damping: 14, delay: 0.15 + i * 0.25 }
  } : {});

  return (
    <div className="w-full flex flex-col items-center gap-5">
      {principais.map((a, i) => (
        <Bloco key={`${a.area}-${i}`} {...animacao(i)} className="flex flex-col items-center">
          <span className="text-4xl sm:text-5xl font-extrabold uppercase text-white text-center break-words drop-shadow-[0_0_24px_rgba(220,38,38,0.55)]">
            {a.area}
          </span>
          {a.eh_lider && <SeloLider animado={animado} atraso={0.75 + i * 0.25} />}
          <Detalhe a={a} />
        </Bloco>
      ))}

      {temEmbaixo && (
        <Bloco
          {...(animado ? { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { delay: atrasoEmbaixo } } : {})}
          className="w-full border-t border-white/10 pt-4 space-y-2"
        >
          <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500 text-center">Também com você</p>
          {secundarias.map((a, i) => (
            <div key={`s-${a.area}-${i}`} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center">
              <p className="text-white font-semibold uppercase tracking-wide">{a.area}</p>
              {a.eh_lider && <p className="text-xs font-bold uppercase tracking-widest text-yellow-300 mt-0.5">Você é o líder</p>}
              {(atuacaoVisivel(a) || a.cor) && (
                <p className="text-xs text-gray-400 mt-0.5 flex items-center justify-center gap-1.5">
                  {atuacaoVisivel(a)}
                  {a.cor && <>{atuacaoVisivel(a) ? '·' : ''}<BolinhaCor cor={a.cor} /></>}
                </p>
              )}
            </div>
          ))}
          {extras.map((chave) => (
            <div key={`x-${chave}`} className="rounded-lg border border-blue-500/25 bg-blue-500/5 px-3 py-2 text-center">
              <p className="text-blue-200 font-semibold flex items-center justify-center gap-1.5">
                <Truck className="w-4 h-4" /> {rotuloAreaExtra(chave)}
              </p>
              <p className="text-[11px] text-gray-400">Área extra</p>
            </div>
          ))}
        </Bloco>
      )}
    </div>
  );
};

export default AreasReveladas;
