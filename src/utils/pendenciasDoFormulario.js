import { pendenciasDaFicha } from '@/utils/pendenciasEquipante';
import { problemaNomePessoa } from '@/utils/nomePessoa';
import { problemaTelefone } from '@/utils/telefone';
import { NAO_CONGREGA } from '@/constants/igrejas';

/**
 * Pendencias da ficha anterior no formulario de reinscricao (04/11/2026,
 * Patrick): quem entra pelo CPF recebe a ficha preenchida, e cada pendencia
 * da aba "Cadastros com pendencias" do Gerenciar aparece no proprio campo,
 * com o que a pessoa informou e o que esta errado.
 *
 * Mesma regra de pendenciasEquipante.js (a do organizador), calculada sobre o
 * formulario -- entao a nota some assim que a pessoa corrige.
 *
 *   bloqueia: o envio so passa corrigido.
 *   aviso:    mostra, mas nao trava (pode estar certo ou nao depende dela).
 *
 * Ficam de fora: areas (escolhidas a cada edicao), autorizacao dos pais
 * (entregue depois), especialidade da saude (o formulario ja cobra) e WhatsApp
 * repetido (depende das fichas dos outros, que a tela publica nao ve).
 */
const BLOQUEIAM = new Set([
  'nome', 'cpf_invalido', 'nascimento', 'sexo', 'whatsapp', 'igreja', 'pastor',
  'pastor_invalido', 'cargo', 'cargo_outro', 'parentesco', 'familiar', 'radical',
  'edicao_trabalhou',
]);
const AVISOS = new Set(['idade', 'igreja_outra']);

const simNaoParaBool = (v) => (v === 'SIM' ? true : v === 'NÃO' ? false : null);

/** O formulario no formato da ficha do banco, so com o que a regra le. */
const fichaDoFormulario = (f) => ({
  nome: f.nome,
  cpf: f.semCpf ? '' : f.cpf,
  nacionalidade: f.semCpf ? f.nacionalidade : '',
  data_nascimento: f.dataNascimento || null,
  sexo: f.sexo,
  whatsapp: f.whatsapp,
  esta_afastado: simNaoParaBool(f.estaAfastado),
  igreja: f.estaAfastado === 'NÃO' ? NAO_CONGREGA : f.igreja,
  igreja_outra: f.igrejaOutra,
  pastor_nome: f.pastor,
  cargo_igreja: f.cargoIgreja,
  cargo_igreja_outro: f.cargoIgrejaOutro,
  parentesco: f.parentesco,
  familiar_nome: f.familiarNome,
  qual_radical_acampante: f.qualRadicalAcampante,
  ja_trabalhou_equipe: simNaoParaBool(f.jaTrabalhouEquipe),
  edicao_trabalhou: f.edicaoTrabalhou,
  // Areas nao entram aqui (ver acima): marca como se nao precisasse.
  so_domingo: true,
  parental_auth_file_url: 'n/a',
});

const informou = (v) => (v ? `Você informou "${v}". ` : '');

const texto = (chave, detalhe, f) => {
  switch (chave) {
    case 'nome': return `${informou(detalhe)}${problemaNomePessoa(f.nome) || 'Escreva o seu nome completo, igual ao seu documento.'}`;
    case 'cpf_invalido': return `${informou(detalhe)}Esse CPF não é válido.`;
    case 'nascimento': return 'Informe a sua data de nascimento.';
    case 'idade': return `A data de nascimento informada dá ${detalhe}. Confira se está certa.`;
    case 'sexo': return 'Informe o sexo.';
    case 'whatsapp':
      return detalhe === 'vazio' || !detalhe
        ? 'Informe o seu WhatsApp com DDD.'
        : `${informou(detalhe)}${problemaTelefone(f.whatsapp, { estrangeiro: !!f.semCpf }) || 'Confira o número.'}`;
    case 'igreja': return 'Responda se congrega e, se sim, escolha a sua igreja.';
    case 'igreja_outra': return `Sua ficha está com a igreja "OUTRA"${detalhe ? ` (${detalhe})` : ''}. Se a sua igreja estiver na lista, escolha ela.`;
    case 'pastor': return 'Informe o nome do seu pastor.';
    case 'pastor_invalido': return `${informou(detalhe)}Use só letras no nome do pastor.`;
    case 'cargo': return 'Informe o seu cargo na igreja.';
    case 'cargo_outro': return 'Você escolheu "OUTRO": escreva qual é o seu cargo.';
    case 'parentesco': return 'Responda se tem algum conhecido ou familiar acampante.';
    case 'familiar': return detalhe && detalhe !== 'vazio'
      ? `${informou(detalhe)}Escreva o nome do conhecido/familiar só com letras.`
      : 'Escreva o nome do conhecido/familiar.';
    case 'radical': return 'Informe qual Radical você fez como acampante.';
    case 'edicao_trabalhou': return 'Informe o número da última edição que você trabalhou.';
    default: return 'Confira este campo.';
  }
};

/** Campo do formulario onde cada pendencia aparece (id do elemento). */
export const CAMPO_DA_PENDENCIA = {
  nome: 'nome', cpf_invalido: 'cpf', nascimento: 'dataNascimento', idade: 'dataNascimento',
  sexo: 'sexo', whatsapp: 'whatsapp', igreja: 'igreja', igreja_outra: 'igreja',
  pastor: 'pastor', pastor_invalido: 'pastor', cargo: 'cargoIgreja', cargo_outro: 'cargoIgreja',
  parentesco: 'parentesco', familiar: 'parentesco', radical: 'qualRadicalAcampante',
  edicao_trabalhou: 'edicaoTrabalhou',
};

/**
 * Pendencias do formulario agora: [{ chave, campo, texto, bloqueia }].
 * Vazio quando esta tudo certo.
 */
export const pendenciasDoFormulario = (formData) =>
  pendenciasDaFicha(fichaDoFormulario(formData))
    .filter((p) => BLOQUEIAM.has(p.chave) || AVISOS.has(p.chave))
    .map((p) => ({
      chave: p.chave,
      campo: CAMPO_DA_PENDENCIA[p.chave],
      texto: texto(p.chave, p.detalhe, formData),
      bloqueia: BLOQUEIAM.has(p.chave),
    }));
