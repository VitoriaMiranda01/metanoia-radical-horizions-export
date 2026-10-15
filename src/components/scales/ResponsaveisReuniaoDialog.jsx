import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Crown, Loader2, Search, UserCog, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { fetchResponsaveisReuniao, definirResponsavelReuniao } from '@/services/scalesService';
import { cn } from '@/lib/utils';

/**
 * Responsaveis pela reuniao da escala (15/10/2026, Patrick).
 *
 * Quando o lider nao vai estar na Leitura de Escala, outra pessoa da equipe
 * conduz a reuniao: faz a chamada e manda o convite do grupo. O lider
 * escolhe pelo celular ("Delegar reuniao"); aqui os organizadores veem todas
 * as equipes e podem escolher ou trocar. Areas sem lider tambem aparecem:
 * o responsavel e quem faz a chamada delas.
 */

const CORES = { Amarelo: '#facc15', Azul: '#3b82f6', Roxo: '#a855f7', Verde: '#22c55e', Vermelho: '#ef4444' };
const semAcento = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const chaveDe = (e) => `${e.area}|${e.cor || ''}`;

const ResponsaveisReuniaoDialog = ({ onClose }) => {
  const { toast } = useToast();
  const [equipes, setEquipes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [escolhendo, setEscolhendo] = useState(null);
  const [salvando, setSalvando] = useState(null);

  const carregar = useCallback(async () => {
    const r = await fetchResponsaveisReuniao();
    setCarregando(false);
    if (!r.success) { setErro(r.error); return; }
    setErro('');
    setEquipes(r.equipes);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    const aoTeclar = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onClose]);

  const termo = semAcento(busca.trim());
  const mostradas = useMemo(() => equipes.filter((e) => !termo
    || semAcento(`${e.area} ${e.cor || ''} ${(e.lideres || []).join(' ')} ${e.delegado?.nome || ''}`).includes(termo)),
  [equipes, termo]);
  const comResponsavel = equipes.filter((e) => e.delegado).length;

  const salvar = async (equipe, pessoa) => {
    setSalvando(chaveDe(equipe));
    const r = await definirResponsavelReuniao(equipe.area, equipe.cor, pessoa?.equipante_id || null);
    setSalvando(null);
    if (!r.success) {
      toast({ title: 'Não deu para salvar', description: r.error, variant: 'destructive' });
      return;
    }
    toast({
      title: pessoa ? `${pessoa.nome} conduz a reunião de ${equipe.area}${equipe.cor ? ` · ${equipe.cor}` : ''}` : 'Responsável retirado',
      className: 'bg-emerald-600 text-white'
    });
    setEscolhendo(null);
    carregar();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-black border border-white/10 rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start gap-4 p-5 border-b border-white/10 bg-zinc-900">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <UserCog className="h-5 w-5 text-amber-300" /> Responsáveis pela reunião da escala
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              Quem conduz a Leitura de Escala no lugar do líder: faz a chamada e manda o convite do grupo, pelo
              acompanhamento da inscrição. O líder também pode escolher pelo celular.
            </p>
            {!carregando && (
              <p className="text-xs text-gray-500 mt-1">{equipes.length} equipes · {comResponsavel} com responsável</p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-white shrink-0">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-4 border-b border-white/10">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar área, cor, líder ou responsável..."
              className="h-9 pl-8 bg-black/40 border-white/20 text-white" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {carregando && (
            <div className="flex items-center justify-center gap-2 py-12 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" /> Carregando...
            </div>
          )}
          {!carregando && erro && <p className="text-red-300 text-sm text-center py-12">{erro}</p>}

          {!carregando && !erro && mostradas.map((e) => {
            const chave = chaveDe(e);
            const aberta = escolhendo === chave;
            return (
              <div key={chave} className={cn('rounded-md border p-3', e.delegado ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/10 bg-white/5')}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold flex items-center gap-2">
                      {e.area}
                      {e.cor && (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-300 font-normal">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: CORES[e.cor] || '#999' }} /> {e.cor}
                        </span>
                      )}
                      <span className="text-xs text-gray-500 font-normal">{(e.membros || []).length} pessoas</span>
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      <Crown className="inline h-3 w-3 mr-1 text-amber-300/70" />
                      {e.lideres?.length ? e.lideres.join(', ') : 'sem líder'}
                    </p>
                    {e.delegado && (
                      <p className="text-xs text-amber-200 mt-0.5">
                        Responsável: <strong>{e.delegado.nome}</strong>
                        {e.delegado.definido_por ? <span className="text-gray-500"> · por {e.delegado.definido_por}</span> : null}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {salvando === chave && <Loader2 className="h-4 w-4 animate-spin text-gray-400 self-center" />}
                    <Button size="sm" variant="outline" onClick={() => setEscolhendo(aberta ? null : chave)}
                      className="h-8 border-amber-500/40 bg-transparent text-amber-200 hover:bg-amber-500/10 hover:text-amber-100">
                      {e.delegado ? 'Trocar' : 'Escolher responsável'}
                    </Button>
                    {e.delegado && (
                      <Button size="sm" variant="ghost" disabled={salvando === chave} onClick={() => salvar(e, null)}
                        className="h-8 text-gray-400 hover:text-red-300 hover:bg-white/10">
                        Tirar
                      </Button>
                    )}
                  </div>
                </div>
                {aberta && (
                  <EscolherMembro equipe={e} ocupado={salvando === chave} onEscolher={(p) => salvar(e, p)} />
                )}
              </div>
            );
          })}
          {!carregando && !erro && mostradas.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-12">Nenhuma equipe encontrada.</p>
          )}
        </div>
      </div>
    </div>
  );
};

const EscolherMembro = ({ equipe, ocupado, onEscolher }) => {
  const [busca, setBusca] = useState('');
  const termo = semAcento(busca.trim());
  const membros = useMemo(() => [...(equipe.membros || [])]
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'))
    .filter((m) => !termo || semAcento(m.nome).includes(termo)), [equipe, termo]);

  return (
    <div className="mt-3 rounded-md border border-amber-500/30 bg-black/40 p-2 space-y-2">
      <Input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar na equipe"
        className="h-9 bg-black/40 border-white/20 text-white" />
      <div className="max-h-56 overflow-y-auto">
        {membros.map((m) => {
          const atual = equipe.delegado?.equipante_id === m.equipante_id;
          return (
            <button key={m.equipante_id} type="button" disabled={ocupado || atual} onClick={() => onEscolher(m)}
              className={cn('w-full flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm',
                atual ? 'bg-amber-500/15 text-amber-100' : 'text-gray-100 hover:bg-white/10')}>
              <span className="flex-1 truncate">{m.nome}</span>
              {atual && <Check className="h-4 w-4" />}
            </button>
          );
        })}
        {membros.length === 0 && <p className="text-xs text-gray-500 text-center py-3">Ninguém encontrado.</p>}
      </div>
    </div>
  );
};

export default ResponsaveisReuniaoDialog;
