import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Search, UserCheck, UserMinus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { nomeDaIgreja } from '@/constants/igrejas';
import { formatarTelefone } from '@/utils/telefone';
import { cn } from '@/lib/utils';
import { fetchChamadaPorSituacao } from '@/services/scalesService';
import { marcarChamada } from '@/services/chamadaStore';

/**
 * Lista de quem esta numa situacao da chamada -- presentes, ausentes ou sem
 * chamada --, todas as areas juntas (21/10/2026, Patrick). Abre pelos numeros
 * do quadro da chamada. Agrupada por area; busca por nome, igreja ou telefone
 * e filtro por area. A organizacao marca presente/ausente ali mesmo (mesma
 * marcacao da janela da area: vale por cima do lider) e a pessoa muda de lista.
 * Nos ausentes, em vez de presente/ausente, ficam as decisoes dos "Ausentes a
 * definir" (manter na area / enviar para o Nao sera escalado) -- onDecidir.
 */

// Areas que nao passam pela chamada da reuniao: ficam fora do quadro, das
// contas e das listas (21/10/2026, Patrick).
export const FORA_DA_CHAMADA = ['Recepção Sítio', 'Recepção Igreja', 'Equipe de Manutenção'];
export const contaNaChamada = (area) => !FORA_DA_CHAMADA.includes(area);

// "Manter na Copa", "Manter no Guia", "Manter nos Infiltrados" (21/10/2026).
// Area nova fora da lista sai com "em".
const NO = ['Ataque / Madrugada', 'Contêiner', 'Dia do arrebatamento da igreja', 'Espírito Santo', 'Estacionamento',
  'Guia', 'Hospital (Cena teatral)', 'Inimigo', 'Invisível', 'Marcador', 'Pastor Enforcado', 'Pastor Invisível',
  'Presídio', 'Som / Multimídia', 'Som / Projeção', 'Túmulo'];
const NOS = ['Apresentadores', 'Infiltrados', 'Perseguidos', 'Primeiros socorros - Saúde'];
const NA = ['Base Operacional', 'Copa', 'Cozinha', 'Cozinha Igreja', 'Cracolândia', 'Cristolândia', 'Depressão',
  'Equipe de Manutenção', 'Falsa baiana', 'Família', 'Família muçulmana', 'Fotografia', 'Igreja subterrânea',
  'Logística', 'Mesa crachá', 'Recepção Igreja', 'Recepção Sítio', 'Secretaria', 'Segurança', 'Selva'];
export const manterEm = (area) => {
  const prep = NO.includes(area) ? 'no' : NOS.includes(area) ? 'nos' : NA.includes(area) ? 'na' : 'em';
  return `Manter ${prep} ${area}`;
};

const semAcento = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const SITUACOES = {
  presentes: { rotulo: 'Presentes', vazio: 'Ninguém marcado como presente.' },
  ausentes: { rotulo: 'Ausentes', vazio: 'Ninguém marcado como ausente.' },
  sem: { rotulo: 'Sem chamada', vazio: 'Todo mundo já tem a chamada marcada.' }
};

