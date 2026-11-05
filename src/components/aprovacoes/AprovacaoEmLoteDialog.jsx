import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Baby, CheckCheck, History, Loader2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { aprovarEmLote, desfazerLoteAprovacao, listarLotesAprovacao } from '@/services/aprovacaoLoteService';
import { igrejaDaLinha, igrejasComInscritos } from '@/utils/exportAprovacoes';
import SeletorIgrejas from './SeletorIgrejas';
import {
  DECLARACAO_MENOR_PEDIDO, DECLARACAO_MENOR_TEXTO, DECLARACAO_MENOR_TEXTO_SEM_ACOMPANHANTE, DECLARACAO_MENOR_TITULO,
} from '@/utils/menorAprovacao';

const quando = (iso) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

/**
 * Aprovacao em lote das inscricoes pendentes -- SO para organizador (Patrick,
 * 07/10/2026). Tres telas na mesma janela:
 *
 *  1. escolher: as igrejas (ou todas);
 *  2. confirmar: o que vai acontecer e a SENHA do organizador -- o servidor
 *     confere (aprovar_em_lote) e so entao aprova;
 *  3. historico: os lotes ja aprovados, com "Desfazer" (desfazer_lote_aprovacao).
 *
 * A tela manda os IDs que o organizador viu e confirmou: inscricao que chegou
 * depois nao entra de carona, e quem ja foi decidido nesse meio-tempo e
 * ignorado pelo servidor.
 *
 * Menores de idade (20261105a): ficam no lote, mas aparecem separados, com a
 * declaracao, todos desmarcados. So os que o organizador marcar entram (o
 * servidor confere: menor sem liberacao fora de p_menores fica pendente).
 */
