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
      Os dados pessoais informados nesta inscrição serão usados somente para a organização e a realização do
      Projeto Metanoia Radical Serra: identificação do equipante, montagem da escala de trabalho, controle de
      inscrição e pagamento, logística do evento e contato em caso de necessidade.
    </p>
    <p>
      Seus dados de cadastro (nome, CPF, contato e igreja) serão mantidos enquanto seu cadastro estiver ativo e
      por até 24 meses após a sua última participação, para facilitar futuras inscrições. As informações
      específicas de cada edição (como dados de saúde, alergias, áreas de trabalho e a autorização do
      responsável, no caso de menor de idade) serão mantidas por até 12 meses após o evento e depois excluídas.
      Podemos guardar por mais tempo apenas o que a lei exigir. Não vendemos seus dados e só os compartilhamos
      com terceiros quando necessário para o evento ou para cumprir obrigação legal.
    </p>
    <p>
      Você pode solicitar acesso, correção ou exclusão dos seus dados a qualquer momento pelo{' '}
      <a href={WHATSAPP_ORGANIZACAO} target="_blank" rel="noopener noreferrer"
         className="text-emerald-400 hover:text-emerald-300 underline font-medium">
        WhatsApp da organização
      </a>.
    </p>
    <p className="text-white/90 border-l-4 border-blue-500 pl-4 py-1">
      Ao clicar em “Enviar Inscrição”, você declara que leu este aviso e concorda com o tratamento dos seus dados
      pessoais nos termos acima, conforme a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais — LGPD).
      Se o equipante for menor de 18 anos, o responsável legal declara estar ciente e de acordo.
    </p>
  </div>
);

export default AvisoPrivacidadeEquipante;
