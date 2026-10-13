import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { getGroupColor } from '@/utils/gruposTrailha';
import { User, Users, Fingerprint, Phone, Loader2, Save, Search, X, AlertTriangle } from 'lucide-react';
import VinculosDoAcampante, { SeletorMoverGrupo } from '@/components/gerenciar/VinculosAcampante';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { normalizarBusca } from '@/utils/busca';
import { nomeDaIgreja } from '@/constants/igrejas';
import { formatarTelefone } from '@/utils/telefone';
import { cn } from '@/lib/utils';

// Realocacao manual de grupo de trilha: a troca e estrategica -- quem vem
// junto (conjuge, amigo, parente) fica em grupos DIFERENTES (Patrick,
// 12/10/2026). Os vinculos de cada um aparecem no card (VinculosAcampante.jsx)
// e mover para um grupo onde ja tem alguem vinculado pede confirmacao -- so
// aviso, nao bloqueia.
const AcampanteItem = ({ acampante, onRealocar, onSalvarObservacao, vinc }) => {
  const isMale = acampante.sexo?.toLowerCase() === 'masculino';

  // Observacao breve do organizador sobre este acampante (coluna
  // acampantes.observacoes_organizador). lastSavedObs guarda o valor que
  // realmente esta salvo no banco, pra habilitar o botao de salvar so
  // quando o texto digitado difere do que ja foi persistido.
  const [observacao, setObservacao] = useState(acampante.observacoes_organizador || '');
  const [lastSavedObs, setLastSavedObs] = useState(acampante.observacoes_organizador || '');
  const [isSavingObs, setIsSavingObs] = useState(false);
  const observacaoRef = useRef(null);

  // Cresce a altura da textarea de observacao conforme o texto digitado
  // precisa de mais linhas (ao inves de um numero fixo de linhas ou scroll
  // interno) -- reseta pra 'auto' antes de medir de novo pra tambem
  // encolher se o organizador apagar texto.
  useEffect(() => {
    const el = observacaoRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [observacao]);

  // "Vai com": quem o acampante indicou como conhecido/familiar na inscricao
  // (QuemIndicou.jsx). Com os vinculos carregados, vira sugestao para o
  // organizador confirmar; sem eles (erro ao carregar), fica so o texto.
  const temConhecido = acampante.conhecido_no_projeto && acampante.conhecido_no_projeto !== 'NÃO TENHO';

  // Infiltrado (equipante escalado nesta cor, 12/10/2026): so a tela do
  // organizador marca; nao tem observacao de acampante, e mudar o grupo muda
  // a cor dele na escala.
  const ehInfiltrado = !!acampante.infiltrado;
  const podeObservar = !!onSalvarObservacao && !ehInfiltrado;

  const handleSalvarObservacao = async () => {
    if (!onSalvarObservacao || observacao === lastSavedObs) return;
    setIsSavingObs(true);
    try {
      await onSalvarObservacao(acampante, observacao);
      setLastSavedObs(observacao);
    } finally {
      setIsSavingObs(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className={`p-2 rounded-full ${isMale ? 'bg-blue-500/20 text-blue-400' : 'bg-pink-500/20 text-pink-400'}`}>
            <User className="w-4 h-4" />
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="flex items-center gap-2 min-w-0">
              <span className="text-white font-medium truncate">{acampante.nome}</span>
              {ehInfiltrado && (
                <span
                  className="shrink-0 rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-gray-400"
                  data-dica="Equipante escalado como infiltrado nesta cor (escala oficial). Só aparece assim aqui; nas listas e impressões sai como acampante. Mudar o grupo muda a cor na escala."
                >
                  infiltrado
                </span>
              )}
            </span>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              {acampante.cpf && (
                <span className="flex items-center gap-1">
                  <Fingerprint className="w-3 h-3" /> {acampante.cpf}
                </span>
              )}
              {acampante.whatsapp && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {formatarTelefone(acampante.whatsapp) || acampante.whatsapp}
                </span>
              )}
            </div>
            {temConhecido && !vinc?.carregado && (
              <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                <Users className="w-3 h-3 shrink-0" />
                <span className="truncate">
                  Vai com: {acampante.nome_familiar_conhecido || '—'} ({acampante.conhecido_no_projeto})
                </span>
              </div>
            )}
          </div>
        </div>
        <Badge variant="outline" className={`${isMale ? 'border-blue-500/30 text-blue-400' : 'border-pink-500/30 text-pink-400'} whitespace-nowrap`}>
          {isMale ? 'Masculino' : 'Feminino'}
        </Badge>
      </div>

      {vinc?.carregado && (
        <div className="pl-11">
          <VinculosDoAcampante acampante={acampante} vinc={vinc} onRealocar={onRealocar} />
        </div>
      )}

      {(podeObservar || onRealocar) && (
        <div className="flex flex-wrap items-start gap-1.5 pl-11">
          {podeObservar && (
            <>
              <Textarea
                ref={observacaoRef}
                value={observacao}
                onChange={e => setObservacao(e.target.value)}
                disabled={isSavingObs}
                rows={1}
                placeholder="Observações..."
                className="min-h-[32px] h-8 resize-none overflow-hidden bg-white/5 border-white/10 text-white placeholder:text-gray-500 text-xs flex-1 min-w-[9rem] py-1.5 leading-tight"
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={handleSalvarObservacao}
                data-dica="Salvar a observação deste acampante."
                disabled={observacao === lastSavedObs || isSavingObs}
                className="h-8 w-8 shrink-0 bg-white/5 border-white/10 text-gray-300 hover:bg-white/15 hover:text-white"
                aria-label="Salvar observação"
              >
                {isSavingObs ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              </Button>
            </>
          )}

          {onRealocar && (
            <SeletorMoverGrupo acampante={acampante} avisoPara={vinc?.carregado ? vinc.avisoParaGrupo : null} onMover={onRealocar} />
          )}
        </div>
      )}
    </div>
  );
};

// Filtro da lista do grupo (Patrick, 08/10/2026): busca por nome, CPF,
// telefone, igreja, "vai com" e observacao, e Todos / Masculino / Feminino.
const SEXOS = [
  { chave: 'todos', rotulo: 'Todos' },
  { chave: 'masculino', rotulo: 'Masculino' },
  { chave: 'feminino', rotulo: 'Feminino' },
];

const GruposTrailhaModal = ({ isOpen, onClose, groupName, groupData = [], onRealocar, onSalvarObservacao, vinc }) => {
  const colors = getGroupColor(groupName);
  const [busca, setBusca] = useState('');
  const [sexo, setSexo] = useState('todos');
  // "Vinculos": so quem tem vinculo com alguem deste mesmo grupo.
  const [soConflitos, setSoConflitos] = useState(false);
  const buscaRef = useRef(null);

  // Cada grupo abre com a busca limpa.
  useEffect(() => {
    if (isOpen) { setBusca(''); setSexo('todos'); setSoConflitos(false); }
  }, [isOpen, groupName]);

  const idsEmConflito = vinc?.idsEmConflito;
  const totalConflitos = useMemo(
    () => (idsEmConflito ? groupData.filter((a) => idsEmConflito.has(a.id)).length : 0),
    [groupData, idsEmConflito]
  );

  const contagem = useMemo(() => ({
    todos: groupData.length,
    masculino: groupData.filter((a) => a.sexo?.toLowerCase() === 'masculino').length,
    feminino: groupData.filter((a) => a.sexo?.toLowerCase() === 'feminino').length,
  }), [groupData]);

  const filtrados = useMemo(() => {
    const termo = normalizarBusca(busca.trim());
    const digitos = termo.replace(/\D/g, '');
    return groupData.filter((a) => {
      if (sexo !== 'todos' && a.sexo?.toLowerCase() !== sexo) return false;
      if (soConflitos && !idsEmConflito?.has(a.id)) return false;
      if (!termo) return true;
      const texto = normalizarBusca([
        a.nome, nomeDaIgreja(a), a.admin_responsavel, a.nome_familiar_conhecido, a.observacoes_organizador,
      ].filter(Boolean).join(' '));
      if (texto.includes(termo)) return true;
      return digitos.length >= 3
        && (`${a.cpf || ''}`.replace(/\D/g, '').includes(digitos) || `${a.whatsapp || ''}`.replace(/\D/g, '').includes(digitos));
    });
  }, [groupData, busca, sexo, soConflitos, idsEmConflito]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        overlayClassName="bg-black/70"
        // Abre com o cursor na busca (antes ia para a observacao do primeiro
        // acampante, que ficava com a borda branca de selecionado).
        onOpenAutoFocus={(e) => { e.preventDefault(); buscaRef.current?.focus(); }}
        className="bg-neutral-900 border-white/10 text-white sm:max-w-2xl max-h-[90vh] flex flex-col gap-3"
      >
        <DialogHeader>
          <DialogTitle className={`text-2xl flex items-center gap-3 ${colors.text}`}>
            <span className={`w-3 h-8 rounded-full ${colors.bg.replace('/10', '')} block`}></span>
            Grupo {groupName}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Lista de membros alocados ({groupData.length} participantes)
            {totalConflitos > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-amber-300">
                <AlertTriangle className="w-3.5 h-3.5" />{totalConflitos} com vínculo no mesmo grupo
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
            <Input
              ref={buscaRef}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar nome, CPF, telefone, igreja..."
              className="h-9 pl-8 pr-8 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
            />
            {busca && (
              <button
                type="button" onClick={() => { setBusca(''); buscaRef.current?.focus(); }}
                aria-label="Limpar a busca"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex gap-1.5" role="group" aria-label="Filtrar por sexo">
            {SEXOS.map((x) => (
              <button
                key={x.chave} type="button" onClick={() => setSexo(x.chave)} aria-pressed={sexo === x.chave}
                className={cn(
                  'h-9 px-3 rounded-md border text-xs whitespace-nowrap transition-colors',
                  sexo === x.chave
                    ? 'border-white/30 bg-white/15 text-white'
                    : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
                )}
              >
                {x.rotulo} <span className="text-gray-500 tabular-nums">{contagem[x.chave]}</span>
              </button>
            ))}
            {totalConflitos > 0 && (
              <button
                type="button" onClick={() => setSoConflitos((v) => !v)} aria-pressed={soConflitos}
                data-dica="Mostrar só quem tem vínculo (cônjuge, amigo, parente) com alguém deste mesmo grupo."
                className={cn(
                  'h-9 px-3 rounded-md border text-xs whitespace-nowrap transition-colors inline-flex items-center gap-1',
                  soConflitos
                    ? 'border-amber-400/60 bg-amber-500/20 text-amber-100'
                    : 'border-amber-500/30 bg-amber-500/5 text-amber-300 hover:bg-amber-500/10'
                )}
              >
                <AlertTriangle className="w-3.5 h-3.5" /> Vínculos <span className="tabular-nums">{totalConflitos}</span>
              </button>
            )}
          </div>
        </div>
        {(busca || sexo !== 'todos' || soConflitos) && (
          <p className="-mt-1 text-xs text-gray-500">{filtrados.length} de {groupData.length} no filtro</p>
        )}

        <div className="flex-1 min-h-0 max-h-[60vh] overflow-y-auto pr-1">
          <div className="space-y-2">
            {filtrados.length > 0 ? (
              filtrados.map((acampante, idx) => (
                <AcampanteItem key={acampante.id || idx} acampante={acampante} onRealocar={onRealocar} onSalvarObservacao={onSalvarObservacao} vinc={vinc} />
              ))
            ) : (
              <div className="text-center py-10 text-gray-500">
                {groupData.length === 0 ? 'Nenhum acampante alocado neste grupo ainda.' : 'Ninguém neste grupo bate com o filtro.'}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GruposTrailhaModal;
