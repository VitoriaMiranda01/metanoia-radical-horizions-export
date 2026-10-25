import { problemaNomePessoa } from '@/utils/nomePessoa';
import { problemaNomeSimples } from '@/utils/validacoesInscricao';
import { problemaTelefone, digitosTelefone } from '@/utils/telefone';
import { validateCPF } from '@/utils/validation';
import { calcularIdade } from '@/utils/formatters';
import { NAO_CONGREGA, igrejaEhOutra } from '@/constants/igrejas';
import { AREA_SAUDE, problemaEspecialidade } from '@/constants/especialidadesSaude';

/**
 * Cadastros com pendencias dos equipantes (Patrick, 18/10/2026): TUDO que esta
 * em branco ou fora do padrao na ficha, nao so o obrigatorio -- para a
 * organizacao enxergar e corrigir. Calculado aqui, sobre a lista que a tela de
 * Gerenciar Inscricoes ja carregou (1000+ fichas em poucos milissegundos).
 *
 * gravidade:
 *   'obrigatoria' -- o mesmo que o servidor cobra da pessoa na janela
 *                    "Complete o seu cadastro" (_pendencias_equipante);
 *   'conferir'    -- nao trava nada, mas esta faltando ou parece errado.
 *
 * Contato de emergencia nao entra: o formulario do equipante nao pergunta.
 */
export const TIPOS_PENDENCIA = [
  { chave: 'nome', rotulo: 'Nome fora do padrão', gravidade: 'obrigatoria' },
  { chave: 'cpf', rotulo: 'Sem CPF', gravidade: 'obrigatoria' },
  { chave: 'cpf_invalido', rotulo: 'CPF inválido', gravidade: 'obrigatoria' },
  { chave: 'nascimento', rotulo: 'Sem data de nascimento', gravidade: 'obrigatoria' },
  { chave: 'idade', rotulo: 'Idade estranha', gravidade: 'conferir' },
  { chave: 'sexo', rotulo: 'Sem sexo', gravidade: 'obrigatoria' },
  { chave: 'whatsapp', rotulo: 'WhatsApp vazio ou inválido', gravidade: 'obrigatoria' },
  { chave: 'whatsapp_repetido', rotulo: 'WhatsApp igual ao de outra ficha', gravidade: 'conferir' },
  { chave: 'igreja', rotulo: 'Sem igreja', gravidade: 'obrigatoria' },
  { chave: 'igreja_outra', rotulo: 'Igreja "OUTRA" (vincular)', gravidade: 'conferir' },
  { chave: 'pastor', rotulo: 'Sem nome do pastor', gravidade: 'conferir' },
  { chave: 'pastor_invalido', rotulo: 'Nome do pastor fora do padrão', gravidade: 'obrigatoria' },
  { chave: 'cargo', rotulo: 'Sem cargo na igreja', gravidade: 'conferir' },
  { chave: 'cargo_outro', rotulo: 'Cargo "OUTRO" sem descrever', gravidade: 'conferir' },
  { chave: 'parentesco', rotulo: 'Familiar acampante não respondido', gravidade: 'obrigatoria' },
  { chave: 'familiar', rotulo: 'Nome do familiar faltando/errado', gravidade: 'obrigatoria' },
  { chave: 'areas', rotulo: 'Opções de área incompletas', gravidade: 'obrigatoria' },
  { chave: 'radical', rotulo: 'Não disse qual Radical fez', gravidade: 'conferir' },
  { chave: 'edicao_trabalhou', rotulo: 'Já trabalhou, sem dizer a edição', gravidade: 'conferir' },
  { chave: 'autorizacao', rotulo: 'Menor sem autorização dos pais', gravidade: 'conferir' },
  { chave: 'especialidade', rotulo: 'Saúde sem especialidade', gravidade: 'conferir' },
];

export const TIPO_PENDENCIA = Object.fromEntries(TIPOS_PENDENCIA.map((t) => [t.chave, t]));

const vazio = (v) => !String(v ?? '').trim();
const digitosCpf = (cpf) => String(cpf || '').replace(/\D/g, '');

