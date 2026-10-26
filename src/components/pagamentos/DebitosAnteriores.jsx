import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertOctagon, Check, ChevronDown, ChevronUp, Loader2, MessageCircle, ShieldCheck, ShieldOff, Trash2, Wallet } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { fetchDebitos, quitarDebito, autorizarInscricaoComDebito, retirarDebito } from '@/services/paymentService';
import { linkWhatsApp } from '@/services/liderService';
import { formatarTelefone } from '@/utils/telefone';

/**
 * Debitos de edicoes anteriores (migration 20261025e, Patrick 25/10/2026).
 * Quem estava com pagamento agendado e nao pagou ate a virada carrega a
 * cobranca: nao se inscreve na edicao seguinte ate quitar, salvo autorizacao
 * de um organizador (vale so para a edicao atual; o debito continua aberto).
 * "Retirar" e para debito lancado por engano (motivo obrigatorio).
 * O quadro so aparece quando existe algum debito.
 */

const moeda = (v) => (v == null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v)));
const dataBR = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—');
const dataHoraBR = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const NOME_MEIO = { pix: 'PIX', dinheiro: 'Dinheiro', cartao: 'Cartão' };

const QuitarDialog = ({ debito, onFechar, onFeito }) => {
  const [meio, setMeio] = useState('dinheiro');
  const [valor, setValor] = useState('');
  const [obs, setObs] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [pessoa, setPessoa] = useState(debito);

  useEffect(() => {
    if (!debito) return;
    setPessoa(debito);
    setMeio('dinheiro');
    setValor(debito.valor_previsto != null ? String(debito.valor_previsto).replace('.', ',') : '');
    setObs('');
    setErro('');
    setSalvando(false);
  }, [debito]);

  const salvar = async () => {
    const numero = Number(String(valor).replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(numero) || numero <= 0) { setErro('Informe o valor recebido.'); return; }
    setSalvando(true);
    setErro('');
    try {
      await quitarDebito(pessoa.id, meio, numero, obs.trim());
      onFeito(`${pessoa.nome}: débito quitado.`);
    } catch (e) {
      setErro(e.message);
      setSalvando(false);
    }
  };

  return (
    <Dialog open={!!debito} onOpenChange={(aberto) => !aberto && !salvando && onFechar()}>
      <DialogContent className="bg-neutral-900 border-white/10 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quitar débito</DialogTitle>
          <DialogDescription className="text-gray-400">
            {pessoa?.nome} · {pessoa?.edicao}ª edição
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(NOME_MEIO).map(([chave, rotulo]) => (
              <button
                key={chave} type="button" onClick={() => setMeio(chave)}
                className={cn('rounded-lg border px-3 py-2 text-sm', meio === chave
                  ? 'border-blue-500/60 bg-blue-500/10 text-white' : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10')}
              >
                {rotulo}
              </button>
            ))}
          </div>
          <div className="space-y-1">
            <label htmlFor="debito-valor" className="text-sm text-gray-300">Valor recebido (R$)</label>
            <Input id="debito-valor" inputMode="decimal" value={valor} onChange={(e) => { setValor(e.target.value); setErro(''); }}
              className="bg-white/5 border-white/10 text-white" />
          </div>
          <div className="space-y-1">
            <label htmlFor="debito-obs" className="text-sm text-gray-300">Observação (opcional)</label>
            <Textarea id="debito-obs" rows={2} maxLength={200} value={obs} onChange={(e) => setObs(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-500" />
          </div>
          {erro && <p className="text-sm text-red-400">{erro}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onFechar} disabled={salvando}
              className="border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/10">Cancelar</Button>
            <Button type="button" onClick={salvar} disabled={salvando} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {salvando && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}Confirmar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const RetirarDialog = ({ debito, onFechar, onFeito }) => {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [pessoa, setPessoa] = useState(debito);

  useEffect(() => {
    if (!debito) return;
    setPessoa(debito);
    setMotivo('');
    setErro('');
    setSalvando(false);
  }, [debito]);

  const salvar = async () => {
    if (motivo.trim().length < 3) { setErro('Escreva o motivo.'); return; }
    setSalvando(true);
    setErro('');
    try {
      await retirarDebito(pessoa.id, motivo.trim());
      onFeito(`${pessoa.nome}: débito retirado.`);
    } catch (e) {
      setErro(e.message);
      setSalvando(false);
    }
  };

  return (
    <Dialog open={!!debito} onOpenChange={(aberto) => !aberto && !salvando && onFechar()}>
      <DialogContent className="bg-neutral-900 border-white/10 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Retirar débito</DialogTitle>
          <DialogDescription className="text-gray-400">
            Só para débito lançado por engano. {pessoa?.nome} deixa de dever a {pessoa?.edicao}ª edição.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <label htmlFor="debito-motivo" className="text-sm text-gray-300">Motivo *</label>
          <Textarea id="debito-motivo" rows={2} maxLength={200} value={motivo}
            onChange={(e) => { setMotivo(e.target.value); setErro(''); }}
            placeholder="Não foi ao evento"
            className="bg-white/5 border-white/10 text-white placeholder:text-gray-500" />
        </div>
        {erro && <p className="text-sm text-red-400">{erro}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onFechar} disabled={salvando}
            className="border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/10">Cancelar</Button>
          <Button type="button" onClick={salvar} disabled={salvando} className="bg-red-600 hover:bg-red-700 text-white">
            {salvando && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}Retirar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const LinhaDebito = ({ d, ocupado, onQuitar, onRetirar, onAutorizar }) => {
  const aberto = d.situacao === 'aberto';
  const link = linkWhatsApp(d.whatsapp, false,
    `Olá, ${String(d.nome || '').split(' ')[0]}! Aqui é da organização do Metanoia. Ficou em aberto a taxa de alimentação da ${d.edicao}ª edição. Podemos combinar o pagamento?`);
  return (
    <div className={cn('rounded-lg border p-3', aberto ? 'border-red-500/30 bg-red-500/5' : 'border-white/10 bg-white/[0.03] opacity-80')}>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white break-words">{d.nome}</p>
          <p className="text-xs text-gray-400 break-words">
            {d.igreja || 'Sem igreja'} · {d.edicao}ª edição · combinado para {dataBR(d.agendado_para)} · {moeda(d.valor_previsto)}
            {d.entrou_na_portaria ? ' · entrou pela portaria' : ''}
          </p>
          {d.observacao && <p className="text-xs text-gray-500 break-words">"{d.observacao}" ({d.agendado_por})</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {d.situacao === 'quitado' && (
              <span className="text-[11px] px-2 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 text-emerald-200">
                Quitado · {NOME_MEIO[d.quitado_meio] || ''} {moeda(d.quitado_valor)} · {d.quitado_por}, {dataHoraBR(d.quitado_em)}
              </span>
            )}
            {d.situacao === 'retirado' && (
              <span className="text-[11px] px-2 py-0.5 rounded-full border border-white/20 bg-white/5 text-gray-300 break-words">
                Retirado · {d.retirado_motivo} ({d.retirado_por}, {dataHoraBR(d.retirado_em)})
              </span>
            )}
            {aberto && (d.autorizado ? (
              <span className="text-[11px] px-2 py-0.5 rounded-full border border-sky-500/40 bg-sky-500/15 text-sky-200">
                Inscrição autorizada nesta edição · {d.liberado_por}
              </span>
            ) : (
              <span className="text-[11px] px-2 py-0.5 rounded-full border border-red-500/40 bg-red-500/15 text-red-200">
                Inscrição bloqueada
              </span>
            ))}
            {aberto && d.inscrito && <span className="text-[11px] text-gray-400">já inscrito nesta edição</span>}
          </div>
        </div>
        {aberto && (
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            {link && (
              <a href={link} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center h-8 px-3 rounded-md border border-white/10 text-sm text-gray-300 hover:text-white hover:bg-white/10"
                data-dica={formatarTelefone(d.whatsapp)}>
                <MessageCircle className="w-4 h-4 mr-1.5" />Cobrar
              </a>
            )}
            <Button size="sm" disabled={ocupado} onClick={() => onQuitar(d)} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white">
              <Wallet className="w-4 h-4 mr-1.5" />Quitar
            </Button>
            <Button size="sm" variant="outline" disabled={ocupado} onClick={() => onAutorizar(d, !d.autorizado)}
              data-dica={d.autorizado ? 'Volta a bloquear a inscrição (se ele ainda não se inscreveu).' : 'Deixa se inscrever nesta edição sem pagar. O débito continua em aberto.'}
              className="h-8 border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/10">
              {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : d.autorizado
                ? <><ShieldOff className="w-4 h-4 mr-1.5" />Tirar autorização</>
                : <><ShieldCheck className="w-4 h-4 mr-1.5" />Autorizar inscrição</>}
            </Button>
            <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => onRetirar(d)}
              data-dica="Débito lançado por engano."
              className="h-8 text-gray-400 hover:text-red-300 hover:bg-red-500/10">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

const DebitosAnteriores = () => {
  const { toast } = useToast();
  const [debitos, setDebitos] = useState([]);
  const [aberto, setAberto] = useState(true);
  const [verResolvidos, setVerResolvidos] = useState(false);
  const [ocupado, setOcupado] = useState(null);
  const [quitando, setQuitando] = useState(null);
  const [retirando, setRetirando] = useState(null);

  const carregar = useCallback(async () => {
    try {
      const r = await fetchDebitos();
      setDebitos(r.debitos);
    } catch (e) {
      console.error('DebitosAnteriores', e?.message || e);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const emAberto = useMemo(() => debitos.filter((d) => d.situacao === 'aberto'), [debitos]);
  const resolvidos = useMemo(() => debitos.filter((d) => d.situacao !== 'aberto'), [debitos]);

  const feito = (texto) => {
    setQuitando(null);
    setRetirando(null);
    toast({ title: texto, className: 'bg-emerald-600 text-white' });
    carregar();
  };

  const autorizar = async (d, sim) => {
    setOcupado(d.id);
    try {
      await autorizarInscricaoComDebito(d.id, sim);
      toast({ title: sim ? `${d.nome} pode se inscrever nesta edição.` : `Inscrição de ${d.nome} bloqueada de novo.`, className: 'bg-emerald-600 text-white' });
      carregar();
    } catch (e) {
      toast({ title: 'Não deu certo', description: e.message, variant: 'destructive' });
    } finally {
      setOcupado(null);
    }
  };

  if (debitos.length === 0) return null;

  return (
    <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/[0.06] p-4">
      <button type="button" onClick={() => setAberto(!aberto)} className="w-full flex items-start gap-3 text-left">
        <AlertOctagon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
        <span className="flex-1">
          <span className="block text-red-200 font-semibold">
            Débitos de edições anteriores ({emAberto.length} em aberto)
          </span>
          <span className="block text-sm text-gray-400">
            Pagamento agendado que não foi pago até a virada. Quem deve não consegue se inscrever, a não ser que um organizador autorize.
          </span>
        </span>
        {aberto ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>

      {aberto && (
        <div className="mt-3 space-y-2">
          {emAberto.length === 0 && <p className="text-sm text-gray-400 flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" />Nenhum débito em aberto.</p>}
          {emAberto.map((d) => (
            <LinhaDebito key={d.id} d={d} ocupado={ocupado === d.id}
              onQuitar={setQuitando} onRetirar={setRetirando} onAutorizar={autorizar} />
          ))}
          {resolvidos.length > 0 && (
            <button type="button" onClick={() => setVerResolvidos(!verResolvidos)} className="text-xs text-gray-400 hover:text-white underline">
              {verResolvidos ? 'Esconder' : 'Ver'} quitados e retirados ({resolvidos.length})
            </button>
          )}
          {verResolvidos && resolvidos.map((d) => <LinhaDebito key={d.id} d={d} />)}
        </div>
      )}

      <QuitarDialog debito={quitando} onFechar={() => setQuitando(null)} onFeito={feito} />
      <RetirarDialog debito={retirando} onFechar={() => setRetirando(null)} onFeito={feito} />
    </div>
  );
};

export default DebitosAnteriores;
