import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { KeyRound, ShieldCheck, RefreshCw, Copy, Check, MessageSquare, X, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  trocarSenhaOrganizador,
  souOrganizadorMaximo,
  listarOrganizadores,
  redefinirSenhaOrganizador
} from '@/services/senhasParceirosService';

/**
 * Senhas dos organizadores, dentro de Configuracoes.
 *
 * Duas partes:
 *
 *  - "Trocar minha senha": qualquer organizador, provando quem e com a senha
 *    atual;
 *  - "Organizadores": so aparece para a conta de permissao maxima
 *    ("Desenvolvedores"), que gera senha nova para os outros.
 *
 * Quem decide o que a pessoa pode fazer e o BANCO (eh_organizador_maximo).
 * Esconder o bloco aqui e so conforto visual -- se alguem forcasse a chamada,
 * o servidor recusaria do mesmo jeito.
 */

const formatarData = (valor) => {
  if (!valor) return '—';
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};

const BotaoCopiar = ({ texto, rotulo, icone: Icone = Copy }) => {
  const [copiado, setCopiado] = useState(false);
  const { toast } = useToast();

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast({
        title: 'Não consegui copiar',
        description: 'Selecione o texto e copie manualmente.',
        variant: 'destructive'
      });
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={copiar}
      className="h-8 border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/10">
      {copiado
        ? <><Check className="w-4 h-4 mr-1.5 text-emerald-400" />Copiado</>
        : <><Icone className="w-4 h-4 mr-1.5" />{rotulo}</>}
    </Button>
  );
};

