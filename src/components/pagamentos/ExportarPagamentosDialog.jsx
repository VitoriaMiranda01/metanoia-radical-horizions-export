import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AGRUPAMENTOS, COLUNAS_PAGAMENTOS_PADRAO, catalogoPagamentos, montarExportacao,
  exportarPagamentosExcel, exportarPagamentosPdf,
} from '@/utils/exportPagamentos';

const TIPOS = [['all', 'Todos'], ['acampante', 'Acampantes'], ['equipante', 'Equipantes']];

const botaoOpcao = (ativo, onClick, children, extra = '') => (
  <button
    type="button" onClick={onClick}
    className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
      ativo ? 'border-emerald-400 bg-emerald-500/15 text-white' : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
    } ${extra}`}
  >
    {children}
  </button>
);

/**
 * Exportar (PDF ou Excel) da tela de Pagamentos: quem entra (a lista da tela ou
 * uma aba inteira), quais colunas (incluindo contato), se agrupa e se leva o
 * resumo. `fontes` = [{ chave, rotulo, itens }]; a primeira e a lista da tela.
 */
const ExportarPagamentosDialog = ({ aberto, onFechar, fontes, valorDe, onExportado }) => {
  const [fonte, setFonte] = useState('tela');
  const [tipo, setTipo] = useState('all');
  const [colunas, setColunas] = useState(COLUNAS_PAGAMENTOS_PADRAO);
  const [agrupar, setAgrupar] = useState('nenhum');
  const [resumo, setResumo] = useState(true);
  const [erro, setErro] = useState('');
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setFonte('tela');
    setTipo('all');
    setColunas(COLUNAS_PAGAMENTOS_PADRAO);
    setAgrupar('nenhum');
    setResumo(true);
    setErro('');
  }, [aberto]);

  const catalogo = useMemo(() => catalogoPagamentos(valorDe), [valorDe]);
  const grupos = useMemo(() => [...new Set(catalogo.map((c) => c.group))], [catalogo]);

  const itens = useMemo(() => {
    const base = fontes.find((f) => f.chave === fonte)?.itens || [];
    return tipo === 'all' ? base : base.filter((i) => i.tipo === tipo);
  }, [fontes, fonte, tipo]);

  const escolhidas = catalogo.filter((c) => colunas.includes(c.key));
  const alternar = (key, v) => setColunas((atual) => (v
    ? catalogo.map((c) => c.key).filter((k) => k === key || atual.includes(k))
    : atual.filter((k) => k !== key)));
  const marcarGrupo = (g, v) => setColunas((atual) => catalogo.map((c) => c.key).filter((k) => {
    const c = catalogo.find((x) => x.key === k);
    return c.group === g ? v : atual.includes(k);
  }));

  const validar = () => {
    if (escolhidas.length === 0) { setErro('Marque pelo menos uma coluna.'); return false; }
    if (itens.length === 0) { setErro('Não há ninguém nessa lista para exportar.'); return false; }
    setErro('');
    return true;
  };

  const rotuloLista = () => {
    const f = fontes.find((x) => x.chave === fonte)?.rotulo || '';
    const t = TIPOS.find(([k]) => k === tipo)?.[1];
    return tipo === 'all' ? f : `${f} · ${t}`;
  };

  const baixarExcel = async () => {
    if (!validar()) return;
    try {
      exportarPagamentosExcel(montarExportacao({ itens, colunas: escolhidas, agrupar, valorDe }), escolhidas, resumo);
      onExportado?.(itens.length, 'planilha');
      onFechar();
    } catch (e) {
      console.error('Erro ao gerar planilha de pagamentos:', e);
      setErro('Não foi possível gerar a planilha.');
    }
  };

  const baixarPdf = async () => {
    if (!validar()) return;
    setGerando(true);
    try {
      await exportarPagamentosPdf(
        montarExportacao({ itens, colunas: escolhidas, agrupar, valorDe }), escolhidas, resumo, rotuloLista(),
      );
      onExportado?.(itens.length, 'PDF');
      onFechar();
    } catch (e) {
      console.error('Erro ao gerar PDF de pagamentos:', e);
      setErro('Não foi possível gerar o PDF.');
    } finally {
      setGerando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="bg-zinc-900 border border-white/10 text-white sm:max-w-2xl max-h-[92dvh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Exportar pagamentos</DialogTitle>
          <DialogDescription className="text-gray-400">
            Escolha quem vai no arquivo e quais informações; depois baixe em PDF ou Excel.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-300 mb-2">Quem</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {fontes.map((f) => botaoOpcao(
                fonte === f.chave, () => setFonte(f.chave),
                <>
                  {f.rotulo}
                  <span className="block text-xs text-gray-400">{f.itens.length} {f.itens.length === 1 ? 'pessoa' : 'pessoas'}</span>
                </>,
                f.itens.length === 0 ? 'opacity-40' : '',
              )).map((el, i) => React.cloneElement(el, { key: fontes[i].chave }))}
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {TIPOS.map(([k, r]) => (
                <button
                  key={k} type="button" onClick={() => setTipo(k)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    tipo === k ? 'border-emerald-400 bg-emerald-500/15 text-white' : 'border-white/10 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm text-gray-300 mb-2">Colunas</p>
            <div className="space-y-3">
              {grupos.map((g) => {
                const doGrupo = catalogo.filter((c) => c.group === g);
                const todas = doGrupo.every((c) => colunas.includes(c.key));
                return (
                  <div key={g} className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs uppercase tracking-wide text-gray-400">{g}</span>
                      <button
                        type="button" onClick={() => marcarGrupo(g, !todas)}
                        className="text-xs text-emerald-400 hover:text-emerald-300"
                      >
                        {todas ? 'Desmarcar todas' : 'Marcar todas'}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                      {doGrupo.map((c) => (
                        <label key={c.key} className="flex items-center gap-2 text-sm text-gray-200 cursor-pointer">
                          <Checkbox checked={colunas.includes(c.key)} onCheckedChange={(v) => alternar(c.key, v === true)} />
                          {c.label}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-sm text-gray-300 mb-2">Organização do arquivo</p>
            <div className="flex flex-wrap gap-2">
              {AGRUPAMENTOS.map(([k, r]) => (
                <button
                  key={k} type="button" onClick={() => setAgrupar(k)}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                    agrupar === k ? 'border-emerald-400 bg-emerald-500/15 text-white' : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            {agrupar !== 'nenhum' && (
              <p className="text-xs text-gray-400 mt-1.5">Cada grupo vira uma aba no Excel e começa em página nova no PDF.</p>
            )}
          </div>

          <label className="flex items-start gap-2 text-sm text-gray-200 cursor-pointer rounded-lg border border-white/10 bg-white/5 p-3">
            <Checkbox className="mt-0.5" checked={resumo} onCheckedChange={(v) => setResumo(v === true)} />
            <span>
              Incluir <strong>Resumo</strong>
              <span className="block text-xs text-gray-400">
                Quantas pessoas e quanto foi recebido, por situação, por tipo e por forma de pagamento.
              </span>
            </span>
          </label>
        </div>

        {erro && <p className="text-sm text-red-400">{erro}</p>}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onFechar} className="text-gray-300 hover:text-white hover:bg-white/10">
            Cancelar
          </Button>
          <Button type="button" onClick={baixarPdf} disabled={itens.length === 0 || gerando}
            className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <FileText className="w-4 h-4 mr-1.5" />{gerando ? 'Gerando PDF...' : 'Baixar PDF'}
          </Button>
          <Button type="button" onClick={baixarExcel} disabled={itens.length === 0 || gerando}
            className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Download className="w-4 h-4 mr-1.5" />Baixar planilha
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExportarPagamentosDialog;
