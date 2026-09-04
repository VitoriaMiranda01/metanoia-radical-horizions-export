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
import { Eye, EyeOff, Heart, Shield, Users, AlertCircle } from 'lucide-react';

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
    }, 5000);
  };

  if (organizadorUser) return <Navigate to="/gerenciar" replace />;
  if (igrejaUser) return <Navigate to="/parceiros" replace />;
  
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
        await loginAsIgreja(formData.identifier, formData.password);
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
  
  const handleChange = e => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleTypeChange = (type) => {
    setSelectedType(type);
    setFormData({ identifier: '', password: '' });
    setErrorMessage('');
  };

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

              <AnimatePresence>
                {errorMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-md flex items-center gap-2 text-red-200 text-sm"
                  >
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    <span>{errorMessage}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="identifier" className="text-gray-200">
                    {selectedType === 'organizador' ? 'Nome do Organizador' : 'Código da Igreja'}
                  </Label>
                  <Input id="identifier" name="identifier" type="text" value={formData.identifier} onChange={handleChange} required className="bg-white/5 border-white/20 text-white placeholder:text-gray-500 focus:border-red-500 transition-colors" placeholder={selectedType === 'organizador' ? 'Organizador' : 'Código'} />
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
              </form>
            </CardContent>
          </Card>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="text-center mt-6">
            <p className="text-sm text-gray-500 flex items-center justify-center gap-2">Feito com <Heart className="w-4 h-4 text-red-600 fill-red-600" /> para o Reino de Deus</p>
          </motion.div>
        </motion.div>
      </div>
    </>
  );
};
export default LoginPage;