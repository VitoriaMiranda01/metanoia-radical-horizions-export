import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { nomeDaIgreja } from '@/constants/igrejas';
import { fetchResumoAntesDaOficial } from '@/services/scalesService';
import { cn } from '@/lib/utils';

/**
 * Aviso antes de lancar a escala OFICIAL (21/10/2026, Patrick): quem ainda esta
 * aguardando aprovacao, na fila "A escalar", ausente ou sem chamada. Nao
 * bloqueia: ver os nomes e lancar assim mesmo e decisao de quem lanca.
 * Recepcao Sitio, Recepcao Igreja e Manutencao ficam fora da conta (nao passam
 * pela chamada), e ausente que a organizacao ja decidiu manter nao entra.
 */
const GRUPOS = [
  { chave: 'aguardando', titulo: 'Aguardando aprovação' },
  { chave: 'a_escalar', titulo: 'A escalar' },
  { chave: 'ausentes', titulo: 'Ausentes' },
  { chave: 'sem_chamada', titulo: 'Sem chamada' }
];

const Grupo = ({ titulo, pessoas }) => {
  const [aberto, setAberto] = useState(false);
  if (pessoas.length === 0) return null;
  return (
    <div className="rounded-md border border-amber-500/30 bg-amber-500/5">
      <button type="button" onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-amber-100">
        <span><strong>{pessoas.length}</strong> {titulo.toLowerCase()}</span>
        {aberto ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {aberto && (
        <ul className="max-h-48 overflow-y-auto border-t border-amber-500/20 px-3 py-2 space-y-1 text-xs text-gray-200">
          {pessoas.map((p, i) => (
            <li key={`${p.nome}-${i}`} className="flex justify-between gap-3">
              <span className="truncate">{p.nome}</span>
              <span className="shrink-0 text-gray-400">{p.area || nomeDaIgreja(p) || ''}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const ResumoAntesDaOficial = ({ ativo }) => {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!ativo) return undefined;
    let vivo = true;
    setDados(null);
    setErro('');
    (async () => {
      const r = await fetchResumoAntesDaOficial();
      if (!vivo) return;
      if (r.success) setDados(r.data); else setErro(r.error);
    })();
    return () => { vivo = false; };
  }, [ativo]);

  if (erro) return <p className="text-xs text-red-300">Não consegui conferir as pendências: {erro}</p>;
  if (!dados) {
    return <p className="text-xs text-gray-400 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Conferindo pendências...</p>;
  }
  const total = GRUPOS.reduce((t, g) => t + (dados[g.chave] || []).length, 0);
  if (total === 0) {
    return (
      <p className="text-xs text-green-300 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4" /> Sem pendências: ninguém aguardando aprovação, a escalar, ausente ou sem chamada.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <p className={cn('text-xs flex items-start gap-2 text-amber-200')}>
        <AlertTriangle className="w-4 h-4 shrink-0" />
        Ainda há pendências. Você pode lançar assim mesmo, a decisão é sua. Toque para ver os nomes.
      </p>
      {GRUPOS.map((g) => <Grupo key={g.chave} titulo={g.titulo} pessoas={dados[g.chave] || []} />)}
    </div>
  );
};

export default ResumoAntesDaOficial;
