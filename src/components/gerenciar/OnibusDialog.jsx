import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Bus, ChevronDown, ChevronRight, FileSpreadsheet, Loader2, Lock, Minus, Plus, Printer, Undo2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import GrupoTrilhaTag from '@/components/common/GrupoTrilhaTag';
import {
  desfazerDivisaoOnibus, fecharDivisaoOnibus, fetchRecepcaoLista, moverDeOnibus, salvarConfigOnibus
} from '@/services/recepcaoService';
import { agoraTexto, dividirEmOnibus, documentoDe, montarOnibusFechados, telefoneDe } from '@/utils/onibus';
import { exportarOnibusExcel, imprimirOnibus } from '@/utils/onibusImpressao';
import { dataHora } from '@/utils/recepcao';

/**
 * Listas dos onibus (Patrick, 12/10/2026). Desde 26/10/2026 a lista e a
 * MESMA da recepcao (e dos crachas): pagos, isentos e com pagamento agendado,
 * infiltrados pela mesma regra -- quem esta em "Nao pagaram" fica de fora. Os
 * grupos entram na ordem fixa das cores e, dentro do grupo, por nome.
 * O numero de onibus (e, se quiser, os lugares de cada um) e escolhido aqui.
 * Imprimir: uma folha A4 por onibus. Excel: uma aba por onibus.
 *
 * 25/10/2026 (recepcao dos acampantes, migration 20261025g): o numero de
 * onibus e os lugares ficam salvos -- a recepcao da igreja ve a mesma conta
 * ao vivo. "Fechar a divisao" grava quem vai em qual onibus; fechada, a conta
 * para de mudar sozinha e cada pessoa pode ser trocada de onibus a mao.
 * Quem paga depois de fechar fica em "Pagaram e estao sem onibus".
 */

const MAX_ONIBUS = 10;
const tipoDe = (a) => (a.infiltrado ? 'equipante' : 'acampante');
const chaveDe = (a) => `${tipoDe(a)}:${a.id}`;

