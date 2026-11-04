import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import FormSection from './FormSection';
import TelefoneInput from './TelefoneInput';
import { cn } from '@/lib/utils';
import {
  ehMenorDeIdade, limparNomeResponsavel, pessoasExigidas, problemaNomeDoMenor,
} from '@/utils/responsavelMenor';
import { mesmoTelefone } from '@/utils/contatoEmergencia';

/**
 * Menor de 18 anos (04/11/2026, migration 20261104d). So aparece quando a
 * data de nascimento da menos de 18 anos.
 *   acampante: responsavel (nome + WhatsApp);
 *   equipante: responsavel + quem vai acompanhar o menor trabalhando no
 *              projeto (pode ser a mesma pessoa).
 * Regras em utils/responsavelMenor.js.
 */
const TEXTOS = {
  responsavel: {
    titulo: 'Responsável legal',
    nome: 'Nome completo do responsável',
    tel: 'WhatsApp do responsável',
    placeholder: 'Pai, mãe ou responsável legal',
  },
  acompanhante: {
    titulo: 'Quem vai acompanhar você no projeto',
    nome: 'Nome completo de quem vai acompanhar',
    tel: 'WhatsApp de quem vai acompanhar',
    placeholder: 'Adulto que estará no projeto com você',
  },
};

const ResponsavelMenor = ({ formData, handleChange, tipo }) => {
  if (!ehMenorDeIdade(formData.dataNascimento)) return null;
  const pessoas = pessoasExigidas(tipo);

  const copiarResponsavel = () => {
    handleChange({ target: { name: 'acompanhanteNome', value: formData.responsavelNome || '' } });
    handleChange({ target: { name: 'acompanhanteWhatsapp', value: formData.responsavelWhatsapp || '' } });
  };

  return (
    <FormSection title="Menor de 18 anos">
      <p className="text-sm text-amber-200 bg-amber-500/10 border border-amber-500/25 rounded-md p-3">
        {tipo === 'equipante'
          ? 'Como você tem menos de 18 anos, informe o seu responsável e o adulto que vai acompanhar você trabalhando no projeto (pode ser a mesma pessoa).'
          : 'Como você tem menos de 18 anos, informe o nome e o WhatsApp do seu responsável. A carta de autorização continua obrigatória.'}
      </p>
      {pessoas.map((p) => {
        const t = TEXTOS[p.chave];
        const problemaNome = problemaNomeDoMenor(formData, p);
        // Formato errado o proprio TelefoneInput avisa; aqui so o repetido.
        const problemaTel = mesmoTelefone(formData[p.campoTel], formData.whatsapp)
          ? `O WhatsApp do ${p.rotulo} precisa ser diferente do seu.` : null;
        return (
          <div key={p.chave} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-white font-medium">{t.titulo}</p>
              {p.chave === 'acompanhante' && (
                <button
                  type="button"
                  onClick={copiarResponsavel}
                  className="text-xs text-blue-300 underline underline-offset-2 hover:text-blue-200"
                >
                  É o mesmo responsável
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor={p.campoNome} className="text-white">{t.nome}</Label>
                <Input
                  id={p.campoNome}
                  name={p.campoNome}
                  value={formData[p.campoNome] || ''}
                  onChange={(e) => handleChange({ target: { name: p.campoNome, value: limparNomeResponsavel(e.target.value) } })}
                  required
                  autoComplete="off"
                  className={cn('bg-white/10 border-white/20 text-white placeholder:text-white/50',
                    problemaNome && 'border-red-500/70')}
                  placeholder={t.placeholder}
                />
                {problemaNome && <p className="text-xs text-red-300">{problemaNome}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor={p.campoTel} className="text-white">{t.tel}</Label>
                <TelefoneInput
                  id={p.campoTel}
                  name={p.campoTel}
                  value={formData[p.campoTel]}
                  onChange={handleChange}
                  required
                  estrangeiro={!!formData.semCpf}
                  className={problemaTel ? 'border-red-500/70' : undefined}
                />
                {problemaTel && <p className="text-xs text-red-300">{problemaTel}</p>}
              </div>
            </div>
          </div>
        );
      })}
    </FormSection>
  );
};

export default ResponsavelMenor;
