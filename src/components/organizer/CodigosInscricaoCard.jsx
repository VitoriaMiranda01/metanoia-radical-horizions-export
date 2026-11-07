import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound, Loader2, Plus, Power, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import {
  ativarCodigoInscricao, criarCodigoInscricao, excluirCodigoInscricao, listarCodigosInscricao,
} from '@/services/codigosInscricaoService';

const quando = (iso) => (iso
  ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  : '');

/**
 * "Código de inscrição" em Configuracoes (07/11/2026, Patrick). Qualquer
 * organizador cria, liga/desliga e exclui (so os que ninguem usou). Os codigos
 * valem so para a edicao atual; sem nenhum ativo, ninguem se inscreve como
 * equipante para todos os dias (So Domingo nao pede codigo).
 */
const CodigosInscricaoCard = () => {
  const { toast } = useToast();
  const [dados, setDados] = useState(undefined);
  const [novo, setNovo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [mexendo, setMexendo] = useState(null);

  const carregar = useCallback(() => {
    listarCodigosInscricao()
      .then((r) => setDados(r?.ok ? r : null))
      .catch(() => setDados(null));
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  if (dados === null) return null;

  const codigos = dados?.codigos || [];
  const ativos = codigos.filter((c) => c.ativo).length;

  const criar = async (e) => {
    e.preventDefault();
    if (novo.trim().length < 3) {
      toast({ title: 'Código curto', description: 'Use de 3 a 40 caracteres.', variant: 'destructive' });
      return;
    }
    setSalvando(true);
    try {
      const r = await criarCodigoInscricao(novo.trim());
      if (!r?.ok) throw new Error(r?.erro || 'Tente de novo.');
      toast({ title: 'Código criado', description: `"${novo.trim()}" já vale para as inscrições.` });
      setNovo('');
      carregar();
    } catch (err) {
      toast({ title: 'Não criado', description: err.message, variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  const alternar = async (c) => {
    setMexendo(c.id);
    try {
      const r = await ativarCodigoInscricao(c.id, !c.ativo);
      if (!r?.ok) throw new Error(r?.erro || 'Tente de novo.');
      toast({ title: c.ativo ? 'Código desativado' : 'Código ativado' });
      carregar();
    } catch (err) {
      toast({ title: 'Não deu certo', description: err.message, variant: 'destructive' });
    } finally {
      setMexendo(null);
    }
  };

  const excluir = async (c) => {
    if (!window.confirm(`Excluir o código "${c.codigo}"?`)) return;
    setMexendo(c.id);
    try {
      const r = await excluirCodigoInscricao(c.id);
      if (!r?.ok) throw new Error(r?.erro || 'Tente de novo.');
      toast({ title: 'Código excluído' });
      carregar();
    } catch (err) {
      toast({ title: 'Não excluído', description: err.message, variant: 'destructive' });
    } finally {
      setMexendo(null);
    }
  };

  return (
    <Card className="glass-effect border-white/10 bg-black/40">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-white">
          <KeyRound className="w-5 h-5 text-blue-400" />
          <span>Código de inscrição{dados?.edicao ? ` — ${dados.edicao}ª edição` : ''}</span>
        </CardTitle>
        <CardDescription className="text-gray-400">
          O equipante só se inscreve (todos os dias) informando um destes códigos, inclusive quem tem ficha de
          edição anterior. Quem vai só no domingo e os acampantes não precisam. Maiúsculas e minúsculas não
          contam. Os códigos valem só para esta edição: na próxima, é preciso criar outro. O código usado
          aparece na ficha, ao lado do status.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {dados === undefined && (
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
          </div>
        )}

        {dados && ativos === 0 && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            Nenhum código ativo: hoje ninguém consegue se inscrever como equipante para todos os dias.
          </p>
        )}

        {dados && (
          <form onSubmit={criar} className="flex flex-col sm:flex-row gap-2">
            <Input
              value={novo}
              onChange={(e) => setNovo(e.target.value)}
              maxLength={40}
              autoComplete="off"
              placeholder="Novo código (palavra, letras e números)"
              aria-label="Novo código"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
            />
            <Button type="submit" disabled={salvando} className="bg-blue-600 hover:bg-blue-700 shrink-0">
              {salvando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Criar código
            </Button>
          </form>
        )}

        {dados && codigos.length === 0 && (
          <p className="text-sm text-gray-400">Nenhum código criado nesta edição.</p>
        )}

        {codigos.map((c) => (
          <div key={c.id} className="rounded-lg border border-white/10 p-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <div className="min-w-0">
              <p className="font-mono font-semibold text-white break-all">
                {c.codigo}
                <span className={`ml-2 rounded px-1.5 py-0.5 font-sans text-xs ${c.ativo ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-gray-400'}`}>
                  {c.ativo ? 'Ativo' : 'Desativado'}
                </span>
              </p>
              <p className="text-xs text-gray-400">
                {c.usos} {c.usos === 1 ? 'inscrição' : 'inscrições'} com este código
                {c.criado_por ? ` · criado por ${c.criado_por}` : ''} · {quando(c.criado_em)}
              </p>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" disabled={mexendo === c.id} onClick={() => alternar(c)}
                className="text-gray-300 hover:text-white h-8">
                <Power className="w-3.5 h-3.5 mr-1" /> {c.ativo ? 'Desativar' : 'Ativar'}
              </Button>
              {c.usos === 0 && (
                <Button size="sm" variant="ghost" disabled={mexendo === c.id} onClick={() => excluir(c)}
                  className="text-red-400 hover:text-red-300 h-8">
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default CodigosInscricaoCard;
