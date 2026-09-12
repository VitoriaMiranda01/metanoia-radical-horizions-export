import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { useToast } from '@/components/ui/use-toast';
import { Eye, EyeOff, Heart, Shield, Users, AlertCircle, CheckCircle2, KeyRound, MailCheck } from 'lucide-react';
import { buscarIgrejaPorCodigo } from '@/constants/igrejas';
import { trocarSenhaIgreja, solicitarRedefinicaoSenha } from '@/services/senhasParceirosService';

// Espelha as regras que o banco aplica em _criticar_senha (ver migration
// schema-update-20260911d). Aqui e so cortesia -- avisar antes de enviar, em
// vez de o parceiro tomar o erro depois. Quem MANDA continua sendo o servidor:
// se estas regras e as de la discordarem, vale a resposta do banco.
const criticarSenha = (senha, codigo) => {
  const valor = senha || '';
  if (valor.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (!/[A-Za-zÀ-ÿ]/.test(valor)) return 'A senha precisa ter pelo menos uma letra.';
  if (!/[0-9]/.test(valor)) return 'A senha precisa ter pelo menos um número.';
  if (valor.toLowerCase().includes('metanoia')) return 'A senha não pode conter a palavra "metanoia".';
  if (codigo && valor.toLowerCase().includes(String(codigo).toLowerCase())) {
    return 'A senha não pode conter o código da sua igreja.';
  }
  return null;
};

const LoginPage = () => {
  const {
    loginAsOrganizador,
    loginAsIgreja,
    organizadorUser,
    igrejaUser
  } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [selectedType, setSelectedType] = useState('organizador');
  const [formData, setFormData] = useState({
    identifier: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const errorTimeoutRef = useRef(null);

  // Igreja reconhecida a partir do codigo digitado (mostrada embaixo do
  // campo, para o parceiro conferir antes de digitar a senha).
  const [igrejaDoCodigo, setIgrejaDoCodigo] = useState(null);
  const [codigoDesconhecido, setCodigoDesconhecido] = useState(false);

  // 'login' | 'definir-senha' | 'pedido-enviado'
  const [etapa, setEtapa] = useState('login');
  const [senhaTemporaria, setSenhaTemporaria] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');

  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);

  const showError = (msg) => {
    setErrorMessage(msg);
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    errorTimeoutRef.current = setTimeout(() => {
      setErrorMessage('');
    }, 8000);
  };

  if (organizadorUser) return <Navigate to="/gerenciar" replace />;
  if (igrejaUser) return <Navigate to="/parceiros" replace />;

  const ehParceiro = selectedType === 'parceiro';

  // Ao sair do campo do codigo: acha a igreja e corrige o codigo para a forma
  // canonica (quem digita "1" quer dizer "01" -- sem isso o login falharia
  // sem a pessoa entender por que).
  const handleCodigoBlur = () => {
    if (!ehParceiro) return;
    const digitado = formData.identifier.trim();
    if (!digitado) {
      setIgrejaDoCodigo(null);
      setCodigoDesconhecido(false);
      return;
    }
    const achada = buscarIgrejaPorCodigo(digitado);
    setIgrejaDoCodigo(achada);
    setCodigoDesconhecido(!achada);
    if (achada && achada.codigo !== digitado) {
      setFormData((prev) => ({ ...prev, identifier: achada.codigo }));
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setErrorMessage('');

    if (!formData.identifier.trim() || !formData.password.trim()) {
      showError("Por favor, preencha todos os campos.");
      return;
    }

    setLoading(true);

    try {
      if (selectedType === 'organizador') {
        await loginAsOrganizador(formData.identifier, formData.password);
        toast({
          title: "Login realizado com sucesso!",
          description: `Bem-vindo(a), organizador!`
        });
        setFormData({ identifier: '', password: '' });
        navigate('/gerenciar');
      } else {
        const resultado = await loginAsIgreja(formData.identifier, formData.password);

        // Senha ainda e a temporaria: nao abre sessao, pede a senha propria.
        if (resultado?.precisa_trocar_senha) {
          setSenhaTemporaria(formData.password);
          setNovaSenha('');
          setConfirmaSenha('');
          setEtapa('definir-senha');
          return;
        }

        toast({
          title: "Login realizado com sucesso!",
          description: `Bem-vindo(a), parceiro!`
        });
        setFormData({ identifier: '', password: '' });
        navigate('/parceiros');
      }
    } catch (error) {
      showError(error.message || "Erro desconhecido ao realizar login");
    } finally {
      setLoading(false);
    }
  };

  const handleDefinirSenha = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (novaSenha !== confirmaSenha) {
      showError('As duas senhas não são iguais.');
      return;
    }
    const critica = criticarSenha(novaSenha, formData.identifier.trim());
    if (critica) {
      showError(critica);
      return;
    }

    setLoading(true);
    try {
      const resposta = await trocarSenhaIgreja(formData.identifier, senhaTemporaria, novaSenha);
      if (!resposta?.ok) {
        showError(resposta?.erro || 'Não foi possível criar a senha. Tente novamente.');
        return;
      }

      // Senha criada: entra de verdade, agora com a senha dela.
      await loginAsIgreja(formData.identifier, novaSenha);
      toast({
        title: 'Senha criada com sucesso!',
        description: 'Use essa senha nos próximos acessos.'
      });
      setSenhaTemporaria('');
      setNovaSenha('');
      setConfirmaSenha('');
      setFormData({ identifier: '', password: '' });
      navigate('/parceiros');
    } catch (error) {
      showError(error.message || 'Não foi possível criar a senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handlePedirNovaSenha = async () => {
    const codigo = formData.identifier.trim();
    if (!codigo) {
      showError('Digite o código da sua igreja antes de pedir uma nova senha.');
      return;
    }
    setErrorMessage('');
    setLoading(true);
    try {
      await solicitarRedefinicaoSenha(codigo);
      setEtapa('pedido-enviado');
    } catch (error) {
      showError('Não foi possível enviar o pedido agora. Tente novamente em instantes.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = e => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
    if (e.target.name === 'identifier') {
      setIgrejaDoCodigo(null);
      setCodigoDesconhecido(false);
    }
  };

  const handleTypeChange = (type) => {
    setSelectedType(type);
    setFormData({ identifier: '', password: '' });
    setErrorMessage('');
    setIgrejaDoCodigo(null);
    setCodigoDesconhecido(false);
    setEtapa('login');
  };

  const voltarParaLogin = () => {
    setEtapa('login');
    setErrorMessage('');
    setFormData(prev => ({ ...prev, password: '' }));
  };

  const avisoErro = (
    <AnimatePresence>
      {errorMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-md flex items-start gap-2 text-red-200 text-sm"
        >
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <Helmet>
        <title>Login - Metanoia Radical</title>
        <meta name="description" content="Faça login no sistema de inscrições" />
      </Helmet>

      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-black">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-green-600/20 rounded-full blur-3xl floating-animation"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-red-600/20 rounded-full blur-3xl floating-animation" style={{ animationDelay: '2s' }}></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-red-900/10 to-green-900/10 rounded-full blur-3xl"></div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="w-full max-w-md relative z-10">
          <div className="text-center mb-8 flex flex-col items-center">
            <Link to="/" className="cursor-pointer group">
              <motion.div className="mb-6 p-2 bg-white/5 rounded-2xl border border-white/10 pulse-glow group-hover:bg-white/10 transition-all duration-300">
                <img src="https://horizons-cdn.hostinger.com/13c6e949-152b-4918-9648-ee8b27e5e2cf/ea6fe427e17542cbf0e791fb09fba6dc.png" alt="Logo" className="h-24 w-auto object-contain" />
              </motion.div>
            </Link>
            <h1 className="text-3xl font-bold text-white mb-2 tracking-wide uppercase">Metanoia <span className="text-red-600">Radical</span> <span className="text-green-600">SERRA</span></h1>
            <p className="text-gray-400">Acesso Restrito</p>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* Primeiro acesso: criar a senha propria                        */}
          {/* ------------------------------------------------------------- */}
          {etapa === 'definir-senha' && (
            <Card className="glass-effect border-white/10 shadow-2xl bg-black/60">
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-2 w-12 h-12 rounded-full bg-green-500/10 border border-green-500/40 flex items-center justify-center">
                  <KeyRound className="w-6 h-6 text-green-500" />
                </div>
                <CardTitle className="text-2xl text-white">Crie sua senha</CardTitle>
                <CardDescription className="text-gray-400">
                  {igrejaDoCodigo?.nome
                    ? `${igrejaDoCodigo.codigo} — ${igrejaDoCodigo.nome}`
                    : `Igreja ${formData.identifier}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-400 mb-4">
                  Esta é a primeira vez que você entra. A senha que recebeu é temporária —
                  escolha agora uma senha sua, que ninguém mais conhece.
                </p>

                {avisoErro}

                <form onSubmit={handleDefinirSenha} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="novaSenha" className="text-gray-200">Nova senha</Label>
                    <div className="relative">
                      <Input
                        id="novaSenha"
                        type={showPassword ? 'text' : 'password'}
                        value={novaSenha}
                        onChange={(e) => setNovaSenha(e.target.value)}
                        required
                        autoFocus
                        className="bg-white/5 border-white/20 text-white placeholder:text-gray-500 pr-10 focus:border-green-500 transition-colors"
                        placeholder="Mínimo 8, com letras e números"
                      />
                      <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmaSenha" className="text-gray-200">Repita a nova senha</Label>
                    <Input
                      id="confirmaSenha"
                      type={showPassword ? 'text' : 'password'}
                      value={confirmaSenha}
                      onChange={(e) => setConfirmaSenha(e.target.value)}
                      required
                      className="bg-white/5 border-white/20 text-white placeholder:text-gray-500 focus:border-green-500 transition-colors"
                      placeholder="Digite de novo"
                    />
                  </div>

                  <ul className="text-xs text-gray-500 space-y-1 pl-1">
                    <li>• pelo menos 8 caracteres</li>
                    <li>• pelo menos uma letra e um número</li>
                    <li>• não pode conter "metanoia" nem o código da igreja</li>
                  </ul>

                  <Button type="submit" className="w-full bg-gradient-to-r from-green-700 to-green-900 hover:from-green-600 hover:to-green-800 text-white font-bold py-2 px-4 rounded-md transition-all duration-200 shadow-lg mt-2 disabled:opacity-50" disabled={loading}>
                    {loading ? 'Salvando...' : 'SALVAR E ENTRAR'}
                  </Button>

                  <button type="button" onClick={voltarParaLogin} className="w-full text-sm text-gray-500 hover:text-gray-300 transition-colors">
                    Voltar
                  </button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* ------------------------------------------------------------- */}
          {/* Pedido de nova senha enviado                                   */}
          {/* ------------------------------------------------------------- */}
          {etapa === 'pedido-enviado' && (
            <Card className="glass-effect border-white/10 shadow-2xl bg-black/60">
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-2 w-12 h-12 rounded-full bg-green-500/10 border border-green-500/40 flex items-center justify-center">
                  <MailCheck className="w-6 h-6 text-green-500" />
                </div>
                <CardTitle className="text-2xl text-white">Pedido enviado</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-300">
                  A organização foi avisada e vai gerar uma senha nova para a sua igreja.
                </p>
                <p className="text-sm text-gray-400">
                  Por segurança, a senha é enviada para o contato que a organização já tem
                  registrado — e não para quem fez o pedido.
                </p>
                <Button type="button" onClick={voltarParaLogin} className="w-full bg-white/5 border border-white/20 hover:bg-white/10 text-white">
                  Voltar ao login
                </Button>
              </CardContent>
            </Card>
          )}

          {/* ------------------------------------------------------------- */}
          {/* Login normal                                                   */}
          {/* ------------------------------------------------------------- */}
          {etapa === 'login' && (
          <Card className="glass-effect border-white/10 shadow-2xl bg-black/60">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-2xl text-white">Entrar</CardTitle>
              <CardDescription className="text-gray-400">Selecione seu tipo de acesso</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <button type="button" onClick={() => handleTypeChange('organizador')} className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-300 ${selectedType === 'organizador' ? 'border-red-500 bg-red-500/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}>
                  <Users className={`w-6 h-6 mb-2 ${selectedType === 'organizador' ? 'text-red-500' : 'text-gray-400'}`} />
                  <span className={`text-sm font-medium ${selectedType === 'organizador' ? 'text-white' : 'text-gray-400'}`}>Organizador</span>
                </button>
                <button type="button" onClick={() => handleTypeChange('parceiro')} className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-300 ${selectedType === 'parceiro' ? 'border-green-500 bg-green-500/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}>
                  <Shield className={`w-6 h-6 mb-2 ${selectedType === 'parceiro' ? 'text-green-500' : 'text-gray-400'}`} />
                  <span className={`text-sm font-medium ${selectedType === 'parceiro' ? 'text-white' : 'text-gray-400'}`}>Parceiro</span>
                </button>
              </div>

              {avisoErro}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="identifier" className="text-gray-200">
                    {selectedType === 'organizador' ? 'Nome do Organizador' : 'Código da Igreja'}
                  </Label>
                  <Input
                    id="identifier"
                    name="identifier"
                    type="text"
                    value={formData.identifier}
                    onChange={handleChange}
                    onBlur={handleCodigoBlur}
                    required
                    className="bg-white/5 border-white/20 text-white placeholder:text-gray-500 focus:border-red-500 transition-colors"
                    placeholder={selectedType === 'organizador' ? 'Organizador' : 'Código'}
                  />

                  {/* Nome da igreja reconhecida -- para o parceiro perceber na
                      hora se digitou o codigo de outra igreja. */}
                  {ehParceiro && igrejaDoCodigo && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-sm text-green-400 flex items-start gap-1.5 pt-0.5"
                    >
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{igrejaDoCodigo.nome}</span>
                    </motion.p>
                  )}
                  {ehParceiro && codigoDesconhecido && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-sm text-amber-400 flex items-start gap-1.5 pt-0.5"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>Código não encontrado. Confira o número da sua igreja.</span>
                    </motion.p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-gray-200">Senha</Label>
                  <div className="relative">
                    <Input id="password" name="password" type={showPassword ? "text" : "password"} value={formData.password} onChange={handleChange} required className="bg-white/5 border-white/20 text-white placeholder:text-gray-500 pr-10 focus:border-red-500 transition-colors" placeholder="Sua senha" />
                    <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                    </Button>
                  </div>
                </div>

                <Button type="submit" className="w-full bg-gradient-to-r from-red-700 to-red-900 hover:from-red-600 hover:to-red-800 text-white font-bold py-2 px-4 rounded-md transition-all duration-200 shadow-lg mt-2 disabled:opacity-50" disabled={loading}>
                  {loading ? 'Processando...' : 'ENTRAR'}
                </Button>

                {ehParceiro && (
                  <button
                    type="button"
                    onClick={handlePedirNovaSenha}
                    disabled={loading}
                    className="w-full text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                  >
                    Esqueci minha senha
                  </button>
                )}
              </form>
            </CardContent>
          </Card>
          )}

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="text-center mt-6">
            <p className="text-sm text-gray-500 flex items-center justify-center gap-2">Feito com <Heart className="w-4 h-4 text-red-600 fill-red-600" /> para o Reino de Deus</p>
          </motion.div>
        </motion.div>
      </div>
    </>
  );
};
export default LoginPage;
