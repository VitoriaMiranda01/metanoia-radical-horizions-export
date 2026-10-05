import React, { useEffect, useState } from 'react';
import { ClipboardList, Loader2, RefreshCw, Repeat, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { nomeDaIgreja } from '@/constants/igrejas';
import { formatarTelefone } from '@/utils/telefone';
import { fetchChamadaDaEscala } from '@/services/scalesService';

const ATUALIZAR_A_CADA_MS = 30000;

/**
 * Quadro da chamada da reuniao de escala (pedido do Patrick, 05/10/2026):
 * quantos presentes/ausentes/sem chamada, e a lista pequena de quem ficou
 * AUSENTE -- para os organizadores decidirem antes da escala oficial
 * (trocar de area, "Não será escalado"...). Ausente nao sai da escala
 * sozinho.
 *
 * Atualiza sozinho a cada 30s enquanto a tela esta aberta, ja que os
 * lideres fazem a chamada ao mesmo tempo, cada um no seu celular.
 */
const ChamadaQuadro = ({ resumo, recarregarTela, onTrocar }) => {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [verAreas, setVerAreas] = useState(false);

  const carregar = async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    const r = await fetchChamadaDaEscala();
    if (!silencioso) setCarregando(false);
    if (r.success) setDados(r.data);
  };

  useEffect(() => {
    const t = setInterval(() => { carregar(true); recarregarTela?.(); }, ATUALIZAR_A_CADA_MS);
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Os numeros do resumo vem da tela (situacao_escala). Quando eles mudam
  // -- uma troca de area, a chamada de um lider -- a lista acompanha na hora.
  useEffect(() => {
    carregar(dados !== null);
  }, [resumo?.presentes, resumo?.ausentes, resumo?.sem_chamada, resumo?.escalados]); // eslint-disable-line react-hooks/exhaustive-deps

  const ausentes = dados?.ausentes || [];
  const porArea = dados?.por_area || [];

  return (
    <Card className="bg-black/40 border-white/10">
      <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 border-b border-white/10">
        <div className="flex items-center gap-2 flex-1">
          <ClipboardList className="h-5 w-5 text-cyan-400 shrink-0" />
          <div>
            <h3 className="font-semibold text-white">Chamada da reunião de escala</h3>
            {resumo && (
              <p className="text-xs text-gray-400">
                <span className="text-green-400">{resumo.presentes ?? 0} presentes</span> ·{' '}
                <span className="text-red-400">{resumo.ausentes ?? 0} ausentes</span> ·{' '}
                {resumo.sem_chamada ?? 0} sem chamada
                <span className="text-gray-500"> (por área: quem está em duas áreas conta duas vezes)</span>
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setVerAreas((v) => !v)}
            data-dica="Ver quantos presentes e ausentes cada área já marcou."
            className="text-gray-300 hover:text-white hover:bg-white/10">
            {verAreas ? 'Esconder áreas' : 'Por área'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => { carregar(); recarregarTela?.(); }} disabled={carregando}
            data-dica="Buscar a chamada de novo (atualiza sozinho a cada 30 segundos)."
            className="border-white/20 bg-transparent text-gray-300 hover:bg-white/10 hover:text-white">
            {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {verAreas && (
        <div className="px-4 py-3 border-b border-white/10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1 max-h-60 overflow-y-auto">
          {porArea.map((a) => (
            <p key={a.area} className="text-xs text-gray-300 flex justify-between gap-2">
              <span className="truncate">{a.area}</span>
              <span className="shrink-0">
                <span className="text-green-400">{a.presentes}</span>
                {' / '}
                <span className="text-red-400">{a.ausentes}</span>
                {' / '}
                <span className="text-gray-500">{a.total}</span>
              </span>
            </p>
          ))}
          <p className="text-[10px] text-gray-500 sm:col-span-2 lg:col-span-3 mt-1">presentes / ausentes / total</p>
        </div>
      )}

      <div className="p-4">
        <p className="text-sm text-white font-medium flex items-center gap-2 mb-2">
          <UserX className="h-4 w-4 text-red-400" /> Ausentes ({ausentes.length})
        </p>
        {ausentes.length === 0 ? (
          <p className="text-xs text-gray-500">Ninguém marcado como ausente até agora.</p>
        ) : (
          <ul className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
            {ausentes.map((p) => (
              <li key={p.escala_id} className="flex items-center gap-3 bg-red-500/5 border border-red-500/20 rounded-md px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{p.nome}</p>
                  <p className="text-[11px] text-gray-400 truncate">
                    {p.area}{p.cor ? ` · ${p.cor}` : ''}
                    {p.whatsapp ? ` · ${formatarTelefone(p.whatsapp)}` : ''}
                    {' · '}{nomeDaIgreja(p) || '—'}
                    {p.marcado_por ? ` · marcado por ${p.marcado_por}` : ''}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => onTrocar?.(p.escala_id)}
                  data-dica="Abrir a troca de área já com esta pessoa (dá para mandar para Não será escalado)."
                  className="h-8 text-cyan-300 hover:text-white hover:bg-white/10 shrink-0">
                  <Repeat className="h-3.5 w-3.5 mr-1" /> Trocar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
};

export default ChamadaQuadro;
