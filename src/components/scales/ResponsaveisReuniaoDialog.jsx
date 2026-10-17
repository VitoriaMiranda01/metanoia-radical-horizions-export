import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Crown, Loader2, Search, UserCog, UserPlus, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import {
  fetchResponsaveisReuniao, definirResponsavelReuniao, removerResponsavelReuniao, definirResponsavelEmBloco
} from '@/services/scalesService';
import { formatCPF } from '@/utils/formatters';
import { cn } from '@/lib/utils';

/**
 * Responsaveis pela reuniao da escala (15/10/2026, Patrick).
 *
 * Quem conduz a Leitura de Escala no lugar do lider (ou junto com ele): faz a
 * chamada e manda o convite do grupo, pelo acompanhamento da inscricao. O
 * lider escolhe um da propria equipe pelo celular ("Delegar reuniao"); aqui
 * os organizadores veem todas as equipes.
 *
 * 17/10/2026 (Patrick):
 *  - VARIOS responsaveis por equipe, e podem ser de OUTRA area (ex.: a Vitoria
 *    conduz a reuniao de 3 areas);
 *  - "Responsável de outra área (em bloco)", no topo: escolhe a pessoa e marca
 *    todas as equipes dela de uma vez;
 *  - em cada equipe, antes do primeiro nome, "Responsável será de outra área";
 *  - a busca de pessoa mostra nome, igreja, CPF e onde ela esta escalada,
 *    para nao escolher a pessoa errada;
 *  - da para definir antes de lancar a provisoria.
 *
 * pessoas: todos os equipantes aprovados [{ id, nome, igreja, cpf, areas: [{ area, atuacao, cor }] }].
 */

const CORES = { Amarelo: '#facc15', Azul: '#3b82f6', Roxo: '#a855f7', Verde: '#22c55e', Vermelho: '#ef4444' };
const semAcento = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const chaveDe = (e) => `${e.area}|${e.cor || ''}`;
const rotuloEquipe = (e) => `${e.area}${e.cor ? ` · ${e.cor}` : ''}`;
const delegadosDe = (e) => e.delegados || (e.delegado ? [e.delegado] : []);

const Bolinha = ({ cor }) => (cor
  ? <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ background: CORES[cor] || '#999' }} />
  : null);

