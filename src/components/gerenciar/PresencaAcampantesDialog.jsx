import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ClipboardCheck, ExternalLink, Loader2, Lock, Printer, RefreshCw, Search, Unlock, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import GrupoTrilhaTag from '@/components/common/GrupoTrilhaTag';
import { useAtualizacaoPeriodica } from '@/hooks/useAtualizacaoPeriodica';
import { fetchRecepcaoLista, reabrirChamada } from '@/services/recepcaoService';
import { GROUPS } from '@/utils/gruposTrailha';
import { formatarTelefone } from '@/utils/telefone';
import { agoraTexto } from '@/utils/onibus';
import { chave, dataHora, horaCurta, onibusDaRecepcao, quemFez, semAcento } from '@/utils/recepcao';

/**
 * Presenca dos Acampantes (Gerenciar Inscricoes, 25/10/2026, migration
 * 20261025g). O que a recepcao da igreja (Bruna e Rodolfo) marcou na tela
 * /recepcao: quem chegou, com grupo e onibus. Totalizador clicavel, filtros
 * de grupo e onibus, pesquisa por nome e impressao da lista filtrada.
 * Infiltrado: marca so na tela; na folha impressa sai como acampante.
 *
 * 26/10/2026 (Patrick): virou janela, aberta pelo botao "Presenca dos
 * acampantes" ao lado das Listas dos onibus -- o quadro aberto poluia a
 * tela. O botao avisa "Chamada encerrada -- verifique" (usePresencaAcampantes).
 */

// Dados da presenca para o botao e para a janela: uma leitura so, de 30 em
// 30 s (pausa com a aba escondida). atualizar: muda quando algo da tela mexe
// nos onibus (Listas dos onibus).
export const usePresencaAcampantes = (atualizar = 0) => {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [atualizando, setAtualizando] = useState(false);

  const carregar = async () => {
    setAtualizando(true);
    try {
      const r = await fetchRecepcaoLista();
      setDados({ ...r, pessoas: r.pessoas.map((p) => ({ ...p, _busca: semAcento(p.nome) })) });
      setErro('');
    } catch (e) {
      setErro(e?.message || 'Não foi possível carregar a presença.');
    } finally {
      setAtualizando(false);
    }
  };

  useEffect(() => { carregar(); }, [atualizar]);
  useAtualizacaoPeriodica(carregar, 30000);

  const resumo = useMemo(() => {
    if (!dados) return null;
    return {
      total: dados.pessoas.length,
      presentes: dados.pessoas.filter((p) => p.chegou_em).length,
      encerrada: !!dados.chamada?.encerrada_em,
    };
  }, [dados]);

  return { dados, erro, atualizando, carregar, resumo };
};

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const imprimirPresenca = (lista, titulo, onibusDe) => {
  const linhas = lista.map((p, i) => `<tr>
    <td class="num">${i + 1}</td>
    <td>${esc(p.nome)}${p.menor ? ' <span class="menor">menor</span>' : ''}</td>
    <td class="nowrap">${esc(p.grupo || 'Sem grupo')}</td>
    <td class="nowrap">${onibusDe(p) ? `Ônibus ${onibusDe(p)}` : '—'}</td>
    <td class="nowrap">${p.chegou_em ? `Chegou ${esc(horaCurta(p.chegou_em))}` : 'Falta'}</td>
    <td>${esc(p.chegou_em ? quemFez(p.chegou_por) : '')}</td>
    <td>${esc(p.observacao || '')}</td>
  </tr>`).join('');
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Presença dos acampantes - Metanoia Radical</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; font-size: 11px; }
  header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 8px; }
  h1 { font-size: 18px; margin: 0; }
  .dir { text-align: right; color: #555; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #bbb; padding: 3px 6px; text-align: left; vertical-align: top; }
  thead { display: table-header-group; }
  th { background: #eee; font-size: 10px; text-transform: uppercase; }
  tr { page-break-inside: avoid; }
  .num { width: 30px; text-align: right; }
  .nowrap { white-space: nowrap; }
  .menor { font-size: 9px; border: 1px solid #999; border-radius: 6px; padding: 0 4px; color: #555; }
  @media screen { body { padding: 16px; } }
</style></head><body>
<header><div><h1>Presença dos acampantes</h1><p style="margin:3px 0 0">${esc(titulo)} · ${lista.length} ${lista.length === 1 ? 'pessoa' : 'pessoas'}</p></div>
<div class="dir"><strong style="color:#111">Metanoia Radical</strong><br>Gerada em ${esc(agoraTexto())}</div></header>
<table><thead><tr><th class="num">Nº</th><th>Nome</th><th>Grupo</th><th>Ônibus</th><th>Presença</th><th>Marcado por</th><th>Observação</th></tr></thead>
<tbody>${linhas}</tbody></table>
<script>window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 200); });</script>
</body></html>`;
  const janela = window.open('', '_blank');
  if (!janela) return false;
  janela.document.open();
  janela.document.write(html);
  janela.document.close();
  return true;
};

const Numero = ({ rotulo, valor, detalhe, cor = 'text-white', ativo, onClick }) => (
  <button type="button" onClick={onClick}
    className={`text-left rounded-xl border px-4 py-3 transition-colors ${
      ativo ? 'border-emerald-400/70 bg-emerald-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
    <p className="text-xs text-gray-400">{rotulo}</p>
    <p className={`text-2xl font-bold ${cor}`}>{valor}</p>
    {detalhe && <p className="text-[11px] text-gray-500 mt-0.5">{detalhe}</p>}
  </button>
);

