import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, ClipboardList, Loader2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { nomeDaIgreja } from '@/constants/igrejas';
import { formatarTelefone } from '@/utils/telefone';
import { cn } from '@/lib/utils';
import {
  fetchChamadaDaArea, marcarPresencaOrganizador, definirAtuacao, definirCor
} from '@/services/scalesService';
import { registrarChamadaLocal } from '@/services/chamadaStore';

/**
 * Chamada de uma area, pela organizacao (16/10/2026, Patrick).
 *
 * Abre ao clicar numa area do quadro "Chamada da reuniao de escala". A
 * organizacao marca presente/ausente (vale por cima do que o lider marcou --
 * fica "marcado por Fulano (organização)") e troca atuacao e cor, como o
 * lider faz pelo celular. Atuacao e cor usam as mesmas funcoes da tabela da
 * escala, entao entram na auditoria.
 */

const CORES = { Amarelo: '#facc15', Azul: '#3b82f6', Roxo: '#a855f7', Verde: '#22c55e', Vermelho: '#ef4444' };
const LISTA_CORES = Object.keys(CORES);
const semAcento = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const FILTROS = [
  ['todos', 'Todos', () => true],
  ['sem', 'Sem chamada', (m) => m.presente !== true && m.presente !== false],
  ['presentes', 'Presentes', (m) => m.presente === true],
  ['ausentes', 'Ausentes', (m) => m.presente === false]
];

