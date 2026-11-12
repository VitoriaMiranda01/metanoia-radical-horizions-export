import React, { useCallback, useEffect, useState } from 'react';
import { FileText, Plus, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { mascararTelefone, problemaTelefone } from '@/utils/telefone';
import {
  cancelarSolicitacaoFichas, minhasSolicitacoesFichas, solicitarFichas,
} from '@/services/solicitacoesFichasService';

/**
 * Area do Parceiro: pedido de fichas de acampante (12/11/2026).
 * Substitui o Google Forms. A igreja vem da conta; o WhatsApp e de quem vai
 * receber o retorno (pode ser o do pastor). A organizacao aprova ou recusa
 * na tela "Solicitações de fichas" e responde pelo WhatsApp.
 */

const ROTULO = {
  pendente: { texto: 'Aguardando resposta', cor: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  aprovada: { texto: 'Aprovada', cor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  recusada: { texto: 'Recusada', cor: 'bg-red-500/15 text-red-300 border-red-500/30' },
  cancelada: { texto: 'Cancelada', cor: 'bg-white/5 text-gray-400 border-white/10' },
};

const dataHora = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
}) : '');

const SolicitarFichasCard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dados, setDados] = useState({ igrejas: [], pedidos: [] });
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [form, setForm] = useState({ igreja: '', quantidade: '', nome: '', whatsapp: '', obs: '' });
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setDados(await minhasSolicitacoesFichas());
    } catch (e) {
      console.error('SolicitarFichasCard - carregar', e?.message || e);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const abrir = () => {
    setErro('');
    setForm({
      igreja: dados.igrejas[0]?.codigo || user?.codigo || '',
      quantidade: '',
      nome: user?.responsavel_nome || '',
      whatsapp: '',
      obs: '',
    });
    setAberto(true);
  };

  const pendenteDa = (codigo) => dados.pedidos.find(
    (p) => p.status === 'pendente' && String(p.igreja).split(' - ')[0] === codigo,
  );

  const enviar = async () => {
    const qtd = parseInt(form.quantidade, 10);
    if (!form.igreja) return setErro('Escolha a igreja.');
    if (!qtd || qtd < 1 || qtd > 200) return setErro('Informe quantas fichas (de 1 a 200).');
    if (form.nome.trim().length < 3) return setErro('Informe o nome de quem vai receber o retorno.');
    if (!form.whatsapp.trim()) return setErro('Informe o WhatsApp para contato.');
    const pTel = problemaTelefone(form.whatsapp);
    if (pTel) return setErro(pTel);
    if (pendenteDa(form.igreja)) return setErro('Esta igreja já tem um pedido aguardando resposta.');

    setEnviando(true);
    setErro('');
    try {
      await solicitarFichas({
        igrejaCodigo: form.igreja, quantidade: qtd, contatoNome: form.nome.trim(),
        contatoWhatsapp: form.whatsapp, observacao: form.obs.trim(),
      });
      toast({ title: 'Pedido enviado', description: 'A organização vai responder pelo WhatsApp informado.' });
      setAberto(false);
      carregar();
    } catch (e) {
      setErro(e?.message || 'Não foi possível enviar o pedido.');
    } finally {
      setEnviando(false);
    }
  };

  const cancelar = async (p) => {
    if (!window.confirm(`Cancelar o pedido de ${p.quantidade} fichas?`)) return;
    try {
      await cancelarSolicitacaoFichas(p.id);
      toast({ title: 'Pedido cancelado' });
      carregar();
    } catch (e) {
      toast({ title: 'Não deu certo', description: e?.message, variant: 'destructive' });
    }
  };

  const variasIgrejas = dados.igrejas.length > 1;

  return (
    <div className="mb-6 rounded-xl border border-white/10 bg-white/5 p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" /> Fichas de acampante
          </h2>
          <p className="text-sm text-gray-400">
            Peça aqui as fichas da sua igreja. A organização responde pelo WhatsApp com o código e as datas.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={carregar} disabled={carregando}
            className="border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/10">
            <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={abrir} disabled={carregando} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="w-4 h-4 mr-1" /> Solicitar fichas
          </Button>
        </div>
      </div>

      {dados.pedidos.length > 0 && (
        <ul className="mt-4 space-y-2">
          {dados.pedidos.map((p) => {
            const r = ROTULO[p.status] || ROTULO.cancelada;
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm">
                <span className={`rounded-full border px-2 py-0.5 text-xs ${r.cor}`}>{r.texto}</span>
                <span className="text-white">
                  {p.status === 'aprovada' && p.quantidade_aprovada !== p.quantidade
                    ? `${p.quantidade_aprovada} de ${p.quantidade} fichas`
                    : `${p.status === 'aprovada' ? p.quantidade_aprovada : p.quantidade} fichas`}
                </span>
                {variasIgrejas && <span className="text-gray-400">{p.igreja}</span>}
                <span className="text-gray-500 text-xs">pedido em {dataHora(p.criado_em)}</span>
                {p.status === 'recusada' && p.motivo_recusa && (
                  <span className="basis-full text-xs text-red-300">Motivo: {p.motivo_recusa}</span>
                )}
                {p.status === 'pendente' && (
                  <button type="button" onClick={() => cancelar(p)}
                    className="ml-auto text-xs text-gray-400 hover:text-red-300 inline-flex items-center gap-1">
                    <X className="w-3 h-3" /> Cancelar
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={aberto} onOpenChange={(v) => { if (!v && !enviando) setAberto(false); }}>
        <DialogContent className="bg-zinc-900 border border-white/10 text-white sm:max-w-md max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Solicitar fichas</DialogTitle>
            <DialogDescription className="text-gray-400">
              Informe quantas fichas a igreja precisa e um WhatsApp para a organização responder.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label className="text-gray-300">Igreja</Label>
              {variasIgrejas ? (
                <select value={form.igreja} onChange={(e) => setForm({ ...form, igreja: e.target.value })}
                  className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white">
                  {dados.igrejas.map((i) => (
                    <option key={i.codigo} value={i.codigo}>{i.codigo} - {i.nome}</option>
                  ))}
                </select>
              ) : (
                <p className="mt-1 text-sm text-white">
                  {dados.igrejas[0] ? `${dados.igrejas[0].codigo} - ${dados.igrejas[0].nome}` : user?.codigo}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="fichas-qtd" className="text-gray-300">Quantidade de fichas</Label>
              <Input id="fichas-qtd" type="number" inputMode="numeric" min={1} max={200} value={form.quantidade}
                onChange={(e) => setForm({ ...form, quantidade: e.target.value.replace(/\D/g, '').slice(0, 3) })}
                className="mt-1 bg-black/40 border-white/10 text-white" />
            </div>
            <div>
              <Label htmlFor="fichas-nome" className="text-gray-300">Nome para contato</Label>
              <Input id="fichas-nome" value={form.nome} maxLength={120}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                className="mt-1 bg-black/40 border-white/10 text-white" />
            </div>
            <div>
              <Label htmlFor="fichas-zap" className="text-gray-300">WhatsApp para contato</Label>
              <Input id="fichas-zap" inputMode="tel" placeholder="(21) 99999-9999" value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: mascararTelefone(e.target.value) })}
                className="mt-1 bg-black/40 border-white/10 text-white" />
              <p className="mt-1 text-xs text-gray-500">Pode ser o do pastor ou de quem cuida das fichas.</p>
            </div>
            <div>
              <Label htmlFor="fichas-obs" className="text-gray-300">Observação (opcional)</Label>
              <Textarea id="fichas-obs" rows={2} maxLength={500} value={form.obs}
                onChange={(e) => setForm({ ...form, obs: e.target.value })}
                className="mt-1 bg-black/40 border-white/10 text-white" />
            </div>
            {erro && <p className="text-sm text-red-300">{erro}</p>}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setAberto(false)} disabled={enviando}
              className="border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/10">
              Cancelar
            </Button>
            <Button onClick={enviar} disabled={enviando} className="bg-blue-600 hover:bg-blue-700 text-white">
              {enviando ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Enviar pedido'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SolicitarFichasCard;
