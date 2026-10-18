import React, { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Loader2, Search, Trash2, UserX } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { formatCPF } from '@/utils/formatters';
import { nomeDaIgreja } from '@/constants/igrejas';
import { buscarCadastrosParaExcluir, fichaParaExclusao, excluirCadastro } from '@/services/exclusaoCadastroService';
import { cn } from '@/lib/utils';

/**
 * Excluir cadastro (18/10/2026, Patrick): para os duplicados que nao saiam.
 * Busca por nome ou CPF (equipantes e acampantes), mostra TUDO da pessoa --
 * ficha, se foi inscricao manual e quem fez, onde esta escalada, PIX,
 * cadastros parecidos -- e exclui com confirmacao em duas etapas (motivo +
 * nome completo digitado + "tem certeza?"). As regras sao do banco: so
 * Desenvolvedores, Raquel e Dudu; quem ja pagou nao sai; a ficha inteira fica
 * guardada antes de apagar.
 */

const semAcento = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const dataHora = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const data = (v) => {
  if (!v) return null;
  const [a, m, d] = String(v).slice(0, 10).split('-');
  return d ? `${d}/${m}/${a}` : String(v);
};

// Nomes legiveis para os campos mais comuns da ficha.
const ROTULOS = {
  nome: 'Nome', cpf: 'CPF', data_nascimento: 'Nascimento', sexo: 'Sexo', whatsapp: 'WhatsApp', email: 'E-mail',
  igreja: 'Igreja', igreja_outra: 'Igreja (OUTRA)', cargo_igreja: 'Cargo na igreja', status: 'Aprovação',
  decidido_por: 'Decidido por', decidido_em: 'Decidido em', inscrito: 'Inscrito nesta edição', inscrito_em: 'Inscrito em',
  numero_edicao: 'Edição', status_pagamento: 'Pagamento', metodo_pagamento: 'Forma de pagamento',
  data_pagamento: 'Pago em', inscricao_manual_por: 'Inscrição manual feita por', inscricao_manual_em: 'Inscrição manual em',
  area_trabalho_opcao1: '1ª opção', area_trabalho_opcao2: '2ª opção', area_trabalho_opcao3: '3ª opção',
  created_at: 'Ficha criada em', area_vista_em: 'Viu a área em'
};

const Linha = ({ rotulo, children }) => (
  <div className="flex gap-2 text-sm py-0.5">
    <span className="text-gray-500 w-44 shrink-0">{rotulo}</span>
    <span className="text-gray-100 min-w-0 break-words">{children ?? <span className="text-gray-600">—</span>}</span>
  </div>
);

const Bloco = ({ titulo, children }) => (
  <div className="rounded-md border border-white/10 bg-white/5 p-3 space-y-1">
    <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-1">{titulo}</p>
    {children}
  </div>
);

