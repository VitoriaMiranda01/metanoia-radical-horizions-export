import React, { useEffect, useState } from 'react';
import { StickyNote, Pencil, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { salvarObservacaoAprovacao } from '@/services/equipantesService';
import { formatarDataHora } from '@/utils/columnVisibility';

/**
 * Observacao da aprovacao (20261109b).
 *
 * Anotacao livre sobre a inscricao do equipante. NAO e obrigatoria para
 * aprovar nem para rejeitar -- e um adicional. Pode ser editada sempre
 * (pendente, aprovada ou rejeitada). Quem gravou e quando vem carimbado pelo
 * servidor a partir do cracha.
 *
 * Sem `onSalvo` o bloco so mostra (ex.: a ficha aberta fora da Aprovacao).
 * `compacto` e a versao do cartao do celular.
 */
export const LIMITE_OBSERVACAO = 1000;

export const autoriaDaObservacao = (inscricao) => {
  const por = (inscricao?.observacao_aprovacao_por || '').trim();
  if (!por) return '';
  return [
    `por ${por}`,
    inscricao.observacao_aprovacao_origem || null,
    inscricao.observacao_aprovacao_em ? formatarDataHora(inscricao.observacao_aprovacao_em) : null
  ].filter(Boolean).join(' · ');
};

const ObservacaoAprovacao = ({ inscricao, onSalvo, compacto = false, abrirEditando = false, onFechar }) => {
  const { toast } = useToast();
  const texto = inscricao?.observacao_aprovacao || '';
  const [editando, setEditando] = useState(abrirEditando);
  const [rascunho, setRascunho] = useState(texto);
  const [salvando, setSalvando] = useState(false);

  // Outra pessoa (ou a recarga da lista) mudou o texto: so atualiza o
  // rascunho se nao houver edicao em andamento.
  useEffect(() => {
    if (!editando) setRascunho(texto);
  }, [texto, editando]);

  const podeEditar = typeof onSalvo === 'function';
  if (!texto && !podeEditar) return null;

  const cancelar = () => {
    setRascunho(texto);
    setEditando(false);
    onFechar?.();
  };

  const salvar = async () => {
    setSalvando(true);
    const { data, error } = await salvarObservacaoAprovacao(inscricao.id, rascunho);
    setSalvando(false);
    if (error) {
      toast({ title: 'Observação não salva', description: error.message, variant: 'destructive' });
      return;
    }
    onSalvo({
      observacao_aprovacao: data.observacao_aprovacao ?? null,
      observacao_aprovacao_por: data.observacao_aprovacao_por ?? null,
      observacao_aprovacao_origem: data.observacao_aprovacao_origem ?? null,
      observacao_aprovacao_em: data.observacao_aprovacao_em ?? null
    });
    setEditando(false);
    toast({
      title: data.observacao_aprovacao ? 'Observação salva' : 'Observação apagada',
      className: 'bg-green-600 text-white'
    });
    onFechar?.();
  };

  const caixa = compacto
    ? 'rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-2'
    : 'bg-white/5 p-3 rounded-md';

  if (editando) {
    return (
      <div className={caixa}>
        <label htmlFor={`obs-${inscricao.id}`} className="text-sm text-gray-300 block mb-1">
          Observação (opcional)
        </label>
        <Textarea
          id={`obs-${inscricao.id}`}
          value={rascunho}
          onChange={(e) => setRascunho(e.target.value.slice(0, LIMITE_OBSERVACAO))}
          rows={compacto ? 3 : 4}
          maxLength={LIMITE_OBSERVACAO}
          autoFocus
          placeholder="Anotação sobre esta inscrição. Não é obrigatória para aprovar."
          className="bg-black/40 border-white/15 text-white text-base md:text-sm"
        />
        <div className="flex items-center justify-between gap-2 mt-2">
          <span className="text-xs text-gray-500">{rascunho.length}/{LIMITE_OBSERVACAO}</span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={cancelar} disabled={salvando}
              className="bg-transparent border-white/15 text-gray-300 hover:bg-white/10 hover:text-white">
              Cancelar
            </Button>
            <Button type="button" size="sm" onClick={salvar}
              disabled={salvando || rascunho.trim() === texto.trim()}
              className="bg-sky-600 hover:bg-sky-500 text-white">
              {salvando && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Salvar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!texto) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setEditando(true)}
        className="self-start text-sky-300 hover:text-white hover:bg-sky-500/20 px-2">
        <StickyNote className="w-4 h-4 mr-1.5" />
        Adicionar observação
      </Button>
    );
  }

  return (
    <div className={caixa}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm text-gray-400 flex items-center gap-1.5">
          <StickyNote className="w-4 h-4 text-sky-300 shrink-0" />
          Observação:
        </span>
        {podeEditar && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditando(true)}
            className="h-7 px-2 text-sky-300 hover:text-white hover:bg-sky-500/20" aria-label="Editar observação">
            <Pencil className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
      <p className="text-white text-sm mt-1 whitespace-pre-wrap break-words">{texto}</p>
      {autoriaDaObservacao(inscricao) && (
        <p className="text-xs text-gray-400 mt-1">{autoriaDaObservacao(inscricao)}</p>
      )}
    </div>
  );
};

export default ObservacaoAprovacao;
