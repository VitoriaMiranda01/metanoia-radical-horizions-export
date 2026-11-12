import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { CheckCircle, FileText, MessageCircle, RefreshCw, XCircle } from 'lucide-react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { formatarTelefone } from '@/utils/telefone';
import { linkWhatsApp } from '@/utils/menorAprovacao';
import {
  aprovarSolicitacaoFichas, listarSolicitacoesFichas, marcarMensagemFichas,
  mensagemFichasAprovadas, recusarSolicitacaoFichas,
} from '@/services/solicitacoesFichasService';

/**
 * Solicitacoes de fichas dos parceiros (12/11/2026, migration 20261112a).
 * Caixa de permissao 'solicitacoes_fichas'. Aprovar soma a quantidade
 * aprovada ao limite da igreja (Configuracoes > limites por igreja); o envio
 * da mensagem no WhatsApp e manual.
 */

const dataHora = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
}) : '');

const textoLimite = (lim) => (lim == null ? 'sem limite' : String(lim));

// Mesma conta do servidor (aprovar_solicitacao_fichas), so para mostrar antes.
const limiteDepois = (sit, qtd) => {
  const ocup = Number(sit?.ocupadas) || 0;
  const base = sit?.limite == null ? ocup : Math.max(Number(sit.limite), ocup);
  return base + (Number(qtd) || 0);
};

