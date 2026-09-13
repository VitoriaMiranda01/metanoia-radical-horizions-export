/**
 * Guarda, no próprio aparelho, quem está usando o site e a cobrança PIX
 * aberta — para a pessoa não recomeçar do zero ao voltar.
 *
 * POR QUE ISTO EXISTE
 * -------------------
 * O caminho até o QR Code é longo: digitar o CPF, esperar a verificação,
 * abrir o acompanhamento, escolher a forma de pagamento. Tudo isso vivia só
 * na memória da aba. Quem saía para o aplicativo do banco e voltava —
 * exatamente o que todo mundo faz para pagar um PIX — encontrava a tela
 * inicial pedindo o CPF de novo, e o QR Code perdido. Relatado pelo Patrick
 * no primeiro pagamento real, em 13/09/2026.
 *
 * O celular descarta a aba em segundo plano quando precisa de memória; é o
 * comportamento normal do iOS e do Android, não um defeito do site. Então a
 * volta precisa ser reconstruída a partir de algo gravado.
 *
 * O QUE FICA GRAVADO, E POR QUANTO TEMPO
 * --------------------------------------
 * Só o necessário para retomar: o id da inscrição, o nome, a prova de dono
 * (CPF, ou nome + data de nascimento para estrangeiro) e a cobrança em aberto.
 * Nada disso é segredo para quem está no aparelho: foi essa pessoa que acabou
 * de digitar tudo.
 *
 * Vale por 6 HORAS. O prazo é curto de propósito: em aparelho compartilhado
 * (o computador da igreja, o celular emprestado) a próxima pessoa não deve
 * encontrar a inscrição da anterior aberta. Há também `limparSessao`, ligada
 * ao botão de sair e disparada quando o pagamento é confirmado.
 *
 * Fica em localStorage, e não em sessionStorage, porque sessionStorage morre
 * junto com a aba — e "a aba morreu" é justamente o caso que estamos
 * resolvendo.
 */

const CHAVE = 'metanoia:sessao-inscricao';
const VALIDADE_MS = 6 * 60 * 60 * 1000; // 6 horas

/**
 * localStorage pode simplesmente não existir (navegação privada em alguns
 * navegadores, cookies bloqueados) e aí o acesso LEVANTA. Nada aqui pode
 * derrubar a tela: sem o atalho a pessoa só refaz o caminho, como antes.
 */
const comCofre = (acao, padrao = null) => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return padrao;
    return acao(window.localStorage);
  } catch {
    return padrao;
  }
};

export function lerSessao() {
  return comCofre((cofre) => {
    const cru = cofre.getItem(CHAVE);
    if (!cru) return null;

    const dados = JSON.parse(cru);
    if (!dados?.id || !dados?.salvoEm) return null;

    if (Date.now() - dados.salvoEm > VALIDADE_MS) {
      cofre.removeItem(CHAVE);
      return null;
    }
    return dados;
  });
}

/**
 * Mescla com o que já estava gravado: a identificação é salva na tela do
 * equipante e a cobrança só aparece páginas depois — uma não pode apagar a
 * outra.
 */
export function salvarSessao(novosDados) {
  return comCofre((cofre) => {
    const atual = lerSessao() || {};
    const juntos = { ...atual, ...novosDados, salvoEm: Date.now() };
    cofre.setItem(CHAVE, JSON.stringify(juntos));
    return juntos;
  });
}

export function limparSessao() {
  comCofre((cofre) => cofre.removeItem(CHAVE));
}

/**
 * A "prova de dono" no formato que os serviços esperam. CPF para brasileiro;
 * nome + data de nascimento para quem se inscreveu sem CPF.
 */
export function donoDaSessao(sessao) {
  if (!sessao) return {};
  return {
    cpf: sessao.cpf || null,
    nome: sessao.nome || null,
    nascimento: sessao.nascimento || null
  };
}