const ResponsaveisReuniaoDialog = ({ onClose, pessoas = [] }) => {
  const { toast } = useToast();
  const [equipes, setEquipes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  // { chave, modo: 'equipe' | 'fora' }
  const [escolhendo, setEscolhendo] = useState(null);
  const [salvando, setSalvando] = useState(null);
  const [emBloco, setEmBloco] = useState(false);

  const carregar = useCallback(async () => {
    const r = await fetchResponsaveisReuniao();
    setCarregando(false);
    if (!r.success) { setErro(r.error); return; }
    setErro('');
    setEquipes(r.equipes);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    const aoTeclar = (e) => { if (e.key === 'Escape' && !emBloco) onClose(); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onClose, emBloco]);

  const termo = semAcento(busca.trim());
  const mostradas = useMemo(() => equipes.filter((e) => !termo
    || semAcento(`${e.area} ${e.cor || ''} ${(e.lideres || []).join(' ')} ${delegadosDe(e).map((d) => d.nome).join(' ')}`).includes(termo)),
  [equipes, termo]);
  const comResponsavel = equipes.filter((e) => delegadosDe(e).length > 0).length;

  const acrescentar = async (equipe, pessoa) => {
    const chave = chaveDe(equipe);
    setSalvando(chave);
    const r = await definirResponsavelReuniao(equipe.area, equipe.cor, pessoa.id || pessoa.equipante_id);
    setSalvando(null);
    if (!r.success) {
      toast({ title: 'Não deu para salvar', description: r.error, variant: 'destructive' });
      return;
    }
    toast({ title: `${pessoa.nome} conduz a reunião de ${rotuloEquipe(equipe)}`, className: 'bg-emerald-600 text-white' });
    setEscolhendo(null);
    carregar();
  };

  const tirar = async (equipe, d) => {
    const chave = chaveDe(equipe);
    setSalvando(chave);
    const r = await removerResponsavelReuniao(equipe.area, equipe.cor, d.equipante_id);
    setSalvando(null);
    if (!r.success) {
      toast({ title: 'Não deu para tirar', description: r.error, variant: 'destructive' });
      return;
    }
    toast({ title: `${d.nome} não conduz mais a reunião de ${rotuloEquipe(equipe)}` });
    carregar();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-black border border-white/10 rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start gap-4 p-5 border-b border-white/10 bg-zinc-900">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <UserCog className="h-5 w-5 text-amber-300" /> Responsáveis pela reunião da escala
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              Quem conduz a Leitura de Escala no lugar do líder (ou junto com ele): faz a chamada e manda o convite do
              grupo, pelo acompanhamento da inscrição. Pode ter mais de um por equipe, e pode ser gente de outra área.
            </p>
            {!carregando && (
              <p className="text-xs text-gray-500 mt-1">{equipes.length} equipes · {comResponsavel} com responsável</p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-white shrink-0">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar área, cor, líder ou responsável..."
              className="h-9 pl-8 bg-black/40 border-white/20 text-white" />
          </div>
          <Button size="sm" onClick={() => setEmBloco(true)} disabled={carregando || !!erro}
            data-dica="Escolher uma pessoa (de qualquer área) e torná-la responsável pela reunião de várias equipes de uma vez."
            className="h-9 bg-amber-600 hover:bg-amber-700 text-white shrink-0">
            <Users className="h-4 w-4 mr-1.5" /> Responsável de outra área (em bloco)
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {carregando && (
            <div className="flex items-center justify-center gap-2 py-12 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" /> Carregando...
            </div>
          )}
          {!carregando && erro && <p className="text-red-300 text-sm text-center py-12">{erro}</p>}

          {!carregando && !erro && mostradas.map((e) => {
            const chave = chaveDe(e);
            const aberta = escolhendo?.chave === chave;
            const delegados = delegadosDe(e);
            return (
              <div key={chave} className={cn('rounded-md border p-3', delegados.length ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/10 bg-white/5')}>
                <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold flex items-center gap-2">
                      {e.area}
                      {e.cor && (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-300 font-normal">
                          <Bolinha cor={e.cor} /> {e.cor}
                        </span>
                      )}
                      <span className="text-xs text-gray-500 font-normal">{(e.membros || []).length} pessoas</span>
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      <Crown className="inline h-3 w-3 mr-1 text-amber-300/70" />
                      {e.lideres?.length ? e.lideres.join(', ') : 'sem líder'}
                    </p>
                    {delegados.length > 0 && (
                      <ul className="mt-1.5 space-y-1">
                        {delegados.map((d) => (
                          <li key={d.equipante_id} className="flex items-center gap-2 text-xs">
                            <span className="text-amber-200">
                              Responsável: <strong>{d.nome}</strong>
                            </span>
                            {d.de_fora && (
                              <span className="rounded px-1.5 py-0.5 bg-sky-500/15 text-sky-200 border border-sky-500/30"
                                data-dica="Não está nesta equipe: foi posto(a) pela organização.">
                                de outra área{d.areas?.length ? ` · ${d.areas.join(', ')}` : ''}
                              </span>
                            )}
                            {d.definido_por && <span className="text-gray-500">por {d.definido_por}</span>}
                            <button type="button" disabled={salvando === chave} onClick={() => tirar(e, d)}
                              aria-label={`Tirar ${d.nome}`} data-dica={`Tirar ${d.nome} desta reunião.`}
                              className="ml-auto sm:ml-0 rounded p-0.5 text-red-400 hover:text-red-300 hover:bg-red-500/10">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0 items-center">
                    {salvando === chave && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
                    <Button size="sm" variant="outline" onClick={() => setEscolhendo(aberta ? null : { chave, modo: 'equipe' })}
                      className="h-8 border-amber-500/40 bg-transparent text-amber-200 hover:bg-amber-500/10 hover:text-amber-100">
                      <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                      {delegados.length ? 'Adicionar responsável' : 'Escolher responsável'}
                    </Button>
                  </div>
                </div>
                {aberta && escolhendo.modo === 'equipe' && (
                  <EscolherMembro equipe={e} ocupado={salvando === chave}
                    onDeFora={() => setEscolhendo({ chave, modo: 'fora' })}
                    onEscolher={(p) => acrescentar(e, p)} />
                )}
                {aberta && escolhendo.modo === 'fora' && (
                  <div className="mt-3 rounded-md border border-sky-500/30 bg-black/40 p-2 space-y-2">
                    <button type="button" onClick={() => setEscolhendo({ chave, modo: 'equipe' })}
                      className="text-xs text-gray-400 hover:text-white flex items-center gap-1">
                      <ArrowLeft className="h-3.5 w-3.5" /> voltar para a equipe
                    </button>
                    <p className="text-xs text-sky-200">
                      Responsável de outra área para <strong>{rotuloEquipe(e)}</strong>: busque pelo nome, CPF ou igreja.
                    </p>
                    <BuscaPessoa pessoas={pessoas} jaSao={delegados.map((d) => d.equipante_id)} ocupado={salvando === chave}
                      onEscolher={(p) => acrescentar(e, p)} />
                  </div>
                )}
              </div>
            );
          })}
          {!carregando && !erro && mostradas.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-12">Nenhuma equipe encontrada.</p>
          )}
        </div>
      </div>

      {emBloco && (
        <EmBlocoDialog equipes={equipes} pessoas={pessoas}
          onClose={() => setEmBloco(false)}
          onPronto={() => { setEmBloco(false); carregar(); }} />
      )}
    </div>
  );
};

const EscolherMembro = ({ equipe, ocupado, onEscolher, onDeFora }) => {
  const [busca, setBusca] = useState('');
  const termo = semAcento(busca.trim());
  const ja = new Set(delegadosDe(equipe).map((d) => d.equipante_id));
  const membros = useMemo(() => [...(equipe.membros || [])]
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'))
    .filter((m) => !termo || semAcento(m.nome).includes(termo)), [equipe, termo]);

  return (
    <div className="mt-3 rounded-md border border-amber-500/30 bg-black/40 p-2 space-y-2">
      <Input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar na equipe"
        className="h-9 bg-black/40 border-white/20 text-white" />
      <div className="max-h-64 overflow-y-auto">
        {/* Antes do primeiro nome: alguem que NAO esta nesta equipe. */}
        <button type="button" onClick={onDeFora}
          className="w-full flex items-center gap-2 rounded px-2 py-2 mb-1 text-left text-sm border border-dashed border-sky-500/40 text-sky-200 hover:bg-sky-500/10">
          <Users className="h-4 w-4 shrink-0" />
          <span className="flex-1">O responsável será de outra área…</span>
        </button>
        {membros.map((m) => {
          const atual = ja.has(m.equipante_id);
          return (
            <button key={m.equipante_id} type="button" disabled={ocupado || atual} onClick={() => onEscolher(m)}
              className={cn('w-full flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm',
                atual ? 'bg-amber-500/15 text-amber-100' : 'text-gray-100 hover:bg-white/10')}>
              <span className="flex-1 truncate">{m.nome}</span>
              {atual && <Check className="h-4 w-4" />}
            </button>
          );
        })}
        {membros.length === 0 && <p className="text-xs text-gray-500 text-center py-3">Ninguém encontrado.</p>}
      </div>
    </div>
  );
};

// Busca de qualquer equipante aprovado, com os detalhes que evitam escolher a
// pessoa errada (homonimos): igreja, CPF e onde ela esta escalada.
const BuscaPessoa = ({ pessoas, jaSao = [], ocupado, onEscolher, autoFocus = true }) => {
  const [busca, setBusca] = useState('');
  const termo = semAcento(busca.trim());
  const digitos = busca.replace(/\D/g, '');
  const achados = useMemo(() => {
    if (termo.length < 2 && digitos.length < 3) return [];
    return pessoas.filter((p) => (termo.length >= 2 && semAcento(`${p.nome} ${p.igreja || ''}`).includes(termo))
      || (digitos.length >= 3 && String(p.cpf || '').replace(/\D/g, '').includes(digitos)))
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'))
      .slice(0, 30);
  }, [pessoas, termo, digitos]);
  const ja = new Set(jaSao);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
        <Input autoFocus={autoFocus} value={busca} onChange={(e) => setBusca(e.target.value)}
          placeholder="Nome, CPF ou igreja (pelo menos 2 letras)"
          className="h-9 pl-8 bg-black/40 border-white/20 text-white" />
      </div>
      <div className="max-h-72 overflow-y-auto space-y-1">
        {achados.map((p) => {
          const atual = ja.has(p.id);
          return (
            <button key={p.id} type="button" disabled={ocupado || atual} onClick={() => onEscolher(p)}
              className={cn('w-full rounded-md border px-3 py-2 text-left',
                atual ? 'border-amber-500/40 bg-amber-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-sky-500/40')}>
              <span className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white flex-1 min-w-0 truncate">{p.nome}</span>
                {atual ? <span className="text-[11px] text-amber-200 flex items-center gap-1"><Check className="h-3.5 w-3.5" /> já é responsável</span>
                  : <span className="text-[11px] text-sky-300">escolher</span>}
              </span>
              <span className="block text-xs text-gray-400 truncate">
                {p.igreja || 'Igreja não informada'}{p.cpf ? ` · CPF ${formatCPF(p.cpf)}` : ' · sem CPF'}
              </span>
              <span className="mt-1 flex flex-wrap gap-1">
                {(p.areas || []).length === 0 && <span className="text-[11px] text-gray-500">ainda sem área</span>}
                {(p.areas || []).map((a) => (
                  <span key={`${a.area}-${a.cor || ''}`} className="inline-flex items-center gap-1 rounded border border-green-500/30 bg-green-500/10 px-1.5 py-0.5 text-[11px] text-green-200">
                    <Bolinha cor={a.cor} />
                    {a.area}{a.atuacao && a.atuacao !== a.area ? ` · ${a.atuacao}` : ''}
                  </span>
                ))}
              </span>
            </button>
          );
        })}
        {(termo.length >= 2 || digitos.length >= 3) && achados.length === 0 && (
          <p className="text-xs text-gray-500 text-center py-3">Ninguém aprovado com esse nome, CPF ou igreja.</p>
        )}
      </div>
    </div>
  );
};

// Em bloco: 1) escolhe a pessoa; 2) marca as equipes; 3) confirma.
const EmBlocoDialog = ({ equipes, pessoas, onClose, onPronto }) => {
  const { toast } = useToast();
  const [pessoa, setPessoa] = useState(null);
  const [marcadas, setMarcadas] = useState({});
  const [busca, setBusca] = useState('');
  const [salvando, setSalvando] = useState(false);
  const termo = semAcento(busca.trim());

  useEffect(() => {
    const aoTeclar = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onClose]);

  const lista = useMemo(() => equipes.filter((e) => !termo || semAcento(rotuloEquipe(e)).includes(termo)), [equipes, termo]);
  const escolhidas = equipes.filter((e) => marcadas[chaveDe(e)]);
  const jaE = (e) => pessoa && delegadosDe(e).some((d) => d.equipante_id === pessoa.id);

  const confirmar = async () => {
    setSalvando(true);
    const r = await definirResponsavelEmBloco(pessoa.id, escolhidas.map((e) => ({ area: e.area, cor: e.cor || null })));
    setSalvando(false);
    if (!r.success) {
      toast({ title: 'Não deu para salvar', description: r.error, variant: 'destructive' });
      return;
    }
    toast({
      title: `${pessoa.nome} conduz ${r.definidos} ${r.definidos === 1 ? 'reunião' : 'reuniões'}`,
      description: r.falhas?.length ? `Não deu em: ${r.falhas.map((f) => `${f.area}${f.cor ? ` · ${f.cor}` : ''} (${f.erro})`).join('; ')}` : undefined,
      className: r.falhas?.length ? undefined : 'bg-emerald-600 text-white',
      variant: r.falhas?.length ? 'destructive' : undefined
    });
    onPronto();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[60]" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="bg-zinc-950 border border-amber-500/30 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start gap-4 p-5 border-b border-white/10">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-amber-300" /> Responsável de outra área (em bloco)
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              {pessoa ? '2. Marque as equipes em que esta pessoa vai conduzir a reunião.' : '1. Escolha a pessoa (confira igreja, CPF e áreas).'}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-white shrink-0">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {!pessoa ? (
          <div className="p-4 overflow-y-auto">
            <BuscaPessoa pessoas={pessoas} onEscolher={(p) => setPessoa(p)} />
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-white/10 space-y-3">
              <div className="rounded-md border border-sky-500/30 bg-sky-500/5 px-3 py-2 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold">{pessoa.nome}</p>
                  <p className="text-xs text-gray-400">
                    {pessoa.igreja || 'Igreja não informada'}{pessoa.cpf ? ` · CPF ${formatCPF(pessoa.cpf)}` : ' · sem CPF'}
                  </p>
                  <p className="text-xs text-gray-400">
                    Escalada em: {(pessoa.areas || []).length ? pessoa.areas.map((a) => rotuloEquipe(a)).join(', ') : 'nenhuma área ainda'}
                  </p>
                </div>
                <button type="button" onClick={() => { setPessoa(null); setMarcadas({}); }}
                  className="text-xs text-sky-300 hover:text-sky-200 underline shrink-0">trocar pessoa</button>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
                <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar equipe (área ou cor)"
                  className="h-9 pl-8 bg-black/40 border-white/20 text-white" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {lista.map((e) => {
                const chave = chaveDe(e);
                const ja = jaE(e);
                const outros = delegadosDe(e).filter((d) => d.equipante_id !== pessoa.id);
                return (
                  <label key={chave} className={cn('flex items-start gap-3 rounded-md border px-3 py-2 cursor-pointer',
                    ja ? 'border-amber-500/30 bg-amber-500/5 cursor-default' : marcadas[chave] ? 'border-amber-400/60 bg-amber-400/10' : 'border-white/10 bg-white/5 hover:bg-white/10')}>
                    <input type="checkbox" className="mt-1 h-4 w-4 accent-amber-500" disabled={ja}
                      checked={ja || !!marcadas[chave]}
                      onChange={(ev) => setMarcadas((m) => ({ ...m, [chave]: ev.target.checked }))} />
                    <span className="flex-1 min-w-0">
                      <span className="text-sm text-white font-medium flex items-center gap-1.5">
                        {e.area} {e.cor && <><Bolinha cor={e.cor} /><span className="text-xs text-gray-300 font-normal">{e.cor}</span></>}
                        <span className="text-xs text-gray-500 font-normal">· {(e.membros || []).length} pessoas</span>
                      </span>
                      <span className="block text-xs text-gray-400 truncate">
                        Líder: {e.lideres?.length ? e.lideres.join(', ') : 'sem líder'}
                        {outros.length ? ` · já tem: ${outros.map((d) => d.nome).join(', ')}` : ''}
                      </span>
                      {ja && <span className="block text-xs text-amber-200">já conduz esta reunião</span>}
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="p-4 border-t border-white/10 flex items-center gap-3">
              <p className="text-sm text-gray-300 flex-1">
                {escolhidas.length === 0 ? 'Nenhuma equipe marcada.'
                  : `${escolhidas.length} ${escolhidas.length === 1 ? 'equipe marcada' : 'equipes marcadas'}: ${escolhidas.map(rotuloEquipe).join(', ')}`}
              </p>
              <Button onClick={confirmar} disabled={salvando || escolhidas.length === 0}
                className="bg-amber-600 hover:bg-amber-700 text-white shrink-0">
                {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : `Definir em ${escolhidas.length || ''} ${escolhidas.length === 1 ? 'equipe' : 'equipes'}`}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ResponsaveisReuniaoDialog;
