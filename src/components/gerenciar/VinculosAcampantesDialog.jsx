import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Link2, Plus, Search, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LinhaVinculo, NovoVinculo, NovoVinculoAvulso, SugestaoVinculo, TrocarCor } from '@/components/gerenciar/VinculosAcampante';
import { casaBusca } from '@/utils/busca';
import { rotuloDoTipo, tipoVistoPor } from '@/utils/vinculosAcampantes';
import { cn } from '@/lib/utils';

/**
 * Visao geral dos vinculos entre acampantes (Patrick, 12/10/2026), aberta pelo
 * botao em "Grupos de Trilha": as sugestoes vindas da inscricao para confirmar,
 * quem esta no mesmo grupo de alguem vinculado, os vinculos por pessoa e por
 * par e as sugestoes ignoradas (com desfazer). So organizadores.
 *
 * 23/10/2026: a cor de cada pessoa e clicavel (troca entre as 5 cores ali
 * mesmo), "+ Novo vinculo" no topo (acampante ou infiltrado, varias pessoas de
 * uma vez) e "+ Vinculo" em cada pessoa, para a familia de 3+.
 */

const ABAS = [
  { chave: 'sugestoes', rotulo: 'Sugestões da inscrição' },
  { chave: 'conflitos', rotulo: 'No mesmo grupo' },
  { chave: 'pessoas', rotulo: 'Por pessoa' },
  { chave: 'todos', rotulo: 'Todos os vínculos' },
  { chave: 'ignoradas', rotulo: 'Ignoradas' },
];

const Cabecalho = ({ acampante, vinc, onRealocar, onNovo }) => (
  <div className="flex flex-wrap items-center gap-2">
    <span className="text-sm text-white font-medium truncate mr-auto">
      {acampante.nome}
      {acampante.infiltrado && <span className="ml-1.5 text-[10px] font-normal text-gray-500">infiltrado</span>}
    </span>
    {onNovo && (
      <button type="button" onClick={onNovo} className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white"
        data-dica={`Ligar ${String(acampante.nome).split(' ')[0]} a mais pessoas.`}>
        <Plus className="w-3 h-3" /> Vínculo
      </button>
    )}
    <TrocarCor pessoa={acampante} avisoPara={vinc.avisoParaGrupo} onMover={onRealocar} />
  </div>
);

const ItemSugestao = ({ sugestao, vinc, onRealocar }) => {
  const [procurando, setProcurando] = useState(null);
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2">
      <Cabecalho acampante={sugestao.acampante} vinc={vinc} onRealocar={onRealocar} />
      {procurando !== null ? (
        <NovoVinculo acampante={sugestao.acampante} vinc={vinc} buscaInicial={procurando} onFechar={() => setProcurando(null)} />
      ) : (
        <SugestaoVinculo sugestao={sugestao} vinc={vinc} onProcurar={sugestao.ignorada ? null : (t) => setProcurando(t)} />
      )}
    </div>
  );
};

const ItemPar = ({ vinculo, vinc, onRealocar }) => {
  const [novo, setNovo] = useState(false);
  const a = vinc.porId.get(vinculo.a);
  const b = vinc.porId.get(vinculo.b);
  if (!a || !b) return null;
  const mesmoGrupo = !!a.grupo_trailha && a.grupo_trailha === b.grupo_trailha;
  return (
    <div className={cn('rounded-lg border p-3 space-y-2', mesmoGrupo ? 'border-amber-500/40 bg-amber-500/5' : 'border-white/10 bg-white/5')}>
      <Cabecalho acampante={a} vinc={vinc} onRealocar={onRealocar} onNovo={novo ? null : () => setNovo(true)} />
      <LinhaVinculo
        acampante={a}
        item={{ id: vinculo.id, vinculo, outroId: b.id, tipo: tipoVistoPor(vinculo, a.id) }}
        vinc={vinc}
        onRealocar={onRealocar}
      />
      {novo && <NovoVinculo acampante={a} vinc={vinc} onFechar={() => setNovo(false)} />}
    </div>
  );
};

/** Uma pessoa com todos os vinculos dela (familia de 3+ aparece junta). */
const ItemPessoa = ({ pessoa, vinc, onRealocar }) => {
  const [novo, setNovo] = useState(false);
  const lista = vinc.porAcampante.get(pessoa.id) || [];
  const conflito = vinc.idsEmConflito.has(pessoa.id);
  return (
    <div className={cn('rounded-lg border p-3 space-y-1.5', conflito ? 'border-amber-500/40 bg-amber-500/5' : 'border-white/10 bg-white/5')}>
      <Cabecalho acampante={pessoa} vinc={vinc} onRealocar={onRealocar} onNovo={novo ? null : () => setNovo(true)} />
      {lista.map((item) => (
        <LinhaVinculo key={item.id} acampante={pessoa} item={item} vinc={vinc} onRealocar={onRealocar} />
      ))}
      {novo && <NovoVinculo acampante={pessoa} vinc={vinc} onFechar={() => setNovo(false)} />}
    </div>
  );
};

