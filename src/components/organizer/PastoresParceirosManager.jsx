import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, MessageCircle, Pencil, Plus, RotateCcw, Save, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import IgrejaSelect from '@/components/inscricao/IgrejaSelect';
import { useOpcoesDeIgreja } from '@/hooks/useOpcoesDeIgreja';
import { fetchPastores, removerPastor, salvarPastor } from '@/services/pastoresService';
import { linkWhatsApp } from '@/services/liderService';
import { formatarTelefone, mascararTelefone } from '@/utils/telefone';
import { formatCPF } from '@/utils/formatters';
import { cn } from '@/lib/utils';

/**
 * Quadro "Pastores Parceiros" (Configuracoes, Patrick, 08/10/2026): todos os
 * pastores de cada igreja -- pode haver varios por igreja, e por ora ninguem e
 * marcado como principal. Lista com busca, Editar e Remover em cada pastor e
 * "Adicionar pastor" no fim. Os dados da planilha "Registro de Igrejas/Pastor
 * responsavel" sao importados depois que ela fechar; quem vier de la sem igreja
 * reconhecida aparece como "a vincular", com o que a pessoa escreveu.
 */

const semAcento = (t) => (t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const mascararCPF = (v) => {
  const d = String(v || '').replace(/\D/g, '').slice(0, 11);
  return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
};

const PastorDialog = ({ aberto, pastor, igrejas, onSalvar, onFechar }) => {
  const editando = !!pastor?.id;
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [telefone, setTelefone] = useState('');
  const [igreja, setIgreja] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setNome(pastor?.nome || '');
    setCpf(pastor?.cpf ? mascararCPF(pastor.cpf) : '');
    setTelefone(pastor?.telefone ? mascararTelefone(pastor.telefone) : '');
    setIgreja(pastor?.igreja_codigo ? `${pastor.igreja_codigo} - ${pastor.igreja_nome}` : '');
    setErro('');
    setSalvando(false);
  }, [aberto]); // eslint-disable-line react-hooks/exhaustive-deps

  const salvar = async () => {
    if (nome.trim().length < 3) { setErro('Escreva o nome do pastor.'); return; }
    const d = cpf.replace(/\D/g, '');
    if (d && d.length !== 11) { setErro('O CPF tem 11 dígitos (ou deixe em branco).'); return; }
    if (!igreja) { setErro('Escolha a igreja do pastor.'); return; }
    setSalvando(true);
    setErro('');
    const r = await onSalvar({
      id: pastor?.id || null, nome: nome.trim(), cpf: d, telefone,
      igrejaCodigo: igreja.split(' - ')[0],
    });
    if (!r?.success) {
      setErro(r?.error || 'Não foi possível salvar.');
      setSalvando(false);
    }
  };

  const enter = (e) => { if (e.key === 'Enter') salvar(); };
  const campo = 'bg-white/5 border-white/10 text-white placeholder:text-gray-500';

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && !salvando && onFechar()}>
      <DialogContent className="bg-zinc-900 border border-white/10 text-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar pastor' : 'Adicionar pastor'}</DialogTitle>
          <DialogDescription className="text-gray-400">
            {editando ? pastor.nome : 'A igreja pode ter mais de um pastor: cadastre cada um separado.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pr-nome" className="text-gray-300">Nome completo</Label>
            <Input
              id="pr-nome" value={nome} disabled={salvando} autoFocus
              onChange={(e) => { setNome(e.target.value); setErro(''); }}
              onKeyDown={enter} placeholder="Ex.: Pr. João da Silva" className={campo}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pr-cpf" className="text-gray-300">CPF <span className="text-gray-500 font-normal">(opcional)</span></Label>
              <Input
                id="pr-cpf" inputMode="numeric" value={cpf} disabled={salvando}
                onChange={(e) => { setCpf(mascararCPF(e.target.value)); setErro(''); }}
                onKeyDown={enter} placeholder="000.000.000-00" className={`${campo} tabular-nums`}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pr-tel" className="text-gray-300">Telefone <span className="text-gray-500 font-normal">(opcional)</span></Label>
              <Input
                id="pr-tel" inputMode="tel" value={telefone} disabled={salvando}
                onChange={(e) => { setTelefone(mascararTelefone(e.target.value)); setErro(''); }}
                onKeyDown={enter} placeholder="(21) 99999-9999" className={`${campo} tabular-nums`}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pr-igreja" className="text-gray-300">Igreja</Label>
            <IgrejaSelect
              id="pr-igreja" value={igreja} onChange={(v) => { setIgreja(v); setErro(''); }}
              options={igrejas} placeholder="Procure pelo nome ou pelo número..."
            />
            {pastor?.igreja_digitada && !pastor?.igreja_codigo && (
              <p className="text-xs text-amber-300">Na planilha escreveu: “{pastor.igreja_digitada}”</p>
            )}
          </div>
        </div>

        {erro && <p className="text-sm text-red-400">{erro}</p>}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onFechar} disabled={salvando}
            className="text-gray-300 hover:text-white hover:bg-white/10">
            Cancelar
          </Button>
          <Button type="button" onClick={salvar} disabled={salvando} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {salvando ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
            {editando ? 'Salvar' : 'Adicionar pastor'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const PastoresParceirosManager = () => {
  const { toast } = useToast();
  const { parceiras } = useOpcoesDeIgreja();
  const [pastores, setPastores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  // { pastor } para editar, { pastor: null } para adicionar, ou null.
  const [janela, setJanela] = useState(null);
  const [removendo, setRemovendo] = useState(null); // id em confirmacao
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      setPastores(await fetchPastores());
    } catch (e) {
      setErro(e.message || 'Não foi possível carregar os pastores.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const termo = semAcento(busca.trim());
  const digitos = termo.replace(/\D/g, '');
  const filtrados = useMemo(() => {
    if (!termo) return pastores;
    return pastores.filter((p) =>
      semAcento(`${p.nome} ${p.igreja_codigo || ''} ${p.igreja_nome || ''} ${p.igreja_digitada || ''}`).includes(termo)
      || (digitos.length >= 3 && (`${p.cpf || ''} ${p.telefone || ''}`).includes(digitos)));
  }, [pastores, termo, digitos]);

  const igrejasComPastor = new Set(pastores.filter((p) => p.igreja_id).map((p) => p.igreja_id)).size;
  const aVincular = pastores.filter((p) => !p.igreja_id).length;

  const salvar = async (dados) => {
    const r = await salvarPastor(dados);
    if (!r.success) return r;
    setJanela(null);
    toast({
      title: dados.id ? 'Pastor salvo' : 'Pastor adicionado',
      description: `${r.nome} · ${r.igreja}`,
      className: 'bg-emerald-600 text-white border-none',
    });
    await carregar();
    return r;
  };

  const remover = async (p) => {
    setOcupado(true);
    const r = await removerPastor(p.id);
    setOcupado(false);
    setRemovendo(null);
    if (!r.success) {
      toast({ title: 'Não deu para remover', description: r.error, variant: 'destructive' });
      return;
    }
    toast({ title: 'Pastor removido', description: r.nome });
    carregar();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
          <Input
            value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, igreja, CPF ou telefone..."
            className="h-9 pl-8 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
          />
        </div>
        <Button
          variant="outline" size="sm" onClick={carregar} disabled={loading}
          data-dica="Buscar a lista de novo."
          className="h-9 border-white/10 bg-transparent text-gray-300 hover:bg-white/5 hover:text-white shrink-0"
        >
          <RotateCcw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} /> Atualizar
        </Button>
      </div>

      {!loading && !erro && (
        <p className="text-xs text-gray-500">
          {pastores.length} {pastores.length === 1 ? 'pastor' : 'pastores'} · {igrejasComPastor} {igrejasComPastor === 1 ? 'igreja' : 'igrejas'}
          {aVincular > 0 && <span className="text-amber-300"> · {aVincular} a vincular</span>}
          {termo ? ` · ${filtrados.length} na busca` : ''}
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-8 justify-center text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" /> Carregando...
        </div>
      ) : erro ? (
        <p className="text-red-300 text-sm py-6 text-center">{erro}</p>
      ) : (
        <div className="max-h-96 overflow-y-auto rounded-md border border-white/10">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-zinc-900 text-gray-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left font-medium px-3 py-2">Pastor</th>
                <th className="text-left font-medium px-3 py-2">Igreja</th>
                <th className="text-left font-medium px-3 py-2 hidden md:table-cell">CPF</th>
                <th className="text-left font-medium px-3 py-2 hidden sm:table-cell">Telefone</th>
                <th className="w-px px-2 py-2"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => {
                const link = linkWhatsApp(p.telefone);
                return (
                  <tr key={p.id} className="border-t border-white/5 hover:bg-white/5">
                    <td className="px-3 py-1.5 text-white">{p.nome}</td>
                    <td className="px-3 py-1.5">
                      {p.igreja_codigo ? (
                        <span className="text-gray-200">
                          <span className="text-gray-500 tabular-nums">{p.igreja_codigo}</span> {p.igreja_nome}
                        </span>
                      ) : (
                        <span className="inline-flex flex-col">
                          <span className="text-[11px] w-fit px-1.5 py-0.5 rounded-full border border-amber-500/40 text-amber-300">a vincular</span>
                          {p.igreja_digitada && <span className="text-xs text-gray-500 mt-0.5">“{p.igreja_digitada}”</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-gray-400 tabular-nums whitespace-nowrap hidden md:table-cell">
                      {p.cpf ? formatCPF(p.cpf) : '—'}
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap hidden sm:table-cell">
                      {p.telefone ? (
                        link ? (
                          <a href={link} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 hover:underline tabular-nums">
                            <MessageCircle className="w-3.5 h-3.5" />{formatarTelefone(p.telefone)}
                          </a>
                        ) : <span className="text-gray-300 tabular-nums">{formatarTelefone(p.telefone)}</span>
                      ) : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      {removendo === p.id ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="text-xs text-gray-400 mr-1">Remover?</span>
                          <Button type="button" variant="ghost" size="sm" disabled={ocupado} onClick={() => setRemovendo(null)}
                            className="h-7 px-2 text-xs text-gray-300 hover:text-white hover:bg-white/10">Não</Button>
                          <Button type="button" size="sm" disabled={ocupado} onClick={() => remover(p)}
                            className="h-7 px-2 text-xs bg-red-600 hover:bg-red-700 text-white">
                            {ocupado ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Sim'}
                          </Button>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <Button
                            type="button" variant="ghost" size="sm" onClick={() => setJanela({ pastor: p })}
                            data-dica="Editar nome, CPF, telefone e igreja deste pastor." aria-label={`Editar ${p.nome}`}
                            className="h-7 px-2 text-xs text-gray-400 hover:text-white hover:bg-white/10"
                          >
                            <Pencil className="w-3.5 h-3.5 sm:mr-1" /><span className="hidden sm:inline">Editar</span>
                          </Button>
                          <Button
                            type="button" variant="ghost" size="sm" onClick={() => setRemovendo(p.id)}
                            data-dica="Tirar este pastor da lista (fica guardado no histórico)." aria-label={`Remover ${p.nome}`}
                            className="h-7 w-7 p-0 text-gray-500 hover:text-red-300 hover:bg-red-500/10"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                    {pastores.length === 0
                      ? 'Nenhum pastor cadastrado ainda. Os da planilha entram quando ela for importada.'
                      : 'Nenhum pastor bate com a busca.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="button" size="sm" onClick={() => setJanela({ pastor: null })} disabled={loading || !!erro}
          data-dica="Cadastrar um pastor numa igreja da lista."
          className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Plus className="w-4 h-4 mr-1.5" /> Adicionar pastor
        </Button>
      </div>

      <PastorDialog
        aberto={!!janela}
        pastor={janela?.pastor || null}
        igrejas={parceiras}
        onSalvar={salvar}
        onFechar={() => setJanela(null)}
      />
    </div>
  );
};

export default PastoresParceirosManager;
