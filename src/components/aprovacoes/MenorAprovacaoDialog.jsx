import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Copy, Loader2, MessageCircle, Search, ShieldCheck, UserCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import TagMenor from '@/components/common/TagMenor';
import { buscarAcompanhante, definirAcompanhanteMenor } from '@/services/equipantesService';
import { formatarTelefone } from '@/utils/telefone';
import {
  DECLARACAO_MENOR_PEDIDO, DECLARACAO_MENOR_TITULO, declaracaoDoMenor,
  SITUACAO_ACOMPANHANTE, linkWhatsApp, mensagemParaResponsavel,
} from '@/utils/menorAprovacao';
import { cn } from '@/lib/utils';

const CORES = {
  green: 'border-green-500/40 bg-green-500/10 text-green-200',
  amber: 'border-amber-500/40 bg-amber-500/10 text-amber-100',
  red: 'border-red-500/50 bg-red-500/10 text-red-200',
};

const semCodigo = (igreja) => String(igreja || '').replace(/^\s*\d+\s*-\s*/, '').trim();
// Busca so com nome e sobrenome (20261105b): o parceiro nao lista as outras igrejas.
const PALAVRAS_FRACAS = new Set(['de', 'da', 'do', 'dos', 'das', 'e']);
const temNomeESobrenome = (t) =>
  String(t || '').trim().split(/\s+/).filter((w) => w.length >= 2 && !PALAVRAS_FRACAS.has(w.toLowerCase())).length >= 2;
const rotuloStatus = (s) => (s === 'aprovado' ? 'aprovado' : s === 'rejeitado' ? 'rejeitado' : 'pendente');

/**
 * Aprovar (ou liberar) um equipante menor de idade (20261105a).
 *
 * Mostra o responsavel com o botao do WhatsApp e a mensagem pronta, a
 * situacao do acompanhante (achado pelo nome entre os equipantes inscritos;
 * com varios parecidos ou nome errado, quem aprova escolhe) e a declaracao.
 * Confirmar so com a caixa "Li e confirmo" marcada. O servidor confere tudo
 * de novo (decidir_inscricao / liberar_menor).
 *
 * modo: 'aprovar' (pendente -> aprovado) | 'liberar' (ja aprovado por outro
 * caminho, ou Só Domingo, sem a liberacao).
 */
