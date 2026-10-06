/**
 * Ambiente de TESTE (Patrick, 06/10/2026).
 *
 * O mesmo site, ligado a um banco separado (projeto Supabase "Metanoia
 * TESTE", uma copia do oficial). Liga pelo link
 *   https://metanoiaradicalserra.com.br/?ambiente=teste
 * e desliga pelo botao "Sair do teste" da faixa laranja (ou ?ambiente=oficial).
 * Tudo o que se faz no teste -- inscricao, aprovacao, escala, pagamento --
 * fica so no banco de teste. O PIX de la e simulado.
 *
 * A URL e a chave abaixo sao publicas (a mesma natureza da chave do .env);
 * quem protege os dados e o banco, como no oficial.
 */

const CHAVE = 'metanoia_ambiente';

export const PROJETO_TESTE = {
  url: 'https://oozwcfoidfqperbxnwkk.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vendjZm9pZGZxcGVyYnhud2trIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzMTY1MDUsImV4cCI6MjEwNjg5MjUwNX0.ukuQGUC_VRG1NEW1EBxmYmQGB1fT7PfSU8lb2XXLW6Q',
};

// Trocar de ambiente derruba a sessao: o cracha de um banco nao vale no outro.
const limparSessao = () => {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('metanoia_') && k !== CHAVE)
      .forEach((k) => localStorage.removeItem(k));
    sessionStorage.clear();
  } catch (_) { /* navegacao privada etc. */ }
};

// Le o ?ambiente= do link uma vez, antes de qualquer conexao com o banco.
(() => {
  try {
    const url = new URL(window.location.href);
    const pedido = url.searchParams.get('ambiente');
    if (pedido !== 'teste' && pedido !== 'oficial') return;
    const estavaEmTeste = localStorage.getItem(CHAVE) === 'teste';
    const vaiParaTeste = pedido === 'teste';
    if (estavaEmTeste !== vaiParaTeste) limparSessao();
    if (vaiParaTeste) localStorage.setItem(CHAVE, 'teste');
    else localStorage.removeItem(CHAVE);
    url.searchParams.delete('ambiente');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  } catch (_) { /* sem localStorage: fica no oficial */ }
})();

export const emTeste = () => {
  try {
    return localStorage.getItem(CHAVE) === 'teste';
  } catch (_) {
    return false;
  }
};

export const sairDoTeste = () => {
  limparSessao();
  try { localStorage.removeItem(CHAVE); } catch (_) { /* ignora */ }
  window.location.href = '/';
};
