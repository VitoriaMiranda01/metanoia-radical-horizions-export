import { useEffect } from 'react';

/**
 * Dicas ao parar o mouse em cima de um botao (pedido do Patrick, 04/10/2026):
 * um texto curto dizendo para que ele serve. So no computador -- em tela de
 * toque nao existe "parar o mouse em cima", entao nada e ligado.
 *
 * Uso: qualquer elemento com data-dica="..." (os botoes do shadcn repassam o
 * atributo). O `title` antigo de alguns botoes tambem vira dica, para nao
 * aparecerem dois baloes (o nosso e o do navegador).
 *
 * Um unico ouvinte no documento inteiro, montado uma vez no App: nao precisa
 * embrulhar cada botao em componente nenhum.
 */

const ATRASO_MS = 350;
const SELETOR = '[data-dica], [title]';

const DicasMouse = () => {
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return undefined;

    const balao = document.createElement('div');
    balao.setAttribute('role', 'tooltip');
    Object.assign(balao.style, {
      position: 'fixed',
      zIndex: '2147483647',
      maxWidth: '280px',
      padding: '6px 10px',
      borderRadius: '6px',
      background: 'rgba(24, 24, 27, 0.97)',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      boxShadow: '0 6px 20px rgba(0, 0, 0, 0.45)',
      color: '#f4f4f5',
      fontSize: '12px',
      lineHeight: '1.35',
      pointerEvents: 'none',
      opacity: '0',
      transition: 'opacity 120ms ease',
      whiteSpace: 'normal',
    });
    document.body.appendChild(balao);

    let alvo = null;
    let timer = null;

    const textoDe = (el) => {
      // O title vira data-dica na passada do mouse (e de novo se o React
      // trocar o title depois). Uma data-dica escrita a mao vale mais.
      const t = el.getAttribute('title');
      if (t) {
        if (!el.hasAttribute('data-dica') || el.hasAttribute('data-dica-do-title')) {
          el.setAttribute('data-dica', t);
          el.setAttribute('data-dica-do-title', '');
        }
        el.removeAttribute('title');
      }
      return (el.getAttribute('data-dica') || '').trim();
    };

    const esconder = () => {
      clearTimeout(timer);
      timer = null;
      alvo = null;
      balao.style.opacity = '0';
    };

    const mostrar = (el, texto) => {
      balao.textContent = texto;
      balao.style.left = '0px';
      balao.style.top = '0px';
      const r = el.getBoundingClientRect();
      const b = balao.getBoundingClientRect();
      const margem = 8;
      let top = r.top - b.height - margem;
      if (top < margem) top = r.bottom + margem;
      let left = r.left + r.width / 2 - b.width / 2;
      left = Math.max(margem, Math.min(left, window.innerWidth - b.width - margem));
      balao.style.left = `${Math.round(left)}px`;
      balao.style.top = `${Math.round(top)}px`;
      balao.style.opacity = '1';
    };

    // Botao desabilitado nao recebe o mouse (o estilo padrao do botao e
    // pointer-events: none), entao o evento chega no elemento de tras. Ai
    // procura, dentro dele, um botao desabilitado com dica embaixo do
    // ponteiro -- e justamente ali que a dica explica por que esta cinza.
    // A lista de candidatos fica guardada por meio segundo para o mesmo
    // elemento: o mouse se move dezenas de vezes por segundo.
    let cache = { base: null, lista: [], em: 0 };
    const desabilitadoEmbaixo = (base, x, y) => {
      if (!(base instanceof Element)) return null;
      const agora = performance.now();
      if (cache.base !== base || agora - cache.em > 500) {
        cache = { base, lista: base.querySelectorAll(':disabled[data-dica], :disabled[title]'), em: agora };
      }
      for (const c of cache.lista) {
        const r = c.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return c;
      }
      return null;
    };

    // Depois de um clique, a dica daquele botao so volta quando o mouse sair dele.
    let calado = null;

    const avaliar = (target, x, y) => {
      let el = target instanceof Element ? target.closest(SELETOR) : null;
      if (!el) el = desabilitadoEmbaixo(target, x, y);
      if (el !== calado) calado = null;
      if (el === alvo) return;
      esconder();
      if (!el || el === calado) return;
      const texto = textoDe(el);
      if (!texto) return;
      alvo = el;
      timer = setTimeout(() => { if (alvo === el && el.isConnected) mostrar(el, texto); }, ATRASO_MS);
    };

    let quadro = 0;
    let ultimo = null;
    const aoMover = (e) => {
      ultimo = e;
      if (quadro) return;
      quadro = requestAnimationFrame(() => {
        quadro = 0;
        if (ultimo) avaliar(ultimo.target, ultimo.clientX, ultimo.clientY);
      });
    };

    // Saiu da janela.
    const aoSair = (e) => { if (!e.relatedTarget) esconder(); };

    const aoClicar = () => { calado = alvo; esconder(); };

    document.addEventListener('mousemove', aoMover, true);
    document.addEventListener('mouseout', aoSair, true);
    document.addEventListener('mousedown', aoClicar, true);
    document.addEventListener('keydown', esconder, true);
    window.addEventListener('scroll', esconder, true);
    window.addEventListener('blur', esconder);

    return () => {
      document.removeEventListener('mousemove', aoMover, true);
      document.removeEventListener('mouseout', aoSair, true);
      document.removeEventListener('mousedown', aoClicar, true);
      cancelAnimationFrame(quadro);
      document.removeEventListener('keydown', esconder, true);
      window.removeEventListener('scroll', esconder, true);
      window.removeEventListener('blur', esconder);
      clearTimeout(timer);
      balao.remove();
    };
  }, []);

  return null;
};

export default DicasMouse;
