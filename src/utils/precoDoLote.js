// Valor do lote vigente hoje (mesma regra da cobranca PIX no servidor e do
// useCurrentPrice): o periodo "DD/MM/AAAA"-"DD/MM/AAAA" que contem a data de
// hoje, inclusive nas pontas. null se nenhum lote cobre hoje.
const paraNumero = (texto) => {
  const m = String(texto || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? Number(`${m[3]}${m[2]}${m[1]}`) : null;
};

export const precoDoLoteHoje = (periodos, agora = new Date()) => {
  if (!Array.isArray(periodos)) return null;
  const hoje = Number(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(agora).replaceAll('-', ''));
  for (const p of periodos) {
    const inicio = paraNumero(p?.start_date);
    const fim = paraNumero(p?.end_date);
    if (inicio === null || fim === null || hoje < inicio || hoje > fim) continue;
    const valor = Number(p?.value);
    if (Number.isFinite(valor) && valor > 0) return valor;
  }
  return null;
};
