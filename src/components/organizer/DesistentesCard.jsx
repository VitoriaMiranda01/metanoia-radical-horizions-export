import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RotateCcw, Search, Trash2, UserMinus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { formatCPF } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import { listarDesistentes, restaurarDesistente, apagarDesistente } from '@/services/desistenciaService';

/**
 * Acampantes que desistiram (20/10/2026, Patrick). Quem sai pelo botao
 * Remover -> "desistiu da edicao" fica aqui: some de todas as telas, mas da
 * para restaurar (mesma edicao) ou apagar de vez. O banco apaga sozinho 180
 * dias depois da inscricao (aviso de LGPD do formulario).
 */
const semAcento = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const dataHora = (v) => (v ? new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const data = (v) => (v ? new Date(v).toLocaleDateString('pt-BR') : '—');

const Linha = ({ item, edicaoAtual, onFeito }) => {
  const { toast } = useToast();
  const [restaurando, setRestaurando] = useState(false);
  const [apagando, setApagando] = useState(false);
  const [abrirApagar, setAbrirApagar] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [confirmacao, setConfirmacao] = useState('');

  const outraEdicao = item.numero_edicao !== edicaoAtual;
  const motivoSemRestaurar = item.cpf_ativo
    ? 'Já se inscreveu de novo.'
    : outraEdicao ? 'Desistiu em outra edição: só se inscrevendo de novo.' : null;
  const nomeConfere = semAcento(confirmacao) === semAcento(item.nome);

  const restaurar = async () => {
    setRestaurando(true);
    const r = await restaurarDesistente(item.id);
    setRestaurando(false);
    if (!r.ok) { toast({ title: 'Não restaurou', description: r.erro, variant: 'destructive' }); return; }
    toast({ title: `${r.nome} voltou para a inscrição`, description: 'Aparece de novo em Gerenciar Inscrições.' });
    onFeito();
  };

  const apagar = async () => {
    setApagando(true);
    const r = await apagarDesistente(item.id, confirmacao, motivo.trim());
    setApagando(false);
    if (!r.ok) { toast({ title: 'Não apagou', description: r.erro, variant: 'destructive' }); return; }
    toast({ title: `Dados de ${r.nome} apagados`, description: 'Não ficou nada desta pessoa no sistema.' });
    onFeito();
  };

  return (
    <li className="rounded-md border border-white/10 bg-white/5 p-3 space-y-2">
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium">{item.nome}</p>
          <p className="text-xs text-gray-400">
            {item.cpf ? `CPF ${formatCPF(item.cpf)}` : 'sem CPF'} · {item.igreja || 'igreja não informada'}
            {item.whatsapp ? ` · ${item.whatsapp}` : ''}
          </p>
          <p className="text-xs text-gray-400">
            Desistiu em {dataHora(item.desistiu_em)}{item.desistiu_por ? ` · por ${item.desistiu_por}` : ''}
            {item.numero_edicao ? ` · ${item.numero_edicao}ª edição` : ''} · apagado em {data(item.apaga_em)}
          </p>
          {item.observacao && <p className="text-xs text-amber-200/90">“{item.observacao}”</p>}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={restaurar} disabled={!!motivoSemRestaurar || restaurando}
            data-dica={motivoSemRestaurar || 'Volta para a inscrição, com a cobrança e os vínculos.'}
            className="bg-transparent border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10">
            {restaurando ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RotateCcw className="h-4 w-4 mr-1" /> Restaurar</>}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAbrirApagar((v) => !v)}
            className="bg-transparent border-red-500/40 text-red-300 hover:bg-red-500/10">
            <Trash2 className="h-4 w-4 mr-1" /> Apagar de vez
          </Button>
        </div>
      </div>
      {motivoSemRestaurar && <p className="text-[11px] text-gray-500">{motivoSemRestaurar}</p>}
      {abrirApagar && (
        <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 space-y-2">
          <p className="text-sm text-red-200">Retira todos os dados desta pessoa do sistema. Não tem volta.</p>
          <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200}
            placeholder="Motivo (ex.: pediu a exclusão dos dados)" className="bg-black/40 border-white/20 text-white" />
          <Input value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)}
            placeholder={`Digite o nome completo: ${item.nome}`}
            className={cn('bg-black/40 text-white', confirmacao && !nomeConfere ? 'border-red-500/60' : 'border-white/20')} />
          <Button size="sm" onClick={apagar} disabled={apagando || !nomeConfere || motivo.trim().length < 3}
            className="bg-red-600 hover:bg-red-700 text-white">
            {apagando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apagar todos os dados'}
          </Button>
        </div>
      )}
    </li>
  );
};

const DesistentesCard = () => {
  const { toast } = useToast();
  const [itens, setItens] = useState([]);
  const [edicaoAtual, setEdicaoAtual] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    const r = await listarDesistentes();
    setCarregando(false);
    if (!r.ok) { toast({ title: 'Não deu para carregar os desistentes', description: r.erro, variant: 'destructive' }); return; }
    setItens(r.itens || []);
    setEdicaoAtual(r.edicao_atual);
  }, [toast]);

  useEffect(() => { carregar(); }, [carregar]);

  const filtrados = useMemo(() => {
    const t = semAcento(busca);
    const d = busca.replace(/\D/g, '');
    if (!t) return itens;
    return itens.filter((i) => semAcento(i.nome).includes(t) || (d.length >= 3 && String(i.cpf || '').includes(d)));
  }, [itens, busca]);

  return (
    <Card className="glass-effect border-amber-500/20 bg-black/40">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-white">
          <UserMinus className="w-5 h-5 text-amber-400" />
          <span>Acampantes que desistiram ({itens.length})</span>
        </CardTitle>
        <CardDescription className="text-gray-400">
          Quem saiu pelo botão Remover → “desistiu da edição”. Não aparece em nenhuma outra tela. Dá para restaurar
          na mesma edição ou apagar de vez. Os dados são apagados sozinhos 180 dias depois da inscrição (aviso de
          privacidade do formulário).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {itens.length > 5 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou CPF"
              className="pl-9 h-10 bg-white/5 border-white/10 text-white" />
          </div>
        )}
        {carregando ? (
          <p className="text-gray-400 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</p>
        ) : filtrados.length === 0 ? (
          <p className="text-sm text-gray-500">{itens.length === 0 ? 'Nenhum acampante desistiu.' : 'Ninguém com esse nome ou CPF.'}</p>
        ) : (
          <ul className="space-y-2 max-h-[32rem] overflow-y-auto">
            {filtrados.map((i) => <Linha key={i.id} item={i} edicaoAtual={edicaoAtual} onFeito={carregar} />)}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default DesistentesCard;
