import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * "Confirmar pagamento" da tela de Pagamentos (Patrick, 08/10/2026): quem
 * confirma registra QUANTO recebeu e, se houve, QUAL cupom foi usado -- para
 * a conferencia depois (e para pegar cupom usado indevidamente). O valor vem
 * preenchido com o lote do dia; escolher um cupom desconta dele. Quem
 * confirmou fica gravado pelo servidor (registrar_pagamento).
 *
 * PIX travado (aba "Precisam de atenção"): o valor vem da cobranca paga.
 */
const formatarValor = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0);

// "170,50" / "170.50" / "R$ 170" -> 170.5 (null se nao for numero)
const lerValor = (texto) => {
  const limpo = String(texto ?? '').replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  if (limpo === '') return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};

const paraTexto = (n) => (n === null || n === undefined ? '' : Number(n).toFixed(2).replace('.', ','));

const ConfirmarPagamentoDialog = ({ pedido, cupons = [], onConfirmar, onFechar }) => {
  // pedido: { item, forma: 'manual' | 'pix', valorLote, valorCobrado }
  const [valor, setValor] = useState('');
  const [cupom, setCupom] = useState('');
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const ativos = useMemo(() => cupons.filter((c) => c.ativo), [cupons]);
  const lote = pedido?.valorLote ?? null;
  const ehPixTravado = pedido?.forma === 'pix';

  useEffect(() => {
    if (!pedido) return;
    setValor(paraTexto(ehPixTravado ? pedido.valorCobrado : lote));
    setCupom('');
    setErro(null);
    setSalvando(false);
  }, [pedido]); // eslint-disable-line react-hooks/exhaustive-deps

  const escolherCupom = (codigo) => {
    setCupom(codigo);
    setErro(null);
    // Com o lote conhecido, o valor acompanha o cupom (lote - desconto). Se a
    // pessoa ja digitou outro valor, respeita.
    if (lote !== null && !ehPixTravado) {
      const atual = lerValor(valor);
      const anterior = ativos.find((c) => c.codigo === cupom);
      const esperadoAntes = lote - (anterior ? Number(anterior.desconto_fixo) : 0);
      if (atual === null || Math.abs(atual - esperadoAntes) < 0.005) {
        const novo = ativos.find((c) => c.codigo === codigo);
        setValor(paraTexto(Math.max(0, lote - (novo ? Number(novo.desconto_fixo) : 0))));
      }
    }
  };

  const confirmar = async () => {
    const n = lerValor(valor);
    if (n === null || n < 0) {
      setErro('Informe o valor recebido.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await onConfirmar(pedido, n, cupom || null);
    } catch (e) {
      setErro(e.message || 'Não foi possível confirmar.');
      setSalvando(false);
    }
  };

  const cupomEscolhido = ativos.find((c) => c.codigo === cupom);

  return (
    <Dialog open={!!pedido} onOpenChange={(aberto) => !aberto && !salvando && onFechar()}>
      <DialogContent className="bg-neutral-900 border-white/10 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmar pagamento</DialogTitle>
          <DialogDescription className="text-gray-400">
            {pedido?.item?.nome}
            <span className="text-gray-500"> · {pedido?.item?.tipo === 'equipante' ? 'Equipante' : 'Acampante'}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-gray-400">
            {ehPixTravado
              ? `PIX pago que não confirmou sozinho. Valor da cobrança: ${formatarValor(pedido?.valorCobrado)}.`
              : lote !== null
                ? `Valor do lote hoje: ${formatarValor(lote)}.`
                : 'Não há lote com valor para hoje; digite o valor recebido.'}
          </p>

          <div className="space-y-1">
            <label htmlFor="pg-valor" className="text-sm text-gray-300">Valor recebido (R$)</label>
            <Input
              id="pg-valor" inputMode="decimal" autoFocus value={valor}
              onChange={(e) => { setValor(e.target.value); setErro(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmar(); }}
              placeholder="0,00"
              className="bg-white/5 border-white/10 text-white text-lg h-11"
            />
          </div>

          {!ehPixTravado && (
            <div className="space-y-1.5">
              <span className="text-sm text-gray-300">Cupom de desconto</span>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Cupom de desconto">
                {[{ codigo: '', rotulo: 'Sem cupom' }, ...ativos.map((c) => ({ codigo: c.codigo, rotulo: `${c.codigo} · −${formatarValor(c.desconto_fixo)}` }))]
                  .map((op) => (
                    <button
                      key={op.codigo || 'nenhum'} type="button"
                      onClick={() => escolherCupom(op.codigo)}
                      aria-pressed={cupom === op.codigo}
                      className={cn(
                        'h-9 px-3 rounded-md border text-sm transition-colors',
                        cupom === op.codigo
                          ? 'border-blue-500/60 bg-blue-500/15 text-white'
                          : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
                      )}
                    >
                      {op.rotulo}
                    </button>
                  ))}
              </div>
              {ativos.length === 0 && (
                <p className="text-xs text-gray-500">Nenhum cupom ativo nesta edição.</p>
              )}
              {cupomEscolhido && lote !== null && (
                <p className="text-xs text-gray-400">
                  {formatarValor(lote)} − {formatarValor(cupomEscolhido.desconto_fixo)} = {formatarValor(Math.max(0, lote - Number(cupomEscolhido.desconto_fixo)))}
                </p>
              )}
            </div>
          )}
        </div>

        {erro && <p className="text-sm text-red-400">{erro}</p>}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
          <Button
            type="button" variant="ghost" onClick={onFechar} disabled={salvando}
            className="text-gray-300 hover:text-white hover:bg-white/10"
          >
            Cancelar
          </Button>
          <Button
            type="button" onClick={confirmar} disabled={salvando}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {salvando ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1.5" />}
            Confirmar pagamento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmarPagamentoDialog;
