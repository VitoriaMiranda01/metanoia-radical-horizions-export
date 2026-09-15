import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import IgrejaSelect from '@/components/inscricao/IgrejaSelect';
import { IGREJAS_PARCEIRAS, IGREJAS_RESPONSAVEL_ACAMPANTE, OUTRA_IGREJA, igrejaEhOutra } from '@/constants/igrejas';
import { listarIgrejasExtras } from '@/services/publicDataService';
import { toBoolean } from '@/utils/formatters';

/**
 * Edicao dos dados cadastrais de uma inscricao (acampante ou equipante),
 * aberta pelo botao "Editar" nas tabelas da tela de Gerenciar Inscricoes.
 *
 * Segue de proposito o mesmo agrupamento de secoes do
 * InscricaoDetalhesModal.jsx (que so mostra) -- assim quem ja usa aquela
 * tela reconhece onde cada campo mora nesta.
 *
 * De caso pensado, NAO aparecem aqui: pagamento (status_pagamento e afins),
 * aprovacao/decisao, escala e area de trabalho (equipante), grupo de trilha
 * (acampante) e as observacoes do organizador -- cada um desses ja tem a
 * propria tela/acao que decide aquele dado, e editar por aqui destrancaria
 * esse controle. Tambem fora: consentimentos (autorizacao de imagem, termo
 * de responsabilidade) e o fluxo de autorizacao de menor de idade.
 */

const camposIguais = (a, b) => {
  const va = a === undefined || a === null ? '' : a;
  const vb = b === undefined || b === null ? '' : b;
  return String(va) === String(vb);
};

