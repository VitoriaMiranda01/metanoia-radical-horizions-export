import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import InscricaoDetalhesModal from '@/components/common/InscricaoDetalhesModal';
import EditarInscricaoModal from '@/components/gerenciar/EditarInscricaoModal';
import { fetchFicha, salvarFicha } from '@/services/fichaService';

/**
 * Ficha de inscricao aberta de fora de Gerenciar Inscricoes (Pagamentos,
 * Patrick, 08/10/2026): mostra a ficha inteira e o "Editar" troca para a
 * edicao na mesma janela -- a mesma de Gerenciar Inscricoes (o que pode e o
 * que nao pode ser editado e decidido la). Salvou, volta para a ficha ja
 * atualizada e avisa a tela de tras (onSalvo) para ela buscar de novo.
 */
const FichaInscricaoDialog = ({ tipo, id, onClose, onSalvo }) => {
  const [ficha, setFicha] = useState(null);
  const [erro, setErro] = useState('');
  const [editando, setEditando] = useState(false);

  const carregar = useCallback(async () => {
    setErro('');
    try {
      setFicha(await fetchFicha(tipo, id));
    } catch (e) {
      setErro(e.message || 'Não foi possível abrir a ficha.');
    }
  }, [tipo, id]);

  useEffect(() => { carregar(); }, [carregar]);

  const salvar = async (fichaId, dados) => {
    const r = await salvarFicha(tipo, fichaId, dados);
    if (r?.success) {
      await carregar();
      onSalvo?.();
    }
    return r;
  };

  if (!ficha) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
        <div className="bg-zinc-900 border border-white/10 rounded-lg p-6 flex items-center gap-3 text-gray-300" onClick={(e) => e.stopPropagation()}>
          {erro ? (
            <>
              <span className="text-red-300">{erro}</span>
              <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0 text-white hover:bg-white/10">
                <X className="w-5 h-5" />
              </Button>
            </>
          ) : (
            <><Loader2 className="w-5 h-5 animate-spin" /> Abrindo a ficha...</>
          )}
        </div>
      </div>
    );
  }

  return editando ? (
    <EditarInscricaoModal inscricao={ficha} onClose={() => setEditando(false)} onSave={salvar} />
  ) : (
    <InscricaoDetalhesModal inscricao={ficha} onClose={onClose} onEditar={() => setEditando(true)} />
  );
};

export default FichaInscricaoDialog;
