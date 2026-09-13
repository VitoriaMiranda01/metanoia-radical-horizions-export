import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Check, Download, Loader2, RotateCcw, Search, Truck, X } from 'lucide-react';
import { AREAS_EXTRA } from '@/constants/areasExtra';
import { fetchDisponibilidadesExtra, decidirDisponibilidadeExtra } from '@/services/scalesService';
import { exportDisponibilidadesExtra } from '@/utils/excelExport';
import NomeComBandeira from '@/components/common/NomeComBandeira';
import { formatCPF } from '@/utils/formatters';
import { cn } from '@/lib/utils';

/**
 * Áreas de Trabalho Extra — quem se ofereceu para os três mutirões da
 * Centenário (carregar o caminhão na quinta, cozinha na sexta à tarde,
 * limpeza depois que os acampantes saem).
 *
 * ISTO NÃO É ESCALA. Nada aqui entra em `escalas`, nada aqui conta para
 * "faltam N" e nada aqui impede ou libera o lançamento da escala. É uma
 * lista à parte, com a resposta do organizador a cada oferta.
 *
 * Três estados por oferta: sem resposta (não existe linha no banco),
 * aprovado e recusado. Clicar de novo no botão que já está marcado desfaz a
 * resposta e volta para "sem resposta" — errar não fica preso.
 */

