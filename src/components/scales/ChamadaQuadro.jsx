import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ClipboardList, Loader2, RefreshCw, Search, Repeat, Undo2, UserCheck, UserMinus, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { nomeDaIgreja } from '@/constants/igrejas';
import { formatarTelefone } from '@/utils/telefone';
import { fetchChamadaDaEscala, decidirAusente } from '@/services/scalesService';
import { cn } from '@/lib/utils';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import ChamadaAreaDialog from './ChamadaAreaDialog';
import ChamadaSituacaoLista, { SITUACOES, contaNaChamada, manterEm } from './ChamadaSituacaoLista';
import { carregarChamada } from '@/services/chamadaStore';
import { useAtualizacaoPeriodica } from '@/hooks/useAtualizacaoPeriodica';

const ATUALIZAR_A_CADA_MS = 30000;

// Os numeros do topo viram abas: cada um abre a lista de quem esta nele (21/10/2026).
const ABAS = [
  ['presentes', 'presentes', { ativo: 'border-green-400 bg-green-500/20 text-green-100', normal: 'border-green-500/30 text-green-300 hover:bg-green-500/10' }],
  ['ausentes', 'ausentes', { ativo: 'border-red-400 bg-red-500/20 text-red-100', normal: 'border-red-500/30 text-red-300 hover:bg-red-500/10' }],
  ['sem', 'sem_chamada', { ativo: 'border-amber-300 bg-amber-400/20 text-amber-100', normal: 'border-amber-400/30 text-amber-300 hover:bg-amber-400/10' }]
];

const semAcento = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const SeloPago = ({ pago }) => pago ? (
  <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-300 border border-green-500/30">pago</span>
) : null;

/**
 * Chamada da reuniao de escala, do lado dos organizadores (Patrick,
 * 05/10/2026).
 *
 * Depois da chamada o Dudu REFAZ a escala: quem ficou ausente sai da escala
 * oficial -- mas nao sozinho, e nao de vez. Cada ausente fica "a definir"
 * aqui, e ele decide:
 *   - Manter na área: vira PRESENTE definido pela organizacao (26/10/2026;
 *     antes seguia contando como ausente). mantido_em fica como registro.
 *   - Separar: vai para "Não será escalado", guardando de qual area saiu.
 *     Fica na lista "Separados" e volta quando quiser por "Trocar de área".
 * Nada e apagado.
 *
 * Atualiza sozinho a cada 30s, ja que os lideres fazem a chamada ao mesmo
 * tempo, cada um no seu celular.
 */
