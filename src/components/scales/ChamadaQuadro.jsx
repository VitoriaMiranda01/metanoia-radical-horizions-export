import React, { useEffect, useState } from 'react';
import { ClipboardList, Loader2, RefreshCw, Repeat, Undo2, UserCheck, UserMinus, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { nomeDaIgreja } from '@/constants/igrejas';
import { formatarTelefone } from '@/utils/telefone';
import { fetchChamadaDaEscala, decidirAusente, separarTodosAusentes } from '@/services/scalesService';

const ATUALIZAR_A_CADA_MS = 30000;

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
 *   - Manter na área: algumas vezes a pessoa entra mesmo ausente.
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
  const [confirmandoTodos, setConfirmandoTodos] = useState(false);

  const carregar = async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    const r = await fetchChamadaDaEscala();
    if (!silencioso) setCarregando(false);
    if (r.success) setDados(r.data);
  };

  useEffect(() => {
    const t = setInterval(() => { carregar(true); recarregarTela?.(); }, ATUALIZAR_A_CADA_MS);
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      description: acao === 'manter' ? undefined : 'Está em “Não será escalado”. Dá para trazer de volta em Separados.',
      className: 'bg-green-600 text-white'
    });
    await carregar(true);
    recarregarTudo?.();
  };

  const separarTodos = async () => {
    setConfirmandoTodos(false);
    setOcupado((o) => ({ ...o, todos: true }));
    const r = await separarTodosAusentes();
    setOcupado((o) => ({ ...o, todos: false }));
    if (!r.success) {
      toast({ title: 'Não deu certo', description: r.error, variant: 'destructive' });
      return;
    }
    const erros = r.data?.erros || [];
    toast({
      title: `${r.data?.separados ?? 0} ausente(s) separado(s)`,
      description: erros.length ? `Não deu para: ${erros.join('; ')}` : undefined,
      variant: erros.length ? 'destructive' : undefined,
      className: erros.length ? undefined : 'bg-green-600 text-white'
    });
    await carregar(true);
    recarregarTudo?.();
  };

  const ausentes = dados?.ausentes || [];
  const separados = dados?.separados || [];
  const mantidos = dados?.mantidos || [];
  const porArea = dados?.por_area || [];

  return (
    <Card className="bg-black/40 border-white/10">
      <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 border-b border-white/10">
        <div className="flex items-center gap-2 flex-1">
          <ClipboardList className="h-5 w-5 text-cyan-400 shrink-0" />
          <div>
            <h3 className="font-semibold text-white">Chamada da reunião de escala</h3>
            {resumo && (
              <p className="text-xs text-gray-400">
                <span className="text-green-400">{resumo.presentes ?? 0} presentes</span> ·{' '}
                <span className="text-red-400">{resumo.ausentes ?? 0} ausentes</span> ·{' '}
                {resumo.sem_chamada ?? 0} sem chamada
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setVerAreas((v) => !v)}
            data-dica="Ver quantos presentes e ausentes cada área já marcou."
            className="text-gray-300 hover:text-white hover:bg-white/10">
            {verAreas ? 'Esconder áreas' : 'Por área'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => { carregar(); recarregarTela?.(); }} disabled={carregando}
            data-dica="Buscar a chamada de novo (atualiza sozinha a cada 30 segundos)."
            className="border-white/20 bg-transparent text-gray-300 hover:bg-white/10 hover:text-white">
            {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {verAreas && (
        <div className="px-4 py-3 border-b border-white/10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1 max-h-60 overflow-y-auto">
          {porArea.map((a) => (
            <p key={a.area} className="text-xs text-gray-300 flex justify-between gap-2">
              <span className="truncate">{a.area}</span>
              <span className="shrink-0">
                <span className="text-green-400">{a.presentes}</span>
                {' / '}
                <span className="text-red-400">{a.ausentes}</span>
                {' / '}
                <span className="text-gray-500">{a.total}</span>
              </span>
            </p>
          ))}
          <p className="text-[10px] text-gray-500 sm:col-span-2 lg:col-span-3 mt-1">presentes / ausentes / total</p>
        </div>
      )}

      <div className="p-4 space-y-5">
        {/* Ausentes a definir */}
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <p className="text-sm text-white font-medium flex items-center gap-2 flex-1">
              <UserX className="h-4 w-4 text-red-400" /> Ausentes a definir ({ausentes.length})
            </p>
            {ausentes.length > 1 && (
              confirmandoTodos ? (
                <span className="flex items-center gap-2 text-xs text-gray-300">
                  Separar os {ausentes.length}?
                  <Button size="sm" onClick={separarTodos} className="h-7 bg-red-600 hover:bg-red-700 text-white">Sim</Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmandoTodos(false)}
                    className="h-7 text-gray-400 hover:text-white hover:bg-white/10">Não</Button>
                </span>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setConfirmandoTodos(true)} disabled={ocupado.todos}
                  data-dica="Separar de uma vez todos os ausentes que ainda estão a definir."
                  className="h-7 border-red-500/40 bg-transparent text-red-300 hover:bg-red-500/15 hover:text-red-200">
                  {ocupado.todos ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Separar todos'}
                </Button>
              )
            )}
          </div>
          {ausentes.length === 0 ? (
            <p className="text-xs text-gray-500">Nenhum ausente para decidir agora.</p>
          ) : (
            <ul className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {ausentes.map((p) => (
                <li key={p.escala_id} className="flex flex-col sm:flex-row sm:items-center gap-2 bg-red-500/5 border border-red-500/20 rounded-md px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate flex items-center gap-2">{p.nome} <SeloPago pago={p.pago} /></p>
                    <p className="text-[11px] text-gray-400 truncate">
                      {p.area}{p.cor ? ` · ${p.cor}` : ''}
                      {p.whatsapp ? ` · ${formatarTelefone(p.whatsapp)}` : ''}
                      {' · '}{nomeDaIgreja(p) || '—'}
                      {p.marcado_por ? ` · marcado por ${p.marcado_por}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => decidir(p, 'manter')} disabled={!!ocupado[p.escala_id]}
                      data-dica="A pessoa continua na área mesmo ausente na chamada."
                      className="h-8 border-green-600/40 bg-transparent text-green-300 hover:bg-green-600/15 hover:text-green-200">
                      {ocupado[p.escala_id] === 'manter' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><UserCheck className="h-3.5 w-3.5 mr-1" /> Manter na área</>}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => decidir(p, 'separar')} disabled={!!ocupado[p.escala_id]}
                      data-dica="Tirar da área: vai para Não será escalado, guardando de onde saiu. Dá para trazer de volta."
                      className="h-8 border-red-500/40 bg-transparent text-red-300 hover:bg-red-500/15 hover:text-red-200">
                      {ocupado[p.escala_id] === 'separar' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><UserMinus className="h-3.5 w-3.5 mr-1" /> Separar</>}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Separados */}
        {separados.length > 0 && (
          <div>
            <p className="text-sm text-white font-medium flex items-center gap-2 mb-2">
              <UserMinus className="h-4 w-4 text-amber-400" /> Separados ({separados.length})
              <span className="text-xs font-normal text-gray-500">— estão em “Não será escalado”</span>
            </p>
            <ul className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
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
              {verMantidos ? 'esconder' : `ver ausentes mantidos na área (${mantidos.length})`}
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
      </div>
    </Card>
  );
};

export default ChamadaQuadro;
