import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { WHATSAPP_ORGANIZACAO } from '@/constants/contato';

/**
 * Aviso de privacidade (LGPD) do equipante (Patrick, 20/10/2026). Fica logo
 * acima do "Enviar Inscrição": enviar o cadastro vale como concordancia (sem
 * caixa de marcar, a pedido dele).
 */
const AvisoPrivacidadeEquipante = () => (
  <div className="space-y-3 rounded-md border border-white/10 bg-white/5 p-4 text-sm leading-relaxed text-white/85">
    <p className="flex items-center gap-2 font-semibold text-white">
      <ShieldCheck className="w-4 h-4 text-emerald-400" />
      Privacidade e proteção de dados (LGPD)
    </p>
    <p>
      Usamos seus dados só para organizar o Metanoia Radical Serra: inscrição, escala, pagamento, logística e
      contato. O cadastro (nome, CPF, contato e igreja) fica guardado por até 24 meses após a sua última
      participação; os dados de cada edição (saúde, áreas de trabalho e autorização do responsável) por até 12
      meses após o evento. Não vendemos seus dados. Para acessar, corrigir ou excluir, fale com a organização
      pelo{' '}
      <a href={WHATSAPP_ORGANIZACAO} target="_blank" rel="noopener noreferrer"
         className="text-emerald-400 hover:text-emerald-300 underline font-medium">
        WhatsApp
      </a>.
    </p>
    <p className="text-white/90 border-l-4 border-blue-500 pl-4 py-1">
      Ao enviar a inscrição, você concorda com este aviso, conforme a Lei nº 13.709/2018 (LGPD). Se for menor
      de 18 anos, seu responsável legal também concorda.
    </p>
  </div>
);

export default AvisoPrivacidadeEquipante;