const ChamadaQuadro = ({ resumo, recarregarTela, recarregarTudo, onTrocar }) => {
  const { toast } = useToast();
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [verAreas, setVerAreas] = useState(false);
  const [verMantidos, setVerMantidos] = useState(false);
  const [ocupado, setOcupado] = useState({});
  const [areaAberta, setAreaAberta] = useState(null);
  const [situacao, setSituacao] = useState(null);
  const [tique, setTique] = useState(0);
  const [busca, setBusca] = useState('');
  // Minimizado: fica so a linha do titulo, como a fila "A escalar".
  // Lembrado neste navegador.
  const [minimizado, setMinimizado] = useState(() => {
    try { return localStorage.getItem('chamada_quadro_minimizado') === '1'; } catch { return false; }
  });
  const alternarMinimizado = () => setMinimizado((v) => {
    try { localStorage.setItem('chamada_quadro_minimizado', v ? '0' : '1'); } catch { /* sem storage */ }
    return !v;
  });

  const carregar = async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    const r = await fetchChamadaDaEscala();
    if (!silencioso) setCarregando(false);
    if (r.success) setDados(r.data);
    setTique((n) => n + 1);
  };

  // Só com a aba visível. Os números do resumo (situacao_escala) a tela de
  // escalas já atualiza no mesmo intervalo -- não precisa pedir de novo aqui.
  useAtualizacaoPeriodica(() => carregar(true), ATUALIZAR_A_CADA_MS);

  // Os numeros do resumo vem da tela (situacao_escala). Quando eles mudam
  // -- uma troca de area, a chamada de um lider -- a lista acompanha na hora.
  useEffect(() => {
    carregar(dados !== null);
  }, [resumo?.presentes, resumo?.ausentes, resumo?.sem_chamada, resumo?.escalados]); // eslint-disable-line react-hooks/exhaustive-deps

  const decidir = async (p, acao) => {
    setOcupado((o) => ({ ...o, [p.escala_id]: acao }));
    const r = await decidirAusente(p.escala_id, acao);
    setOcupado((o) => ({ ...o, [p.escala_id]: null }));
    if (!r.success) {
      toast({ title: 'Não deu certo', description: r.error, variant: 'destructive' });
      return;
    }
    toast({
      title: acao === 'manter' ? `${p.nome} fica em ${p.area}` : `${p.nome} foi separado`,
      description: acao === 'manter' ? 'Agora conta como presente (definido pela organização).' :'Está em “Não será escalado”. Dá para trazer de volta em Separados.',
      className: 'bg-green-600 text-white'
    });
    await carregar(true);
    recarregarTudo?.();
  };

  // Botao de seguranca no fim do quadro: manda todos os "Ausentes a definir"
  // (sem olhar o filtro da busca) para o Nao sera escalado, de uma vez.
  const [confirmarTodos, setConfirmarTodos] = useState(false);
  const [enviandoTodos, setEnviandoTodos] = useState(false);
  const separarTodos = async () => {
    const lista = (dados?.ausentes || []).filter((p) => contaNaChamada(p.area));
    setConfirmarTodos(false);
    setEnviandoTodos(true);
    let falhas = 0;
    for (const p of lista) {
      const r = await decidirAusente(p.escala_id, 'separar');
      if (!r.success) falhas += 1;
    }
    setEnviandoTodos(false);
    toast(falhas
      ? { title: 'Alguns não foram', description: `${lista.length - falhas} separados; ${falhas} deram erro. Tente de novo.`, variant: 'destructive' }
      : { title: `${lista.length} separados`, description: 'Estão em “Não será escalado”. Dá para trazer de volta em Separados.', className: 'bg-green-600 text-white' });
    await carregar(true);
    recarregarTudo?.();
  };

  const termo = semAcento(busca.trim());
  const bate = (p) => !termo || semAcento(`${p.nome} ${p.area || ''} ${p.separado_de || ''} ${nomeDaIgreja(p) || ''} ${p.whatsapp || ''}`).includes(termo);
  const todosAusentes = (dados?.ausentes || []).filter((p) => contaNaChamada(p.area));
  const ausentes = todosAusentes.filter(bate);
  const todosSeparados = dados?.separados || [];
  const separados = todosSeparados.filter(bate);
  const mantidos = (dados?.mantidos || []).filter((p) => contaNaChamada(p.area));
  const porArea = (dados?.por_area || []).filter((a) => contaNaChamada(a.area));
  // As contas do topo saem das areas que contam (sem Recepcao); antes de a
  // lista chegar, usa os numeros da tela.
  const contas = dados
    ? porArea.reduce((c, a) => ({
      presentes: c.presentes + a.presentes,
      ausentes: c.ausentes + a.ausentes,
      sem_chamada: c.sem_chamada + a.total - a.presentes - a.ausentes
    }), { presentes: 0, ausentes: 0, sem_chamada: 0 })
    : resumo;
  const ausentesPorArea = useMemo(() => {
    const porNome = new Map();
    ausentes.forEach((p) => { if (!porNome.has(p.area)) porNome.set(p.area, []); porNome.get(p.area).push(p); });
    return [...porNome.entries()];
  }, [ausentes]);

  return (
    <Card className="bg-black/40 border-white/10">
      <div className={cn('p-4 flex flex-col sm:flex-row sm:items-center gap-3', !minimizado && 'border-b border-white/10')}>
        <div className="flex items-center gap-2 flex-1">
          <ClipboardList className="h-5 w-5 text-cyan-400 shrink-0" />
          <div>
            <h3 className="font-semibold text-white">Chamada da reunião de escala</h3>
            {!minimizado && <p className="text-xs text-gray-400">Clique num número para ver quem está nele.</p>}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={alternarMinimizado}
            data-dica={minimizado ? 'Mostrar a chamada.' : 'Esconder a chamada (fica só esta linha) para ver melhor a escala.'}
            className="h-8 px-2 text-gray-300 hover:text-white hover:bg-white/10">
            {minimizado ? <ChevronDown className="h-4 w-4 mr-1" /> : <ChevronUp className="h-4 w-4 mr-1" />}
            <span className="text-xs">{minimizado ? 'Mostrar' : 'Minimizar'}</span>
          </Button>
        </div>
        {contas && (
          <div className="flex flex-wrap gap-1.5">
            {ABAS.map(([chave, conta, cores]) => (
              <button key={chave} type="button" onClick={() => { setSituacao((s) => (s === chave && !minimizado ? null : chave)); if (minimizado) alternarMinimizado(); }}
                data-dica={situacao === chave ? 'Esconder a lista.' : `Ver quem está em ${SITUACOES[chave].rotulo}.`}
                className={cn('rounded-full border px-3 py-1 text-xs', situacao === chave ? cores.ativo : cores.normal)}>
                <span className="font-semibold">{contas[conta] ?? 0}</span> {SITUACOES[chave].rotulo.toLowerCase()}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          {!minimizado && <Button size="sm" variant="ghost" onClick={() => setVerAreas((v) => !v)}
            data-dica="Ver quantos presentes e ausentes cada área já marcou."
            className="text-gray-300 hover:text-white hover:bg-white/10">
            {verAreas ? 'Esconder áreas' : 'Por área'}
          </Button>}
          <Button size="sm" variant="outline" onClick={() => { carregar(); recarregarTela?.(); carregarChamada(); }} disabled={carregando}
            data-dica="Buscar a chamada de novo (atualiza sozinha a cada 30 segundos)."
            className="border-white/20 bg-transparent text-gray-300 hover:bg-white/10 hover:text-white">
            {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {verAreas && !minimizado && (
        <div className="px-4 py-3 border-b border-white/10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1 max-h-60 overflow-y-auto">
          {/* Cada area abre a lista dela para a organizacao gerenciar (16/10/2026). */}
          {porArea.map((a) => (
            <button key={a.area} type="button" onClick={() => setAreaAberta(a.area)}
              data-dica={`Abrir a chamada de ${a.area}: marcar presença e trocar atuação e cor.`}
              className="text-xs text-gray-300 flex justify-between gap-2 rounded px-1.5 py-0.5 -mx-1.5 text-left hover:bg-white/10 hover:text-white">
              <span className="truncate underline decoration-white/20 underline-offset-2">{a.area}</span>
              <span className="shrink-0">
                <span className="text-green-400">{a.presentes}</span>
                {' / '}
                <span className="text-red-400">{a.ausentes}</span>
                {' / '}
                <span className={a.total - a.presentes - a.ausentes > 0 ? 'text-amber-300' : 'text-gray-500'}>{a.total - a.presentes - a.ausentes}</span>
                {' / '}
                <span className="text-gray-500">{a.total}</span>
              </span>
            </button>
          ))}
          <p className="text-[10px] text-gray-500 sm:col-span-2 lg:col-span-3 mt-1">presentes / ausentes / <span className="text-amber-300">sem chamada</span> / total · clique numa área para marcar a presença e trocar atuação e cor</p>
        </div>
      )}

      {situacao && !minimizado && (
        <div className="px-4 py-3 border-b border-white/10">
          <p className="text-sm text-white font-medium mb-2">{SITUACOES[situacao].rotulo}</p>
          <ChamadaSituacaoLista situacao={situacao} atualizar={tique} onAbrirArea={setAreaAberta} onDecidir={decidir} />
        </div>
      )}

      {!minimizado && <div className="p-4 space-y-5">
        {((situacao !== 'ausentes' && todosAusentes.length > 0) || todosSeparados.length > 0) && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar ausentes e separados por nome, área, igreja ou telefone..."
              className="h-9 pl-8 bg-black/40 border-white/20 text-white" />
          </div>
        )}
        {/* Ausentes a definir -- com a aba Ausentes aberta, as decisoes ja
            estao nela, separadas por area. */}
        {situacao !== 'ausentes' && <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <p className="text-sm text-white font-medium flex items-center gap-2 flex-1">
              <UserX className="h-4 w-4 text-red-400" /> Ausentes a definir ({ausentes.length})
            </p>
          </div>
          {ausentes.length === 0 ? (
            <p className="text-xs text-gray-500">{todosAusentes.length === 0 ? 'Nenhum ausente para decidir agora.' : 'Ninguém com esse filtro.'}</p>
          ) : (
            <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
              {ausentesPorArea.map(([nomeArea, lista]) => (
              <div key={nomeArea}>
              <button type="button" onClick={() => setAreaAberta(nomeArea)}
                data-dica={`Abrir a chamada de ${nomeArea}: marcar presença e trocar atuação e cor.`}
                className="sticky top-0 z-10 w-full text-left text-xs font-medium text-cyan-300 bg-zinc-950/95 py-1 hover:text-white">
                {nomeArea} <span className="text-gray-500 font-normal">({lista.length})</span>
              </button>
              <ul className="space-y-1.5">
              {lista.map((p) => (
                <li key={p.escala_id} className="flex flex-col sm:flex-row sm:items-center gap-2 bg-red-500/5 border border-red-500/20 rounded-md px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate flex items-center gap-2">{p.nome} <SeloPago pago={p.pago} /></p>
                    <p className="text-[11px] text-gray-400 truncate">
                      {[p.atuacao, p.cor].filter(Boolean).join(' · ') || 'Sem atuação'}
                      {p.whatsapp ? ` · ${formatarTelefone(p.whatsapp)}` : ''}
                      {' · '}{nomeDaIgreja(p) || '—'}
                      {p.marcado_por ? ` · marcado por ${p.marcado_por}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => decidir(p, 'manter')} disabled={!!ocupado[p.escala_id]}
                      data-dica="A pessoa continua na área e passa a contar como presente (definido pela organização)."
                      className="h-8 border-green-600/40 bg-transparent text-green-300 hover:bg-green-600/15 hover:text-green-200">
                      {ocupado[p.escala_id] === 'manter' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><UserCheck className="h-3.5 w-3.5 mr-1" /> {manterEm(p.area)}</>}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => decidir(p, 'separar')} disabled={!!ocupado[p.escala_id]}
                      data-dica="Tirar da área: vai para Não será escalado, guardando de onde saiu. Dá para trazer de volta."
                      className="h-8 border-red-500/40 bg-transparent text-red-300 hover:bg-red-500/15 hover:text-red-200">
                      {ocupado[p.escala_id] === 'separar' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><UserMinus className="h-3.5 w-3.5 mr-1" /> Enviar para o Não será escalado</>}
                    </Button>
                  </div>
                </li>
              ))}
              </ul>
              </div>
              ))}
            </div>
          )}
        </div>}

        {/* Separados */}
        {todosSeparados.length > 0 && (
          <div>
            <p className="text-sm text-white font-medium flex items-center gap-2 mb-2">
              <UserMinus className="h-4 w-4 text-amber-400" /> Separados ({termo ? `${separados.length} de ${todosSeparados.length}` : separados.length})
              <span className="text-xs font-normal text-gray-500">— estão em “Não será escalado”</span>
            </p>
            <ul className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {separados.length === 0 && <li className="text-xs text-gray-500">Ninguém com esse filtro.</li>}
              {separados.map((p) => (
                <li key={p.escala_id} className="flex items-center gap-3 bg-amber-500/5 border border-amber-500/20 rounded-md px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate flex items-center gap-2">{p.nome} <SeloPago pago={p.pago} /></p>
                    <p className="text-[11px] text-gray-400 truncate">
                      saiu de {p.separado_de}
                      {p.whatsapp ? ` · ${formatarTelefone(p.whatsapp)}` : ''}
                      {' · '}{nomeDaIgreja(p) || '—'}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => onTrocar?.(p.escala_id)}
                    data-dica="Trazer de volta: escolher a área (pode ser a mesma de antes)."
                    className="h-8 text-cyan-300 hover:text-white hover:bg-white/10 shrink-0">
                    <Repeat className="h-3.5 w-3.5 mr-1" /> Trazer de volta
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Mantidos mesmo ausentes */}
        {mantidos.length > 0 && (
          <div>
            <button type="button" onClick={() => setVerMantidos((v) => !v)}
              className="text-xs text-gray-400 underline underline-offset-2 hover:text-white flex items-center gap-1">
              <Undo2 className="h-3 w-3" />
              {verMantidos ? 'esconder' : `ver quem faltou e foi mantido na área — agora presente (${mantidos.length})`}
            </button>
            {verMantidos && (
              <ul className="mt-2 space-y-0.5 text-xs text-gray-300">
                {mantidos.map((p) => (
                  <li key={p.escala_id}>
                    {p.nome} <span className="text-gray-500">· {p.area}{p.mantido_por ? ` · mantido por ${p.mantido_por}` : ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {todosAusentes.length > 0 && (
          <div className="pt-3 border-t border-white/10 flex justify-end">
            <Button size="sm" variant="outline" onClick={() => setConfirmarTodos(true)} disabled={enviandoTodos}
              data-dica="Manda todos os ausentes a definir para o Não será escalado de uma vez."
              className="border-red-500/40 bg-transparent text-red-300 hover:bg-red-500/15 hover:text-red-200">
              {enviandoTodos ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <UserMinus className="h-4 w-4 mr-1" />}
              Enviar todos para o Não será escalado ({todosAusentes.length})
            </Button>
          </div>
        )}
      </div>}
      <AlertDialog open={confirmarTodos} onOpenChange={setConfirmarTodos}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar todos para o Não será escalado?</AlertDialogTitle>
            <AlertDialogDescription>
              {todosAusentes.length} {todosAusentes.length === 1 ? 'pessoa ausente sai' : 'pessoas ausentes saem'} das áreas de uma vez.
              Ninguém é apagado: dá para trazer de volta em Separados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={separarTodos}>Sim, enviar todos</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {areaAberta && (
        <ChamadaAreaDialog area={areaAberta}
          onClose={() => { setAreaAberta(null); carregar(true); recarregarTela?.(); carregarChamada(); }}
          onMudou={() => recarregarTudo?.()} />
      )}
    </Card>
  );
};

export default ChamadaQuadro;
