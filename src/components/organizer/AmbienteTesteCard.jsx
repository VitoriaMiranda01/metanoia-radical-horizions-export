import React, { useCallback, useEffect, useState } from 'react';
import {
  CalendarCheck, CheckCircle2, Copy, ExternalLink, FlaskConical, Link2, Loader2,
  RefreshCw, Trash2, Undo2, UserCheck, Wallet, XCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import {
  fetchPainelTeste, gerarLinkTeste, desativarLinkTeste, decidirFichaTeste, escalarFichaTeste,
  lancarEscalaTeste, pagamentoFichaTeste, apagarFichaTeste, linkDeCadastroTeste
} from '@/services/ambienteTesteService';
import { cn } from '@/lib/utils';

/**
 * Quadro "Ambiente de teste" em Configuracoes (Patrick, 06/10/2026). So as
 * contas Raquel e Desenvolvedores veem: para as outras o banco devolve null.
 *
 * Ficha de teste segue o fluxo de verdade (cadastro pelo formulario publico,
 * aprovacao, escala, revelar a area, PIX real), mas nao aparece em lista
 * nenhuma nem conta em nada oficial. Como as igrejas e as telas normais nao
 * enxergam a ficha, quem aprova, escala e apaga e este quadro.
 */

const PAGOS = ['confirmado', 'pago', 'completed'];
const SEM_AREA = '__sem_area__';

const fmtHora = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
}) : '');

const Selo = ({ cor, children }) => (
  <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs whitespace-nowrap', cor)}>
    {children}
  </span>
);

const COR = {
  ok: 'border-green-500/40 bg-green-500/10 text-green-300',
  espera: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  ruim: 'border-red-500/40 bg-red-500/10 text-red-300',
  neutro: 'border-white/10 bg-white/5 text-gray-300',
};

const botao = 'h-8 px-2.5 border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/10';

