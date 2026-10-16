import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, HelpCircle, KeyRound, Loader2, Lock, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCPF } from '@/utils/formatters';
import { validateCPF } from '@/utils/validation';
import { mascararTelefone } from '@/utils/telefone';
import { buscarCadastro, pedirAcessoCadastro, situacaoAcessoCadastro } from '@/services/acessoCadastroService';

/**
 * "Você já tem cadastro no sistema?" (16/10/2026, Patrick) -- substitui a
 * tela "Você foi inscrito pela organização?".
 *
 * Aparece com as inscricoes de equipante FECHADAS, quando o CPF digitado nao
 * esta na base. Sim -> a pessoa informa o CPF correto ou o nome completo:
 *   - CPF que existe: entra normalmente;
 *   - nome igual com CPF: "achamos, informe o CPF correto"; errou de novo ->
 *     "Não consigo acessar meu cadastro" (pedido para a organizacao);
 *   - nome igual sem CPF (inscricao manual): "procure a organização", e a
 *     pessoa deixa o aviso com o WhatsApp;
 *   - nada: "nome e CPF não encontrados".
 * Nome e pedido de ajuda so no dia da Reuniao de Leitura de Escala, 15h-19h;
 * fora disso so o CPF correto. 5 tentativas por aparelho, contadas no servidor.
 */

const ehCpf = (texto) => (texto.replace(/\D/g, '').length >= 11 && !/[a-zà-ú]/i.test(texto));

const dataBR = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR') : '');

const Aviso = ({ tom = 'amber', icone: Icone = AlertCircle, children }) => {
  const cores = {
    amber: 'bg-amber-500/10 border-amber-500/30 text-amber-100',
    red: 'bg-red-500/10 border-red-500/30 text-red-100',
    green: 'bg-green-500/10 border-green-500/30 text-green-100',
    blue: 'bg-blue-500/10 border-blue-500/30 text-blue-100'
  };
  return (
    <div className={`rounded-lg border p-3 text-sm flex items-start gap-2 ${cores[tom]}`}>
      <Icone className="w-4 h-4 shrink-0 mt-0.5" />
      <div>{children}</div>
    </div>
  );
};

