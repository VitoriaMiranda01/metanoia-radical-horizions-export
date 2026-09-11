import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Plus, X, Loader2, Search, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { formatCPF } from '@/utils/formatters';
import { validateCPF } from '@/utils/validation';

/**
 * Escolha dos equipantes de UMA area especial (Guia, Inimigo ou Espirito
 * Santo).
 *
 * POR QUE A TELA MOSTRA NOME MAS GUARDA CPF
 * -----------------------------------------
 * Antes, o organizador digitava e enxergava CPF -- e ninguem reconhece uma
 * pessoa olhando para "156.117.907-80".
 *
 * Agora a tela trabalha por NOME: busca-se a pessoa entre os equipantes
 * inscritos e clica-se nela. O que continua sendo GUARDADO, porem, e o CPF.
 * Isso e de proposito:
 *
 *   - dois equipantes podem ter o mesmo nome; CPF nao repete;
 *   - a alocacao automatica casa a pessoa pelo CPF (ver
 *     alocarAreasEspeciaisPorCpf); um nome digitado com um acento diferente
 *     falharia em silencio, e ninguem descobriria ate o dia do evento;
 *   - os CPFs ja cadastrados continuam valendo, sem precisar refazer nada.
 *
 * Ou seja: mudou o que a pessoa ve e faz, nao o que o sistema usa.
 */
