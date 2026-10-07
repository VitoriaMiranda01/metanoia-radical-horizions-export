import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CalendarDays, Church, Fingerprint, Loader2, Phone, Users, Briefcase, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import IgrejaSelect from '@/components/inscricao/IgrejaSelect';
import TelefoneInput from '@/components/inscricao/TelefoneInput';
import CampoDataNascimento from '@/components/inscricao/CampoDataNascimento';
import AreasDeTrabalho from '@/components/inscricao/AreasDeTrabalho';
import { IGREJAS_PARCEIRAS, NAO_CONGREGA, OUTRA_IGREJA, igrejaEhOutra } from '@/constants/igrejas';
import { NACIONALIDADES, bandeiraDoPais } from '@/constants/nacionalidades';
import { useOpcoesDeIgreja } from '@/hooks/useOpcoesDeIgreja';
import { completarMinhaInscricao } from '@/services/equipantesService';
import { problemaTelefone } from '@/utils/telefone';
import { calcularIdade, formatCPF } from '@/utils/formatters';
import { limparNomePessoa, problemaNomePessoa } from '@/utils/nomePessoa';
import { problemaNomeSimples } from '@/utils/validacoesInscricao';
import { validateCPF } from '@/utils/validation';

/**
 * Janela de "Complete o seu cadastro" do acompanhamento (ideia do Patrick,
 * 04/10/2026; ampliada em 06/10/2026): a propria pessoa completa o que falta
 * na ficha. Abre ao entrar no acompanhamento e NAO fecha enquanto sobrar
 * pendencia -- a ficha so segue quando estiver completa. Quem tem de completar
 * nao precisa ser procurado pela organizacao.
 *
 * As pendencias vem do servidor (_pendencias_equipante):
 *   { tipo: 'nome', valor }   nome com numero/simbolo ou sem sobrenome
 *   { tipo: 'pastor' | 'familiar', valor }   nome do pastor / do familiar fora do padrao
 *   { tipo: 'igreja' }        igreja em branco (ou "OUTRA" sem o nome)
 *   { tipo: 'cpf' }           sem CPF e sem nacionalidade
 *   { tipo: 'nascimento' }    data de nascimento em branco
 *   { tipo: 'sexo' }
 *   { tipo: 'telefone', valor, estrangeiro }   WhatsApp vazio ou fora do padrao
 *   { tipo: 'parentesco' }    conhecido / familiar que vai como acampante
 *   { tipo: 'areas' }         as 3 opcoes de area (so de quem nao foi escalado)
 *
 * Cada pergunta usa o MESMO componente e as mesmas opcoes do formulario de
 * inscricao. O servidor so grava o que esta pendente.
 */

const PARENTESCOS = ['NÃO TENHO', 'CÔNJUGE', 'PAI', 'MÃE', 'FILHO', 'TIO / TIA', 'CUNHADO / CUNHADA', 'IRMÃO / IRMÃ', 'OUTRO FAMILIAR (DESCREVA)'];

const Secao = ({ Icone, texto, children }) => (
  <div className="space-y-3">
    <p className="text-sm text-gray-200 flex items-start gap-2">
      <Icone className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
      <span>{texto}</span>
    </p>
    {children}
  </div>
);