const VinculosAcampantesDialog = ({ isOpen, onClose, vinc, onRealocar }) => {
  const [aba, setAba] = useState('sugestoes');
  const [busca, setBusca] = useState('');
  const [novoAberto, setNovoAberto] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setBusca('');
    setNovoAberto(false);
    setAba(vinc.sugestoes.length ? 'sugestoes' : (vinc.conflitos.length ? 'conflitos' : 'pessoas'));
    // So ao abrir: depois cada acao recarrega e a aba fica onde esta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Quem tem pelo menos um vinculo, em ordem alfabetica.
  const pessoasComVinculo = useMemo(
    () => Array.from(vinc.porAcampante.keys())
      .map((id) => vinc.porId.get(id))
      .filter(Boolean)
      .sort((x, y) => String(x.nome).localeCompare(String(y.nome), 'pt-BR')),
    [vinc.porAcampante, vinc.porId]
  );

  const contagem = {
    sugestoes: vinc.sugestoes.length,
    conflitos: vinc.conflitos.length,
    pessoas: pessoasComVinculo.length,
    todos: vinc.vinculos.length,
    ignoradas: vinc.sugestoesIgnoradas.length,
  };

  const casaPar = (v) => {
    const a = vinc.porId.get(v.a);
    const b = vinc.porId.get(v.b);
    return casaBusca(busca, [a?.nome, b?.nome, rotuloDoTipo(v.tipo), a?.grupo_trailha, b?.grupo_trailha]);
  };
  const casaSugestao = (s) => casaBusca(busca, [s.acampante.nome, s.texto, ...s.candidatos.map((c) => c.acampante.nome)]);
  // Na aba por pessoa, a busca acha a pessoa pelo nome dela ou de quem esta ligado a ela.
  const casaPessoa = (p) => casaBusca(busca, [
    p.nome, p.grupo_trailha,
    ...(vinc.porAcampante.get(p.id) || []).map((x) => vinc.porId.get(x.outroId)?.nome),
  ]);

  const itens = useMemo(() => {
    if (aba === 'sugestoes') return vinc.sugestoes.filter(casaSugestao);
    if (aba === 'ignoradas') return vinc.sugestoesIgnoradas.filter(casaSugestao);
    if (aba === 'pessoas') return pessoasComVinculo.filter(casaPessoa);
    const lista = aba === 'conflitos' ? vinc.conflitos : vinc.vinculos;
    return lista.filter(casaPar)
      .slice()
      .sort((x, y) => String(vinc.porId.get(x.a)?.nome).localeCompare(String(vinc.porId.get(y.a)?.nome), 'pt-BR'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, busca, vinc.sugestoes, vinc.sugestoesIgnoradas, vinc.conflitos, vinc.vinculos, vinc.porId, vinc.porAcampante, pessoasComVinculo]);

  const vazio = {
    sugestoes: 'Nenhuma sugestão pendente. Todas as respostas "vai com" da inscrição já foram confirmadas ou ignoradas.',
    conflitos: 'Ninguém vinculado está no mesmo grupo.',
    pessoas: 'Nenhum vínculo cadastrado ainda. Use "+ Novo vínculo".',
    todos: 'Nenhum vínculo cadastrado ainda.',
    ignoradas: 'Nenhuma sugestão ignorada.',
  }[aba];

  const renderItem = (x) => {
    if (aba === 'sugestoes' || aba === 'ignoradas') return <ItemSugestao key={x.acampante.id} sugestao={x} vinc={vinc} onRealocar={onRealocar} />;
    if (aba === 'pessoas') return <ItemPessoa key={x.id} pessoa={x} vinc={vinc} onRealocar={onRealocar} />;
    return <ItemPar key={x.id} vinculo={x} vinc={vinc} onRealocar={onRealocar} />;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent overlayClassName="bg-black/70" className="bg-neutral-900 border-white/10 text-white sm:max-w-3xl max-h-[90vh] flex flex-col gap-3">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl"><Link2 className="w-5 h-5" />Vínculos entre acampantes</DialogTitle>
          <DialogDescription className="text-gray-400">
            Quem vem junto (cônjuge, amigo, parente) e não deveria ficar no mesmo grupo de trilha. É só aviso: nada impede de juntar. Clique na cor de alguém para trocar de grupo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5" role="tablist">
          {ABAS.map((x) => (
            <button
              key={x.chave} type="button" role="tab" aria-selected={aba === x.chave} onClick={() => setAba(x.chave)}
              className={cn(
                'h-8 px-3 rounded-md border text-xs whitespace-nowrap transition-colors inline-flex items-center gap-1',
                aba === x.chave ? 'border-white/30 bg-white/15 text-white' : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
              )}
            >
              {x.chave === 'conflitos' && contagem.conflitos > 0 && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
              {x.rotulo} <span className="text-gray-500 tabular-nums">{contagem[x.chave]}</span>
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
            <Input
              value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pelo nome..."
              className="h-9 pl-8 pr-8 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
            />
            {busca && (
              <button type="button" onClick={() => setBusca('')} aria-label="Limpar a busca" className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {!novoAberto && vinc.carregado && (
            <Button type="button" onClick={() => setNovoAberto(true)} className="h-9 shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
              data-dica="Cadastrar um vínculo à mão: escolha a pessoa (acampante ou infiltrado) e com quem ela vem. Dá para escolher a família inteira de uma vez.">
              <Plus className="w-4 h-4 mr-1" />Novo vínculo
            </Button>
          )}
        </div>

        {novoAberto && <NovoVinculoAvulso vinc={vinc} onFechar={() => setNovoAberto(false)} />}

        <div className="flex-1 min-h-0 max-h-[60vh] overflow-y-auto pr-1 space-y-2">
          {!vinc.carregado && <p className="text-center py-10 text-gray-500">{vinc.erro ? `Não foi possível carregar: ${vinc.erro}` : 'Carregando...'}</p>}
          {vinc.carregado && itens.length === 0 && <p className="text-center py-10 text-gray-500">{busca ? 'Ninguém bate com a busca.' : vazio}</p>}
          {vinc.carregado && itens.map(renderItem)}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VinculosAcampantesDialog;
