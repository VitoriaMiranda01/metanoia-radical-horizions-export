import React, { useCallback, useEffect, useState } from 'react';
import { Copy, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { listarPossiveisDuplicados, resolverDuplicado } from '@/services/acessoCadastroService';
import QuadroAviso from './QuadroAviso';
import FichaResumo from './FichaResumo';

/**
 * Possiveis cadastros duplicados (16/10/2026, Patrick): com as inscricoes
 * abertas, quem foi inscrito pela organizacao e digita o proprio CPF faz uma
 * inscricao nova -- o fluxo do CPF nao muda. Aqui a organizacao ve os pares
 * parecidos (mesmo nome; mesmo primeiro e ultimo nome com a mesma data de
 * nascimento; mesmo WhatsApp e mesmo primeiro nome) e decide:
 *   - "Ficar com esta": a outra ficha some; a escala dela passa para a que
 *     fica e o que faltar (CPF, nascimento, WhatsApp, sexo) vem dela;
 *   - "Não é duplicado": o par sai do quadro de vez.
 * O banco recusa apagar ficha com pagamento, ou a inscrita no lugar de uma de
 * edicao anterior.
 */
const Par = ({ par, onMudou }) => {
  const { toast } = useToast();
  const [confirmando, setConfirmando] = useState(null);   // equipante_id que fica
  const [ocupado, setOcupado] = useState(false);
  const { a, b } = par;

  const agir = async (acao, manter = null) => {
    setOcupado(true);
    const r = await resolverDuplicado(a.equipante_id, b.equipante_id, acao, manter);
    setOcupado(false);
    if (!r.ok) { toast({ title: 'Não deu certo', description: r.erro, variant: 'destructive' }); return; }
    toast({
      title: acao === 'nao_e' ? 'Marcado como não duplicado' : `Ficou ${manter === a.equipante_id ? a.nome : b.nome}`,
      description: acao === 'nao_e' ? undefined : `A ficha de ${r.nome_apagado} foi apagada.`,
      className: 'bg-green-600 text-white'
    });
    onMudou();
  };

  return (
    <div className="rounded-lg border border-white/10 bg-black/40 p-3 space-y-2">
      <p className="text-xs text-gray-400">Motivo: <span className="text-gray-200">{par.motivo}</span></p>
      <div className="grid md:grid-cols-2 gap-2">
        {[a, b].map((f) => {
          const outra = f === a ? b : a;
          return (
            <FichaResumo key={f.equipante_id} f={f} destaque={confirmando === f.equipante_id}>
              {confirmando === f.equipante_id ? (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs text-amber-200">Fica esta e a de {outra.nome} é apagada?</span>
                  <Button size="sm" disabled={ocupado} onClick={() => agir('juntar', f.equipante_id)}
                    className="h-7 bg-red-600 hover:bg-red-700 text-white">
                    {ocupado ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Sim'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmando(null)} className="h-7 text-gray-400 hover:text-white hover:bg-white/10">Não</Button>
                </div>
              ) : (
                <Button size="sm" disabled={ocupado} onClick={() => setConfirmando(f.equipante_id)}
                  className="mt-1 h-8 bg-sky-600 hover:bg-sky-700 text-white">
                  Ficar com esta
                </Button>
              )}
            </FichaResumo>
          );
        })}
      </div>
      <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => agir('nao_e')}
        className="h-8 text-gray-300 hover:text-white hover:bg-white/10">
        Não é duplicado
      </Button>
    </div>
  );
};

const DuplicadosQuadro = ({ onMudou, atualizar }) => {
  const [pares, setPares] = useState([]);

  const carregar = useCallback(async () => {
    const r = await listarPossiveisDuplicados();
    if (r.ok) setPares(r.pares || []);
  }, []);

  useEffect(() => { carregar(); }, [carregar, atualizar]);

  if (pares.length === 0) return null;

  return (
    <QuadroAviso id="duplicados" cor="purple" Icone={Copy}
      titulo={`Possíveis cadastros duplicados (${pares.length})`}
      explicacao="Fichas muito parecidas — pode ser a mesma pessoa com dois cadastros (por exemplo, a inscrição manual e uma inscrição pelo site). Confira e escolha qual fica, ou marque que não é duplicado.">
      {pares.map((par) => (
        <Par key={`${par.a.equipante_id}-${par.b.equipante_id}`} par={par} onMudou={() => { carregar(); onMudou?.(); }} />
      ))}
    </QuadroAviso>
  );
};

export default DuplicadosQuadro;
