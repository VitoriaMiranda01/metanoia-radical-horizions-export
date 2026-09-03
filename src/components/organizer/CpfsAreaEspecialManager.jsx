import React, { useState } from 'react';
import { Plus, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { formatCPF } from '@/utils/formatters';
import { validateCPF } from '@/utils/validation';

// Gerencia a lista de CPFs escolhidos pro organizador pra UMA area especial
// (Guia, Inimigo ou Espirito Santo). Cada adicao/remocao salva direto no
// banco (via onSave), sem botao "Salvar" separado -- mesmo padrao ja usado
// em PricingPeriodsManager.jsx. `cpfs` guarda so digitos (sem formatacao);
// a formatacao (000.000.000-00) e so pra exibicao/digitacao.
const CpfsAreaEspecialManager = ({ areaLabel, cpfs = [], onSave }) => {
  const [cpfInput, setCpfInput] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [removingCpf, setRemovingCpf] = useState(null);
  const { toast } = useToast();

  const handleAdd = async () => {
    setError('');
    const digits = cpfInput.replace(/\D/g, '');

    if (!digits) {
      setError('Informe um CPF.');
      return;
    }
    if (!validateCPF(digits)) {
      setError('CPF inválido. Confira os números digitados.');
      return;
    }
    if (cpfs.includes(digits)) {
      setError('Este CPF já está nesta lista.');
      return;
    }

    setIsSaving(true);
    try {
      const updated = [...cpfs, digits];
      await onSave(updated);
      setCpfInput('');
      toast({
        title: 'CPF adicionado',
        description: `${formatCPF(digits)} foi adicionado à lista de ${areaLabel}.`,
        className: 'bg-emerald-600 text-white border-none'
      });
    } catch (err) {
      toast({
        title: 'Erro ao salvar',
        description: err.message || 'Não foi possível adicionar o CPF.',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async (cpf) => {
    setRemovingCpf(cpf);
    try {
      const updated = cpfs.filter(c => c !== cpf);
      await onSave(updated);
      toast({
        title: 'CPF removido',
        description: `${formatCPF(cpf)} foi removido da lista de ${areaLabel}.`,
        className: 'bg-emerald-600 text-white border-none'
      });
    } catch (err) {
      toast({
        title: 'Erro ao remover',
        description: err.message || 'Não foi possível remover o CPF.',
        variant: 'destructive'
      });
    } finally {
      setRemovingCpf(null);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="space-y-3">
      {cpfs.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {cpfs.map(cpf => (
            <Badge
              key={cpf}
              variant="outline"
              className="bg-white/5 border-white/20 text-white font-mono text-xs py-1 pl-3 pr-1 flex items-center gap-2"
            >
              <span>{formatCPF(cpf)}</span>
              <button
                type="button"
                onClick={() => handleRemove(cpf)}
                disabled={isSaving || removingCpf === cpf}
                className="rounded-full p-0.5 text-gray-400 hover:text-red-300 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                aria-label={`Remover ${formatCPF(cpf)}`}
              >
                {removingCpf === cpf ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <div className="text-center p-4 border border-dashed border-white/20 rounded-md text-gray-400 text-sm">
          Nenhum CPF cadastrado ainda para {areaLabel}.
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          value={cpfInput}
          onChange={e => setCpfInput(formatCPF(e.target.value))}
          onKeyDown={handleKeyDown}
          maxLength={14}
          placeholder="000.000.000-00"
          disabled={isSaving}
          className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 sm:max-w-[220px]"
        />
        <Button
          type="button"
          onClick={handleAdd}
          disabled={isSaving}
          variant="outline"
          className="border-dashed border-white/20 text-black hover:bg-white/10 hover:text-white hover:border-white/40 whitespace-nowrap"
        >
          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
          Adicionar CPF
        </Button>
      </div>

      {error && <p className="text-red-400 text-sm font-medium">{error}</p>}
    </div>
  );
};

export default CpfsAreaEspecialManager;