const SolicitacoesFichasPage = () => {
  const { toast } = useToast();
  const [dados, setDados] = useState({ config: {}, itens: [] });
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState('');
  const [aba, setAba] = useState('pendente');
  const [aprovando, setAprovando] = useState(null);   // item
  const [qtdAprovada, setQtdAprovada] = useState('');
  const [recusando, setRecusando] = useState(null);   // item
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroCarga('');
    try {
      setDados(await listarSolicitacoesFichas());
    } catch (e) {
      setErroCarga(e?.message || 'Não foi possível carregar as solicitações.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const contagem = useMemo(() => {
    const c = { pendente: 0, aprovada: 0, outras: 0 };
    dados.itens.forEach((i) => {
      if (i.status === 'pendente') c.pendente += 1;
      else if (i.status === 'aprovada') c.aprovada += 1;
      else c.outras += 1;
    });
    return c;
  }, [dados.itens]);

  const lista = useMemo(() => dados.itens.filter((i) => (
    aba === 'outras' ? !['pendente', 'aprovada'].includes(i.status) : i.status === aba
  )), [dados.itens, aba]);

  const abrirAprovar = (item) => { setAprovando(item); setQtdAprovada(String(item.quantidade)); };

  const confirmarAprovar = async () => {
    const qtd = parseInt(qtdAprovada, 10);
    if (!qtd || qtd < 1 || qtd > 200) {
      toast({ title: 'Quantidade inválida', description: 'Informe de 1 a 200.', variant: 'destructive' });
      return;
    }
    setSalvando(true);
    try {
      const r = await aprovarSolicitacaoFichas(aprovando.id, qtd);
      toast({
        title: 'Solicitação aprovada',
        description: `Limite da igreja: ${textoLimite(r.limite_antes)} → ${r.limite_depois}. Agora envie a mensagem no WhatsApp.`,
      });
      setAprovando(null);
      setAba('aprovada');
      carregar();
    } catch (e) {
      toast({ title: 'Não deu certo', description: e?.message, variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  const confirmarRecusar = async () => {
    setSalvando(true);
    try {
      await recusarSolicitacaoFichas(recusando.id, motivo.trim());
      toast({ title: 'Solicitação recusada' });
      setRecusando(null);
      setMotivo('');
      carregar();
    } catch (e) {
      toast({ title: 'Não deu certo', description: e?.message, variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  const enviarWhatsApp = async (item) => {
    const link = linkWhatsApp(item.contato_whatsapp, mensagemFichasAprovadas(item, dados.config));
    if (!link) {
      toast({ title: 'WhatsApp inválido', description: 'Confira o número do pedido.', variant: 'destructive' });
      return;
    }
    window.open(link, '_blank', 'noopener');
    try {
      await marcarMensagemFichas(item.id);
      carregar();
    } catch (e) {
      console.error('SolicitacoesFichas - marcar mensagem', e?.message || e);
    }
  };

  const avisarRecusa = (item) => {
    const primeiro = String(item.contato_nome || '').trim().split(/\s+/)[0] || '';
    const texto = `Olá${primeiro ? `, ${primeiro}` : ''}! Aqui é da organização do Metanoia Radical Serra. `
      + `A solicitação de ${item.quantidade} fichas da igreja ${String(item.igreja).replace(/^\s*\d+\s*-\s*/, '')} `
      + `não pôde ser atendida${item.motivo_recusa ? `: ${item.motivo_recusa}` : '.'}`;
    const link = linkWhatsApp(item.contato_whatsapp, texto);
    if (link) window.open(link, '_blank', 'noopener');
  };

  const { config } = dados;

  return (
    <>
      <Helmet><title>Solicitações de fichas - Metanoia Radical</title></Helmet>
      <Layout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <FileText className="w-6 h-6 text-blue-400" /> Solicitações de fichas
              </h1>
              <p className="text-sm text-gray-400">
                Pedidos das igrejas parceiras{config.edicao ? ` (${config.edicao}ª edição)` : ''}. Aprovar soma a
                quantidade ao limite de acampantes da igreja.
                {config.valor_hoje != null ? ` Lote de hoje: ${Number(config.valor_hoje).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.` : ' Sem lote de acampante hoje.'}
              </p>
            </div>
            <Button variant="outline" onClick={carregar} disabled={carregando}
              className="border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/10 self-start">
              <RefreshCw className={`w-4 h-4 mr-2 ${carregando ? 'animate-spin' : ''}`} /> Atualizar
            </Button>
          </div>

          <Tabs value={aba} onValueChange={setAba}>
            <TabsList className="bg-white/5 border border-white/10 flex-wrap h-auto">
              <TabsTrigger value="pendente">Pendentes ({contagem.pendente})</TabsTrigger>
              <TabsTrigger value="aprovada">Aprovadas ({contagem.aprovada})</TabsTrigger>
              <TabsTrigger value="outras">Recusadas e canceladas ({contagem.outras})</TabsTrigger>
            </TabsList>
          </Tabs>

          {erroCarga && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{erroCarga}</p>
          )}

          {!carregando && !erroCarga && lista.length === 0 && (
            <p className="text-gray-400 text-sm">Nenhuma solicitação aqui.</p>
          )}

          <ul className="space-y-3">
            {lista.map((i) => {
              const sit = i.situacao || {};
              return (
                <li key={i.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-white font-semibold break-words">{i.igreja}</p>
                      <p className="text-sm text-gray-300">
                        <span className="text-lg font-bold text-white">
                          {i.status === 'aprovada' ? i.quantidade_aprovada : i.quantidade}
                        </span>{' '}
                        {i.status === 'aprovada' && i.quantidade_aprovada !== i.quantidade
                          ? `fichas aprovadas (pediu ${i.quantidade})` : 'fichas'}
                        <span className="text-gray-500"> · pedido em {dataHora(i.criado_em)}</span>
                      </p>
                      <p className="text-sm text-gray-300">
                        Contato: {i.contato_nome} · {formatarTelefone(i.contato_whatsapp)}
                      </p>
                      {i.observacao && <p className="text-sm text-gray-400 break-words">Obs.: {i.observacao}</p>}
                      {i.status === 'pendente' && (
                        <p className="text-xs text-gray-500">
                          Limite atual: {textoLimite(sit.limite)} · inscritos: {sit.ocupadas ?? 0}
                        </p>
                      )}
                      {i.status === 'aprovada' && (
                        <p className="text-xs text-gray-500">
                          Aprovada por {i.decidido_por} em {dataHora(i.decidido_em)} · limite {textoLimite(i.limite_antes)} → {i.limite_depois}
                          {i.mensagem_enviada_em
                            ? ` · mensagem aberta por ${i.mensagem_enviada_por} em ${dataHora(i.mensagem_enviada_em)}`
                            : ' · mensagem ainda não enviada'}
                        </p>
                      )}
                      {i.status === 'recusada' && (
                        <p className="text-xs text-red-300">
                          Recusada por {i.decidido_por} em {dataHora(i.decidido_em)}{i.motivo_recusa ? ` · ${i.motivo_recusa}` : ''}
                        </p>
                      )}
                      {i.status === 'cancelada' && (
                        <p className="text-xs text-gray-500">Cancelada pelo parceiro em {dataHora(i.decidido_em)}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      {i.status === 'pendente' && (
                        <>
                          <Button size="sm" onClick={() => abrirAprovar(i)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                            <CheckCircle className="w-4 h-4 mr-1" /> Aprovar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setRecusando(i); setMotivo(''); }}
                            className="border-red-500/40 bg-transparent text-red-300 hover:bg-red-500/10 hover:text-red-200">
                            <XCircle className="w-4 h-4 mr-1" /> Recusar
                          </Button>
                        </>
                      )}
                      {i.status === 'aprovada' && (
                        <Button size="sm" onClick={() => enviarWhatsApp(i)} className="bg-green-600 hover:bg-green-700 text-white">
                          <MessageCircle className="w-4 h-4 mr-1" /> {i.mensagem_enviada_em ? 'Enviar de novo' : 'Enviar no WhatsApp'}
                        </Button>
                      )}
                      {i.status === 'recusada' && (
                        <Button size="sm" variant="outline" onClick={() => avisarRecusa(i)}
                          className="border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/10">
                          <MessageCircle className="w-4 h-4 mr-1" /> Avisar no WhatsApp
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <Dialog open={!!aprovando} onOpenChange={(v) => { if (!v && !salvando) setAprovando(null); }}>
          <DialogContent className="bg-zinc-900 border border-white/10 text-white sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Aprovar fichas</DialogTitle>
              <DialogDescription className="text-gray-400">{aprovando?.igreja}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label htmlFor="qtd-aprovada" className="text-gray-300">
                  Quantidade aprovada (pediu {aprovando?.quantidade})
                </Label>
                <Input id="qtd-aprovada" type="number" inputMode="numeric" min={1} max={200} value={qtdAprovada}
                  onChange={(e) => setQtdAprovada(e.target.value.replace(/\D/g, '').slice(0, 3))}
                  className="mt-1 bg-black/40 border-white/10 text-white" />
              </div>
              <p className="text-sm text-gray-300">
                Limite da igreja: <strong>{textoLimite(aprovando?.situacao?.limite)}</strong> →{' '}
                <strong className="text-emerald-300">{limiteDepois(aprovando?.situacao, qtdAprovada)}</strong>
                <span className="text-gray-500"> (inscritos hoje: {aprovando?.situacao?.ocupadas ?? 0})</span>
              </p>
              {aprovando?.situacao?.limite != null
                && Number(aprovando.situacao.limite) > Number(aprovando.situacao.ocupadas || 0) && (
                <p className="text-xs text-amber-300">
                  A igreja ainda tem {Number(aprovando.situacao.limite) - Number(aprovando.situacao.ocupadas || 0)} vaga(s)
                  do limite atual; a aprovação soma em cima delas.
                </p>
              )}
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setAprovando(null)} disabled={salvando}
                className="border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/10">Cancelar</Button>
              <Button onClick={confirmarAprovar} disabled={salvando} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {salvando ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Aprovar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!recusando} onOpenChange={(v) => { if (!v && !salvando) setRecusando(null); }}>
          <DialogContent className="bg-zinc-900 border border-white/10 text-white sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Recusar solicitação</DialogTitle>
              <DialogDescription className="text-gray-400">
                {recusando?.igreja} · {recusando?.quantidade} fichas
              </DialogDescription>
            </DialogHeader>
            <div>
              <Label htmlFor="motivo-recusa" className="text-gray-300">Motivo (opcional, o parceiro vê)</Label>
              <Textarea id="motivo-recusa" rows={3} maxLength={300} value={motivo}
                onChange={(e) => setMotivo(e.target.value)} className="mt-1 bg-black/40 border-white/10 text-white" />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setRecusando(null)} disabled={salvando}
                className="border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/10">Voltar</Button>
              <Button onClick={confirmarRecusar} disabled={salvando} className="bg-red-600 hover:bg-red-700 text-white">
                {salvando ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Recusar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Layout>
    </>
  );
};

export default SolicitacoesFichasPage;
