import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flag, X } from 'lucide-react';
import { fetchAvisoChamada } from '@/services/recepcaoService';
import { dataHora, quemFez } from '@/utils/recepcao';

/**
 * Faixa no topo das telas do organizador quando a recepcao da igreja encerra
 * a chamada dos acampantes (25/10/2026, migration 20261025g): e a notificacao
 * para conferir a chamada no sitio antes de finalizar. "Fechar" esconde so
 * neste navegador e so este encerramento; se a chamada for reaberta e
 * encerrada de novo, a faixa volta.
 */

const INTERVALO = 60 * 1000;
const CHAVE = 'aviso_chamada_visto';

const lerVisto = () => { try { return localStorage.getItem(CHAVE) || ''; } catch { return ''; } };

const AvisoChamadaEncerrada = () => {
  const [aviso, setAviso] = useState(null);
  const [visto, setVisto] = useState(lerVisto);

  const carregar = useCallback(() => {
    fetchAvisoChamada().then(setAviso).catch(() => { /* proximo ciclo tenta de novo */ });
  }, []);

  useEffect(() => {
    carregar();
    const id = setInterval(() => { if (!document.hidden) carregar(); }, INTERVALO);
    const aoVoltar = () => { if (!document.hidden) carregar(); };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', aoVoltar); };
  }, [carregar]);

  if (!aviso?.encerrada_em || visto === aviso.encerrada_em) return null;

  const fechar = () => {
    setVisto(aviso.encerrada_em);
    try { localStorage.setItem(CHAVE, aviso.encerrada_em); } catch { /* sem armazenamento: some so agora */ }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
      <div role="alert" className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-md border border-violet-500/40 bg-violet-950/60 px-4 py-3">
        <Flag className="w-5 h-5 text-violet-300 shrink-0 hidden sm:block" />
        <div className="flex-1 min-w-0 text-sm">
          <p className="font-semibold text-violet-100">
            A recepção encerrou a chamada dos acampantes ({quemFez(aviso.encerrada_por)}, {dataHora(aviso.encerrada_em)})
          </p>
          <p className="text-violet-200/80">
            {aviso.presentes} de {aviso.total} presentes. Confira a chamada no sítio e veja se realmente pode finalizar.
          </p>
        </div>
        <Link to="/gerenciar" className="text-xs text-violet-100 underline underline-offset-2 hover:text-white shrink-0">
          ver a presença
        </Link>
        <button type="button" onClick={fechar} aria-label="Fechar aviso" className="text-violet-200 hover:text-white shrink-0 self-end sm:self-auto">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default AvisoChamadaEncerrada;
