import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ClipboardCheck, Loader2, X } from 'lucide-react';
import { fetchEquipantesParaPreEscala } from '@/services/equipantesService';
import { AREAS_INSCRICAO, AREAS_ESPECIAIS } from '@/constants/workAreas';
import { cn } from '@/lib/utils';

const SEM_OPCAO = 'Sem 1ª opção registrada';

const STATUS_CLASSE = {
  pendente: 'bg-amber-500/15 text-amber-300',
  aprovado: 'bg-green-500/15 text-green-400',
  rejeitado: 'bg-red-500/15 text-red-400'
};

// Áreas que hoje são especiais (pré-cadastro por CPF, ver AREAS_ESPECIAIS em
// workAreas.js) mas que ainda aparecem aqui porque alguém marcou como 1ª
// opção ANTES da mudança -- a inscrição é histórica, ninguém escolhe mais
// essas áreas no formulário. Calculado, não hardcoded: se uma área sair de
// AREAS_ESPECIAIS de volta pra AREAS_INSCRICAO, o aviso some sozinho.
const AREAS_VIRARAM_ESPECIAIS = new Set(
  AREAS_ESPECIAIS
    .map((a) => a.label)
    .filter((label) => !AREAS_INSCRICAO.some((a) => a.valor === label))
);

/**
 * "Pré-escala": visão de quantos marcaram cada área como 1ª opção na
 * inscrição, contando TODO MUNDO que já se inscreveu -- de qualquer status,
 * inclusive pendente. Não mexe em nada, não aloca ninguém; é só pra o
 * organizador enxergar a demanda cedo, antes mesmo da fila de aprovação
 * zerar, e planejar a partir disso.
 *
 * Clicar numa área expande a lista de quem marcou ela.
 */
const PreEscalaDialog = ({ onClose }) => {
  const [equipantes, setEquipantes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [abertas, setAbertas] = useState(() => new Set());

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await fetchEquipantesParaPreEscala();
      if (error) {
        setErro(error.message || 'Não foi possível carregar os equipantes.');
      } else {
        setErro('');
        setEquipantes(data || []);
      }
      setLoading(false);
    })();
  }, []);

  // Esc fecha, como em qualquer modal daqui.
  useEffect(() => {
    const aoTeclar = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onClose]);

  const grupos = useMemo(() => {
    const porArea = new Map();
    equipantes.forEach((eq) => {
      const area = eq.area_trabalho_opcao1 || SEM_OPCAO;
      if (!porArea.has(area)) porArea.set(area, []);
      porArea.get(area).push(eq);
    });
    const lista = Array.from(porArea.entries()).map(([area, pessoas]) => ({ area, pessoas }));
    lista.sort((a, b) => b.pessoas.length - a.pessoas.length);
    return lista;
  }, [equipantes]);

  const maiorGrupo = grupos.length > 0 ? grupos[0].pessoas.length : 0;

  const alternar = (area) => {
    setAbertas((atual) => {
      const novo = new Set(atual);
      if (novo.has(area)) novo.delete(area); else novo.add(area);
      return novo;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-black border border-white/10 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start gap-4 p-5 border-b border-white/10 bg-zinc-900">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-teal-400" />
              Pré-escala
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              Todos os equipantes já inscritos -- de qualquer status, inclusive
              pendente -- pela 1ª opção de área que marcaram na inscrição.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-white shrink-0">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-12 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" /> Carregando...
            </div>
          )}

          {!loading && erro && (
            <p className="text-red-300 text-sm text-center py-12">{erro}</p>
          )}

          {!loading && !erro && grupos.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-12">
              Ninguém inscrito ainda.
            </p>
          )}

          {!loading && !erro && grupos.length > 0 && (
            <>
              <p className="text-xs text-gray-500 mb-3">
                Clique numa área pra ver a lista de quem marcou ela como 1ª opção.
              </p>
              <div className="space-y-0.5">
                {grupos.map(({ area, pessoas }) => {
                  const aberta = abertas.has(area);
                  const pct = maiorGrupo > 0 ? (pessoas.length / maiorGrupo) * 100 : 0;
                  const viraEspecial = AREAS_VIRARAM_ESPECIAIS.has(area);

                  return (
                    <div key={area} className="border-b border-white/5 last:border-0">
                      <button
                        type="button"
                        onClick={() => alternar(area)}
                        className={cn(
                          'w-full flex items-center gap-3 py-2 px-1 rounded-md transition-colors text-left',
                          aberta ? 'bg-indigo-500/10' : 'hover:bg-white/5'
                        )}
                      >
                        <span className="w-56 shrink-0 text-sm text-gray-200 truncate flex items-center">
                          {area}
                          {viraEspecial && (
                            <span className="ml-2 shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 whitespace-nowrap">
                              hoje é área especial
                            </span>
                          )}
                        </span>
                        <span className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                          <span
                            className="block h-full rounded-full bg-gradient-to-r from-indigo-600 to-indigo-400"
                            style={{ width: `${pct}%` }}
                          />
                        </span>
                        <span className="w-8 shrink-0 text-right text-sm font-semibold text-white">
                          {pessoas.length}
                        </span>
                        <svg
                          className={cn('w-3.5 h-3.5 shrink-0 text-gray-500 transition-transform', aberta && 'rotate-90 text-indigo-300')}
                          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        >
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </button>

                      {aberta && (
                        <div className="ml-2 mb-2 mt-1 rounded-md border border-white/10 bg-white/[0.03] max-h-56 overflow-y-auto">
                          {pessoas.map((p) => (
                            <div
                              key={p.id}
                              className="flex items-center justify-between gap-3 px-3 py-1.5 border-b border-white/5 last:border-0 text-xs"
                            >
                              <span className="text-gray-200 truncate">{p.nome}</span>
                              <span className="text-gray-500 truncate ml-auto text-right">{p.igreja || 'sem igreja'}</span>
                              <span className={cn('shrink-0 px-2 py-0.5 rounded-full font-medium', STATUS_CLASSE[p.status] || 'bg-white/10 text-gray-400')}>
                                {p.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="p-4 border-t border-white/10 bg-zinc-900 flex justify-end">
          <Button onClick={onClose} variant="outline" className="border-white/20 bg-transparent text-gray-300 hover:bg-white/10 hover:text-white">
            Fechar
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default PreEscalaDialog;
