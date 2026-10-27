import React, { useEffect, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { COLUNAS_SAUDE, COLUNAS_SAUDE_PADRAO } from '@/utils/saudeColunas';
import { agruparTermos } from '@/utils/saude';
import { exportSaudeToExcel, exportSaudePorGrupoToExcel } from '@/utils/excelExport';
import { GROUPS } from '@/utils/gruposTrailha';
import { exportarSaudePdf } from '@/utils/saudePdf';

const TIPOS_RESUMO = [
  ['problema', 'Problema de saúde'],
  ['medicamento', 'Medicamento'],
  ['alimento', 'Restrição alimentar'],
];

/**
 * Exportar (Excel ou PDF) da tela da saude: quem (marcados ou a lista da tela), quais
 * colunas, e se vai a aba "Resumo" (quantos por problema/remedio/alimento).
 */
// Colunas da saude: desmarcar pede confirmacao (27/10/2026, Patrick).
const COLUNAS_IMPORTANTES = ['problema', 'medicamento', 'alimento'];

const ExportarSaudeDialog = ({ aberto, onFechar, visiveis, selecionados, onExportado }) => {
  const [quem, setQuem] = useState('tela');
  const [colunas, setColunas] = useState(COLUNAS_SAUDE_PADRAO);
  const [resumo, setResumo] = useState(true);
  const [porGrupo, setPorGrupo] = useState(false);
  const [cores, setCores] = useState([...GROUPS, 'Sem grupo']);
  const [erro, setErro] = useState('');
  const [desmarcando, setDesmarcando] = useState(null); // chave aguardando confirmacao
  const [gerandoPdf, setGerandoPdf] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setQuem(selecionados.length > 0 ? 'marcados' : 'tela');
    setErro('');
    setColunas(COLUNAS_SAUDE_PADRAO);
    setDesmarcando(null);
    setCores([...GROUPS, 'Sem grupo']);
  }, [aberto]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ordem alfabetica -- igual a tela.
  const pessoas = [...(quem === 'marcados' ? selecionados : visiveis)]
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));

  const doGrupo = (p, nome) => (nome === 'Sem grupo' ? !GROUPS.includes(p.grupo_trailha) : p.grupo_trailha === nome);
  // Cores oferecidas: as 5 de sempre; "Sem grupo" so se alguem da lista estiver sem grupo.
  const coresOferecidas = [...GROUPS, ...(pessoas.some((p) => doGrupo(p, 'Sem grupo')) ? ['Sem grupo'] : [])];
  const coresAtivas = coresOferecidas.filter((c) => cores.includes(c));
  // O que vai no arquivo: com "por grupo", so as cores marcadas.
  const pessoasArquivo = porGrupo ? pessoas.filter((p) => coresAtivas.some((c) => doGrupo(p, c))) : pessoas;
  const semCor = porGrupo && coresAtivas.length === 0;

  const alternar = (chave, v) =>
    setColunas((atual) => (v ? COLUNAS_SAUDE.map((c) => c.chave).filter((k) => k === chave || atual.includes(k))
      : atual.filter((k) => k !== chave)));

  const montarResumo = () => {
    const porId = new Map(pessoas.map((p) => [p.id, p]));
    return resumo
      ? TIPOS_RESUMO.flatMap(([tipo, rotulo]) => agruparTermos(pessoas, tipo).map((g) => ({
        Tipo: rotulo,
        Item: g.rotulo,
        Quantidade: g.ids.size,
        Pessoas: [...g.ids].map((id) => porId.get(id).nome).join(', '),
      })))
      : null;
  };

  const baixar = async () => {
    if (colunas.length === 0) { setErro('Marque pelo menos uma coluna.'); return; }
    if (semCor) { setErro('Marque pelo menos uma cor.'); return; }
    const escolhidas = COLUNAS_SAUDE.filter((c) => colunas.includes(c.chave));
    if (porGrupo) {
      const grupos = coresAtivas
        .map((nome) => {
          const lista = pessoas.filter((p) => doGrupo(p, nome));
          const porId = new Map(lista.map((p) => [p.id, p]));
          return {
            nome,
            linhas: lista.map((p) => Object.fromEntries(escolhidas.map((c) => [c.rotulo, c.valor(p)]))),
            resumo: TIPOS_RESUMO.flatMap(([tipo, rotulo]) => agruparTermos(lista, tipo).map((g) => ({
              Tipo: rotulo,
              Item: g.rotulo,
              Quantidade: g.ids.size,
              Pessoas: [...g.ids].map((id) => porId.get(id).nome).join(', '),
            }))),
          };
        })
        .filter((g) => g.linhas.length > 0);
      const r = await exportSaudePorGrupoToExcel(grupos);
      if (!r.success) { setErro(r.error || 'Não foi possível gerar a planilha.'); return; }
      onExportado?.(pessoasArquivo.length);
      onFechar();
      return;
    }
    const linhas = pessoas.map((p) => Object.fromEntries(escolhidas.map((c) => [c.rotulo, c.valor(p)])));
    const r = await exportSaudeToExcel(linhas, montarResumo());
    if (!r.success) { setErro(r.error || 'Não foi possível gerar a planilha.'); return; }
    onExportado?.(linhas.length);
    onFechar();
  };

  const baixarPdf = async () => {
    if (colunas.length === 0) { setErro('Marque pelo menos uma coluna.'); return; }
    if (semCor) { setErro('Marque pelo menos uma cor.'); return; }
    setErro('');
    setGerandoPdf(true);
    try {
      const escolhidas = COLUNAS_SAUDE.filter((c) => colunas.includes(c.chave));
      await exportarSaudePdf(pessoasArquivo, escolhidas, montarResumo(), porGrupo);
      onExportado?.(pessoasArquivo.length);
      onFechar();
    } catch (e) {
      console.error('Erro ao gerar PDF da saúde:', e);
      setErro('Não foi possível gerar o PDF.');
    } finally {
      setGerandoPdf(false);
    }
  };

  const opcao = (valor, rotulo, n, desabilitada) => (
    <button
      type="button" disabled={desabilitada} onClick={() => setQuem(valor)}
      className={`flex-1 rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:opacity-40 ${
        quem === valor ? 'border-emerald-400 bg-emerald-500/15 text-white' : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
      }`}
    >
      {rotulo}
      <span className="block text-xs text-gray-400">{n} {n === 1 ? 'acampante' : 'acampantes'}</span>
    </button>
  );

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="bg-zinc-900 border border-white/10 text-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Exportar</DialogTitle>
          <DialogDescription className="text-gray-400">
            Escolha quem vai no arquivo e quais informações; depois baixe em PDF ou Excel.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            {opcao('tela', 'A lista da tela', visiveis.length, visiveis.length === 0)}
            {opcao('marcados', 'Só os marcados', selecionados.length, selecionados.length === 0)}
          </div>

          <div>
            <p className="text-sm text-gray-300 mb-2">Colunas</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {COLUNAS_SAUDE.map((c) => (
                <label key={c.chave} className="flex items-center gap-2 text-sm text-gray-200 cursor-pointer">
                  <Checkbox checked={colunas.includes(c.chave)} onCheckedChange={(v) => {
                    if (v !== true && COLUNAS_IMPORTANTES.includes(c.chave)) setDesmarcando(c.chave);
                    else alternar(c.chave, v === true);
                  }} />
                  {c.rotulo}
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-start gap-2 text-sm text-gray-200 cursor-pointer rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
            <Checkbox className="mt-0.5" checked={porGrupo} onCheckedChange={(v) => setPorGrupo(v === true)} />
            <span>
              Separar por <strong>grupo de trilha</strong> (uma folha por cor)
              <span className="block text-xs text-gray-400">
                Cada cor começa em página nova (PDF) ou aba própria (Excel), com as patologias do grupo no topo, para a mochila do enfermeiro. No fim, a base da saúde com as patologias de cada cor.
              </span>
            </span>
          </label>

          {porGrupo && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-sm text-gray-300 mb-2">Cores</p>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {coresOferecidas.map((c) => (
                  <label key={c} className="flex items-center gap-2 text-sm text-gray-200 cursor-pointer">
                    <Checkbox
                      checked={cores.includes(c)}
                      onCheckedChange={(v) => setCores((atual) => (v === true ? [...atual, c] : atual.filter((x) => x !== c)))}
                    />
                    {c}
                    <span className="text-xs text-gray-400">({pessoas.filter((p) => doGrupo(p, c)).length})</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <label className="flex items-start gap-2 text-sm text-gray-200 cursor-pointer rounded-lg border border-white/10 bg-white/5 p-3">
            <Checkbox className="mt-0.5" checked={resumo} onCheckedChange={(v) => setResumo(v === true)} />
            <span>
              Incluir aba <strong>Resumo</strong>
              <span className="block text-xs text-gray-400">
                Quantas pessoas por problema de saúde, medicamento e restrição alimentar, com os nomes.
              </span>
            </span>
          </label>
        </div>

        {erro && <p className="text-sm text-red-400">{erro}</p>}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onFechar} className="text-gray-300 hover:text-white hover:bg-white/10">
            Cancelar
          </Button>
          <Button type="button" onClick={baixarPdf} disabled={pessoas.length === 0 || gerandoPdf}
            className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <FileText className="w-4 h-4 mr-1.5" />{gerandoPdf ? 'Gerando PDF...' : 'Baixar PDF'}
          </Button>
          <Button type="button" onClick={baixar} disabled={pessoas.length === 0 || gerandoPdf}
            className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Download className="w-4 h-4 mr-1.5" />Baixar planilha
          </Button>
        </div>
      </DialogContent>

      <AlertDialog open={!!desmarcando} onOpenChange={(v) => !v && setDesmarcando(null)}>
        <AlertDialogContent className="bg-zinc-900 border border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza que deseja desmarcar?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              {COLUNAS_SAUDE.find((c) => c.chave === desmarcando)?.rotulo} é uma informação importante da saúde.
              Sem ela, o arquivo vai sair sem esse dado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/10 border-white/10 text-white hover:bg-white/20">Manter marcado</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => { alternar(desmarcando, false); setDesmarcando(null); }}
            >
              Desmarcar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};

export default ExportarSaudeDialog;
