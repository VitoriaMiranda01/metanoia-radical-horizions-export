import React, { useState } from 'react';
import { CalendarDays, CalendarRange, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * "Você vai em todos os dias ou só no domingo?" (20261025c, Patrick). Aparece
 * antes do formulario, so na janela da inscricao de domingo (segunda a quarta
 * da semana do evento) e so para quem ainda nao tem inscricao nesta edicao.
 * Uma opcao de cada vez; "Continuar" so com uma marcada.
 */
const OPCOES = [
  {
    valor: 'todos',
    icone: CalendarRange,
    titulo: 'Todos os dias',
    texto: 'Inscrição normal, com as áreas de trabalho.',
  },
  {
    valor: 'domingo',
    icone: CalendarDays,
    titulo: 'Somente no domingo',
    texto: 'Inscrição só para o domingo, sem áreas de trabalho.',
  },
];

const EscolherDiasEquipante = ({ onEscolher, onVoltar }) => {
  const [escolha, setEscolha] = useState(null);

  return (
    <Card className="glass-effect border-white/10 bg-black/40 max-w-xl mx-auto">
      <CardHeader>
        <CardTitle className="text-white">Em quais dias você vai?</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div role="radiogroup" aria-label="Em quais dias você vai" className="grid gap-3 sm:grid-cols-2">
          {OPCOES.map(({ valor, icone: Icone, titulo, texto }) => {
            const marcado = escolha === valor;
            return (
              <button
                key={valor}
                type="button"
                role="radio"
                aria-checked={marcado}
                onClick={() => setEscolha(valor)}
                className={cn(
                  'text-left rounded-lg border p-4 transition-colors',
                  marcado
                    ? 'border-blue-400 bg-blue-500/15 ring-2 ring-blue-400/60'
                    : 'border-white/15 bg-white/5 hover:bg-white/10'
                )}
              >
                <span className="flex items-center gap-2 text-white font-semibold">
                  <span className={cn('h-4 w-4 rounded-full border-2 shrink-0',
                    marcado ? 'border-blue-300 bg-blue-400' : 'border-white/40')} />
                  <Icone className="h-4 w-4" /> {titulo}
                </span>
                <span className="block mt-1.5 text-sm text-gray-300">{texto}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={() => onEscolher(escolha)} disabled={!escolha} className="flex-1">
            Continuar <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          {onVoltar && (
            <Button variant="outline" onClick={onVoltar}
              className="flex-1 border-white/20 text-gray-300 hover:text-white">
              Voltar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default EscolherDiasEquipante;
