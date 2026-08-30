// Deriva o estágio atual do equipante a partir dos campos reais (idade,
// parental_auth_file_url, pastoral_auth_status), em vez de depender de uma
// coluna separada (current_stage) que precisava ser mantida em sincronia
// manualmente em vários pontos do código e ficava desatualizada sempre que
// pastoral_auth_status/scale_status eram alterados por outro caminho (painel
// de workflow do organizador, aprovação direta, aprovação automática por
// vínculo de CPF, alocação de escala).
export const getEquipanteStageLabel = (equipante) => {
  if (!equipante || equipante.tipo !== 'equipante') return null;

  const idade = Number(equipante.idade);
  const isMinor = !Number.isNaN(idade) && idade < 18;

  if (isMinor && !equipante.parental_auth_file_url) {
    return 'Aguardando autorização dos pais';
  }
  if (equipante.pastoral_auth_status !== 'ok') {
    return 'Aguardando autorização pastoral';
  }
  return 'Autorização pastoral concluída';
};
