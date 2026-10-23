import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, Check, Link2, Loader2, Plus, Search, Trash2, Undo2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import GrupoTrilhaTag from '@/components/common/GrupoTrilhaTag';
import { GROUPS } from '@/utils/gruposTrailha';
import { casaBusca } from '@/utils/busca';
import { rotuloDoTipo, tipoEntreSi, TIPOS_VINCULO } from '@/utils/vinculosAcampantes';
import { cn } from '@/lib/utils';

/**
 * Vinculos de um acampante no card do grupo de trilha (Patrick, 12/10/2026):
 * com quem ele nao deveria ficar, em que grupo o outro esta, mover o outro dali
 * mesmo, a sugestao vinda da inscricao ("vai com") e o "+ Vinculo".
 * So aviso -- nada aqui impede de juntar dois vinculados.
 */

const primeiroNome = (nome) => String(nome || '').trim().split(/\s+/)[0] || '';

const textoDoAviso = (nome, avisos, grupo) =>
  `${nome} não deveria ficar no grupo ${grupo}: ${avisos.map((a) => `${a.nome} (${a.rotulo.toLowerCase()})`).join(', ')} ${avisos.length > 1 ? 'estão' : 'está'} nele.`;

/**
 * Escolher o novo grupo e mover. O grupo onde ja tem alguem vinculado vem
 * marcado com aviso; ao mover para ele, pede "mover mesmo assim".
 */
export const SeletorMoverGrupo = ({ acampante, avisoPara, onMover, placeholder = 'Novo grupo...', compacto = false }) => {
  const [grupo, setGrupo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [confirmar, setConfirmar] = useState(null);
  const outros = GROUPS.filter((g) => g !== acampante.grupo_trailha);

  const mover = async (forcar = false) => {
    if (!grupo || !onMover) return;
    const avisos = avisoPara ? avisoPara(acampante.id, grupo) : [];
    if (avisos.length && !forcar) { setConfirmar(avisos); return; }
    setSalvando(true);
    try {
      await onMover(acampante, grupo);
      setGrupo('');
      setConfirmar(null);
    } finally {
      setSalvando(false);
    }
  };

  // Fragmento: dentro de uma linha flex-wrap, o aviso desce para a linha de
  // baixo inteira (basis-full) sem espremer o que esta ao lado.
  return (
    <>
      <div className="flex items-center gap-1.5 shrink-0">
        <Select value={grupo} onValueChange={(g) => { setGrupo(g); setConfirmar(null); }} disabled={salvando}>
          <SelectTrigger className={cn('h-8 shrink-0 bg-white/5 border-white/10 text-white text-xs', compacto ? 'w-[150px]' : 'w-[130px]')}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {outros.map((g) => {
              const n = avisoPara ? avisoPara(acampante.id, g).length : 0;
              return (
                <SelectItem key={g} value={g}>
                  <span className="inline-flex items-center gap-1.5">
                    {g}
                    {n > 0 && <AlertTriangle className="w-3 h-3 text-amber-400" aria-label="tem vínculo neste grupo" />}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        <Button
          type="button" size="icon" variant="outline" onClick={() => mover(false)}
          data-dica={`Mudar ${primeiroNome(acampante.nome)} para o grupo escolhido ao lado.`}
          disabled={!grupo || salvando}
          className="h-8 w-8 shrink-0 bg-white/5 border-white/10 text-gray-300 hover:bg-white/15 hover:text-white"
          aria-label="Mover de grupo"
        >
          {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRightLeft className="w-3.5 h-3.5" />}
        </Button>
      </div>
      {confirmar && (
        <div className={cn('basis-full w-full rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-100 space-y-2', compacto && 'mt-1.5')}>
          <p className="flex gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />{textoDoAviso(primeiroNome(acampante.nome), confirmar, grupo)}</p>
          <div className="flex gap-1.5 justify-end">
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs text-gray-300 hover:bg-white/10" onClick={() => setConfirmar(null)}>Cancelar</Button>
            <Button type="button" size="sm" className="h-7 px-2 text-xs bg-amber-600 hover:bg-amber-700 text-white" onClick={() => mover(true)} disabled={salvando}>
              {salvando && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}Mover mesmo assim
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

const SelectTipo = ({ valor, onChange, className }) => (
  <Select value={valor} onValueChange={onChange}>
    <SelectTrigger className={cn('h-8 bg-white/5 border-white/10 text-white text-xs', className)}>
      <SelectValue placeholder="Tipo..." />
    </SelectTrigger>
    <SelectContent>
      {TIPOS_VINCULO.map((t) => <SelectItem key={t.valor} value={t.valor}>{t.rotulo}</SelectItem>)}
    </SelectContent>
  </Select>
);

/**
 * A etiqueta da cor do grupo, clicavel (23/10/2026): troca a pessoa entre as
 * 5 cores ali mesmo. Cor com alguem vinculado vem com aviso e pede "mover
 * mesmo assim". Sem onMover, e so a etiqueta.
 */
export const TrocarCor = ({ pessoa, avisoPara, onMover }) => {
  const [pendente, setPendente] = useState(null);
  const [salvando, setSalvando] = useState(false);
  if (!onMover) return <GrupoTrilhaTag grupo={pessoa.grupo_trailha} className="text-[10px] px-2" />;

  const mover = async (grupo, forcar = false) => {
    const avisos = avisoPara ? avisoPara(pessoa.id, grupo) : [];
    if (avisos.length && !forcar) { setPendente({ grupo, avisos }); return; }
    setSalvando(true);
    try {
      await onMover(pessoa, grupo);
      setPendente(null);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <Select value={pessoa.grupo_trailha || undefined} onValueChange={(g) => { if (g !== pessoa.grupo_trailha) mover(g); }} disabled={salvando}>
        <SelectTrigger
          aria-label={`Cor do grupo de ${primeiroNome(pessoa.nome)}`}
          data-dica={`Trocar ${primeiroNome(pessoa.nome)} de cor (grupo de trilha).`}
          className="h-auto w-auto gap-1 border-0 bg-transparent p-0 shadow-none focus:ring-0 focus:ring-offset-0 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-gray-400"
        >
          {salvando
            ? <span className="inline-flex items-center gap-1 text-[10px] text-gray-400"><Loader2 className="w-3 h-3 animate-spin" />movendo</span>
            : <GrupoTrilhaTag grupo={pessoa.grupo_trailha} className="text-[10px] px-2" />}
        </SelectTrigger>
        <SelectContent className="bg-neutral-900 border-white/15 text-white">
          {GROUPS.map((g) => {
            const n = g !== pessoa.grupo_trailha && avisoPara ? avisoPara(pessoa.id, g).length : 0;
            return (
              <SelectItem key={g} value={g} className="text-white focus:bg-white/10 focus:text-white data-[state=checked]:bg-white/5">
                <span className="inline-flex items-center gap-1.5">
                  <GrupoTrilhaTag grupo={g} className="text-[10px] px-2" />
                  {n > 0 && <AlertTriangle className="w-3 h-3 text-amber-400" aria-label="tem vínculo neste grupo" />}
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      {pendente && (
        <div className="basis-full w-full rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-100 space-y-2">
          <p className="flex gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />{textoDoAviso(primeiroNome(pessoa.nome), pendente.avisos, pendente.grupo)}</p>
          <div className="flex gap-1.5 justify-end">
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs text-gray-300 hover:bg-white/10" onClick={() => setPendente(null)}>Cancelar</Button>
            <Button type="button" size="sm" className="h-7 px-2 text-xs bg-amber-600 hover:bg-amber-700 text-white" onClick={() => mover(pendente.grupo, true)} disabled={salvando}>
              {salvando && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}Mover mesmo assim
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

/** Busca em todos os participantes dos grupos (acampantes e infiltrados). */
const BuscaPessoa = ({ vinc, excluir, busca, setBusca, placeholder, onEscolher }) => {
  const resultados = useMemo(() => {
    if (!busca.trim()) return [];
    return Array.from(vinc.porId.values())
      .filter((a) => !excluir.has(a.id) && casaBusca(busca, [a.nome, a.cpf, a.whatsapp]))
      .sort((x, y) => String(x.nome).localeCompare(String(y.nome), 'pt-BR'))
      .slice(0, 8);
  }, [busca, vinc.porId, excluir]);

  return (
    <>
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500 pointer-events-none" />
        <Input
          autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={placeholder}
          className="h-8 pl-7 text-xs bg-white/5 border-white/10 text-white placeholder:text-gray-500"
        />
      </div>
      {busca.trim() && (
        <div className="max-h-48 overflow-y-auto space-y-1">
          {resultados.length === 0 && <p className="text-xs text-gray-500 px-1">Ninguém encontrado.</p>}
          {resultados.map((a) => (
            <button
              key={a.id} type="button" onClick={() => onEscolher(a)}
              className="w-full flex items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs text-gray-200 hover:bg-white/10"
            >
              <span className="truncate">{a.nome}{a.infiltrado && <span className="ml-1.5 text-[10px] text-gray-500">infiltrado</span>}</span>
              <GrupoTrilhaTag grupo={a.grupo_trailha} className="text-[10px] px-2" />
            </button>
          ))}
        </div>
      )}
    </>
  );
};

/**
 * "+ Vinculo": liga o acampante a UMA OU MAIS pessoas de uma vez (familia de 3,
 * turma de amigos -- 23/10/2026). Procura em todos os acampantes e infiltrados,
 * de qualquer grupo. Com 2+ pessoas, "ligar entre si" cria tambem os pares
 * entre elas (o tipo e deduzido: filhos -> irmaos, conjuge + filho -> filho...).
 */
export const NovoVinculo = ({ acampante, vinc, buscaInicial = '', onFechar }) => {
  const [busca, setBusca] = useState(buscaInicial);
  const [pessoas, setPessoas] = useState([]);
  const [entreSi, setEntreSi] = useState(true);
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);

  const ligadosDe = (id) => new Set((vinc.porAcampante.get(id) || []).map((x) => x.outroId));
  const excluir = useMemo(() => {
    const s = ligadosDe(acampante.id);
    s.add(acampante.id);
    pessoas.forEach((p) => s.add(p.pessoa.id));
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vinc.porAcampante, acampante.id, pessoas]);

  const adicionar = (a) => { setPessoas((l) => [...l, { pessoa: a, tipo: 'AMIGO / AMIGA' }]); setBusca(''); };
  const mudarTipo = (id, tipo) => setPessoas((l) => l.map((p) => (p.pessoa.id === id ? { ...p, tipo } : p)));
  const tirar = (id) => setPessoas((l) => l.filter((p) => p.pessoa.id !== id));

  // Pares entre as pessoas escolhidas que ainda nao tem vinculo.
  const paresEntreSi = useMemo(() => {
    const pares = [];
    pessoas.forEach((p, i) => pessoas.slice(i + 1).forEach((q) => {
      if (!ligadosDe(p.pessoa.id).has(q.pessoa.id)) pares.push({ p, q, tipo: tipoEntreSi(p.tipo, q.tipo) });
    }));
    return pares;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pessoas, vinc.porAcampante]);

  const total = pessoas.length + (entreSi && pessoas.length > 1 ? paresEntreSi.length : 0);

  const salvar = async () => {
    if (!pessoas.length) return;
    setSalvando(true);
    // "<pessoa> e <tipo> de acampante": A = acampante, B = pessoa.
    const lista = pessoas.map(({ pessoa, tipo }) => ({ a: acampante.id, b: pessoa.id, tipo, observacao }));
    if (entreSi && pessoas.length > 1) {
      paresEntreSi.forEach(({ p, q, tipo }) => lista.push({
        a: p.pessoa.id, b: q.pessoa.id, tipo,
        observacao: tipo === 'OUTRO' ? `Vêm juntos com ${acampante.nome}` : null,
      }));
    }
    const r = await vinc.salvarVarios(lista);
    setSalvando(false);
    if (r.success) onFechar?.();
  };

  return (
    <div className="rounded-md border border-white/15 bg-black/40 p-2.5 space-y-2">
      {pessoas.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-wide text-gray-500">Ligar {primeiroNome(acampante.nome)} a</p>
          {pessoas.map(({ pessoa, tipo }) => (
            <div key={pessoa.id} className="flex flex-wrap items-center gap-1.5 rounded bg-white/5 px-2 py-1.5 text-xs">
              <span className="text-gray-200 truncate max-w-[12rem]">{pessoa.nome}</span>
              <GrupoTrilhaTag grupo={pessoa.grupo_trailha} className="text-[10px] px-2" />
              <span className="text-gray-400 ml-auto">é</span>
              <SelectTipo valor={tipo} onChange={(t) => mudarTipo(pessoa.id, t)} className="w-[150px]" />
              <button type="button" onClick={() => tirar(pessoa.id)} aria-label={`Tirar ${pessoa.nome}`} className="text-gray-500 hover:text-red-300 p-0.5">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <BuscaPessoa
        vinc={vinc} excluir={excluir} busca={busca} setBusca={setBusca} onEscolher={adicionar}
        placeholder={pessoas.length ? 'Adicionar mais alguém (nome, CPF ou telefone)...' : 'Nome, CPF ou telefone de quem vem junto...'}
      />

      {pessoas.length > 1 && (
        <label className="flex items-start gap-2 text-xs text-gray-300 cursor-pointer">
          <input type="checkbox" checked={entreSi} onChange={(e) => setEntreSi(e.target.checked)} className="mt-0.5 accent-emerald-500" />
          <span>
            Ligar também entre si (mesma família ou turma)
            {entreSi && paresEntreSi.length > 0 && (
              <span className="block text-gray-500">
                {paresEntreSi.map(({ p, q, tipo }) => `${primeiroNome(q.pessoa.nome)} é ${rotuloDoTipo(tipo).toLowerCase()} de ${primeiroNome(p.pessoa.nome)}`).join(' · ')}
              </span>
            )}
          </span>
        </label>
      )}

      {pessoas.length > 0 && (
        <Input
          value={observacao} onChange={(e) => setObservacao(e.target.value)}
          placeholder="Observação (opcional)"
          className="h-8 text-xs bg-white/5 border-white/10 text-white placeholder:text-gray-500"
        />
      )}

      <div className="flex justify-end gap-1.5">
        <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs text-gray-400 hover:bg-white/10" onClick={onFechar}>Cancelar</Button>
        {pessoas.length > 0 && (
          <Button type="button" size="sm" className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={salvar} disabled={salvando}>
            {salvando ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
            {total === 1 ? 'Salvar vínculo' : `Salvar ${total} vínculos`}
          </Button>
        )}
      </div>
    </div>
  );
};

/**
 * "+ Novo vinculo" da janela geral: primeiro escolhe a pessoa (acampante ou
 * infiltrado), depois com quem ela vem.
 */
export const NovoVinculoAvulso = ({ vinc, onFechar }) => {
  const [busca, setBusca] = useState('');
  const [principal, setPrincipal] = useState(null);
  const nenhum = useMemo(() => new Set(), []);

  if (principal) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-gray-200 truncate"><span className="text-gray-400">Pessoa: </span>{principal.nome}</span>
          <button type="button" onClick={() => setPrincipal(null)} className="text-gray-400 hover:text-white shrink-0">Trocar</button>
        </div>
        <NovoVinculo acampante={principal} vinc={vinc} onFechar={onFechar} />
      </div>
    );
  }
  return (
    <div className="rounded-md border border-white/15 bg-black/40 p-2.5 space-y-2">
      <p className="text-xs text-gray-400">Escolha a pessoa (acampante ou infiltrado):</p>
      <BuscaPessoa vinc={vinc} excluir={nenhum} busca={busca} setBusca={setBusca} onEscolher={setPrincipal} placeholder="Nome, CPF ou telefone..." />
      <div className="flex justify-end">
        <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs text-gray-400 hover:bg-white/10" onClick={onFechar}>Cancelar</Button>
      </div>
    </div>
  );
};

/**
 * Sugestao da inscricao: "vai com <texto>". O organizador confirma quem e
 * (vira vinculo) ou ignora (some daqui e pode ser desfeita depois).
 */
export const SugestaoVinculo = ({ sugestao, vinc, onProcurar }) => {
  const [escolhido, setEscolhido] = useState(sugestao.candidatos[0]?.acampante.id || null);
  const [tipo, setTipo] = useState(sugestao.tipo);
  const [salvando, setSalvando] = useState(null);
  const a = sugestao.acampante;

  const confirmar = async () => {
    if (!escolhido) return;
    setSalvando('confirmar');
    await vinc.salvar({ a: a.id, b: escolhido, tipo, origem: a.id }, 'Vínculo confirmado');
    setSalvando(null);
  };
  const ignorar = async (sim) => {
    setSalvando('ignorar');
    await vinc.ignorar(a.id, sim);
    setSalvando(null);
  };

  if (sugestao.ignorada) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span className="truncate">Na inscrição: vai com "{sugestao.texto}" ({rotuloDoTipo(sugestao.tipo).toLowerCase()}) · sugestão ignorada</span>
        <button type="button" onClick={() => ignorar(false)} disabled={!!salvando} className="inline-flex items-center gap-1 text-gray-300 hover:text-white shrink-0">
          <Undo2 className="w-3 h-3" /> Desfazer
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-sky-500/30 bg-sky-500/5 p-2.5 space-y-2 text-xs">
      <p className="text-sky-200">
        <span className="font-medium">Sugestão da inscrição:</span> vai com "{sugestao.texto}" ({rotuloDoTipo(sugestao.tipo).toLowerCase()})
      </p>
      {sugestao.candidatos.length > 0 ? (
        <div className="space-y-1">
          <p className="text-gray-400">{sugestao.candidatos.length > 1 ? 'Qual destes é?' : 'É este?'}</p>
          {sugestao.candidatos.map(({ acampante: c, exato }) => (
            <label key={c.id} className={cn('flex items-center gap-2 rounded px-2 py-1 cursor-pointer', escolhido === c.id ? 'bg-white/10' : 'hover:bg-white/5')}>
              <input type="radio" name={`sug-${a.id}`} checked={escolhido === c.id} onChange={() => setEscolhido(c.id)} className="accent-sky-500" />
              <span className="truncate text-gray-200 flex-1">{c.nome}</span>
              <span className={cn('text-[10px]', exato ? 'text-emerald-400' : 'text-gray-500')}>{exato ? 'nome igual' : 'parecido'}</span>
              <GrupoTrilhaTag grupo={c.grupo_trailha} className="text-[10px] px-2" />
            </label>
          ))}
        </div>
      ) : (
        <p className="text-gray-400">Nenhum acampante com esse nome. Procure pela busca ou ignore.</p>
      )}
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {sugestao.candidatos.length > 0 && (
          <div className="flex items-center gap-1.5 text-gray-400 mr-auto">
            <span>Tipo</span>
            <SelectTipo valor={tipo} onChange={setTipo} className="w-[140px]" />
          </div>
        )}
        <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs text-gray-300 hover:bg-white/10" onClick={() => ignorar(true)} disabled={!!salvando}
          data-dica="Esconder esta sugestão. Dá para desfazer depois.">
          {salvando === 'ignorar' ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <X className="w-3 h-3 mr-1" />}Ignorar
        </Button>
        {onProcurar && (
          <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs bg-white/5 border-white/10 text-gray-200 hover:bg-white/10 hover:text-white" onClick={() => onProcurar(sugestao.texto)} disabled={!!salvando}
            data-dica="Quando o nome sugerido não é a pessoa certa (ou ninguém foi achado): abre a busca em todos os acampantes, de qualquer grupo, para escolher com quem ligar este acampante.">
            <Search className="w-3 h-3 mr-1" />Procurar outro acampante
          </Button>
        )}
        {sugestao.candidatos.length > 0 && (
          <Button type="button" size="sm" className="h-7 px-2 text-xs bg-sky-600 hover:bg-sky-700 text-white" onClick={confirmar} disabled={!escolhido || !!salvando}
            data-dica="Ligar este acampante à pessoa marcada acima, com o tipo escolhido. O vínculo vale para os dois.">

            {salvando === 'confirmar' ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}Confirmar
          </Button>
        )}
      </div>
    </div>
  );
};

/** Uma linha de vinculo: o outro, o tipo, o grupo dele, mover o outro, excluir. */
export const LinhaVinculo = ({ acampante, item, vinc, onRealocar }) => {
  const [excluindo, setExcluindo] = useState(false);
  const [confirmarExcluir, setConfirmarExcluir] = useState(false);
  const outro = vinc.porId.get(item.outroId);
  if (!outro) return null;
  const mesmoGrupo = !!acampante.grupo_trailha && outro.grupo_trailha === acampante.grupo_trailha;

  const excluir = async () => {
    setExcluindo(true);
    await vinc.excluir(item.id);
    setExcluindo(false);
  };

  return (
    <div className={cn('rounded-md px-2 py-1.5 text-xs space-y-1.5', mesmoGrupo ? 'border border-amber-500/40 bg-amber-500/10' : 'bg-white/5')}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-gray-200 truncate max-w-[14rem]">{outro.nome}</span>
        <span className="text-gray-400">· {rotuloDoTipo(item.tipo)}</span>
        <TrocarCor pessoa={outro} avisoPara={vinc.avisoParaGrupo} onMover={onRealocar} />
        {mesmoGrupo
          ? <span className="inline-flex items-center gap-1 text-amber-300 font-medium"><AlertTriangle className="w-3 h-3" />mesmo grupo</span>
          : <Check className="w-3.5 h-3.5 text-emerald-400" aria-label="grupos diferentes" />}
        <span className="ml-auto inline-flex items-center gap-1">
          {confirmarExcluir ? (
            <>
              <span className="text-gray-400">Excluir vínculo?</span>
              <button type="button" onClick={excluir} disabled={excluindo} className="text-red-300 hover:text-red-200 font-medium px-1">
                {excluindo ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Sim'}
              </button>
              <button type="button" onClick={() => setConfirmarExcluir(false)} className="text-gray-400 hover:text-white px-1">Não</button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmarExcluir(true)} aria-label="Excluir vínculo"
              data-dica="Excluir este vínculo (vale para os dois)." className="text-gray-500 hover:text-red-300 p-0.5">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </span>
      </div>
      {item.vinculo.observacao && <p className="text-gray-400 italic">{item.vinculo.observacao}</p>}
      {mesmoGrupo && onRealocar && (
        <SeletorMoverGrupo
          acampante={outro} avisoPara={vinc.avisoParaGrupo} onMover={onRealocar}
          placeholder={`Mover ${primeiroNome(outro.nome)}...`} compacto
        />
      )}
    </div>
  );
};

const VinculosDoAcampante = ({ acampante, vinc, onRealocar }) => {
  const [novoAberto, setNovoAberto] = useState(false);
  const [buscaInicial, setBuscaInicial] = useState('');
  const lista = vinc.porAcampante.get(acampante.id) || [];
  const sugestao = vinc.sugestaoDe.get(acampante.id);

  if (!vinc.carregado) return null;

  const abrirNovo = (texto = '') => { setBuscaInicial(texto); setNovoAberto(true); };

  return (
    <div className="space-y-1.5">
      {lista.length > 0 && (
        <p className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-gray-500"><Link2 className="w-3 h-3" />Não deveria ficar com</p>
      )}
      {lista.map((item) => (
        <LinhaVinculo key={item.id} acampante={acampante} item={item} vinc={vinc} onRealocar={onRealocar} />
      ))}
      {sugestao && <SugestaoVinculo sugestao={sugestao} vinc={vinc} onProcurar={abrirNovo} />}
      {novoAberto ? (
        <NovoVinculo key={buscaInicial} acampante={acampante} vinc={vinc} buscaInicial={buscaInicial} onFechar={() => setNovoAberto(false)} />
      ) : (
        <button
          type="button" onClick={() => abrirNovo('')}
          data-dica="Cadastrar uma ou mais pessoas que não deveriam ficar no mesmo grupo que este acampante (cônjuge, filhos, amigos...). Dá para escolher a família inteira de uma vez."
          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white"
        >
          <Plus className="w-3 h-3" /> {lista.length ? 'Mais vínculos' : 'Vínculo'}
        </button>
      )}
    </div>
  );
};

export default VinculosDoAcampante;