const CpfsAreaEspecialManager = ({ areaLabel, cpfs = [], equipantes = [], carregandoEquipantes = false, onSave }) => {
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(false);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [removendo, setRemovendo] = useState(null);
  const containerRef = useRef(null);
  const { toast } = useToast();

  const soDigitos = (v) => (v || '').replace(/\D/g, '');

  // Indice CPF -> equipante, para mostrar o nome de quem ja esta na lista.
  const equipantePorCpf = useMemo(() => {
    const mapa = new Map();
    (equipantes || []).forEach((eq) => {
      const chave = soDigitos(eq.cpf);
      if (chave) mapa.set(chave, eq);
    });
    return mapa;
  }, [equipantes]);

  // Sugestoes: busca por nome ou por CPF, ignorando quem ja esta na lista.
  const sugestoes = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return [];
    const termoDigitos = soDigitos(termo);

    return (equipantes || [])
      .filter((eq) => !cpfs.includes(soDigitos(eq.cpf)))
      .filter((eq) => {
        const porNome = (eq.nome || '').toLowerCase().includes(termo);
        const porCpf = termoDigitos && soDigitos(eq.cpf).includes(termoDigitos);
        return porNome || porCpf;
      })
      .slice(0, 8);
  }, [busca, equipantes, cpfs]);

  // Fecha a lista de sugestões ao clicar fora.
  useEffect(() => {
    const aoClicarFora = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setAberto(false);
    };
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, []);

  const salvarLista = async (novaLista, mensagem) => {
    setIsSaving(true);
    setError('');
    try {
      await onSave(novaLista);
      setBusca('');
      setAberto(false);
      toast({
        title: mensagem.titulo,
        description: mensagem.descricao,
        className: 'bg-emerald-600 text-white border-none'
      });
    } catch (err) {
      toast({
        title: 'Erro ao salvar',
        description: err.message || 'Não foi possível salvar a alteração.',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const adicionarEquipante = (equipante) => {
    const cpf = soDigitos(equipante.cpf);
    if (!cpf) {
      setError('Este equipante está sem CPF cadastrado e não pode ser escolhido.');
      return;
    }
    if (cpfs.includes(cpf)) {
      setError('Esta pessoa já está nesta lista.');
      return;
    }
    salvarLista([...cpfs, cpf], {
      titulo: 'Pessoa adicionada',
      descricao: `${equipante.nome} entrou na lista de ${areaLabel}.`
    });
  };

  // Saida de emergencia: permite cadastrar alguem que ainda NAO se inscreveu,
  // digitando o CPF. Mantem o que a tela fazia antes, para o organizador que
  // precisa deixar a area montada com antecedencia.
  const adicionarPorCpfDigitado = () => {
    const digitos = soDigitos(busca);
    if (!validateCPF(digitos)) {
      setError('Não encontrei ninguém com esse nome. Se quiser cadastrar por CPF, digite um CPF válido.');
      return;
    }
    if (cpfs.includes(digitos)) {
      setError('Este CPF já está nesta lista.');
      return;
    }
    salvarLista([...cpfs, digitos], {
      titulo: 'CPF adicionado',
      descricao: `${formatCPF(digitos)} entrou na lista de ${areaLabel}. O nome aparecerá quando a pessoa se inscrever.`
    });
  };

  const remover = async (cpf) => {
    setRemovendo(cpf);
    const pessoa = equipantePorCpf.get(cpf);
    try {
      await onSave(cpfs.filter((c) => c !== cpf));
      toast({
        title: 'Removido',
        description: `${pessoa?.nome || formatCPF(cpf)} saiu da lista de ${areaLabel}.`,
        className: 'bg-emerald-600 text-white border-none'
      });
    } catch (err) {
      toast({
        title: 'Erro ao remover',
        description: err.message || 'Não foi possível remover.',
        variant: 'destructive'
      });
    } finally {
      setRemovendo(null);
    }
  };

  const buscaEhCpfValido = validateCPF(soDigitos(busca));

  return (
    <div className="space-y-3" ref={containerRef}>
      {cpfs.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {cpfs.map((cpf) => {
            const pessoa = equipantePorCpf.get(cpf);
            return (
              <Badge
                key={cpf}
                variant="outline"
                className="bg-white/5 border-white/20 text-white text-sm py-1.5 pl-3 pr-1 flex items-center gap-2"
              >
                <span className="flex flex-col leading-tight">
                  <span className="font-medium">
                    {pessoa ? pessoa.nome : formatCPF(cpf)}
                  </span>
                  <span className="text-[11px] text-gray-400 font-mono">
                    {pessoa ? formatCPF(cpf) : 'ainda não se inscreveu'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => remover(cpf)}
                  disabled={isSaving || removendo === cpf}
                  className="rounded-full p-0.5 text-gray-400 hover:text-red-300 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                  aria-label={`Remover ${pessoa ? pessoa.nome : formatCPF(cpf)} de ${areaLabel}`}
                >
                  {removendo === cpf ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                </button>
              </Badge>
            );
          })}
        </div>
      ) : (
        <div className="text-center p-4 border border-dashed border-white/20 rounded-md text-gray-400 text-sm">
          Ninguém escolhido ainda para {areaLabel}.
        </div>
      )}

      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <Input
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setAberto(true); setError(''); }}
            onFocus={() => setAberto(true)}
            placeholder={carregandoEquipantes ? 'Carregando equipantes...' : 'Digite o nome da pessoa...'}
            disabled={isSaving || carregandoEquipantes}
            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-gray-500 sm:max-w-[420px]"
          />
        </div>

        {aberto && busca.trim() && (
          <div className="absolute z-20 mt-1 w-full sm:max-w-[420px] bg-neutral-900 border border-white/15 rounded-md shadow-xl overflow-hidden">
            {sugestoes.length > 0 ? (
              sugestoes.map((eq) => (
                <button
                  key={eq.id}
                  type="button"
                  onClick={() => adicionarEquipante(eq)}
                  disabled={isSaving}
                  className="w-full text-left px-3 py-2 hover:bg-white/10 transition-colors border-b border-white/5 last:border-0 disabled:opacity-50"
                >
                  <span className="block text-white text-sm font-medium">{eq.nome}</span>
                  <span className="block text-xs text-gray-400">
                    {eq.igreja || 'sem igreja informada'}
                    {eq.status ? ` · ${eq.status}` : ''}
                  </span>
                </button>
              ))
            ) : (
              <div className="px-3 py-3 text-sm text-gray-400">
                {equipantes.length === 0 ? (
                  <span className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    Nenhum equipante inscrito ainda. Você pode cadastrar por CPF por enquanto.
                  </span>
                ) : (
                  'Ninguém encontrado com esse nome.'
                )}
                {buscaEhCpfValido && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={adicionarPorCpfDigitado}
                    disabled={isSaving}
                    className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                    Adicionar o CPF {formatCPF(soDigitos(busca))} mesmo assim
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-red-400 text-sm font-medium">{error}</p>}
    </div>
  );
};

export default CpfsAreaEspecialManager;
