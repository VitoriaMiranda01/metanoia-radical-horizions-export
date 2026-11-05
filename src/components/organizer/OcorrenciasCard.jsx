import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { formatCPF } from '@/utils/formatters';
import { validateCPF } from '@/utils/validation';
import { MODELOS_COMUNICADO } from '@/constants/comunicados';
import { fmtCiencia } from '@/components/common/MarcaOcorrencia';
import { recarregarOcorrencias } from '@/hooks/useOcorrencias';
import { excluirOcorrencia, listarOcorrencias, salvarOcorrencia } from '@/services/ocorrenciasService';

const campo = 'bg-white/10 border-white/20 text-white placeholder:text-white/40';

const novoRascunho = (edicao) => ({
  id: null, cpf: '', nome: '', texto: '', repeticoes: 2, aPartirEdicao: edicao || 1,
});

/**
 * "Ocorrências anteriores" em Configuracoes (05/11/2026, Patrick): quem recebe
 * o comunicado ao digitar o CPF e o asterisco vermelho. Desenvolvedores, e quem
 * tiver a caixa na janela de Permissoes.
 */
const OcorrenciasCard = () => {
  const { toast } = useToast();
  const [dados, setDados] = useState(undefined);
  const [rascunho, setRascunho] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(() => {
    listarOcorrencias()
      .then((r) => setDados(r?.ok ? r : null))
      .catch(() => setDados(null));
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  if (dados === null) return null;

  const mudar = (chave, valor) => setRascunho((r) => ({ ...r, [chave]: valor }));

  const salvar = async () => {
    if (!validateCPF(rascunho.cpf)) {
      toast({ title: 'CPF inválido', description: 'Confira os números do CPF.', variant: 'destructive' });
      return;
    }
    setSalvando(true);
    try {
      const r = await salvarOcorrencia({
        ...rascunho,
        repeticoes: Number(rascunho.repeticoes),
        aPartirEdicao: Number(rascunho.aPartirEdicao),
      });
      if (!r?.ok) {
        toast({ title: 'Não salvo', description: r?.erro || 'Tente de novo.', variant: 'destructive' });
        return;
      }
      toast({ title: 'Salvo' });
      setRascunho(null);
      carregar();
      recarregarOcorrencias();
    } catch (e) {
      toast({ title: 'Não salvo', description: e.message, variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (p) => {
    if (!window.confirm(`Tirar ${p.nome} da lista? O asterisco, o comunicado e o histórico de declarações serão apagados.`)) return;
    try {
      const r = await excluirOcorrencia(p.id);
      if (!r?.ok) throw new Error(r?.erro || 'Tente de novo.');
      toast({ title: 'Retirado da lista' });
      carregar();
      recarregarOcorrencias();
    } catch (e) {
      toast({ title: 'Não deu certo', description: e.message, variant: 'destructive' });
    }
  };

  const pessoas = dados?.pessoas || [];

  return (
    <Card className="glass-effect border-white/10 bg-black/40">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-white">
          <ShieldAlert className="w-5 h-5 text-red-400" />
          <span>Ocorrências anteriores</span>
        </CardTitle>
        <CardDescription className="text-gray-400">
          Pessoas com quem já tivemos problemas. Ao digitar o CPF, recebem o comunicado e só seguem escrevendo a
          frase de ciência. Aparece a partir da reunião de inscrição (ou com as inscrições abertas), uma vez por
          edição, até completar as repetições. O asterisco vermelho no nome fica enquanto a pessoa estiver nesta
          lista, visível só para organizadores e para o Apoio da portaria.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {dados === undefined && (
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
          </div>
        )}

        {dados && !rascunho && (
          <Button onClick={() => setRascunho(novoRascunho(dados.edicao))} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" /> Adicionar pessoa
          </Button>
        )}

        {rascunho && (
          <div className="space-y-3 rounded-lg border border-white/10 p-4">
            <p className="text-sm font-medium text-white">{rascunho.id ? 'Editar' : 'Adicionar pessoa'}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="oc-cpf" className="text-gray-300 text-xs">CPF</Label>
                <Input id="oc-cpf" value={rascunho.cpf} maxLength={14} inputMode="numeric"
                  onChange={(e) => mudar('cpf', formatCPF(e.target.value))}
                  placeholder="000.000.000-00" className={campo} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="oc-nome" className="text-gray-300 text-xs">Nome</Label>
                <Input id="oc-nome" value={rascunho.nome} maxLength={120}
                  onChange={(e) => mudar('nome', e.target.value)} className={campo} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="oc-rep" className="text-gray-300 text-xs">Quantas vezes o comunicado repete (edições)</Label>
                <Input id="oc-rep" type="number" min={0} max={20} value={rascunho.repeticoes}
                  onChange={(e) => mudar('repeticoes', e.target.value)} className={campo} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="oc-ed" className="text-gray-300 text-xs">Vale a partir da edição</Label>
                <Input id="oc-ed" type="number" min={1} value={rascunho.aPartirEdicao}
                  onChange={(e) => mudar('aPartirEdicao', e.target.value)} className={campo} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="oc-modelo" className="text-gray-300 text-xs">Usar um modelo (opcional)</Label>
              <select id="oc-modelo" value=""
                onChange={(e) => {
                  const m = MODELOS_COMUNICADO.find((x) => x.chave === e.target.value);
                  if (m) mudar('texto', m.texto);
                }}
                className="w-full h-10 rounded-md border border-white/20 bg-zinc-900 px-3 text-sm text-white">
                <option value="">Escolher modelo...</option>
                {MODELOS_COMUNICADO.map((m) => <option key={m.chave} value={m.chave}>{m.rotulo}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="oc-texto" className="text-gray-300 text-xs">
                Texto do comunicado (o título e o pedido da frase entram sozinhos)
              </Label>
              <Textarea id="oc-texto" rows={10} value={rascunho.texto}
                onChange={(e) => mudar('texto', e.target.value)} className={campo} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={salvar} disabled={salvando} className="bg-blue-600 hover:bg-blue-700">
                {salvando && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Salvar
              </Button>
              <Button variant="ghost" onClick={() => setRascunho(null)} className="text-gray-300 hover:text-white hover:bg-white/10">
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {dados && pessoas.length === 0 && !rascunho && (
          <p className="text-sm text-gray-400">Ninguém na lista.</p>
        )}

        {pessoas.map((p) => (
          <div key={p.id} className="rounded-lg border border-white/10 p-3 space-y-2 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-white break-words">
                  <span className="text-red-500 font-bold mr-1">*</span>{p.nome}
                </p>
                <p className="text-xs text-gray-400">
                  CPF {formatCPF(p.cpf)} · vale a partir da {p.a_partir_edicao}ª edição
                  {!p.tem_ficha && ' · ainda sem ficha no sistema'}
                </p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setRascunho({
                  id: p.id, cpf: formatCPF(p.cpf), nome: p.nome, texto: p.texto,
                  repeticoes: p.repeticoes, aPartirEdicao: p.a_partir_edicao,
                })} className="text-gray-300 hover:text-white h-8">
                  <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => excluir(p)} className="text-red-400 hover:text-red-300 h-8">
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Tirar
                </Button>
              </div>
            </div>
            <p className="text-white">
              Escreveu que está ciente: <strong>{p.ciencias.length}</strong> de <strong>{p.repeticoes}</strong>{' '}
              {p.repeticoes === 1 ? 'vez' : 'vezes'}
            </p>
            {p.ciencias.map((c) => (
              <p key={c.edicao} className="text-xs text-gray-400">
                {fmtCiencia(c.em)} · {c.edicao}ª edição
              </p>
            ))}
            <details className="text-xs text-gray-400">
              <summary className="cursor-pointer hover:text-white">Ver o comunicado</summary>
              <p className="whitespace-pre-line mt-2 text-gray-300">{p.texto}</p>
            </details>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default OcorrenciasCard;
