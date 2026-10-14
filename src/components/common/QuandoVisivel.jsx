import React, { useEffect, useRef, useState } from 'react';

/**
 * So monta o conteudo quando ele chega perto da tela (14/10/2026).
 *
 * A Geracao de Escalas tem ~35 areas, cada uma com a sua tabela. Montar todas
 * de uma vez (~900 linhas) estourava a memoria do iPhone. Aqui cada tabela
 * so e montada quando a caixa fica a menos de ~1 tela de distancia; depois de
 * montada, fica (a ordenacao escolhida nao se perde ao rolar).
 *
 * altura: espaco reservado enquanto nao monta (a pagina nao "pula").
 * Sem IntersectionObserver (navegador muito antigo), monta direto.
 */
const QuandoVisivel = ({ children, altura = 200 }) => {
  const ref = useRef(null);
  const [visto, setVisto] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    if (visto) return undefined;
    const el = ref.current;
    if (!el) return undefined;
    const obs = new IntersectionObserver((entradas) => {
      if (entradas.some((e) => e.isIntersecting)) {
        setVisto(true);
        obs.disconnect();
      }
    }, { rootMargin: '800px 0px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [visto]);

  if (visto) return children;
  return <div ref={ref} style={{ height: altura }} aria-hidden="true" />;
};

export default QuandoVisivel;
