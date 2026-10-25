import React, { useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import NomeComBandeira from '@/components/common/NomeComBandeira';
import { AREA_SO_DOMINGO } from '@/components/common/TagSoDomingo';
import { nomeDaIgreja } from '@/constants/igrejas';
import { estaQuitada } from '@/services/paymentService';

/**
 * "Vão somente no domingo" (20261025c): os aprovados que vao so no domingo.
 * Nao e uma area da escala -- ninguem aloca, troca ou tira daqui; a pessoa
 * cai aqui sozinha ao ser aprovada. Nao sai na escala oficial; sai no
 * Exportar > Por área.
 */
const CHAVE = 'so_domingo_quadro_minimizado';
const semAcento = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const lerMinimizado = () => {
  try { return localStorage.getItem(CHAVE) === '1'; } catch (_) { return false; }
};

const SoDomingoQuadro = ({ pessoas }) => {
  const [minimizado, setMinimizado] = useState(lerMinimizado);
  const [busca, setBusca] = useState('');

  const alternar = () => setMinimizado((m) => {
    try { localStorage.setItem(CHAVE, m ? '0' : '1'); } catch (_) { /* sem armazenamento */ }
    return !m;
  });

  const ordenadas = useMemo(
    () => [...pessoas].sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR')),
    [pessoas]
  );
  const termo = semAcento(busca.trim());
  const mostradas = termo
    ? ordenadas.filter((p) => semAcento(`${p.nome} ${nomeDaIgreja(p) || ''} ${p.whatsapp || ''}`).includes(termo))
    : ordenadas;
  const pagos = pessoas.filter((p) => estaQuitada(p.status_pagamento)).length;

  return (
    <Card className="bg-orange-900/10 border-orange-500/30">
      <div className={`p-3 sm:p-4 flex flex-wrap items-center gap-x-3 gap-y-2 ${minimizado ? '' : 'border-b border-orange-500/20'}`}>
        <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
          <CalendarDays className="text-orange-300 h-5 w-5 shrink-0" />
          <h3 className="font-semibold text-white">{AREA_SO_DOMINGO} ({pessoas.length})</h3>
          <span className="text-xs text-orange-200/80">{pagos} {pagos === 1 ? 'pago' : 'pagos'} · fora da escala oficial · sai no Exportar › Por área</span>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={alternar}
          className="h-8 px-2 text-orange-200 hover:text-white hover:bg-white/10">
          {minimizado ? <ChevronDown className="h-4 w-4 mr-1" /> : <ChevronUp className="h-4 w-4 mr-1" />}
          <span className="text-xs">{minimizado ? 'Mostrar' : 'Minimizar'}</span>
        </Button>
      </div>
      {!minimizado && (
        <div className="p-3 sm:p-4 space-y-3">
          {pessoas.length > 8 && (
            <div className="relative max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome, igreja ou telefone"
                className="h-9 pl-8 bg-black/40 border-white/20 text-white" />
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-white/10">
                  <th className="py-1.5 pr-3 font-medium">Nome</th>
                  <th className="py-1.5 pr-3 font-medium">Igreja</th>
                  <th className="py-1.5 pr-3 font-medium">WhatsApp</th>
                  <th className="py-1.5 font-medium">Taxa</th>
                </tr>
              </thead>
              <tbody>
                {mostradas.map((p) => (
                  <tr key={p.id} className="border-b border-white/5 text-gray-200">
                    <td className="py-1.5 pr-3 text-white"><NomeComBandeira nome={p.nome} nacionalidade={p.nacionalidade} /></td>
                    <td className="py-1.5 pr-3">{nomeDaIgreja(p) || '—'}</td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">{p.whatsapp || '—'}</td>
                    <td className="py-1.5">
                      {estaQuitada(p.status_pagamento)
                        ? <span className="text-emerald-300">Pago</span>
                        : <span className="text-amber-300">Em aberto</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {mostradas.length === 0 && <p className="text-sm text-gray-500 text-center py-4">Nada encontrado.</p>}
          </div>
        </div>
      )}
    </Card>
  );
};

export default SoDomingoQuadro;
