// Especialidade de quem trabalha na Saude (18/10/2026, pedido da Verinha).
//
// A lista de verdade mora no banco (tabela especialidades_saude), porque a
// organizacao pode TORNAR FIXA uma resposta escrita em "Outro". Esta copia so
// e usada se a consulta falhar -- ninguem fica sem responder por isso.

export const AREA_SAUDE = 'Primeiros socorros - Saúde';
export const ESPECIALIDADE_OUTRO = 'Outro';

export const ESPECIALIDADES_SAUDE_PADRAO = [
  'Técnico de enfermagem', 'Enfermagem', 'Médico', 'Socorrista', 'Fisioterapeuta', 'Bombeiro', ESPECIALIDADE_OUTRO,
];

// Quem escolheu Saude em alguma das 3 opcoes da inscricao.
export const escolheuSaude = (form) => [form?.areaTrabalhoOpcao1, form?.areaTrabalhoOpcao2, form?.areaTrabalhoOpcao3]
  .includes(AREA_SAUDE);

// Problema com a resposta (ou null). O servidor confere de novo.
export const problemaEspecialidade = (esp, outro) => {
  if (!esp) return 'Escolha a sua especialidade na área da saúde.';
  if (esp === ESPECIALIDADE_OUTRO) {
    const t = String(outro || '').trim();
    if (t.length < 2) return 'Escreva qual é a sua especialidade.';
    if (t.length > 80) return 'Especialidade muito longa (até 80 letras).';
    if (/[0-9]/.test(t)) return 'Escreva a especialidade só com letras.';
  }
  return null;
};
