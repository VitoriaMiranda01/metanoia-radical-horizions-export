import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import IgrejaSelect from '@/components/inscricao/IgrejaSelect';
import TelefoneInput from '@/components/inscricao/TelefoneInput';
import { IGREJAS_PARCEIRAS, NAO_CONGREGA, OUTRA_IGREJA, igrejaEhOutra } from '@/constants/igrejas';
import { AREAS_INSCRICAO } from '@/constants/workAreas';
import { listarIgrejasExtras } from '@/services/publicDataService';
import { inscricaoManualEquipante } from '@/services/equipantesService';
import { problemaTelefone } from '@/utils/telefone';
import { formatCPF } from '@/utils/formatters';

/**
 * Inscricao manual de equipante (Raquel, Eduardo e Desenvolvedores), para
 * quem nao se inscreveu pelo link -- ex.: cartas de menores que chegaram em
 * maos sem cadastro. Pedido de 04/10/2026.
 *
 * So o NOME e obrigatorio: a ficha serve para a pessoa entrar na escala e ter
 * o pagamento da taxa de alimentacao gerado. Ela ja entra aprovada, com
 * pagamento manual pendente (aparece em Pagamentos). Sexo e areas ajudam a
 * escala automatica; sem eles, o organizador escala na mao.
 *
 * Quem pode e o servidor que decide (inscricao_manual_equipante); a tela so
 * mostra o botao para quem ele libera.
 *
 * Mesmo nome ja inscrito: o servidor nao grava e devolve quem e. A tela mostra
 * a ficha existente e so reenvia (confirmar_mesmo_nome) se for outra pessoa --
 * todo inscrito pelo link tem CPF, entao sem isso uma carta de quem ja se
 * inscreveu viraria cadastro duplicado.
 */

const SEM_VALOR = '__nenhum__';

const idadeHoje = (iso) => {
  if (!iso) return null;
  const n = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(n.getTime())) return null;
  const h = new Date();
  let idade = h.getFullYear() - n.getFullYear();
  if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) idade -= 1;
  return idade;
};

const VAZIO = {
  nome: '', cpf: '', data_nascimento: '', sexo: '', whatsapp: '',
  igreja: '', igreja_outra: '',
  area_trabalho_opcao1: '', area_trabalho_opcao2: '', area_trabalho_opcao3: '',
  carta_recebida: false,
};

const Campo = ({ label, children, className = '' }) => (
  <div className={`space-y-1.5 ${className}`}>
    <Label className="text-white text-sm">{label}</Label>
    {children}
  </div>
);

