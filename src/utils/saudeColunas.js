import { formatarTelefone } from '@/utils/telefone';

/**
 * Colunas da planilha da saude (Exportar Excel da tela /saude). A lider marca
 * quais quer; a ordem e esta.
 */
const descrito = (texto, marcado) => texto || (marcado ? 'Sim (não descreveu)' : '');

export const COLUNAS_SAUDE = [
  { chave: 'nome', rotulo: 'Nome', valor: (p) => p.nome || '' },
  { chave: 'idade', rotulo: 'Idade', valor: (p) => (p.idade ?? '') },
  { chave: 'sexo', rotulo: 'Sexo', valor: (p) => p.sexo || '' },
  { chave: 'igreja', rotulo: 'Igreja', valor: (p) => p.igreja || '' },
  { chave: 'grupo', rotulo: 'Grupo de trilha', valor: (p) => p.grupo_trailha || '' },
  { chave: 'problema', rotulo: 'Problema de saúde', valor: (p) => descrito(p.condicoes_medicas, p.tem_problema_saude) },
  { chave: 'medicamento', rotulo: 'Medicamentos', valor: (p) => descrito(p.medicamentos, p.usa_medicamento) },
  { chave: 'alimento', rotulo: 'Restrição alimentar', valor: (p) => descrito(p.restricoes_alimentares, p.tem_restricao_alimentar) },
  { chave: 'gestante', rotulo: 'Gestante', valor: (p) => (p.esta_gravida ? 'Sim' : '') },
  { chave: 'emergencia_nome', rotulo: 'Contato de emergência', valor: (p) => p.contato_emergencia_nome || '' },
  { chave: 'emergencia_tel', rotulo: 'Telefone de emergência', valor: (p) => formatarTelefone(p.contato_emergencia_telefone) || p.contato_emergencia_telefone || '' },
  { chave: 'whatsapp', rotulo: 'WhatsApp do acampante', valor: (p) => formatarTelefone(p.whatsapp) || p.whatsapp || '' },
  { chave: 'inscricao', rotulo: 'Inscrição', valor: (p) => (p.pago ? 'Paga' : 'Aguardando pagamento') },
];

// Marcadas de saida: tudo menos o WhatsApp do proprio acampante.
export const COLUNAS_SAUDE_PADRAO = COLUNAS_SAUDE.filter((c) => c.chave !== 'whatsapp').map((c) => c.chave);
