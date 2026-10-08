import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Check, Eye, Info, Link2, Loader2, Plus, RotateCcw, Trash2, AlertTriangle, Users } from 'lucide-react';
import {
  fetchOutrasIgrejas,
  fetchPessoasEmOutra,
  vincularOutraIgreja,
  criarIgrejaParceira,
  removerIgrejaExtra
} from '@/services/igrejasExtrasService';
import { limparOpcoesDeIgreja, useOpcoesDeIgreja } from '@/hooks/useOpcoesDeIgreja';
import SeletorIgrejas from '@/components/aprovacoes/SeletorIgrejas';
import { casaBusca } from '@/utils/busca';
import { digitosTelefone, formatarTelefone } from '@/utils/telefone';
import InscricaoDetalhesModal from '@/components/common/InscricaoDetalhesModal';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';

/**
 * A relação das igrejas "OUTRA".
 *
 * Em cima: o que as pessoas escreveram no formulário, com quantas escreveram
 * cada nome — as mais repetidas primeiro. Para cada nome o organizador escolhe:
 *
 *  - VINCULAR a uma igreja que já existe: todas as inscrições que escreveram
 *    aquele nome passam para a igreja certa (e o parceiro dela passa a ver);
 *  - criar a NOVA IGREJA: escreve o nome certo e ela entra no próximo código
 *    disponível, já com conta de parceiro (acesso trancado até a organização
 *    liberar em Senhas dos Parceiros).
 *
 * Embaixo: as igrejas criadas por aqui. Só organizador chega aqui e só
 * organizador passa pelas funções do banco (a checagem não depende deste
 * componente).
 */

