import { calcularIdade } from '@/utils/formatters';
import { problemaNomePessoa, limparNomePessoa } from '@/utils/nomePessoa';
import { problemaTelefone } from '@/utils/telefone';
import { mesmoTelefone, mesmoNome } from '@/utils/contatoEmergencia';

/**
 * Menor de 18 anos (Patrick, 04/11/2026, migration 20261104d):
 *  - acampante: nome e WhatsApp do responsavel;
 *  - equipante: nome e WhatsApp do responsavel E de quem vai acompanhar o
 *    menor trabalhando no projeto (pode ser a mesma pessoa).
 * Nome com nome e sobrenome, diferente do proprio inscrito; WhatsApp de
 * celular, diferente do WhatsApp do proprio inscrito. O servidor confere de
 * novo (_menor_responsavel_erro e o gatilho validar_ficha).
 */

export const ehMenorDeIdade = (dataNascimento) => {
  const idade = calcularIdade(dataNascimento);
  return idade !== null && idade < 18;
};

export const limparNomeResponsavel = limparNomePessoa;

/** Campos de cada pessoa, na ordem em que aparecem no formulario. */
export const PESSOAS_DO_MENOR = [
  { chave: 'responsavel', rotulo: 'responsável', campoNome: 'responsavelNome', campoTel: 'responsavelWhatsapp' },
  { chave: 'acompanhante', rotulo: 'acompanhante', campoNome: 'acompanhanteNome', campoTel: 'acompanhanteWhatsapp', soEquipante: true },
];

export const pessoasExigidas = (tipo) => PESSOAS_DO_MENOR.filter((p) => !p.soEquipante || tipo === 'equipante');

/** Problema do nome (null = ok ou vazio). */
export const problemaNomeDoMenor = (f, p) =>
  problemaNomePessoa(f[p.campoNome])
  || (mesmoNome(f[p.campoNome], f.nome) ? `O ${p.rotulo} precisa ser outra pessoa — não pode ser você.` : null);

/** Problema do WhatsApp (null = ok ou vazio). */
export const problemaTelDoMenor = (f, p) => {
  const v = String(f[p.campoTel] || '').trim();
  if (!v) return null;
  return problemaTelefone(v, { estrangeiro: !!f.semCpf })
    || (mesmoTelefone(v, f.whatsapp) ? `O WhatsApp do ${p.rotulo} precisa ser diferente do seu.` : null);
};

/** Primeiro problema { titulo, descricao, id } ou null. Adulto: sempre null. */
export const conferirResponsavelMenor = (f, tipo) => {
  if (!ehMenorDeIdade(f.dataNascimento)) return null;
  for (const p of pessoasExigidas(tipo)) {
    if (!String(f[p.campoNome] || '').trim()) {
      return { titulo: `Informe o nome do ${p.rotulo}`, descricao: 'Você é menor de 18 anos: este dado é obrigatório.', id: p.campoNome };
    }
    let m = problemaNomeDoMenor(f, p);
    if (m) return { titulo: `Confira o nome do ${p.rotulo}`, descricao: m, id: p.campoNome };
    if (!String(f[p.campoTel] || '').trim()) {
      return { titulo: `Informe o WhatsApp do ${p.rotulo}`, descricao: 'Você é menor de 18 anos: este dado é obrigatório.', id: p.campoTel };
    }
    m = problemaTelDoMenor(f, p);
    if (m) return { titulo: `Confira o WhatsApp do ${p.rotulo}`, descricao: m, id: p.campoTel };
  }
  return null;
};

/** O que vai para o banco: adulto manda tudo nulo (nao leva dado antigo). */
export const dadosResponsavelParaDb = (f, tipo) => {
  const menor = ehMenorDeIdade(f.dataNascimento);
  const limpo = (v) => (menor ? (String(v || '').trim().replace(/\s+/g, ' ') || null) : null);
  const base = {
    responsavel_nome: limpo(f.responsavelNome),
    responsavel_whatsapp: limpo(f.responsavelWhatsapp),
  };
  if (tipo !== 'equipante') return base;
  return {
    ...base,
    acompanhante_nome: limpo(f.acompanhanteNome),
    acompanhante_whatsapp: limpo(f.acompanhanteWhatsapp),
  };
};