const MenorAprovacaoDialog = ({ aberto, menor, ctx, modo = 'aprovar', onConfirmar, onFechar, onAcompanhanteMudou }) => {
  const { toast } = useToast();
  const [ciente, setCiente] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [verMensagem, setVerMensagem] = useState(false);
  const [trocando, setTrocando] = useState(false);
  const [termo, setTermo] = useState('');
  const [resultados, setResultados] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [salvandoAcomp, setSalvandoAcomp] = useState(null);

  useEffect(() => {
    if (!aberto) return;
    setCiente(false); setEnviando(false); setVerMensagem(false);
    setTrocando(false); setTermo(''); setResultados(null);
  }, [aberto, menor?.id]);

  const mensagem = useMemo(() => (menor ? mensagemParaResponsavel(menor, ctx) : ''), [menor, ctx]);
  const link = menor ? linkWhatsApp(menor.responsavel_whatsapp, mensagem) : null;

  if (!menor) return null;

  const precisaAcomp = menor.precisa_acompanhante !== false;
  const acomp = menor.acompanhante || {};
  const situacao = SITUACAO_ACOMPANHANTE[acomp.situacao] || SITUACAO_ACOMPANHANTE.nao_encontrado;
  const pessoa = acomp.pessoa;
  const candidatos = acomp.candidatos || [];

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(mensagem);
      toast({ title: 'Mensagem copiada', description: 'Cole no WhatsApp do responsável.' });
    } catch {
      setVerMensagem(true);
      toast({ title: 'Não deu para copiar', description: 'Selecione o texto da mensagem e copie.', variant: 'destructive' });
    }
  };

  const procurar = async (e) => {
    e?.preventDefault();
    if (!temNomeESobrenome(termo)) return;
    setBuscando(true);
    const r = await buscarAcompanhante(menor.id, termo.trim());
    setBuscando(false);
    if (!r.success) {
      toast({ title: 'Não deu para procurar', description: r.error, variant: 'destructive' });
      return;
    }
    setResultados(r.itens);
  };

  const escolher = async (c) => {
    if (c?.menor) {
      toast({ title: 'Não pode', description: 'O acompanhante precisa ser maior de idade.', variant: 'destructive' });
      return;
    }
    setSalvandoAcomp(c?.id || 'limpar');
    const r = await definirAcompanhanteMenor(menor.id, c?.id || null);
    setSalvandoAcomp(null);
    if (!r.success) {
      toast({ title: 'Não deu para salvar', description: r.error, variant: 'destructive' });
      return;
    }
    toast({ title: c ? 'Acompanhante vinculado' : 'Vínculo desfeito', description: c ? `${c.nome} ficou como acompanhante de ${menor.nome}.` : 'O sistema volta a procurar pelo nome informado.' });
    setTrocando(false); setResultados(null); setTermo('');
    onAcompanhanteMudou?.();
  };

  const confirmar = async () => {
    if (!ciente || enviando) return;
    setEnviando(true);
    const ok = await onConfirmar?.();
    setEnviando(false);
    if (ok !== false) onFechar();
  };

  const listaEscolha = (lista) => (
    <div className="mt-2 space-y-1.5">
      {lista.map((c) => (
        <div key={c.id} className="flex items-center justify-between gap-2 rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5">
          <div className="min-w-0">
            <p className="truncate text-sm text-white">
              {c.nome}
              {c.menor && <span className="ml-1.5 text-[11px] text-red-300">(menor de idade)</span>}
            </p>
            <p className="truncate text-[11px] text-gray-400">
              {semCodigo(c.igreja) || 'sem igreja'} · inscrição {rotuloStatus(c.status)}
            </p>
          </div>
          <Button
            size="sm" type="button" disabled={!!salvandoAcomp || c.menor}
            onClick={() => escolher(c)}
            className="h-7 shrink-0 bg-sky-700 px-2.5 text-xs text-white hover:bg-sky-600"
          >
            {salvandoAcomp === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'É este'}
          </Button>
        </div>
      ))}
    </div>
  );

  return (
    <Dialog open={aberto} onOpenChange={(abrir) => { if (!abrir && !enviando) onFechar(); }}>
      <DialogContent className="bg-zinc-900 border border-white/10 text-white sm:max-w-xl max-h-[92vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-pink-300" />
            {modo === 'liberar' ? 'Liberar menor de idade' : 'Aprovar menor de idade'}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Fale com o responsável antes de confirmar. Sem esta confirmação o menor não consegue pagar.
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-4 py-1">
          <div className="rounded-md border border-white/10 bg-white/5 p-3">
            <p className="flex flex-wrap items-center gap-2 font-medium">
              {menor.nome} <TagMenor />
              {menor.idade != null && <span className="text-sm font-normal text-gray-400">{menor.idade} anos</span>}
            </p>
            <p className="mt-0.5 text-xs text-gray-400">
              {semCodigo(menor.igreja) || 'sem igreja'}
              {menor.whatsapp ? ` · WhatsApp do menor: ${formatarTelefone(menor.whatsapp) || menor.whatsapp}` : ''}
            </p>
          </div>

          {/* Responsavel */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-200">Responsável legal</p>
            {menor.responsavel_nome ? (
              <div className="rounded-md border border-white/10 bg-white/5 p-3 text-sm">
                <p className="text-white">{menor.responsavel_nome}</p>
                <p className="text-xs text-gray-400">
                  WhatsApp: {formatarTelefone(menor.responsavel_whatsapp) || menor.responsavel_whatsapp || 'não informado'}
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {link ? (
                    <a
                      href={link} target="_blank" rel="noopener noreferrer"
                      className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#25D366] px-3 text-xs font-semibold text-black hover:bg-[#20bd5a]"
                    >
                      <MessageCircle className="h-4 w-4" /> Mandar mensagem no WhatsApp
                    </a>
                  ) : (
                    <span className="text-xs text-red-300">WhatsApp do responsável inválido: copie a mensagem e mande por outro meio.</span>
                  )}
                  <Button type="button" size="sm" variant="outline" onClick={copiar}
                    className="h-8 border-white/20 bg-transparent text-xs text-gray-200 hover:bg-white/10 hover:text-white">
                    <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar mensagem
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setVerMensagem((v) => !v)}
                    className="h-8 text-xs text-gray-300 hover:bg-white/10 hover:text-white">
                    {verMensagem ? 'Esconder mensagem' : 'Ver mensagem'}
                  </Button>
                </div>
                {verMensagem && (
                  <p className="mt-2 whitespace-pre-wrap rounded-md border border-white/10 bg-black/40 p-2.5 text-xs text-gray-200 select-text">
                    {mensagem}
                  </p>
                )}
              </div>
            ) : (
              <p className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
                Esta inscrição não tem o responsável informado. Peça ao menor para corrigir a inscrição, ou fale com a organização.
              </p>
            )}
          </div>

          {/* Acompanhante: so menor de 16 (20261105c) */}
          {!precisaAcomp ? (
            <p className="rounded-md border border-white/10 bg-white/5 p-3 text-xs text-gray-300">
              Com 16 ou 17 anos não precisa de acompanhante no projeto: basta a autorização do responsável.
            </p>
          ) : (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-200">Acompanhante durante o projeto</p>
            <div className={cn('rounded-md border p-3 text-sm', CORES[situacao.cor])}>
              <p className="flex items-start gap-2">
                {situacao.cor === 'green'
                  ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
                <span>{situacao.rotulo}{situacao.cor !== 'green' && acomp.situacao !== 'menor' ? ' (não impede a aprovação).' : '.'}</span>
              </p>
              {menor.acompanhante_nome && (
                <p className="mt-1.5 text-xs opacity-90">Nome informado pelo menor: <strong>{menor.acompanhante_nome}</strong></p>
              )}
              {pessoa && (
                <div className="mt-2 flex items-center gap-2 rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 text-white">
                  <UserCheck className="h-4 w-4 shrink-0 text-sky-300" />
                  <div className="min-w-0">
                    <p className="truncate text-sm">{pessoa.nome}{pessoa.menor ? ' (menor de idade)' : ''}</p>
                    <p className="truncate text-[11px] text-gray-400">
                      {semCodigo(pessoa.igreja) || 'sem igreja'} · inscrição {rotuloStatus(pessoa.status)}
                      {acomp.escolhido ? ' · vinculado à mão' : ' · achado pelo nome'}
                    </p>
                  </div>
                </div>
              )}
              {!pessoa && acomp.situacao === 'varios' && listaEscolha(candidatos)}

              <div className="mt-2 flex flex-wrap gap-2">
                {!trocando && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setTrocando(true)}
                    className="h-7 px-2 text-xs text-gray-200 hover:bg-white/10 hover:text-white">
                    <Search className="mr-1 h-3.5 w-3.5" /> {pessoa ? 'Não é esta pessoa? Procurar' : 'Procurar pelo nome'}
                  </Button>
                )}
                {acomp.escolhido && (
                  <Button type="button" size="sm" variant="ghost" disabled={!!salvandoAcomp} onClick={() => escolher(null)}
                    className="h-7 px-2 text-xs text-gray-300 hover:bg-white/10 hover:text-white">
                    <X className="mr-1 h-3.5 w-3.5" /> Desfazer vínculo
                  </Button>
                )}
              </div>
              {trocando && (
                <form onSubmit={procurar} className="mt-2">
                  <div className="flex gap-2">
                    <Input
                      autoFocus value={termo} onChange={(e) => setTermo(e.target.value)}
                      placeholder="Nome e sobrenome do acompanhante"
                      className="h-8 bg-black/40 border-white/20 text-sm text-white"
                    />
                    <Button type="submit" size="sm" disabled={buscando || !temNomeESobrenome(termo)}
                      className="h-8 bg-white/15 text-white hover:bg-white/25">
                      {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Procurar'}
                    </Button>
                  </div>
                  {resultados && (resultados.length
                    ? listaEscolha(resultados)
                    : <p className="mt-2 text-xs text-gray-300">Nenhum equipante inscrito com esse nome.</p>)}
                </form>
              )}
            </div>
          </div>
          )}

          {/* Declaracao */}
          <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-100">
            <p className="flex items-center gap-2 font-semibold text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {DECLARACAO_MENOR_TITULO}
            </p>
            <p className="mt-2">{declaracaoDoMenor(menor)}</p>
            <p className="mt-2 font-medium">{DECLARACAO_MENOR_PEDIDO}</p>
            <label className="mt-3 flex cursor-pointer items-start gap-2 text-white">
              <input
                type="checkbox" checked={ciente} onChange={(e) => setCiente(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-green-600"
              />
              <span>Li e confirmo: todas essas condições estão atendidas.</span>
            </label>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:space-x-0">
          <Button variant="outline" onClick={onFechar} disabled={enviando}
            className="bg-transparent border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white">
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={!ciente || enviando} className="bg-green-600 hover:bg-green-700 text-white">
            {enviando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            {modo === 'liberar' ? 'Confirmar e liberar' : 'Confirmar e aprovar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MenorAprovacaoDialog;
