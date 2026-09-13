import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import {
  Check, ExternalLink, FileText, Hand, Loader2, RotateCcw, Search, ShieldCheck, X
} from 'lucide-react';
import { fetchMenoresParaConferencia, conferirAutorizacaoMenor } from '@/services/equipantesService';
import NomeComBandeira from '@/components/common/NomeComBandeira';
import { nomeDaIgreja } from '@/constants/igrejas';
import { formatCPF } from '@/utils/formatters';
import { cn } from '@/lib/utils';

/**
 * Conferência das autorizações dos menores de idade.
 *
 * O menor conclui a etapa sozinho: anexa o arquivo, ou marca "Já entregue"
 * quando deixou a carta em papel na igreja. Foi decisão do Patrick que isso
 * já libere o pagamento — a conferência vem depois, e é aqui.
 *
 * Por isso o botão "Não recebi" tem peso: numa autorização declarada (sem
 * arquivo), ele derruba a declaração e o pagamento do menor volta a travar,
 * com a etapa pendente de novo na tela dele. Onde existe arquivo anexado, o
 * arquivo continua valendo por si só e "Não recebi" apenas tira o visto.
 *
 * Parceiro vê só os menores da própria igreja. Organizador vê todos — o que
 * inclui quem escolheu a igreja OUTRA ou não congrega, e portanto não tem
 * parceiro nenhum para conferir por ele.
 */

const semAcento = (t) => (t || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const dataCurta = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit'
  });
};