const AcessoCadastro = ({ cpfDigitado, onEntrarComCpf, onNao }) => {
  const [etapa, setEtapa] = useState('pergunta');    // pergunta | busca | pedido | enviado
  const [janela, setJanela] = useState(null);         // { janela, leitura_escala }
  const [valor, setValor] = useState('');
  const [resultado, setResultado] = useState(null);   // ultima resposta do servidor
  const [jaAchouComCpf, setJaAchouComCpf] = useState(false);
  const [podePedir, setPodePedir] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState('');
  const [pedido, setPedido] = useState({ nome: '', cpf: cpfDigitado || '', whatsapp: '', motivo: 'nao_consigo' });
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    situacaoAcessoCadastro().then((r) => setJanela(r && r.janela !== undefined ? r : { janela: false }));
  }, []);

  const dentroDaJanela = !!janela?.janela;
  const diaLeitura = dataBR(janela?.leitura_escala);

  const buscar = async () => {
    setErro('');
    const texto = valor.trim();
    if (!texto) { setErro('Informe o CPF correto ou o seu nome completo.'); return; }
    const porCpf = ehCpf(texto);
    if (porCpf && !validateCPF(formatCPF(texto))) { setErro('CPF inválido. Confira os números.'); return; }
    if (!porCpf && (texto.length < 5 || !texto.includes(' '))) { setErro('Escreva o seu nome completo (nome e sobrenome).'); return; }

    setBuscando(true);
    const r = await buscarCadastro(porCpf ? { cpf: texto } : { nome: texto });
    setBuscando(false);
    if (!r.ok) { setErro(r.erro); return; }

    if (r.situacao === 'cpf_ok') {
      onEntrarComCpf(formatCPF(texto));
      return;
    }
    // O nome que a pessoa digitou ja vai preenchido no pedido de ajuda.
    if (!porCpf) setPedido((p) => ({ ...p, nome: texto }));
    if (r.situacao === 'achou_com_cpf') {
      setJaAchouComCpf(true);
      setValor('');
    }
    if (r.situacao === 'achou_sem_cpf') setPedido((p) => ({ ...p, motivo: 'sem_cpf' }));
    if (r.situacao === 'cpf_nao_encontrado' && jaAchouComCpf) setPodePedir(true);
    if (r.situacao === 'limite') setPodePedir(true);
    setResultado({ ...r, porCpf, segundaVez: r.situacao === 'cpf_nao_encontrado' && jaAchouComCpf });
  };

  const enviarPedido = async () => {
    setErro('');
    setEnviando(true);
    const r = await pedirAcessoCadastro(pedido);
    setEnviando(false);
    if (!r.ok) { setErro(r.erro); return; }
    setEtapa('enviado');
  };

  const restam = (r) => (typeof r?.restam === 'number'
    ? ` Você tem mais ${r.restam} ${r.restam === 1 ? 'tentativa' : 'tentativas'} hoje.` : '');

  const mensagem = () => {
    if (!resultado) return null;
    switch (resultado.situacao) {
      case 'achou_com_cpf':
        return <Aviso tom="blue" icone={KeyRound}>Achamos o seu cadastro, porém informe o seu <strong>CPF corretamente</strong> para entrar na sua inscrição.{restam(resultado)}</Aviso>;
      case 'cpf_nao_encontrado':
        return resultado.segundaVez
          ? <Aviso tom="red">Você informou novamente um CPF inválido para este cadastro.{restam(resultado)}</Aviso>
          : <Aviso>Não encontramos esse CPF.{dentroDaJanela ? ' Confira os números ou informe o seu nome completo.' : ' Confira os números.'}{restam(resultado)}</Aviso>;
      case 'achou_sem_cpf':
        return <Aviso tom="blue" icone={HelpCircle}>Achamos o seu cadastro, porém ele está <strong>sem CPF</strong>. Procure os organizadores para completar o seu cadastro — deixe o seu WhatsApp aqui embaixo para eles já saberem que é você.</Aviso>;
      case 'nao_encontrado':
        return <Aviso tom="red">Tanto o nome quanto o CPF não foram encontrados. Por favor, verifique com a organização.{restam(resultado)}</Aviso>;
      case 'fora_do_horario':
        return <Aviso>A busca pelo nome só funciona no dia da Reunião de Leitura de Escala{diaLeitura ? ` (${diaLeitura})` : ''}, das 15h às 19h. Informe o CPF correto ou procure a organização.</Aviso>;
      case 'limite':
        return <Aviso tom="red" icone={Lock}>Você atingiu o limite de 5 tentativas por hoje. Procure a organização.</Aviso>;
      default:
        return null;
    }
  };

  const formularioPedido = (titulo) => (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
      <p className="text-white font-medium">{titulo}</p>
      <div className="space-y-1.5">
        <Label htmlFor="pedidoNome" className="text-white text-sm">Nome completo</Label>
        <Input id="pedidoNome" value={pedido.nome} onChange={(e) => setPedido((p) => ({ ...p, nome: e.target.value }))}
          className="bg-white/10 border-white/20 text-white" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pedidoCpf" className="text-white text-sm">Seu CPF</Label>
        <Input id="pedidoCpf" inputMode="numeric" value={pedido.cpf}
          onChange={(e) => setPedido((p) => ({ ...p, cpf: formatCPF(e.target.value) }))}
          className="bg-white/10 border-white/20 text-white" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pedidoZap" className="text-white text-sm">WhatsApp</Label>
        <Input id="pedidoZap" inputMode="tel" placeholder="(21) 99999-9999" value={pedido.whatsapp}
          onChange={(e) => setPedido((p) => ({ ...p, whatsapp: mascararTelefone(e.target.value) }))}
          className="bg-white/10 border-white/20 text-white placeholder:text-white/40" />
      </div>
      {erro && <p className="text-red-300 text-sm">{erro}</p>}
      <Button onClick={enviarPedido} disabled={enviando} className="w-full">
        {enviando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
        Enviar para a organização
      </Button>
      <p className="text-[11px] text-gray-500">
        A organização confirma que é você, coloca o seu CPF no cadastro e aí você entra com ele normalmente.
      </p>
    </div>
  );

  if (etapa === 'enviado') {
    return (
      <Card className="glass-effect border-white/10 bg-black/40 max-w-xl mx-auto">
        <CardContent className="pt-6 space-y-4 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto" />
          <p className="text-white text-lg font-semibold">Pedido enviado!</p>
          <p className="text-gray-300 text-sm">
            Procure a organização na reunião para confirmar a sua identidade. Depois que ela colocar o
            seu CPF no cadastro, é só entrar aqui com ele.
          </p>
          <Button variant="outline" onClick={onNao} className="border-white/20 text-gray-300 hover:text-white">Voltar</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-effect border-white/10 bg-black/40 max-w-xl mx-auto">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Search className="w-5 h-5 text-blue-400" />
          {etapa === 'pergunta' ? 'Você já tem cadastro no sistema?' : 'Encontrar o meu cadastro'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {etapa === 'pergunta' && (
          <>
            <p className="text-gray-300 text-sm">
              Não encontramos o CPF <strong className="text-white">{cpfDigitado}</strong>. Você já tem cadastro no sistema?
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => setEtapa('busca')} className="py-6">Sim</Button>
              <Button variant="outline" onClick={onNao} className="py-6 border-white/20 text-gray-300 hover:text-white">Não</Button>
            </div>
          </>
        )}

        {etapa === 'busca' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="cpfOuNome" className="text-white">
                {jaAchouComCpf ? 'Informe o seu CPF correto' : dentroDaJanela ? 'Informe o CPF correto ou o seu nome completo' : 'Informe o CPF correto'}
              </Label>
              <Input
                id="cpfOuNome"
                value={valor}
                inputMode={jaAchouComCpf || !dentroDaJanela ? 'numeric' : 'text'}
                onChange={(e) => {
                  const t = e.target.value;
                  setValor(ehCpf(t) || (jaAchouComCpf && /^[\d.\-\s]*$/.test(t)) ? formatCPF(t) : t);
                  setErro('');
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') buscar(); }}
                placeholder={jaAchouComCpf || !dentroDaJanela ? '000.000.000-00' : 'CPF ou nome completo'}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              />
              {erro && etapa === 'busca' && !(resultado?.situacao === 'achou_sem_cpf' && dentroDaJanela) && <p className="text-red-300 text-sm">{erro}</p>}
              {!dentroDaJanela && janela && !jaAchouComCpf && resultado?.situacao !== 'fora_do_horario' && (
                <p className="text-[11px] text-gray-500">
                  A busca pelo nome só funciona no dia da Reunião de Leitura de Escala{diaLeitura ? ` (${diaLeitura})` : ''}, das 15h às 19h.
                </p>
              )}
            </div>

            {mensagem()}

            {resultado?.situacao !== 'limite' && (
              <Button onClick={buscar} disabled={buscando} className="w-full">
                {buscando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {jaAchouComCpf ? 'Entrar com este CPF' : 'Procurar'}
              </Button>
            )}

            {resultado?.situacao === 'achou_sem_cpf' && dentroDaJanela && formularioPedido('Avisar a organização')}

            {podePedir && dentroDaJanela && etapa === 'busca' && (
              <button type="button" onClick={() => { setErro(''); setEtapa('pedido'); }}
                className="w-full text-sm text-sky-300 underline underline-offset-2 hover:text-sky-200">
                Não consigo acessar meu cadastro
              </button>
            )}

            <Button variant="ghost" onClick={onNao} className="w-full text-gray-400 hover:text-white hover:bg-white/10">
              Voltar
            </Button>
          </>
        )}

        {etapa === 'pedido' && (
          <>
            {formularioPedido('Não consigo acessar meu cadastro')}
            <Button variant="ghost" onClick={() => { setErro(''); setEtapa('busca'); }}
              className="w-full text-gray-400 hover:text-white hover:bg-white/10">
              Voltar
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AcessoCadastro;
