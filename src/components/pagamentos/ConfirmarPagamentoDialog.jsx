import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Banknote, CheckCircle, CreditCard, Loader2, QrCode } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { cuponsDoPagamento } from '@/services/paymentService';

/**
 * "Confirmar pagamento" da tela de Pagamentos (Patrick, 08/10/2026): quem
 * confirma registra QUANTO recebeu e, se houve, QUAL cupom foi usado -- para
 * a conferencia depois (e para pegar cupom usado indevidamente). O valor vem
 * preenchido com o lote do dia; escolher um cupom desconta dele. Quem
 * confirmou fica gravado pelo servidor (registrar_pagamento).
 *
 * PIX travado (aba "Precisam de atenção"): o valor vem da cobranca paga.
 *
 * Pagamento em maos (16/10/2026): o organizador diz se recebeu em DINHEIRO ou
 * no CARTAO -- o financeiro precisa disso para conferir o caixa. Sem escolher,
 * nao confirma (nenhum vem marcado de proposito). 18/10/2026: terceira opcao,
 * PIX recebido direto e conferido a mao (meio 'pix', metodo continua 'manual'
 * -- separado do PIX automatico do Sicoob).
 */
const MEIOS = [
  { valor: 'dinheiro', rotulo: 'Dinheiro', Icone: Banknote },
  { valor: 'cartao', rotulo: 'Cartão', Icone: CreditCard },
  { valor: 'pix', rotulo: 'PIX', Icone: QrCode }
];

const formatarValor = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0);

// "170,50" / "170.50" / "R$ 170" -> 170.5 (null se nao for numero)
const lerValor = (texto) => {
  const limpo = String(texto ?? '').replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  if (limpo === '') return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};

const paraTexto = (n) => (n === null || n === undefined ? '' : Number(n).toFixed(2).replace('.', ','));

