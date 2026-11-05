import { calcularIdade } from '@/utils/formatters';
import { problemaNomePessoa, limparNomePessoa } from '@/utils/nomePessoa';
import { problemaTelefone } from '@/utils/telefone';
import { mesmoTelefone, mesmoNome } from '@/utils/contatoEmergencia';

/**
 * Menor de 18 anos.
 *  - acampante (04/11/2026, 20261104d): nome e WhatsApp do responsavel; a
 *    carta continua. Menor = idade de hoje.
 *  - equipante (05/11/2026, 20261105a): nome e WhatsApp do responsavel + so o
 *    NOME COMPLETO do acompanhante (um equipante desta edicao) — o acompanhante
 *    so para quem ainda nao tem 16 anos (20261105c). Sem carta: o
 *    pastor parceiro libera na aprovacao. Menor = ainda nao tem 18 anos
 *    completos no PRIMEIRO dia do projeto (sexta).
 * Nome com nome e sobrenome, diferente do proprio inscrito; WhatsApp de
 * celular, diferente do WhatsApp do proprio inscrito. O servidor confere de
 * novo (_menor_responsavel_erro, gatilho validar_ficha) e tambem recusa
 * responsavel com nome ou WhatsApp de outro inscrito menor.
 */

// Primeiro dia do projeto (configuracoes.data_evento_inicio, 'AAAA-MM-DD'),
// guardado pela tela que carrega a configuracao publica (useInicioDoEvento).
let inicioDoEvento = null;
export const definirInicioDoEvento = (data) => { inicioDoEvento = data || null; };

const paraData = (v) => {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [a, m, d] = s.split('-').map(Number);
  return { a, m, d };
};

/** Idade completa numa data de referencia ('AAAA-MM-DD'). */
const idadeEm = (nascimento, referencia) => {
  const n = paraData(nascimento);
  const r = paraData(referencia);
  if (!n || !r) return null;
  let idade = r.a - n.a;
  if (r.m < n.m || (r.m === n.m && r.d < n.d)) idade -= 1;
  return idade;
};

/**
 * Menor de idade? Equipante: no primeiro dia do projeto (sem data marcada,
 * hoje). Acampante: hoje.
 */
export const ehMenorDeIdade = (dataNascimento, tipo = 'acampante') => {
  if (tipo === 'equipante' && inicioDoEvento) {
    const idade = idadeEm(dataNascimento, inicioDoEvento);
    if (idade !== null) return idade < 18;
  }
  const idade = calcularIdade(dataNascimento);
  return idade !== null && idade < 18;
};

/**
 * Acompanhante no projeto (20261105c): so o EQUIPANTE que ainda nao tem 16
 * anos completos no primeiro dia do projeto. Com 16 ou 17, so o responsavel.
 * Servidor: _equipante_precisa_acompanhante.
 */
export const precisaAcompanhante = (dataNascimento, tipo = 'equipante') => {
  if (tipo !== 'equipante') return false;
  const ref = inicioDoEvento || new Date().toISOString().slice(0, 10);
  const idade = idadeEm(dataNascimento, ref);
  return idade !== null && idade < 16;
};

export const limparNomeResponsavel = limparNomePessoa;

/** Campos de cada pessoa, na ordem em que aparecem no formulario. */
export const PESSOAS_DO_MENOR = [
  { chave: 'responsavel', rotulo: 'responsável', campoNome: 'responsavelNome', campoTel: 'responsavelWhatsapp' },
  // So o nome (20261105a): o sistema acha o equipante pelo nome. So menor de 16 (20261105c).
  { chave: 'acompanhante', rotulo: 'acompanhante', campoNome: 'acompanhanteNome', campoTel: null, soMenorDe16: true },
];

export const pessoasExigidas = (tipo, dataNascimento) =>
  PESSOAS_DO_MENOR.filter((p) => !p.soMenorDe16 || precisaAcompanhante(dataNascimento, tipo));

/** Problema do nome (null = ok ou vazio). */
export const problemaNomeDoMenor = (f, p) =>
  problemaNomePessoa(f[p.campoNome])
  || (mesmoNome(f[p.campoNome], f.nome) ? `O ${p.rotulo} precisa ser outra pessoa — não pode ser você.` : null);

/** Problema do WhatsApp (null = ok ou vazio). */
export const problemaTelDoMenor = (f, p) => {
  if (!p.campoTel) return null;
  const v = String(f[p.campoTel] || '').trim();
  if (!v) return null;
  return problemaTelefone(v, { estrangeiro: !!f.semCpf })
    || (mesmoTelefone(v, f.whatsapp) ? `O WhatsApp do ${p.rotulo} precisa ser diferente do seu.` : null);
};

/** Primeiro problema { titulo, descricao, id } ou null. Adulto: sempre null. */
export const conferirResponsavelMenor = (f, tipo) => {
  if (!ehMenorDeIdade(f.dataNascimento, tipo)) return null;
  for (const p of pessoasExigidas(tipo, f.dataNascimento)) {
    if (!String(f[p.campoNome] || '').trim()) {
      return { titulo: `Informe o nome do ${p.rotulo}`, descricao: `Você é menor de ${p.soMenorDe16 ? 16 : 18} anos: este dado é obrigatório.`, id: p.campoNome };
    }
    let m = problemaNomeDoMenor(f, p);
    if (m) return { titulo: `Confira o nome do ${p.rotulo}`, descricao: m, id: p.campoNome };
    if (!p.campoTel) continue;
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
  const menor = ehMenorDeIdade(f.dataNascimento, tipo);
  const limpo = (v) => (menor ? (String(v || '').trim().replace(/\s+/g, ' ') || null) : null);
  const base = {
    responsavel_nome: limpo(f.responsavelNome),
    responsavel_whatsapp: limpo(f.responsavelWhatsapp),
  };
  if (tipo !== 'equipante') return base;
  return {
    ...base,
    acompanhante_nome: precisaAcompanhante(f.dataNascimento, tipo) ? limpo(f.acompanhanteNome) : null,
    // Nao e mais pedido (20261105a).
    acompanhante_whatsapp: null,
  };
};
