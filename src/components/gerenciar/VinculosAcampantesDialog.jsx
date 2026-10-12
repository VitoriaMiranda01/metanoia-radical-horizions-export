import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Link2, Search, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import GrupoTrilhaTag from '@/components/common/GrupoTrilhaTag';
import { LinhaVinculo, NovoVinculo, SeletorMoverGrupo, SugestaoVinculo } from '@/components/gerenciar/VinculosAcampante';
import { casaBusca } from '@/utils/busca';
import { rotuloDoTipo, tipoVistoPor } from '@/utils/vinculosAcampantes';
import { cn } from '@/lib/utils';

/**
 * Visao geral dos vinculos entre acampantes (Patrick, 12/10/2026), aberta pelo
 * botao em "Grupos de Trilha": as sugestoes vindas da inscricao para confirmar,
 * quem esta no mesmo grupo de alguem vinculado, todos os vinculos e as
 * sugestoes ignoradas (com desfazer). So organizadores.
 */

const ABAS = [
  { chave: 'sugestoes', rotulo: 'Sugestões da inscrição' },
  { chave: 'conflitos', rotulo: 'No mesmo grupo' },
  { chave: 'todos', rotulo: 'Todos os vínculos' },
  { chave: 'ignoradas', rotulo: 'Ignoradas' },
];

const Cabecalho = ({ acampante }) => (
  <div className="flex items-center justify-between gap-2">
    <span className="text-sm text-white font-medium truncate">{acampante.nome}</span>
    <GrupoTrilhaTag grupo={acampante.grupo_trailha} className="text-[10px] px-2" />
  </div>
);

const ItemSugestao = ({ sugestao, vinc }) => {
  const [procurando, setProcurando] = useState(null);
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2">
      <Cabecalho acampante={sugestao.acampante} />
      {procurando !== null ? (
        <NovoVinculo acampante={sugestao.acampante} vinc={vinc} buscaInicial={procurando} onFechar={() => setProcurando(null)} />
      ) : (
        <SugestaoVinculo sugestao={sugestao} vinc={vinc} onProcurar={sugestao.ignorada ? null : (t) => setProcurando(t)} />
      )}
    </div>
  );
};

const ItemPar = ({ vinculo, vinc, onRealocar }) => {
  const a = vinc.porId.get(vinculo.a);
  const b = vinc.porId.get(vinculo.b);
  if (!a || !b) return null;
  const mesmoGrupo = !!a.grupo_trailha && a.grupo_trailha === b.grupo_trailha;
  return (
    <div className={cn('rounded-lg border p-3 space-y-2', mesmoGrupo ? 'border-amber-500/40 bg-amber-500/5' : 'border-white/10 bg-white/5')}>
      <Cabecalho acampante={a} />
      <LinhaVinculo
        acampante={a}
        item={{ id: vinculo.id, vinculo, outroId: b.id, tipo: tipoVistoPor(vinculo, a.id) }}
        vinc={vinc}
        onRealocar={null}
      />
      {mesmoGrupo && onRealocar && (
        <div className="flex flex-wrap gap-3 pt-1">
          {[a, b].map((x) => (
            <div key={x.id} className="space-y-1">
              <p className="text-[11px] text-gray-400">Mover {String(x.nome).split(' ')[0]}</p>
              <SeletorMoverGrupo acampante={x} avisoPara={vinc.avisoParaGrupo} onMover={onRealocar} compacto />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const VinculosAcampantesDialog = ({ isOpen, onClose, vinc, onRealocar }) => {
  const [aba, setAba] = useState('sugestoes');
  const [busca, setBusca] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setBusca('');
    setAba(vinc.sugestoes.length ? 'sugestoes' : (vinc.conflitos.length ? 'conflitos' : 'todos'));
    // So ao abrir: depois cada acao recarrega e a aba fica onde esta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const contagem = {
    sugestoes: vinc.sugestoes.length,
    conflitos: vinc.conflitos.length,
    todos: vinc.vinculos.length,
    ignoradas: vinc.sugestoesIgnoradas.length,
  };

  const casaPar = (v) => {
    const a = vinc.porId.get(v.a);
    const b = vinc.porId.get(v.b);
    return casaBusca(busca, [a?.nome, b?.nome, rotuloDoTipo(v.tipo), a?.grupo_trailha, b?.grupo_trailha]);
  };
  const casaSugestao = (s) => casaBusca(busca, [s.acampante.nome, s.texto, ...s.candidatos.map((c) => c.acampante.nome)]);

  const itens = useMemo(() => {
    if (aba === 'sugestoes') return vinc.sugestoes.filter(casaSugestao);
    if (aba === 'ignoradas') return vinc.sugestoesIgnoradas.filter(casaSugestao);
    const lista = aba === 'conflitos' ? vinc.conflitos : vinc.vinculos;
    return lista.filter(casaPar)
      .slice()
      .sort((x, y) => String(vinc.porId.get(x.a)?.nome).localeCompare(String(vinc.porId.get(y.a)?.nome), 'pt-BR'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, busca, vinc.sugestoes, vinc.sugestoesIgnoradas, vinc.conflitos, vinc.vinculos, vinc.porId]);

  const vazio = {
    sugestoes: 'Nenhuma sugestão pendente. Todas as respostas "vai com" da inscrição já foram confirmadas ou ignoradas.',
    conflitos: 'Ninguém vinculado está no mesmo grupo.',
    todos: 'Nenhum vínculo cadastrado ainda.',
    ignoradas: 'Nenhuma sugestão ignorada.',
  }[aba];

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent overlayClassName="bg-black/70" className="bg-neutral-900 border-white/10 text-white sm:max-w-3xl max-h-[90vh] flex flex-col gap-3">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl"><Link2 className="w-5 h-5" />Vínculos entre acampantes</DialogTitle>
          <DialogDescription className="text-gray-400">
            Quem vem junto (cônjuge, amigo, parente) e não deveria ficar no mesmo grupo de trilha. É só aviso: nada impede de juntar.
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

        <div className="relative">
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

        <div className="flex-1 min-h-0 max-h-[60vh] overflow-y-auto pr-1 space-y-2">
          {!vinc.carregado && <p className="text-center py-10 text-gray-500">{vinc.erro ? `Não foi possível carregar: ${vinc.erro}` : 'Carregando...'}</p>}
          {vinc.carregado && itens.length === 0 && <p className="text-center py-10 text-gray-500">{busca ? 'Ninguém bate com a busca.' : vazio}</p>}
          {vinc.carregado && (aba === 'sugestoes' || aba === 'ignoradas')
            ? itens.map((s) => <ItemSugestao key={s.acampante.id} sugestao={s} vinc={vinc} />)
            : vinc.carregado && itens.map((v) => <ItemPar key={v.id} vinculo={v} vinc={vinc} onRealocar={onRealocar} />)}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VinculosAcampantesDialog;
