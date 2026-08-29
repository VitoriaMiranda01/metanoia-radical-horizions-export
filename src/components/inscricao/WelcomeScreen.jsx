import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Backpack, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { fetchConfiguracoesEvento } from '@/services/organizerConfigService';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WelcomeScreen = ({
  onProceed
}) => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const { data, error } = await fetchConfiguracoesEvento();

        if (error) throw error;
        setConfig(data);
      } catch (error) {
        console.error('Error fetching event config:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  const formatEventDate = () => {
    if (!config?.data_evento_inicio || !config?.data_evento_fim) {
      return "Data não configurada";
    }

    try {
      const startDate = new Date(config.data_evento_inicio + 'T00:00:00');
      const endDate = new Date(config.data_evento_fim + 'T00:00:00');

      const startDay = startDate.getDate().toString().padStart(2, '0');
      const endDay = endDate.getDate().toString().padStart(2, '0');
      const monthIndex = startDate.getMonth();
      const monthName = MESES[monthIndex];
      const year = startDate.getFullYear();

      return `${startDay} - ${endDay} de ${monthName} de ${year}`;
    } catch (e) {
      return "Data inválida";
    }
  };

  const formatLimitDate = () => {
    if (!config?.data_limite_inscricao_pagamento) return "Não definida";
    try {
      const date = parseISO(config.data_limite_inscricao_pagamento);
      return format(date, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
    } catch {
      return "Não definida";
    }
  };

  const formatHorarioSaida = () => {
    if (!config?.horario_saida_igreja) return "Horário não configurado";
    const parts = config.horario_saida_igreja.split(':');
    if (parts.length >= 2) {
      return `às ${parts[0]}:${parts[1]}`;
    }
    return "Horário não configurado";
  };

  const formatHorarioRetorno = () => {
    if (!config?.horario_retorno_sitio) return "A definir";
    const parts = config.horario_retorno_sitio.split(':');
    if (parts.length >= 2) {
      return `às ${parts[0]}:${parts[1]}`;
    }
    return "A definir";
  };

  const isFullyLoading = loading;

  return (
    <motion.div initial={{
      opacity: 0,
      y: 20
    }} animate={{
      opacity: 1,
      y: 0
    }} transition={{
      duration: 0.5
    }} className="max-w-5xl mx-auto">
      <Card className="glass-effect border-white/10 overflow-hidden bg-black/40">
        <div className="bg-neutral-900 p-4 text-center border-b border-white/10">
           <div className="flex justify-center mb-2">
              <img src="https://horizons-cdn.hostinger.com/13c6e949-152b-4918-9648-ee8b27e5e2cf/ea6fe427e17542cbf0e791fb09fba6dc.png" className="h-16 w-auto" alt="Logo Metanoia Radical" />
           </div>
           <h1 className="text-xl md:text-2xl font-bold text-white uppercase tracking-wider">
             Projeto Metanoia <span className="text-red-600">RADICAL</span> <span className="text-green-600">SERRA</span>
           </h1>
        </div>
        
        <CardContent className="p-0">
          {/* Section 1: Attention */}
          <div className="p-6 space-y-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-6 h-6 text-red-500 mt-1 flex-shrink-0 animate-pulse" />
              <div className="space-y-4 text-gray-300 w-full">
                <h2 className="text-xl font-bold text-red-500 uppercase tracking-wide">ATENÇÃO!</h2>
                
                <ul className="list-disc pl-5 space-y-1 text-gray-300 marker:text-red-500">
                  <li>PREENCHA OS CAMPOS COM BASTANTE ATENÇÃO.</li>
                  <li>TODOS OS SEUS DADOS SÃO NECESSÁRIOS PARA EFETIVAR A INSCRIÇÃO.</li>
                </ul>

                <p className="text-justify leading-relaxed text-gray-400">
                  O ACAMPANTE DEVERÁ ACEITAR O TERMO DE CIÊNCIA E RESPONSABILIDADE QUE CONSTARÁ EM PDF NA
                  PRÓXIMA TELA APÓS INICIAR O SEU CADASTRO, SEM O QUAL A PARTICIPAÇÃO NÃO SERÁ PERMITIDA,
                  ORIENTAMOS BAIXA-LO E LER COM ATENÇÃO.
                </p>

                <div className="bg-neutral-900/50 p-4 rounded-md border border-white/10 space-y-2 mt-4 min-h-[120px] flex flex-col justify-center relative">
                  {isFullyLoading ? (
                    <div className="flex flex-col items-center justify-center space-y-2 absolute inset-0">
                      <Loader2 className="w-6 h-6 text-red-500 animate-spin" />
                      <span className="text-sm text-gray-400">Carregando informações do evento...</span>
                    </div>
                  ) : (
                    <>
                      <p>
                        <span className="font-semibold text-white">Data do evento:</span> {formatEventDate()} -{' '}
                        <span className="font-semibold text-white">Saída da Igreja:</span> {formatHorarioSaida()}
                      </p>
                      <p>
                        <span className="font-semibold text-white">Retorno do sítio:</span> {formatHorarioRetorno()}
                      </p>
                      <p className="font-semibold text-red-400">
                        Data limite para inscrição e pagamento: {formatLimitDate()}
                      </p>
                      <p className="font-semibold text-green-500">
                        Investimento: Valores detalhados na etapa de pagamento (alimentação, transporte e camisa inclusos)
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="h-px bg-white/10 mx-6" />

          {/* Section 2: Backpack */}
          <div className="p-6">
             <div className="flex items-start space-x-3">
                <Backpack className="w-6 h-6 text-green-500 mt-1 flex-shrink-0" />
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-green-500 uppercase">NÃO ESQUEÇA DE LEVAR NA MOCHILA</h3>
                  <p className="text-gray-300 leading-relaxed">
                    Bíblia, roupa de cama, travesseiro, cobertor, toalha de banho, material de higiene e uso pessoal,
                    chinelo, remédio de uso diário (se necessário), repelente, protetor solar. Além das roupas de
                    uso cotidiano, levar um <strong className="text-white">par de tênis velho</strong>, <strong className="text-white">blusa de manga comprida</strong> e uma <strong className="text-white">calça velha</strong>.
                  </p>
                </div>
             </div>
          </div>

          <div className="h-px bg-white/10 mx-6" />

          {/* Footer Motto */}
          <div className="p-6 text-center">
            <h3 className="text-xl md:text-2xl font-bold text-white uppercase tracking-widest">
              VENHA COM MUITA <span className="text-red-600">DISPOSIÇÃO</span> E <span className="text-green-600">CORAGEM</span>!
            </h3>
          </div>

          {/* Action Area */}
          <div className="bg-neutral-900 p-6 border-t border-white/10">
            <div className="flex justify-center">
              <Button onClick={onProceed} disabled={isFullyLoading} className="bg-gradient-to-r from-red-700 to-red-900 hover:from-red-600 hover:to-red-800 text-white font-bold px-8 py-2 disabled:opacity-50">
                Prosseguir
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default WelcomeScreen;