const ChamadaAreaDialog = ({ area, onClose, onMudou }) => {
  const { toast } = useToast();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [cor, setCor] = useState('');
  const [ocupado, setOcupado] = useState({});
  const [mudou, setMudou] = useState(false);
  const termo = semAcento(useDeferredValue(busca).trim());

  const carregar = useCallback(async () => {
    const r = await fetchChamadaDaArea(area);
    if (!r.success) { setErro(r.error); return; }
    setErro('');
    setDados(r.data);
  }, [area]);

  useEffect(() => { carregar(); }, [carregar]);

  const fechar = useCallback(() => { if (mudou) onMudou?.(); onClose(); }, [mudou, onMudou, onClose]);

  useEffect(() => {
    const aoTeclar = (e) => { if (e.key === 'Escape') fechar(); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [fechar]);

  const membros = dados?.membros || [];
  const atuacoes = dados?.atuacoes || [];
  const semCorPorAtuacao = useMemo(() => Object.fromEntries(atuacoes.map((a) => [a.atuacao, a.sem_cor])), [atuacoes]);

  const contas = useMemo(() => ({
    presentes: membros.filter((m) => m.presente === true).length,
    ausentes: membros.filter((m) => m.presente === false).length,
    sem: membros.filter((m) => m.presente !== true && m.presente !== false).length
  }), [membros]);

  const coresNaLista = useMemo(() => LISTA_CORES.filter((c) => membros.some((m) => m.cor === c)), [membros]);

  const mostrados = useMemo(() => {
    const f = FILTROS.find((x) => x[0] === filtro)[2];
    return membros.filter((m) => f(m)
      && (!cor || (cor === 'sem' ? !m.cor : m.cor === cor))
      && (!termo || semAcento(`${m.nome} ${nomeDaIgreja(m) || ''} ${m.whatsapp || ''}`).includes(termo)));
  }, [membros, filtro, cor, termo]);

  // Muda na tela na hora; se o servidor recusar, volta ao que ele tem.
  const agir = async (m, chave, mudanca, acao, sucesso) => {
    setOcupado((o) => ({ ...o, [m.escala_id]: chave }));
    setDados((d) => ({ ...d, membros: d.membros.map((x) => (x.escala_id === m.escala_id ? { ...x, ...mudanca } : x)) }));
    let ok = false; let msg = ''; let r = null;
    try {
      r = await acao();
      ok = r?.success ?? r?.ok;
      msg = r?.error || r?.erro || '';
    } catch (e) { msg = e.message; }
    // A tabela da escala e o quadro acompanham na hora.
    if (ok && chave === 'p') registrarChamadaLocal(m.escala_id, mudanca.presente, r?.data?.marcado_por || '');
    setOcupado((o) => { const c = { ...o }; delete c[m.escala_id]; return c; });
    if (!ok) toast({ title: 'Não deu certo', description: msg, variant: 'destructive' });
    else {
      setMudou(true);
      if (sucesso) toast({ title: sucesso, className: 'bg-green-600 text-white' });
    }
    carregar();
  };

  const presenca = (m, valor) => agir(m, 'p', { presente: valor, marcado_por: 'você (organização)' },
    () => marcarPresencaOrganizador(m.escala_id, valor));
  const trocarAtuacao = (m, atuacao) => agir(m, 'e', { atuacao, ...(semCorPorAtuacao[atuacao] ? { cor: null } : {}) },
    () => definirAtuacao(m.escala_id, atuacao), `${(m.nome || '').split(' ')[0]} agora é ${atuacao}`);
  const trocarCor = (m, nova) => agir(m, 'e', { cor: nova || null },
    () => definirCor(m.escala_id, nova), nova ? `${(m.nome || '').split(' ')[0]} agora é ${nova}` : 'Cor retirada');

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-2 sm:p-4 z-50" onClick={fechar}>
      <div className="bg-black border border-white/10 rounded-lg shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start gap-4 p-4 sm:p-5 border-b border-white/10 bg-zinc-900">
          <div className="min-w-0">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-cyan-400 shrink-0" /> Chamada · {area}
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              A organização marca a presença e troca atuação e cor — vale por cima do que o líder marcou.
            </p>
            {dados && (
              <p className="text-xs mt-1">
                <span className="text-green-400">{contas.presentes} presentes</span> ·{' '}
                <span className="text-red-400">{contas.ausentes} ausentes</span> ·{' '}
                <span className="text-gray-400">{contas.sem} sem chamada</span> ·{' '}
                <span className="text-gray-500">{membros.length} no total</span>
              </p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={fechar} className="text-gray-400 hover:text-white shrink-0">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-3 sm:p-4 border-b border-white/10 space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, igreja ou telefone..."
              className="h-9 pl-8 bg-black/40 border-white/20 text-white" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTROS.map(([chave, rotulo]) => (
              <button key={chave} type="button" onClick={() => setFiltro(chave)}
                className={cn('rounded-full border px-3 py-1 text-xs',
                  filtro === chave ? 'border-cyan-400 bg-cyan-400/15 text-cyan-100' : 'border-white/15 text-gray-300 hover:bg-white/5')}>
                {rotulo}
              </button>
            ))}
            {dados?.com_cor && coresNaLista.length > 0 && <span className="w-px bg-white/10 mx-1" />}
            {dados?.com_cor && [...coresNaLista, ...(membros.some((m) => !m.cor) ? ['sem'] : [])].map((c) => (
              <button key={c} type="button" onClick={() => setCor((atual) => (atual === c ? '' : c))}
                className={cn('rounded-full border px-3 py-1 text-xs inline-flex items-center gap-1.5',
                  cor === c ? 'border-white/60 bg-white/10 text-white' : 'border-white/15 text-gray-300 hover:bg-white/5')}>
                {c !== 'sem' && <span className="h-2.5 w-2.5 rounded-full" style={{ background: CORES[c] }} />}
                {c === 'sem' ? 'Sem cor' : c}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
          {!dados && !erro && (
            <div className="flex items-center justify-center gap-2 py-12 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" /> Carregando...
            </div>
          )}
          {erro && <p className="text-red-300 text-sm text-center py-12">{erro}</p>}

          {mostrados.map((m) => {
            const emVoo = ocupado[m.escala_id];
            const pendente = m.pendencias?.length > 0;
            const corBloqueada = semCorPorAtuacao[m.atuacao];
            return (
              <div key={m.escala_id} className={cn('rounded-md border p-3 flex flex-col lg:flex-row lg:items-center gap-3',
                m.presente === true ? 'border-green-500/30 bg-green-500/5'
                  : m.presente === false ? 'border-red-500/30 bg-red-500/5' : 'border-white/10 bg-white/5')}>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium flex items-center gap-2 flex-wrap">
                    {m.nome}
                    {m.eh_lider && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">líder</span>}
                    {m.pago && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-300 border border-green-500/30">pago</span>}
                    {pendente && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 inline-flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> pendência
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {nomeDaIgreja(m) || 'Igreja não informada'}
                    {m.whatsapp ? ` · ${formatarTelefone(m.whatsapp)}` : ''}
                  </p>
                  {m.marcado_por && (
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {m.presente ? 'Presente' : 'Ausente'} · marcado por {m.marcado_por}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <select value={m.atuacao || ''} disabled={!!emVoo} onChange={(e) => trocarAtuacao(m, e.target.value)}
                    aria-label={`Atuação de ${m.nome}`}
                    className="h-9 rounded-md border border-white/20 bg-black/50 px-2 text-sm text-white">
                    {!atuacoes.some((a) => a.atuacao === m.atuacao) && <option value={m.atuacao || ''}>{m.atuacao || 'Sem atuação'}</option>}
                    {atuacoes.map((a) => <option key={a.atuacao} value={a.atuacao}>{a.atuacao}</option>)}
                  </select>
                  {dados.com_cor && (
                    <span className="inline-flex items-center gap-1.5">
                      <select value={m.cor || ''} disabled={!!emVoo || corBloqueada} onChange={(e) => trocarCor(m, e.target.value)}
                        aria-label={`Cor de ${m.nome}`} title={corBloqueada ? 'Esta atuação não usa cor.' : undefined}
                        className="h-9 rounded-md border border-white/20 bg-black/50 px-2 text-sm text-white disabled:opacity-50">
                        <option value="">Sem cor</option>
                        {LISTA_CORES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <span className="h-3 w-3 rounded-full border border-white/20" style={{ background: CORES[m.cor] || 'transparent' }} />
                    </span>
                  )}
                  <Button size="sm" disabled={!!emVoo} onClick={() => presenca(m, m.presente === true ? null : true)}
                    className={cn('h-9 px-3', m.presente === true
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-transparent border border-green-600/50 text-green-300 hover:bg-green-600/20')}>
                    {emVoo === 'p' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />} Presente
                  </Button>
                  <Button size="sm" disabled={!!emVoo} onClick={() => presenca(m, m.presente === false ? null : false)}
                    className={cn('h-9 px-3', m.presente === false
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-transparent border border-red-600/50 text-red-300 hover:bg-red-600/20')}>
                    <X className="w-4 h-4 mr-1" /> Ausente
                  </Button>
                </div>
              </div>
            );
          })}
          {dados && mostrados.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-10">{membros.length === 0 ? 'Ninguém nesta área.' : 'Ninguém com esse filtro.'}</p>
          )}
        </div>

        <div className="p-3 border-t border-white/10 bg-zinc-900 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-500">Clicar de novo no botão marcado tira a marcação.</p>
          <Button onClick={fechar} variant="outline" className="border-white/20 bg-transparent text-gray-300 hover:bg-white/10 hover:text-white">
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChamadaAreaDialog;
