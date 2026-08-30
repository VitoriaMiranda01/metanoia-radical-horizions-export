import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { getEquipanteStageLabel } from '@/utils/equipanteWorkflow';

const getStatusBadge = (status) => {
  const variants = {
    pendente: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
    aprovado: 'bg-green-500/20 text-green-400 border-green-500/50',
    rejeitado: 'bg-red-500/20 text-red-400 border-red-500/50',
  };
  const labels = {
    pendente: 'Pendente',
    aprovado: 'Aprovado',
    rejeitada: 'Rejeitada',
    rejeitado: 'Rejeitado',
  };
  
  const className = `border text-xs md:text-sm ${variants[status] || variants.pendente}`;
  return <Badge className={className} variant="outline">{labels[status] || status}</Badge>;
};

const formatarData = (dataString) => {
  if (!dataString) return '-';
  return new Date(dataString).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const formatBoolean = (value) => {
  if (value === true || value === 'SIM') return 'Sim';
  if (value === false || value === 'NÃO') return 'Não';
  return value || '-';
};

const InscricaoDetalhesModal = ({ inscricao, onClose }) => {
  const displayValue = (value) => {
    if (value === null || value === undefined || value === '') return '-';
    if (typeof value === 'boolean') return formatBoolean(value);
    return value;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-black border border-white/10 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-white/10 bg-zinc-900">
          <h3 className="text-xl md:text-2xl font-bold text-white">Detalhes da Inscrição</h3>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={onClose}
            className="text-white hover:bg-white/10 h-8 w-8 p-0"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 space-y-6">
          
          {/* Responsável pela Ficha */}
          <div className="space-y-3">
            <h4 className="text-lg font-semibold text-blue-400 border-b border-blue-400/30 pb-2">
              Responsável pela Ficha
            </h4>
            <div className="grid grid-cols-1 gap-3">
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Igreja:</span>
                <p className="text-white font-medium">{displayValue(inscricao.admin_responsavel)}</p>
              </div>
            </div>
          </div>

          {/* Dados Pessoais */}
          <div className="space-y-3">
            <h4 className="text-lg font-semibold text-blue-400 border-b border-blue-400/30 pb-2">
              Dados Pessoais
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Nome:</span>
                <p className="text-white font-medium">{displayValue(inscricao.nome)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">CPF:</span>
                <p className="text-white font-medium">{displayValue(inscricao.cpf)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Sexo:</span>
                <p className="text-white font-medium">{displayValue(inscricao.sexo)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Tamanho da Camisa:</span>
                <p className="text-white font-medium">{displayValue(inscricao.tamanho_camisa)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">E-mail:</span>
                <p className="text-white font-medium">{displayValue(inscricao.email)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">WhatsApp:</span>
                <p className="text-white font-medium">{displayValue(inscricao.whatsapp)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Telefone Residencial:</span>
                <p className="text-white font-medium">{displayValue(inscricao.telefone_residencial || inscricao.telefone)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Idade:</span>
                <p className="text-white font-medium">{displayValue(inscricao.idade)}</p>
              </div>
            </div>
          </div>

          {/* Endereço */}
          <div className="space-y-3">
            <h4 className="text-lg font-semibold text-blue-400 border-b border-blue-400/30 pb-2">
              Endereço
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">CEP:</span>
                <p className="text-white font-medium">{displayValue(inscricao.cep)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Rua:</span>
                <p className="text-white font-medium">{displayValue(inscricao.endereco)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Número:</span>
                <p className="text-white font-medium">{displayValue(inscricao.numero)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Complemento:</span>
                <p className="text-white font-medium">{displayValue(inscricao.complemento)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Bairro:</span>
                <p className="text-white font-medium">{displayValue(inscricao.bairro)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Cidade:</span>
                <p className="text-white font-medium">{displayValue(inscricao.cidade)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Estado:</span>
                <p className="text-white font-medium">{displayValue(inscricao.estado)}</p>
              </div>
            </div>
          </div>

          {/* Informações de Saúde */}
          <div className="space-y-3">
            <h4 className="text-lg font-semibold text-blue-400 border-b border-blue-400/30 pb-2">
              Saúde
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Tem algum problema de saúde?</span>
                <p className="text-white font-medium">{formatBoolean(inscricao.tem_problema_saude)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md md:col-span-2">
                <span className="text-sm text-gray-400 block mb-1">Condições Médicas:</span>
                <p className="text-white font-medium">{displayValue(inscricao.condicoes_medicas)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Usa algum medicamento?</span>
                <p className="text-white font-medium">{formatBoolean(inscricao.usa_medicamento)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md md:col-span-2">
                <span className="text-sm text-gray-400 block mb-1">Medicamentos:</span>
                <p className="text-white font-medium">{displayValue(inscricao.medicamentos)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Tem restrição alimentar?</span>
                <p className="text-white font-medium">{formatBoolean(inscricao.tem_restricao_alimentar)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md md:col-span-2">
                <span className="text-sm text-gray-400 block mb-1">Restrições Alimentares:</span>
                <p className="text-white font-medium">{displayValue(inscricao.restricoes_alimentares)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Está grávida?</span>
                <p className="text-white font-medium">{formatBoolean(inscricao.esta_gravida)}</p>
              </div>
            </div>
          </div>

          {/* Informações Eclesiásticas */}
          <div className="space-y-3">
            <h4 className="text-lg font-semibold text-blue-400 border-b border-blue-400/30 pb-2">
              Igreja
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Igreja:</span>
                <p className="text-white font-medium">{displayValue(inscricao.igreja || inscricao.nome_igreja)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">É Pastor?</span>
                <p className="text-white font-medium">{formatBoolean(inscricao.e_pastor)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Pastor (Outro):</span>
                <p className="text-white font-medium">{displayValue(inscricao.e_pastor_outro)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Pastor Responsável:</span>
                <p className="text-white font-medium">{displayValue(inscricao.pastor_nome || inscricao.pastor)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Está afastado da igreja?</span>
                <p className="text-white font-medium">{formatBoolean(inscricao.esta_afastado)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Cargo na Igreja:</span>
                <p className="text-white font-medium">{displayValue(inscricao.cargo_igreja)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Cargo Igreja (Outro):</span>
                <p className="text-white font-medium">{displayValue(inscricao.cargo_igreja_outro)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Frequenta EBD?</span>
                <p className="text-white font-medium">{formatBoolean(inscricao.frequenta_ebd)}</p>
              </div>
            </div>
          </div>

          {/* Habilidades */}
          <div className="space-y-3">
            <h4 className="text-lg font-semibold text-blue-400 border-b border-blue-400/30 pb-2">
              Habilidades
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Você Canta?</span>
                <p className="text-white font-medium">{formatBoolean(inscricao.voce_canta)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Toca Instrumento?</span>
                <p className="text-white font-medium">{formatBoolean(inscricao.toca_instrumento)}</p>
              </div>
            </div>
          </div>

          {/* Familiar */}
          <div className="space-y-3">
            <h4 className="text-lg font-semibold text-blue-400 border-b border-blue-400/30 pb-2">
              Familiar
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Familiar Trabalhando?</span>
                <p className="text-white font-medium">{displayValue(inscricao.familiar_trabalhando)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Familiar Trabalhando (Outro):</span>
                <p className="text-white font-medium">{displayValue(inscricao.familiar_trabalhando_outro)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Parentesco:</span>
                <p className="text-white font-medium">{displayValue(inscricao.parentesco)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Nome do Familiar:</span>
                <p className="text-white font-medium">{displayValue(inscricao.familiar_nome)}</p>
              </div>
            </div>
          </div>

          {/* Experiência */}
          <div className="space-y-3">
            <h4 className="text-lg font-semibold text-blue-400 border-b border-blue-400/30 pb-2">
              Experiência
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Qual Radical Acampante?</span>
                <p className="text-white font-medium">{displayValue(inscricao.qual_radical_acampante)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Qual Radical Acampante (Outro):</span>
                <p className="text-white font-medium">{displayValue(inscricao.qual_radical_acampante_outro)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Número Edição Participou:</span>
                <p className="text-white font-medium">{displayValue(inscricao.numero_edicao_participou)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Já Trabalhou na Equipe?</span>
                <p className="text-white font-medium">{formatBoolean(inscricao.ja_trabalhou_equipe)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Edição que Trabalhou:</span>
                <p className="text-white font-medium">{displayValue(inscricao.edicao_trabalhou)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Deseja Trabalhar nesta Edição?</span>
                <p className="text-white font-medium">{displayValue(inscricao.deseja_trabalhar_edicao)}</p>
              </div>
            </div>
          </div>

          {/* Contato de Emergência */}
          <div className="space-y-3">
            <h4 className="text-lg font-semibold text-blue-400 border-b border-blue-400/30 pb-2">
              Contato de Emergência
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Nome do Contato:</span>
                <p className="text-white font-medium">{displayValue(inscricao.contato_emergencia_nome)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Telefone do Contato:</span>
                <p className="text-white font-medium">{displayValue(inscricao.contato_emergencia_telefone)}</p>
              </div>
            </div>
          </div>

          {/* Áreas de Trabalho */}
          <div className="space-y-3">
            <h4 className="text-lg font-semibold text-blue-400 border-b border-blue-400/30 pb-2">
              Áreas de Trabalho
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Área de Trabalho - Opção 1:</span>
                <p className="text-white font-medium">{displayValue(inscricao.area_trabalho_opcao1)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Área de Trabalho - Opção 2:</span>
                <p className="text-white font-medium">{displayValue(inscricao.area_trabalho_opcao2)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Área de Trabalho - Opção 3:</span>
                <p className="text-white font-medium">{displayValue(inscricao.area_trabalho_opcao3)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Áreas de Trabalho Extra:</span>
                <p className="text-white font-medium">{displayValue(inscricao.area_trabalho_extra)}</p>
              </div>
            </div>
          </div>

          {/* Termos e Responsabilidade */}
          <div className="space-y-3">
            <h4 className="text-lg font-semibold text-blue-400 border-b border-blue-400/30 pb-2">
              Termos
            </h4>
            <div className="grid grid-cols-1 gap-3">
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Autorização de Imagem:</span>
                <p className="text-white font-medium">{formatBoolean(inscricao.autorizacao_imagem)}</p>
              </div>
            </div>
          </div>

          {/* Informações de Pagamento */}
          <div className="space-y-3">
            <h4 className="text-lg font-semibold text-blue-400 border-b border-blue-400/30 pb-2">
              Informações de Pagamento
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Forma de Pagamento:</span>
                <p className="text-white font-medium">{displayValue(inscricao.forma_pagamento)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Status do Pagamento:</span>
                <p className="text-white font-medium">{displayValue(inscricao.status_pagamento)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Data do Pagamento:</span>
                <p className="text-white font-medium">{formatarData(inscricao.data_pagamento)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Método de Pagamento:</span>
                <p className="text-white font-medium">{displayValue(inscricao.metodo_pagamento)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">ID Transação Sicoob:</span>
                <p className="text-white font-medium">{displayValue(inscricao.id_transacao_sicoob)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">TxID PIX:</span>
                <p className="text-white font-medium">{displayValue(inscricao.txid_pix)}</p>
              </div>
            </div>
          </div>

          {/* Informações do Sistema */}
          <div className="space-y-3">
            <h4 className="text-lg font-semibold text-blue-400 border-b border-blue-400/30 pb-2">
              Sistema
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Estágio Atual:</span>
                <p className="text-white font-medium">{displayValue(getEquipanteStageLabel(inscricao))}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Arquivo Autorização Parental:</span>
                <p className="text-white font-medium text-xs break-all">{displayValue(inscricao.parental_auth_file_url)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Data Upload Autorização Parental:</span>
                <p className="text-white font-medium">{formatarData(inscricao.parental_auth_uploaded_at)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Status Autorização Pastoral:</span>
                <p className="text-white font-medium">{displayValue(inscricao.pastoral_auth_status)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Status da Escala:</span>
                <p className="text-white font-medium">{displayValue(inscricao.scale_status)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Número da Edição:</span>
                <p className="text-white font-medium">{displayValue(inscricao.numero_edicao)}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-md">
                <span className="text-sm text-gray-400 block mb-1">Tipo:</span>
                <p className="text-white font-medium">{displayValue(inscricao.tipo)}</p>
              </div>
            </div>
          </div>

          {/* Status e Data */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pt-4 border-t border-white/10">
            <div className="bg-white/5 p-3 rounded-md">
              <span className="text-sm text-gray-400 block mb-1">Status:</span>
              <div className="mt-1">{getStatusBadge(inscricao.status)}</div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default InscricaoDetalhesModal;