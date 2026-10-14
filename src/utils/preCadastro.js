/**
 * Chave de uma pessoa nas listas de pre-cadastro (Areas Especiais e Recepção
 * Igreja; configuracoes.cpfs_area_<key>).
 *
 * Normalmente e o CPF (so digitos). Quem nao tem CPF (inscricao manual) so
 * entra com "Pré-cadastro sem CPF" ligado em Configuracoes (14/10/2026), e
 * entao a chave e 'id:<uuid do equipante>'.
 *
 * Uma pessoa casa com uma entrada pelo CPF OU pelo id -- assim, se quem
 * entrou sem CPF completar o cadastro depois, continua reconhecida.
 * `pessoa.id` e sempre o id do EQUIPANTE (nas linhas de escala tambem).
 */
const soDigitos = (v) => String(v || '').replace(/\D/g, '');

export const PREFIXO_SEM_CPF = 'id:';

export const ehChaveSemCpf = (chave) => String(chave || '').startsWith(PREFIXO_SEM_CPF);

// A chave para GUARDAR: o CPF; sem CPF, o id.
export const chaveDaPessoa = (pessoa) =>
  soDigitos(pessoa?.cpf) || (pessoa?.id ? `${PREFIXO_SEM_CPF}${pessoa.id}` : '');

// Todas as chaves que identificam a pessoa (CPF e id).
export const chavesDaPessoa = (pessoa) => {
  const chaves = [];
  const cpf = soDigitos(pessoa?.cpf);
  if (cpf) chaves.push(cpf);
  if (pessoa?.id) chaves.push(`${PREFIXO_SEM_CPF}${pessoa.id}`);
  return chaves;
};

// A pessoa e dona desta entrada da lista?
export const pessoaTemChave = (pessoa, chave) => !!chave && chavesDaPessoa(pessoa).includes(chave);

// Uma entrada salva como texto (CPF com ou sem pontos, ou 'id:...') -> chave.
export const normalizarChave = (valor) => (ehChaveSemCpf(valor) ? String(valor) : soDigitos(valor));
