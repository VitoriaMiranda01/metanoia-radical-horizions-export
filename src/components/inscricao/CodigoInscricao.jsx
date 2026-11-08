import React, { useEffect, useState } from 'react';
import { CheckCircle, KeyRound, Loader2, UserCheck, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { fetchConfigPublica } from '@/services/publicDataService';
import { conferirCodigoInscricao } from '@/services/codigosInscricaoService';

export const JUSTIFICATIVA_MIN = 50;
export const JUSTIFICATIVA_MAX = 1000;

const limpar = (t) => String(t || '').replace(/\s+/g, ' ').trim();

/**
 * Presenca na reuniao de inscricao (08/11/2026, Patrick; migration 20261108b).
 * Todo equipante (todos os dias e So Domingo) responde "Voce esta presente na
 * reuniao?":
 *  - Sim: informa o codigo de inscricao da edicao (20261107a);
 *  - Nao: escreve a justificativa da ausencia (minimo 50 caracteres).
 * Duas formas:
 *  - passo proprio, logo depois do CPF (quem nao tem pendencia na ficha);
 *  - quadro no fim do formulario (quem tinha pendencia: so aparece depois de
 *    corrigir tudo). Ali fica dentro do <form> da inscricao, por isso nao usa
 *    <form> proprio e o Enter nao envia a inscricao.
 * O servidor confere tudo de novo no envio.
 *
 * onConcluido({ presente, codigo, justificativa })
 */
const CodigoInscricao = ({ onConcluido, onVoltar, noFormulario = false, concluido = null }) => {
  const [presente, setPresente] = useState(null);
  const [codigo, setCodigo] = useState('');
  const [justificativa, setJustificativa] = useState('');
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

  const escolher = (valor) => {
    setPresente(valor);
    setErro('');
  };

  const conferirCodigo = async () => {
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
      await onConcluido({ presente: true, codigo: digitado, justificativa: '' });
    } catch (err) {
      console.error('codigo_inscricao_conferir', err?.message || err);
      setErro('Não foi possível conferir o código agora. Tente de novo.');
    } finally {
      setConferindo(false);
    }
  };

  const enviarJustificativa = async () => {
    setErro('');
    const texto = limpar(justificativa);
    if (texto.length < JUSTIFICATIVA_MIN) {
      setErro(`Escreva pelo menos ${JUSTIFICATIVA_MIN} caracteres (faltam ${JUSTIFICATIVA_MIN - texto.length}).`);
      return;
    }
    await onConcluido({ presente: false, codigo: '', justificativa: texto });
  };

  if (noFormulario && concluido) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-center gap-3 text-sm text-emerald-100">
        <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
        {concluido.presente
          ? 'Presença na reunião confirmada com o código.'
          : 'Justificativa da ausência na reunião registrada.'}
      </div>
    );
  }

  const tamanho = limpar(justificativa).length;

  return (
    <div className={`${noFormulario ? '' : 'max-w-xl mx-auto '}rounded-xl border border-blue-500/30 bg-black/50 p-5 sm:p-6 space-y-5`}>
      <div className="flex items-start gap-3">
        <KeyRound className="w-6 h-6 text-blue-400 shrink-0 mt-0.5" />
        <div>
          <h2 className="text-lg font-bold text-white">
            Você está presente na reunião{edicao ? ` de inscrição da ${edicao}ª edição` : ' de inscrição'}?
          </h2>
          <p className="text-sm font-semibold text-yellow-300 mt-2">
            “Atenção!! Lembramos que a participação na reunião é obrigatória para a equipe de trabalho.”
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Presença na reunião">
        <Button type="button" role="radio" aria-checked={presente === true} onClick={() => escolher(true)}
          className={presente === true
            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
            : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'}>
          <UserCheck className="w-4 h-4 mr-2" /> Sim
        </Button>
        <Button type="button" role="radio" aria-checked={presente === false} onClick={() => escolher(false)}
          className={presente === false
            ? 'bg-orange-600 hover:bg-orange-700 text-white'
            : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'}>
          <UserX className="w-4 h-4 mr-2" /> Não
        </Button>
      </div>

      {presente === true && (
        <div className="space-y-2">
          <Label htmlFor="codigo-inscricao" className="text-white">Código da inscrição</Label>
          <p className="text-xs text-gray-400">Informe o código que a organização passou na reunião.</p>
          <Input
            id="codigo-inscricao"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                conferirCodigo();
              }
            }}
            maxLength={40}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
            placeholder="Digite o código"
          />
        </div>
      )}

      {presente === false && (
        <div className="space-y-2">
          <Label htmlFor="justificativa-ausencia" className="text-white">Justificativa da ausência na reunião</Label>
          <Textarea
            id="justificativa-ausencia"
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            maxLength={JUSTIFICATIVA_MAX}
            rows={4}
            className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
            placeholder="Conte por que não pôde estar na reunião"
          />
          <p className={`text-xs ${tamanho >= JUSTIFICATIVA_MIN ? 'text-emerald-300' : 'text-gray-400'}`}>
            {tamanho} de no mínimo {JUSTIFICATIVA_MIN} caracteres
          </p>
        </div>
      )}

      {erro && <p className="text-sm text-red-300" role="alert">{erro}</p>}

      <div className="flex flex-wrap gap-2">
        {presente !== null && (
          <Button type="button" onClick={presente ? conferirCodigo : enviarJustificativa} disabled={conferindo}
            className="bg-blue-600 hover:bg-blue-700 text-white">
            {conferindo && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {noFormulario ? (presente ? 'Conferir código' : 'Registrar justificativa') : 'Continuar'}
          </Button>
        )}
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
