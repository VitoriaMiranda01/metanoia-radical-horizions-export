import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bus, ChevronDown, ChevronRight, FileSpreadsheet, Minus, Plus, Printer } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import GrupoTrilhaTag from '@/components/common/GrupoTrilhaTag';
import { estaQuitada } from '@/services/paymentService';
import { agoraTexto, dividirEmOnibus, documentoDe, telefoneDe } from '@/utils/onibus';
import { exportarOnibusExcel, imprimirOnibus } from '@/utils/onibusImpressao';

/**
 * Listas dos onibus (Patrick, 12/10/2026). So acampantes que pagaram; os
 * grupos entram na ordem fixa das cores e, dentro do grupo, por nome.
 * O numero de onibus (e, se quiser, os lugares de cada um) e escolhido aqui.
 * Recalculada sempre que a tela abre ou algo muda -- nada fica salvo.
 * Imprimir: uma folha A4 por onibus. Excel: uma aba por onibus.
 */

const MAX_ONIBUS = 10;

const OnibusDialog = ({ isOpen, onClose, acampantes = [] }) => {
  const { toast } = useToast();
  const [numero, setNumero] = useState(4);
  const [lugares, setLugares] = useState([]);
  const [aberto, setAberto] = useState(null);
  const [geradaEm, setGeradaEm] = useState(agoraTexto());

  useEffect(() => { if (isOpen) { setAberto(null); setGeradaEm(agoraTexto()); } }, [isOpen]);

  // Infiltrados (equipantes da escala oficial, com cor) viajam disfarcados:
  // entram sempre, no grupo deles, sem nenhuma marca na folha nem no Excel.
  const pagos = useMemo(
    () => acampantes.filter((a) => a.infiltrado || estaQuitada(a.status_pagamento)),
    [acampantes]
  );
  const qtdInfiltrados = pagos.filter((a) => a.infiltrado).length;
  const naoPagos = acampantes.filter((a) => !a.infiltrado).length - (pagos.length - qtdInfiltrados);

  const { onibus, semLugar } = useMemo(
    () => dividirEmOnibus(pagos, numero, lugares.slice(0, numero)),
    [pagos, numero, lugares]
  );

  const mudarNumero = (n) => setNumero(Math.min(MAX_ONIBUS, Math.max(1, n)));
  const mudarLugar = (i, v) => setLugares((l) => {
    const novo = [...l];
    novo[i] = v.replace(/\D/g, '').slice(0, 3);
    return novo;
  });

  const imprimir = (lista) => {
    const agora = agoraTexto();
    setGeradaEm(agora);
    if (!imprimirOnibus(lista, onibus.length, agora)) {
      toast({ title: 'O navegador bloqueou a janela de impressão', description: 'Permita pop-ups para este site e tente de novo.', variant: 'destructive' });
    }
  };

  const baixarExcel = () => {
    const agora = agoraTexto();
    setGeradaEm(agora);
    try {
      exportarOnibusExcel(onibus, semLugar, agora);
    } catch (e) {
      toast({ title: 'Não foi possível gerar a planilha', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent overlayClassName="bg-black/70" className="bg-neutral-900 border-white/10 text-white sm:max-w-4xl max-h-[90vh] flex flex-col gap-3">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl"><Bus className="w-5 h-5" />Listas dos ônibus</DialogTitle>
          <DialogDescription className="text-gray-400">
            Só acampantes que pagaram: <span className="text-white font-medium">{pagos.length - qtdInfiltrados}</span>
            {qtdInfiltrados > 0 && <> + {qtdInfiltrados} {qtdInfiltrados === 1 ? 'infiltrado' : 'infiltrados'} (saem na lista como acampantes)</>}
            {naoPagos > 0 && <> · {naoPagos} {naoPagos === 1 ? 'ainda não pagou e fica' : 'ainda não pagaram e ficam'} de fora</>}.
            Os grupos entram na ordem das cores (Vermelho, Amarelo, Verde, Azul, Roxo) e, dentro do grupo, por nome.
            A divisão é refeita sempre que algo muda.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-gray-300">Número de ônibus</span>
            <div className="inline-flex items-center gap-1">
              <Button type="button" size="icon" variant="outline" aria-label="Menos um ônibus" onClick={() => mudarNumero(numero - 1)} disabled={numero <= 1}
                className="h-8 w-8 bg-white/5 border-white/10 text-gray-200 hover:bg-white/10 hover:text-white"><Minus className="w-3.5 h-3.5" /></Button>
              <span className="w-8 text-center text-lg font-semibold tabular-nums">{numero}</span>
              <Button type="button" size="icon" variant="outline" aria-label="Mais um ônibus" onClick={() => mudarNumero(numero + 1)} disabled={numero >= MAX_ONIBUS}
                className="h-8 w-8 bg-white/5 border-white/10 text-gray-200 hover:bg-white/10 hover:text-white"><Plus className="w-3.5 h-3.5" /></Button>
            </div>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button type="button" onClick={() => imprimir(onibus)} disabled={!pagos.length}
                data-dica="Abrir a folha para imprimir: uma página por ônibus, com Nº, nome, grupo, CPF, telefone e a coluna Presença."
                className="bg-blue-600 hover:bg-blue-700 text-white"><Printer className="w-4 h-4 mr-2" />Imprimir todos</Button>
              <Button type="button" variant="outline" onClick={baixarExcel} disabled={!pagos.length}
                data-dica="Baixar a planilha: uma aba de resumo e uma aba por ônibus."
                className="bg-white/5 border-white/15 text-gray-200 hover:bg-white/10 hover:text-white"><FileSpreadsheet className="w-4 h-4 mr-2" />Baixar Excel</Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-gray-400">Lugares de cada ônibus (opcional — em branco divide igual)</p>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: numero }, (_, i) => (
                <label key={i} className="inline-flex items-center gap-1.5 text-xs text-gray-300">
                  Ônibus {i + 1}
                  <Input
                    inputMode="numeric" value={lugares[i] || ''} onChange={(e) => mudarLugar(i, e.target.value)} placeholder="—"
                    className="h-8 w-16 bg-white/5 border-white/10 text-white text-center placeholder:text-gray-600"
                  />
                </label>
              ))}
            </div>
          </div>
        </div>

        {semLugar.length > 0 && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-sm text-amber-100 flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <span>Faltam {semLugar.length} {semLugar.length === 1 ? 'lugar' : 'lugares'}: os lugares informados não dão para todos. Quem sobrou vai na aba "Sem lugar" do Excel e não sai na impressão.</span>
          </div>
        )}

        <div className="flex-1 min-h-0 max-h-[55vh] overflow-y-auto pr-1 space-y-2">
          {!pagos.length && <p className="text-center py-10 text-gray-500">Nenhum acampante pagou ainda.</p>}
          {onibus.map((o) => {
            const expandido = aberto === o.numero;
            return (
              <div key={o.numero} className="rounded-lg border border-white/10 bg-white/5">
                <div className="flex flex-wrap items-center gap-2 p-3">
                  <button type="button" onClick={() => setAberto(expandido ? null : o.numero)} className="flex items-center gap-2 text-left min-w-0 flex-1" aria-expanded={expandido}>
                    {expandido ? <ChevronDown className="w-4 h-4 shrink-0 text-gray-400" /> : <ChevronRight className="w-4 h-4 shrink-0 text-gray-400" />}
                    <span className="font-semibold">Ônibus {o.numero}</span>
                    <span className="text-sm text-gray-400 tabular-nums">
                      {o.pessoas.length} acampantes{o.lugares ? ` / ${o.lugares} lugares` : ''}
                    </span>
                  </button>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {o.composicao.map((c) => (
                      <span key={c.grupo} className="inline-flex items-center gap-1 text-xs text-gray-300">
                        <GrupoTrilhaTag grupo={c.grupo === 'Sem grupo' ? null : c.grupo} className="text-[10px] px-2" />
                        {c.grupo === 'Sem grupo' && <span className="text-gray-400">Sem grupo</span>}
                        <span className="tabular-nums">{c.qtd}</span>
                      </span>
                    ))}
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={() => imprimir([o])} disabled={!o.pessoas.length}
                    data-dica={`Imprimir só a lista do ônibus ${o.numero}.`}
                    className="h-8 bg-white/5 border-white/10 text-gray-200 hover:bg-white/10 hover:text-white"><Printer className="w-3.5 h-3.5 mr-1.5" />Imprimir</Button>
                </div>
                {expandido && (
                  <div className="border-t border-white/10 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="text-gray-400">
                        <tr>
                          <th className="px-3 py-1.5 text-right w-10">Nº</th>
                          <th className="px-3 py-1.5 text-left">Nome</th>
                          <th className="px-3 py-1.5 text-left">Grupo</th>
                          <th className="px-3 py-1.5 text-left">CPF / Documento</th>
                          <th className="px-3 py-1.5 text-left">Telefone</th>
                        </tr>
                      </thead>
                      <tbody>
                        {o.pessoas.map((p, i) => (
                          <tr key={p.id} className="border-t border-white/5">
                            <td className="px-3 py-1 text-right text-gray-500 tabular-nums">{i + 1}</td>
                            <td className="px-3 py-1 text-gray-200">{p.nome}</td>
                            <td className="px-3 py-1"><GrupoTrilhaTag grupo={p.grupo_trailha} className="text-[10px] px-2" /></td>
                            <td className="px-3 py-1 text-gray-400 whitespace-nowrap">{documentoDe(p)}</td>
                            <td className="px-3 py-1 text-gray-400 whitespace-nowrap">{telefoneDe(p)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-gray-500">Calculada em {geradaEm}. A folha impressa leva a data e hora em que foi gerada.</p>
      </DialogContent>
    </Dialog>
  );
};

export default OnibusDialog;
