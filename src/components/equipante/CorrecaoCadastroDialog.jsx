import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Church, Loader2, Phone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import IgrejaSelect from '@/components/inscricao/IgrejaSelect';
import TelefoneInput from '@/components/inscricao/TelefoneInput';
import { IGREJAS_PARCEIRAS, OUTRA_IGREJA, igrejaEhOutra } from '@/constants/igrejas';
import { listarIgrejasExtras } from '@/services/publicDataService';
import { corrigirMinhaInscricao } from '@/services/equipantesService';
import { problemaTelefone } from '@/utils/telefone';

/**
 * Janela de "Atencao" do acompanhamento: a propria pessoa corrige o que esta
 * pendente na ficha (ideia do Patrick, 04/10/2026). Abre ao entrar no
 * acompanhamento e de novo antes de revelar a area; some de vez quando o
 * servidor responde que nao sobrou pendencia.
 *
 * As pendencias vem do servidor (_pendencias_equipante):
 *   { tipo: 'igreja' }                         disse que congrega e nao disse onde
 *   { tipo: 'telefone', valor, estrangeiro }   WhatsApp fora do padrao
 *
 * A igreja usa a MESMA lista do formulario de inscricao (parceiras + extras
 * + OUTRA com o nome escrito). O telefone usa o mesmo campo com mascara.
 */
const CorrecaoCadastroDialog = ({ equipanteId, dono, pendencias, antesDeRevelar = false, onClose, onCorrigido }) => {
  const { toast } = useToast();
  const temIgreja = pendencias.some((p) => p.tipo === 'igreja');
  const pTelefone = pendencias.find((p) => p.tipo === 'telefone');

  const [extras, setExtras] = useState([]);
  const [igreja, setIgreja] = useState('');
  const [igrejaOutra, setIgrejaOutra] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!temIgreja) return undefined;
    let vivo = true;
    listarIgrejasExtras().then((lista) => { if (vivo) setExtras(lista || []); }).catch(() => {});
    return () => { vivo = false; };
  }, [temIgreja]);

  const opcoesDeIgreja = useMemo(() => [...IGREJAS_PARCEIRAS, ...extras, OUTRA_IGREJA], [extras]);
  const problemaAtual = pTelefone ? problemaTelefone(pTelefone.valor, { estrangeiro: pTelefone.estrangeiro }) : null;

  const salvar = async () => {
    if (temIgreja) {
      if (!igreja) {
        toast({ title: 'Escolha a sua igreja', description: 'Selecione na lista, ou escolha "OUTRA" e escreva o nome.', variant: 'destructive' });
        return;
      }
      if (igrejaEhOutra(igreja) && igrejaOutra.trim().length < 3) {
        toast({ title: 'Qual é a sua igreja?', description: 'Escreva o nome da sua igreja.', variant: 'destructive' });
        return;
      }
    }
    if (pTelefone) {
      const problema = whatsapp.trim()
        ? problemaTelefone(whatsapp, { estrangeiro: pTelefone.estrangeiro })
        : 'Digite o seu WhatsApp.';
      if (problema) {
        toast({ title: 'Confira o seu WhatsApp', description: problema, variant: 'destructive' });
        return;
      }
    }

    setSalvando(true);
    try {
      const sobraram = await corrigirMinhaInscricao(equipanteId, dono, {
        igreja: temIgreja ? igreja : null,
        igrejaOutra: temIgreja && igrejaEhOutra(igreja) ? igrejaOutra : null,
        whatsapp: pTelefone ? whatsapp : null,
      });
      toast({ title: 'Inscrição atualizada', description: 'Obrigado por corrigir!', className: 'bg-green-600 text-white' });
      onCorrigido?.(sobraram);
    } catch (err) {
      toast({ title: 'Não deu certo', description: err.message, variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-amber-500/40 bg-neutral-950 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-white/10 bg-amber-500/10">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xl font-bold text-white">Atenção</h3>
              <p className="text-sm text-amber-100/90 mt-1">
                {antesDeRevelar
                  ? 'Antes de revelarmos qual foi a sua área, detectamos um problema na sua inscrição.'
                  : 'Detectamos um problema na sua inscrição. Corrija abaixo, leva menos de um minuto.'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white shrink-0" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {temIgreja && (
            <div className="space-y-3">
              <p className="text-sm text-gray-200 flex items-start gap-2">
                <Church className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                Você colocou que congrega em uma igreja, mas não nos informou qual. Por favor,
                informe a igreja que você congrega.
              </p>
              <div className="space-y-2">
                <Label className="text-white">Igreja que frequenta</Label>
                <IgrejaSelect
                  id="correcao-igreja"
                  value={igreja}
                  onChange={setIgreja}
                  options={opcoesDeIgreja}
                  placeholder="Selecione sua igreja..."
                />
                {igrejaEhOutra(igreja) && (
                  <div className="space-y-1.5 pt-1">
                    <Label htmlFor="correcao-igreja-outra" className="text-white">Qual é a sua igreja?</Label>
                    <Input
                      id="correcao-igreja-outra"
                      value={igrejaOutra}
                      onChange={(e) => setIgrejaOutra(e.target.value.toUpperCase())}
                      placeholder="Nome da sua igreja"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {pTelefone && (
            <div className="space-y-3">
              <p className="text-sm text-gray-200 flex items-start gap-2">
                <Phone className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                <span>
                  O WhatsApp que você informou foi <strong className="text-white">{pTelefone.valor || '(vazio)'}</strong>
                  {problemaAtual ? <> — {problemaAtual.replace(/\s*Ex\.:.*$/, '')}</> : null}
                </span>
              </p>
              <div className="space-y-2">
                <Label htmlFor="correcao-whatsapp" className="text-white">WhatsApp correto</Label>
                <TelefoneInput
                  id="correcao-whatsapp"
                  name="whatsapp"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  estrangeiro={!!pTelefone.estrangeiro}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 p-5 border-t border-white/10">
          <Button variant="outline" onClick={onClose} disabled={salvando}
            className="border-white/20 bg-transparent text-gray-300 hover:bg-white/10 hover:text-white">
            Agora não
          </Button>
          <Button onClick={salvar} disabled={salvando} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default CorrecaoCadastroDialog;