const ConfirmarPagamentoDialog = ({ pedido, onConfirmar, onFechar }) => {
  // pedido: { item, forma: 'manual' | 'pix', valorLote, valorCobrado }
  const [valor, setValor] = useState('');
  const [cupom, setCupom] = useState('');
  const [meio, setMeio] = useState('');
  const [observacao, setObservacao] = useState('');
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  // Os cupons ativos como valem para ESTA pessoa (16/10/2026): o servidor ja
  // calcula o desconto (valor fixo ou % do lote) e diz se o cupom "so para
  // pastores" vale para ela.
  const [ativos, setAtivos] = useState([]);
  useEffect(() => {
    let vivo = true;
    setAtivos([]);
    if (pedido?.item?.id && pedido.forma !== 'pix') {
      cuponsDoPagamento(pedido.item.tipo, pedido.item.id).then((lista) => { if (vivo) setAtivos(lista); });
    }
    return () => { vivo = false; };
  }, [pedido]);
  const lote = pedido?.valorLote ?? null;
  const ehPixTravado = pedido?.forma === 'pix';

  useEffect(() => {
    if (!pedido) return;
    setValor(paraTexto(ehPixTravado ? pedido.valorCobrado : lote));
    setCupom('');
    setMeio('');
    setObservacao('');
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
      const esperadoAntes = lote - (anterior ? Number(anterior.desconto) : 0);
      if (atual === null || Math.abs(atual - esperadoAntes) < 0.005) {
        const novo = ativos.find((c) => c.codigo === codigo);
        setValor(paraTexto(Math.max(0, lote - (novo ? Number(novo.desconto) : 0))));
      }
    }
  };

  // Pastor e infiltrado (19/10/2026): o desconto e automatico, entao o cupom
  // restrito que vale para a pessoa ja vem marcado (e o valor ja desconta).
  // O organizador ainda pode trocar.
  useEffect(() => {
    if (ehPixTravado || cupom) return;
    const automatico = ativos
      .filter((c) => c.valido && (c.so_pastor || c.so_infiltrado) && Number(c.desconto) > 0)
      .sort((a, b) => Number(b.desconto) - Number(a.desconto))[0];
    if (automatico) escolherCupom(automatico.codigo);
  }, [ativos]); // eslint-disable-line react-hooks/exhaustive-deps

  const confirmar = async () => {
    const n = lerValor(valor);
    if (n === null || n < 0) {
      setErro('Informe o valor recebido.');
      return;
    }
    if (!ehPixTravado && !meio) {
      setErro('Escolha se o pagamento foi em dinheiro, no cartão ou por PIX.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await onConfirmar(pedido, n, cupom || null, ehPixTravado ? null : meio, observacao.trim() || null);
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
          {/* Receber de quem nao esta escalado e decisao do organizador
              (22/10/2026); a janela so avisa. */}
          {pedido?.foraDaEscala && (
            <p className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong className="text-amber-100">Esta pessoa não está escalada</strong>
                {pedido.areaEscala === 'Não será escalado' ? ' (está em “Não será escalado”)' : ''}.
                Confira antes de confirmar o recebimento.
              </span>
            </p>
          )}
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
              <span className="text-sm text-gray-300">Recebido em</span>
              <div className="grid grid-cols-3 gap-2" role="group" aria-label="Recebido em">
                {MEIOS.map(({ valor: v, rotulo, Icone }) => (
                  <button
                    key={v} type="button"
                    onClick={() => { setMeio(v); setErro(null); }}
                    aria-pressed={meio === v}
                    className={cn(
                      'h-11 rounded-md border text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors',
                      meio === v
                        ? 'border-emerald-500/70 bg-emerald-500/15 text-white'
                        : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
                    )}
                  >
                    <Icone className="w-4 h-4" /> {rotulo}
                  </button>
                ))}
              </div>
              {meio === 'pix' && (
                <p className="text-xs text-gray-400">
                  PIX recebido direto, conferido por você. Fica separado do PIX automático do banco nos relatórios.
                </p>
              )}
            </div>
          )}

          {!ehPixTravado && (
            <div className="space-y-1.5">
              <span className="text-sm text-gray-300">Cupom de desconto</span>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Cupom de desconto">
                {[{ codigo: '', rotulo: 'Sem cupom', vale: true },
                  ...ativos.map((c) => ({
                    codigo: c.codigo,
                    vale: c.valido === true,
                    motivo: c.motivo,
                    rotulo: c.percentual
                      ? `${c.codigo} · −${Number(c.percentual)}%${c.valido ? ` (−${formatarValor(c.desconto)})` : ''}`
                      : `${c.codigo} · −${formatarValor(c.desconto)}`
                  }))]
                  .map((op) => (
                    <button
                      key={op.codigo || 'nenhum'} type="button"
                      disabled={!op.vale}
                      onClick={() => escolherCupom(op.codigo)}
                      aria-pressed={cupom === op.codigo}
                      data-dica={op.vale ? undefined : op.motivo === 'so_infiltrado'
                        ? 'Cupom só para infiltrados: esta pessoa não está escalada em Infiltrados.'
                        : 'Cupom só para pastores: esta pessoa não está registrada como pastor no sistema (cargo na igreja PASTOR(A) ou PASTOR(A) AUXILIAR, ou na lista de Pastores Parceiros).'}
                      className={cn(
                        'h-9 px-3 rounded-md border text-sm transition-colors',
                        !op.vale
                          ? 'border-white/5 bg-white/[0.02] text-gray-600 cursor-not-allowed'
                          : cupom === op.codigo
                            ? 'border-blue-500/60 bg-blue-500/15 text-white'
                            : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
                      )}
                    >
                      {op.rotulo}{!op.vale ? (op.motivo === 'so_infiltrado' ? ' · só infiltrado' : ' · só pastor') : ''}
                    </button>
                  ))}
              </div>
              {ativos.length === 0 && (
                <p className="text-xs text-gray-500">Nenhum cupom ativo nesta edição.</p>
              )}
              {ativos.some((c) => c.valido === false) && (
                <p className="text-xs text-gray-500">Cupom em cinza: não vale para esta pessoa.</p>
              )}
              {cupomEscolhido && lote !== null && (
                <p className="text-xs text-gray-400">
                  {formatarValor(lote)} − {formatarValor(cupomEscolhido.desconto)} = {formatarValor(Math.max(0, lote - Number(cupomEscolhido.desconto)))}
                </p>
              )}
            </div>
          )}

          <div className="space-y-1">
            <label htmlFor="pg-obs" className="text-sm text-gray-300">
              Observação <span className="text-gray-500">(opcional)</span>
            </label>
            <textarea
              id="pg-obs" rows={2} maxLength={300} value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex.: PIX feito pela mãe, pagou na mesa da entrada..."
              className="w-full rounded-md bg-white/5 border border-white/10 text-white text-sm px-3 py-2 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
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