const ConferenciaMenoresDialog = ({ onClose }) => {
  const { toast } = useToast();
  const [itens, setItens] = useState([]);
  const [papel, setPapel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [salvando, setSalvando] = useState({});

  const carregar = useCallback(async () => {
    setLoading(true);
    const r = await fetchMenoresParaConferencia();
    if (!r.success) {
      setErro(r.error);
      setItens([]);
    } else {
      setErro('');
      setItens(r.itens);
      setPapel(r.papel);
    }
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    const aoTeclar = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onClose]);

  const termo = semAcento(busca.trim());
  const filtrados = useMemo(() => {
    if (!termo) return itens;
    const digitos = termo.replace(/\D/g, '');
    return itens.filter((i) =>
      semAcento(i.nome).includes(termo)
      || semAcento(nomeDaIgreja(i)).includes(termo)
      || (digitos !== '' && (i.cpf || '').includes(digitos))
    );
  }, [itens, termo]);

  const aConferir = itens.filter((i) => !i.autorizacao_conferida_em
    && (i.parental_auth_file_url || i.autorizacao_entregue_em)).length;
  const semNada = itens.filter((i) => !i.parental_auth_file_url && !i.autorizacao_entregue_em).length;

  const conferir = async (item, conferida) => {
    setSalvando((s) => ({ ...s, [item.id]: true }));
    const r = await conferirAutorizacaoMenor(item.id, conferida);
    setSalvando((s) => { const c = { ...s }; delete c[item.id]; return c; });

    if (!r.success) {
      toast({ title: 'Não deu para salvar', description: r.error, variant: 'destructive' });
      return;
    }
    toast({
      title: conferida ? 'Autorização conferida' : 'Conferência desfeita',
      description: r.declaracaoRemovida
        ? `${item.nome} volta a ficar pendente e não consegue pagar até resolver.`
        : conferida
          ? `${item.nome} está com a autorização em dia.`
          : 'O visto foi retirado. O arquivo anexado continua valendo.',
      className: conferida ? 'bg-green-600 text-white' : undefined
    });
    carregar();
  };

  const renderMenor = (item) => {
    const emVoo = !!salvando[item.id];
    const conferida = !!item.autorizacao_conferida_em;
    const temArquivo = !!item.parental_auth_file_url;
    const declarou = !!item.autorizacao_entregue_em;
    const semAutorizacao = !temArquivo && !declarou;

    return (
      <div
        key={item.id}
        className={cn(
          'flex flex-col md:flex-row md:items-center gap-3 p-3 rounded-md border',
          conferida ? 'border-green-500/40 bg-green-500/5'
            : semAutorizacao ? 'border-red-500/30 bg-red-500/5'
              : 'border-amber-500/30 bg-amber-500/5'
        )}
      >
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium truncate">
            <NomeComBandeira nome={item.nome} nacionalidade={item.nacionalidade} />
            <span className="text-gray-400 font-normal text-sm"> · {item.idade} anos</span>
          </p>
          <p className="text-xs text-gray-400 truncate">
            {nomeDaIgreja(item) || 'sem igreja'}
            {item.whatsapp ? ` · ${item.whatsapp}` : ''}
            {item.cpf ? ` · ${formatCPF(item.cpf)}` : ' · sem CPF'}
          </p>

          <div className="flex items-center gap-2 flex-wrap mt-1.5">
            {semAutorizacao && (
              <span className="text-[11px] px-2 py-0.5 rounded-full border border-red-500/40 bg-red-500/10 text-red-300">
                ainda não entregou nem anexou
              </span>
            )}
            {declarou && (
              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
                <Hand className="w-3 h-3" />
                declarou entrega em mãos · {dataCurta(item.autorizacao_entregue_em)}
              </span>
            )}
            {temArquivo && (
              <a
                href={item.parental_auth_file_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20"
              >
                <FileText className="w-3 h-3" /> ver arquivo anexado
                <ExternalLink className="w-2.5 h-2.5 opacity-60" />
              </a>
            )}
            {conferida && (
              <span className="text-[11px] text-green-400">
                conferida{item.autorizacao_conferida_por ? ` por ${item.autorizacao_conferida_por}` : ''}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {emVoo && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
          {!semAutorizacao && (
            conferida ? (
              <Button
                size="sm" variant="outline" disabled={emVoo}
                onClick={() => conferir(item, false)}
                title={temArquivo
                  ? 'Tira o visto. O arquivo anexado continua valendo.'
                  : 'Tira o visto E a declaração: o menor volta a ficar pendente.'}
                className="h-8 bg-transparent text-gray-300 border-white/20 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4 mr-1" /> Desfazer
              </Button>
            ) : (
              <>
                <Button
                  size="sm" disabled={emVoo}
                  onClick={() => conferir(item, true)}
                  className="h-8 bg-green-600 hover:bg-green-700 text-white"
                >
                  <Check className="h-4 w-4 mr-1" /> Tenho a carta
                </Button>
                {declarou && !temArquivo && (
                  <Button
                    size="sm" variant="outline" disabled={emVoo}
                    onClick={() => conferir(item, false)}
                    title="O menor volta a ficar pendente e não consegue pagar."
                    className="h-8 bg-transparent text-red-300 border-red-500/40 hover:bg-red-500/15 hover:text-red-200"
                  >
                    Não recebi
                  </Button>
                )}
              </>
            )
          )}
        </div>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-black border border-white/10 rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start gap-4 p-5 border-b border-white/10 bg-zinc-900">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-400" />
              Autorizações dos menores
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              Confirme que a carta assinada dos responsáveis está com você.
              {papel === 'organizador'
                ? ' Você vê todos os menores inscritos.'
                : ' Você vê os menores da sua igreja.'}
            </p>
            {!loading && itens.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {itens.length} {itens.length === 1 ? 'menor inscrito' : 'menores inscritos'}
                {aConferir > 0 && ` · ${aConferir} esperando conferência`}
                {semNada > 0 && ` · ${semNada} sem entregar nada`}
              </p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-white shrink-0">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, igreja ou CPF..."
              className="h-9 pl-8 bg-black/40 border-white/20 text-white"
            />
          </div>
          <Button
            variant="outline" onClick={carregar} disabled={loading}
            className="h-9 border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/5"
          >
            <RotateCcw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} /> Atualizar
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-12 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" /> Carregando...
            </div>
          )}
          {!loading && erro && <p className="text-red-300 text-sm text-center py-12">{erro}</p>}
          {!loading && !erro && itens.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-12">
              Nenhum menor de idade inscrito {papel === 'parceiro' ? 'nesta igreja' : ''} até agora.
            </p>
          )}
          {!loading && !erro && itens.length > 0 && filtrados.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-12">Ninguém bate com a busca.</p>
          )}
          {!loading && !erro && filtrados.map(renderMenor)}
        </div>

        <div className="p-4 border-t border-white/10 bg-zinc-900 flex justify-end">
          <Button onClick={onClose} variant="outline" className="border-white/20 bg-transparent text-gray-300 hover:bg-white/10 hover:text-white">
            Fechar
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default ConferenciaMenoresDialog;
