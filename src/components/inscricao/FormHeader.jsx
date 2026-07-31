import React from 'react';
import { UserPlus, CheckCircle, Clock, XCircle } from 'lucide-react';

const FormHeader = ({ userRole, inscricaoExistente }) => {
  const getStatusInfo = () => {
    if (!inscricaoExistente) {
      return {
        Icon: UserPlus,
        text: "Nova Inscrição",
        color: "text-blue-400",
      };
    }
    
    switch (inscricaoExistente.status) {
      case 'aprovada':
        return {
          Icon: CheckCircle,
          text: "Inscrição Aprovada",
          color: "text-green-400",
        };
      case 'rejeitada':
        return {
          Icon: XCircle,
          text: "Inscrição Rejeitada",
          color: "text-red-400",
        };
      default:
        return {
          Icon: Clock,
          text: "Aguardando Aprovação",
          color: "text-yellow-400",
        };
    }
  };

  const { Icon, text, color } = getStatusInfo();

  return (
    <div className="text-center mb-8">
      <div className={`inline-flex items-center space-x-2 mb-4 ${color}`}>
        <Icon className="w-8 h-8" />
        <h1 className="text-3xl font-bold">{text}</h1>
      </div>
      <p className="text-blue-200">
        {userRole === 'equipante' 
          ? 'Complete sua inscrição como equipante do projeto'
          : 'Complete sua inscrição como acampante do projeto'
        }
      </p>
    </div>
  );
};

export default FormHeader;