const AprovacaoEmLoteDialog = ({ aberto, onFechar, dados, onConcluido }) => {
  const { toast } = useToast();
  const [tela, setTela] = useState('escolher');
  const [escolhidas, setEscolhidas] = useState([]);
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [menoresMarcados, setMenoresMarcados] = useState([]);

  const [lotes, setLotes] = useState(null); // null = carregando
  const [aDesfazer, setADesfazer] = useState(null); // id do lote esperando o segundo clique
  const [desfazendo, setDesfazendo] = useState(null);
  const [resultado, setResultado] = useState(null); // { id, texto }

  useEffect(() => {
    if (!aberto) return;
    setTela('escolher'); setEscolhidas([]); setSenha(''); setErro(''); setMenoresMarcados([]);
    setEnviando(false); setADesfazer(null); setDesfazendo(null); setResultado(null); setLotes(null);
  }, [aberto]);

  const igrejas = useMemo(() => igrejasComInscritos(dados), [dados]);
  const marcadas = useMemo(() => new Set(escolhidas), [escolhidas]);
  const todas = igrejas.length > 0 && igrejas.every((i) => marcadas.has(i.igreja));
  const selecionados = useMemo(() => dados.filter((i) => marcadas.has(igrejaDaLinha(i))), [dados, marcadas]);
  const igrejasDoLote = useMemo(() => igrejas.filter((i) => marcadas.has(i.igreja)), [igrejas, marcadas]);
  const menoresDoLote = useMemo(() => selecionados.filter((i) => i.menor && !i.menorLiberado), [selecionados]);
  const menoresOk = useMemo(() => {
    const ids = new Set(menoresDoLote.map((m) => m.id));
    return menoresMarcados.filter((id) => ids.has(id));
  }, [menoresDoLote, menoresMarcados]);
  const totalAprovar = selecionados.length - menoresDoLote.length + menoresOk.length;
  const alternarMenor = (id) => setMenoresMarcados((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  const descricao = todas
    ? `Todas as igrejas (${plural(selecionados.length, 'inscrição', 'inscrições')})`
    : `${plural(selecionados.length, 'inscrição', 'inscrições')} de ${plural(igrejasDoLote.length, 'igreja', 'igrejas')}: ${igrejasDoLote.map((i) => i.igreja).join('; ')}`;

  const carregarLotes = async () => {
    setLotes(null);
    const r = await listarLotesAprovacao();
    setLotes(r.lotes);
    if (!r.success) toast({ title: 'Não deu para carregar os lotes', description: r.error, variant: 'destructive' });
  };

  const abrirHistorico = () => {
    setTela('historico'); setResultado(null); setADesfazer(null);
    carregarLotes();
  };

  const aprovar = async () => {
    if (!senha || enviando || totalAprovar === 0) return;
    setEnviando(true); setErro('');
    const r = await aprovarEmLote(selecionados.map((i) => i.id), senha, descricao, menoresOk);
    setEnviando(false);
    if (!r.success) {
      setErro(r.error);
      if (/senha incorreta/i.test(r.error)) setSenha('');
      return;
    }
    setSenha('');
    toast({
      title: r.aprovados === 0 ? 'Nada foi aprovado' : 'Lote aprovado',
      description: r.aprovados === 0
        ? 'Essas inscrições já tinham sido decididas por outra pessoa.'
        : `${plural(r.aprovados, 'inscrição aprovada', 'inscrições aprovadas')}${(r.ignorados - (r.menores_fora || 0)) > 0 ? ` (${plural(r.ignorados - (r.menores_fora || 0), 'já estava decidida e ficou', 'já estavam decididas e ficaram')} de fora)` : ''}${r.menores_fora ? `. ${plural(r.menores_fora, 'menor de idade não marcado ficou', 'menores de idade não marcados ficaram')} pendente${r.menores_fora === 1 ? '' : 's'}` : ''}. Se foi sem querer, desfaça em Aprovação em lote > Lotes anteriores.`,
      className: r.aprovados === 0 ? undefined : 'bg-green-600 text-white',
    });
    onConcluido?.();
    onFechar();
  };

  const desfazer = async (lote) => {
    setDesfazendo(lote.id);
    const r = await desfazerLoteAprovacao(lote.id);
    setDesfazendo(null); setADesfazer(null);
    if (!r.success) {
      setResultado({ id: lote.id, erro: true, texto: r.error });
    } else {
      const resto = [
        r.escalados ? `${plural(r.escalados, 'já foi escalada', 'já foram escaladas')}` : '',
        r.pagaram ? `${plural(r.pagaram, 'já pagou', 'já pagaram')}` : '',
        r.alterados ? `${plural(r.alterados, 'teve a situação alterada depois', 'tiveram a situação alterada depois')}` : '',
      ].filter(Boolean);
      setResultado({
        id: lote.id,
        texto: `${plural(r.desfeitos, 'inscrição voltou', 'inscrições voltaram')} para Pendentes.${r.nao_desfeitos ? ` ${plural(r.nao_desfeitos, 'ficou', 'ficaram')} como estava: ${resto.join(', ')}.` : ''}`,
      });
      onConcluido?.();
    }
    carregarLotes();
  };

  const titulo = tela === 'confirmar' ? 'Confirmar aprovação em lote'
    : tela === 'historico' ? 'Lotes anteriores'
    : 'Aprovação em lote';

  return (
    <Dialog open={aberto} onOpenChange={(abrir) => { if (!abrir && !enviando) onFechar(); }}>
      <DialogContent className="bg-zinc-900 border border-white/10 text-white sm:max-w-lg max-h-[92vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription className="text-gray-400">
            {tela === 'escolher' && 'Aprova de uma vez as inscrições pendentes das igrejas escolhidas. Só organizadores veem isto.'}
            {tela === 'confirmar' && 'Confira o que vai acontecer e digite a sua senha para confirmar.'}
            {tela === 'historico' && 'Cada aprovação em lote fica guardada aqui. Se foi sem querer, dá para desfazer.'}
          </DialogDescription>
        </DialogHeader>

        {tela === 'escolher' && (
          <>
            <div className="min-w-0 space-y-2 py-2">
              <Label className="text-gray-200">Igrejas</Label>
              <SeletorIgrejas opcoes={igrejas} selecionadas={escolhidas} onChange={setEscolhidas} rotuloQuantidade="inscrições pendentes" />
            </div>
            <DialogFooter className="gap-2 sm:justify-between sm:space-x-0">
              <Button variant="ghost" onClick={abrirHistorico} className="text-gray-300 hover:text-white hover:bg-white/10">
                <History className="w-4 h-4 mr-2" /> Lotes anteriores
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onFechar} className="bg-transparent border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white">Cancelar</Button>
                <Button onClick={() => { setErro(''); setTela('confirmar'); }} disabled={selecionados.length === 0} className="bg-amber-600 hover:bg-amber-700 text-white">
                  Continuar
                </Button>
              </div>
            </DialogFooter>
          </>
        )}

        {tela === 'confirmar' && (
          <>
            <div className="min-w-0 space-y-4 py-2">
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
                <p className="flex items-start gap-2 font-medium">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <span>
                    Você vai aprovar {plural(totalAprovar, 'inscrição pendente', 'inscrições pendentes')}
                    {todas ? ', de todas as igrejas' : ` de ${plural(igrejasDoLote.length, 'igreja', 'igrejas')}`}.
                  </span>
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-9 text-xs text-amber-100/90">
                  <li>Elas passam para Aprovadas e entram na fila para serem escaladas.</li>
                  <li>Fica registrado em seu nome, com data e hora.</li>
                  <li>Se foi sem querer, dá para desfazer em <strong>Lotes anteriores</strong>.</li>
                </ul>
              </div>

              <div className="max-h-40 overflow-y-auto rounded-md border border-white/10 bg-white/5 p-1.5 text-sm">
                {igrejasDoLote.map((i) => (
                  <div key={i.igreja} className="flex items-center justify-between gap-3 px-2 py-1">
                    <span className="min-w-0 truncate">{i.igreja}</span>
                    <span className="shrink-0 tabular-nums text-white/60">{i.quantidade}</span>
                  </div>
                ))}
              </div>

              {menoresDoLote.length > 0 && (
                <div className="rounded-md border border-pink-500/40 bg-pink-500/10 p-3 text-sm text-pink-50">
                  <p className="flex items-start gap-2 font-medium">
                    <Baby className="mt-0.5 h-4 w-4 shrink-0 text-pink-300" />
                    <span>
                      {menoresDoLote.length === 1 ? 'Há 1 menor de idade' : `Há ${menoresDoLote.length} menores de idade`} neste lote.
                      Só entram os que você marcar; os outros continuam pendentes.
                    </span>
                  </p>
                  <div className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-100">
                    <p className="font-semibold text-amber-200">{DECLARACAO_MENOR_TITULO}</p>
                    {/* 20261105c: acompanhante so para menor de 16. */}
                    {(() => {
                      const com = menoresDoLote.some((m) => m.menorInfo?.precisa_acompanhante !== false);
                      const sem = menoresDoLote.some((m) => m.menorInfo?.precisa_acompanhante === false);
                      if (com && sem) {
                        return (
                          <>
                            <p className="mt-1"><strong>Menores de 16 anos:</strong> {DECLARACAO_MENOR_TEXTO}</p>
                            <p className="mt-1"><strong>16 e 17 anos:</strong> {DECLARACAO_MENOR_TEXTO_SEM_ACOMPANHANTE}</p>
                          </>
                        );
                      }
                      return <p className="mt-1">{sem ? DECLARACAO_MENOR_TEXTO_SEM_ACOMPANHANTE : DECLARACAO_MENOR_TEXTO}</p>;
                    })()}
                    <p className="mt-1 font-medium">{DECLARACAO_MENOR_PEDIDO}</p>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                    <span className="text-pink-100/80">{menoresOk.length} de {menoresDoLote.length} marcados</span>
                    <button type="button" className="text-pink-200 underline underline-offset-2 hover:text-white"
                      onClick={() => setMenoresMarcados(menoresOk.length === menoresDoLote.length ? [] : menoresDoLote.map((m) => m.id))}>
                      {menoresOk.length === menoresDoLote.length ? 'Desmarcar todos' : 'Marcar todos'}
                    </button>
                  </div>
                  <div className="mt-1.5 max-h-40 space-y-1 overflow-y-auto">
                    {menoresDoLote.map((m) => (
                      <label key={m.id} className="flex cursor-pointer items-start gap-2 rounded px-1.5 py-1 hover:bg-white/5">
                        <input type="checkbox" checked={menoresOk.includes(m.id)} onChange={() => alternarMenor(m.id)}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-green-600" />
                        <span className="min-w-0">
                          <span className="block truncate text-white">{m.nome}</span>
                          <span className="block truncate text-[11px] text-pink-100/70">
                            {igrejaDaLinha(m)}{m.menorInfo?.responsavel_nome ? ` · responsável: ${m.menorInfo.responsavel_nome}` : ''}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-pink-100/70">
                    Marque só quem teve a autorização confirmada com o responsável. A mensagem pronta para o WhatsApp
                    aparece ao aprovar um a um.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="senha-lote" className="text-gray-200">Digite a sua senha de organizador para confirmar</Label>
                <Input
                  id="senha-lote"
                  type="password"
                  autoComplete="off"
                  autoFocus
                  value={senha}
                  onChange={(e) => { setSenha(e.target.value); setErro(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') aprovar(); }}
                  placeholder="Sua senha"
                  className="bg-white/10 border-white/20 text-white"
                />
                {erro && <p role="alert" className="text-sm text-red-400">{erro}</p>}
              </div>
            </div>
            <DialogFooter className="gap-2 sm:justify-between sm:space-x-0">
              <Button variant="ghost" onClick={() => setTela('escolher')} disabled={enviando} className="text-gray-300 hover:text-white hover:bg-white/10">
                <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
              </Button>
              <Button onClick={aprovar} disabled={!senha || enviando || totalAprovar === 0} className="bg-green-600 hover:bg-green-700 text-white">
                {enviando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCheck className="w-4 h-4 mr-2" />}
                Aprovar {plural(totalAprovar, 'inscrição', 'inscrições')}
              </Button>
            </DialogFooter>
          </>
        )}

        {tela === 'historico' && (
          <>
            <div className="min-w-0 space-y-3 py-2">
              {lotes === null ? (
                <p className="flex items-center justify-center gap-2 py-8 text-sm text-white/60"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</p>
              ) : lotes.length === 0 ? (
                <p className="py-8 text-center text-sm text-white/50">Nenhum lote aprovado até agora.</p>
              ) : lotes.map((l) => (
                <div key={l.id} className="min-w-0 rounded-md border border-white/10 bg-white/5 p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{quando(l.criado_em)} · {l.criado_por}</p>
                      <p className="mt-0.5 break-words text-xs text-white/60">{l.descricao}</p>
                    </div>
                    <span className="shrink-0 rounded-full border border-white/20 px-2 py-0.5 text-xs tabular-nums">{plural(l.total, 'inscrição', 'inscrições')}</span>
                  </div>

                  {l.desfeito_em ? (
                    <p className="mt-2 text-xs text-white/60">
                      Desfeito por {l.desfeito_por} em {quando(l.desfeito_em)}: {plural(l.desfeitos ?? 0, 'voltou', 'voltaram')} para Pendentes
                      {l.nao_desfeitos ? `, ${l.nao_desfeitos} ficou(aram) como estava(m)` : ''}.
                    </p>
                  ) : l.desfazivel > 0 ? (
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-white/60">
                        {l.desfazivel === l.total ? 'Dá para desfazer todas.' : `Dá para desfazer ${l.desfazivel} de ${l.total} (as outras já mudaram de situação, foram escaladas ou pagaram).`}
                      </p>
                      {aDesfazer === l.id ? (
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setADesfazer(null)} disabled={desfazendo === l.id} className="h-8 text-gray-300 hover:text-white hover:bg-white/10">Não</Button>
                          <Button size="sm" onClick={() => desfazer(l)} disabled={desfazendo === l.id} className="h-8 bg-red-600 hover:bg-red-700 text-white">
                            {desfazendo === l.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                            Sim, desfazer {plural(l.desfazivel, 'inscrição', 'inscrições')}
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => { setADesfazer(l.id); setResultado(null); }} className="h-8 bg-transparent border-red-500/50 text-red-300 hover:bg-red-500/10 hover:text-red-200">
                          <Undo2 className="w-3 h-3 mr-1" /> Desfazer lote
                        </Button>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-white/50">Nada mais a desfazer: já mudaram de situação, foram escaladas ou pagaram.</p>
                  )}

                  {resultado?.id === l.id && (
                    <p role="status" className={`mt-2 text-xs ${resultado.erro ? 'text-red-400' : 'text-green-400'}`}>{resultado.texto}</p>
                  )}
                </div>
              ))}
            </div>
            <DialogFooter className="gap-2 sm:justify-between sm:space-x-0">
              <Button variant="ghost" onClick={() => setTela('escolher')} className="text-gray-300 hover:text-white hover:bg-white/10">
                <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
              </Button>
              <Button variant="outline" onClick={onFechar} className="bg-transparent border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white">Fechar</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AprovacaoEmLoteDialog;
