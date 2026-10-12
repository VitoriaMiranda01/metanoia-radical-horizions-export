import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, Check, Link2, Loader2, Plus, Search, Trash2, Undo2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import GrupoTrilhaTag from '@/components/common/GrupoTrilhaTag';
import { GROUPS } from '@/utils/gruposTrailha';
import { casaBusca } from '@/utils/busca';
import { rotuloDoTipo, TIPOS_VINCULO } from '@/utils/vinculosAcampantes';
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

/** "+ Vinculo": procura em todos os acampantes (qualquer grupo). */
export const NovoVinculo = ({ acampante, vinc, buscaInicial = '', onFechar }) => {
  const [busca, setBusca] = useState(buscaInicial);
  const [escolhido, setEscolhido] = useState(null);
  const [tipo, setTipo] = useState('AMIGO / AMIGA');
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);

  const jaLigados = useMemo(
    () => new Set((vinc.porAcampante.get(acampante.id) || []).map((x) => x.outroId)),
    [vinc.porAcampante, acampante.id]
  );

  const resultados = useMemo(() => {
    if (!busca.trim()) return [];
    return Array.from(vinc.porId.values())
      .filter((a) => a.id !== acampante.id && !jaLigados.has(a.id) && casaBusca(busca, [a.nome, a.cpf, a.whatsapp]))
      .sort((x, y) => String(x.nome).localeCompare(String(y.nome), 'pt-BR'))
      .slice(0, 8);
  }, [busca, vinc.porId, acampante.id, jaLigados]);

  const salvar = async () => {
    if (!escolhido) return;
    setSalvando(true);
    // "escolhido e <tipo> de acampante": A = acampante, B = escolhido.
    const r = await vinc.salvar({ a: acampante.id, b: escolhido.id, tipo, observacao });
    setSalvando(false);
    if (r.success) onFechar?.();
  };

  return (
    <div className="rounded-md border border-white/15 bg-black/40 p-2.5 space-y-2">
      {!escolhido ? (
        <>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500 pointer-events-none" />
            <Input
              autoFocus value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome, CPF ou telefone do outro acampante..."
              className="h-8 pl-7 text-xs bg-white/5 border-white/10 text-white placeholder:text-gray-500"
            />
          </div>
          {busca.trim() && (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {resultados.length === 0 && <p className="text-xs text-gray-500 px-1">Nenhum acampante encontrado.</p>}
              {resultados.map((a) => (
                <button
                  key={a.id} type="button" onClick={() => setEscolhido(a)}
                  className="w-full flex items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs text-gray-200 hover:bg-white/10"
                >
                  <span className="truncate">{a.nome}</span>
                  <GrupoTrilhaTag grupo={a.grupo_trailha} className="text-[10px] px-2" />
                </button>
              ))}
            </div>
          )}
          <div className="flex justify-end">
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs text-gray-400 hover:bg-white/10" onClick={onFechar}>Cancelar</Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 text-xs text-gray-200">
            <span className="truncate"><span className="text-gray-400">Com: </span>{escolhido.nome}</span>
            <GrupoTrilhaTag grupo={escolhido.grupo_trailha} className="text-[10px] px-2" />
          </div>
          <div className="flex flex-col sm:flex-row gap-1.5">
            <div className="flex items-center gap-1.5 text-xs text-gray-400 shrink-0">
              <span>{primeiroNome(escolhido.nome)} é</span>
              <SelectTipo valor={tipo} onChange={setTipo} className="w-[150px]" />
            </div>
            <Input
              value={observacao} onChange={(e) => setObservacao(e.target.value)}
              placeholder="Observação (opcional)"
              className="h-8 text-xs bg-white/5 border-white/10 text-white placeholder:text-gray-500 flex-1 min-w-0"
            />
          </div>
          <div className="flex justify-end gap-1.5">
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs text-gray-400 hover:bg-white/10" onClick={() => setEscolhido(null)}>Voltar</Button>
            <Button type="button" size="sm" className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={salvar} disabled={salvando}>
              {salvando ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}Salvar vínculo
            </Button>
          </div>
        </>
      )}
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
          <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs bg-white/5 border-white/10 text-gray-200 hover:bg-white/10" onClick={() => onProcurar(sugestao.texto)} disabled={!!salvando}>
            <Search className="w-3 h-3 mr-1" />Procurar outro
          </Button>
        )}
        {sugestao.candidatos.length > 0 && (
          <Button type="button" size="sm" className="h-7 px-2 text-xs bg-sky-600 hover:bg-sky-700 text-white" onClick={confirmar} disabled={!escolhido || !!salvando}>
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
        <GrupoTrilhaTag grupo={outro.grupo_trailha} className="text-[10px] px-2" />
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
          data-dica="Cadastrar alguém que não deveria ficar no mesmo grupo que este acampante (cônjuge, amigo, parente...)."
          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white"
        >
          <Plus className="w-3 h-3" /> Vínculo
        </button>
      )}
    </div>
  );
};

export default VinculosDoAcampante;
