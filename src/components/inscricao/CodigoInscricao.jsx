import React, { useEffect, useState } from 'react';
import { CheckCircle, KeyRound, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fetchConfigPublica } from '@/services/publicDataService';
import { conferirCodigoInscricao } from '@/services/codigosInscricaoService';

/**
 * Codigo de inscricao do equipante (07/11/2026, Patrick). Duas formas:
 *  - passo proprio, logo depois do CPF (quem nao tem pendencia na ficha);
 *  - quadro no fim do formulario (quem tinha pendencia: so aparece depois de
 *    corrigir tudo). Ali fica dentro do <form> da inscricao, por isso nao usa
 *    <form> proprio e o Enter so confere o codigo.
 * Maiusculas e minusculas nao contam. O servidor confere de novo no envio.
 */
const CodigoInscricao = ({ onConferido, onVoltar, noFormulario = false, conferido = '' }) => {
  const [codigo, setCodigo] = useState('');
  const [edicao, setEdicao] = useState(null);
  const [conferindo, setConferindo] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let vivo = true;
    fetchConfigPublica()
      .then((c) => { if (vivo && c?.edicao_numero) setEdicao(c.edicao_numero); })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  const titulo = `Insira o código da inscrição${edicao ? ` da ${edicao}ª edição` : ''}`;

  const conferir = async () => {
    setErro('');
    const digitado = codigo.trim();
    if (!digitado) {
      setErro('Digite o código que a organização passou.');
      return;
    }
    setConferindo(true);
    try {
      const r = await conferirCodigoInscricao(digitado);
      if (!r?.ok) {
        setErro('Código inválido. Confira com a organização.');
        return;
      }
      await onConferido(digitado);
    } catch (err) {
      console.error('codigo_inscricao_conferir', err?.message || err);
      setErro('Não foi possível conferir o código agora. Tente de novo.');
    } finally {
      setConferindo(false);
    }
  };

  if (noFormulario && conferido) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-center gap-3 text-sm text-emerald-100">
        <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
        Código da inscrição conferido.
      </div>
    );
  }

  const campo = (
    <div className="space-y-2">
      <Label htmlFor="codigo-inscricao" className="text-white">Código da inscrição</Label>
      <Input
        id="codigo-inscricao"
        value={codigo}
        onChange={(e) => setCodigo(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            conferir();
          }
        }}
        maxLength={40}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
        placeholder="Digite o código"
      />
      {erro && <p className="text-sm text-red-300" role="alert">{erro}</p>}
    </div>
  );

  return (
    <div className={`${noFormulario ? '' : 'max-w-xl mx-auto '}rounded-xl border border-blue-500/30 bg-black/50 p-5 sm:p-6 space-y-5`}>
      <div className="flex items-start gap-3">
        <KeyRound className="w-6 h-6 text-blue-400 shrink-0 mt-0.5" />
        <div>
          <h2 className="text-lg font-bold text-white">{titulo}</h2>
          <p className="text-sm text-gray-300 mt-1">
            {noFormulario
              ? 'Sua ficha está completa. Para enviar a inscrição, informe o código que a organização passou.'
              : 'A inscrição de equipante só é feita com o código que a organização passa na reunião de cadastro.'}
          </p>
          {!noFormulario && (
            <p className="text-sm font-semibold text-yellow-300 mt-2">
              “Atenção!! A participação da reunião é obrigatória para equipe de trabalho.”
            </p>
          )}
        </div>
      </div>
      {campo}
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={conferir} disabled={conferindo} className="bg-blue-600 hover:bg-blue-700 text-white">
          {conferindo && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          {noFormulario ? 'Conferir código' : 'Continuar'}
        </Button>
        {onVoltar && (
          <Button type="button" variant="ghost" onClick={onVoltar} className="text-gray-300 hover:text-white hover:bg-white/10">
            Voltar
          </Button>
        )}
      </div>
    </div>
  );
};

export default CodigoInscricao;
