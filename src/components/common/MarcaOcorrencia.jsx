import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useOcorrencias } from '@/hooks/useOcorrencias';
import { TITULO_COMUNICADO } from '@/constants/comunicados';

export const fmtCiencia = (iso) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

/**
 * Asterisco vermelho ao lado do nome: "ja tivemos problema com esta pessoa".
 * So organizadores e o Apoio da portaria recebem a lista (ocorrencias_marcas).
 * Clicar mostra o comunicado e quando a pessoa declarou estar ciente.
 */
const MarcaOcorrencia = ({ id }) => {
  const { marcaDe } = useOcorrencias();
  const [aberta, setAberta] = useState(false);
  const marca = marcaDe(id);
  if (!marca) return null;

  const ciencias = marca.ciencias || [];
  const parar = (e) => e.stopPropagation();

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setAberta(true); }}
        title="Já tivemos problemas com esta pessoa. Clique para ver."
        aria-label="Já tivemos problemas com esta pessoa. Ver o comunicado."
        className="inline-flex shrink-0 cursor-pointer px-1 text-lg font-bold leading-none text-red-500 hover:text-red-400"
      >
        *
      </button>
      <Dialog open={aberta} onOpenChange={setAberta}>
        <DialogContent onClick={parar} className="bg-zinc-950 border-white/10 text-white max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Já tivemos problemas com esta pessoa</DialogTitle>
            <DialogDescription className="text-gray-400">{marca.nome}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2">
              <p className="font-semibold">{TITULO_COMUNICADO}</p>
              <p className="whitespace-pre-line text-gray-200">{marca.texto}</p>
            </div>
            <div className="space-y-1">
              <p className="font-medium">
                Declarações de ciência: {ciencias.length} de {marca.repeticoes}
              </p>
              {ciencias.length === 0
                ? <p className="text-amber-300">Ainda não declarou estar ciente.</p>
                : ciencias.map((c) => (
                  <p key={c.edicao} className="text-gray-300">
                    {fmtCiencia(c.em)} · {c.edicao}ª edição
                  </p>
                ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

/** Botao que deixa na lista so quem tem ocorrencia anterior. */
export const FiltroOcorrencias = ({ ativo, quantidade, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={ativo}
    data-dica="Mostra só as pessoas com quem já tivemos problemas em edições anteriores."
    className={`h-9 px-3 rounded-md border text-sm font-medium transition-colors ${
      ativo
        ? 'bg-red-600 text-white border-red-500'
        : 'bg-white/5 text-gray-300 border-white/15 hover:bg-white/10 hover:text-white'
    }`}
  >
    <span className={`font-bold mr-1 ${ativo ? 'text-white' : 'text-red-500'}`}>*</span>
    Já tivemos problemas ({quantidade})
  </button>
);

export default MarcaOcorrencia;