const OnibusDialog = ({ isOpen, onClose, acampantes = [] }) => {
  const { toast } = useToast();
  const [numero, setNumero] = useState(4);
  const [lugares, setLugares] = useState([]);
  const [aberto, setAberto] = useState(null);
  const [geradaEm, setGeradaEm] = useState(agoraTexto());
  // Estado salvo no banco: { fechada_em, fechada_por, porPessoa: Map(chave -> onibus),
  // naLista: Map(chave -> pessoa) -- quem esta na lista da recepcao }.
  const [salvo, setSalvo] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [confirmando, setConfirmando] = useState(''); // 'fechar' | 'desfazer'
  const mexeu = useRef(false);

  const carregarSalvo = async () => {
    setCarregando(true);
    try {
      const r = await fetchRecepcaoLista();
      const porPessoa = new Map();
      r.pessoas.forEach((p) => { if (p.onibus) porPessoa.set(`${p.tipo}:${p.id}`, p.onibus); });
      // naLista: chave -> pessoa da recepcao (para quem a tela ainda nao tem).
      const naLista = new Map(r.pessoas.map((p) => [`${p.tipo}:${p.id}`, p]));
      setSalvo({ fechada_em: r.onibus.fechada_em || null, fechada_por: r.onibus.fechada_por || null, porPessoa, naLista });
      mexeu.current = false;
      setNumero(Math.min(MAX_ONIBUS, Math.max(1, Number(r.onibus.numero) || 4)));
      setLugares((r.onibus.lugares || []).map((l) => (Number(l) > 0 ? String(l) : '')));
    } catch (e) {
      setSalvo(null);
      toast({ title: 'Não foi possível ler a divisão salva', description: e.message, variant: 'destructive' });
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (isOpen) { setAberto(null); setConfirmando(''); setGeradaEm(agoraTexto()); carregarSalvo(); }
  }, [isOpen]);

  const fechada = !!salvo?.fechada_em;

  // Numero e lugares mudados aqui ficam salvos (a recepcao usa a mesma conta).
  useEffect(() => {
    if (!isOpen || !salvo || fechada || !mexeu.current) return undefined;
    const t = setTimeout(() => {
      salvarConfigOnibus(numero, lugares).catch((e) =>
        toast({ title: 'Não foi possível salvar o número de ônibus', description: e.message, variant: 'destructive' }));
    }, 800);
    return () => clearTimeout(t);
  }, [numero, lugares, isOpen, salvo, fechada]);

  // Fechar a janela logo depois de mudar o numero cancelaria o salvamento
  // acima: salva antes de fechar (a Presenca dos acampantes rele ao fechar).
  const fecharJanela = async () => {
    if (salvo && !fechada && mexeu.current) {
      mexeu.current = false;
      await salvarConfigOnibus(numero, lugares).catch((e) =>
        toast({ title: 'Não foi possível salvar o número de ônibus', description: e.message, variant: 'destructive' }));
    }
    onClose();
  };

  // Quem vai: a lista da recepcao (mesma regra do banco, _recepcao_participantes).
  // Infiltrados (equipantes da escala oficial, com cor) viajam disfarcados, no
  // grupo deles, sem nenhuma marca na folha nem no Excel.
  // Quem a tela nao tem (ex.: lista da pagina ainda velha) entra com os dados
  // da propria recepcao, para a divisao bater com a que a recepcao ve.
  const daLista = useMemo(() => {
    if (!salvo) return [];
    const daTela = acampantes.filter((a) => salvo.naLista.has(chaveDe(a)));
    const tem = new Set(daTela.map(chaveDe));
    const faltando = [...salvo.naLista.entries()].filter(([k]) => !tem.has(k)).map(([, p]) => ({
      id: p.id, nome: p.nome, sexo: p.sexo, whatsapp: p.whatsapp, igreja: p.igreja,
      grupo_trailha: p.grupo || null, infiltrado: p.tipo === 'equipante',
    }));
    return [...daTela, ...faltando];
  }, [acampantes, salvo]);
  const pagos = daLista;
  const qtdInfiltrados = pagos.filter((a) => a.infiltrado).length;
  const naoPagos = salvo ? acampantes.filter((a) => !a.infiltrado && !salvo.naLista.has(chaveDe(a))).length : 0;

  const { onibus, semLugar } = useMemo(() => {
    if (fechada) {
      // Fechada: a lista + quem ja estava num onibus e saiu dela (pagamento desfeito...).
      const vao = [...daLista, ...acampantes.filter((a) => salvo.porPessoa.has(chaveDe(a)) && !salvo.naLista.has(chaveDe(a)))];
      return montarOnibusFechados(vao, numero, lugares, (a) => salvo.porPessoa.get(chaveDe(a)) || null);
    }
    return dividirEmOnibus(pagos, numero, lugares.slice(0, numero));
  }, [fechada, salvo, acampantes, daLista, pagos, numero, lugares]);

  const mudarNumero = (n) => { mexeu.current = true; setNumero(Math.min(MAX_ONIBUS, Math.max(1, n))); };
  const mudarLugar = (i, v) => {
    mexeu.current = true;
    setLugares((l) => {
      const novo = [...l];
      novo[i] = v.replace(/\D/g, '').slice(0, 3);
      return novo;
    });
  };

  const executar = async (acao, sucesso) => {
    setOcupado(true);
    try {
      await acao();
      if (sucesso) toast({ ...sucesso, className: 'bg-emerald-600 text-white' });
      setConfirmando('');
    } catch (e) {
      toast({ title: 'Não deu certo', description: e?.message || 'Tente de novo.', variant: 'destructive' });
    } finally {
      setOcupado(false);
      await carregarSalvo();
    }
  };

  const fechar = () => executar(
    () => fecharDivisaoOnibus(numero, lugares,
      onibus.flatMap((o) => o.pessoas.map((p) => ({ tipo: tipoDe(p), id: p.id, onibus: o.numero })))),
    { title: 'Divisão fechada', description: 'A recepção já vê esta divisão.' }
  );
  const desfazer = () => executar(() => desfazerDivisaoOnibus(),
    { title: 'Divisão desfeita', description: 'Os ônibus voltam a ser calculados sozinhos.' });
  const mover = (p, valor) => executar(() => moverDeOnibus(tipoDe(p), p.id, valor ? Number(valor) : null));

  const imprimir = (lista) => {
    const agora = agoraTexto();
    setGeradaEm(agora);
    if (!imprimirOnibus(lista, onibus.length, agora)) {
      toast({ title: 'O navegador bloqueou a janela de impressão', description: 'Permita pop-ups para este site e tente de novo.', variant: 'destructive' });
    }
  };

  const baixarExcel = () => {
    const agora = agoraTexto();
    setGeradaEm(agora);
    try {
      exportarOnibusExcel(onibus, semLugar, agora);
    } catch (e) {
      toast({ title: 'Não foi possível gerar a planilha', description: e.message, variant: 'destructive' });
    }
  };

  // Funcao (e nao componente) para o select nao ser recriado a cada desenho.
  const seletorOnibus = (p, atual) => (
    <select value={atual || ''} disabled={ocupado} onChange={(e) => mover(p, e.target.value)}
      aria-label={`Ônibus de ${p.nome}`}
      className="h-7 rounded border border-white/15 bg-zinc-900 px-1.5 text-xs text-white">
      {!atual && <option value="">Escolher...</option>}
      {Array.from({ length: numero }, (_, i) => <option key={i + 1} value={i + 1}>Ônibus {i + 1}</option>)}
      {atual && <option value="">Tirar do ônibus</option>}
    </select>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o) fecharJanela(); }}>
      <DialogContent overlayClassName="bg-black/70" className="bg-neutral-900 border-white/10 text-white sm:max-w-4xl max-h-[90vh] flex flex-col gap-3">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl"><Bus className="w-5 h-5" />Listas dos ônibus</DialogTitle>
          <DialogDescription className="text-gray-400">
            Mesma lista da recepção (pagos, isentos e com pagamento agendado): <span className="text-white font-medium">{pagos.length - qtdInfiltrados}</span>
            {qtdInfiltrados > 0 && <> + {qtdInfiltrados} {qtdInfiltrados === 1 ? 'infiltrado' : 'infiltrados'} (saem na lista como acampantes)</>}
            {naoPagos > 0 && <> · {naoPagos} {naoPagos === 1 ? 'está em “Não pagaram” e fica' : 'estão em “Não pagaram” e ficam'} de fora</>}.
            Os grupos entram na ordem das cores (Vermelho, Amarelo, Verde, Azul, Roxo) e, dentro do grupo, por nome.
            {fechada ? ' A divisão está fechada: só muda a mão.' : ' A divisão é refeita sempre que algo muda, até ser fechada.'}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-gray-300">Número de ônibus</span>
            <div className="inline-flex items-center gap-1">
              <Button type="button" size="icon" variant="outline" aria-label="Menos um ônibus" onClick={() => mudarNumero(numero - 1)} disabled={fechada || numero <= 1}
                className="h-8 w-8 bg-white/5 border-white/10 text-gray-200 hover:bg-white/10 hover:text-white"><Minus className="w-3.5 h-3.5" /></Button>
              <span className="w-8 text-center text-lg font-semibold tabular-nums">{numero}</span>
              <Button type="button" size="icon" variant="outline" aria-label="Mais um ônibus" onClick={() => mudarNumero(numero + 1)} disabled={fechada || numero >= MAX_ONIBUS}
                className="h-8 w-8 bg-white/5 border-white/10 text-gray-200 hover:bg-white/10 hover:text-white"><Plus className="w-3.5 h-3.5" /></Button>
            </div>
            {carregando && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
            <div className="ml-auto flex flex-wrap gap-2">
              <Button type="button" onClick={() => imprimir(onibus)} disabled={!pagos.length}
                data-dica="Abrir a folha para imprimir: uma página por ônibus, com Nº, nome, grupo, CPF, telefone e a coluna Presença."
                className="bg-blue-600 hover:bg-blue-700 text-white"><Printer className="w-4 h-4 mr-2" />Imprimir todos</Button>
              <Button type="button" variant="outline" onClick={baixarExcel} disabled={!pagos.length}
                data-dica="Baixar a planilha: uma aba de resumo e uma aba por ônibus."
                className="bg-white/5 border-white/15 text-gray-200 hover:bg-white/10 hover:text-white"><FileSpreadsheet className="w-4 h-4 mr-2" />Baixar Excel</Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-gray-400">Lugares de cada ônibus (opcional — em branco divide igual)</p>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: numero }, (_, i) => (
                <label key={i} className="inline-flex items-center gap-1.5 text-xs text-gray-300">
                  Ônibus {i + 1}
                  <Input
                    inputMode="numeric" value={lugares[i] || ''} onChange={(e) => mudarLugar(i, e.target.value)} placeholder="—" disabled={fechada}
                    className="h-8 w-16 bg-white/5 border-white/10 text-white text-center placeholder:text-gray-600"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Fechar / desfazer a divisao (a recepcao da igreja ve o que estiver aqui). */}
          {salvo && (
            <div className={`rounded-md border p-2.5 text-sm flex flex-wrap items-center gap-2 ${fechada ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-white/10 bg-black/20'}`}>
              {fechada ? (
                <>
                  <Lock className="w-4 h-4 text-emerald-300 shrink-0" />
                  <span className="flex-1 min-w-[220px] text-emerald-100">
                    Divisão fechada por {salvo.fechada_por || 'organizador'} em {dataHora(salvo.fechada_em)}. Troque alguém de ônibus abrindo a lista.
                  </span>
                  {confirmando === 'desfazer' ? (
                    <>
                      <span className="text-xs text-red-200">As trocas feitas à mão se perdem. Desfazer?</span>
                      <Button size="sm" variant="outline" disabled={ocupado} onClick={() => setConfirmando('')}
                        className="h-8 border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/10">Não</Button>
                      <Button size="sm" disabled={ocupado} onClick={desfazer} className="h-8 bg-red-600 hover:bg-red-700 text-white">
                        {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sim, desfazer'}
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setConfirmando('desfazer')}
                      className="h-8 border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/10">
                      <Undo2 className="w-3.5 h-3.5 mr-1.5" />Desfazer divisão
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <span className="flex-1 min-w-[220px] text-gray-300">
                    A recepção da igreja vê esta divisão ao vivo, como provisória. Fechada, ela não muda mais sozinha.
                  </span>
                  {confirmando === 'fechar' ? (
                    <>
                      <span className="text-xs text-gray-300">Gravar esta divisão?</span>
                      <Button size="sm" variant="outline" disabled={ocupado} onClick={() => setConfirmando('')}
                        className="h-8 border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/10">Não</Button>
                      <Button size="sm" disabled={ocupado} onClick={fechar} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white">
                        {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sim, fechar'}
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" disabled={!pagos.length} onClick={() => setConfirmando('fechar')}
                      data-dica="Gravar quem vai em qual ônibus. Depois dá para trocar cada pessoa à mão."
                      className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white">
                      <Lock className="w-3.5 h-3.5 mr-1.5" />Fechar a divisão
                    </Button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {semLugar.length > 0 && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-sm text-amber-100 space-y-2">
            <p className="flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              {fechada
                ? <span>{semLugar.length} {semLugar.length === 1 ? 'pessoa entrou na lista e está' : 'pessoas entraram na lista e estão'} sem ônibus. Escolha o ônibus de cada uma.</span>
                : <span>Faltam {semLugar.length} {semLugar.length === 1 ? 'lugar' : 'lugares'}: os lugares informados não dão para todos. Quem sobrou vai na aba "Sem lugar" do Excel e não sai na impressão.</span>}
            </p>
            {fechada && (
              <ul className="space-y-1">
                {semLugar.map((p) => (
                  <li key={chaveDe(p)} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="flex-1 min-w-[160px] text-gray-100">{p.nome}</span>
                    <GrupoTrilhaTag grupo={p.grupo_trailha} className="text-[10px] px-2" />
                    {seletorOnibus(p, null)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex-1 min-h-0 max-h-[50vh] overflow-y-auto pr-1 space-y-2">
          {!pagos.length && <p className="text-center py-10 text-gray-500">{salvo ? 'Ninguém na lista da recepção ainda.' : 'Carregando…'}</p>}
          {onibus.map((o) => {
            const expandido = aberto === o.numero;
            return (
              <div key={o.numero} className="rounded-lg border border-white/10 bg-white/5">
                <div className="flex flex-wrap items-center gap-2 p-3">
                  <button type="button" onClick={() => setAberto(expandido ? null : o.numero)} className="flex items-center gap-2 text-left min-w-0 flex-1" aria-expanded={expandido}>
                    {expandido ? <ChevronDown className="w-4 h-4 shrink-0 text-gray-400" /> : <ChevronRight className="w-4 h-4 shrink-0 text-gray-400" />}
                    <span className="font-semibold">Ônibus {o.numero}</span>
                    <span className={`text-sm tabular-nums ${o.lugares && o.pessoas.length > o.lugares ? 'text-amber-300' : 'text-gray-400'}`}>
                      {o.pessoas.length} acampantes{o.lugares ? ` / ${o.lugares} lugares` : ''}
                    </span>
                  </button>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {o.composicao.map((c) => (
                      <span key={c.grupo} className="inline-flex items-center gap-1 text-xs text-gray-300">
                        <GrupoTrilhaTag grupo={c.grupo === 'Sem grupo' ? null : c.grupo} className="text-[10px] px-2" />
                        {c.grupo === 'Sem grupo' && <span className="text-gray-400">Sem grupo</span>}
                        <span className="tabular-nums">{c.qtd}</span>
                      </span>
                    ))}
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={() => imprimir([o])} disabled={!o.pessoas.length}
                    data-dica={`Imprimir só a lista do ônibus ${o.numero}.`}
                    className="h-8 bg-white/5 border-white/10 text-gray-200 hover:bg-white/10 hover:text-white"><Printer className="w-3.5 h-3.5 mr-1.5" />Imprimir</Button>
                </div>
                {expandido && (
                  <div className="border-t border-white/10 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="text-gray-400">
                        <tr>
                          <th className="px-3 py-1.5 text-right w-10">Nº</th>
                          <th className="px-3 py-1.5 text-left">Nome</th>
                          <th className="px-3 py-1.5 text-left">Grupo</th>
                          <th className="px-3 py-1.5 text-left">CPF / Documento</th>
                          <th className="px-3 py-1.5 text-left">Telefone</th>
                          {fechada && <th className="px-3 py-1.5 text-left">Ônibus</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {o.pessoas.map((p, i) => (
                          <tr key={chaveDe(p)} className="border-t border-white/5">
                            <td className="px-3 py-1 text-right text-gray-500 tabular-nums">{i + 1}</td>
                            <td className="px-3 py-1 text-gray-200">{p.nome}</td>
                            <td className="px-3 py-1"><GrupoTrilhaTag grupo={p.grupo_trailha} className="text-[10px] px-2" /></td>
                            <td className="px-3 py-1 text-gray-400 whitespace-nowrap">{documentoDe(p)}</td>
                            <td className="px-3 py-1 text-gray-400 whitespace-nowrap">{telefoneDe(p)}</td>
                            {fechada && <td className="px-3 py-1">{seletorOnibus(p, o.numero)}</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-gray-500">Calculada em {geradaEm}. A folha impressa leva a data e hora em que foi gerada.</p>
      </DialogContent>
    </Dialog>
  );
};

export default OnibusDialog;
