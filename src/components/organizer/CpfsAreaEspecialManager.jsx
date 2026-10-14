import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Plus, X, Loader2, Search, AlertTriangle, UserPlus, Check, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { formatCPF } from '@/utils/formatters';
import { validateCPF } from '@/utils/validation';
import { normalizarBusca } from '@/utils/busca';
import { AREAS_ESPECIAIS, AREA_GUIA, GUIA_TAMBEM_EM } from '@/constants/workAreas';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

/**
 * Escolha dos equipantes de UMA area especial (Guia, Inimigo, Espirito
 * Santo, Infiltrados, Familia muculmana,
 * Apresentadores, Equipe de Manutencao ou Pastor Invisivel -- ver
 * AREAS_ESPECIAIS em constants/workAreas.js).
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
 *
 * UMA AREA ESPECIAL POR PESSOA
 * ----------------------------
 * Os dez papeis atravessam o acampamento inteiro, cada um com seu roteiro,
 * todos ao mesmo tempo -- ninguem cumpre dois. "areaPorCpf" traz quem ja
 * esta em uma das outras listas, para a tela nem oferecer a pessoa.
 * Quem garante mesmo assim e o banco (ver migration 20260912t,
 * schema-update-20260916-mais-3-areas-especiais.sql e
 * schema-update-20260916b-mais-4-areas-especiais.sql); isto aqui e para o
 * organizador nao chegar a errar.
 */
