import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Check, Loader2, Plus, RotateCcw, Trash2, AlertTriangle } from 'lucide-react';
import { IGREJAS_PARCEIRAS } from '@/constants/igrejas';
import {
  fetchOutrasIgrejas,
  adicionarIgrejaExtra,
  removerIgrejaExtra
} from '@/services/igrejasExtrasService';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';

/**
 * A relação das igrejas "OUTRA".
 *
 * Em cima: o que as pessoas escreveram no formulário, com quantas escreveram
 * cada nome — as mais repetidas primeiro, que são as que provavelmente merecem
 * entrar na lista. Embaixo: as que já entraram.
 *
 * Só organizador chega aqui (a tela inteira é protegida) e só organizador passa
 * pelas funções do banco — a checagem não depende deste componente.
 */

const semAcento = (t) => (t || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();

// Os nomes oficiais, sem o prefixo "NN - ", para avisar quando alguém digitou
// uma igreja que JÁ existe na lista com outra grafia. Sem isso, o organizador
// acabaria criando uma segunda "ASSEMBLEIA DE DEUS CENTRAL" ao lado da que já
// está lá.
const NOMES_OFICIAIS = IGREJAS_PARCEIRAS.map((item) => {
  const sep = item.indexOf(' - ');
  return semAcento(sep === -1 ? item : item.slice(sep + 3));
});

const OutrasIgrejasManager = () => {
  const { toast } = useToast();
  const [digitadas, setDigitadas] = useState([]);
  const [extras, setExtras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState({});
  const [novoNome, setNovoNome] = useState('');
  const [criando, setCriando] = useState(false);
  const [paraRemover, setParaRemover] = useState(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    const r = await fetchOutrasIgrejas();
    if (!r.success) {
      setErro(r.error);
    } else {
      setErro('');
      setDigitadas(r.digitadas);
      setExtras(r.extras);
    }
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const pendentes = useMemo(
    () => digitadas.filter((d) => !d.ja_na_lista),
    [digitadas]
  );

  const pareceOficial = (nome) => NOMES_OFICIAIS.includes(semAcento(nome));

  const adicionar = async (nome, chave) => {
    setSalvando((s) => ({ ...s, [chave]: true }));
    const r = await adicionarIgrejaExtra(nome);
    setSalvando((s) => { const c = { ...s }; delete c[chave]; return c; });

    if (!r.success) {
      toast({ title: 'Não deu para adicionar', description: r.error, variant: 'destructive' });
      return false;
    }
    toast({
      title: 'Igreja adicionada',
      description: `"${r.nome}" já aparece no formulário de equipante.`,
      className: 'bg-green-600 text-white'
    });
    carregar();
    return true;
  };

  const criarManual = async (e) => {
    e.preventDefault();
    const nome = novoNome.trim();
    if (nome.length < 3) return;
    setCriando(true);
    const ok = await adicionar(nome, '__manual__');
    setCriando(false);
    if (ok) setNovoNome('');
  };

  const confirmarRemocao = async () => {
    const alvo = paraRemover;
    setParaRemover(null);
    if (!alvo) return;
    const r = await removerIgrejaExtra(alvo.id);
    if (!r.success) {
      toast({ title: 'Não deu para remover', description: r.error, variant: 'destructive' });
      return;
    }
    toast({ title: 'Igreja removida da lista', description: `"${alvo.nome}" não aparece mais no formulário.` });
    carregar();
  };

  return (
    <div className="space-y-8">
      {/* ------------------------------------------------ o que foi digitado */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="text-lg font-medium text-white">Nomes digitados pelos equipantes</h3>
            <p className="text-xs text-gray-500">
              Quem escolheu “OUTRA” no formulário e escreveu o nome da própria igreja.
              As mais repetidas aparecem primeiro.
            </p>
          </div>
          <Button
            variant="outline" size="sm" onClick={carregar} disabled={loading}
            className="border-white/10 bg-transparent text-gray-300 hover:bg-white/5 hover:text-white shrink-0"
          >
            <RotateCcw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-8 justify-center text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" /> Carregando...
          </div>
        ) : erro ? (
          <p className="text-red-300 text-sm py-6 text-center">{erro}</p>
        ) : pendentes.length === 0 ? (
          <p className="text-gray-400 text-sm py-6 text-center bg-white/5 border border-white/10 rounded-lg">
            {digitadas.length === 0
              ? 'Ninguém se inscreveu com a opção OUTRA até agora.'
              : 'Todos os nomes digitados já estão na lista.'}
          </p>
        ) : (
          <div className="space-y-2">
            {pendentes.map((d) => {
              const chave = `p:${d.nome}`;
              const jaExiste = pareceOficial(d.nome);
              return (
                <div
                  key={chave}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-md border border-white/10 bg-white/5"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{d.nome}</p>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <span className="text-xs text-gray-500">
                        {d.quantas === 1 ? '1 pessoa escreveu' : `${d.quantas} pessoas escreveram`}
                      </span>
                      {jaExiste && (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-300">
                          <AlertTriangle className="w-3 h-3" />
                          já existe uma igreja com este nome na lista oficial
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    disabled={!!salvando[chave]}
                    onClick={() => adicionar(d.nome, chave)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                  >
                    {salvando[chave]
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <><Plus className="w-4 h-4 mr-1" /> Adicionar à lista</>}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* --------------------------------------------------- já na lista */}
      <div>
        <h3 className="text-lg font-medium text-white mb-1">Igrejas acrescentadas à lista</h3>
        <p className="text-xs text-gray-500 mb-3">
          Aparecem no formulário de equipante junto com as 145 originais. Não têm
          código nem login de parceiro: quem aprova essas inscrições é a organização.
        </p>

        <form onSubmit={criarManual} className="flex flex-col sm:flex-row gap-2 mb-4">
          <Input
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value.toUpperCase())}
            placeholder="Acrescentar uma igreja pelo nome, sem esperar alguém digitar"
            maxLength={80}
            className="bg-white/5 border-white/10 text-white placeholder:text-gray-600"
            disabled={criando}
          />
          <Button
            type="submit" disabled={criando || novoNome.trim().length < 3}
            className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
          >
            {criando ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-1" /> Adicionar</>}
          </Button>
        </form>

        {extras.length === 0 ? (
          <p className="text-gray-400 text-sm py-6 text-center bg-white/5 border border-white/10 rounded-lg">
            Nenhuma igreja acrescentada ainda.
          </p>
        ) : (
          <div className="space-y-2">
            {extras.map((x) => (
              <div
                key={x.id}
                className="flex items-center gap-3 p-3 rounded-md border border-emerald-500/25 bg-emerald-500/5"
              >
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{x.nome}</p>
                  <p className="text-xs text-gray-500">
                    {x.quantas > 0
                      ? `${x.quantas} ${x.quantas === 1 ? 'inscrição' : 'inscrições'} com este nome`
                      : 'ainda sem inscrições'}
                    {x.criada_por ? ` · adicionada por ${x.criada_por}` : ''}
                  </p>
                </div>
                <Button
                  variant="ghost" size="icon"
                  onClick={() => setParaRemover(x)}
                  className="text-gray-400 hover:text-red-400 shrink-0"
                  title="Tirar da lista"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!paraRemover} onOpenChange={(aberto) => !aberto && setParaRemover(null)}>
        <AlertDialogContent className="bg-gray-900 border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle>Tirar “{paraRemover?.nome}” da lista?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Ela deixa de aparecer no formulário de equipante.
              <br /><br />
              <strong className="text-white">Ninguém perde a inscrição.</strong> Quem já se
              inscreveu com esse nome continua com ele gravado na ficha — o nome só volta para a
              relação de nomes digitados, e você pode adicionar de novo quando quiser.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-gray-700 text-white hover:bg-gray-800">
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmarRemocao} className="bg-red-600 hover:bg-red-700 text-white">
              Tirar da lista
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default OutrasIgrejasManager;
