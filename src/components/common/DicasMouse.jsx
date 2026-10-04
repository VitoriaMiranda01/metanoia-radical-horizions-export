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

    const aoEntrar = (e) => {
      const el = e.target instanceof Element ? e.target.closest(SELETOR) : null;
      if (el === alvo) return;
      esconder();
      if (!el) return;
      const texto = textoDe(el);
      if (!texto) return;
      alvo = el;
      timer = setTimeout(() => { if (alvo === el && el.isConnected) mostrar(el, texto); }, ATRASO_MS);
    };

    const aoSair = (e) => {
      if (!alvo) return;
      const para = e.relatedTarget;
      if (para instanceof Node && alvo.contains(para)) return;
      esconder();
    };

    document.addEventListener('mouseover', aoEntrar, true);
    document.addEventListener('mouseout', aoSair, true);
    document.addEventListener('mousedown', esconder, true);
    document.addEventListener('keydown', esconder, true);
    window.addEventListener('scroll', esconder, true);
    window.addEventListener('blur', esconder);

    return () => {
      document.removeEventListener('mouseover', aoEntrar, true);
      document.removeEventListener('mouseout', aoSair, true);
      document.removeEventListener('mousedown', esconder, true);
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
