import { limparNomePessoa, problemaNomePessoa } from '@/utils/nomePessoa';
import { calcularIdade } from '@/utils/formatters';

/**
 * Validacoes dos campos de texto das inscricoes (Patrick, 06/10/2026): a
 * pessoa so consegue enviar se os dados tiverem a forma certa. O servidor
 * confere de novo (migration 20261006n) -- aqui e para ela corrigir na hora.
 */

// Nome de quem pode ter uma palavra so ("Juscelino", "Pr Enrico Frohe"):
// so letras (e espaco, apostrofo, hifen e ponto), com ao menos 2 letras.
export const limparNomeSimples = limparNomePessoa;
export const problemaNomeSimples = (nome) => {
  const t = String(nome ?? '').trim();
  if (!t) return null;
  if (/[^\p{L}\s'’.-]/u.test(t)) return 'Use só letras (sem números ou símbolos).';
  if ((t.match(/\p{L}/gu) || []).length < 2) return 'Escreva o nome.';
  return null;
};

export const problemaEmail = (email) => {
  const t = String(email ?? '').trim();
  if (!t) return null;
  return /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(t) ? null : 'E-mail inválido: confira, por exemplo nome@exemplo.com.';
};

export const mascararCep = (valor) => {
  const d = String(valor ?? '').replace(/\D/g, '').slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};
export const problemaCep = (cep) => (/^\d{8}$/.test(String(cep ?? '').replace(/\D/g, '')) ? null : 'O CEP tem 8 números.');

// Cidade e profissao nao levam numero.
export const limparSemNumero = (valor) => String(valor ?? '').replace(/[0-9]/g, '');
export const problemaSemNumero = (valor, rotulo) => (/[0-9]/.test(String(valor ?? '')) ? `${rotulo} não leva números.` : null);

export const problemaNascimento = (iso) => {
  if (!iso) return null;
  const idade = calcularIdade(iso);
  return idade === null || idade < 10 || idade > 100 ? 'A idade que essa data dá não parece certa.' : null;
};

export const UFS = [
  ['AC', 'Acre'], ['AL', 'Alagoas'], ['AP', 'Amapá'], ['AM', 'Amazonas'], ['BA', 'Bahia'], ['CE', 'Ceará'],
  ['DF', 'Distrito Federal'], ['ES', 'Espírito Santo'], ['GO', 'Goiás'], ['MA', 'Maranhão'],
  ['MT', 'Mato Grosso'], ['MS', 'Mato Grosso do Sul'], ['MG', 'Minas Gerais'], ['PA', 'Pará'],
  ['PB', 'Paraíba'], ['PR', 'Paraná'], ['PE', 'Pernambuco'], ['PI', 'Piauí'], ['RJ', 'Rio de Janeiro'],
  ['RN', 'Rio Grande do Norte'], ['RS', 'Rio Grande do Sul'], ['RO', 'Rondônia'], ['RR', 'Roraima'],
  ['SC', 'Santa Catarina'], ['SP', 'São Paulo'], ['SE', 'Sergipe'], ['TO', 'Tocantins'],
];

/**
 * Confere os campos de texto da ficha antes de enviar. Devolve o primeiro
 * problema { titulo, descricao, id } (id = campo para focar) ou null.
 * `tipo`: 'acampante' | 'equipante'. Nome e CPF ficam nas telas.
 */
export const conferirInscricao = (f, tipo) => {
  const p = (titulo, descricao, id) => ({ titulo, descricao, id });
  let m;

  // O select do Radix nao barra o envio em branco sozinho (ver DadosPessoais).
  if (!f.sexo) return p('Escolha o sexo', 'Selecione uma das opções.', 'sexo');
  if (!f.dataNascimento) return p('Informe a data de nascimento', 'Digite no formato dd/mm/aaaa.', 'dataNascimento');
  if ((m = problemaNascimento(f.dataNascimento))) return p('Confira a data de nascimento', m, 'dataNascimento');
  if ((m = problemaEmail(f.email))) return p('Confira o e-mail', m, 'email');
  if ((m = problemaSemNumero(f.profissao, 'A profissão'))) return p('Confira a profissão', m, 'profissao');
  if ((m = problemaNomeSimples(f.pastor))) return p('Confira o nome do pastor', m, 'pastor');

  if (tipo === 'acampante') {
    // Estrangeiro (sem CPF) mora fora do Brasil: CEP e estado ficam livres.
    if (!f.semCpf) {
      if ((m = problemaCep(f.cep))) return p('Confira o CEP', m, 'cep');
      if (!UFS.some(([uf]) => uf === f.estado)) return p('Escolha o estado', 'Selecione o estado na lista.', 'estado');
    }
    if ((m = problemaSemNumero(f.cidade, 'A cidade'))) return p('Confira a cidade', m, 'cidade');
    if ((m = problemaNomeSimples(f.nomeQuemIndicou))) return p('Confira o nome de quem indicou', m, 'nomeQuemIndicou');
    if (f.conhecidoNoProjeto && f.conhecidoNoProjeto !== 'NÃO TENHO'
        && (m = problemaNomePessoa(f.nomeFamiliarConhecido))) {
      return p('Confira o nome do familiar / conhecido', m, 'nomeFamiliarConhecido');
    }
  } else if (f.parentesco && f.parentesco !== 'NÃO TENHO') {
    m = problemaNomeSimples(f.familiarNome) || (!String(f.familiarNome || '').trim() ? 'Escreva o nome.' : null);
    if (m) return p('Confira o nome do conhecido / familiar', m, 'familiarNome');
  }
  return null;
};
