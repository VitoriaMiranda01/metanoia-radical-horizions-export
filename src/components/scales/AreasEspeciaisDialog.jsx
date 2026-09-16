import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Sparkles, X, Loader2, UserCheck } from 'lucide-react';
import { AREAS_ESPECIAIS } from '@/constants/workAreas';

// Numero por extenso so pra esta frase -- nao vale a pena um util
// compartilhado para 6 palavras. Se um setimo papel especial entrar e
// passar de 10, cai no fallback numerico abaixo.
const NUMERO_POR_EXTENSO = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez'];
const porExtenso = (n) => NUMERO_POR_EXTENSO[n] ?? String(n);

// Guia, Inimigo, Espírito Santo, Depressão, Perseguidos e Infiltrados,
// nesta ordem: "Guia, Inimigo, Espírito Santo, Depressão, Perseguidos e
// Infiltrados".
const listaDosLabels = AREAS_ESPECIAIS.map(a => a.label).reduce((frase, label, i, arr) => {
  if (i === 0) return label;
  if (i === arr.length - 1) return `${frase} e ${label}`;
  return `${frase}, ${label}`;
}, '');

/**
 * Os papéis especiais (ver AREAS_ESPECIAIS em constants/workAreas.js) em um
 * módulo à parte.
 *
 * Guia, Inimigo e Espírito Santo saíram do corpo da Geração de Escalas a
 * pedido do Patrick: são papéis fixos, mudam pouco de uma edição para a
 * outra, e ficavam no meio das ~30 áreas disputando atenção com o que
 * realmente muda toda edição. Depressão, Perseguidos e Infiltrados
 * entraram depois (16/09/2026), vindos de outras duas famílias de área --
 * ver o comentário em AREAS_ESPECIAIS.
 *
 * Só a MOLDURA mora aqui. Os gerenciadores de CPF (CpfsAreaEspecialManager,
 * um por área) e as tabelas continuam sendo montados pela página (mesmo
 * cabeçalho de limite, mesma grade, mesmos botões de realocar, atuação, cor
 * e remover) e chegam como children — assim não existe uma segunda versão
 * da tabela para sair do lugar quando a primeira mudar.
 *
 * onAplicarCpfs / aplicandoPorCpf (opcionais): o botão "Aplicar CPFs
 * cadastrados" mora aqui dentro -- e não na barra de ações da página --
 * porque só faz sentido para estas áreas (ver handleAlocarPorCpf em
 * OrganizerScalesPage.jsx e alocarAreasEspeciaisPorCpf em
 * equipanteAllocationService.js). Sem onAplicarCpfs o botão nem aparece.
 */
const AreasEspeciaisDialog = ({ onClose, total = 0, children, onAplicarCpfs, aplicandoPorCpf = false }) => {
  useEffect(() => {
    const aoTeclar = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-black border border-white/10 rounded-lg shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start gap-4 p-5 border-b border-white/10 bg-zinc-900">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-400" />
              Áreas Especiais
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              {listaDosLabels}. Uma pessoa só pode ter um dos {porExtenso(AREAS_ESPECIAIS.length)}.
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {total === 0
                ? `Ninguém escalado nestes ${porExtenso(AREAS_ESPECIAIS.length)} papéis ainda.`
                : `${total} ${total === 1 ? 'pessoa escalada' : 'pessoas escaladas'} nos ${porExtenso(AREAS_ESPECIAIS.length)}.`}
              {' '}Para colocar alguém, use a fila “A escalar” ou o botão Realocar de outra área.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-white shrink-0">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-6">{children}</div>
        </div>

        <div className="p-4 border-t border-white/10 bg-zinc-900 flex justify-end gap-3">
          {onAplicarCpfs && (
            <Button onClick={onAplicarCpfs} disabled={aplicandoPorCpf} variant="outline"
              title={`Aplica as ${AREAS_ESPECIAIS.length} listas de CPF pré-cadastradas acima contra quem já está aprovado.`}
              className="bg-indigo-600/20 text-indigo-300 border-indigo-600/50 hover:bg-indigo-600/40 hover:text-indigo-200">
              {aplicandoPorCpf
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <UserCheck className="mr-2 h-4 w-4" />}
              Aplicar CPFs cadastrados
            </Button>
          )}
          <Button onClick={onClose} variant="outline" className="border-white/20 bg-transparent text-gray-300 hover:bg-white/10 hover:text-white">
            Fechar
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default AreasEspeciaisDialog;
