/**
 * Igreja 64 (Metodista Centenario, 26/10/2026): Grupo de Cuidado e EBD
 * respondidos em separado (migration 20261026f). Usado nas telas de aprovacao
 * e no detalhe da inscricao, para a igreja analisar antes de aprovar.
 *
 * Quem respondeu as perguntas novas tem `frequenta_ebd` preenchido (a
 * migration zerou os "false" antigos, que ninguem tinha respondido). Sem ele,
 * a resposta e a da pergunta combinada de antes.
 */

const simNao = (v) => (v === true ? 'Sim' : v === false ? 'Não' : 'Não informado');

export const respondeuGrupoEEbd = (inscricao) =>
  inscricao?.frequenta_ebd === true || inscricao?.frequenta_ebd === false;

/** [{ rotulo, curto, valor }] para mostrar (`curto` so nas respostas novas). */
export const respostasGrupoEEbd = (inscricao) => {
  if (!respondeuGrupoEEbd(inscricao)) {
    return [{ rotulo: 'Frequenta Grupo de Cuidado, Célula ou Escola Bíblica (EBD)?', valor: simNao(inscricao?.frequenta_grupo_cuidado) }];
  }
  const lider = (inscricao.lider_grupo_cuidado || '').trim();
  return [
    {
      rotulo: 'Frequenta Grupo de Cuidado?',
      curto: 'Grupo de Cuidado:',
      valor: inscricao.frequenta_grupo_cuidado === true
        ? (lider ? `Sim — líder: ${lider}` : 'Sim (líder não informado)')
        : simNao(inscricao.frequenta_grupo_cuidado),
    },
    { rotulo: 'Frequenta a Escola Bíblica (EBD)?', curto: 'EBD:', valor: simNao(inscricao.frequenta_ebd) },
  ];
};

/** "Grupo: Sim (líder Fulano) · EBD: Não" -- linha curta da tabela. */
export const resumoGrupoEEbd = (inscricao) => {
  if (!respondeuGrupoEEbd(inscricao)) return '';
  const lider = (inscricao.lider_grupo_cuidado || '').trim();
  const grupo = inscricao.frequenta_grupo_cuidado === true
    ? `Sim${lider ? ` (líder ${lider})` : ''}`
    : simNao(inscricao.frequenta_grupo_cuidado);
  return `Grupo de Cuidado: ${grupo} · EBD: ${simNao(inscricao.frequenta_ebd)}`;
};