const semAcento = (t) => (t || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();

const nomeSemCodigo = (item) => {
  const sep = item.indexOf(' - ');
  return sep === -1 ? item : item.slice(sep + 3);
};

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

// 10/11 digitos viram (24) 99999-9999; outro formato (estrangeiro) vai como esta.
const telefoneLegivel = (valor) => {
  if (!valor) return '';
  const d = digitosTelefone(valor);
  return d.length === 10 || d.length === 11 ? formatarTelefone(d) : String(valor);
};

const ROTULO_STATUS = { pendente: 'Pendente', aprovado: 'Aprovado', rejeitado: 'Rejeitado' };

const OutrasIgrejasManager = () => {
  const { toast } = useToast();
  const [digitadas, setDigitadas] = useState([]);
  const [extras, setExtras] = useState([]);
  const [novas, setNovas] = useState([]);
  const { parceiras } = useOpcoesDeIgreja();
  const [proximoCodigo, setProximoCodigo] = useState('');
  const [permiteOutra, setPermiteOutra] = useState(true);
  const [permiteDiversos, setPermiteDiversos] = useState(true);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [paraRemover, setParaRemover] = useState(null);

  // Janelas: vincular (nome digitado) e criar (nome digitado ou em branco).
  const [vincular, setVincular] = useState(null);   // { nome, quantas, ids|null }
  const [escolhida, setEscolhida] = useState([]);
  const [criar, setCriar] = useState(null);         // { texto: string|null, quantas, ids|null }

  // "Quem escreveu": as fichas de quem digitou aquele nome em OUTRA.
  const [pessoas, setPessoas] = useState(null);      // { nome, lista|null (carregando), marcadas: Set }
  const [ficha, setFicha] = useState(null);
  const [nomeNovo, setNomeNovo] = useState('');
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const r = await fetchOutrasIgrejas();
    if (!r.success) {
      setErro(r.error);
    } else {
      setErro('');
      setDigitadas(r.digitadas);
      setExtras(r.extras);
      setNovas(r.novas);
      setProximoCodigo(r.proximoCodigo);
      setPermiteOutra(r.permiteOutra);
      setPermiteDiversos(r.permiteDiversos);
    }
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const pendentes = useMemo(() => digitadas.filter((d) => !d.ja_na_lista), [digitadas]);

  // Todas as igrejas que existem de verdade: as do arquivo, as criadas por aqui
  // e as acrescentadas sem código.
  const completas = useMemo(
    () => [...new Set([...parceiras, ...novas.map((n) => `${n.codigo} - ${n.nome}`)]), ...extras.map((x) => x.nome)],
    [parceiras, novas, extras]
  );
  const opcoesDeVinculo = useMemo(() => completas.map((igreja) => ({ igreja })), [completas]);

  const nomesExistentes = useMemo(() => completas.map((c) => semAcento(nomeSemCodigo(c))), [completas]);
  const jaExiste = (nome) => nomesExistentes.includes(semAcento(nome));

  const aposMudar = () => { limparOpcoesDeIgreja(); carregar(); };

  // --- quem escreveu --------------------------------------------------------
  const abrirPessoas = async (d) => {
    setPessoas({ nome: d.nome, lista: null, marcadas: new Set() });
    const r = await fetchPessoasEmOutra(d.nome);
    if (!r.success) {
      toast({ title: 'Não deu para carregar', description: r.error, variant: 'destructive' });
      setPessoas(null);
      return;
    }
    setPessoas({ nome: d.nome, lista: r.pessoas, marcadas: new Set(r.pessoas.map((p) => p.id)) });
  };

  const alternarPessoa = (id) => setPessoas((p) => {
    const marcadas = new Set(p.marcadas);
    if (marcadas.has(id)) marcadas.delete(id); else marcadas.add(id);
    return { ...p, marcadas };
  });

  const alternarTodas = () => setPessoas((p) => ({
    ...p,
    marcadas: p.marcadas.size === p.lista.length ? new Set() : new Set(p.lista.map((x) => x.id)),
  }));

  // Das fichas marcadas: so elas mudam de igreja. Todas marcadas = o nome inteiro.
  const idsMarcados = () => (pessoas.marcadas.size === pessoas.lista.length ? null : [...pessoas.marcadas]);

  // --- vincular -----------------------------------------------------------
  const abrirVincular = (d) => { setEscolhida([]); setVincular({ ...d, ids: null }); };

  const confirmarVinculo = async () => {
    if (!vincular || escolhida.length === 0) return;
    setEnviando(true);
    const r = await vincularOutraIgreja(vincular.nome, escolhida[0], vincular.ids);
    setEnviando(false);
    if (!r.success) {
      toast({ title: 'Não deu para vincular', description: r.error, variant: 'destructive' });
      return;
    }
    toast({
      title: 'Vinculado',
      description: `${plural(r.vinculados, 'inscrição passou', 'inscrições passaram')} para ${r.igreja}.`,
      className: 'bg-green-600 text-white'
    });
    setVincular(null);
    setPessoas(null);
    aposMudar();
  };

  // --- criar --------------------------------------------------------------
  const abrirCriar = (d) => {
    setCriar({ texto: d ? d.nome : null, quantas: d ? d.quantas : 0, ids: null });
    setNomeNovo(d ? d.nome.toUpperCase() : '');
  };

  const confirmarCriacao = async () => {
    if (!criar || nomeNovo.trim().length < 3) return;
    setEnviando(true);
    const r = await criarIgrejaParceira(nomeNovo.trim(), criar.texto, criar.ids);
    setEnviando(false);
    if (!r.success) {
      toast({ title: 'Não deu para criar a igreja', description: r.error, variant: 'destructive' });
      return;
    }
    toast({
      title: `Igreja criada com o código ${r.codigo}`,
      description: `${r.igreja}.${r.vinculados ? ` ${plural(r.vinculados, 'inscrição foi vinculada', 'inscrições foram vinculadas')}.` : ''} O acesso do parceiro fica trancado até você liberar em Senhas dos Parceiros.`,
      className: 'bg-green-600 text-white'
    });
    setCriar(null);
    setPessoas(null);
    aposMudar();
  };

  const confirmarRemocao = async () => {
    const alvo = paraRemover;
    setParaRemover(null);
    if (!alvo) return;
    const r = await removerIgrejaExtra(alvo.id);
    if (!r.success) {
      toast({ title: 'Não deu para remover', description: r.error, variant: 'destructive' });
      return;
    }
    toast({ title: 'Igreja removida da lista', description: `"${alvo.nome}" não aparece mais no formulário.` });
    aposMudar();
  };

  const avisoDeExistente = criar && nomeNovo.trim().length >= 3 && jaExiste(nomeNovo);
  const buscaDoVinculo = vincular && opcoesDeVinculo.some((o) => casaBusca(vincular.nome, [o.igreja])) ? vincular.nome : '';

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------ aviso da virada */}
      {(permiteOutra || permiteDiversos) && (
        <div className="flex items-start gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 p-3 text-sm text-sky-100">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
          <p>
            Na <strong>virada de edição</strong>, a opção <strong>OUTRA</strong> (equipante) e a igreja{' '}
            <strong>84 - DIVERSOS</strong> (acampante) deixam de existir nos formulários, e o servidor passa a recusar as duas.
            Resolva os nomes abaixo antes: vincule a uma igreja que já existe ou crie a igreja nova.
          </p>
        </div>
      )}

      {/* ------------------------------------------------ o que foi digitado */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="text-lg font-medium text-white">Nomes digitados pelos equipantes</h3>
            <p className="text-xs text-gray-500">
              Quem escolheu “OUTRA” no formulário e escreveu o nome da própria igreja.
              As mais repetidas aparecem primeiro.
            </p>
          </div>
          <Button
            variant="outline" size="sm" onClick={carregar} disabled={loading}
            data-dica="Buscar de novo os nomes que as pessoas escreveram em &quot;OUTRA&quot;."
            className="border-white/10 bg-transparent text-gray-300 hover:bg-white/5 hover:text-white shrink-0"
          >
            <RotateCcw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-8 justify-center text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" /> Carregando...
          </div>
        ) : erro ? (
          <p className="text-red-300 text-sm py-6 text-center">{erro}</p>
        ) : pendentes.length === 0 ? (
          <p className="text-gray-400 text-sm py-6 text-center bg-white/5 border border-white/10 rounded-lg">
            {digitadas.length === 0
              ? 'Nenhuma inscrição em OUTRA no momento.'
              : 'Todos os nomes digitados já estão na lista.'}
          </p>
        ) : (
          // Altura fixa com barra de rolagem: a lista cresce a cada inscricao.
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {pendentes.map((d) => (
              <div
                key={d.nome}
                className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-md border border-white/10 bg-white/5"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{d.nome}</p>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    <button
                      type="button"
                      onClick={() => abrirPessoas(d)}
                      data-dica="Ver quem escreveu este nome e abrir a ficha de cada um (pastor, função, contato)."
                      className="inline-flex items-center gap-1 text-xs text-blue-300 underline decoration-dotted underline-offset-2 hover:text-blue-200"
                    >
                      <Users className="w-3 h-3" />
                      {d.quantas === 1 ? '1 pessoa escreveu' : `${d.quantas} pessoas escreveram`}
                    </button>
                    {jaExiste(d.nome) && (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-300">
                        <AlertTriangle className="w-3 h-3" />
                        já existe uma igreja com este nome — vincule
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm" variant="outline"
                    onClick={() => abrirVincular(d)}
                    data-dica="Escolher a igreja que já existe: as inscrições que escreveram este nome passam para ela."
                    className="border-blue-500/50 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 hover:text-blue-200"
                  >
                    <Link2 className="w-4 h-4 mr-1" /> Vincular
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => abrirCriar(d)}
                    data-dica="Criar a igreja nova, escrevendo o nome certo, no próximo código disponível."
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Nova igreja
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --------------------------------------------------- criadas aqui */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="text-lg font-medium text-white">Igrejas criadas aqui</h3>
            <p className="text-xs text-gray-500">
              Entram no próximo código ({proximoCodigo || '...'}), aparecem nos formulários e já têm conta de parceiro
              (acesso trancado até você liberar em Senhas dos Parceiros).
            </p>
          </div>
          <Button
            size="sm" onClick={() => abrirCriar(null)}
            data-dica="Criar uma igreja nova pelo nome, sem esperar alguém digitar em OUTRA."
            className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
          >
            <Plus className="w-4 h-4 mr-1" /> Nova igreja
          </Button>
        </div>

        {novas.length === 0 ? (
          <p className="text-gray-400 text-sm py-6 text-center bg-white/5 border border-white/10 rounded-lg">
            Nenhuma igreja criada por aqui ainda.
          </p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {novas.map((n) => (
              <div key={n.codigo} className="flex items-center gap-3 p-3 rounded-md border border-emerald-500/25 bg-emerald-500/5">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{n.codigo} - {n.nome}</p>
                  <p className="text-xs text-gray-500">
                    {plural(n.equipantes, 'equipante', 'equipantes')} · {plural(n.acampantes, 'acampante', 'acampantes')}
                    {n.criada_por ? ` · criada por ${n.criada_por}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Igrejas acrescentadas ANTES, sem codigo: continuam podendo sair da lista. */}
        {extras.length > 0 && (
          <div className="mt-5">
            <h4 className="text-sm font-medium text-gray-300 mb-2">Acrescentadas antes, sem código</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {extras.map((x) => (
                <div key={x.id} className="flex items-center gap-3 p-3 rounded-md border border-white/10 bg-white/5">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{x.nome}</p>
                    <p className="text-xs text-gray-500">
                      {x.quantas > 0 ? plural(x.quantas, 'inscrição com este nome', 'inscrições com este nome') : 'ainda sem inscrições'}
                      {x.criada_por ? ` · adicionada por ${x.criada_por}` : ''}
                    </p>
                  </div>
                  <Button
                    variant="ghost" size="icon" onClick={() => setParaRemover(x)}
                    className="text-gray-400 hover:text-red-400 shrink-0" title="Tirar da lista"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------ janela: quem escreveu */}
      {/* Some enquanto a ficha, o vincular ou o criar estao abertos (e volta ao fechar). */}
      <Dialog
        open={!!pessoas && !ficha && !vincular && !criar}
        onOpenChange={(abrir) => { if (!abrir) setPessoas(null); }}
      >
        <DialogContent className="bg-zinc-900 border border-white/10 text-white sm:max-w-2xl max-h-[92vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>Quem escreveu “{pessoas?.nome}”</DialogTitle>
            <DialogDescription className="text-gray-400">
              Abra a ficha para ver o pastor e decidir a igreja. Marque só quem é da mesma igreja: o mesmo nome pode ser de igrejas diferentes.
            </DialogDescription>
          </DialogHeader>

          <div className="min-w-0 py-1">
            {!pessoas?.lista ? (
              <div className="flex items-center justify-center gap-2 py-8 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin" /> Carregando...
              </div>
            ) : pessoas.lista.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">Ninguém mais com este nome em OUTRA (já foi vinculado).</p>
            ) : (
              <>
                <label className="mb-2 flex cursor-pointer items-center gap-2 px-1 text-xs text-gray-400">
                  <input
                    type="checkbox"
                    checked={pessoas.marcadas.size === pessoas.lista.length}
                    onChange={alternarTodas}
                    className="h-4 w-4 accent-emerald-500"
                  />
                  Marcar todas ({pessoas.marcadas.size} de {pessoas.lista.length})
                </label>
                <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
                  {pessoas.lista.map((p) => (
                    <div key={p.id} className="flex items-start gap-3 rounded-md border border-white/10 bg-white/5 p-3">
                      <input
                        type="checkbox"
                        checked={pessoas.marcadas.has(p.id)}
                        onChange={() => alternarPessoa(p.id)}
                        aria-label={`Marcar ${p.nome}`}
                        className="mt-1 h-4 w-4 shrink-0 accent-emerald-500"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-white">
                          {p.nome}
                          <span className="ml-2 rounded-full border border-white/20 px-2 py-0.5 text-[11px] font-normal text-gray-300">
                            {ROTULO_STATUS[p.status] || p.status}
                          </span>
                        </p>
                        <p className="mt-0.5 text-sm">
                          {p.pastor_nome || p.pastor
                            ? <><span className="text-gray-400">Pastor:</span> <span className="text-white">{p.pastor_nome || p.pastor}</span></>
                            : <span className="text-amber-300">Pastor não informado</span>}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-400">
                          {[
                            p.cargo_igreja ? `Função: ${p.cargo_igreja_outro || p.cargo_igreja}` : '',
                            telefoneLegivel(p.whatsapp),
                          ].filter(Boolean).join(' · ') || 'sem outros dados'}
                        </p>
                      </div>
                      <Button
                        size="sm" variant="outline" onClick={() => setFicha(p)}
                        data-dica="Abrir a ficha completa desta pessoa."
                        className="shrink-0 border-white/20 bg-transparent text-gray-200 hover:bg-white/10 hover:text-white"
                      >
                        <Eye className="mr-1 h-4 w-4" /> Ver ficha
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <DialogFooter className="gap-2 sm:justify-between sm:space-x-0">
            <Button variant="ghost" onClick={() => setPessoas(null)} className="text-gray-300 hover:bg-white/10 hover:text-white">
              Fechar
            </Button>
            {pessoas?.lista?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline" disabled={pessoas.marcadas.size === 0}
                  onClick={() => { setEscolhida([]); setVincular({ nome: pessoas.nome, quantas: pessoas.marcadas.size, ids: idsMarcados() }); }}
                  className="border-blue-500/50 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 hover:text-blue-200"
                >
                  <Link2 className="mr-1 h-4 w-4" /> Vincular ({pessoas.marcadas.size})
                </Button>
                <Button
                  disabled={pessoas.marcadas.size === 0}
                  onClick={() => { setCriar({ texto: pessoas.nome, quantas: pessoas.marcadas.size, ids: idsMarcados() }); setNomeNovo(pessoas.nome.toUpperCase()); }}
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  <Plus className="mr-1 h-4 w-4" /> Nova igreja ({pessoas.marcadas.size})
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {ficha && <InscricaoDetalhesModal inscricao={ficha} onClose={() => setFicha(null)} />}

      {/* ------------------------------------------------ janela: vincular */}
      <Dialog open={!!vincular} onOpenChange={(abrir) => { if (!abrir && !enviando) setVincular(null); }}>
        <DialogContent className="bg-zinc-900 border border-white/10 text-white sm:max-w-lg max-h-[92vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>Vincular a uma igreja</DialogTitle>
            <DialogDescription className="text-gray-400">
              {vincular && (
                <>
                  <strong className="text-white">“{vincular.nome}”</strong> — {plural(vincular.quantas, 'pessoa escreveu', 'pessoas escreveram')} este nome.
                  Escolha a igreja certa: a inscrição delas passa para ela, e o parceiro da igreja passa a ver e aprovar.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="min-w-0 py-2">
            {vincular && (
              <SeletorIgrejas
                key={vincular.nome}
                unica
                opcoes={opcoesDeVinculo}
                selecionadas={escolhida}
                onChange={setEscolhida}
                buscaInicial={buscaDoVinculo}
              />
            )}
            {escolhida.length > 0 && (
              <p className="mt-3 text-sm text-emerald-300">
                {plural(vincular?.quantas || 0, 'inscrição vai', 'inscrições vão')} para <strong>{escolhida[0]}</strong>.
              </p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setVincular(null)} disabled={enviando}
              className="bg-transparent border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white">
              Cancelar
            </Button>
            <Button onClick={confirmarVinculo} disabled={escolhida.length === 0 || enviando} className="bg-blue-600 hover:bg-blue-700 text-white">
              {enviando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2 className="w-4 h-4 mr-2" />}
              Vincular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------ janela: nova igreja */}
      <Dialog open={!!criar} onOpenChange={(abrir) => { if (!abrir && !enviando) setCriar(null); }}>
        <DialogContent className="bg-zinc-900 border border-white/10 text-white sm:max-w-lg max-h-[92vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>Nova igreja</DialogTitle>
            <DialogDescription className="text-gray-400">
              Escreva o nome certo. Ela entra no próximo código disponível e já aparece nos formulários.
            </DialogDescription>
          </DialogHeader>
          <div className="min-w-0 space-y-4 py-2">
            {criar?.texto && (
              <p className="text-xs text-gray-400">
                Veio de “{criar.texto}” ({plural(criar.quantas, 'pessoa escreveu', 'pessoas escreveram')}). Essas inscrições passam para a igreja nova.
              </p>
            )}
            <div className="flex items-end gap-3">
              <div className="shrink-0">
                <p className="text-xs text-gray-400 mb-1.5">Código</p>
                <div className="rounded-md border border-white/20 bg-white/5 px-3 py-2 text-lg font-semibold tabular-nums text-emerald-300">
                  {proximoCodigo || '...'}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-400 mb-1.5">Nome da igreja</p>
                <Input
                  autoFocus
                  value={nomeNovo}
                  onChange={(e) => setNomeNovo(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === 'Enter') confirmarCriacao(); }}
                  maxLength={80}
                  placeholder="NOME DA IGREJA"
                  className="bg-white/10 border-white/20 text-white placeholder:text-gray-600"
                  disabled={enviando}
                />
              </div>
            </div>
            {avisoDeExistente && (
              <p className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Já existe uma igreja com este nome. Use “Vincular” para não duplicar.
              </p>
            )}
            <p className="text-xs text-gray-500">
              A igreja ganha conta de parceiro (código {proximoCodigo || '...'}) com o acesso trancado: libere em Senhas dos Parceiros
              quando for passar o acesso.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCriar(null)} disabled={enviando}
              className="bg-transparent border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white">
              Cancelar
            </Button>
            <Button onClick={confirmarCriacao} disabled={nomeNovo.trim().length < 3 || enviando} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {enviando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Criar igreja {proximoCodigo}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!paraRemover} onOpenChange={(aberto) => !aberto && setParaRemover(null)}>
        <AlertDialogContent className="bg-gray-900 border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle>Tirar “{paraRemover?.nome}” da lista?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Ela deixa de aparecer no formulário de equipante.
              <br /><br />
              <strong className="text-white">Ninguém perde a inscrição.</strong> Quem já se
              inscreveu com esse nome continua com ele gravado na ficha.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-gray-700 text-white hover:bg-gray-800">
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmarRemocao} className="bg-red-600 hover:bg-red-700 text-white">
              Tirar da lista
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default OutrasIgrejasManager;
