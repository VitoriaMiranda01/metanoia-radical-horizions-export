import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Undo2, UserX } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { formatCPF } from '@/utils/formatters';
import { validateCPF } from '@/utils/validation';
import {
  fetchBloqueioAcampantes, liberarCpfAcampante, desfazerLiberacaoAcampante
} from '@/services/acampanteUmaVezService';

/**
 * "Acampante uma vez só" em Configuracoes (04/11/2026, Patrick). So a conta
 * Desenvolvedores ve: quantos CPFs estao bloqueados por edicao e as
 * liberacoes feitas (com motivo), que podem ser desfeitas. O CPF em si nao e
 * guardado -- so a impressao digital --, entao a lista nao mostra nomes.
 */
const fmtHora = (iso) => (iso
  ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—');

const AcampanteUmaVezCard = () => {
  const { toast } = useToast();
  const [resumo, setResumo] = useState(undefined);
  const [cpf, setCpf] = useState('');
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(() => {
    fetchBloqueioAcampantes()
      .then((r) => setResumo(r?.ok ? r : null))
      .catch(() => setResumo(null));
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  if (resumo === null) return null;

  const liberar = async () => {
    if (!validateCPF(cpf)) {
      toast({ title: 'CPF inválido', description: 'Confira os números do CPF.', variant: 'destructive' });
      return;
    }
    if (motivo.trim().length < 5) {
      toast({ title: 'Falta o motivo', description: 'Escreva por que este CPF está sendo liberado.', variant: 'destructive' });
      return;
    }
    setSalvando(true);
    try {
      const r = await liberarCpfAcampante(cpf, motivo.trim());
      if (!r?.ok) {
        toast({ title: 'Não liberado', description: r?.erro || 'Tente de novo.', variant: 'destructive' });
        return;
      }
      toast({ title: 'CPF liberado', description: 'A pessoa já pode se inscrever como acampante de novo.' });
      setCpf('');
      setMotivo('');
      carregar();
    } catch (e) {
      toast({ title: 'Não liberado', description: e.message, variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  const desfazer = async (id) => {
    if (!window.confirm('Desfazer esta liberação? O CPF volta a ficar bloqueado.')) return;
    try {
      const r = await desfazerLiberacaoAcampante(id);
      if (!r?.ok) throw new Error(r?.erro || 'Tente de novo.');
      toast({ title: 'Liberação desfeita' });
      carregar();
    } catch (e) {
      toast({ title: 'Não deu certo', description: e.message, variant: 'destructive' });
    }
  };

  const porEdicao = resumo?.por_edicao || [];
  const liberados = resumo?.liberados || [];

  return (
    <Card className="glass-effect border-white/10 bg-black/40">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-white">
          <UserX className="w-5 h-5 text-blue-400" />
          <span>Acampante uma vez só</span>
        </CardTitle>
        <CardDescription className="text-gray-400">
          Quem ficou presente na recepção dos acampantes (da 37ª edição em diante) não se inscreve de novo
          como acampante. A lista é gravada na virada de edição e guarda só uma “impressão digital” do CPF —
          sem nome nem CPF. Ausentes e desistentes ficam de fora. Para um caso especial, libere o CPF abaixo
          com o motivo. Só a conta Desenvolvedores vê este quadro.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {resumo === undefined && (
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
          </div>
        )}

        {resumo && (
          <p className="text-sm text-gray-300">
            {porEdicao.length === 0
              ? 'Ninguém bloqueado ainda: a lista começa na próxima virada de edição (presentes da 37ª).'
              : `Bloqueados: ${porEdicao.map((e) => `${e.bloqueados} da ${e.edicao}ª`).join(' · ')}.`}
          </p>
        )}

        {resumo && (
          <div className="space-y-3 rounded-lg border border-white/10 p-4">
            <p className="text-sm font-medium text-white">Liberar um CPF</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="liberar-cpf" className="text-gray-300 text-xs">CPF</Label>
                <Input
                  id="liberar-cpf" value={cpf} maxLength={14} inputMode="numeric"
                  onChange={(e) => setCpf(formatCPF(e.target.value))}
                  placeholder="000.000.000-00"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="liberar-motivo" className="text-gray-300 text-xs">Motivo (fica registrado)</Label>
                <Input
                  id="liberar-motivo" value={motivo} maxLength={300}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ex.: nome da pessoa e por que pode voltar como acampante"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                />
              </div>
            </div>
            <Button onClick={liberar} disabled={salvando} className="bg-blue-600 hover:bg-blue-700">
              {salvando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Liberar CPF
            </Button>
          </div>
        )}

        {liberados.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs uppercase tracking-wider text-gray-500">Liberações feitas</p>
            {liberados.map((l) => (
              <div key={l.id} className="flex flex-wrap items-start justify-between gap-2 border-b border-white/5 pb-2 text-xs">
                <div className="space-y-0.5 min-w-0">
                  <p className="text-white break-words">{l.motivo}</p>
                  <p className="text-gray-500">
                    Acampante da {l.edicao}ª · liberado por {l.liberado_por} em {fmtHora(l.liberado_em)}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => desfazer(l.id)} className="text-gray-400 hover:text-white h-8">
                  <Undo2 className="w-3.5 h-3.5 mr-1" /> Desfazer
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AcampanteUmaVezCard;
