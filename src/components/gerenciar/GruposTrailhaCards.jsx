import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, UserCheck, AlertTriangle, Link2, Bus } from 'lucide-react';
import { getGroupColor, getGroupStats, GROUPS } from '@/utils/gruposTrailha';
import { motion } from 'framer-motion';

const GroupCard = ({ name, data, onClick, conflitos = 0 }) => {
  const stats = getGroupStats(data);
  const colors = getGroupColor(name);

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Card 
        className={`cursor-pointer overflow-hidden backdrop-blur-sm transition-all duration-300 ${colors.bg} border ${colors.border} ${colors.hoverBorder}`}
        onClick={() => onClick(name, data)}
        data-dica="Ver os acampantes deste grupo de trilha, realocar e anotar observações."
      >
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className={`text-xl font-bold ${colors.text} tracking-tight`}>{name}</h3>
              {conflitos > 0 && (
                <span
                  className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-amber-300"
                  data-dica="Pares de acampantes vinculados (cônjuge, amigo, parente) que estão juntos neste grupo."
                >
                  <AlertTriangle className="w-3 h-3" />{conflitos} {conflitos === 1 ? 'vínculo' : 'vínculos'} no grupo
                </span>
              )}
            </div>
            <div className={`p-2 rounded-full bg-black/20 ${colors.text}`}>
              <Users className="w-5 h-5" />
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-300 text-sm flex items-center gap-2">
                <UserCheck className="w-4 h-4" /> Total
              </span>
              <span className="text-white font-bold text-lg">{stats.total}</span>
            </div>
            
            <div className="h-px bg-black/10 w-full" />
            
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex flex-col">
                <span className="text-blue-300 text-xs uppercase font-semibold">Homens</span>
                <span className="text-white font-bold">{stats.homens}</span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-pink-300 text-xs uppercase font-semibold">Mulheres</span>
                <span className="text-white font-bold">{stats.mulheres}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// Vinculos (12/10/2026): cada cor mostra quantos pares vinculados estao
// juntos nela, e o botao abre a visao geral (sugestoes da inscricao etc.).
// Ao lado, as listas dos onibus (OnibusDialog).
const GruposTrailhaCards = ({ groupsData, onGroupClick, conflitosPorGrupo = {}, resumoVinculos = null, onAbrirVinculos, onAbrirOnibus }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-4">
        <div className="h-px bg-white/10 flex-1" />
        <span className="text-gray-400 font-medium text-sm uppercase tracking-wider">Grupos de Trilha</span>
        <div className="h-px bg-white/10 flex-1" />
      </div>

      {(onAbrirVinculos || onAbrirOnibus) && (
        <div className="flex flex-wrap justify-center gap-2">
          {onAbrirVinculos && (
          <button
            type="button" onClick={onAbrirVinculos}
            data-dica="Ver quem não deveria ficar no mesmo grupo (cônjuge, amigo, parente), confirmar as sugestões da inscrição e resolver quem está junto."
            className="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm text-gray-200 hover:bg-white/10"
          >
            <span className="inline-flex items-center gap-1.5 font-medium"><Link2 className="w-4 h-4" />Vínculos entre acampantes</span>
            {resumoVinculos && (
              <>
                <span className="text-xs text-sky-300">{resumoVinculos.sugestoes} {resumoVinculos.sugestoes === 1 ? 'sugestão' : 'sugestões'} para confirmar</span>
                {resumoVinculos.conflitos > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-300"><AlertTriangle className="w-3 h-3" />{resumoVinculos.conflitos} no mesmo grupo</span>
                )}
              </>
            )}
          </button>
          )}
          {onAbrirOnibus && (
            <button
              type="button" onClick={onAbrirOnibus}
              data-dica="Dividir os acampantes que pagaram pelos ônibus, por grupo, e imprimir uma lista por ônibus (ou baixar em Excel)."
              className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-white/10"
            >
              <Bus className="w-4 h-4" />Listas dos ônibus
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {GROUPS.map((groupName) => (
          <GroupCard 
            key={groupName} 
            name={groupName} 
            data={groupsData[groupName] || []} 
            onClick={onGroupClick}
            conflitos={conflitosPorGrupo[groupName] || 0} 
          />
        ))}
      </div>
    </div>
  );
};

export default GruposTrailhaCards;