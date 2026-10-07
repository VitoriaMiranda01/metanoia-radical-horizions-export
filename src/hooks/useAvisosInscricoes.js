import { useCallback, useEffect, useState } from 'react';
import {
  fetchTelefonesAcampantesPendentes, fetchContatosEmergenciaPendentes, fetchCamisasPendentes,
  fetchCadastroAcampantesPendentes,
  fetchMeusAvisosOcultos, ocultarAviso
} from '@/services/acampantesService';

/**
 * Avisos de inscricoes com problema, para a Raquel (e Desenvolvedores) em
 * Gerenciar Inscricoes -- e o sino de notificacoes ao lado do titulo.
 *
 * Cada aviso vem do servidor (que devolve null para quem nao deve ver).
 * Recarrega a cada 20s. Da para OCULTAR o quadro inteiro ou so UMA FICHA:
 * o que foi ocultado so sai da tela -- continua no sino, de onde volta a
 * qualquer hora. Fica guardado na CONTA (avisos_ocultos), entao vale no
 * computador e no celular.
 *
 * Desenvolvedores ve os mesmos quadros, com o recado de que o aviso e da
 * Raquel -- se ela nao conseguir, o Patrick corrige por la (06/10/2026).
 */

const INTERVALO = 20 * 1000;

export const AVISOS = [
  {
    chave: 'telefones',
    buscar: fetchTelefonesAcampantesPendentes,
    titulo: (n) => (n === 1 ? '1 acampante com telefone fora do padrão' : `${n} acampantes com telefone fora do padrão`),
  },
  {
    chave: 'contatos',
    buscar: fetchContatosEmergenciaPendentes,
    titulo: (n) => (n === 1 ? '1 acampante com o contato de emergência errado' : `${n} acampantes com o contato de emergência errado`),
  },
  {
    chave: 'camisas',
    buscar: fetchCamisasPendentes,
    titulo: (n) => (n === 1 ? '1 acampante sem tamanho de camisa' : `${n} acampantes sem tamanho de camisa`),
  },
  {
    chave: 'cadastro',
    buscar: fetchCadastroAcampantesPendentes,
    titulo: (n) => (n === 1 ? '1 acampante com dado fora do padrão no cadastro' : `${n} acampantes com dado fora do padrão no cadastro`),
  },
];

export const useAvisosInscricoes = (atualizarEm) => {
  const [dados, setDados] = useState({});        // { chave: resposta do servidor | null }
  const [ocultos, setOcultos] = useState(() => new Set());

  const recarregar = useCallback(() => {
    AVISOS.forEach((a) => {
      a.buscar()
        .then((d) => setDados((atual) => ({ ...atual, [a.chave]: d })))
        .catch(() => { /* proximo ciclo tenta de novo */ });
    });
  }, []);

  useEffect(() => {
    recarregar();
    fetchMeusAvisosOcultos().then((lista) => setOcultos(new Set(lista))).catch(() => {});
    const id = setInterval(recarregar, INTERVALO);
    return () => clearInterval(id);
  }, [recarregar]);

  // A pagina avisa quando uma ficha foi salva por outro caminho (modal).
  useEffect(() => { if (atualizarEm) recarregar(); }, [atualizarEm, recarregar]);

  // Muda na tela na hora e grava na conta; se o servidor recusar, desfaz.
  const marcar = (chave, oculto) => {
    const aplicar = (valor) => setOcultos((atual) => {
      const novo = new Set(atual);
      if (valor) novo.add(chave); else novo.delete(chave);
      return novo;
    });
    aplicar(oculto);
    ocultarAviso(chave, oculto).catch(() => aplicar(!oculto));
  };

  // Quem nao tem acesso (servidor devolveu null em todos) nao ve o sino.
  const temAcesso = AVISOS.some((a) => dados[a.chave]);

  const lista = AVISOS.map((a) => {
    const itens = dados[a.chave]?.itens || [];
    const ocultaFicha = (i) => ocultos.has(`ficha:${a.chave}:${i.id}`);
    return {
      chave: a.chave,
      itens,                                            // todas as fichas com problema
      visiveis: itens.filter((i) => !ocultaFicha(i)),
      fichasOcultas: itens.filter(ocultaFicha),
      perfil: dados[a.chave]?.perfil || null,
      titulo: a.titulo(itens.length),
      oculto: ocultos.has(`quadro:${a.chave}`),         // o quadro inteiro
    };
  });

  return {
    temAcesso,
    // 'raquel' | 'desenvolvedores' | null
    perfil: lista.find((a) => a.perfil)?.perfil || null,
    avisos: lista,
    total: lista.reduce((n, a) => n + a.itens.length, 0),
    recarregar,
    ocultar: (chave) => marcar(`quadro:${chave}`, true),
    mostrar: (chave) => marcar(`quadro:${chave}`, false),
    ocultarFicha: (chave, id) => marcar(`ficha:${chave}:${id}`, true),
    mostrarFicha: (chave, id) => marcar(`ficha:${chave}:${id}`, false),
  };
};