const CpfsAreaEspecialManager = ({
  areaLabel,
  cpfs = [],
  equipantes = [],
  carregandoEquipantes = false,
  areaPorCpf = {},
  onSave,
  // Alocar com um clique (13/10/2026): situacaoDoCpf(cpf) -> 'na_area' (ja
  // esta escalado nesta area), 'pode' (aprovado, da para alocar agora),
  // 'nao_aprovado' ou 'sem_inscricao'; onAlocar(cpf) aloca so essa pessoa,
  // com a mesma regra do "Aplicar CPFs cadastrados". Sem eles, nada muda.
  situacaoDoCpf,
  onAlocar,
  // Areas comuns no proprio chip (13/10/2026): a pessoa da area especial pode
  // estar tambem em areas comuns. areasComunsDoCpf(cpf) -> [areas comuns em
  // que ela ja esta]; areasComunsDisponiveis -> todas as comuns;
  // onEscalarTambem(cpf, area) acrescenta sem tirar de nada.
  areasComunsDoCpf,
  areasComunsDisponiveis = [],
  onEscalarTambem,
  // Dica do "Alocar" (14/10/2026): nas areas da Recepção Igreja nao ha
  // exclusividade, entao ninguem sai de lugar nenhum.
  dicaAlocar,
  // Transferir (14/10/2026): passa a pessoa para OUTRA area especial de uma vez
  // (pre-cadastro e, se ja esta escalada, a escala tambem).
  // areasDestino -> [{ key, label }]; onTransferir(cpf, destino) -> Promise.
  areasDestino = [],
  onTransferir,
  // Na busca (14/10/2026): quem ja esta em OUTRA especial aparece dizendo onde
  // esta pre-cadastrado e onde esta escalado. Entre as AREAS_ESPECIAIS_
  // TRANSFERIVEIS, clicar no nome pergunta se quer transferir para ca.
  // escaladoEmEspecial(cpf) -> especial em que a pessoa esta escalada (ou null);
  // areasTransferiveis -> labels; onTransferirParaCa(cpf) -> Promise.
  escaladoEmEspecial,
  areasTransferiveis = [],
  onTransferirParaCa
}) => {
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(false);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [removendo, setRemovendo] = useState(null);
  const [alocando, setAlocando] = useState(null);
  const [acrescentando, setAcrescentando] = useState(null);
  const [transferindo, setTransferindo] = useState(null);
  // { eq, cpf, de, escaladoEm } -- a janela "transferir para ca?"
  const [confirmarTransf, setConfirmarTransf] = useState(null);
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

  // Quem casa com a busca, esteja ou nao ja na lista.
  const encontrados = useMemo(() => {
    const termo = normalizarBusca(busca);
    if (!termo) return [];
    const termoDigitos = soDigitos(termo);

    return (equipantes || []).filter((eq) => {
      const porNome = normalizarBusca(eq.nome).includes(termo);
      const porCpf = termoDigitos && soDigitos(eq.cpf).includes(termoDigitos);
      return porNome || porCpf;
    });
  }, [busca, equipantes]);

  // Só os que ainda dá para adicionar: fora os que já estão nesta lista e
  // fora os que já têm outro papel especial.
  const sugestoes = useMemo(
    () => encontrados
      .filter((eq) => !cpfs.includes(soDigitos(eq.cpf)))
      .filter((eq) => !areaPorCpf[soDigitos(eq.cpf)])
      .slice(0, 8),
    [encontrados, cpfs, areaPorCpf]
  );

  // Achados pela busca que estão em OUTRO papel especial. Aparecem na lista
  // dizendo onde estão, em vez de sumirem sem explicação.
  const emOutroPapel = useMemo(
    () => encontrados.filter((eq) => areaPorCpf[soDigitos(eq.cpf)]).slice(0, 6),
    [encontrados, areaPorCpf]
  );

  // Pode transferir de `de` para esta area? So entre as transferiveis.
  const podeTransferirDe = (de) => !!onTransferirParaCa &&
    areasTransferiveis.includes(areaLabel) && areasTransferiveis.includes(de);
  const escaladoEm = (cpf) => (escaladoEmEspecial ? escaladoEmEspecial(cpf) : null);
  // "pré-cadastrado em Espírito Santo · já escalado em Espírito Santo"
  const ondeEsta = (cpf) => {
    const de = areaPorCpf[cpf];
    const esc = escaladoEm(cpf);
    return [de && `pré-cadastrado em ${de}`, esc && esc !== areaLabel && `já escalado em ${esc}`].filter(Boolean).join(' · ');
  };

  const confirmarTransferencia = async () => {
    const alvo = confirmarTransf;
    setConfirmarTransf(null);
    if (!alvo || !onTransferirParaCa) return;
    setTransferindo(alvo.cpf);
    try {
      await onTransferirParaCa(alvo.cpf);
      setBusca('');
      setAberto(false);
    } finally {
      setTransferindo(null);
    }
  };

  // Quem a busca achou MAS já está nesta área. Sem isso, a pessoa some das
  // sugestões e a tela diz "ninguém encontrado" -- o organizador sabe que ela
  // existe e fica sem entender. Melhor dizer o motivo.
  const jaNaLista = useMemo(
    () => encontrados.filter((eq) => cpfs.includes(soDigitos(eq.cpf))).slice(0, 4),
    [encontrados, cpfs]
  );

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
    if (areaPorCpf[cpf]) {
      setError(`${equipante.nome} já é ${areaPorCpf[cpf]}. Cada pessoa só pode ter um desses ${AREAS_ESPECIAIS.length} papéis — tire de lá primeiro.`);
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
    if (areaPorCpf[digitos]) {
      setError(`Este CPF já está na lista de ${areaPorCpf[digitos]}. Cada pessoa só pode ter um desses ${AREAS_ESPECIAIS.length} papéis.`);
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

  // Em ordem alfabetica (13/10/2026); quem ainda nao se inscreveu vai no fim.
  const cpfsOrdenados = useMemo(() => [...cpfs].sort((a, b) => {
    const na = equipantePorCpf.get(a)?.nome; const nb = equipantePorCpf.get(b)?.nome;
    if (!na || !nb) return na ? -1 : nb ? 1 : 0;
    return na.localeCompare(nb, 'pt-BR', { sensitivity: 'base' });
  }), [cpfs, equipantePorCpf]);

  const acrescentar = async (cpf, area) => {
    if (!onEscalarTambem) return;
    setAcrescentando(cpf);
    try { await onEscalarTambem(cpf, area); } finally { setAcrescentando(null); }
  };

  const transferir = async (cpf, destino) => {
    if (!onTransferir) return;
    setTransferindo(cpf);
    try { await onTransferir(cpf, destino); } finally { setTransferindo(null); }
  };

  const alocar = async (cpf) => {
    if (!onAlocar) return;
    setAlocando(cpf);
    try { await onAlocar(cpf); } finally { setAlocando(null); }
  };

  return (
    <div className="space-y-3" ref={containerRef}>
      {cpfs.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {cpfsOrdenados.map((cpf) => {
            const pessoa = equipantePorCpf.get(cpf);
            const situacao = situacaoDoCpf ? situacaoDoCpf(cpf) : null;
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
                {situacao === 'na_area' && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300 px-1" data-dica={`Já está escalado em ${areaLabel}.`}>
                    <Check className="w-3 h-3" />escalado
                  </span>
                )}
                {situacao === 'na_area' && areasComunsDoCpf && areasComunsDoCpf(cpf)
                  // Guia na Recepção Sítio é regra (todo Guia fica lá): não precisa etiqueta.
                  .filter((a) => !(areaLabel === AREA_GUIA && a === GUIA_TAMBEM_EM))
                  .map((a) => (
                  <span key={a} className="text-[11px] px-1.5 py-0.5 rounded-full border border-sky-500/40 bg-sky-500/10 text-sky-200"
                    data-dica={`Também está escalado em ${a}.`}>
                    + {a}
                  </span>
                ))}
                {situacao === 'na_area' && onEscalarTambem && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" disabled={!!acrescentando}
                        data-dica={`Escalar esta pessoa também numa área comum, sem tirar de ${areaLabel}.`}
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-sky-600/25 text-sky-200 hover:bg-sky-600/45 disabled:opacity-50">
                        {acrescentando === cpf ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                        área comum
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="bg-neutral-900 border-white/10 text-white max-h-72 overflow-y-auto">
                      <DropdownMenuLabel className="text-xs text-gray-400 font-normal">Escalar também em:</DropdownMenuLabel>
                      {areasComunsDisponiveis
                        .filter((a) => !(areasComunsDoCpf ? areasComunsDoCpf(cpf) : []).includes(a))
                        .map((a) => (
                          <DropdownMenuItem key={a} onSelect={() => acrescentar(cpf, a)}
                            className="cursor-pointer focus:bg-white/10 focus:text-white">{a}</DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {situacao === 'pode' && onAlocar && (
                  <button
                    type="button"
                    onClick={() => alocar(cpf)}
                    disabled={!!alocando}
                    data-dica={dicaAlocar ?? `Colocar esta pessoa em ${areaLabel} agora (as áreas comuns dela continuam; só sai de outra área especial).`}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-indigo-600/30 text-indigo-200 hover:bg-indigo-600/50 disabled:opacity-50"
                  >
                    {alocando === cpf ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
                    Alocar
                  </button>
                )}
                {situacao === 'nao_aprovado' && (
                  <span className="text-[11px] text-amber-300 px-1" data-dica="A inscrição ainda não foi aprovada. Depois de aprovada, o botão Alocar aparece aqui.">
                    aguardando aprovação
                  </span>
                )}
                {onTransferir && areasDestino.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" disabled={!!transferindo || isSaving}
                        data-dica={`Passar esta pessoa de ${areaLabel} para outra área especial, de uma vez (sai daqui e entra lá).`}
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-purple-600/25 text-purple-200 hover:bg-purple-600/45 disabled:opacity-50">
                        {transferindo === cpf ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRightLeft className="w-3 h-3" />}
                        Transferir
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="bg-neutral-900 border-white/10 text-white max-h-72 overflow-y-auto">
                      <DropdownMenuLabel className="text-xs text-gray-400 font-normal">Passar de {areaLabel} para:</DropdownMenuLabel>
                      {areasDestino.filter((d) => d.label !== areaLabel).map((d) => (
                        <DropdownMenuItem key={d.key} onSelect={() => transferir(cpf, d)}
                          className="cursor-pointer focus:bg-white/10 focus:text-white">{d.label}</DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <button
                  type="button"
                  onClick={() => remover(cpf)}
                  data-dica={`Tirar esta pessoa do pré-cadastro de ${areaLabel}.`}
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
            {/* Quem ja esta em outra especial: diz onde esta pre-cadastrado e
                onde esta escalado. Entre as transferiveis, clicar pergunta se
                quer transferir para ca. */}
            {emOutroPapel.map((eq) => {
              const cpf = soDigitos(eq.cpf);
              const de = areaPorCpf[cpf];
              const onde = ondeEsta(cpf);
              return podeTransferirDe(de) ? (
                <button key={`outro-${eq.id}`} type="button"
                  onClick={() => setConfirmarTransf({ eq, cpf, de, escaladoEm: escaladoEm(cpf) })}
                  disabled={isSaving || !!transferindo}
                  data-dica={`Transferir ${eq.nome} de ${de} para ${areaLabel} (pede confirmação).`}
                  className="w-full text-left px-3 py-2 hover:bg-purple-600/15 transition-colors border-b border-white/5 disabled:opacity-50">
                  <span className="flex items-center gap-1.5 text-white text-sm font-medium">
                    {transferindo === cpf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRightLeft className="w-3.5 h-3.5 text-purple-300" />}
                    {eq.nome}
                  </span>
                  <span className="block text-xs text-amber-300">{onde}</span>
                  <span className="block text-[11px] text-purple-300">Clique para transferir para {areaLabel}</span>
                </button>
              ) : (
                <div key={`outro-${eq.id}`} className="px-3 py-2 border-b border-white/5 text-xs text-amber-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    <span className="text-white font-medium">{eq.nome}</span> — {onde}.
                    {' '}Cada pessoa só pode ter um dos {AREAS_ESPECIAIS.length} papéis especiais: tire de lá primeiro.
                  </span>
                </div>
              );
            })}
            {sugestoes.length > 0 ? (
              sugestoes.map((eq) => (
                <button
                  key={eq.id}
                  type="button"
                  onClick={() => adicionarEquipante(eq)}
                  data-dica={`Colocar este equipante no pré-cadastro de ${areaLabel}.`}
                  disabled={isSaving}
                  className="w-full text-left px-3 py-2 hover:bg-white/10 transition-colors border-b border-white/5 last:border-0 disabled:opacity-50"
                >
                  <span className="block text-white text-sm font-medium">{eq.nome}</span>
                  <span className="block text-xs text-gray-400">
                    {eq.igreja || 'sem igreja informada'}
                    {eq.status ? ` · ${eq.status}` : ''}
                  </span>
                  {escaladoEm(soDigitos(eq.cpf)) && escaladoEm(soDigitos(eq.cpf)) !== areaLabel && (
                    <span className="block text-xs text-amber-300">já escalado em {escaladoEm(soDigitos(eq.cpf))}</span>
                  )}
                </button>
              ))
            ) : (emOutroPapel.length > 0 && jaNaLista.length === 0 && !buscaEhCpfValido) ? null : (
              <div className="px-3 py-3 text-sm text-gray-400">
                {jaNaLista.length > 0 ? (
                  <span className="text-emerald-300">
                    {jaNaLista.length === 1
                      ? `${jaNaLista[0].nome} já está em ${areaLabel}.`
                      : `${jaNaLista.map((e) => e.nome).join(', ')} já estão em ${areaLabel}.`}
                  </span>
                ) : equipantes.length === 0 ? (
                  <span className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    Nenhum equipante inscrito ainda. Você pode cadastrar por CPF por enquanto.
                  </span>
                ) : emOutroPapel.length > 0 ? null : (
                  'Ninguém encontrado com esse nome.'
                )}
                {buscaEhCpfValido && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={adicionarPorCpfDigitado}
                    data-dica="Adicionar pelo CPF digitado (vale mesmo se a pessoa ainda não se inscreveu)."
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

      <AlertDialog open={!!confirmarTransf} onOpenChange={(v) => { if (!v) setConfirmarTransf(null); }}>
        <AlertDialogContent className="bg-gray-900 border-gray-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Transferir para {areaLabel}?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-300 space-y-2">
              {confirmarTransf && (
                <>
                  <span className="block"><b className="text-white">{confirmarTransf.eq.nome}</b> já está pré-cadastrado em <b className="text-white">{confirmarTransf.de}</b>
                    {confirmarTransf.escaladoEm ? <> e já está escalado em <b className="text-white">{confirmarTransf.escaladoEm}</b></> : <> (ainda não escalado)</>}.</span>
                  <span className="block">Transferindo, sai de {confirmarTransf.de} e entra em <b className="text-white">{areaLabel}</b>
                    {confirmarTransf.escaladoEm === confirmarTransf.de ? ' — a escala muda junto (atuação padrão; a cor, se a área usa, você escolhe depois)' : ''}.
                    {' '}As áreas comuns dele continuam.</span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarTransferencia} className="bg-purple-600 hover:bg-purple-700 text-white">
              Transferir para {areaLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CpfsAreaEspecialManager;
