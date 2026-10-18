import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, MapPin, RotateCcw, Save, Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/services/supabaseClient';
import { WORK_AREAS, ehAreaPrincipal } from '@/constants/workAreas';
import { carregarLocaisReuniao } from '@/constants/locaisReuniao';
import { normalizarBusca } from '@/utils/busca';
import { cn } from '@/lib/utils';

/**
 * Locais da reuniao de Leitura de Escala (19/10/2026, Patrick): o organizador
 * edita aqui onde cada area se reune (Espaco Social / Templo / Galeria + sala).
 * Aparece para o equipante embaixo da area revelada e no topo da lista do
 * lider. Area sem lugar = sem local (as secundarias nao se reunem).
 */

const SUGESTOES_LUGAR = ['Espaço Social', 'Espaço Social · Corredor I', 'Espaço Social · Corredor II (dentro do Corredor I, lado direito)', 'Templo', 'Galeria'];

// As areas que se reunem: as principais da escala.
const AREAS = WORK_AREAS.filter((a) => ehAreaPrincipal(a) && a !== 'Não será escalado');

const LocaisReuniaoCard = () => {
  const { toast } = useToast();
  const [original, setOriginal] = useState({});
  const [edicao, setEdicao] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState('');

  const carregar = async () => {
    setCarregando(true);
    const l = await carregarLocaisReuniao(true);
    const base = {};
    Object.entries(l || {}).forEach(([area, v]) => { base[area] = { lugar: v?.lugar || '', detalhe: v?.detalhe || '' }; });
    setOriginal(base);
    setEdicao(base);
    setCarregando(false);
  };
  useEffect(() => { carregar(); }, []);

  // Areas da escala + alguma do banco que nao esteja mais na lista.
  const areas = useMemo(() => {
    const todas = [...new Set([...AREAS, ...Object.keys(original)])].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const q = normalizarBusca(busca);
    return q ? todas.filter((a) => normalizarBusca(`${a} ${edicao[a]?.lugar || ''} ${edicao[a]?.detalhe || ''}`).includes(q)) : todas;
  }, [original, busca, edicao]);

  const valor = (area) => edicao[area] || { lugar: '', detalhe: '' };
  const mudar = (area, campo, v) => setEdicao((e) => ({ ...e, [area]: { ...valor(area), [campo]: v } }));
  const mudou = (area) => (valor(area).lugar.trim() !== (original[area]?.lugar || '') || valor(area).detalhe.trim() !== (original[area]?.detalhe || ''));
  const alteradas = [...new Set([...Object.keys(edicao), ...Object.keys(original)])].filter(mudou);
  const semLugarComDetalhe = Object.entries(edicao).find(([, v]) => !v.lugar.trim() && v.detalhe.trim());
  const comLocal = Object.values(edicao).filter((v) => v.lugar.trim()).length;

  const salvar = async () => {
    if (semLugarComDetalhe) {
      toast({ title: 'Falta o lugar', description: `${semLugarComDetalhe[0]}: preencha o lugar (ex.: Espaço Social) ou apague a sala.`, variant: 'destructive' });
      return;
    }
    setSalvando(true);
    try {
      const lista = Object.entries(edicao)
        .filter(([, v]) => v.lugar.trim())
        .map(([area, v]) => ({ area, lugar: v.lugar.trim(), detalhe: v.detalhe.trim() || null }));
      const { data, error } = await supabase.rpc('salvar_locais_reuniao', { p_locais: lista });
      if (error || !data?.ok) throw new Error(data?.erro || error?.message || 'Não foi possível salvar.');
      toast({ title: 'Locais salvos', description: `${data.total} ${data.total === 1 ? 'área tem' : 'áreas têm'} local de reunião.`, className: 'bg-green-600 text-white' });
      await carregar();
    } catch (e) {
      toast({ title: 'Não foi possível salvar', description: e.message, variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Card className="glass-effect border-white/10 bg-black/40">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-white">
          <MapPin className="w-5 h-5 text-sky-400" />
          <span>Locais da reunião de leitura de escala</span>
        </CardTitle>
        <CardDescription className="text-gray-400">
          Onde cada área se reúne. Aparece para o equipante embaixo da área revelada (escala provisória) e no topo da lista do líder.
          Deixe o lugar em branco para a área ficar sem local.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {carregando ? (
          <div className="py-8 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar área ou local"
                  className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-gray-500" />
              </div>
              <p className="text-xs text-gray-400 shrink-0">{comLocal} com local · {alteradas.length} {alteradas.length === 1 ? 'alteração' : 'alterações'} não salvas</p>
            </div>

            <datalist id="sugestoes-lugar-reuniao">
              {SUGESTOES_LUGAR.map((s) => <option key={s} value={s} />)}
            </datalist>

            <div className="rounded-lg border border-white/10 divide-y divide-white/5 max-h-[60dvh] overflow-y-auto">
              <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,0.8fr)] gap-2 px-3 py-2 text-[11px] uppercase tracking-wider text-gray-500 sticky top-0 bg-neutral-900 z-10">
                <span>Área</span><span>Lugar</span><span>Sala / detalhe</span>
              </div>
              {areas.map((area) => (
                <div key={area} className={cn('grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,0.8fr)] gap-2 px-3 py-2 items-center', mudou(area) && 'bg-amber-500/5')}>
                  <span className="text-sm text-white font-medium flex items-center gap-1.5">
                    {area}
                    {!WORK_AREAS.includes(area) && <span className="text-[10px] text-gray-500">(fora da escala)</span>}
                  </span>
                  <Input list="sugestoes-lugar-reuniao" value={valor(area).lugar} maxLength={120}
                    onChange={(e) => mudar(area, 'lugar', e.target.value)} placeholder="Sem local"
                    aria-label={`Lugar da reunião de ${area}`}
                    className="h-9 bg-white/5 border-white/10 text-white placeholder:text-gray-600" />
                  <Input value={valor(area).detalhe} maxLength={120}
                    onChange={(e) => mudar(area, 'detalhe', e.target.value)} placeholder="Ex.: Sala 01"
                    aria-label={`Sala da reunião de ${area}`}
                    className="h-9 bg-white/5 border-white/10 text-white placeholder:text-gray-600" />
                </div>
              ))}
              {areas.length === 0 && <p className="p-4 text-center text-sm text-gray-500">Nenhuma área com esse texto.</p>}
            </div>

            <div className="flex justify-end gap-2">
              {alteradas.length > 0 && (
                <Button variant="ghost" onClick={() => setEdicao(original)} disabled={salvando} className="text-gray-300 hover:text-white hover:bg-white/10">
                  <RotateCcw className="w-4 h-4 mr-1.5" />Desfazer alterações
                </Button>
              )}
              <Button onClick={salvar} disabled={salvando || alteradas.length === 0} className="bg-sky-600 hover:bg-sky-700 text-white">
                {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-1.5" />Salvar locais</>}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default LocaisReuniaoCard;