const CampoTexto = ({ label, valor, onChange, tipo = 'text', placeholder, className = '' }) => (
  <div className={`space-y-1.5 ${className}`}>
    <Label className="text-white text-sm">{label}</Label>
    <Input
      type={tipo}
      value={valor ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
    />
  </div>
);

const CampoArea = ({ label, valor, onChange, className = '' }) => (
  <div className={`space-y-1.5 md:col-span-2 ${className}`}>
    <Label className="text-white text-sm">{label}</Label>
    <Textarea
      value={valor ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
      rows={2}
    />
  </div>
);

const CampoSelect = ({ label, valor, onChange, opcoes, placeholder = 'Selecione...', className = '' }) => (
  <div className={`space-y-1.5 ${className}`}>
    <Label className="text-white text-sm">{label}</Label>
    <Select value={valor || undefined} onValueChange={onChange}>
      <SelectTrigger className="bg-white/10 border-white/20 text-white">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {opcoes.map((op) => (
          <SelectItem key={op.value ?? op} value={op.value ?? op}>
            {op.label ?? op}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

const CampoBooleano = ({ label, valor, onChange, name, className = '' }) => (
  <div className={`space-y-1.5 ${className}`}>
    <Label className="text-white text-sm block">{label}</Label>
    <div className="flex space-x-6">
      {['SIM', 'NÃO'].map((opt) => (
        <label key={opt} className="flex items-center space-x-2 cursor-pointer">
          <input
            type="radio"
            name={name}
            checked={(opt === 'SIM') === toBoolean(valor)}
            onChange={() => onChange(opt === 'SIM')}
            className="w-4 h-4 text-blue-600 focus:ring-blue-500 bg-white/10 border-white/30"
          />
          <span className="text-white text-sm">{opt}</span>
        </label>
      ))}
    </div>
  </div>
);

const Secao = ({ titulo, children }) => (
  <div className="space-y-3">
    <h4 className="text-lg font-semibold text-blue-400 border-b border-blue-400/30 pb-2">{titulo}</h4>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
  </div>
);

const SEXO_OPCOES = ['Masculino', 'Feminino'];
const TAMANHOS_CAMISA = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG'];
const ESTADOS_CIVIS = ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União Estável'];

const EditarInscricaoModal = ({ inscricao, onClose, onSave }) => {
  const { toast } = useToast();
  const isEquipante = inscricao?.tipo === 'equipante';
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState(inscricao || {});
  const [extras, setExtras] = useState([]);

  useEffect(() => {
    setForm(inscricao || {});
  }, [inscricao]);

  // Mesma fonte de opcoes de igreja que os formularios publicos usam --
  // ver o comentario em InfoEclesiasticas.jsx / AdminResponsavel.jsx.
  useEffect(() => {
    let vivo = true;
    listarIgrejasExtras().then((lista) => { if (vivo) setExtras(lista); });
    return () => { vivo = false; };
  }, []);

  const opcoesIgreja = useMemo(
    () => (isEquipante
      ? [...IGREJAS_PARCEIRAS, ...extras, OUTRA_IGREJA]
      : IGREJAS_RESPONSAVEL_ACAMPANTE),
    [isEquipante, extras]
  );

  const set = (campo) => (valor) => setForm((prev) => ({ ...prev, [campo]: valor }));

  if (!inscricao) return null;

  const handleSalvar = async () => {
    // So manda o que de fato mudou -- evita reescrever colunas que o
    // organizador nem chegou a olhar, e deixa o log de erro (se acontecer)
    // mais facil de ler.
    const alterados = {};
    Object.keys(form).forEach((chave) => {
      if (!camposIguais(form[chave], inscricao[chave])) {
        alterados[chave] = form[chave] === '' ? null : form[chave];
      }
    });

    if (Object.keys(alterados).length === 0) {
      onClose();
      return;
    }

    setSalvando(true);
    const resultado = await onSave(inscricao.id, alterados);
    setSalvando(false);

    if (resultado?.success) {
      toast({ title: 'Inscrição atualizada', description: `Os dados de ${form.nome || 'inscrição'} foram salvos.` });
      onClose();
    } else {
      toast({
        title: 'Erro ao salvar',
        description: resultado?.error || 'Não foi possível salvar as alterações.',
        variant: 'destructive',
      });
    }
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
        className="bg-black border border-white/10 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-6 border-b border-white/10 bg-zinc-900">
          <div>
            <h3 className="text-xl md:text-2xl font-bold text-white">Editar Inscrição</h3>
            <p className="text-sm text-gray-400 mt-1">
              {isEquipante ? 'Equipante' : 'Acampante'} · {inscricao.nome}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-white hover:bg-white/10 h-8 w-8 p-0" disabled={salvando}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="overflow-y-auto p-6 space-y-6">
          <Secao titulo="Dados Pessoais">
            <CampoTexto label="Nome" valor={form.nome} onChange={set('nome')} />
            <CampoTexto label="CPF" valor={form.cpf} onChange={set('cpf')} />
            <CampoTexto label="Nacionalidade (código ISO, só quem se inscreveu sem CPF)" valor={form.nacionalidade} onChange={set('nacionalidade')} placeholder="Ex: PT, US..." />
            <CampoSelect label="Sexo" valor={form.sexo} onChange={set('sexo')} opcoes={SEXO_OPCOES} />
            <CampoTexto label="Data de Nascimento" tipo="date" valor={form.data_nascimento} onChange={set('data_nascimento')} />
            {!isEquipante && (
              <CampoSelect label="Tamanho da Camisa" valor={form.tamanho_camisa} onChange={set('tamanho_camisa')} opcoes={TAMANHOS_CAMISA} />
            )}
            {!isEquipante && (
              <CampoTexto label="E-mail" tipo="email" valor={form.email} onChange={set('email')} />
            )}
            {!isEquipante && (
              <CampoTexto label="Profissão" valor={form.profissao} onChange={set('profissao')} />
            )}
            {!isEquipante && (
              <CampoSelect label="Estado Civil" valor={form.estado_civil} onChange={set('estado_civil')} opcoes={ESTADOS_CIVIS} />
            )}
            <CampoTexto label="WhatsApp" valor={form.whatsapp} onChange={set('whatsapp')} />
            {isEquipante && (
              <CampoTexto label="Telefone Residencial" valor={form.telefone_residencial} onChange={set('telefone_residencial')} />
            )}
          </Secao>

          {!isEquipante && (
            <Secao titulo="Endereço">
              <CampoTexto label="CEP" valor={form.cep} onChange={set('cep')} />
              <CampoTexto label="Rua" valor={form.endereco} onChange={set('endereco')} />
              <CampoTexto label="Número" valor={form.numero} onChange={set('numero')} />
              <CampoTexto label="Complemento" valor={form.complemento} onChange={set('complemento')} />
              <CampoTexto label="Bairro" valor={form.bairro} onChange={set('bairro')} />
              <CampoTexto label="Cidade" valor={form.cidade} onChange={set('cidade')} />
              <CampoTexto label="Estado" valor={form.estado} onChange={set('estado')} />
            </Secao>
          )}

          <Secao titulo="Saúde">
            <CampoBooleano label="Tem algum problema de saúde?" name="tem_problema_saude" valor={form.tem_problema_saude} onChange={set('tem_problema_saude')} />
            <div />
            <CampoArea label="Condições Médicas" valor={form.condicoes_medicas} onChange={set('condicoes_medicas')} />
            {!isEquipante && (
              <CampoBooleano label="Usa algum medicamento?" name="usa_medicamento" valor={form.usa_medicamento} onChange={set('usa_medicamento')} />
            )}
            {!isEquipante && <div />}
            {!isEquipante && (
              <CampoArea label="Medicamentos" valor={form.medicamentos} onChange={set('medicamentos')} />
            )}
            <CampoBooleano label="Tem restrição alimentar?" name="tem_restricao_alimentar" valor={form.tem_restricao_alimentar} onChange={set('tem_restricao_alimentar')} />
            <div />
            <CampoArea label="Restrições Alimentares" valor={form.restricoes_alimentares} onChange={set('restricoes_alimentares')} />
            {!isEquipante && (
              <CampoBooleano label="Está grávida?" name="esta_gravida" valor={form.esta_gravida} onChange={set('esta_gravida')} />
            )}
          </Secao>

          <Secao titulo="Igreja">
            <div className="space-y-1.5">
              <Label className="text-white text-sm">Igreja</Label>
              <IgrejaSelect
                value={form.igreja}
                onChange={set('igreja')}
                options={opcoesIgreja}
              />
            </div>
            {igrejaEhOutra(form.igreja) && (
              <CampoTexto label="Nome da Igreja (digitado em OUTRA)" valor={form.igreja_outra} onChange={set('igreja_outra')} />
            )}
            <CampoBooleano label="Congrega em alguma igreja?" name="esta_afastado" valor={form.esta_afastado} onChange={set('esta_afastado')} />
            <CampoTexto label="Pastor Responsável" valor={form.pastor_nome} onChange={set('pastor_nome')} />
            <CampoTexto label="Cargo na Igreja" valor={form.cargo_igreja} onChange={set('cargo_igreja')} />
            <CampoTexto label="Cargo na Igreja (Outro)" valor={form.cargo_igreja_outro} onChange={set('cargo_igreja_outro')} />
            {isEquipante && (
              <CampoBooleano label="Frequenta Grupo de Cuidado, Célula ou EBD?" name="frequenta_grupo_cuidado" valor={form.frequenta_grupo_cuidado} onChange={set('frequenta_grupo_cuidado')} />
            )}
            {isEquipante && (
              <CampoBooleano label="É Pastor?" name="e_pastor" valor={form.e_pastor} onChange={set('e_pastor')} />
            )}
            {isEquipante && (
              <CampoTexto label="Pastor (Outro)" valor={form.e_pastor_outro} onChange={set('e_pastor_outro')} />
            )}
          </Secao>

          {isEquipante && (
            <Secao titulo="Habilidades">
              <CampoBooleano label="Você Canta?" name="voce_canta" valor={form.voce_canta} onChange={set('voce_canta')} />
              <CampoBooleano label="Toca Instrumento?" name="toca_instrumento" valor={form.toca_instrumento} onChange={set('toca_instrumento')} />
            </Secao>
          )}

          {isEquipante && (
            <Secao titulo="Familiar">
              <CampoBooleano label="Familiar Trabalhando?" name="familiar_trabalhando" valor={form.familiar_trabalhando} onChange={set('familiar_trabalhando')} />
              <CampoTexto label="Familiar Trabalhando (Outro)" valor={form.familiar_trabalhando_outro} onChange={set('familiar_trabalhando_outro')} />
              <CampoTexto label="Parentesco" valor={form.parentesco} onChange={set('parentesco')} />
              <CampoTexto label="Nome do Familiar" valor={form.familiar_nome} onChange={set('familiar_nome')} />
            </Secao>
          )}

          {!isEquipante && (
            <Secao titulo="Quem Indicou e Conhecidos">
              <CampoTexto label="Nome de Quem Indicou" valor={form.quem_indicou_nome} onChange={set('quem_indicou_nome')} />
              <CampoTexto label="Telefone de Quem Indicou" valor={form.quem_indicou_telefone} onChange={set('quem_indicou_telefone')} />
              <CampoTexto label="Conhecido/Familiar no Projeto" valor={form.conhecido_no_projeto} onChange={set('conhecido_no_projeto')} />
              <CampoTexto label="Nome do Conhecido/Familiar" valor={form.nome_familiar_conhecido} onChange={set('nome_familiar_conhecido')} />
            </Secao>
          )}

          {isEquipante && (
            <Secao titulo="Experiência">
              <CampoTexto label="Qual Radical Acampante?" valor={form.qual_radical_acampante} onChange={set('qual_radical_acampante')} />
              <CampoTexto label="Qual Radical Acampante (Outro)" valor={form.qual_radical_acampante_outro} onChange={set('qual_radical_acampante_outro')} />
              <CampoTexto label="Número Edição Participou" valor={form.numero_edicao_participou} onChange={set('numero_edicao_participou')} />
              <CampoBooleano label="Já Trabalhou na Equipe?" name="ja_trabalhou_equipe" valor={form.ja_trabalhou_equipe} onChange={set('ja_trabalhou_equipe')} />
              <CampoTexto label="Edição que Trabalhou" valor={form.edicao_trabalhou} onChange={set('edicao_trabalhou')} />
            </Secao>
          )}

          <Secao titulo="Contato de Emergência">
            <CampoTexto label="Nome do Contato" valor={form.contato_emergencia_nome} onChange={set('contato_emergencia_nome')} />
            <CampoTexto label="Telefone do Contato" valor={form.contato_emergencia_telefone} onChange={set('contato_emergencia_telefone')} />
          </Secao>
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-white/10 bg-zinc-900">
          <Button variant="outline" onClick={onClose} disabled={salvando} className="border-white/20 text-white hover:bg-white/10">
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={salvando} className="bg-blue-600 hover:bg-blue-700 text-white">
            {salvando ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</>) : 'Salvar Alterações'}
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default EditarInscricaoModal;