const SenhasOrganizadoresManager = () => {
  const { organizadorUser, user } = useAuth();
  const { toast } = useToast();

  const meuNome = organizadorUser?.nome || user?.nome || '';

  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirma, setConfirma] = useState('');
  const [mostrando, setMostrando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [souMaximo, setSouMaximo] = useState(false);
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [confirmando, setConfirmando] = useState(null);
  const [ocupado, setOcupado] = useState(null);
  const [senhaGerada, setSenhaGerada] = useState(null);

  const carregarLista = async () => {
    setCarregando(true);
    try {
      const maximo = await souOrganizadorMaximo();
      setSouMaximo(maximo === true);
      if (maximo === true) {
        setLista((await listarOrganizadores()) || []);
      }
    } catch (err) {
      console.error('SenhasOrganizadoresManager - carregar', err?.message || err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregarLista(); }, []);

  const handleTrocar = async (e) => {
    e.preventDefault();

    if (!meuNome) {
      toast({ title: 'Não consegui identificar seu usuário', description: 'Saia e entre de novo.', variant: 'destructive' });
      return;
    }
    if (nova !== confirma) {
      toast({ title: 'As duas senhas não são iguais', variant: 'destructive' });
      return;
    }

    setSalvando(true);
    try {
      const r = await trocarSenhaOrganizador(meuNome, atual, nova);
      if (!r?.ok) {
        toast({ title: 'Não deu certo', description: r?.erro, variant: 'destructive' });
        return;
      }
      setAtual(''); setNova(''); setConfirma('');
      toast({
        title: 'Senha alterada!',
        description: 'Use a nova senha no próximo acesso.',
        className: 'bg-emerald-600 text-white'
      });
      carregarLista();
    } catch (err) {
      console.error('SenhasOrganizadoresManager - trocar', err?.message || err);
      toast({ title: 'Erro de conexão', description: 'Tente de novo.', variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  const gerarPara = async (nome) => {
    setConfirmando(null);
    setOcupado(nome);
    try {
      const r = await redefinirSenhaOrganizador(nome);
      if (!r?.ok) {
        toast({ title: 'Não deu certo', description: r?.erro, variant: 'destructive' });
        return;
      }
      setSenhaGerada({ nome: r.nome, senha: r.senha, mensagem: r.mensagem });
      carregarLista();
    } catch (err) {
      console.error('SenhasOrganizadoresManager - redefinir', err?.message || err);
      toast({ title: 'Erro de conexão', description: 'Tente de novo.', variant: 'destructive' });
    } finally {
      setOcupado(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* ---------------- Trocar minha senha ---------------- */}
      <div className="bg-black/60 glass-effect rounded-xl border border-white/10 p-6">
        <div className="flex items-center gap-3 mb-1">
          <KeyRound className="w-6 h-6 text-blue-500" />
          <h2 className="text-xl font-bold text-white">Trocar minha senha</h2>
        </div>
        <p className="text-gray-400 text-sm mb-5">
          {meuNome ? <>Você está como <strong className="text-gray-200">{meuNome}</strong>.</> : 'Sua conta de organizador.'}
        </p>

        <form onSubmit={handleTrocar} className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label className="text-gray-200">Senha atual</Label>
            <Input type={mostrando ? 'text' : 'password'} value={atual} required
              onChange={(e) => setAtual(e.target.value)}
              className="bg-white/5 border-white/20 text-white" placeholder="Sua senha de hoje" />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-200">Nova senha</Label>
            <div className="relative">
              <Input type={mostrando ? 'text' : 'password'} value={nova} required
                onChange={(e) => setNova(e.target.value)}
                className="bg-white/5 border-white/20 text-white pr-10" placeholder="Mínimo 8, com letras e números" />
              <Button type="button" variant="ghost" size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setMostrando(!mostrando)}>
                {mostrando ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-200">Repita a nova senha</Label>
            <Input type={mostrando ? 'text' : 'password'} value={confirma} required
              onChange={(e) => setConfirma(e.target.value)}
              className="bg-white/5 border-white/20 text-white" placeholder="Digite de novo" />
          </div>

          <div className="md:col-span-3 flex flex-wrap items-center gap-4">
            <Button type="submit" disabled={salvando}
              className="bg-blue-600 hover:bg-blue-700 text-white">
              {salvando ? 'Salvando...' : 'Salvar nova senha'}
            </Button>
            <span className="text-xs text-gray-500">
              Mínimo 8 caracteres, com letra e número. Não pode conter "metanoia" nem o seu nome de usuário.
            </span>
          </div>
        </form>
      </div>

      {/* ---------------- Organizadores (só o login máximo) ---------------- */}
      {souMaximo && (
        <div className="bg-black/60 glass-effect rounded-xl border border-white/10 p-6">
          <div className="flex items-center gap-3 mb-1">
            <ShieldCheck className="w-6 h-6 text-amber-400" />
            <h2 className="text-xl font-bold text-white">Organizadores</h2>
            <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/15">
              permissão máxima
            </Badge>
          </div>
          <p className="text-gray-400 text-sm mb-5">
            Gere uma senha nova para quem esqueceu. Quem receber será obrigado a criar a própria senha no primeiro acesso.
          </p>

          {senhaGerada && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="mb-5 bg-emerald-500/10 border border-emerald-500/40 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-emerald-300 font-semibold">Senha nova para {senhaGerada.nome}</p>
                  <p className="font-mono text-2xl text-white mt-2 tracking-wide break-all">{senhaGerada.senha}</p>
                  <p className="text-sm text-gray-300 mt-2">
                    Anote ou copie agora: esta senha não aparece de novo. Se fechar sem copiar, é só gerar outra.
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setSenhaGerada(null)}
                  className="text-gray-400 hover:text-white shrink-0">
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                <BotaoCopiar texto={senhaGerada.senha} rotulo="Copiar senha" />
                {senhaGerada.mensagem && (
                  <BotaoCopiar icone={MessageSquare} rotulo="Copiar mensagem pronta" texto={senhaGerada.mensagem} />
                )}
              </div>
            </motion.div>
          )}

          {carregando ? (
            <div className="py-8 text-center text-gray-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              Carregando...
            </div>
          ) : (
            <div className="space-y-2">
              {lista.map((o) => (
                <div key={o.nome}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-white font-medium flex items-center gap-2 flex-wrap">
                      {o.nome}
                      {o.eh_o_maximo && (
                        <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/15">
                          esta é a sua conta
                        </Badge>
                      )}
                      {!o.senha_definida && (
                        <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/15">
                          senha temporária
                        </Badge>
                      )}
                      {!o.protecao_forte && (
                        <Badge className="bg-gray-500/15 text-gray-300 border-gray-500/30 hover:bg-gray-500/15">
                          proteção antiga
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Último acesso: {formatarData(o.ultimo_acesso)}
                      {' · '}Senha alterada: {formatarData(o.senha_atualizada_em)}
                    </p>
                  </div>

                  {o.eh_o_maximo ? (
                    <span className="text-xs text-gray-500">use "Trocar minha senha" acima</span>
                  ) : confirmando === o.nome ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400">Gerar nova senha?</span>
                      <Button size="sm" variant="outline" disabled={ocupado === o.nome}
                        onClick={() => setConfirmando(null)}
                        className="h-8 px-3 border-white/10 bg-transparent text-gray-300 hover:text-white hover:bg-white/10">
                        Cancelar
                      </Button>
                      <Button size="sm" disabled={ocupado === o.nome} onClick={() => gerarPara(o.nome)}
                        className="h-8 px-4 bg-emerald-600 hover:bg-emerald-700 text-white">
                        {ocupado === o.nome ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'OK'}
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" onClick={() => setConfirmando(o.nome)}
                      className="h-8 bg-blue-600 hover:bg-blue-700 text-white">
                      <KeyRound className="w-4 h-4 mr-1.5" />
                      Nova senha
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 flex items-start gap-2 text-xs text-gray-500">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400/70" />
            <span>
              "Proteção antiga" é a senha que a pessoa nunca trocou desde o começo do sistema. Ela sobe para
              a proteção nova assim que a senha for alterada — pela própria pessoa ou por aqui.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SenhasOrganizadoresManager;