const InscricaoManualDialog = ({ onClose, onCriado, nomeInicial = '' }) => {
  const { toast } = useToast();
  const [form, setForm] = useState({ ...VAZIO, nome: nomeInicial });
  const [extras, setExtras] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [mesmoNome, setMesmoNome] = useState(null);

  useEffect(() => {
    let vivo = true;
    listarIgrejasExtras().then((l) => { if (vivo) setExtras(l || []); }).catch(() => {});
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    const aoTeclar = (e) => { if (e.key === 'Escape' && !salvando) onClose(); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onClose, salvando]);

  const igrejas = useMemo(() => [...IGREJAS_PARCEIRAS, ...extras, OUTRA_IGREJA, NAO_CONGREGA], [extras]);
  const set = (campo) => (valor) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    if (campo === 'nome') setMesmoNome(null);
  };
  const idade = idadeHoje(form.data_nascimento);
  const podeSerMenor = idade === null || idade < 18;

  const salvar = async (confirmarMesmoNome = false) => {
    if (form.nome.trim().length < 3) {
      toast({ title: 'Escreva o nome da pessoa', variant: 'destructive' });
      return;
    }
    if (form.whatsapp.trim()) {
      const problema = problemaTelefone(form.whatsapp);
      if (problema) {
        toast({ title: 'Confira o WhatsApp', description: `${problema} Ou deixe em branco.`, variant: 'destructive' });
        return;
      }
    }
    const cpf = form.cpf.replace(/\D/g, '');
    if (cpf && cpf.length !== 11) {
      toast({ title: 'Confira o CPF', description: 'O CPF tem 11 dígitos. Ou deixe em branco.', variant: 'destructive' });
      return;
    }

    setSalvando(true);
    const r = await inscricaoManualEquipante({
      ...form,
      cpf,
      igreja_outra: igrejaEhOutra(form.igreja) ? form.igreja_outra : '',
      carta_recebida: podeSerMenor && form.carta_recebida,
      confirmar_mesmo_nome: confirmarMesmoNome,
    });
    setSalvando(false);

    if (!r.success && r.mesmoNome) {
      setMesmoNome(r.mesmoNome);
      return;
    }
    if (!r.success) {
      toast({ title: 'Não deu para salvar', description: r.error, variant: 'destructive' });
      return;
    }
    toast({
      title: 'Inscrição feita',
      description: `${form.nome.trim()} já está aprovado(a), entra na escala e o pagamento ficou em Pagamentos.`,
      className: 'bg-green-600 text-white',
    });
    onCriado?.(r.id);
    onClose();
  };

  const selectArea = (campo, rotulo) => (
    <Campo label={rotulo}>
      <Select
        value={form[campo] || SEM_VALOR}
        onValueChange={(v) => set(campo)(v === SEM_VALOR ? '' : v)}
      >
        <SelectTrigger className="bg-white/10 border-white/20 text-white">
          <SelectValue placeholder="Não informado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SEM_VALOR}>Não informado</SelectItem>
          {AREAS_INSCRICAO.map((a) => (
            <SelectItem key={a.valor} value={a.valor}>{a.rotulo || a.valor}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Campo>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => !salvando && onClose()}
    >
      <div
        className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-xl border border-white/10 bg-neutral-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-white/10 bg-zinc-900 sticky top-0 z-10">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-400" /> Inscrição manual de equipante
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              Para quem não se inscreveu pelo link. Só o nome é obrigatório: a pessoa já entra
              aprovada, vai para a escala e o pagamento da taxa fica em Pagamentos.
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={salvando} className="text-gray-400 hover:text-white" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Campo label="Nome completo *" className="md:col-span-2">
            <Input
              autoFocus
              value={form.nome}
              onChange={(e) => set('nome')(e.target.value)}
              className="bg-white/10 border-white/20 text-white"
            />
          </Campo>

          <Campo label="CPF">
            <Input
              value={formatCPF(form.cpf.replace(/\D/g, '').slice(0, 11))}
              onChange={(e) => set('cpf')(e.target.value)}
              inputMode="numeric"
              placeholder="Opcional"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
            />
          </Campo>

          <Campo label={`Data de nascimento${idade !== null ? ` (${idade} anos)` : ''}`}>
            <Input
              type="date"
              value={form.data_nascimento}
              onChange={(e) => set('data_nascimento')(e.target.value)}
              className="bg-white/10 border-white/20 text-white [color-scheme:dark]"
            />
          </Campo>

          <Campo label="Sexo">
            <Select value={form.sexo || SEM_VALOR} onValueChange={(v) => set('sexo')(v === SEM_VALOR ? '' : v)}>
              <SelectTrigger className="bg-white/10 border-white/20 text-white">
                <SelectValue placeholder="Não informado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_VALOR}>Não informado</SelectItem>
                <SelectItem value="Masculino">Masculino</SelectItem>
                <SelectItem value="Feminino">Feminino</SelectItem>
              </SelectContent>
            </Select>
          </Campo>

          <Campo label="WhatsApp">
            <TelefoneInput
              id="manual-whatsapp"
              name="whatsapp"
              value={form.whatsapp}
              onChange={(e) => set('whatsapp')(e.target.value)}
              placeholder="Opcional"
            />
          </Campo>

          <Campo label="Igreja" className="md:col-span-2">
            <IgrejaSelect
              id="manual-igreja"
              value={form.igreja}
              onChange={set('igreja')}
              options={igrejas}
              placeholder="Opcional — selecione..."
            />
            {igrejaEhOutra(form.igreja) && (
              <Input
                value={form.igreja_outra}
                onChange={(e) => set('igreja_outra')(e.target.value.toUpperCase())}
                placeholder="Nome da igreja"
                className="mt-2 bg-white/10 border-white/20 text-white placeholder:text-white/40"
              />
            )}
          </Campo>

          {selectArea('area_trabalho_opcao1', 'Área de preferência 1')}
          {selectArea('area_trabalho_opcao2', 'Área de preferência 2')}
          {selectArea('area_trabalho_opcao3', 'Área de preferência 3')}

          {mesmoNome && (
            <div className="md:col-span-2 rounded-md border border-red-500/40 bg-red-500/10 p-3 space-y-2">
              <p className="text-sm text-red-100">
                <strong className="text-white">Já existe uma inscrição com esse nome:</strong>{' '}
                {mesmoNome.nome}
                {mesmoNome.igreja ? ` · ${mesmoNome.igreja}` : ''}
                {mesmoNome.nascimento ? ` · nascimento ${mesmoNome.nascimento.split('-').reverse().join('/')}` : ''}
              </p>
              <p className="text-xs text-red-200/80">
                Se for a mesma pessoa, não precisa inscrever de novo: cancele e procure por ela
                (no módulo das autorizações, use “Vincular carta”). Se for outra pessoa com o mesmo nome,
                confirme abaixo.
              </p>
              <Button
                size="sm" variant="outline" disabled={salvando} onClick={() => salvar(true)}
                className="border-red-400/50 bg-transparent text-red-100 hover:bg-red-500/20 hover:text-white"
              >
                É outra pessoa — inscrever mesmo assim
              </Button>
            </div>
          )}

          {podeSerMenor && (
            <label className="md:col-span-2 flex items-start gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.carta_recebida}
                onChange={(e) => set('carta_recebida')(e.target.checked)}
                className="mt-1 h-4 w-4"
              />
              <span className="text-sm text-gray-200">
                <strong className="text-white">A carta de autorização dos responsáveis está comigo.</strong>
                <span className="block text-gray-400">
                  Para menor de idade: a carta fica vinculada a esta inscrição como entregue e conferida
                  {idade === null ? ' (sem data de nascimento, só vale se for menor).' : '.'}
                </span>
              </span>
            </label>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 p-5 border-t border-white/10">
          <Button variant="outline" onClick={onClose} disabled={salvando}
            className="border-white/20 bg-transparent text-gray-300 hover:bg-white/10 hover:text-white">
            Cancelar
          </Button>
          <Button onClick={() => salvar(false)} disabled={salvando || !!mesmoNome} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Fazer inscrição'}
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default InscricaoManualDialog;
