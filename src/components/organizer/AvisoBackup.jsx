import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, DatabaseBackup } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  fetchSituacaoBackup, reconhecerAlertaBackup, descreverQuedas, dataDoBackup
} from '@/services/backupService';

/**
 * Faixa no topo de todas as telas do organizador, so para a conta
 * "Desenvolvedores", quando o backup diario:
 *
 *  - falhou, travou, ou esta ha mais de 28h sem copia completa (vermelho);
 *  - encontrou uma queda brusca de registros (amarelo, com "Estou ciente").
 *
 * Com o backup em dia nao aparece nada -- faixa permanente vira paisagem.
 * O banco devolve null para os outros logins, entao o resto dos
 * organizadores nunca ve a faixa.
 */

// Dez minutos: o backup roda uma vez por dia, nao precisa de mais que isso.
const INTERVALO = 10 * 60 * 1000;

const AvisoBackup = () => {
  const [situacao, setSituacao] = useState(null);
  const [ciente, setCiente] = useState({});

  const carregar = useCallback(() => {
    fetchSituacaoBackup()
      .then(setSituacao)
      .catch(() => { /* proximo ciclo tenta de novo */ });
  }, []);

  useEffect(() => {
    carregar();
    const id = setInterval(carregar, INTERVALO);
    return () => clearInterval(id);
  }, [carregar]);

  if (!situacao) return null;

  const problemas = situacao.problemas || [];
  const alertas = (situacao.alertas || []).filter((a) => !ciente[a.id]);
  if (problemas.length === 0 && alertas.length === 0) return null;

  const marcarCiente = async (id) => {
    setCiente((c) => ({ ...c, [id]: true }));
    try {
      await reconhecerAlertaBackup(id);
    } catch {
      setCiente((c) => { const n = { ...c }; delete n[id]; return n; });
    }
    carregar();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 space-y-2">
      {problemas.length > 0 && (
        <div role="alert" className="flex items-start gap-3 rounded-md border border-red-500/40 bg-red-950/60 px-4 py-3">
          <DatabaseBackup className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 text-sm">
            <p className="font-semibold text-red-200">Estamos com falha nos backups</p>
            <ul className="mt-1 space-y-0.5 text-red-200/80">
              {problemas.map((p) => <li key={p}>{p}</li>)}
            </ul>
          </div>
          <Link
            to="/organizer/configuracoes#backups"
            className="text-xs text-red-200 underline underline-offset-2 hover:text-white shrink-0 mt-0.5"
          >
            ver detalhes
          </Link>
        </div>
      )}

      {alertas.map((a) => (
        <div key={a.id} role="alert" className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-md border border-amber-500/40 bg-amber-950/50 px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 hidden sm:block" />
          <div className="flex-1 min-w-0 text-sm">
            <p className="font-semibold text-amber-200">
              Queda brusca de registros no backup de {dataDoBackup(a.data_ref)}
            </p>
            <p className="text-amber-200/80">
              {descreverQuedas(a.quedas)}. O backup de antes da queda foi guardado em
              “retidos” e não será apagado. Se não foi intencional, não mexa em nada e
              chame quem cuida do sistema.
            </p>
          </div>
          <Button
            size="sm" variant="outline"
            onClick={() => marcarCiente(a.id)}
            data-dica="Some com este aviso: confirma que você já viu a queda de registros."
            className="h-8 shrink-0 bg-transparent text-amber-200 border-amber-500/40 hover:bg-amber-500/15 hover:text-white"
          >
            Estou ciente
          </Button>
        </div>
      ))}
    </div>
  );
};

export default AvisoBackup;
