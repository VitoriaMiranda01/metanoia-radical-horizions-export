import React, { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/services/supabaseClient';
import { limparNomeSimples } from '@/utils/validacoesInscricao';
import { igrejaEhOutra } from '@/constants/igrejas';
import { cn } from '@/lib/utils';

/**
 * "Nome do Pastor" que puxa o pastor da igreja (18/10/2026, Patrick).
 *
 * Igreja com pastor no quadro "Pastores Parceiros" (Configuracoes): o nome
 * vem preenchido (um pastor) ou a pessoa toca no dela (varios). Continua
 * editavel. Igreja sem pastor mapeado: a pessoa escreve, como antes.
 *
 * So troca o que o PROPRIO campo preencheu -- o que a pessoa digitou nunca e
 * apagado. A consulta (pastores_da_igreja) devolve so nomes.
 */
const CampoPastor = ({ igreja, value, onChange, esperar = 0 }) => {
  const [pastores, setPastores] = useState([]);
  const automatico = useRef('');
  const valorAtual = useRef(value);
  valorAtual.current = value;

  useEffect(() => {
    const texto = String(igreja || '').trim();
    let vivo = true;
    // Valor que o campo tinha posto sozinho deixa de valer ao mudar a igreja.
    const soltarAutomatico = () => {
      if (automatico.current && valorAtual.current === automatico.current) onChange('');
      automatico.current = '';
    };
    if (!texto || igrejaEhOutra(texto) || texto.length < 3) {
      setPastores([]);
      soltarAutomatico();
      return undefined;
    }
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc('pastores_da_igreja', { p_igreja: texto });
      if (!vivo) return;
      const lista = !error && Array.isArray(data) ? data.map((n) => limparNomeSimples(String(n))).filter(Boolean) : [];
      setPastores(lista);
      const atual = valorAtual.current || '';
      const podePreencher = !atual.trim() || atual === automatico.current;
      if (lista.length === 1 && podePreencher) {
        automatico.current = lista[0];
        onChange(lista[0]);
      } else if (podePreencher) {
        soltarAutomatico();
      }
    }, esperar);
    return () => { vivo = false; clearTimeout(t); };
    // onChange muda a cada render da pagina; so a igreja dispara a busca.
  }, [igreja]); // eslint-disable-line react-hooks/exhaustive-deps

  const escolher = (nome) => {
    automatico.current = nome;
    onChange(nome);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="pastor" className="text-white">Nome do Pastor</Label>
      <Input
        id="pastor"
        name="pastor"
        value={value || ''}
        onChange={(e) => { automatico.current = ''; onChange(limparNomeSimples(e.target.value)); }}
        className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
        placeholder={pastores.length > 1 ? 'Toque no seu pastor abaixo ou escreva' : 'Nome do pastor'}
      />
      {pastores.length === 1 && value === pastores[0] && (
        <p className="text-[11px] text-emerald-300/90">
          Pastor cadastrado para esta igreja. Se não for ele, é só corrigir.
        </p>
      )}
      {pastores.length > 1 && (
        <div className="space-y-1">
          <p className="text-[11px] text-blue-200/80">Pastores cadastrados para esta igreja — toque no seu:</p>
          <div className="flex flex-wrap gap-1.5">
            {pastores.map((nome) => (
              <button
                key={nome} type="button" onClick={() => escolher(nome)}
                aria-pressed={value === nome}
                className={cn(
                  'min-h-[36px] px-3 rounded-full border text-xs transition-colors',
                  value === nome
                    ? 'border-emerald-400/70 bg-emerald-500/20 text-white'
                    : 'border-white/15 bg-white/5 text-gray-200 hover:bg-white/10'
                )}
              >
                {nome}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CampoPastor;
