import { GROUPS } from '@/utils/gruposTrailha';
import { formatCPF } from '@/utils/formatters';
import { formatarTelefone } from '@/utils/telefone';
import { nomeDoPais } from '@/constants/nacionalidades';

/**
 * Listas dos onibus (Patrick, 12/10/2026). Faz o que era feito a mao:
 * divide os acampantes que PAGARAM pelo numero de onibus (listas iguais, no
 * maximo 1 pessoa de diferenca) e vai enchendo o onibus 1 com os grupos na
 * ordem fixa das cores; quando enche, o resto do grupo comeca o proximo onibus.
 * Dentro do grupo, ordem alfabetica. Recalculada sempre -- nada fica salvo.
 *
 * Lugares por onibus sao opcionais: um onibus menor recebe no maximo os seus
 * lugares e a diferenca vai para os outros. Se nao couber todo mundo, quem
 * sobra aparece em "sem lugar".
 */

const porNome = (a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', { sensitivity: 'base' });

/**
 * Tamanho de cada onibus: o mais igual possivel, respeitando os lugares
 * (null/0/vazio = sem limite). Devolve { tamanhos, semLugar }.
 */
export const tamanhosDosOnibus = (total, lugares) => {
  const n = lugares.length;
  const cap = lugares.map((l) => (Number(l) > 0 ? Math.floor(Number(l)) : Infinity));
  const tamanhos = new Array(n).fill(0);
  let restante = total;
  let abertos = cap.map((_, i) => i);

  // Quem tem menos lugares que a parte igual fica cheio e sai da conta.
  for (;;) {
    if (!abertos.length || restante <= 0) break;
    const parte = Math.ceil(restante / abertos.length);
    const cheios = abertos.filter((i) => cap[i] < parte);
    if (!cheios.length) break;
    cheios.forEach((i) => { tamanhos[i] = cap[i]; restante -= cap[i]; });
    abertos = abertos.filter((i) => !cheios.includes(i));
  }

  if (abertos.length && restante > 0) {
    const base = Math.floor(restante / abertos.length);
    let extra = restante % abertos.length;
    abertos.forEach((i) => {
      tamanhos[i] = base + (extra > 0 ? 1 : 0);
      if (extra > 0) extra -= 1;
    });
    restante = 0;
  }

  return { tamanhos, semLugar: Math.max(0, restante) };
};

/**
 * acampantes: so os que vao (ja filtrados). numero: quantos onibus.
 * lugares: array opcional com os lugares de cada onibus.
 * Devolve { onibus: [{ numero, pessoas, composicao: [{grupo, qtd}] }], semLugar: [] }.
 */
export const dividirEmOnibus = (acampantes, numero, lugares = []) => {
  const n = Math.max(1, Math.floor(Number(numero) || 1));
  const caps = Array.from({ length: n }, (_, i) => lugares[i] ?? null);

  // Ordem fixa das cores; quem esta sem grupo vai no fim.
  const fila = [];
  [...GROUPS, null].forEach((g) => {
    acampantes
      .filter((a) => (g ? a.grupo_trailha === g : !GROUPS.includes(a.grupo_trailha)))
      .sort(porNome)
      .forEach((a) => fila.push(a));
  });

  const { tamanhos } = tamanhosDosOnibus(fila.length, caps);
  let pos = 0;
  const onibus = tamanhos.map((t, i) => {
    const pessoas = fila.slice(pos, pos + t);
    pos += t;
    const composicao = [];
    pessoas.forEach((p) => {
      const grupo = GROUPS.includes(p.grupo_trailha) ? p.grupo_trailha : 'Sem grupo';
      const ultimo = composicao[composicao.length - 1];
      if (ultimo && ultimo.grupo === grupo) ultimo.qtd += 1;
      else composicao.push({ grupo, qtd: 1 });
    });
    return { numero: i + 1, lugares: caps[i] && Number(caps[i]) > 0 ? Number(caps[i]) : null, pessoas, composicao };
  });

  return { onibus, semLugar: fila.slice(pos) };
};

export const textoComposicao = (composicao) =>
  composicao.map((c) => `${c.grupo} ${c.qtd}`).join(' + ') || '—';

/** CPF, ou "Estrangeiro (pais)" para quem se inscreveu sem CPF. */
export const documentoDe = (a) => {
  if (a.cpf) return formatCPF(String(a.cpf));
  if (a.nacionalidade) return `Estrangeiro (${nomeDoPais(a.nacionalidade) || a.nacionalidade})`;
  return '—';
};

export const telefoneDe = (a) => (a.whatsapp ? (formatarTelefone(a.whatsapp) || a.whatsapp) : '—');

export const agoraTexto = () => new Date().toLocaleString('pt-BR', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});
