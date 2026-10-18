import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, BellRing, CheckCircle2, Eye, Pencil, Search, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import Paginacao, { usePaginacao } from '@/components/common/Paginacao';
import { nomeDaIgreja } from '@/constants/igrejas';
import { casaBusca } from '@/utils/busca';
import { formatarTelefone } from '@/utils/telefone';
import { TIPOS_PENDENCIA, TIPO_PENDENCIA } from '@/utils/pendenciasEquipante';
import { cn } from '@/lib/utils';

/**
 * "Cadastros com pendências — equipantes" (Patrick, 18/10/2026). O botao fica
 * ao lado de "Colunas" na aba Equipantes, com o numero de fichas (ate 999+).
 * A janela lista toda ficha com algum campo em branco ou fora do padrao, com
 * busca, filtro por tipo de pendencia e por gravidade, ordenacao pelas setas
 * e paginacao. O lapis abre a ficha para corrigir; corrigida, ela some da
 * lista sozinha (a lista e recalculada quando a tela recarrega os equipantes).
 */

const SITUACAO = { aprovado: 'Aprovado', pendente: 'Pendente', rejeitado: 'Rejeitado' };

export const BotaoPendencias = ({ total, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={`Cadastros com pendências — equipantes: ${total}`}
    data-dica="Cadastros com pendências — equipantes. Toda ficha com algum campo em branco ou fora do padrão."
    className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-orange-500/40 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20 hover:text-orange-200 shrink-0"
  >
    <BellRing className="h-4 w-4" />
    {total > 0 && (
      <span className="absolute -top-2 -right-2 min-w-[1.4rem] h-5 px-1 rounded-full bg-orange-600 text-white text-[10px] font-bold leading-5 text-center tabular-nums shadow">
        {total > 999 ? '999+' : total}
      </span>
    )}
  </button>
);

const Seta = ({ coluna, ordem, setOrdem, children, className }) => {
  const ativa = ordem.coluna === coluna;
  const Icone = !ativa ? ArrowUpDown : ordem.asc ? ArrowUp : ArrowDown;
  return (
    <button type="button" onClick={() => setOrdem({ coluna, asc: ativa ? !ordem.asc : coluna !== 'qtd' })}
      className={cn('inline-flex items-center gap-1 font-medium', ativa ? 'text-white' : 'text-gray-400 hover:text-gray-200', className)}>
      {children}<Icone className="w-3.5 h-3.5" />
    </button>
  );
};

const Chip = ({ ativo, onClick, children, tom = 'neutro' }) => (
  <button type="button" onClick={onClick}
    className={cn('px-2.5 py-1 rounded-full border text-xs whitespace-nowrap transition-colors',
      ativo
        ? 'border-orange-400 bg-orange-500/25 text-white'
        : tom === 'obrigatoria'
          ? 'border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20'
          : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10')}>
    {children}
  </button>
);

const PendenciasEquipantes = ({ aberto, onFechar, lista, onEditar, onVer }) => {
  const [busca, setBusca] = useState('');
  const [tipos, setTipos] = useState([]); // chaves marcadas (qualquer uma serve)
  const [gravidade, setGravidade] = useState('todas'); // todas | obrigatoria | conferir
  const [situacao, setSituacao] = useState('todas');
  const [ordem, setOrdem] = useState({ coluna: 'qtd', asc: false });

  // Quantas fichas tem cada tipo (sobre a lista inteira).
  const porTipo = useMemo(() => {
    const c = {};
    lista.forEach(({ pendencias }) => pendencias.forEach((p) => { c[p.chave] = (c[p.chave] || 0) + 1; }));
    return c;
  }, [lista]);

  const visiveis = useMemo(() => {
    const filtrada = lista.filter(({ ficha, pendencias, obrigatorias }) => {
      if (gravidade === 'obrigatoria' && obrigatorias === 0) return false;
      if (gravidade === 'conferir' && obrigatorias === pendencias.length) return false;
      if (situacao !== 'todas' && ficha.status !== situacao) return false;
      if (tipos.length && !pendencias.some((p) => tipos.includes(p.chave))) return false;
      if (busca.trim() && !casaBusca(busca, [ficha.nome, ficha.cpf, ficha.whatsapp, nomeDaIgreja(ficha), ficha.igreja_outra])) return false;
      return true;
    });
    const chave = {
      nome: (x) => (x.ficha.nome || '').toLowerCase(),
      igreja: (x) => (nomeDaIgreja(x.ficha) || '~').toLowerCase(),
      qtd: (x) => x.obrigatorias * 100 + x.pendencias.length,
      inscrito: (x) => x.ficha.inscrito_em || x.ficha.created_at || '',
    }[ordem.coluna];
    return [...filtrada].sort((a, b) => {
      const va = chave(a); const vb = chave(b);
      const r = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'pt-BR');
      return (ordem.asc ? r : -r) || (a.ficha.nome || '').localeCompare(b.ficha.nome || '', 'pt-BR');
    });
  }, [lista, busca, tipos, gravidade, situacao, ordem]);

  const paginacao = usePaginacao(visiveis, 10);
  const alternarTipo = (chave) => setTipos((t) => (t.includes(chave) ? t.filter((x) => x !== chave) : [...t, chave]));
  const filtrando = busca || tipos.length || gravidade !== 'todas' || situacao !== 'todas';
  const limpar = () => { setBusca(''); setTipos([]); setGravidade('todas'); setSituacao('todas'); };

  const etiquetas = (pendencias) => (
    <div className="flex flex-wrap gap-1">
      {pendencias.map((p) => {
        const t = TIPO_PENDENCIA[p.chave];
        return (
          <span key={p.chave} title={p.detalhe ? `${t.rotulo}: ${p.detalhe}` : t.rotulo}
            className={cn('px-1.5 py-0.5 rounded text-[11px] border',
              t.gravidade === 'obrigatoria' ? 'border-red-500/40 bg-red-500/10 text-red-200' : 'border-amber-500/30 bg-amber-500/10 text-amber-200')}>
            {t.rotulo}{p.detalhe && p.detalhe !== 'vazio' ? <span className="text-gray-400"> · {String(p.detalhe).slice(0, 30)}</span> : null}
          </span>
        );
      })}
    </div>
  );

  const botoes = (ficha) => (
    <div className="flex gap-1 justify-end">
      <button type="button" onClick={() => onVer(ficha)} title="Ver a ficha" aria-label={`Ver a ficha de ${ficha.nome}`}
        className="h-9 w-9 inline-flex items-center justify-center rounded-md text-blue-300 hover:bg-blue-500/20"><Eye className="w-4 h-4" /></button>
      <button type="button" onClick={() => onEditar(ficha)} title="Corrigir a ficha" aria-label={`Corrigir a ficha de ${ficha.nome}`}
        className="h-9 w-9 inline-flex items-center justify-center rounded-md text-amber-300 hover:bg-amber-500/20"><Pencil className="w-4 h-4" /></button>
    </div>
  );

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="bg-neutral-950 border-white/10 text-white p-0 gap-0 w-[calc(100vw-1rem)] max-w-6xl h-[calc(100dvh-1rem)] sm:h-[90dvh] flex flex-col overflow-hidden">
        <DialogHeader className="px-4 sm:px-6 pt-5 pb-3 border-b border-white/10 text-left space-y-1">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <BellRing className="w-5 h-5 text-orange-300" /> Cadastros com pendências — equipantes
          </DialogTitle>
          <DialogDescription className="text-gray-400 text-xs sm:text-sm">
            {lista.length} {lista.length === 1 ? 'ficha' : 'fichas'} com algum campo em branco ou fora do padrão.
            <span className="text-red-300"> Vermelho</span>: a pessoa é obrigada a completar.
            <span className="text-amber-300"> Amarelo</span>: vale conferir.
          </DialogDescription>
        </DialogHeader>

        <div className="px-4 sm:px-6 py-3 space-y-2.5 border-b border-white/10">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, CPF, WhatsApp ou igreja..."
              className="pl-9 h-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500" />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-gray-500 mr-1">Gravidade:</span>
            {[['todas', 'Todas'], ['obrigatoria', 'Obrigatórias'], ['conferir', 'Só para conferir']].map(([v, r]) => (
              <Chip key={v} ativo={gravidade === v} onClick={() => setGravidade(v)}>{r}</Chip>
            ))}
            <span className="text-gray-500 ml-3 mr-1">Situação:</span>
            {[['todas', 'Todas'], ['aprovado', 'Aprovados'], ['pendente', 'Pendentes'], ['rejeitado', 'Rejeitados']].map(([v, r]) => (
              <Chip key={v} ativo={situacao === v} onClick={() => setSituacao(v)}>{r}</Chip>
            ))}
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
            {TIPOS_PENDENCIA.filter((t) => porTipo[t.chave]).map((t) => (
              <Chip key={t.chave} tom={t.gravidade} ativo={tipos.includes(t.chave)} onClick={() => alternarTipo(t.chave)}>
                {t.rotulo} · {porTipo[t.chave]}
              </Chip>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 px-4 sm:px-6 py-2 text-sm text-gray-300 border-b border-white/10">
          <span><strong className="text-white tabular-nums">{visiveis.length}</strong> {visiveis.length === 1 ? 'ficha' : 'fichas'}</span>
          {filtrando ? (
            <button type="button" onClick={limpar} className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white">
              <X className="w-3 h-3" />limpar filtros
            </button>
          ) : null}
          <span className="ml-auto md:hidden flex gap-3 text-xs">
            <Seta coluna="qtd" ordem={ordem} setOrdem={setOrdem}>Pendências</Seta>
            <Seta coluna="nome" ordem={ordem} setOrdem={setOrdem}>Nome</Seta>
          </span>
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          {lista.length === 0 ? (
            <div className="py-16 text-center text-gray-400 flex flex-col items-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-green-400" />Nenhuma ficha com pendência.
            </div>
          ) : visiveis.length === 0 ? (
            <p className="py-16 text-center text-gray-500 text-sm">Nenhuma ficha com esses filtros.</p>
          ) : (
            <>
              {/* Computador */}
              <table className="hidden md:table w-full text-sm">
                <thead className="sticky top-0 z-10 bg-neutral-900 text-xs">
                  <tr className="text-left border-b border-white/10">
                    <th className="px-4 py-2.5 min-w-[220px]"><Seta coluna="nome" ordem={ordem} setOrdem={setOrdem}>Nome</Seta></th>
                    <th className="px-3 py-2.5 min-w-[180px]"><Seta coluna="igreja" ordem={ordem} setOrdem={setOrdem}>Igreja</Seta></th>
                    <th className="px-3 py-2.5"><Seta coluna="qtd" ordem={ordem} setOrdem={setOrdem}>Pendências</Seta></th>
                    <th className="px-3 py-2.5 whitespace-nowrap"><Seta coluna="inscrito" ordem={ordem} setOrdem={setOrdem}>Inscrição</Seta></th>
                    <th className="px-4 py-2.5 text-right text-gray-400 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {paginacao.itensDaPagina.map(({ ficha, pendencias }) => (
                    <tr key={ficha.id} className="border-b border-white/5 align-top hover:bg-white/[0.03]">
                      <td className="px-4 py-2.5">
                        <p className="text-white font-medium">{ficha.nome || '(sem nome)'}</p>
                        <p className="text-xs text-gray-500">
                          {ficha.whatsapp ? formatarTelefone(ficha.whatsapp) : 'sem WhatsApp'}
                          {SITUACAO[ficha.status] ? ` · ${SITUACAO[ficha.status]}` : ''}
                          {ficha.inscricao_manual_por ? ` · manual (${ficha.inscricao_manual_por})` : ''}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-300 max-w-[240px]"><span className="line-clamp-2">{nomeDaIgreja(ficha) || '—'}</span></td>
                      <td className="px-3 py-2.5">{etiquetas(pendencias)}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-400 whitespace-nowrap">
                        {(ficha.inscrito_em || ficha.created_at) ? new Date(ficha.inscrito_em || ficha.created_at).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="px-4 py-1.5">{botoes(ficha)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Celular */}
              <div className="md:hidden divide-y divide-white/5">
                {paginacao.itensDaPagina.map(({ ficha, pendencias }) => (
                  <div key={ficha.id} className="px-4 py-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-white font-medium">{ficha.nome || '(sem nome)'}</p>
                        <p className="text-xs text-gray-500 truncate">{nomeDaIgreja(ficha) || 'sem igreja'}</p>
                        <p className="text-xs text-gray-500">
                          {ficha.whatsapp ? formatarTelefone(ficha.whatsapp) : 'sem WhatsApp'}
                          {SITUACAO[ficha.status] ? ` · ${SITUACAO[ficha.status]}` : ''}
                        </p>
                      </div>
                      {botoes(ficha)}
                    </div>
                    {etiquetas(pendencias)}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <Paginacao {...paginacao} />
      </DialogContent>
    </Dialog>
  );
};

export default PendenciasEquipantes;
