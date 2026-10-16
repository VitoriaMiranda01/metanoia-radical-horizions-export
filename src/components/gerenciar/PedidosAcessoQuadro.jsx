import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound, Loader2, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { formatCPF } from '@/utils/formatters';
import { formatarTelefone } from '@/utils/telefone';
import { linkWhatsApp } from '@/services/liderService';
import { listarPedidosAcesso, resolverPedidoAcesso } from '@/services/acessoCadastroService';
import { validateCPF } from '@/utils/validation';
import { cn } from '@/lib/utils';
import QuadroAviso from './QuadroAviso';
import FichaResumo from './FichaResumo';

/**
 * Pedidos de acesso ao cadastro (16/10/2026, Patrick): quem nao conseguiu
 * entrar na Area do Equipante ("Não consigo acessar meu cadastro", ou ficha
 * manual sem CPF) aparece aqui. A organizacao confirma que e a pessoa,
 * escolhe a ficha dela e salva o CPF correto -- dai ela entra com o CPF e
 * completa o cadastro. CPF que ja e de outra ficha: mostra as duas e a
 * organizacao escolhe qual fica.
 *
 * Atualiza a cada 20 s (no dia da reuniao os pedidos chegam ao vivo).
 */

const quando = (iso) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

const Pedido = ({ p, onMudou }) => {
  const { toast } = useToast();
  const [escolhida, setEscolhida] = useState(p.candidatos?.length === 1 ? p.candidatos[0].equipante_id : null);
  const [cpf, setCpf] = useState(p.cpf_informado ? formatCPF(p.cpf_informado) : '');
  const [ocupado, setOcupado] = useState(false);
  const [conflito, setConflito] = useState(null);   // { esta, outra }
  const [trocar, setTrocar] = useState(null);       // mensagem
  const [recusando, setRecusando] = useState(false);
  const [obs, setObs] = useState('');
  const zap = linkWhatsApp(p.whatsapp, false);

  const resolver = async (params, sucesso) => {
    setOcupado(true);
    const r = await resolverPedidoAcesso({ pedido: p.id, ...params });
    setOcupado(false);
    if (r.conflito) { setConflito({ esta: r.esta, outra: r.outra }); return; }
    if (r.trocar) { setTrocar(r.erro); return; }
    if (!r.ok) { toast({ title: 'Não deu certo', description: r.erro, variant: 'destructive' }); return; }
    toast({ title: sucesso, className: 'bg-green-600 text-white' });
    onMudou();
  };

  const vincular = (extra = {}) => {
    if (!escolhida) { toast({ title: 'Escolha a ficha da pessoa', variant: 'destructive' }); return; }
    if (!validateCPF(cpf)) { toast({ title: 'CPF inválido', description: 'Confira o CPF com a pessoa.', variant: 'destructive' }); return; }
    resolver({ acao: 'vincular', equipanteId: escolhida, cpf, ...extra },
      'Identidade confirmada: a pessoa já entra com o CPF e completa o cadastro.');
  };

  return (
    <div className="rounded-lg border border-white/10 bg-black/40 p-3 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold">{p.nome}</p>
          <p className="text-xs text-gray-400">
            {p.motivo === 'sem_cpf' ? 'Ficha sem CPF — quer completar o cadastro' : 'Não consegue acessar o cadastro'}
            {' · '}{quando(p.criado_em)}
          </p>
          <p className="text-xs text-gray-300 mt-0.5 flex items-center gap-2 flex-wrap">
            CPF que informou: {p.cpf_informado ? formatCPF(p.cpf_informado) : '—'}
            {' · '}{p.whatsapp ? formatarTelefone(p.whatsapp) : 'sem WhatsApp'}
            {zap && (
              <a href={zap} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300" aria-label="Abrir WhatsApp">
                <MessageCircle className="w-4 h-4" />
              </a>
            )}
          </p>
        </div>
      </div>

      {conflito ? (
        <div className="space-y-2">
          <p className="text-sm text-amber-200">Esse CPF já é de outro cadastro. Escolha qual ficha fica — a outra é apagada e o que faltar na que fica vem dela.</p>
          <div className="grid md:grid-cols-2 gap-2">
            {[['esta', conflito.esta, conflito.outra], ['outra', conflito.outra, conflito.esta]].map(([k, fica, some]) => (
              <FichaResumo key={k} f={fica}>
                <Button size="sm" disabled={ocupado}
                  onClick={() => resolver({ acao: 'juntar', equipanteId: fica.equipante_id, apagar: some.equipante_id, cpf },
                    `Fica ${fica.nome}; a outra ficha foi apagada.`)}
                  className="mt-1 h-8 bg-sky-600 hover:bg-sky-700 text-white">
                  Ficar com esta
                </Button>
              </FichaResumo>
            ))}
          </div>
          <Button size="sm" variant="ghost" onClick={() => setConflito(null)} className="text-gray-400 hover:text-white hover:bg-white/10">Voltar</Button>
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            <p className="text-xs text-gray-400">
              {p.candidatos?.length
                ? 'Qual é a ficha desta pessoa? Confirme a identidade antes (documento, igreja, quem a conhece).'
                : 'Nenhuma ficha com esse nome. Procure a ficha certa na lista de equipantes ou recuse.'}
            </p>
            <div className="grid md:grid-cols-2 gap-2">
              {(p.candidatos || []).map((f) => (
                <button key={f.equipante_id} type="button" onClick={() => setEscolhida(f.equipante_id)} className="text-left">
                  <FichaResumo f={f} destaque={escolhida === f.equipante_id} />
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <div className="flex-1 space-y-1">
              <p className="text-xs text-gray-400">CPF correto (confira com a pessoa)</p>
              <Input value={cpf} inputMode="numeric" onChange={(e) => { setCpf(formatCPF(e.target.value)); setTrocar(null); }}
                className="h-9 bg-black/40 border-white/20 text-white" />
            </div>
            <Button disabled={ocupado || !escolhida} onClick={() => vincular()}
              className="h-9 bg-green-600 hover:bg-green-700 text-white">
              {ocupado ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <KeyRound className="w-4 h-4 mr-1.5" />}
              Confirmar identidade e salvar CPF
            </Button>
          </div>

          {trocar && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-sm text-amber-100 flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="flex-1">{trocar}</span>
              <Button size="sm" disabled={ocupado} onClick={() => vincular({ trocar: true })}
                className="h-8 bg-amber-600 hover:bg-amber-700 text-white">Trocar o CPF</Button>
            </div>
          )}

          <div className={cn('flex flex-wrap items-center gap-2', recusando && 'w-full')}>
            {recusando ? (
              <>
                <Input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Motivo (opcional)"
                  className="h-8 flex-1 min-w-[180px] bg-black/40 border-white/20 text-white" />
                <Button size="sm" disabled={ocupado} onClick={() => resolver({ acao: 'recusar', observacao: obs }, 'Pedido recusado.')}
                  className="h-8 bg-red-600 hover:bg-red-700 text-white">Recusar</Button>
                <Button size="sm" variant="ghost" onClick={() => setRecusando(false)} className="h-8 text-gray-400 hover:text-white hover:bg-white/10">Cancelar</Button>
              </>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setRecusando(true)} className="h-8 text-gray-400 hover:text-red-300 hover:bg-white/10">
                Não é a pessoa / recusar
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const PedidosAcessoQuadro = ({ onMudou }) => {
  const [pedidos, setPedidos] = useState([]);

  const carregar = useCallback(async () => {
    const r = await listarPedidosAcesso();
    if (r.ok) setPedidos((r.pedidos || []).filter((p) => p.status === 'pendente'));
  }, []);

  useEffect(() => {
    carregar();
    const t = setInterval(() => { if (!document.hidden) carregar(); }, 20000);
    return () => clearInterval(t);
  }, [carregar]);

  if (pedidos.length === 0) return null;

  return (
    <QuadroAviso id="pedidos-acesso" cor="sky" Icone={KeyRound}
      titulo={`Pedidos de acesso ao cadastro (${pedidos.length})`}
      explicacao="Pessoas que não conseguiram entrar na Área do Equipante. Confirme a identidade, escolha a ficha e salve o CPF correto: depois disso a pessoa entra com o CPF e completa o cadastro.">
      {pedidos.map((p) => (
        <Pedido key={p.id} p={p} onMudou={() => { carregar(); onMudou?.(); }} />
      ))}
    </QuadroAviso>
  );
};

export default PedidosAcessoQuadro;