const ChamadaSituacaoLista = ({ situacao, atualizar, onAbrirArea, onDecidir }) => {
  const { toast } = useToast();
  const [pessoas, setPessoas] = useState(null);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [area, setArea] = useState('');
  const [ocupado, setOcupado] = useState({});
  const termo = semAcento(useDeferredValue(busca).trim());

  const carregar = async () => {
    const r = await fetchChamadaPorSituacao(situacao);
    if (!r.success) { setErro(r.error); return; }
    setErro('');
    setPessoas((r.data.pessoas || []).filter((p) => contaNaChamada(p.area)));
  };

  // Troca de situacao comeca do zero; `atualizar` muda quando os numeros do
  // quadro mudam (ou a cada 30 s) e a lista acompanha sem piscar.
  useEffect(() => { setPessoas(null); setArea(''); }, [situacao]);
  useEffect(() => { carregar(); }, [situacao, atualizar]); // eslint-disable-line react-hooks/exhaustive-deps

  const areas = useMemo(() => [...new Set((pessoas || []).map((p) => p.area))], [pessoas]);

  const grupos = useMemo(() => {
    const filtrados = (pessoas || []).filter((p) => (!area || p.area === area)
      && (!termo || semAcento(`${p.nome} ${nomeDaIgreja(p) || ''} ${p.whatsapp || ''}`).includes(termo)));
    const porArea = new Map();
    filtrados.forEach((p) => { if (!porArea.has(p.area)) porArea.set(p.area, []); porArea.get(p.area).push(p); });
    return [...porArea.entries()];
  }, [pessoas, area, termo]);

  const mostrados = grupos.reduce((n, [, lista]) => n + lista.length, 0);

  // Marca na hora; a pessoa sai desta lista quando a lista recarrega.
  const presenca = async (p, valor) => {
    setOcupado((o) => ({ ...o, [p.escala_id]: true }));
    setPessoas((l) => l.map((x) => (x.escala_id === p.escala_id ? { ...x, presente: valor, marcado_por: 'você (organização)' } : x)));
    const r = await marcarChamada(p.escala_id, valor);
    setOcupado((o) => { const c = { ...o }; delete c[p.escala_id]; return c; });
    if (!r.success) toast({ title: 'Não deu certo', description: r.error, variant: 'destructive' });
    carregar();
  };

  const decidir = async (p, acao) => {
    setOcupado((o) => ({ ...o, [p.escala_id]: acao }));
    await onDecidir?.(p, acao);
    setOcupado((o) => { const c = { ...o }; delete c[p.escala_id]; return c; });
    carregar();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, igreja ou telefone..."
            className="h-9 pl-8 bg-black/40 border-white/20 text-white" />
        </div>
        <select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Filtrar por área"
          className="h-9 rounded-md border border-white/20 bg-black/50 px-2 text-sm text-white sm:w-64">
          <option value="">Todas as áreas ({areas.length})</option>
          {areas.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {!pessoas && !erro && (
        <div className="flex items-center justify-center gap-2 py-8 text-gray-400 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      )}
      {erro && <p className="text-red-300 text-sm text-center py-8">{erro}</p>}
      {pessoas && mostrados === 0 && (
        <p className="text-gray-500 text-xs text-center py-6">
          {pessoas.length === 0 ? SITUACOES[situacao].vazio : 'Ninguém com esse filtro.'}
        </p>
      )}

      {pessoas && mostrados > 0 && (
        <div className="max-h-[28rem] overflow-y-auto pr-1 space-y-3">
          {grupos.map(([nomeArea, lista]) => (
            <div key={nomeArea}>
              <button type="button" onClick={() => onAbrirArea?.(nomeArea)}
                data-dica={`Abrir a chamada de ${nomeArea}: marcar presença e trocar atuação e cor.`}
                className="sticky top-0 z-10 w-full text-left text-xs font-medium text-cyan-300 bg-zinc-950/95 py-1 hover:text-white">
                {nomeArea} <span className="text-gray-500 font-normal">({lista.length})</span>
              </button>
              <ul className="space-y-1">
                {lista.map((p) => {
                  const emVoo = ocupado[p.escala_id];
                  return (
                    <li key={p.escala_id} className={cn('flex flex-col sm:flex-row sm:items-center gap-2 rounded-md border px-3 py-1.5',
                      p.presente === true ? 'border-green-500/30 bg-green-500/5'
                        : p.presente === false ? 'border-red-500/30 bg-red-500/5' : 'border-white/10 bg-white/5')}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate flex items-center gap-2">
                          {p.nome}
                          {p.eh_lider && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">líder</span>}
                          {p.pago && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-300 border border-green-500/30">pago</span>}
                          {p.mantido && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-300">mantido na área</span>}
                        </p>
                        <p className="text-[11px] text-gray-400 truncate">
                          {[p.atuacao, p.cor].filter(Boolean).join(' · ') || 'Sem atuação'}
                          {p.whatsapp ? ` · ${formatarTelefone(p.whatsapp)}` : ''}
                          {' · '}{nomeDaIgreja(p) || 'Igreja não informada'}
                          {p.marcado_por ? ` · marcado por ${p.marcado_por}` : ''}
                        </p>
                      </div>
                      {situacao === 'ausentes' ? (
                        !p.mantido && (
                          <div className="flex gap-1.5 shrink-0">
                            <Button size="sm" variant="outline" onClick={() => decidir(p, 'manter')} disabled={!!emVoo}
                              data-dica="A pessoa continua na área mesmo ausente na chamada."
                              className="h-8 border-green-600/40 bg-transparent text-green-300 hover:bg-green-600/15 hover:text-green-200">
                              {emVoo === 'manter' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><UserCheck className="h-3.5 w-3.5 mr-1" /> {manterEm(p.area)}</>}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => decidir(p, 'separar')} disabled={!!emVoo}
                              data-dica="Tirar da área: vai para Não será escalado, guardando de onde saiu. Dá para trazer de volta."
                              className="h-8 border-red-500/40 bg-transparent text-red-300 hover:bg-red-500/15 hover:text-red-200">
                              {emVoo === 'separar' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><UserMinus className="h-3.5 w-3.5 mr-1" /> Enviar para o Não será escalado</>}
                            </Button>
                          </div>
                        )
                      ) : (
                      <div className="flex gap-1.5 shrink-0">
                        <Button size="sm" disabled={!!emVoo} onClick={() => presenca(p, p.presente === true ? null : true)}
                          data-dica={p.presente === true ? 'Tirar a marcação.' : 'Marcar presente.'}
                          className={cn('h-8 px-2.5', p.presente === true
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'bg-transparent border border-green-600/50 text-green-300 hover:bg-green-600/20')}>
                          {emVoo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1" />} Presente
                        </Button>
                        <Button size="sm" disabled={!!emVoo} onClick={() => presenca(p, p.presente === false ? null : false)}
                          data-dica={p.presente === false ? 'Tirar a marcação.' : 'Marcar ausente.'}
                          className={cn('h-8 px-2.5', p.presente === false
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : 'bg-transparent border border-red-600/50 text-red-300 hover:bg-red-600/20')}>
                          <X className="w-3.5 h-3.5 mr-1" /> Ausente
                        </Button>
                      </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
      {pessoas && (
        <p className="text-[10px] text-gray-500">
          {mostrados === pessoas.length ? `${pessoas.length} na lista` : `${mostrados} de ${pessoas.length} na lista`}
          {' · '}clique no nome da área para abrir a chamada dela
          {situacao !== 'ausentes' && ' · clicar de novo no botão marcado tira a marcação'}
        </p>
      )}
    </div>
  );
};

export default ChamadaSituacaoLista;
