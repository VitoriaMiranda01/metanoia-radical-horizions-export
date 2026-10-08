/**
 * Linhas de "todas as igrejas cadastradas" -- usadas pelo quadro em
 * Configuracoes e pela planilha (exportListaIgrejas), para os dois mostrarem
 * exatamente a mesma coisa.
 *
 * lista: IGREJAS_PARCEIRAS ("NN - NOME"); relatorio: relatorio_igrejas();
 * contas: listar_contas_parceiros() (pode vir vazio);
 * cadastro: { codigo: { pastor, ... } } de igrejas_cadastro() (pode vir vazio).
 *
 * So entram as igrejas da lista do formulario (parceiras + adicionadas pela
 * organizacao). Sem igreja, NAO CONGREGA, OUTRA e nomes antigos ficam de
 * fora (pedido do Patrick, 04/10/2026).
 */
export const montarLinhasIgrejas = (lista, relatorio, contas = [], cadastro = {}) => {
  const porCodigo = Object.fromEntries((contas || []).map((c) => [String(c.codigo), c]));
  const eq = relatorio?.equipantes || {};
  const ac = relatorio?.acampantes || {};

  const acesso = (c) => {
    if (!c) return '';
    if (c.senha_definida) return 'Senha própria';
    if (c.acesso_liberado) return 'Liberado, sem senha própria';
    return 'Aguardando liberação';
  };

  const linha = (codigo, nome, chave, tipo, conta) => ({
    codigo,
    nome,
    tipo,
    pastor: (codigo && cadastro[codigo]?.pastor) || '',
    responsavel: conta?.responsavel_nome || '',
    acesso: acesso(conta),
    equipantesInscritos: eq[chave]?.inscritos || 0,
    equipantesAprovados: eq[chave]?.aprovados || 0,
    acampantes: ac[chave] || 0,
  });

  const parceiras = lista.map((completo) => {
    const m = String(completo).match(/^(\d+)\s*-\s*(.*)$/);
    const codigo = m ? m[1] : '';
    return linha(codigo, m ? m[2] : completo, completo, 'Parceira', porCodigo[codigo]);
  });
  const adicionadas = (relatorio?.extras || []).map((x) =>
    linha('', x.nome, x.nome, `Adicionada${x.criada_por ? ` por ${x.criada_por}` : ''}`, null));

  return [...parceiras, ...adicionadas];
};