const Chip = ({ ativo, onClick, children }) => (
  <button type="button" onClick={onClick}
    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
      ativo ? 'border-emerald-400 bg-emerald-500/20 text-white' : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'}`}>
    {children}
  </button>
);

// presenca: o retorno de usePresencaAcampantes (a pagina le uma vez so).
const PresencaAcampantesDialog = ({ isOpen, onClose, presenca }) => {
  const { toast } = useToast();
  const { dados, erro, atualizando, carregar } = presenca;
  const [reabrindo, setReabrindo] = useState(false);
  const [situacao, setSituacao] = useState('presentes');
  const [grupo, setGrupo] = useState('');
  const [onibusFiltro, setOnibusFiltro] = useState('');
  const [busca, setBusca] = useState('');

  // Ao abrir, le de novo: a recepcao pode ter marcado gente agora.
  useEffect(() => { if (isOpen) carregar(); }, [isOpen]);

  const pessoas = dados?.pessoas || [];
  const divisao = useMemo(() => onibusDaRecepcao(pessoas, dados?.onibus), [pessoas, dados?.onibus]);
  const onibusDe = (p) => divisao.porPessoa.get(chave(p)) || null;

  const numeros = useMemo(() => {
    const presentes = pessoas.filter((p) => p.chegou_em).length;
    const menores = pessoas.filter((p) => p.menor);
    return {
      total: pessoas.length, presentes, faltam: pessoas.length - presentes,
      menores: menores.length, menoresPresentes: menores.filter((p) => p.chegou_em).length,
    };
  }, [pessoas]);

  const filtrados = useMemo(() => {
    const termos = semAcento(busca).split(/\s+/).filter(Boolean);
    return pessoas.filter((p) => {
      if (situacao === 'presentes' && !p.chegou_em) return false;
      if (situacao === 'faltam' && p.chegou_em) return false;
      if (situacao === 'menores' && !p.menor) return false;
      if (grupo === 'sem' && GROUPS.includes(p.grupo)) return false;
      if (grupo && grupo !== 'sem' && p.grupo !== grupo) return false;
      if (onibusFiltro === 'sem' && onibusDe(p)) return false;
      if (onibusFiltro && onibusFiltro !== 'sem' && onibusDe(p) !== Number(onibusFiltro)) return false;
      return termos.every((t) => p._busca.includes(t));
    });
  }, [pessoas, situacao, grupo, onibusFiltro, busca, divisao]);

  const reabrir = async () => {
    setReabrindo(true);
    try {
      await reabrirChamada();
      toast({ title: 'Chamada reaberta', description: 'A recepção já pode marcar de novo.', className: 'bg-emerald-600 text-white' });
    } catch (e) {
      toast({ title: 'Não deu certo', description: e?.message || 'Tente de novo.', variant: 'destructive' });
    } finally {
      setReabrindo(false);
      carregar();
    }
  };

  const tituloFiltro = [
    { todos: 'Todos', presentes: 'Presentes', faltam: 'Faltam', menores: 'Menores de idade' }[situacao],
    grupo ? (grupo === 'sem' ? 'Sem grupo' : `Grupo ${grupo}`) : '',
    onibusFiltro ? (onibusFiltro === 'sem' ? 'Sem ônibus' : `Ônibus ${onibusFiltro}`) : '',
    busca ? `“${busca}”` : '',
  ].filter(Boolean).join(' · ');

  const imprimir = () => {
    if (!imprimirPresenca(filtrados, tituloFiltro, onibusDe)) {
      toast({ title: 'O navegador bloqueou a janela de impressão', description: 'Permita pop-ups para este site e tente de novo.', variant: 'destructive' });
    }
  };

  const chamada = dados?.chamada || {};

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent overlayClassName="bg-black/70" className="bg-neutral-900 border-white/10 text-white sm:max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl"><ClipboardCheck className="w-5 h-5" />Presença dos acampantes</DialogTitle>
          <DialogDescription className="text-gray-400">
            O que a recepção da igreja marcou: quem chegou, com grupo e ônibus.
          </DialogDescription>
        </DialogHeader>
    <div className="space-y-4">
      {!dados ? (
        erro ? (
          <div className="text-center text-sm text-red-300">
            {erro} <button type="button" onClick={carregar} className="underline">Tentar de novo</button>
          </div>
        ) : <div className="py-6 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
      ) : (
        <>
          <div className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-2.5 text-sm ${
            chamada.encerrada_em ? 'border-red-500/40 bg-red-500/10 text-red-100' : 'border-white/10 bg-white/5 text-gray-300'}`}>
            {chamada.encerrada_em ? <Lock className="w-4 h-4 text-red-300" /> : <ClipboardCheck className="w-4 h-4 text-emerald-300" />}
            <span className="flex-1 min-w-[220px]">
              {chamada.encerrada_em
                ? <>Chamada <strong>encerrada</strong> por {quemFez(chamada.encerrada_por)} em {dataHora(chamada.encerrada_em)} — confira no sítio se pode finalizar.</>
                : <>Chamada aberta na recepção da igreja{chamada.reaberta_em ? ` (reaberta por ${chamada.reaberta_por} em ${dataHora(chamada.reaberta_em)})` : ''}.</>}
            </span>
            {chamada.encerrada_em && (
              <Button size="sm" disabled={reabrindo} onClick={reabrir} className="h-8 bg-white/10 hover:bg-white/20 text-white">
                {reabrindo ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Unlock className="w-3.5 h-3.5 mr-1.5" />Reabrir chamada</>}
              </Button>
            )}
            <Link to="/recepcao" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white">
              Abrir a tela da recepção<ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Numero rotulo="Acampantes" valor={numeros.total} ativo={situacao === 'todos'} onClick={() => setSituacao('todos')} />
            <Numero rotulo="Presentes" valor={numeros.presentes} cor="text-emerald-300" ativo={situacao === 'presentes'} onClick={() => setSituacao('presentes')}
              detalhe={numeros.total ? `${Math.round((numeros.presentes / numeros.total) * 100)}% da edição` : null} />
            <Numero rotulo="Faltam" valor={numeros.faltam} cor="text-amber-300" ativo={situacao === 'faltam'} onClick={() => setSituacao('faltam')} />
            <Numero rotulo="Menores de idade" valor={numeros.menores} ativo={situacao === 'menores'} onClick={() => setSituacao('menores')}
              detalhe={`${numeros.menoresPresentes} presentes`} />
          </div>

          <div className="flex flex-wrap gap-2">
            {divisao.onibus.map((o) => {
              const presentes = o.pessoas.filter((p) => p.chegou_em).length;
              const ativo = onibusFiltro === String(o.numero);
              return (
                <button key={o.numero} type="button" onClick={() => setOnibusFiltro(ativo ? '' : String(o.numero))}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    ativo ? 'border-emerald-400/70 bg-emerald-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                  <span className="font-semibold text-white">Ônibus {o.numero}</span>
                  <span className="ml-2 tabular-nums text-gray-300">{presentes}/{o.pessoas.length}</span>
                </button>
              );
            })}
            <span className="self-center text-xs text-gray-500">{divisao.fechada ? 'Divisão fechada' : 'Divisão provisória (Listas dos ônibus)'}</span>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar o nome do acampante"
                  className="pl-9 pr-9 bg-white/5 border-white/20 text-white" />
                {busca && (
                  <button type="button" onClick={() => setBusca('')} aria-label="Limpar pesquisa"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
                )}
              </div>
              <Button type="button" onClick={imprimir} disabled={!filtrados.length}
                data-dica="Imprimir a lista como está filtrada: nome, grupo, ônibus, presença, quem marcou e observação."
                className="bg-blue-600 hover:bg-blue-700 text-white"><Printer className="w-4 h-4 mr-2" />Imprimir lista</Button>
              <button type="button" onClick={carregar} className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white">
                <RefreshCw className={`w-4 h-4 ${atualizando ? 'animate-spin' : ''}`} />Atualizar
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Chip ativo={!grupo} onClick={() => setGrupo('')}>Todos os grupos</Chip>
              {GROUPS.map((g) => <Chip key={g} ativo={grupo === g} onClick={() => setGrupo(g)}>{g}</Chip>)}
              <Chip ativo={grupo === 'sem'} onClick={() => setGrupo('sem')}>Sem grupo</Chip>
              <span className="w-px bg-white/10 mx-1" />
              <Chip ativo={onibusFiltro === 'sem'} onClick={() => setOnibusFiltro(onibusFiltro === 'sem' ? '' : 'sem')}>Sem ônibus</Chip>
            </div>

            <p className="text-xs text-gray-400">{tituloFiltro} · {filtrados.length} {filtrados.length === 1 ? 'pessoa' : 'pessoas'}</p>

            <div className="max-h-[45vh] overflow-auto rounded-lg border border-white/10">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-neutral-900 text-xs text-gray-400">
                  <tr>
                    <th className="px-3 py-2 text-left">Nome</th>
                    <th className="px-3 py-2 text-left">Grupo</th>
                    <th className="px-3 py-2 text-left">Ônibus</th>
                    <th className="px-3 py-2 text-left">Presença</th>
                    <th className="px-3 py-2 text-left">Telefone</th>
                    <th className="px-3 py-2 text-left">Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-500">Ninguém com esses filtros.</td></tr>
                  )}
                  {filtrados.map((p) => (
                    <tr key={chave(p)} className="border-t border-white/5 align-top">
                      <td className="px-3 py-1.5 text-gray-100">
                        {p.nome}
                        {p.menor && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full border border-amber-500/40 text-amber-200">menor</span>}
                        {p.infiltrado && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full border border-fuchsia-500/40 text-fuchsia-200">infiltrado</span>}
                        {!p.pago && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full border border-amber-500/40 text-amber-300">não pagou</span>}
                      </td>
                      <td className="px-3 py-1.5"><GrupoTrilhaTag grupo={p.grupo} className="text-[10px] px-2" /></td>
                      <td className="px-3 py-1.5 text-gray-300 whitespace-nowrap">{onibusDe(p) ? `Ônibus ${onibusDe(p)}` : '—'}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        {p.chegou_em ? (
                          <span className="inline-flex items-center gap-1 text-emerald-300" title={`Marcado por ${quemFez(p.chegou_por)}${p.responsavel_ciente ? ' · responsável ciente' : ''}`}>
                            <CheckCircle2 className="w-3.5 h-3.5" />{horaCurta(p.chegou_em)} · {quemFez(p.chegou_por)}
                          </span>
                        ) : <span className="text-amber-300">Falta</span>}
                      </td>
                      <td className="px-3 py-1.5 text-gray-400 whitespace-nowrap">{formatarTelefone(p.whatsapp) || p.whatsapp || '—'}</td>
                      <td className="px-3 py-1.5 text-gray-300 max-w-[280px] whitespace-pre-wrap break-words">{p.observacao || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
      </DialogContent>
    </Dialog>
  );
};

export default PresencaAcampantesDialog;
