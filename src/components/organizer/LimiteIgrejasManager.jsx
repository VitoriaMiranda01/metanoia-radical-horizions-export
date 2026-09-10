import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Edit2, Check, X, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { IGREJAS_PARCEIRAS } from '@/constants/igrejas';
import { fetchLimitesIgrejas, saveLimiteIgreja, deleteLimiteIgreja } from '@/services/limitesIgrejasService';

// Gerencia o limite de inscricoes de acampantes por igreja: um valor
// padrao geral (limiteGeral/onSaveLimiteGeral, vem de configuracoes --
// controlado pelo componente pai, igual PricingPeriodsManager) e uma lista
// de excecoes por igreja (guardada em limites_igrejas, uma linha por
// igreja -- este componente busca e gerencia essa lista sozinho, ja que
// nao vive em "configuracoes" e nao e usada em mais nenhum outro lugar da
// tela).
const LimiteIgrejasManager = ({ limiteGeral, onSaveLimiteGeral }) => {
  const { toast } = useToast();

  const [limiteGeralInput, setLimiteGeralInput] = useState(limiteGeral ?? '');
  const [savingGeral, setSavingGeral] = useState(false);

  useEffect(() => {
    setLimiteGeralInput(limiteGeral === null || limiteGeral === undefined ? '' : String(limiteGeral));
  }, [limiteGeral]);

  const [excecoes, setExcecoes] = useState([]);
  const [loadingExcecoes, setLoadingExcecoes] = useState(true);
  const [error, setError] = useState('');

  const [novoIgreja, setNovoIgreja] = useState('');
  const [novoLimite, setNovoLimite] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const [editingIgreja, setEditingIgreja] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [savingIgreja, setSavingIgreja] = useState(null);
  const [excecaoToDelete, setExcecaoToDelete] = useState(null);

  const ordenarExcecoes = (lista) =>
    [...lista].sort((a, b) => IGREJAS_PARCEIRAS.indexOf(a.igreja) - IGREJAS_PARCEIRAS.indexOf(b.igreja));

  useEffect(() => {
    const carregar = async () => {
      setLoadingExcecoes(true);
      const map = await fetchLimitesIgrejas();
      const lista = Object.entries(map).map(([igreja, limite_maximo]) => ({ igreja, limite_maximo }));
      setExcecoes(ordenarExcecoes(lista));
      setLoadingExcecoes(false);
    };
    carregar();
  }, []);

  const handleSalvarGeral = async () => {
    setSavingGeral(true);
    try {
      await onSaveLimiteGeral(limiteGeralInput);
      toast({
        title: 'Limite padrão salvo',
        description: limiteGeralInput === ''
          ? 'Igrejas sem exceção configurada ficam sem limite.'
          : `Igrejas sem exceção configurada ficam limitadas a ${limiteGeralInput} acampantes.`,
        className: 'bg-emerald-600 text-white border-none'
      });
    } catch (err) {
      toast({
        title: 'Erro ao salvar',
        description: err.message || 'Não foi possível salvar o limite padrão.',
        variant: 'destructive'
      });
    } finally {
      setSavingGeral(false);
    }
  };

  const handleAdicionar = async () => {
    setError('');
    if (!novoIgreja) {
      setError('Selecione uma igreja.');
      return;
    }
    setIsAdding(true);
    try {
      const saved = await saveLimiteIgreja(novoIgreja, novoLimite);
      setExcecoes(prev => ordenarExcecoes([...prev, { igreja: novoIgreja, limite_maximo: saved.limite_maximo }]));
      setNovoIgreja('');
      setNovoLimite('');
      toast({
        title: 'Limite adicionado',
        description: `${novoIgreja} agora tem um limite específico de ${saved.limite_maximo} acampantes.`,
        className: 'bg-emerald-600 text-white border-none'
      });
    } catch (err) {
      setError(err.message || 'Não foi possível salvar.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleEditar = (igreja, limite_maximo) => {
    setError('');
    setEditingIgreja(igreja);
    setEditValue(String(limite_maximo));
  };

  const handleCancelarEdicao = () => {
    setEditingIgreja(null);
    setEditValue('');
    setError('');
  };

  const handleSalvarEdicao = async (igreja) => {
    setSavingIgreja(igreja);
    try {
      const saved = await saveLimiteIgreja(igreja, editValue);
      setExcecoes(prev => prev.map(e => (e.igreja === igreja ? { ...e, limite_maximo: saved.limite_maximo } : e)));
      setEditingIgreja(null);
      toast({
        title: 'Limite atualizado',
        description: `Novo limite de ${igreja}: ${saved.limite_maximo} acampantes.`,
        className: 'bg-emerald-600 text-white border-none'
      });
    } catch (err) {
      toast({
        title: 'Erro ao salvar',
        description: err.message || 'Não foi possível atualizar o limite.',
        variant: 'destructive'
      });
    } finally {
      setSavingIgreja(null);
    }
  };

  const confirmarRemocao = async () => {
    const igreja = excecaoToDelete;
    if (!igreja) return;
    setExcecaoToDelete(null);
    setSavingIgreja(igreja);
    try {
      await deleteLimiteIgreja(igreja);
      setExcecoes(prev => prev.filter(e => e.igreja !== igreja));
      toast({
        title: 'Exceção removida',
        description: `${igreja} volta a usar o limite padrão.`,
        className: 'bg-emerald-600 text-white border-none'
      });
    } catch (err) {
      toast({
        title: 'Erro ao remover',
        description: err.message || 'Não foi possível remover a exceção.',
        variant: 'destructive'
      });
    } finally {
      setSavingIgreja(null);
    }
  };

  const igrejasDisponiveis = IGREJAS_PARCEIRAS.filter(ig => !excecoes.some(e => e.igreja === ig));

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="limite_acampantes_por_igreja" className="text-gray-300">Limite padrão (todas as igrejas)</Label>
        <div className="flex flex-col sm:flex-row gap-2 max-w-md">
          <Input
            id="limite_acampantes_por_igreja"
            type="number"
            min="1"
            placeholder="Sem limite"
            value={limiteGeralInput}
            onChange={e => setLimiteGeralInput(e.target.value)}
            className="bg-white/5 border-white/10 text-white [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <Button type="button" onClick={handleSalvarGeral} disabled={savingGeral} variant="outline" className="border-dashed border-white/20 text-black hover:bg-white/10 hover:text-white hover:border-white/40 whitespace-nowrap">
            {savingGeral ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar
          </Button>
        </div>
        <p className="text-xs text-gray-500">Deixe em branco para não aplicar limite às igrejas sem exceção configurada abaixo.</p>
      </div>

      <div className="space-y-3 pt-4 border-t border-white/10">
        <h4 className="text-sm font-medium text-gray-300">Exceções por igreja</h4>

        {loadingExcecoes ? (
          <div className="flex justify-center p-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : excecoes.length > 0 ? (
          <div className="overflow-x-auto overflow-y-auto max-h-[420px] rounded-md border border-white/10">
            <table className="w-full text-sm text-left text-white">
              <thead className="text-xs uppercase bg-white/5 border-b border-white/10 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 font-medium">Igreja</th>
                  <th className="px-4 py-3 font-medium">Limite</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {excecoes.map(({ igreja, limite_maximo }) => (
                    <motion.tr
                      key={igreja}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="border-b border-white/5 hover:bg-white/5"
                    >
                      <td className="px-4 py-3">{igreja}</td>
                      <td className="px-4 py-3">
                        {editingIgreja === igreja ? (
                          <Input
                            type="number"
                            min="1"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            autoFocus
                            className="h-8 w-24 bg-black/40 border-white/20 text-white [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        ) : (
                          limite_maximo
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          {editingIgreja === igreja ? (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => handleSalvarEdicao(igreja)} disabled={savingIgreja === igreja} className="h-8 w-8 text-green-400 hover:text-green-300 hover:bg-green-500/20">
                                {savingIgreja === igreja ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                              </Button>
                              <Button variant="ghost" size="icon" onClick={handleCancelarEdicao} disabled={savingIgreja === igreja} className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/20">
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => handleEditar(igreja, limite_maximo)} disabled={savingIgreja === igreja} className="h-8 w-8 text-blue-400 hover:text-blue-300 hover:bg-blue-500/20">
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setExcecaoToDelete(igreja)} disabled={savingIgreja === igreja} className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/20">
                                {savingIgreja === igreja ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center p-4 border border-dashed border-white/20 rounded-md text-gray-400 text-sm">
            Nenhuma igreja com limite específico ainda.
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end pt-2">
          <div className="space-y-1 flex-1 min-w-0">
            <Label className="text-gray-400 text-xs">Igreja</Label>
            <Select value={novoIgreja} onValueChange={setNovoIgreja} disabled={isAdding}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue placeholder="Selecione a igreja..." />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {igrejasDisponiveis.map(ig => (
                  <SelectItem key={ig} value={ig}>{ig}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 sm:w-28">
            <Label className="text-gray-400 text-xs">Limite</Label>
            <Input
              type="number"
              min="1"
              placeholder="Ex: 10"
              value={novoLimite}
              onChange={e => setNovoLimite(e.target.value)}
              disabled={isAdding}
              className="bg-white/5 border-white/10 text-white [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <Button type="button" onClick={handleAdicionar} disabled={isAdding} variant="outline" className="border-dashed border-white/20 text-black hover:bg-white/10 hover:text-white hover:border-white/40 whitespace-nowrap">
            {isAdding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Adicionar
          </Button>
        </div>

        {error && <p className="text-red-400 text-sm font-medium">{error}</p>}
      </div>

      <AlertDialog open={!!excecaoToDelete} onOpenChange={(open) => !open && setExcecaoToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover exceção</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o limite específico de "{excecaoToDelete}"? Essa igreja volta a usar o limite padrão geral.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarRemocao} className="bg-red-600 hover:bg-red-700">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default LimiteIgrejasManager;