const semAcento = (texto) => (texto || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const CHIP_INSCRICAO = {
  aprovado: null, // o caso normal não precisa de selo
  pendente: { texto: 'inscrição pendente', classe: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300' },
  rejeitado: { texto: 'inscrição rejeitada', classe: 'border-red-500/40 bg-red-500/10 text-red-300' }
};

const AreasExtraDialog = ({ onClose }) => {
  const { toast } = useToast();
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [salvando, setSalvando] = useState({});

  const carregar = useCallback(async () => {
    setLoading(true);
    const r = await fetchDisponibilidadesExtra();
    if (!r.success) {
      setErro(r.error);
      setItens([]);
    } else {
      setErro('');
      setItens(r.itens);
    }
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // Esc fecha, como em qualquer modal.
  useEffect(() => {
    const aoTeclar = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onClose]);

  const termo = semAcento(busca.trim());
  const filtrados = useMemo(() => {
    if (!termo) return itens;
    const digitos = termo.replace(/\D/g, '');
    return itens.filter((i) =>
      semAcento(i.nome).includes(termo)
      || semAcento(i.igreja).includes(termo)
      || (digitos !== '' && (i.cpf || '').includes(digitos))
    );
  }, [itens, termo]);

  const totalPessoas = useMemo(
    () => new Set(itens.map((i) => i.equipante_id)).size,
    [itens]
  );
  const semResposta = useMemo(
    () => itens.filter((i) => i.aprovado === null || i.aprovado === undefined).length,
    [itens]
  );

  // A chave de cada botão em voo — uma pessoa pode ter 3 ofertas, e travar
  // as três porque ela clicou numa seria confuso.
  const chaveLinha = (item) => `${item.equipante_id}:${item.area}`;

  const responder = async (item, valor) => {
    const chave = chaveLinha(item);
    // Clicar de novo no que já está marcado desfaz a resposta.
    const atual = item.aprovado === null || item.aprovado === undefined ? null : item.aprovado;
    const novo = atual === valor ? null : valor;

    setSalvando((s) => ({ ...s, [chave]: true }));
    const r = await decidirDisponibilidadeExtra(item.equipante_id, item.area, novo);
    setSalvando((s) => { const c = { ...s }; delete c[chave]; return c; });

    if (!r.success) {
      toast({ title: 'Não deu para salvar', description: r.error, variant: 'destructive' });
      return;
    }

    setItens((lista) => lista.map((i) => (
      chaveLinha(i) === chave
        ? { ...i, aprovado: novo, decidido_por: novo === null ? null : r.decididoPor, decidido_em: novo === null ? null : r.decididoEm }
        : i
    )));
  };

  const exportar = () => {
    try {
      const r = exportDisponibilidadesExtra(itens, AREAS_EXTRA);
      toast({
        title: 'Planilha gerada',
        description: `${r.total} disponibilidade(s), uma aba por mutirão.`,
        className: 'bg-emerald-600 text-white'
      });
    } catch (err) {
      toast({ title: 'Não deu para exportar', description: err.message, variant: 'destructive' });
    }
  };

  const renderPessoa = (item) => {
    const chave = chaveLinha(item);
    const emVoo = !!salvando[chave];
    const aprovado = item.aprovado === true;
    const recusado = item.aprovado === false;
    const chip = CHIP_INSCRICAO[item.status];

    return (
      <div
        key={chave}
        className={cn(
          'flex flex-col md:flex-row md:items-center gap-3 p-3 rounded-md border transition-colors',
          aprovado ? 'border-green-500/40 bg-green-500/5'
            : recusado ? 'border-white/10 bg-black/40 opacity-60'
              : 'border-white/10 bg-white/5'
        )}
      >
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium truncate">
            <NomeComBandeira nome={item.nome} nacionalidade={item.nacionalidade} />
          </p>
          <p className="text-xs text-gray-400 truncate">
            {item.igreja || 'sem igreja'}
            {item.whatsapp ? ` · ${item.whatsapp}` : ''}
            {item.cpf ? ` · ${formatCPF(item.cpf)}` : ' · sem CPF'}
          </p>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            {chip && (
              <span className={cn('text-[11px] px-2 py-0.5 rounded-full border', chip.classe)}>
                {chip.texto}
              </span>
            )}
            {item.decidido_por && (
              <span className="text-[11px] text-gray-500">
                {aprovado ? 'Aprovado' : 'Recusado'} por {item.decidido_por}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {emVoo && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
          <Button
            size="sm"
            variant="outline"
            disabled={emVoo}
            onClick={() => responder(item, true)}
            title={aprovado ? 'Clique de novo para desfazer' : 'Contar com esta pessoa'}
            className={cn(
              'h-8',
              aprovado
                ? 'bg-green-600 text-white border-green-500 hover:bg-green-700 hover:text-white'
                : 'bg-transparent text-green-400 border-green-600/40 hover:bg-green-600/20 hover:text-green-300'
            )}
          >
            {aprovado ? <Check className="h-4 w-4 mr-1" /> : null}
            Aprovar
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={emVoo}
            onClick={() => responder(item, false)}
            title={recusado ? 'Clique de novo para desfazer' : 'Não vou precisar desta pessoa'}
            className={cn(
              'h-8',
              recusado
                ? 'bg-red-600/80 text-white border-red-500 hover:bg-red-700 hover:text-white'
                : 'bg-transparent text-gray-300 border-white/20 hover:bg-white/10 hover:text-white'
            )}
          >
            {recusado ? <X className="h-4 w-4 mr-1" /> : null}
            Recusar
          </Button>
        </div>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-black border border-white/10 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start gap-4 p-5 border-b border-white/10 bg-zinc-900">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Truck className="h-5 w-5 text-blue-400" />
              Áreas de Trabalho Extra
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              Mutirões na Centenário, fora do acampamento. Não entra na escala nem
              interfere no lançamento.
            </p>
            {!loading && itens.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {totalPessoas} {totalPessoas === 1 ? 'pessoa se ofereceu' : 'pessoas se ofereceram'}
                {' · '}{itens.length} {itens.length === 1 ? 'disponibilidade' : 'disponibilidades'}
                {semResposta > 0 && ` · ${semResposta} sem resposta`}
              </p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-white shrink-0">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, igreja ou CPF..."
              className="h-9 pl-8 bg-black/40 border-white/20 text-white"
            />
          </div>
          <Button
            variant="outline"
            onClick={exportar}
            disabled={loading || itens.length === 0}
            className="h-9 border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/5"
          >
            <Download className="h-4 w-4 mr-2" /> Exportar
          </Button>
          <Button
            variant="outline"
            onClick={carregar}
            disabled={loading}
            className="h-9 border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/5"
          >
            <RotateCcw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} /> Atualizar
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-12 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" /> Carregando...
            </div>
          )}

          {!loading && erro && (
            <p className="text-red-300 text-sm text-center py-12">{erro}</p>
          )}

          {!loading && !erro && itens.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-12">
              Ninguém marcou nenhuma das áreas extras até agora.
            </p>
          )}

          {!loading && !erro && itens.length > 0 && AREAS_EXTRA.map((area) => {
            const doGrupo = filtrados.filter((i) => i.area === area.chave);
            const totalArea = itens.filter((i) => i.area === area.chave).length;
            const aprovadosArea = itens.filter((i) => i.area === area.chave && i.aprovado === true).length;

            return (
              <div key={area.chave}>
                <div className="flex items-baseline justify-between gap-3 mb-3 pb-2 border-b border-white/10">
                  <div>
                    <h4 className="text-white font-semibold">{area.rotulo}</h4>
                    <p className="text-xs text-gray-500">{area.detalhe}</p>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">
                    {totalArea === 0
                      ? 'ninguém'
                      : `${aprovadosArea} de ${totalArea} ${totalArea === 1 ? 'aprovado' : 'aprovados'}`}
                  </span>
                </div>

                {doGrupo.length === 0 ? (
                  <p className="text-sm text-gray-500 py-2">
                    {totalArea === 0
                      ? 'Ninguém se ofereceu para este mutirão.'
                      : 'Ninguém neste mutirão bate com a busca.'}
                  </p>
                ) : (
                  <div className="space-y-2">{doGrupo.map(renderPessoa)}</div>
                )}
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-white/10 bg-zinc-900 flex justify-end">
          <Button onClick={onClose} variant="outline" className="border-white/20 bg-transparent text-gray-300 hover:bg-white/10 hover:text-white">
            Fechar
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default AreasExtraDialog;
