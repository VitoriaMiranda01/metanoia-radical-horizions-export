import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import FormSection from './FormSection';
import TelefoneInput from './TelefoneInput';
import { cn } from '@/lib/utils';
import {
  definirInicioDoEvento, ehMenorDeIdade, limparNomeResponsavel, pessoasExigidas, precisaAcompanhante,
  problemaNomeDoMenor,
} from '@/utils/responsavelMenor';
import { mesmoTelefone } from '@/utils/contatoEmergencia';
import { fetchConfigPublica } from '@/services/publicDataService';

/**
 * Menor de 18 anos. So aparece para quem e menor.
 *   acampante (20261104d): responsavel (nome + WhatsApp); a carta continua.
 *   equipante (20261105a): responsavel (nome + WhatsApp) + so o NOME
 *              COMPLETO do acompanhante, um equipante desta edicao. Menor e
 *              quem ainda nao tem 18 anos no primeiro dia do projeto; o
 *              acompanhante so abaixo de 16 (20261105c).
 * Regras em utils/responsavelMenor.js.
 */

// Primeiro dia do projeto, lido uma vez por carregamento da pagina.
let inicioCarregado = null;
const useInicioDoEvento = (ativo) => {
  const [inicio, setInicio] = useState(inicioCarregado);
  useEffect(() => {
    if (!ativo || inicioCarregado) return;
    let vivo = true;
    fetchConfigPublica()
      .then((c) => {
        const cfg = Array.isArray(c) ? c[0] : c;
        inicioCarregado = cfg?.data_evento_inicio || null;
        definirInicioDoEvento(inicioCarregado);
        if (vivo) setInicio(inicioCarregado);
      })
      .catch(() => { /* sem a data, vale a idade de hoje */ });
    return () => { vivo = false; };
  }, [ativo]);
  return inicio;
};

const TEXTOS = {
  responsavel: {
    titulo: 'Responsável legal',
    nome: 'Nome completo do responsável',
    tel: 'WhatsApp do responsável',
    placeholder: 'Pai, mãe ou responsável legal',
  },
  acompanhante: {
    titulo: 'Quem vai acompanhar você no projeto',
    nome: 'Nome completo do acompanhante',
    placeholder: 'Nome e sobrenome, como na inscrição dele',
  },
};

const ResponsavelMenor = ({ formData, handleChange, tipo }) => {
  useInicioDoEvento(tipo === 'equipante');
  if (!ehMenorDeIdade(formData.dataNascimento, tipo)) return null;
  const pessoas = pessoasExigidas(tipo, formData.dataNascimento);
  const comAcompanhante = precisaAcompanhante(formData.dataNascimento, tipo);

  return (
    <FormSection title={comAcompanhante ? 'Menor de 16 anos' : 'Menor de 18 anos'}>
      <p className="text-sm text-amber-200 bg-amber-500/10 border border-amber-500/25 rounded-md p-3">
        {tipo !== 'equipante'
          ? 'Como você tem menos de 18 anos, informe o nome e o WhatsApp do seu responsável. A carta de autorização continua obrigatória.'
          : comAcompanhante
            ? 'Como você ainda não terá 16 anos no primeiro dia do projeto, informe o seu responsável (pai, mãe ou responsável legal) e quem vai acompanhar você durante todo o evento. O pastor da sua igreja vai falar com o seu responsável antes de aprovar a sua inscrição.'
            : 'Como você ainda não terá 18 anos no primeiro dia do projeto, informe o seu responsável (pai, mãe ou responsável legal). O pastor da sua igreja vai falar com ele para confirmar a autorização antes de aprovar a sua inscrição.'}
      </p>
      {pessoas.map((p) => {
        const t = TEXTOS[p.chave];
        const problemaNome = problemaNomeDoMenor(formData, p);
        // Formato errado o proprio TelefoneInput avisa; aqui so o repetido.
        const problemaTel = p.campoTel && mesmoTelefone(formData[p.campoTel], formData.whatsapp)
          ? `O WhatsApp do ${p.rotulo} precisa ser diferente do seu.` : null;
        return (
          <div key={p.chave} className="space-y-3">
            <p className="text-white font-medium">{t.titulo}</p>
            {p.chave === 'acompanhante' && (
              <p className="text-xs text-gray-300 -mt-1">
                É um adulto que vai <strong>trabalhar nesta edição como equipante</strong> e ficará responsável
                por você durante todo o projeto, com a autorização do seu responsável. Pode ser o próprio
                responsável, se ele também for servir. Escreva o nome completo, igual ao da inscrição dele.
              </p>
            )}
            {p.chave === 'responsavel' && tipo === 'equipante' && (
              <p className="text-xs text-gray-300 -mt-1">
                O WhatsApp precisa ser do seu responsável, não o seu nem o de um amigo: o pastor vai mandar
                mensagem para este número pedindo a autorização.
              </p>
            )}
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
              {p.campoTel && (
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
              )}
            </div>
          </div>
        );
      })}
    </FormSection>
  );
};

export default ResponsavelMenor;
