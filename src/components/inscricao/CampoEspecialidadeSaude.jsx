import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/services/supabaseClient';
import { ESPECIALIDADES_SAUDE_PADRAO, ESPECIALIDADE_OUTRO } from '@/constants/especialidadesSaude';
import { cn } from '@/lib/utils';

// A lista vem do banco uma vez por carregamento da pagina (pode ter ganhado
// opcoes novas pelo "Tornar fixa"); se falhar, usa a copia do codigo.
let cache = null;
export const carregarEspecialidades = async () => {
  if (cache) return cache;
  const { data, error } = await supabase.rpc('especialidades_saude_opcoes');
  const lista = !error && Array.isArray(data) && data.length ? data : ESPECIALIDADES_SAUDE_PADRAO;
  // "Outro" sempre por ultimo.
  cache = [...lista.filter((x) => x !== ESPECIALIDADE_OUTRO), ESPECIALIDADE_OUTRO];
  return cache;
};

/**
 * "Qual a sua especialidade na área da saúde?" (18/10/2026). Botoes com as
 * opcoes; "Outro" abre um campo para escrever. Usado na pendencia do
 * acompanhamento, na inscricao (quem escolhe Saude) e na tela da Saude.
 *
 * multipla (24/10/2026): marca varias. A principal fica em `valor` ("Outro"
 * se estiver marcado, senao a primeira da lista) e as demais em `adicionais`;
 * onChange(valor, outro, adicionais). Sem multipla, adicionais nao muda.
 */
const CampoEspecialidadeSaude = ({ id = 'especialidade-saude', valor, outro, adicionais = [], onChange, rotulo = 'Sua especialidade na área da saúde', compacto = false, multipla = false }) => {
  const [opcoes, setOpcoes] = useState(cache || ESPECIALIDADES_SAUDE_PADRAO);
  useEffect(() => {
    let vivo = true;
    carregarEspecialidades().then((l) => { if (vivo) setOpcoes(l); });
    return () => { vivo = false; };
  }, []);

  const marcadas = multipla ? [valor, ...(adicionais || [])].filter(Boolean) : [valor].filter(Boolean);
  const marcada = (op) => marcadas.includes(op);

  const clicar = (op) => {
    if (!multipla) { onChange(op, op === ESPECIALIDADE_OUTRO ? (outro || '') : '', adicionais || []); return; }
    const nova = marcada(op) ? marcadas.filter((x) => x !== op) : [...marcadas, op];
    const daLista = opcoes.filter((x) => x !== ESPECIALIDADE_OUTRO && nova.includes(x));
    const principal = nova.includes(ESPECIALIDADE_OUTRO) ? ESPECIALIDADE_OUTRO : (daLista[0] || '');
    onChange(principal, principal === ESPECIALIDADE_OUTRO ? (outro || '') : '', daLista.filter((x) => x !== principal));
  };

  return (
    <div className="space-y-2">
      {rotulo && <Label className="text-white">{rotulo}</Label>}
      {multipla && <p className="text-xs text-gray-400">Pode marcar mais de uma.</p>}
      <div className={cn('grid gap-2', compacto ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3')} role={multipla ? 'group' : 'radiogroup'} aria-label={rotulo || 'Especialidade'}>
        {opcoes.map((op) => (
          <button
            key={op} type="button" role={multipla ? 'checkbox' : 'radio'} aria-checked={marcada(op)}
            onClick={() => clicar(op)}
            className={cn(
              'min-h-[44px] px-3 py-2 rounded-md border text-sm text-left transition-colors',
              marcada(op)
                ? 'border-emerald-400/70 bg-emerald-500/15 text-white'
                : 'border-white/15 bg-white/5 text-gray-200 hover:bg-white/10'
            )}
          >
            {op}
          </button>
        ))}
      </div>
      {valor === ESPECIALIDADE_OUTRO && (
        <div className="space-y-1.5 pt-1">
          <Label htmlFor={`${id}-outro`} className="text-white">Qual é a sua especialidade?</Label>
          <Input
            id={`${id}-outro`}
            value={outro || ''}
            maxLength={80}
            autoFocus
            onChange={(e) => onChange(ESPECIALIDADE_OUTRO, e.target.value.replace(/[0-9]/g, ''), adicionais || [])}
            placeholder="Ex.: Biomedicina, Farmácia..."
            className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
          />
        </div>
      )}
    </div>
  );
};

export default CampoEspecialidadeSaude;