// Confirmacao em dois cliques, sem janela.
const BotaoApagar = ({ onApagar, ocupado }) => {
  const [confirmando, setConfirmando] = useState(false);
  if (!confirmando) {
    return (
      <Button size="sm" variant="outline" className={cn(botao, 'text-red-300 hover:text-red-200')}
        onClick={() => setConfirmando(true)} disabled={ocupado}>
        <Trash2 className="w-4 h-4 mr-1.5" /> Apagar
      </Button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-red-300">
      Apagar de vez?
      <Button size="sm" className="h-7 px-2 bg-red-600 hover:bg-red-700 text-white" disabled={ocupado}
        onClick={() => { setConfirmando(false); onApagar(); }}>Sim</Button>
      <Button size="sm" variant="ghost" className="h-7 px-2 text-gray-300 hover:bg-white/10"
        onClick={() => setConfirmando(false)}>Não</Button>
    </span>
  );
};

const FichaEquipante = ({ f, areas, ocupado, acao }) => {
  const atual = f.escalas?.[0];
  const [area, setArea] = useState(atual?.area || SEM_AREA);
  const [atuacao, setAtuacao] = useState(atual?.atuacao || '');
  useEffect(() => { setArea(atual?.area || SEM_AREA); setAtuacao(atual?.atuacao || ''); }, [atual?.area, atual?.atuacao]);

  const atuacoes = areas.find((a) => a.area === area)?.atuacoes || [];
  const pago = PAGOS.includes(String(f.status_pagamento || '').toLowerCase());
  const aprovado = f.status === 'aprovado';
  const mudouEscala = (area === SEM_AREA ? null : area) !== (atual?.area || null)
    || (area !== SEM_AREA && (atuacao || null) !== (atual?.atuacao || null));

  return (
    <li className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-white">{f.nome}</span>
        <Selo cor="border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300">equipante · teste</Selo>
        <Selo cor={aprovado ? COR.ok : f.status === 'rejeitado' ? COR.ruim : COR.espera}>
          {aprovado ? 'aprovado' : f.status === 'rejeitado' ? 'reprovado' : 'aguardando aprovação'}
        </Selo>
        <Selo cor={atual ? COR.ok : COR.neutro}>
          {atual ? `${atual.area}${atual.atuacao && atual.atuacao !== atual.area ? ` · ${atual.atuacao}` : ''}${atual.eh_lider ? ' (líder)' : ''}` : 'sem área'}
        </Selo>
        <Selo cor={pago ? COR.ok : COR.espera}>{pago ? 'pago' : 'não pagou'}</Selo>
        {f.area_vista && <Selo cor={COR.neutro}>já viu a área</Selo>}
      </div>
      <p className="text-xs text-gray-400">
        CPF {f.cpf || '—'} · WhatsApp {f.whatsapp || '—'}{f.igreja ? ` · ${f.igreja}` : ''}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {aprovado ? (
          <Button size="sm" variant="outline" className={botao} disabled={ocupado}
            onClick={() => acao(() => decidirFichaTeste(f.id, 'pendente'), 'Voltou para aguardando aprovação')}>
            <Undo2 className="w-4 h-4 mr-1.5" /> Desaprovar
          </Button>
        ) : (
          <Button size="sm" variant="outline" className={botao} disabled={ocupado}
            onClick={() => acao(() => decidirFichaTeste(f.id, 'aprovado'), 'Ficha aprovada')}
            data-dica="Aprova no lugar da igreja (a igreja não vê ficha de teste).">
            <UserCheck className="w-4 h-4 mr-1.5" /> Aprovar
          </Button>
        )}

        <span className="text-xs text-gray-500">Área</span>
        <Select value={area} onValueChange={(v) => { setArea(v); setAtuacao(''); }} disabled={!aprovado || ocupado}>
          <SelectTrigger className="h-8 w-44 bg-white/5 border-white/10 text-white text-xs" aria-label="Área">
            <SelectValue placeholder="Área" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SEM_AREA}>Sem área</SelectItem>
            <SelectItem value="Não será escalado">Não será escalado</SelectItem>
            {areas.map((a) => <SelectItem key={a.area} value={a.area}>{a.area}</SelectItem>)}
          </SelectContent>
        </Select>
        {atuacoes.length > 0 && (
          <span className="text-xs text-gray-500">Atuação</span>
        )}
        {atuacoes.length > 0 && (
          <Select value={atuacao || '__padrao__'} onValueChange={(v) => setAtuacao(v === '__padrao__' ? '' : v)} disabled={ocupado}>
            <SelectTrigger className="h-8 w-48 bg-white/5 border-white/10 text-white text-xs" aria-label="Atuação">
              <SelectValue placeholder="Atuação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__padrao__">Atuação padrão</SelectItem>
              {atuacoes.map((t) => (
                <SelectItem key={t.atuacao} value={t.atuacao}>{t.atuacao}{t.eh_lider ? ' (líder)' : ''}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {mudouEscala && (
          <Button size="sm" className="h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white" disabled={ocupado}
            onClick={() => acao(() => escalarFichaTeste(f.id, area === SEM_AREA ? null : area, atuacao),
              area === SEM_AREA ? 'Tirada da escala' : `Escalada em ${area}`)}>
            Salvar escala
          </Button>
        )}

        <Button size="sm" variant="outline" className={botao} disabled={ocupado}
          onClick={() => acao(() => pagamentoFichaTeste('equipante', f.id, !pago),
            pago ? 'Pagamento voltou para pendente' : 'Pagamento confirmado')}
          data-dica={pago ? 'Volta para "não pagou", para testar o PIX de novo.' : 'Confirma o pagamento na mão.'}>
          <Wallet className="w-4 h-4 mr-1.5" /> {pago ? 'Desfazer pagamento' : 'Confirmar pagamento'}
        </Button>
        <BotaoApagar ocupado={ocupado} onApagar={() => acao(() => apagarFichaTeste('equipante', f.id), 'Ficha de teste apagada')} />
      </div>
    </li>
  );
};

const FichaAcampante = ({ f, ocupado, acao }) => {
  const pago = PAGOS.includes(String(f.status_pagamento || '').toLowerCase());
  return (
    <li className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-white">{f.nome}</span>
        <Selo cor="border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300">acampante · teste</Selo>
        <Selo cor={pago ? COR.ok : COR.espera}>{pago ? 'pago' : 'não pagou'}</Selo>
      </div>
      <p className="text-xs text-gray-400">
        CPF {f.cpf || '—'} · WhatsApp {f.whatsapp || '—'}{f.igreja ? ` · ${f.igreja}` : ''}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" className={botao} disabled={ocupado}
          onClick={() => acao(() => pagamentoFichaTeste('acampante', f.id, !pago),
            pago ? 'Pagamento voltou para pendente' : 'Pagamento confirmado')}>
          <Wallet className="w-4 h-4 mr-1.5" /> {pago ? 'Desfazer pagamento' : 'Confirmar pagamento'}
        </Button>
        <BotaoApagar ocupado={ocupado} onApagar={() => acao(() => apagarFichaTeste('acampante', f.id), 'Ficha de teste apagada')} />
      </div>
    </li>
  );
};

const AmbienteTesteCard = () => {
  const { toast } = useToast();
  // undefined = carregando; null = conta sem acesso (o quadro nem aparece).
  const [painel, setPainel] = useState(undefined);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setPainel(await fetchPainelTeste());
    } catch (_) {
      setPainel((p) => (p === undefined ? null : p));
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const acao = async (fn, ok) => {
    setOcupado(true);
    try {
      await fn();
      toast({ title: ok, className: 'bg-emerald-600 text-white border-none' });
      await carregar();
    } catch (e) {
      toast({ title: 'Não deu certo', description: e.message, variant: 'destructive' });
    } finally {
      setOcupado(false);
    }
  };

  const copiar = async (texto) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast({ title: 'Link copiado', className: 'bg-emerald-600 text-white border-none' });
    } catch (_) {
      toast({ title: 'Não deu para copiar', description: texto, variant: 'destructive' });
    }
  };

  if (painel === null) return null;

  const equipantes = painel?.equipantes || [];
  const acampantes = painel?.acampantes || [];
  const links = painel?.links || [];
  const areas = painel?.areas || [];

  return (
    <Card id="ambiente-teste" className="glass-effect border-fuchsia-500/30 bg-black/40 scroll-mt-28">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-white">
          <span className="flex items-center space-x-2">
            <FlaskConical className="w-5 h-5 text-fuchsia-400" />
            <span>Ambiente de teste</span>
          </span>
          <Button size="sm" variant="ghost" onClick={carregar} disabled={ocupado}
            className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-white/10" aria-label="Atualizar">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </CardTitle>
        <CardDescription className="text-gray-400">
          Fichas de teste passam pelo fluxo de verdade (cadastro, aprovação, escala, revelar a área
          e PIX real, no valor cheio), mas não aparecem para as igrejas, nas listas, nas contagens
          nem na escala oficial. Só as contas Raquel e Desenvolvedores veem este quadro.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {painel === undefined ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
          </div>
        ) : (
          <>
            {/* 1. Links de cadastro */}
            <section className="space-y-2">
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                <Link2 className="w-4 h-4 text-fuchsia-300" /> 1. Link de cadastro de teste
              </h4>
              <p className="text-xs text-gray-400">
                Abre o formulário de inscrição de sempre; a ficha feita por ele já nasce de teste.
                Vale 30 dias. Use um CPF que não seja de nenhuma pessoa de verdade.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className={botao} disabled={ocupado}
                  onClick={() => acao(() => gerarLinkTeste('equipante'), 'Link de equipante criado')}>
                  + Link de equipante
                </Button>
                <Button size="sm" variant="outline" className={botao} disabled={ocupado}
                  onClick={() => acao(() => gerarLinkTeste('acampante'), 'Link de acampante criado')}>
                  + Link de acampante
                </Button>
              </div>
              {links.length > 0 && (
                <ul className="space-y-1.5">
                  {links.map((l) => {
                    const url = linkDeCadastroTeste(l.tipo, l.chave);
                    return (
                      <li key={l.chave} className="flex flex-wrap items-center gap-2 text-xs rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5">
                        <Selo cor="border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300">{l.tipo}</Selo>
                        <span className="text-gray-300 break-all flex-1 min-w-[12rem]">{url}</span>
                        <span className="text-gray-500 whitespace-nowrap">vale até {fmtHora(l.expira_em)}</span>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-gray-300 hover:bg-white/10" onClick={() => copiar(url)}>
                          <Copy className="w-3.5 h-3.5 mr-1" /> Copiar
                        </Button>
                        <a href={url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center h-7 px-2 rounded-md text-gray-300 hover:bg-white/10">
                          <ExternalLink className="w-3.5 h-3.5 mr-1" /> Abrir
                        </a>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-red-300 hover:bg-white/10" disabled={ocupado}
                          onClick={() => acao(() => desativarLinkTeste(l.chave), 'Link desativado')}>
                          <XCircle className="w-3.5 h-3.5 mr-1" /> Desativar
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* 2. Escala de teste */}
            <section className="space-y-2">
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-fuchsia-300" /> 2. Escala provisória de teste
              </h4>
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                {painel.escala_teste_em ? (
                  <p className="text-sm text-green-300 flex items-center gap-2 flex-1 min-w-[14rem]">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    Lançada só para as fichas de teste em {fmtHora(painel.escala_teste_em)}.
                    Elas já veem a área e o PIX abre para quem estiver escalado.
                  </p>
                ) : (
                  <p className="text-sm text-gray-300 flex-1 min-w-[14rem]">
                    Não lançada. Escale a ficha (abaixo) e lance: só as fichas de teste passam a
                    ver a área e o pagamento.
                  </p>
                )}
                <Button size="sm" disabled={ocupado}
                  className={painel.escala_teste_em ? 'h-8 px-3 bg-white/10 hover:bg-white/20 text-white' : 'h-8 px-3 bg-fuchsia-600 hover:bg-fuchsia-700 text-white'}
                  onClick={() => acao(() => lancarEscalaTeste(!painel.escala_teste_em),
                    painel.escala_teste_em ? 'Escala de teste desfeita' : 'Escala lançada só para teste')}>
                  {painel.escala_teste_em ? 'Desfazer escala de teste' : 'Lançar só para teste'}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                {painel.escala_lancada_em
                  ? `A escala oficial foi lançada em ${fmtHora(painel.escala_lancada_em)} e já vale para todos.`
                  : 'A escala oficial continua não lançada: nenhum equipante de verdade vê nada.'}
              </p>
            </section>

            {/* 3. Fichas */}
            <section className="space-y-2">
              <h4 className="text-sm font-semibold text-white">3. Fichas de teste</h4>
              {equipantes.length + acampantes.length === 0 ? (
                <p className="text-sm text-gray-400">
                  Nenhuma ficha de teste. Crie um link acima e faça a inscrição por ele.
                </p>
              ) : (
                <ul className="space-y-2">
                  {equipantes.map((f) => <FichaEquipante key={f.id} f={f} areas={areas} ocupado={ocupado} acao={acao} />)}
                  {acampantes.map((f) => <FichaAcampante key={f.id} f={f} ocupado={ocupado} acao={acao} />)}
                </ul>
              )}
              <p className="text-xs text-gray-500">
                Para ver como a pessoa vê: abra a página de inscrição (equipante ou acampante) e entre
                com o CPF da ficha de teste. Apagar remove a ficha e a escala dela; o registro do PIX fica.
              </p>
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AmbienteTesteCard;
