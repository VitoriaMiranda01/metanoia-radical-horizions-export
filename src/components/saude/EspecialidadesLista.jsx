import React, { useEffect, useState } from 'react';
import { Check, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { limparCacheEspecialidades } from '@/components/inscricao/CampoEspecialidadeSaude';
import {
  fetchEspecialidadesLista, adicionarEspecialidade, renomearEspecialidade, excluirEspecialidade,
} from '@/services/saudeService';

/**
 * Quadro "Especialidades da lista" no fim da Equipe da Saude (24/10/2026,
 * pedido do Patrick): a Vera e os organizadores adicionam, renomeiam e
 * excluem as opcoes que as pessoas escolhem (inscricao, completar cadastro e
 * o lapis da tela da Saude). Renomear leva junto quem tem a especialidade;
 * excluir com gente vinculada mostra quem perde o vinculo e pede confirmacao.
 * "Outro" e fixo e nao aparece aqui.
 *
 * onMudou: recarrega a equipe (nomes trocados / vinculos tirados).
 */
const EspecialidadesLista = ({ onMudou }) => {
  const { toast } = useToast();
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [novo, setNovo] = useState('');
  const [ocupado, setOcupado] = useState(null); // nome em andamento | '+'
  const [renomeando, setRenomeando] = useState(null); // { nome, texto }
  const [confirmar, setConfirmar] = useState(null); // { nome, pessoas }

  const carregar = async () => {
    try {
      setLista(await fetchEspecialidadesLista());
    } catch (e) {
      toast({ title: 'Não foi possível carregar as especialidades', description: e.message, variant: 'destructive' });
    } finally {
      setCarregando(false);
    }
  };
  useEffect(() => { carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const mudou = async () => {
    limparCacheEspecialidades();
    await carregar();
    onMudou?.();
  };

  const erro = (titulo, e) => toast({ title: titulo, description: e.message, variant: 'destructive' });

  const adicionar = async (ev) => {
    ev.preventDefault();
    if (!novo.trim()) return;
    setOcupado('+');
    try {
      const r = await adicionarEspecialidade(novo);
      toast({ title: `“${r.nome}” ${r.reativada ? 'voltou para' : 'entrou na'} lista`, className: 'bg-emerald-600 text-white' });
      setNovo('');
      await mudou();
    } catch (e) {
      erro('Não foi possível adicionar', e);
    } finally {
      setOcupado(null);
    }
  };

  const renomear = async () => {
    const { nome, texto } = renomeando;
    if (!texto.trim() || texto.trim() === nome) { setRenomeando(null); return; }
    setOcupado(nome);
    try {
      const r = await renomearEspecialidade(nome, texto);
      toast({
        title: `“${nome}” agora é “${r.nome}”`,
        description: r.pessoas ? `${r.pessoas} ${r.pessoas === 1 ? 'pessoa foi junto' : 'pessoas foram junto'}.` : undefined,
        className: 'bg-emerald-600 text-white',
      });
      setRenomeando(null);
      await mudou();
    } catch (e) {
      erro('Não foi possível renomear', e);
    } finally {
      setOcupado(null);
    }
  };

  // confirmado = false: o servidor devolve quem esta vinculado (se houver).
  const excluir = async (nome, confirmado = false) => {
    if (!confirmado && !window.confirm(`Excluir “${nome}” da lista?`)) return;
    setOcupado(nome);
    try {
      const r = await excluirEspecialidade(nome, confirmado);
      if (r.precisa_confirmar) {
        setConfirmar({ nome, pessoas: r.pessoas || [] });
        return;
      }
      setConfirmar(null);
      toast({
        title: `“${nome}” foi excluída`,
        description: r.pessoas ? `${r.pessoas} ${r.pessoas === 1 ? 'pessoa perdeu' : 'pessoas perderam'} o vínculo.` : undefined,
        className: 'bg-emerald-600 text-white',
      });
      await mudou();
    } catch (e) {
      erro('Não foi possível excluir', e);
    } finally {
      setOcupado(null);
    }
  };

  const semPrincipal = (confirmar?.pessoas || []).filter((p) => p.principal && p.na_saude).length;

  return (
    <section className="rounded-xl border border-white/10 bg-black/50 p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-white">Especialidades da lista</p>
        <p className="text-xs text-gray-500">As opções que as pessoas escolhem na inscrição e aqui na tela. “Outro” é fixo e sempre fica no fim.</p>
      </div>

      <form onSubmit={adicionar} className="flex gap-2">
        <Input value={novo} onChange={(e) => setNovo(e.target.value)} maxLength={80} placeholder="Nova especialidade (ex.: Nutricionista)"
          className="bg-white/5 border-white/10 text-white placeholder:text-gray-500" />
        <Button type="submit" disabled={!novo.trim() || !!ocupado} className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white">
          {ocupado === '+' ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-1" />Adicionar</>}
        </Button>
      </form>

      {carregando ? (
        <p className="text-xs text-gray-500"><Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" />Carregando...</p>
      ) : (
        <div className="divide-y divide-white/5">
          {lista.map((esp) => (
            <div key={esp.nome} className="py-2 flex flex-col sm:flex-row sm:items-center gap-2">
              {renomeando?.nome === esp.nome ? (
                <form className="flex-1 flex gap-2" onSubmit={(ev) => { ev.preventDefault(); renomear(); }}>
                  <Input autoFocus value={renomeando.texto} maxLength={80}
                    onChange={(e) => setRenomeando((r) => ({ ...r, texto: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Escape' && setRenomeando(null)}
                    className="h-8 bg-white/5 border-white/10 text-white" />
                  <Button type="submit" size="sm" disabled={!!ocupado} className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white" aria-label="Salvar nome">
                    {ocupado === esp.nome ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setRenomeando(null)} className="h-8 text-gray-400 hover:text-white hover:bg-white/10" aria-label="Cancelar">
                    <X className="w-4 h-4" />
                  </Button>
                </form>
              ) : (
                <>
                  <p className="flex-1 min-w-0 text-sm text-white">
                    {esp.nome}
                    <span className="text-xs text-gray-500"> · {esp.pessoas} {esp.pessoas === 1 ? 'pessoa' : 'pessoas'}</span>
                    {!esp.ativo && <span className="text-xs text-amber-300/90"> · fora da lista</span>}
                  </p>
                  <div className="flex gap-1.5 shrink-0">
                    <Button size="sm" variant="outline" disabled={!!ocupado} onClick={() => setRenomeando({ nome: esp.nome, texto: esp.nome })}
                      className="h-8 border-white/15 bg-white/5 text-gray-300 hover:bg-white/10">
                      <Pencil className="w-3.5 h-3.5 mr-1" />Renomear
                    </Button>
                    <Button size="sm" variant="outline" disabled={!!ocupado} onClick={() => excluir(esp.nome)}
                      className="h-8 border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20">
                      {ocupado === esp.nome ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Trash2 className="w-3.5 h-3.5 mr-1" />Excluir</>}
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!confirmar} onOpenChange={(v) => !v && !ocupado && setConfirmar(null)}>
        <DialogContent className="bg-zinc-900 border border-white/10 text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Excluir “{confirmar?.nome}”?</DialogTitle>
            <DialogDescription className="text-gray-400">
              {confirmar?.pessoas.length} {confirmar?.pessoas.length === 1 ? 'pessoa está vinculada' : 'pessoas estão vinculadas'} a esta
              especialidade e {confirmar?.pessoas.length === 1 ? 'vai perder' : 'vão perder'} o vínculo. Quem a tinha como
              principal fica com a próxima que marcou (ou sem especialidade).
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-64 overflow-auto rounded-md border border-white/10 divide-y divide-white/5 text-sm">
            {(confirmar?.pessoas || []).map((p, i) => (
              <li key={`${p.nome}-${i}`} className="px-3 py-1.5 flex items-center gap-2">
                <span className="flex-1 min-w-0 truncate">{p.nome}</span>
                {p.na_saude && <span className="text-[11px] text-emerald-300">na Saúde</span>}
                <span className="text-[11px] text-gray-500">{p.principal ? 'principal' : 'adicional'}</span>
              </li>
            ))}
          </ul>
          {semPrincipal > 0 && (
            <p className="text-xs text-amber-300/90">Quem está na Saúde e ficar sem nenhuma especialidade volta a ter a pendência para informar.</p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" disabled={!!ocupado} onClick={() => setConfirmar(null)} className="text-gray-400 hover:text-white hover:bg-white/10">Cancelar</Button>
            <Button disabled={!!ocupado} onClick={() => excluir(confirmar.nome, true)} className="bg-red-600 hover:bg-red-700 text-white">
              {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Excluir mesmo assim'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default EspecialidadesLista;
