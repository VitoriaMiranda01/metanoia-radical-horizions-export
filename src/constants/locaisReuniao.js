import { useEffect, useState } from 'react';
import { supabase } from '@/services/supabaseClient';

// Local da reuniao de Leitura de Escala de cada area (19/10/2026, Patrick).
// Os locais de verdade ficam no banco (tabela locais_reuniao) e sao editados
// em Configuracoes > "Locais da reunião". A lista abaixo so vale se a
// consulta falhar.
// A reuniao e na igreja, mas cada equipe se reune num lugar: salas do
// Espaco Social, Templo ou Galeria. Aparece embaixo da area na revelacao e
// no topo da lista do lider/responsavel.
//
// Os nomes das areas sao os da escala (escalas.area_alocada). Area que nao
// esta aqui nao mostra local (a pessoa procura o lider / a coordenacao).

const CORREDOR_II = 'Espaço Social · Corredor II (dentro do Corredor I, lado direito)';

const LOCAIS = {
  // Espaco Social
  Cozinha: { lugar: 'Espaço Social', detalhe: 'Cozinha da igreja' },
  Copa: { lugar: 'Espaço Social', detalhe: 'Cozinha da igreja' },
  'Segurança': { lugar: 'Espaço Social', detalhe: 'Sala 01' },
  'Primeiros socorros - Saúde': { lugar: 'Espaço Social', detalhe: 'Sala 02' },
  'Hospital (Cena teatral)': { lugar: 'Espaço Social · Corredor I', detalhe: 'Sala 07' },
  'Igreja subterrânea': { lugar: 'Espaço Social · Corredor I', detalhe: 'Sala 06' },
  // Equipe de trilha
  Guia: { lugar: 'Espaço Social · Corredor I', detalhe: 'Sala 05' },
  'Espírito Santo': { lugar: 'Espaço Social · Corredor I', detalhe: 'Sala 05' },
  Inimigo: { lugar: 'Espaço Social · Corredor I', detalhe: 'Sala 05' },
  'Pastor Invisível': { lugar: 'Espaço Social · Corredor I', detalhe: 'Sala 05' },
  'Invisível': { lugar: 'Espaço Social · Corredor I', detalhe: 'Sala 05' },
  Marcador: { lugar: 'Espaço Social · Corredor I', detalhe: 'Sala 05' },
  'Cracolândia': { lugar: CORREDOR_II, detalhe: 'Sala 03' },
  Selva: { lugar: CORREDOR_II, detalhe: 'Sala 04' },
  Perseguidos: { lugar: CORREDOR_II, detalhe: 'Sala 04' },
  // Templo
  'Cristolândia': { lugar: 'Templo' },
  'Pastor Enforcado': { lugar: 'Templo' },
  'Depressão': { lugar: 'Templo' },
  Fotografia: { lugar: 'Templo' },
  'Família': { lugar: 'Templo' },
  'Túmulo': { lugar: 'Templo' },
  Infiltrados: { lugar: 'Templo' },
  // Galeria
  'Falsa baiana': { lugar: 'Galeria' },
  'Logística': { lugar: 'Galeria' },
  'Presídio': { lugar: 'Galeria' },
  'Dia do arrebatamento da igreja': { lugar: 'Galeria' },
};

export const LOCAIS_PADRAO = LOCAIS;

// Uma consulta por carregamento da pagina, dividida por todos que usam.
let cache = null;
let promessa = null;
export const carregarLocaisReuniao = (forcar = false) => {
  if (forcar) { cache = null; promessa = null; }
  if (cache) return Promise.resolve(cache);
  if (!promessa) {
    promessa = supabase.rpc('locais_reuniao').then(({ data, error }) => {
      cache = !error && data && typeof data === 'object' ? data : LOCAIS;
      return cache;
    }).catch(() => { promessa = null; return LOCAIS; });
  }
  return promessa;
};

const formatar = (l) => (l ? (l.detalhe ? `${l.lugar} · ${l.detalhe}` : l.lugar) : null);

/**
 * Hook: devolve textoLocal(area) -> "Espaço Social · Sala 01" / "Templo" / null.
 * Enquanto a consulta nao volta, usa a lista de reserva.
 */
export const useLocaisReuniao = () => {
  const [locais, setLocais] = useState(cache || LOCAIS);
  useEffect(() => {
    let vivo = true;
    carregarLocaisReuniao().then((l) => { if (vivo) setLocais(l); });
    return () => { vivo = false; };
  }, []);
  return (area) => formatar(locais[area]);
};
