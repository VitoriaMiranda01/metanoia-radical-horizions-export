import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { fetchVinculosAcampantes, salvarVinculo, excluirVinculo, ignorarSugestao } from '@/services/vinculosService';
import { indexarVinculos, montarSugestoes, rotuloDoTipo, vinculosEmConflito } from '@/utils/vinculosAcampantes';

/**
 * Vinculos entre acampantes (grupos de trilha), cruzados com a lista de
 * acampantes que a tela de Gerenciar Inscricoes ja tem. So organizador.
 */
export const useVinculosAcampantes = (acampantes) => {
  const { toast } = useToast();
  const [vinculos, setVinculos] = useState([]);
  const [ignoradas, setIgnoradas] = useState(() => new Set());
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState(null);

  const recarregar = useCallback(async () => {
    const r = await fetchVinculosAcampantes();
    if (!r.success) { setErro(r.error); return; }
    setErro(null);
    setVinculos(r.vinculos);
    setIgnoradas(new Set(r.ignoradas));
    setCarregado(true);
  }, []);

  useEffect(() => { recarregar(); }, [recarregar]);

  const porId = useMemo(() => new Map((acampantes || []).map((a) => [a.id, a])), [acampantes]);

  // So vinculos dos dois lados ainda existentes na lista.
  const ativos = useMemo(
    () => vinculos.filter((v) => porId.has(v.a) && porId.has(v.b)),
    [vinculos, porId]
  );
  const porAcampante = useMemo(() => indexarVinculos(ativos), [ativos]);
  const conflitos = useMemo(() => vinculosEmConflito(ativos, porId), [ativos, porId]);

  const idsEmConflito = useMemo(() => {
    const s = new Set();
    conflitos.forEach((v) => { s.add(v.a); s.add(v.b); });
    return s;
  }, [conflitos]);

  const conflitosPorGrupo = useMemo(() => {
    const c = {};
    conflitos.forEach((v) => {
      const g = porId.get(v.a)?.grupo_trailha;
      c[g] = (c[g] || 0) + 1;
    });
    return c;
  }, [conflitos, porId]);

  const todasSugestoes = useMemo(
    () => (carregado ? montarSugestoes(acampantes || [], ativos, ignoradas, porAcampante) : []),
    [carregado, acampantes, ativos, ignoradas, porAcampante]
  );
  const sugestoes = useMemo(() => todasSugestoes.filter((s) => !s.ignorada), [todasSugestoes]);
  const sugestoesIgnoradas = useMemo(() => todasSugestoes.filter((s) => s.ignorada), [todasSugestoes]);
  const sugestaoDe = useMemo(() => new Map(todasSugestoes.map((s) => [s.acampante.id, s])), [todasSugestoes]);

  /** Quem, vinculado a acampanteId, ja esta no grupo: [{ nome, rotulo }]. */
  const avisoParaGrupo = useCallback((acampanteId, grupo) => {
    if (!grupo) return [];
    return (porAcampante.get(acampanteId) || [])
      .map((x) => ({ outro: porId.get(x.outroId), tipo: x.tipo }))
      .filter(({ outro }) => outro && outro.id !== acampanteId && outro.grupo_trailha === grupo)
      .map(({ outro, tipo }) => ({ id: outro.id, nome: outro.nome, rotulo: rotuloDoTipo(tipo) }));
  }, [porAcampante, porId]);

  const executar = useCallback(async (promessa, sucesso) => {
    const r = await promessa;
    if (!r.success) {
      toast({ title: 'Não deu certo', description: r.error, variant: 'destructive' });
    } else if (sucesso) {
      toast({ title: sucesso });
    }
    await recarregar();
    return r;
  }, [recarregar, toast]);

  const salvar = useCallback((dados, msg = 'Vínculo salvo') => executar(salvarVinculo(dados), msg), [executar]);
  // Varios de uma vez (familia de 3+): grava um por um, recarrega uma vez so.
  const salvarVarios = useCallback(async (lista) => {
    const erros = [];
    for (const dados of lista) {
      const r = await salvarVinculo(dados);
      if (!r.success) erros.push(r.error);
    }
    const salvos = lista.length - erros.length;
    if (erros.length) {
      toast({ title: `${salvos} de ${lista.length} vínculos salvos`, description: erros[0], variant: 'destructive' });
    } else {
      toast({ title: salvos === 1 ? 'Vínculo salvo' : `${salvos} vínculos salvos` });
    }
    await recarregar();
    return { success: !erros.length };
  }, [recarregar, toast]);
  const excluir = useCallback((id) => executar(excluirVinculo(id), 'Vínculo excluído'), [executar]);
  const ignorar = useCallback((acampanteId, sim = true) =>
    executar(ignorarSugestao(acampanteId, sim), sim ? 'Sugestão ignorada' : 'Sugestão de volta'), [executar]);

  return {
    carregado, erro, recarregar,
    porId, vinculos: ativos, porAcampante, conflitos, idsEmConflito, conflitosPorGrupo,
    sugestoes, sugestoesIgnoradas, sugestaoDe,
    avisoParaGrupo, salvar, salvarVarios, excluir, ignorar,
  };
};