/** Lista de pendencias de UMA ficha: [{ chave, detalhe? }]. */
export const pendenciasDaFicha = (e, { whatsRepetidos } = {}) => {
  const p = [];
  const add = (chave, detalhe) => p.push({ chave, detalhe });
  const cpf = digitosCpf(e.cpf);
  const estrangeiro = !cpf && !vazio(e.nacionalidade);
  const congrega = e.esta_afastado === true
    || (!vazio(e.igreja) && e.igreja !== NAO_CONGREGA && e.esta_afastado !== false);

  if (vazio(e.nome) || problemaNomePessoa(e.nome)) add('nome', e.nome || '');

  if (!cpf && vazio(e.nacionalidade)) add('cpf');
  else if (cpf && !validateCPF(cpf)) add('cpf_invalido', e.cpf);

  if (!e.data_nascimento) add('nascimento');
  else {
    const idade = e.idade ?? calcularIdade(e.data_nascimento);
    if (idade === null || idade < 14 || idade > 85) add('idade', idade != null ? `${idade} anos` : null);
  }

  if (vazio(e.sexo)) add('sexo');

  if (vazio(e.whatsapp)) add('whatsapp', 'vazio');
  else {
    const prob = problemaTelefone(e.whatsapp, { estrangeiro });
    if (prob) add('whatsapp', e.whatsapp);
    else if (whatsRepetidos?.has(digitosTelefone(e.whatsapp))) add('whatsapp_repetido', e.whatsapp);
  }

  if (vazio(e.igreja) || e.esta_afastado === null || e.esta_afastado === undefined) add('igreja');
  else if (igrejaEhOutra(e.igreja)) add('igreja_outra', e.igreja_outra || 'sem o nome');

  if (congrega) {
    if (vazio(e.pastor_nome)) add('pastor');
    if (vazio(e.cargo_igreja)) add('cargo');
    else if (e.cargo_igreja === 'OUTRO' && vazio(e.cargo_igreja_outro)) add('cargo_outro');
  }
  if (!vazio(e.pastor_nome) && problemaNomeSimples(e.pastor_nome)) add('pastor_invalido', e.pastor_nome);

  if (vazio(e.parentesco)) add('parentesco');
  else if (e.parentesco !== 'NÃO TENHO' && (vazio(e.familiar_nome) || problemaNomeSimples(e.familiar_nome))) {
    add('familiar', e.familiar_nome || 'vazio');
  }

  // Inscricao manual sem area = disponivel para qualquer area (17/10/2026).
  // Quem vai so no domingo nao escolhe area (20261025c).
  if (!e.inscricao_manual_por && !e.so_domingo && [e.area_trabalho_opcao1, e.area_trabalho_opcao2, e.area_trabalho_opcao3].some(vazio)) add('areas');

  if (vazio(e.qual_radical_acampante)) add('radical');
  if (e.ja_trabalhou_equipe === true && vazio(e.edicao_trabalhou)) add('edicao_trabalhou');

  const idade = e.idade ?? calcularIdade(e.data_nascimento);
  if (idade != null && idade < 18 && !e.parental_auth_file_url && !e.autorizacao_entregue_em) add('autorizacao', `${idade} anos`);

  if ([e.area_trabalho_opcao1, e.area_trabalho_opcao2, e.area_trabalho_opcao3].includes(AREA_SAUDE)
      && problemaEspecialidade(e.especialidade_saude, e.especialidade_saude_outro)) add('especialidade');

  return p;
};

/** Todas as fichas com ao menos uma pendencia: [{ ficha, pendencias, obrigatorias }]. */
export const fichasComPendencias = (equipantes = []) => {
  const contagem = new Map();
  equipantes.forEach((e) => {
    const d = digitosTelefone(e.whatsapp || '');
    if (d.length >= 10) contagem.set(d, (contagem.get(d) || 0) + 1);
  });
  const whatsRepetidos = new Set([...contagem].filter(([, n]) => n > 1).map(([d]) => d));
  return equipantes
    .map((ficha) => {
      const pendencias = pendenciasDaFicha(ficha, { whatsRepetidos });
      return {
        ficha,
        pendencias,
        obrigatorias: pendencias.filter((x) => TIPO_PENDENCIA[x.chave]?.gravidade === 'obrigatoria').length,
      };
    })
    .filter((x) => x.pendencias.length > 0);
};