const CorrecaoCadastroDialog = ({ equipanteId, dono, pendencias, antesDeRevelar = false, onSair, onCorrigido }) => {
  const { toast } = useToast();
  const tem = (tipo) => pendencias.some((p) => p.tipo === tipo);
  const pNome = pendencias.find((p) => p.tipo === 'nome');
  const pPastor = pendencias.find((p) => p.tipo === 'pastor');
  const pFamiliar = pendencias.find((p) => p.tipo === 'familiar');
  const temIgreja = tem('igreja');
  const temCpf = tem('cpf');
  const temNascimento = tem('nascimento');
  const temSexo = tem('sexo');
  const pTelefone = pendencias.find((p) => p.tipo === 'telefone');
  const temParentesco = tem('parentesco');
  const temAreas = tem('areas');

  const cpfDoDono = (dono?.cpf || '').replace(/\D/g, '');

  const { novas, extras, permiteOutra } = useOpcoesDeIgreja();
  const [nome, setNome] = useState(pNome ? limparNomePessoa(pNome.valor) : '');
  const [pastor, setPastor] = useState(pPastor ? limparNomePessoa(pPastor.valor) : '');
  const [familiarCorrigido, setFamiliarCorrigido] = useState(pFamiliar ? limparNomePessoa(pFamiliar.valor) : '');
  const [igreja, setIgreja] = useState('');
  const [igrejaOutra, setIgrejaOutra] = useState('');
  const [cpf, setCpf] = useState(cpfDoDono ? formatCPF(cpfDoDono) : '');
  const [semCpf, setSemCpf] = useState(false);
  const [nacionalidade, setNacionalidade] = useState('');
  const [nascimento, setNascimento] = useState('');
  const [sexo, setSexo] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [parentesco, setParentesco] = useState('');
  const [familiarNome, setFamiliarNome] = useState('');
  const [areas, setAreas] = useState({ areaTrabalhoOpcao1: '', areaTrabalhoOpcao2: '', areaTrabalhoOpcao3: '', areasTrabalhoExtra: [] });
  const [salvando, setSalvando] = useState(false);

  const opcoesDeIgreja = useMemo(
    () => [...IGREJAS_PARCEIRAS, ...novas, ...extras, ...(permiteOutra ? [OUTRA_IGREJA] : []), NAO_CONGREGA],
    [novas, extras, permiteOutra]
  );

  // Estrangeiro: o servidor ja sabe (nacionalidade gravada) ou a pessoa acabou
  // de escolher "sou estrangeiro" aqui.
  const estrangeiro = !!pTelefone?.estrangeiro || (temCpf && semCpf);
  const problemaAtual = pTelefone && pTelefone.valor
    ? problemaTelefone(pTelefone.valor, { estrangeiro: !!pTelefone.estrangeiro })
    : null;

  const erro = (title, description) => {
    toast({ title, description, variant: 'destructive' });
    return false;
  };

  // Confere tudo o que esta pendente antes de enviar. O servidor confere de
  // novo -- aqui e so para a pessoa nao esperar a resposta para saber.
  const conferir = () => {
    if (pNome) {
      const problema = problemaNomePessoa(nome) || (!nome.trim() ? 'Escreva o seu nome completo.' : null);
      if (problema) return erro('Confira o seu nome', problema);
    }
    if (pPastor) {
      const problema = problemaNomeSimples(pastor) || (!pastor.trim() ? 'Escreva o nome do pastor.' : null);
      if (problema) return erro('Confira o nome do pastor', problema);
    }
    if (pFamiliar) {
      const problema = problemaNomeSimples(familiarCorrigido) || (!familiarCorrigido.trim() ? 'Escreva o nome do conhecido / familiar.' : null);
      if (problema) return erro('Confira o nome do conhecido / familiar', problema);
    }
    if (temIgreja) {
      if (!igreja) return erro('Escolha a sua igreja', 'Selecione na lista. Se não congrega em nenhuma, escolha "Não se aplica (não congrega)".');
      if (igrejaEhOutra(igreja) && igrejaOutra.trim().length < 3) return erro('Qual é a sua igreja?', 'Escreva o nome da sua igreja.');
    }
    if (temCpf) {
      if (semCpf) {
        if (!nacionalidade) return erro('Escolha a sua nacionalidade', 'Quem não tem CPF informa o país de origem.');
      } else if (!validateCPF(cpf)) {
        return erro('CPF inválido', 'Confira os números do CPF.');
      }
    }
    if (temNascimento) {
      const idade = calcularIdade(nascimento);
      if (!nascimento) return erro('Informe a data de nascimento', 'Digite no formato dd/mm/aaaa.');
      if (idade === null || idade < 10 || idade > 100) return erro('Confira a data de nascimento', 'A idade que essa data dá não parece certa.');
    }
    if (temSexo && !sexo) return erro('Escolha o sexo', 'Selecione uma das opções.');
    if (pTelefone) {
      const problema = whatsapp.trim()
        ? problemaTelefone(whatsapp, { estrangeiro })
        : 'Digite o seu WhatsApp.';
      if (problema) return erro('Confira o seu WhatsApp', problema);
    }
    if (temParentesco) {
      if (!parentesco) return erro('Responda a pergunta do familiar', 'Escolha uma opção (pode ser "Não tenho").');
      if (parentesco !== 'NÃO TENHO' && (familiarNome.trim().length < 2 || /[^\p{L}\s'’.-]/u.test(familiarNome))) {
        return erro('Confira o nome', 'Diga o nome do conhecido / familiar, só com letras.');
      }
    }
    if (temAreas) {
      const { areaTrabalhoOpcao1: a1, areaTrabalhoOpcao2: a2, areaTrabalhoOpcao3: a3 } = areas;
      if (!a1 || !a2 || !a3) return erro('Áreas de trabalho', 'Escolha as 3 opções (1ª, 2ª e 3ª).');
    }
    return true;
  };

  const salvar = async () => {
    if (!conferir()) return;

    setSalvando(true);
    try {
      const { pendencias: sobraram, salvo } = await completarMinhaInscricao(equipanteId, dono, {
        ...(pNome ? { nome } : {}),
        ...(pPastor ? { pastor } : {}),
        ...(pFamiliar ? { familiarNome: familiarCorrigido } : {}),
        ...(temIgreja ? { igreja, igrejaOutra: igrejaEhOutra(igreja) ? igrejaOutra : null } : {}),
        ...(temCpf ? (semCpf ? { semCpf: true, nacionalidade } : { cpf }) : {}),
        ...(temNascimento ? { nascimento } : {}),
        ...(temSexo ? { sexo } : {}),
        ...(pTelefone ? { whatsapp } : {}),
        ...(temParentesco ? { parentesco, familiarNome: parentesco === 'NÃO TENHO' ? '' : familiarNome } : {}),
        ...(temAreas ? { area1: areas.areaTrabalhoOpcao1, area2: areas.areaTrabalhoOpcao2, area3: areas.areaTrabalhoOpcao3 } : {}),
      });
      toast({
        title: sobraram.length === 0 ? 'Cadastro completo' : 'Quase lá',
        description: sobraram.length === 0 ? 'Obrigado por completar!' : 'Ainda falta uma informação.',
        className: 'bg-green-600 text-white',
      });
      onCorrigido?.(sobraram, salvo);
    } catch (err) {
      toast({ title: 'Não deu certo', description: err.message, variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  const campo = 'bg-white/10 border-white/20 text-white placeholder:text-white/50';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        role="dialog"
        aria-modal="true"
        className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-xl border border-amber-500/40 bg-neutral-950 shadow-2xl"
      >
        <div className="flex items-start gap-3 p-5 border-b border-white/10 bg-amber-500/10 sticky top-0 z-10 backdrop-blur">
          <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-xl font-bold text-white">Complete o seu cadastro</h3>
            <p className="text-sm text-amber-100/90 mt-1">
              {antesDeRevelar
                ? 'Antes de revelarmos qual foi a sua área, precisamos de algumas informações que estão faltando na sua inscrição.'
                : 'Faltam algumas informações na sua inscrição. Complete abaixo para continuar — leva poucos minutos.'}
            </p>
          </div>
        </div>

        <div className="p-5 space-y-7">
          {pNome && (
            <Secao Icone={User} texto="Confira o seu nome: ele só pode ter letras, com nome e sobrenome.">
              <div className="space-y-2">
                <Label htmlFor="correcao-nome" className="text-white">Nome completo</Label>
                <Input
                  id="correcao-nome"
                  value={nome}
                  onChange={(e) => setNome(limparNomePessoa(e.target.value))}
                  placeholder="Seu nome completo (só letras)"
                  autoComplete="name"
                  className={campo}
                />
              </div>
            </Secao>
          )}

          {(pPastor || pFamiliar) && (
            <Secao Icone={Users} texto="Confira estes nomes: só letras, sem números ou símbolos.">
              <div className="space-y-3">
                {pPastor && (
                  <div className="space-y-2">
                    <Label htmlFor="correcao-pastor" className="text-white">Nome do pastor</Label>
                    <Input id="correcao-pastor" value={pastor} onChange={(e) => setPastor(limparNomePessoa(e.target.value))}
                      placeholder="Nome do pastor" className={campo} />
                  </div>
                )}
                {pFamiliar && (
                  <div className="space-y-2">
                    <Label htmlFor="correcao-familiar2" className="text-white">Nome do conhecido / familiar que vai como acampante</Label>
                    <Input id="correcao-familiar2" value={familiarCorrigido} onChange={(e) => setFamiliarCorrigido(limparNomePessoa(e.target.value))}
                      placeholder="Nome do conhecido/familiar" className={campo} />
                  </div>
                )}
              </div>
            </Secao>
          )}

          {temIgreja && (
            <Secao Icone={Church} texto="Em qual igreja você congrega? Se não congrega em nenhuma, escolha “Não se aplica”.">
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
                      className={campo}
                    />
                  </div>
                )}
              </div>
            </Secao>
          )}

          {temCpf && (
            <Secao Icone={Fingerprint} texto={cpfDoDono ? 'Confirme o seu CPF.' : 'Informe o seu CPF. Quem é estrangeiro e não tem CPF informa a nacionalidade.'}>
              <div className="space-y-3">
                {!semCpf && (
                  <div className="space-y-2">
                    <Label htmlFor="correcao-cpf" className="text-white">CPF</Label>
                    <Input
                      id="correcao-cpf"
                      value={cpf}
                      onChange={(e) => setCpf(formatCPF(e.target.value))}
                      placeholder="000.000.000-00"
                      maxLength={14}
                      inputMode="numeric"
                      // Quem entrou com um CPF fica com ele: e o que prova quem e.
                      readOnly={!!cpfDoDono}
                      className={`${campo} ${cpfDoDono ? 'opacity-70' : ''}`}
                    />
                  </div>
                )}
                {!cpfDoDono && (
                  <div className="flex items-center gap-2">
                    <Switch id="correcao-sem-cpf" checked={semCpf} onCheckedChange={setSemCpf} />
                    <Label htmlFor="correcao-sem-cpf" className="text-white cursor-pointer select-none">
                      Sou estrangeiro (não tenho CPF)
                    </Label>
                  </div>
                )}
                {semCpf && (
                  <div className="space-y-2">
                    <Label className="text-white">Nacionalidade</Label>
                    <Select value={nacionalidade} onValueChange={setNacionalidade}>
                      <SelectTrigger className={campo}>
                        <SelectValue placeholder="Selecione o seu país..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {NACIONALIDADES.map((pais) => (
                          <SelectItem key={pais.iso} value={pais.iso}>
                            <span className="flex items-center gap-2">
                              <span aria-hidden="true">{bandeiraDoPais(pais.iso)}</span>
                              {pais.nome}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </Secao>
          )}

          {(temNascimento || temSexo) && (
            <Secao Icone={temNascimento ? CalendarDays : User} texto="Seus dados pessoais.">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {temNascimento && (
                  <div className="space-y-2">
                    <Label htmlFor="correcao-nascimento" className="text-white">Data de nascimento</Label>
                    <CampoDataNascimento
                      id="correcao-nascimento"
                      max={new Date().toISOString().slice(0, 10)}
                      value={nascimento}
                      onChange={(e) => setNascimento(e.target.value)}
                      className={`${campo} [color-scheme:dark]`}
                    />
                  </div>
                )}
                {temSexo && (
                  <div className="space-y-2">
                    <Label className="text-white">Sexo</Label>
                    <Select value={sexo} onValueChange={setSexo}>
                      <SelectTrigger className={campo}>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Masculino">Masculino</SelectItem>
                        <SelectItem value="Feminino">Feminino</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </Secao>
          )}

          {pTelefone && (
            <Secao
              Icone={Phone}
              texto={pTelefone.valor
                ? <>O WhatsApp que você informou foi <strong className="text-white">{pTelefone.valor}</strong>{problemaAtual ? <> — {problemaAtual.replace(/\s*Ex\.:.*$/, '')}</> : null}</>
                : 'Informe o seu WhatsApp: é por ele que a organização fala com você.'}
            >
              <div className="space-y-2">
                <Label htmlFor="correcao-whatsapp" className="text-white">WhatsApp</Label>
                <TelefoneInput
                  id="correcao-whatsapp"
                  name="whatsapp"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  estrangeiro={estrangeiro}
                />
              </div>
            </Secao>
          )}

          {temParentesco && (
            <Secao Icone={Users} texto="Tem algum conhecido / familiar que vai participar como ACAMPANTE no projeto?">
              <div className="space-y-3">
                <Select value={parentesco} onValueChange={setParentesco}>
                  <SelectTrigger className={campo}>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PARENTESCOS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
                {parentesco && parentesco !== 'NÃO TENHO' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="correcao-familiar" className="text-white">Nome do conhecido / familiar</Label>
                    <Input
                      id="correcao-familiar"
                      value={familiarNome}
                      onChange={(e) => setFamiliarNome(limparNomePessoa(e.target.value))}
                      placeholder="Nome do conhecido/familiar"
                      className={campo}
                    />
                  </div>
                )}
              </div>
            </Secao>
          )}

          {temAreas && (
            <Secao Icone={Briefcase} texto="Escolha as suas 3 opções de área de trabalho, da que você mais quer para a que menos quer.">
              <AreasDeTrabalho
                semExtras
                formData={areas}
                handleChange={(e) => setAreas((a) => ({ ...a, [e.target.name]: e.target.value }))}
                handleSelectChange={(nome, valor) => setAreas((a) => ({ ...a, [nome]: valor }))}
              />
            </Secao>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-2 p-5 border-t border-white/10 sticky bottom-0 bg-neutral-950">
          {onSair ? (
            <Button variant="ghost" onClick={onSair} disabled={salvando}
              className="text-gray-400 hover:text-white hover:bg-white/10">
              Não sou eu — sair
            </Button>
          ) : <span />}
          <Button onClick={salvar} disabled={salvando} className="bg-emerald-600 hover:bg-emerald-700 text-white sm:min-w-40">
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar e continuar'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default CorrecaoCadastroDialog;
