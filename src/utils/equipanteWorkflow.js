// Deriva o estágio atual do equipante a partir dos campos reais (idade,
// parental_auth_file_url, status), em vez de depender de uma coluna separada
// (current_stage) que precisava ser mantida em sincronia manualmente em
// vários pontos do código e ficava desatualizada sempre que os campos reais
// eram alterados por outro caminho (painel de workflow do organizador,
// aprovação direta, alocação de escala).
//
// "Autorização pastoral" e "aprovação da inscrição" são o mesmo evento de
// negócio (o pastor/organizador aprova ou rejeita a inscrição do equipante
// na tela de Aprovações) — por isso usamos o campo `status` diretamente,
// sem um `pastoral_auth_status` separado.
export const getEquipanteStageLabel = (equipante) => {
  if (!equipante || equipante.tipo !== 'equipante') return null;

  const idade = Number(equipante.idade);
  const isMinor = !Number.isNaN(idade) && idade < 18;

  if (isMinor && !equipante.parental_auth_file_url) {
    return 'Aguardando autorização dos pais';
  }
  if (equipante.status === 'rejeitado') {
    return 'Inscrição rejeitada';
  }
  if (equipante.status !== 'aprovado') {
    return 'Aguardando autorização pastoral';
  }
  return 'Autorização pastoral concluída';
};
