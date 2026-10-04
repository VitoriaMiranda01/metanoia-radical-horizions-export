import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Loader2, RotateCcw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { IGREJAS_PARCEIRAS } from '@/constants/igrejas';
import { fetchRelatorioIgrejas } from '@/services/igrejasExtrasService';
import { listarContasParceiros } from '@/services/senhasParceirosService';
import { montarLinhasIgrejas } from '@/utils/igrejasCadastradas';
import { exportListaIgrejas } from '@/utils/excelExport';
import { cn } from '@/lib/utils';

/**
 * Quadro "Todas as igrejas cadastradas" (Configuracoes, pedido do Patrick em
 * 04/10/2026): as parceiras + as adicionadas pela organizacao, com o
 * responsavel de cada uma e quantos inscritos tem. Lista com busca e barra
 * de rolagem; o botao baixa a mesma lista em planilha.
 */

const semAcento = (t) => (t || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const IgrejasCadastradasManager = () => {
  const { toast } = useToast();
  const [relatorio, setRelatorio] = useState(null);
  const [contas, setContas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [exportando, setExportando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const [r, c] = await Promise.all([
        fetchRelatorioIgrejas(),
        listarContasParceiros().catch(() => []),
      ]);
      setRelatorio(r);
      setContas(Array.isArray(c) ? c : []);
    } catch (e) {
      setErro(e.message || 'Não foi possível carregar as igrejas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const linhas = useMemo(
    () => (relatorio ? montarLinhasIgrejas(IGREJAS_PARCEIRAS, relatorio, contas) : []),
    [relatorio, contas]
  );

  const termo = semAcento(busca.trim());
  const filtradas = useMemo(() => {
    if (!termo) return linhas;
    return linhas.filter((l) =>
      semAcento(`${l.codigo} ${l.nome} ${l.responsavel}`).includes(termo));
  }, [linhas, termo]);

  const adicionadas = linhas.filter((l) => !l.codigo).length;
  const comInscritos = linhas.filter((l) => l.equipantesInscritos > 0 || l.acampantes > 0).length;

  const exportar = () => {
    if (!relatorio) return;
    setExportando(true);
    try {
      const r = exportListaIgrejas(IGREJAS_PARCEIRAS, relatorio, contas);
      toast({ title: 'Planilha gerada', description: `${r.igrejas} igrejas na lista.` });
    } catch (e) {
      toast({ title: 'Não deu para exportar', description: e.message, variant: 'destructive' });
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por código, nome ou responsável..."
            className="h-9 pl-8 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
          />
        </div>
        <Button
          variant="outline" size="sm" onClick={carregar} disabled={loading}
          data-dica="Buscar a lista de novo, com os números de agora."
          className="h-9 border-white/10 bg-transparent text-gray-300 hover:bg-white/5 hover:text-white shrink-0"
        >
          <RotateCcw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} /> Atualizar
        </Button>
        <Button
          variant="outline" size="sm" onClick={exportar} disabled={!relatorio || exportando}
          data-dica="Baixar esta lista em planilha, com o responsável e os inscritos de cada igreja."
          className="h-9 border-emerald-500/40 bg-transparent text-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-200 shrink-0"
        >
          {exportando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          Exportar planilha
        </Button>
      </div>

      {!loading && !erro && (
        <p className="text-xs text-gray-500">
          {linhas.length} igrejas · {linhas.length - adicionadas} parceiras e {adicionadas} adicionadas pela
          organização · {comInscritos} com inscritos
          {termo ? ` · ${filtradas.length} na busca` : ''}
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
                <th className="text-left font-medium px-3 py-2 w-14">Cód.</th>
                <th className="text-left font-medium px-3 py-2">Igreja</th>
                <th className="text-left font-medium px-3 py-2 hidden md:table-cell">Responsável</th>
                <th className="text-right font-medium px-3 py-2" title="Equipantes inscritos (aprovados)">Equip.</th>
                <th className="text-right font-medium px-3 py-2">Acamp.</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((l) => (
                <tr key={`${l.codigo}-${l.nome}`} className="border-t border-white/5 hover:bg-white/5">
                  <td className="px-3 py-1.5 text-gray-400 tabular-nums">{l.codigo || '—'}</td>
                  <td className="px-3 py-1.5 text-white">
                    {l.nome}
                    {!l.codigo && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full border border-emerald-500/40 text-emerald-300">
                        adicionada
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-gray-400 hidden md:table-cell">{l.responsavel || '—'}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-gray-200">
                    {l.equipantesInscritos}
                    {l.equipantesInscritos > 0 && (
                      <span className="text-gray-500"> ({l.equipantesAprovados})</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-gray-200">{l.acampantes}</td>
                </tr>
              ))}
              {filtradas.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-gray-400">Nenhuma igreja bate com a busca.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-gray-500">Equip. = equipantes inscritos (entre parênteses, os aprovados).</p>
    </div>
  );
};

export default IgrejasCadastradasManager;
