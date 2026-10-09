/**
 * Agrupar pessoas pelo mesmo problema de saude / medicamento / restricao
 * alimentar (tela da saude, 09/10/2026).
 *
 * Os tres campos sao texto livre ("Diabetes, preção alta", "Losartana,
 * glifage", "Budesonida 50 mc,Alenia 6/200"). Para juntar quem tem a mesma
 * coisa, cada texto vira uma lista de termos:
 *
 *  - quebra em virgula, ponto e virgula, barra, "+", quebra de linha e " e ";
 *  - tira o que esta entre parenteses, dose ("50 mg", "6/200") e numeros;
 *  - compara sem acento e sem maiuscula;
 *  - problemas e restricoes comuns tem sinonimos e erros de digitacao
 *    juntados num nome so ("hipertensão", "pressão alta", "preção alta" ->
 *    "Pressão alta").
 *
 * Nao e perfeito -- o que nao bate com nenhum sinonimo vira um termo
 * proprio --, por isso a tela tambem tem a busca por texto.
 */

const semAcento = (s) =>
  String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Respostas que nao dizem nada ("N", "não", "nenhum"...).
const VAZIOS = new Set(['', 'n', 's', 'nao', 'sim', 'nenhum', 'nenhuma', 'nada', 'na', 'nt', 'x', 'ok']);

// Sinonimos: [rotulo, expressao sobre o texto ja sem acento e minusculo].
const SINONIMOS_PROBLEMA = [
  ['Pressão alta', /press[ao]+ alta|hipert[ea]n|pre[cs]+[ao]+ alta|impert[ea]n|hipertens/],
  ['Pressão baixa', /press[ao]+ baixa|hipotens/],
  ['Diabetes', /diabet|diabt/],
  ['Asma', /asma/],
  ['Rinite', /rinite|renite/],
  ['Sinusite', /sinusite/],
  ['Bronquite', /bronquite/],
  ['Depressão', /depress/],
  ['Ansiedade', /ansied|panico/],
  ['Epilepsia / convulsão', /epilep|convuls/],
  ['Alergia', /alerg/],
  ['Tireoide', /tireo|tiroi/],
  ['Colesterol', /colester/],
  ['Gastrite / refluxo', /gastrit|reflux/],
  ['TDAH', /tdah|deficit de atencao|hiperativ/],
  ['Autismo (TEA)', /autis|^tea$/],
  ['Enxaqueca', /enxaquec|migran/],
  ['Hérnia de disco', /hernia/],
  ['Platina / pino', /platina|pino/],
  ['Bariátrica', /bariatric/],
  ['Labirintite', /labirint/],
  ['Arritmia / coração', /arritm|cardi|coracao/],
  ['Anemia', /anemia/],
  ['Problema de coluna', /coluna|artrodese|escolios/],
];

// Remedios comuns escritos de varios jeitos (nome comercial, erro de digitacao).
const SINONIMOS_MEDICAMENTO = [
  ['Clonazepam (Rivotril)', /clonazep|rivotril/],
  ['Salbutamol (Aerolin)', /aerolin|^aero$|salbutamol/],
  ['Budesonida / formoterol (Symbicort, Alenia)', /symbicort|alenia|formoterol/],
  ['Metformina (Glifage)', /glifag|metformin/],
  ['Escitalopram', /e?scitalopram|ecitalopram/],
  ['Venlafaxina / desvenlafaxina', /venlafax|valafec|vela?nfax/],
  ['Losartana', /losartan/],
  ['Insulina', /insulin/],
  ['Levotiroxina (Puran, Euthyrox)', /levotirox|puran|euthyrox|synthroid/],
  ['Omeprazol / pantoprazol', /omeprazol|pantoprazol/],
  ['Anticoncepcional', /anticoncep/],
  ['Dipirona', /dipiron/],
  ['Paracetamol', /paracetamol|tylenol/],
  ['Fluoxetina', /fluoxet/],
  ['Sertralina', /sertral/],
];

const SINONIMOS_ALIMENTO = [
  ['Lactose', /lactose|leite/],
  ['Glúten / celíaco', /gluten|celiac/],
  ['Carne de porco', /porco|suin/],
  ['Frutos do mar', /camar|frutos do mar|peixe/],
  ['Açúcar (diabetes)', /acucar|diabet/],
  ['Vegetariano / vegano', /vegetar|vegan/],
  ['Amendoim', /amendoim/],
  ['Ovo', /\bovos?\b/],
];

const CAMPOS = {
  problema: { campo: 'condicoes_medicas', sinonimos: SINONIMOS_PROBLEMA },
  medicamento: { campo: 'medicamentos', sinonimos: SINONIMOS_MEDICAMENTO },
  alimento: { campo: 'restricoes_alimentares', sinonimos: SINONIMOS_ALIMENTO },
};

const capitalizar = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Termos de um texto livre: [{ chave, rotulo }], sem repetir. */
export const termosDoTexto = (texto, tipo) => {
  const { sinonimos } = CAMPOS[tipo];
  const limpo = String(texto || '')
    .replace(/\([^)]*\)?/g, ' ')                   // "(remédio de nariz)"
    .replace(/\d+\s*\/\s*\d+/g, ' ')               // "6/200"
    .replace(/\d+([.,]\d+)?\s*(mg|mcg|mc|ml|g|ui|%)?\b/gi, ' '); // "50 mg", "40mg"
  const vistos = new Map();
  limpo
    .split(/[,;/+\n]|\s+e\s+|\.\s+/i)
    // "cetoprofeno em caso de dor" -> "cetoprofeno"
    .map((p) => p.replace(/\s+(em caso|quando|se sentir|se tiver|caso|para|pra)\s.*$/i, ''))
    .map((p) => p.replace(/[.\-–:]+$/g, '').replace(/^[.\-–:]+/g, '').replace(/\s+/g, ' ').trim())
    .forEach((pedaco) => {
      const base = semAcento(pedaco);
      if (VAZIOS.has(base) || base.length < 3) return;
      const sinonimo = sinonimos.find(([, re]) => re.test(base));
      const termo = sinonimo
        ? { chave: `s:${sinonimo[0]}`, rotulo: sinonimo[0] }
        : { chave: base, rotulo: capitalizar(pedaco) };
      if (!vistos.has(termo.chave)) vistos.set(termo.chave, termo);
    });
  return [...vistos.values()];
};

/** Termos de uma pessoa num dos tres campos (problema, medicamento, alimento). */
export const termosDaPessoa = (pessoa, tipo) => termosDoTexto(pessoa?.[CAMPOS[tipo].campo], tipo);

/**
 * Agrupa uma lista de pessoas: [{ chave, rotulo, ids: Set }], do termo mais
 * comum para o menos comum (empate: ordem alfabetica).
 */
export const agruparTermos = (pessoas, tipo) => {
  const grupos = new Map();
  pessoas.forEach((p) => {
    termosDaPessoa(p, tipo).forEach(({ chave, rotulo }) => {
      if (!grupos.has(chave)) grupos.set(chave, { chave, rotulo, ids: new Set() });
      grupos.get(chave).ids.add(p.id);
    });
  });
  return [...grupos.values()].sort(
    (a, b) => b.ids.size - a.ids.size || a.rotulo.localeCompare(b.rotulo, 'pt-BR')
  );
};

/** Busca sem acento em qualquer pedaco do texto. */
export const contemTexto = (valor, busca) => semAcento(valor).includes(semAcento(busca).trim());
