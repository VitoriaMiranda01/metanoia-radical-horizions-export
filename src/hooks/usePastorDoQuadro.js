import { useEffect, useState } from 'react';
import { supabase } from '@/services/supabaseClient';

/**
 * Pastor da igreja no quadro "Todas as igrejas cadastradas" (Configuracoes),
 * ou null (29/10/2026, Patrick). Quando existe, ele vale em todas as fichas de
 * equipante da igreja -- o banco grava sozinho (gatilho pastor_do_quadro,
 * 20261029e); a tela so mostra o campo trancado.
 */
const usePastorDoQuadro = (igreja, esperar = 0) => {
  const [pastor, setPastor] = useState(null);

  useEffect(() => {
    const texto = String(igreja || '').trim();
    setPastor(null);
    if (!/^\d+\s*-\s*\S/.test(texto)) return undefined;
    let vivo = true;
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc('pastor_da_igreja_cadastrada', { p_igreja: texto });
      if (vivo && !error && typeof data === 'string' && data.trim()) setPastor(data.trim());
    }, esperar);
    return () => { vivo = false; clearTimeout(t); };
  }, [igreja, esperar]);

  return pastor;
};

export default usePastorDoQuadro;
