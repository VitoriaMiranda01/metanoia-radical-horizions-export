import React, { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { declararCiencia } from '@/services/ocorrenciasService';
import { FRASE_CIENCIA, TITULO_COMUNICADO } from '@/constants/comunicados';

const normalizar = (t) => (t || '').trim().replace(/\s+/g, ' ').replace(/\.+$/, '').toLowerCase();

/**
 * Comunicado para quem teve ocorrencia em edicao anterior: aparece logo depois
 * do CPF e so segue com a frase escrita. O servidor grava a data e a hora.
 */
const ComunicadoOcorrencia = ({ cpf, texto, onDeclarou, onVoltar }) => {
  const [frase, setFrase] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const enviar = async (e) => {
    e.preventDefault();
    setErro('');
    if (normalizar(frase) !== normalizar(FRASE_CIENCIA)) {
      setErro(`Escreva exatamente: ${FRASE_CIENCIA}`);
      return;
    }
    setEnviando(true);
    try {
      const r = await declararCiencia(cpf, frase);
      if (!r?.ok) {
        setErro(r?.erro || 'Não foi possível registrar. Tente de novo.');
        return;
      }
      await onDeclarou();
    } catch (err) {
      console.error('comunicado_declarar', err?.message || err);
      setErro('Não foi possível registrar. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={enviar} className="max-w-2xl mx-auto rounded-xl border border-red-500/30 bg-black/50 p-5 sm:p-6 space-y-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
        <h2 className="text-lg font-bold text-white">{TITULO_COMUNICADO}</h2>
      </div>
      <p className="whitespace-pre-line text-sm leading-relaxed text-gray-200">{texto}</p>
      <div className="space-y-2">
        <Label htmlFor="frase-ciencia" className="text-white">
          Para prosseguir, escreva abaixo: “{FRASE_CIENCIA}”.
        </Label>
        <Input
          id="frase-ciencia"
          value={frase}
          onChange={(e) => setFrase(e.target.value)}
          autoComplete="off"
          onPaste={(e) => e.preventDefault()}
          className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
          placeholder={FRASE_CIENCIA}
        />
        {erro && <p className="text-sm text-red-300">{erro}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={enviando} className="bg-red-600 hover:bg-red-700 text-white">
          {enviando && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          Continuar
        </Button>
        <Button type="button" variant="ghost" onClick={onVoltar} className="text-gray-300 hover:text-white hover:bg-white/10">
          Voltar
        </Button>
      </div>
    </form>
  );
};

export default ComunicadoOcorrencia;
