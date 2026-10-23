import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Cartoes da tela de Configuracoes que se recolhem (23/10/2026). Recolhido,
// sobra so o titulo do cartao (cabecalho); o resto some por CSS, sem mexer em
// cada cartao. A escolha fica no localStorage; "Recolher/Expandir tudo" usam
// o conjunto de cartoes que se registraram na tela.
const CHAVE = 'config_cartoes_recolhidos';
const registrados = new Set();
const ouvintes = new Set();

const ler = () => {
  try { return new Set(JSON.parse(localStorage.getItem(CHAVE) || '[]')); } catch { return new Set(); }
};
let recolhidos = ler();
let versao = 0;

const mudou = () => {
  versao += 1;
  try { localStorage.setItem(CHAVE, JSON.stringify([...recolhidos])); } catch { /* sem armazenamento */ }
  ouvintes.forEach(f => f());
};
const assinar = (f) => { ouvintes.add(f); return () => ouvintes.delete(f); };
const foto = () => versao;

const alternar = (id) => {
  recolhidos = new Set(recolhidos);
  if (recolhidos.has(id)) recolhidos.delete(id); else recolhidos.add(id);
  mudou();
};
const definirTodos = (recolher) => {
  recolhidos = recolher ? new Set(registrados) : new Set();
  mudou();
};

const CSS = `
.rc-recolhido > .rc-corpo > :first-child > :not(:first-child) { display: none !important; }
.rc-recolhido > .rc-corpo > :first-child > :first-child > :not(:first-child) { display: none !important; }
.rc-corpo > :first-child > :first-child { padding-right: 3rem; }
`;

export const RecolhivelBotoesGerais = () => (
  <div className="flex gap-2">
    <Button type="button" variant="outline" size="sm" onClick={() => definirTodos(true)}
      data-dica="Recolher todos os quadros desta tela, deixando só os títulos."
      className="border-white/10 bg-transparent text-gray-300 hover:bg-white/10 hover:text-white">
      <ChevronsDownUp className="w-4 h-4 mr-2" />Recolher tudo
    </Button>
    <Button type="button" variant="outline" size="sm" onClick={() => definirTodos(false)}
      data-dica="Abrir todos os quadros desta tela."
      className="border-white/10 bg-transparent text-gray-300 hover:bg-white/10 hover:text-white">
      <ChevronsUpDown className="w-4 h-4 mr-2" />Expandir tudo
    </Button>
  </div>
);

const Recolhivel = ({ chave, children, ...props }) => {
  useSyncExternalStore(assinar, foto);
  const corpo = useRef(null);
  const [temConteudo, setTemConteudo] = useState(true);
  const fechado = recolhidos.has(chave);

  useEffect(() => {
    registrados.add(chave);
    return () => { registrados.delete(chave); };
  }, [chave]);

  // Quadros que se escondem sozinhos (ex.: so a conta Desenvolvedores ve)
  // ficam sem o botao.
  useEffect(() => {
    const el = corpo.current;
    if (!el) return undefined;
    const ver = () => setTemConteudo(el.childElementCount > 0);
    ver();
    const obs = new MutationObserver(ver);
    obs.observe(el, { childList: true });
    return () => obs.disconnect();
  }, []);

  return (
    <motion.div {...props} className={`relative ${fechado ? 'rc-recolhido' : ''}`}>
      <style>{CSS}</style>
      <div ref={corpo} className="rc-corpo">{children}</div>
      {temConteudo && (
        <button type="button" onClick={() => alternar(chave)}
          aria-expanded={!fechado}
          aria-label={fechado ? 'Expandir quadro' : 'Recolher quadro'}
          data-dica={fechado ? 'Expandir este quadro.' : 'Recolher este quadro, deixando só o título.'}
          className="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white">
          <ChevronDown className={`w-4 h-4 transition-transform ${fechado ? '-rotate-90' : ''}`} />
        </button>
      )}
    </motion.div>
  );
};

export default Recolhivel;
