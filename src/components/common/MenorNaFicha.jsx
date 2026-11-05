import React, { useEffect, useState } from 'react';
import { Baby, UserCheck } from 'lucide-react';
import { fetchMenoresDaAprovacao } from '@/services/equipantesService';
import { SITUACAO_ACOMPANHANTE, indexarMenores } from '@/utils/menorAprovacao';

/**
 * Na ficha do equipante (20261105a): se e menor, a liberacao e o acompanhante
 * achado pelo nome; se foi indicado como acompanhante, de qual menor.
 * A lista vem de menores_da_aprovacao (organizador ve todos; parceiro, os da
 * sua igreja) e fica guardada 60 s para abrir varias fichas sem esperar.
 */
let cache = { em: 0, promessa: null };
const carregar = () => {
  if (cache.promessa && Date.now() - cache.em < 60000) return cache.promessa;
  cache = {
    em: Date.now(),
    promessa: fetchMenoresDaAprovacao().then((r) => (r.success ? indexarMenores(r.itens) : null)).catch(() => null),
  };
  return cache.promessa;
};

/** Indice dos menores para listas (tags). ativo = false nao busca nada. */
export const useIndiceMenores = (ativo = true) => {
  const [idx, setIdx] = useState(null);
  useEffect(() => {
    if (!ativo) return undefined;
    let vivo = true;
    carregar().then((r) => { if (vivo) setIdx(r); });
    return () => { vivo = false; };
  }, [ativo]);
  return idx;
};

const COR = {
  green: 'text-green-300',
  amber: 'text-amber-200',
  red: 'text-red-300',
};

const MenorNaFicha = ({ inscricao }) => {
  const [dados, setDados] = useState({ menor: inscricao.menorInfo || null, de: inscricao.acompanhanteDe || null });

  useEffect(() => {
    let vivo = true;
    carregar().then((idx) => {
      if (!vivo || !idx) return;
      setDados({ menor: idx.porId.get(inscricao.id) || null, de: idx.acompanhanteDe.get(inscricao.id) || null });
    });
    return () => { vivo = false; };
  }, [inscricao.id]);

  const { menor, de } = dados;
  if (!menor && !de) return null;
  const situacao = menor ? (SITUACAO_ACOMPANHANTE[menor.acompanhante?.situacao] || SITUACAO_ACOMPANHANTE.nao_encontrado) : null;
  const liberadoEm = menor?.menor_liberado_em
    ? new Date(menor.menor_liberado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {menor && (
        <div className="bg-pink-500/10 border border-pink-500/30 p-3 rounded-md">
          <span className="text-sm text-gray-300 flex items-center gap-1.5 mb-1"><Baby className="h-4 w-4 text-pink-300" /> Autorização do responsável:</span>
          <p className="text-white font-medium text-sm">
            {liberadoEm
              ? `Confirmada por ${menor.menor_liberado_por || '—'} em ${liberadoEm}`
              : 'Ainda não confirmada (o pagamento só abre depois)'}
          </p>
        </div>
      )}
      {menor && (
        <div className="bg-white/5 p-3 rounded-md">
          <span className="text-sm text-gray-400 block mb-1">Acompanhante no sistema:</span>
          {menor.acompanhante?.pessoa ? (
            <p className="text-white font-medium text-sm">{menor.acompanhante.pessoa.nome}</p>
          ) : null}
          <p className={`text-xs ${COR[situacao.cor]}`}>{situacao.rotulo}</p>
        </div>
      )}
      {de && (
        <div className="bg-sky-500/10 border border-sky-500/30 p-3 rounded-md md:col-span-2">
          <span className="text-sm text-gray-300 flex items-center gap-1.5 mb-1"><UserCheck className="h-4 w-4 text-sky-300" /> Acompanhante de menor de idade:</span>
          <p className="text-white font-medium text-sm">{de.map((m) => m.nome).join(', ')}</p>
        </div>
      )}
    </div>
  );
};

export default MenorNaFicha;
