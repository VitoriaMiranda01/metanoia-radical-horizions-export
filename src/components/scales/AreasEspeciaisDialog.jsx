import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Sparkles, X } from 'lucide-react';

/**
 * Guia, Inimigo e Espírito Santo em um módulo à parte.
 *
 * Saíram do corpo da Geração de Escalas a pedido do Patrick: são papéis fixos,
 * mudam pouco de uma edição para a outra, e ficavam no meio das ~30 áreas
 * disputando atenção com o que realmente muda toda edição.
 *
 * Só a MOLDURA mora aqui. As três tabelas continuam sendo montadas pela
 * página (mesmo cabeçalho de limite, mesma grade, mesmos botões de realocar,
 * atuação, cor e remover) e chegam como children — assim não existe uma
 * segunda versão da tabela para sair do lugar quando a primeira mudar.
 */
const AreasEspeciaisDialog = ({ onClose, total = 0, children }) => {
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
              Guia, Inimigo e Espírito Santo. Uma pessoa só pode ter um dos três.
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {total === 0
                ? 'Ninguém escalado nestes três papéis ainda.'
                : `${total} ${total === 1 ? 'pessoa escalada' : 'pessoas escaladas'} nos três.`}
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

        <div className="p-4 border-t border-white/10 bg-zinc-900 flex justify-end">
          <Button onClick={onClose} variant="outline" className="border-white/20 bg-transparent text-gray-300 hover:bg-white/10 hover:text-white">
            Fechar
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default AreasEspeciaisDialog;
