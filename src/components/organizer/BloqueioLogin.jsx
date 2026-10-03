import React from 'react';
import { Lock, RefreshCw, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Aviso de login bloqueado por senha errada, com o "Liberar agora".
 *
 * Aparece nas telas de senhas (organizadores e parceiros) so para a conta
 * Desenvolvedores -- para os outros logins o banco nem devolve os bloqueios.
 * O bloqueio some sozinho no horario indicado; o botao e para quem precisa
 * entrar antes disso.
 */

const hora = (iso) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const BloqueioLogin = ({ bloqueio, onLiberar, liberando = false }) => {
  if (!bloqueio) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-2 mt-1">
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-red-500/40 bg-red-500/10 text-red-300">
        <Lock className="w-3 h-3" />
        bloqueado por senha errada até {hora(bloqueio.bloqueado_ate)}
      </span>
      <Button
        type="button" size="sm" variant="outline" disabled={liberando}
        onClick={onLiberar}
        className="h-7 px-2.5 text-xs bg-transparent text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/15 hover:text-emerald-200"
      >
        {liberando
          ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          : <><Unlock className="w-3.5 h-3.5 mr-1" />Liberar agora</>}
      </Button>
    </span>
  );
};

export default BloqueioLogin;
