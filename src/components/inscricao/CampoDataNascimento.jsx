import React, { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { CalendarDays } from 'lucide-react';

// Converte 'aaaa-mm-dd' (formato que o resto do app usa, igual ao
// <input type="date"> original) para o texto exibido 'dd/mm/aaaa'.
const isoParaDigitado = (iso) => {
  if (!iso) return '';
  const partes = String(iso).slice(0, 10).split('-');
  if (partes.length !== 3) return '';
  const [ano, mes, dia] = partes;
  if (!ano || !mes || !dia) return '';
  return `${dia}/${mes}/${ano}`;
};

// Converte 'dd/mm/aaaa' completo para 'aaaa-mm-dd', so quando a data
// existir de verdade no calendario. Devolve null para data incompleta,
// mes/dia fora do intervalo ou data que nao existe (ex: 31/02) -- o
// Date do JS "estoura" essas pro mes seguinte, entao conferimos se ele
// devolveu exatamente o que foi digitado.
const digitadoParaIso = (digitado) => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(digitado);
  if (!match) return null;
  const [, diaStr, mesStr, anoStr] = match;
  const dia = Number(diaStr);
  const mes = Number(mesStr);
  const ano = Number(anoStr);
  if (mes < 1 || mes > 12) return null;
  if (ano < 1900 || ano > 2100) return null;

  const data = new Date(ano, mes - 1, dia);
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) {
    return null;
  }
  return `${anoStr}-${mesStr}-${diaStr}`;
};

// So os digitos do que foi digitado/colado, no maximo 8 (dd mm aaaa), Para
// reformatar a mascara a cada tecla -- assim funciona tanto digitando um a
// um quanto colando "01011990" ou "01/01/1990" de uma vez.
const formatarMascara = (valorBruto) => {
  const digitos = valorBruto.replace(/\D/g, '').slice(0, 8);
  const dia = digitos.slice(0, 2);
  const mes = digitos.slice(2, 4);
  const ano = digitos.slice(4, 8);
  let resultado = dia;
  if (digitos.length > 2) resultado += `/${mes}`;
  if (digitos.length > 4) resultado += `/${ano}`;
  return resultado;
};

/**
 * Campo de data de nascimento com mascara dd/mm/aaaa, digitavel direto.
 *
 * O <input type="date"> puro (usado antes aqui) so abre um seletor no
 * celular -- Android e iOS nem deixam digitar, so rolar o calendario --
 * e foi por isso que a usuaria pediu para digitar tambem funcionar.
 *
 * Mantem por baixo um <input type="date"> escondido, so para abrir o
 * seletor nativo pelo icone de calendario (via showPicker -- Chrome e
 * Edge; nos navegadores sem suporte o icone so nao abre nada, e o campo
 * de texto continua funcionando normalmente do mesmo jeito).
 *
 * value/onChange continuam em 'aaaa-mm-dd' e no mesmo formato de evento
 * sintetico ({ target: { name, value } }) que o handleChange generico das
 * telas de inscricao ja espera -- quem usa este componente nao precisa
 * mudar mais nada alem de trocar o <Input type="date">.
 */
const CampoDataNascimento = ({ id, value, onChange, max, min, required, className = '', ...outrasProps }) => {
  const [digitado, setDigitado] = useState(() => isoParaDigitado(value));
  const [invalido, setInvalido] = useState(false);
  const inputNativoRef = useRef(null);

  // Sincroniza quando o valor muda por fora (ex: sessao de teste
  // preenchendo o formulario, ou o seletor nativo do calendario).
  useEffect(() => {
    setDigitado(isoParaDigitado(value));
    setInvalido(false);
  }, [value]);

  const dispararChange = (novoValor) => {
    onChange({ target: { name: id, value: novoValor } });
  };

  const handleDigitar = (e) => {
    const mascarado = formatarMascara(e.target.value);
    setDigitado(mascarado);

    if (mascarado.length < 10) {
      setInvalido(false);
      if (value) dispararChange('');
      return;
    }

    const iso = digitadoParaIso(mascarado);
    const foraDoLimite = iso && ((max && iso > max) || (min && iso < min));
    if (!iso || foraDoLimite) {
      setInvalido(true);
      dispararChange('');
      return;
    }

    setInvalido(false);
    dispararChange(iso);
  };

  const abrirSeletor = () => {
    const el = inputNativoRef.current;
    if (el && typeof el.showPicker === 'function') {
      try {
        el.showPicker();
      } catch {
        // Navegador sem suporte a showPicker -- o campo de texto ja
        // resolve sozinho, entao so ignora.
      }
    }
  };

  return (
    <div>
      <div className="relative">
        <Input
          id={id}
          name={id}
          type="text"
          inputMode="numeric"
          autoComplete="bday"
          placeholder="dd/mm/aaaa"
          maxLength={10}
          value={digitado}
          onChange={handleDigitar}
          required={required}
          className={`pr-10 ${invalido ? 'border-red-500 focus-visible:ring-red-500' : ''} ${className}`}
          {...outrasProps}
        />
        <button
          type="button"
          onClick={abrirSeletor}
          tabIndex={-1}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
          aria-label="Abrir calendário"
        >
          <CalendarDays className="w-4 h-4" />
        </button>
        {/* So existe para abrir o seletor nativo pelo botao acima -- nao
            recebe foco/clique diretamente (por isso pointer-events-none). */}
        <input
          ref={inputNativoRef}
          type="date"
          max={max}
          min={min}
          value={value || ''}
          onChange={(e) => dispararChange(e.target.value)}
          tabIndex={-1}
          aria-hidden="true"
          className="absolute inset-0 w-0 h-0 opacity-0 pointer-events-none"
        />
      </div>
      {invalido && <p className="text-red-300 text-xs mt-1">Data inválida.</p>}
    </div>
  );
};

export default CampoDataNascimento;
