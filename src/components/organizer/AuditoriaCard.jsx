import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, History, Loader2, RefreshCw, Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchAuditoria, ROTULO_TABELA, descreverOrigem, formatarValor, rotuloCampo } from '@/services/auditoriaService';
import { cn } from '@/lib/utils';

/**
 * Quadro "Auditoria" em Configuracoes (pedido do Patrick, 06/10/2026): o que
 * os organizadores mudaram -- quem, quando, em qual ficha e o que mudou.
 * So existe para a conta "Desenvolvedores": para os outros logins o banco
 * devolve null e o quadro nem aparece.
 *
 * O banco grava sozinho (migration 20261006g) e guarda 180 dias.
 */

const TODOS = 'todos';

const COR_OPERACAO = {
  incluiu: 'border-green-500/40 bg-green-500/10 text-green-300',
  alterou: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  apagou: 'border-red-500/40 bg-red-500/10 text-red-300',
};

const fmtHora = (iso) => new Date(iso).toLocaleString('pt-BR', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
});

const Mudancas = ({ item }) => {
  const [aberto, setAberto] = useState(false);
  const m = item.mudancas;
  if (!m) return null;
  const campos = Object.keys(m).sort();

  if (item.operacao === 'alterou') {
    return (
      <ul className="mt-1 space-y-0.5 text-xs">
        {campos.map((c) => (
          <li key={c} className="break-words">
            <span className="text-gray-400">{rotuloCampo(c)}:</span>{' '}
            <span className="text-red-300/80 line-through">{formatarValor(m[c][0])}</span>
            <span className="text-gray-500"> → </span>
            <span className="text-green-300">{formatarValor(m[c][1])}</span>
          </li>
        ))}
      </ul>
    );
  }

  // Inclusao/exclusao: os dados ficam fechados, um clique abre.
  return (
    <div className="mt-1 text-xs">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        className="inline-flex items-center gap-1 text-gray-400 hover:text-white"
      >
        {aberto ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        {aberto ? 'Esconder os dados' : `Ver os dados (${campos.length} campos)`}
      </button>
      {aberto && (
        <ul className="mt-1 ml-4 space-y-0.5">
          {campos.map((c) => (
            <li key={c} className="break-words">
              <span className="text-gray-400">{rotuloCampo(c)}:</span>{' '}
              <span className="text-gray-200">{formatarValor(m[c])}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const Linha = ({ item }) => {
  const origem = descreverOrigem(item.origem);
  return (
    <li className="border-b border-white/5 pb-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="text-xs text-gray-500 w-24 shrink-0">{fmtHora(item.em)}</span>
        <span className="font-medium text-white">{item.organizador}</span>
        <span className={cn('px-2 py-0.5 rounded-full border text-xs', COR_OPERACAO[item.operacao])}>
          {item.operacao}
        </span>
        <span className="text-gray-400">{ROTULO_TABELA[item.tabela] || item.tabela}</span>
        {item.registro && <span className="text-gray-100 break-words">· {item.registro}</span>}
        {item.qtd > 1 && <span className="text-xs text-amber-300">(em massa)</span>}
      </div>
      {origem && <p className="text-[11px] text-gray-500 mt-0.5 md:ml-[6.5rem]">via {origem}</p>}
      <div className="md:ml-[6.5rem]">
        <Mudancas item={item} />
      </div>
    </li>
  );
};

const AuditoriaCard = () => {
  // undefined = carregando a primeira vez; null = nao e a conta Desenvolvedores.
  const [dados, setDados] = useState(undefined);
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const [organizador, setOrganizador] = useState(TODOS);
  const [tabela, setTabela] = useState(TODOS);
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const pedido = useRef(0);

  // Espera a pessoa parar de digitar antes de buscar.
  useEffect(() => {
    const t = setTimeout(() => setBuscaAplicada(busca.trim()), 400);
    return () => clearTimeout(t);
  }, [busca]);

  const carregar = useCallback(async (antes = null) => {
    const meu = ++pedido.current;
    setCarregando(true);
    setErro(null);
    try {
      const r = await fetchAuditoria({
        antes,
        organizador: organizador === TODOS ? null : organizador,
        tabela: tabela === TODOS ? null : tabela,
        busca: buscaAplicada || null,
      });
      if (meu !== pedido.current) return;
      setDados(r);
      if (r) setItens((atuais) => (antes ? [...atuais, ...r.itens] : r.itens));
    } catch (e) {
      if (meu !== pedido.current) return;
      setErro('Não foi possível carregar a auditoria.');
      setDados((d) => (d === undefined ? { itens: [], organizadores: [], total: 0 } : d));
    } finally {
      if (meu === pedido.current) setCarregando(false);
    }
  }, [organizador, tabela, buscaAplicada]);

  useEffect(() => { carregar(); }, [carregar]);

  if (dados === null) return null;

  const organizadores = dados?.organizadores || [];
  const ultimo = itens[itens.length - 1];

  return (
    <Card id="auditoria" className="glass-effect border-white/10 bg-black/40 scroll-mt-28">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-white">
          <History className="w-5 h-5 text-violet-400" />
          <span>Auditoria</span>
        </CardTitle>
        <CardDescription className="text-gray-400">
          O que os organizadores mudaram no sistema: quem, quando, em qual ficha e o que
          mudou. Guarda os últimos 180 dias. Só a conta Desenvolvedores vê este quadro.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1.5fr_auto] gap-2">
          <Select value={organizador} onValueChange={setOrganizador}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white" aria-label="Organizador">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos</SelectItem>
              {organizadores.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={tabela} onValueChange={setTabela}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white" aria-label="Tipo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Tudo</SelectItem>
              {Object.entries(ROTULO_TABELA).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar nome ou valor"
              className="pl-9 bg-white/5 border-white/10 text-white"
            />
          </div>
          <Button
            type="button" variant="outline" onClick={() => carregar()} disabled={carregando}
            data-dica="Buscar de novo" aria-label="Atualizar"
            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
          >
            <RefreshCw className={cn('w-4 h-4', carregando && 'animate-spin')} />
          </Button>
        </div>

        {erro && <p className="text-sm text-red-300">{erro}</p>}

        {dados === undefined ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
          </div>
        ) : itens.length === 0 ? (
          <p className="text-sm text-gray-400">
            {organizador !== TODOS || tabela !== TODOS || buscaAplicada
              ? 'Nada encontrado com esses filtros.'
              : 'Nenhuma mudança registrada ainda. A partir de agora, tudo o que os organizadores mudarem aparece aqui.'}
          </p>
        ) : (
          <>
            <ul className="space-y-2 max-h-[32rem] overflow-y-auto pr-1">
              {itens.map((it) => <Linha key={it.id} item={it} />)}
            </ul>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{dados?.total ?? 0} registros guardados</span>
              {dados?.tem_mais && (
                <Button
                  type="button" variant="ghost" size="sm" disabled={carregando}
                  onClick={() => carregar(ultimo?.id)}
                  className="text-gray-300 hover:text-white hover:bg-white/10"
                >
                  {carregando && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
                  Carregar mais
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AuditoriaCard;