const ExcluirCadastroCard = () => {
  const { toast } = useToast();
  const [busca, setBusca] = useState('');
  const [itens, setItens] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [aberto, setAberto] = useState(null); // { tipo, id }
  const [ficha, setFicha] = useState(null);
  const [carregandoFicha, setCarregandoFicha] = useState(false);
  const [verTudo, setVerTudo] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [perguntando, setPerguntando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [versao, setVersao] = useState(0);

  // Busca: espera a pessoa parar de digitar.
  useEffect(() => {
    const t = busca.trim();
    if (t.length < 3) { setItens([]); return undefined; }
    let vivo = true;
    const timer = setTimeout(async () => {
      setBuscando(true);
      const r = await buscarCadastrosParaExcluir(t);
      if (!vivo) return;
      setBuscando(false);
      setItens(r.ok ? (r.itens || []) : []);
      if (!r.ok) toast({ title: 'Não deu para buscar', description: r.erro, variant: 'destructive' });
    }, 400);
    return () => { vivo = false; clearTimeout(timer); };
  }, [busca, versao, toast]);

  const abrir = async (tipo, id) => {
    setAberto({ tipo, id });
    setFicha(null);
    setVerTudo(false);
    setMotivo('');
    setConfirmacao('');
    setCarregandoFicha(true);
    const r = await fichaParaExclusao(tipo, id);
    setCarregandoFicha(false);
    if (!r.ok) {
      toast({ title: 'Não deu para abrir a ficha', description: r.erro, variant: 'destructive' });
      setAberto(null);
      return;
    }
    setFicha(r);
  };

  const f = ficha?.ficha || {};
  const nomeConfere = !!f.nome && semAcento(confirmacao) === semAcento(f.nome);
  const podeConfirmar = ficha?.pode_excluir && !ficha?.pago && nomeConfere && motivo.trim().length >= 3;

  const executar = async () => {
    setExcluindo(true);
    const r = await excluirCadastro(ficha.tipo, ficha.id, confirmacao, motivo);
    setExcluindo(false);
    setPerguntando(false);
    if (!r.ok) {
      toast({ title: 'Não foi excluído', description: r.erro, variant: 'destructive' });
      return;
    }
    toast({ title: `Cadastro de ${r.nome} excluído`, description: 'A ficha ficou guardada no registro de exclusões.', className: 'bg-emerald-600 text-white' });
    setAberto(null);
    setFicha(null);
    setVersao((v) => v + 1);
  };

  const outrosCampos = Object.keys(f)
    .filter((k) => f[k] !== null && f[k] !== '' && !(Array.isArray(f[k]) && f[k].length === 0))
    .sort((a, b) => (ROTULOS[a] ? 0 : 1) - (ROTULOS[b] ? 0 : 1) || a.localeCompare(b));

  return (
    <Card className="glass-effect border-red-500/20 bg-black/40">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-white">
          <UserX className="w-5 h-5 text-red-400" />
          <span>Excluir cadastro</span>
        </CardTitle>
        <CardDescription className="text-gray-400">
          Para cadastros duplicados ou feitos por engano. Busque pelo nome ou CPF, confira tudo da pessoa e exclua.
          Quem já pagou não pode ser excluído (desfaça o pagamento antes). Só Desenvolvedores, Raquel e Dudu excluem,
          e a ficha inteira fica guardada no registro de exclusões.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou CPF (pelo menos 3 letras ou números)"
            className="pl-9 h-10 bg-white/5 border-white/10 text-white" />
          {buscando && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />}
        </div>

        {busca.trim().length >= 3 && !buscando && itens.length === 0 && (
          <p className="text-sm text-gray-500">Nenhum cadastro encontrado.</p>
        )}

        {itens.length > 0 && (
          <ul className="space-y-1.5 max-h-80 overflow-y-auto">
            {itens.map((p) => {
              const ativo = aberto?.id === p.id;
              return (
                <li key={`${p.tipo}-${p.id}`}>
                  <button type="button" onClick={() => abrir(p.tipo, p.id)}
                    className={cn('w-full text-left rounded-md border px-3 py-2',
                      ativo ? 'border-red-500/50 bg-red-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10')}>
                    <span className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-medium">{p.nome}</span>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded border',
                        p.tipo === 'acampante' ? 'border-green-500/30 text-green-300' : 'border-red-500/30 text-red-300')}>{p.tipo}</span>
                      {p.manual_por && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-200 border border-purple-500/30">Inscrição manual · {p.manual_por}</span>}
                      {p.pago && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">pagou</span>}
                      {p.tipo === 'equipante' && p.inscrito === false && <span className="text-[10px] text-gray-500">edição anterior</span>}
                    </span>
                    <span className="block text-xs text-gray-400">
                      {p.cpf ? `CPF ${formatCPF(p.cpf)}` : 'sem CPF'} · {nomeDaIgreja(p) || 'igreja não informada'}
                      {p.status ? ` · ${p.status}` : ''}
                    </span>
                    {p.areas?.length > 0 && <span className="block text-xs text-green-300/80">Escala: {p.areas.join(', ')}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {aberto && (
          <div className="rounded-lg border border-red-500/30 bg-black/40 p-4 space-y-3">
            {carregandoFicha || !ficha ? (
              <p className="text-gray-400 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Abrindo a ficha...</p>
            ) : (
              <>
                <div className="flex items-start gap-2 flex-wrap">
                  <h4 className="text-lg font-bold text-white flex-1 min-w-0">{f.nome}</h4>
                  <span className="text-xs text-gray-400">{ficha.tipo}</span>
                </div>

                <div className="grid lg:grid-cols-2 gap-3">
                  <Bloco titulo="Ficha">
                    <Linha rotulo="CPF">{f.cpf ? formatCPF(f.cpf) : 'sem CPF'}</Linha>
                    <Linha rotulo="Nascimento">{data(f.data_nascimento)}</Linha>
                    <Linha rotulo="Sexo">{f.sexo}</Linha>
                    <Linha rotulo="WhatsApp">{f.whatsapp}</Linha>
                    <Linha rotulo="Igreja">{nomeDaIgreja(f)}</Linha>
                    {ficha.tipo === 'equipante' && <Linha rotulo="Aprovação">{f.status}{f.decidido_por ? ` · por ${f.decidido_por}` : ''}</Linha>}
                    <Linha rotulo="Inscrito em">{dataHora(f.inscrito_em || f.created_at)}</Linha>
                    {ficha.tipo === 'equipante' && <Linha rotulo="Edição">{f.numero_edicao}{f.inscrito === false ? ' (não inscrito nesta edição)' : ''}</Linha>}
                  </Bloco>

                  <Bloco titulo="Como entrou no sistema">
                    {f.inscricao_manual_por
                      ? <Linha rotulo="Inscrição manual">feita por <strong>{f.inscricao_manual_por}</strong> em {dataHora(f.inscricao_manual_em)}</Linha>
                      : <Linha rotulo="Inscrição">pelo link (o próprio inscrito)</Linha>}
                    <Linha rotulo="Pagamento">
                      {ficha.pago
                        ? <span className="text-emerald-300">confirmado{f.data_pagamento ? ` em ${dataHora(f.data_pagamento)}` : ''}</span>
                        : (f.status_pagamento || 'pendente')}
                      {f.metodo_pagamento ? ` · ${f.metodo_pagamento}` : ''}
                    </Linha>
                    {ficha.pix?.length > 0 && (
                      <Linha rotulo="Cobranças PIX">{ficha.pix.map((x) => `R$ ${x.valor} (${x.status})`).join(', ')}</Linha>
                    )}
                    {ficha.pedidos_acesso > 0 && <Linha rotulo="Pedidos de acesso">{ficha.pedidos_acesso}</Linha>}
                    {ficha.vinculos > 0 && <Linha rotulo="Vínculos de grupo">{ficha.vinculos}</Linha>}
                  </Bloco>

                  {ficha.tipo === 'equipante' && (
                    <Bloco titulo="Escala">
                      <Linha rotulo="Opções da inscrição">
                        {[f.area_trabalho_opcao1, f.area_trabalho_opcao2, f.area_trabalho_opcao3].map((o, i) => `${i + 1}ª ${o || '—'}`).join(' · ')}
                      </Linha>
                      <Linha rotulo="Alocado em">
                        {ficha.escalas.length === 0 ? 'nenhuma área'
                          : ficha.escalas.map((e) => `${e.area}${e.atuacao && e.atuacao !== e.area ? ` · ${e.atuacao}` : ''}${e.cor ? ` · ${e.cor}` : ''}`).join(' | ')}
                      </Linha>
                      {ficha.areas_fixas.length > 0 && <Linha rotulo="Fixo 📌 em">{ficha.areas_fixas.join(', ')}</Linha>}
                      {ficha.responsavel_reuniao_de.length > 0 && <Linha rotulo="Responsável pela reunião">{ficha.responsavel_reuniao_de.join(', ')}</Linha>}
                      {ficha.lider_area_extra.length > 0 && <Linha rotulo="Líder de área extra">{ficha.lider_area_extra.join(', ')}</Linha>}
                      {ficha.areas_extras.length > 0 && <Linha rotulo="Áreas extras">{ficha.areas_extras.map((x) => `${x.area}${x.aprovado ? ' (aprovado)' : ''}`).join(', ')}</Linha>}
                    </Bloco>
                  )}

                  <Bloco titulo={`Cadastros parecidos (${ficha.parecidos.length})`}>
                    {ficha.parecidos.length === 0 ? <p className="text-sm text-gray-500">Nenhum outro cadastro com o mesmo nome ou CPF.</p>
                      : ficha.parecidos.map((p) => (
                        <button key={p.id} type="button" onClick={() => abrir(p.tipo, p.id)}
                          className="w-full text-left rounded px-2 py-1.5 hover:bg-white/10 text-sm">
                          <span className="text-white">{p.nome}</span>
                          <span className="text-gray-400"> · {p.tipo} · {p.cpf ? formatCPF(p.cpf) : 'sem CPF'} · {p.igreja || '—'}</span>
                          {p.manual_por && <span className="text-purple-300"> · manual ({p.manual_por})</span>}
                          {p.areas?.length > 0 && <span className="text-green-300/80"> · {p.areas.join(', ')}</span>}
                        </button>
                      ))}
                  </Bloco>
                </div>

                <button type="button" onClick={() => setVerTudo((v) => !v)}
                  className="text-xs text-sky-300 hover:text-sky-200 flex items-center gap-1">
                  {verTudo ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  {verTudo ? 'Esconder a ficha completa' : 'Ver a ficha completa (todos os campos)'}
                </button>
                {verTudo && (
                  <div className="rounded-md border border-white/10 bg-black/40 p-3 max-h-80 overflow-y-auto">
                    {outrosCampos.map((k) => (
                      <Linha key={k} rotulo={ROTULOS[k] || k}>
                        {typeof f[k] === 'object' ? JSON.stringify(f[k]) : String(f[k])}
                      </Linha>
                    ))}
                  </div>
                )}

                <div className="rounded-md border border-red-500/40 bg-red-500/5 p-3 space-y-3">
                  <p className="text-sm text-red-200 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      Excluir apaga a ficha{ficha.tipo === 'equipante' ? ', as áreas em que está escalado, as marcas de fixo e de responsável' : ''} e
                      as cobranças PIX não pagas. Não tem volta pela tela (a ficha fica guardada no registro de exclusões).
                    </span>
                  </p>
                  {ficha.pago ? (
                    <p className="text-sm text-amber-200">Este cadastro já tem pagamento confirmado: desfaça o pagamento em Pagamentos antes de excluir.</p>
                  ) : !ficha.pode_excluir ? (
                    <p className="text-sm text-amber-200">Só Desenvolvedores, Raquel e Dudu podem excluir cadastros.</p>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-gray-300">Motivo</Label>
                        <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: duplicado da inscrição pelo site"
                          className="bg-black/40 border-white/20 text-white" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-gray-300">Para confirmar, digite o nome completo: <strong className="text-white">{f.nome}</strong></Label>
                        <Input value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} placeholder="Nome completo"
                          className={cn('bg-black/40 text-white', confirmacao && !nomeConfere ? 'border-red-500/60' : 'border-white/20')} />
                      </div>
                      <Button onClick={() => setPerguntando(true)} disabled={!podeConfirmar}
                        className="bg-red-600 hover:bg-red-700 text-white">
                        <Trash2 className="h-4 w-4 mr-1.5" /> Excluir este cadastro
                      </Button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>

      <AlertDialog open={perguntando} onOpenChange={(v) => { if (!excluindo) setPerguntando(v); }}>
        <AlertDialogContent className="bg-gray-900 border-gray-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir o cadastro de {f.nome}?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              {ficha?.tipo === 'equipante' && ficha?.escalas?.length > 0
                ? `Esta pessoa sai também da escala (${ficha.escalas.map((e) => e.area).join(', ')}). `
                : ''}
              Motivo: “{motivo.trim()}”. Esta ação não pode ser desfeita pela tela.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo} className="bg-transparent border-gray-700 text-white hover:bg-gray-800">Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); executar(); }} disabled={excluindo}
              className="bg-red-600 hover:bg-red-700 text-white">
              {excluindo ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sim, excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default ExcluirCadastroCard;
