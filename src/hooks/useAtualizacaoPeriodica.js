import { useEffect, useRef } from 'react';

/**
 * Atualização automática que PAUSA com a aba escondida (25/10/2026, revisão
 * de desempenho). Antes as telas do organizador continuavam consultando o
 * banco a cada 20-60 s mesmo minimizadas -- a de Escalas lia ~2 mil linhas a
 * cada 30 s em cada aba esquecida aberta.
 *
 * - Roda `acao` a cada `ms` só com a aba visível.
 * - Ao voltar para a aba, roda na hora se já passou o intervalo desde a última.
 * - Não roda ao montar (cada tela já faz a sua primeira carga).
 * `acao` pode mudar a cada desenho: vale sempre a mais recente.
 */
export const useAtualizacaoPeriodica = (acao, ms, ativo = true) => {
  const acaoRef = useRef(acao);
  acaoRef.current = acao;

  useEffect(() => {
    if (!ativo || !ms) return undefined;
    let ultima = Date.now();
    const rodar = () => { ultima = Date.now(); acaoRef.current?.(); };
    const t = setInterval(() => { if (!document.hidden) rodar(); }, ms);
    const aoVoltar = () => { if (!document.hidden && Date.now() - ultima >= ms) rodar(); };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', aoVoltar); };
  }, [ms, ativo]);
};
