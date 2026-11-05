import { useEffect, useRef } from 'react';

const SELETOR_FOCAVEIS =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const elementosFocaveis = (container) =>
  Array.from(container?.querySelectorAll(SELETOR_FOCAVEIS) || []).filter(
    (el) => el.offsetParent !== null
  );

/**
 * Deixa um modal/dialog construído na mão (sem o componente de UI padrão)
 * acessível por teclado e leitor de tela:
 *
 * - ao montar, guarda o elemento que estava focado e move o foco pra dentro
 *   do modal (primeiro item focável, ou o próprio modal);
 * - prende a navegação por Tab dentro do modal (não deixa "vazar" pro
 *   conteúdo por trás);
 * - ao desmontar, devolve o foco pro elemento de origem;
 * - opcionalmente fecha com Esc, se `aoFechar` for passado (não precisa
 *   passar se o componente já trata Esc por conta própria).
 *
 * Uso: `const refModal = useModalAcessivel();` e coloque `ref={refModal}`
 * no elemento raiz do modal (o mesmo que deve levar `role="dialog"` e
 * `aria-modal="true"`).
 */
export function useModalAcessivel(aoFechar) {
  const refModal = useRef(null);
  const elementoAnterior = useRef(null);

  useEffect(() => {
    elementoAnterior.current = document.activeElement;

    const primeiro = elementosFocaveis(refModal.current)[0] || refModal.current;
    primeiro?.focus();

    const aoTeclar = (e) => {
      if (e.key === 'Escape' && aoFechar) {
        aoFechar();
        return;
      }
      if (e.key !== 'Tab') return;

      const itens = elementosFocaveis(refModal.current);
      if (itens.length === 0) return;

      const primeiroItem = itens[0];
      const ultimoItem = itens[itens.length - 1];

      if (e.shiftKey && document.activeElement === primeiroItem) {
        e.preventDefault();
        ultimoItem.focus();
      } else if (!e.shiftKey && document.activeElement === ultimoItem) {
        e.preventDefault();
        primeiroItem.focus();
      }
    };

    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      elementoAnterior.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return refModal;
}
