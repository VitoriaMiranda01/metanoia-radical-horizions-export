// Formata o periodo do evento (data_evento_inicio/data_evento_fim, ambas
// "YYYY-MM-DD") para exibicao, seguindo as regras combinadas com a usuaria
// em 2026-09-07:
//
//   - Inicio e fim no mesmo mes: lista todos os dias do intervalo, com
//     virgula entre eles e "e" antes do ultimo, seguido de "de <mes> de
//     <ano>". Ex: "29, 30 e 31 de novembro de 2026".
//   - Intervalo atravessa a virada do mes: cada mes forma seu proprio
//     grupo de dias ("<dias> de <mes>"), e os grupos sao unidos entre si
//     com virgula/"e" do mesmo jeito, com o ano aparecendo só no final
//     (ou tambem no meio, se os grupos cairem em anos diferentes). Ex:
//     "30 e 31 de outubro e 01 de novembro de 2026".
//
// Usado tanto na Home (card "Próxima Edição") quanto na tela de boas-vindas
// do acampante -- centralizado aqui pra nao duplicar a logica nos dois
// lugares.

const MESES_MINUSCULO = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
];

// Limite de seguranca -- um intervalo absurdamente longo (provavelmente erro
// de digitação nas datas de Configurações) cai num formato simples em vez
// de listar centenas de dias.
const MAX_DIAS_LISTADOS = 92;

// Junta itens no padrao de lista em portugues: "A", "A e B", "A, B e C".
const juntarListaPortugues = (itens) => {
  if (itens.length === 0) return '';
  if (itens.length === 1) return itens[0];
  if (itens.length === 2) return `${itens[0]} e ${itens[1]}`;
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;
};

export const formatEventDateRange = (dataInicioStr, dataFimStr) => {
  if (!dataInicioStr || !dataFimStr) return null;

  try {
    const inicio = new Date(`${dataInicioStr}T00:00:00`);
    const fim = new Date(`${dataFimStr}T00:00:00`);

    if (isNaN(inicio.getTime()) || isNaN(fim.getTime()) || fim < inicio) {
      return null;
    }

    const diffDias = Math.round((fim - inicio) / (1000 * 60 * 60 * 24)) + 1;
    if (diffDias > MAX_DIAS_LISTADOS) {
      // Fallback simples pra intervalos fora do razoavel pra um acampamento.
      const d1 = String(inicio.getDate()).padStart(2, '0');
      const d2 = String(fim.getDate()).padStart(2, '0');
      const mesInicio = MESES_MINUSCULO[inicio.getMonth()];
      const mesFim = MESES_MINUSCULO[fim.getMonth()];
      return inicio.getMonth() === fim.getMonth() && inicio.getFullYear() === fim.getFullYear()
        ? `${d1} a ${d2} de ${mesInicio} de ${fim.getFullYear()}`
        : `${d1} de ${mesInicio} de ${inicio.getFullYear()} a ${d2} de ${mesFim} de ${fim.getFullYear()}`;
    }

    // Agrupa cada dia do intervalo por mes/ano.
    const grupos = [];
    const cursor = new Date(inicio);
    while (cursor <= fim) {
      const year = cursor.getFullYear();
      const month = cursor.getMonth();
      const day = cursor.getDate();
      const ultimoGrupo = grupos[grupos.length - 1];
      if (ultimoGrupo && ultimoGrupo.year === year && ultimoGrupo.month === month) {
        ultimoGrupo.dias.push(day);
      } else {
        grupos.push({ year, month, dias: [day] });
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    const anoFinal = grupos[grupos.length - 1].year;

    const frasesPorMes = grupos.map((grupo, index) => {
      const diasStr = juntarListaPortugues(grupo.dias.map(d => String(d).padStart(2, '0')));
      let frase = `${diasStr} de ${MESES_MINUSCULO[grupo.month]}`;
      const isUltimoGrupo = index === grupos.length - 1;
      if (isUltimoGrupo || grupo.year !== anoFinal) {
        frase += ` de ${grupo.year}`;
      }
      return frase;
    });

    return juntarListaPortugues(frasesPorMes);
  } catch (e) {
    return null;
  }
};
