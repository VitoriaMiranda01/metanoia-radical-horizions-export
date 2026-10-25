import React, { useEffect, useRef, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/services/supabaseClient';

/**
 * Inscricao "só no domingo" (20261025c, Patrick): secao do quadro Geral, logo
 * abaixo das Reunioes da edicao. Grava junto com o "Salvar" do quadro
 * (registrar recebe a funcao que o quadro chama). Vazio = padrao: de segunda
 * a quarta da semana do evento.
 */
const dataBR = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '');

const JanelaDomingoCard = ({ registrar }) => {
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [janela, setJanela] = useState(null);
  const [carregado, setCarregado] = useState(false);
  const gravadas = useRef({ inicio: '', fim: '' });

  const ler = async () => {
    const [{ data: cfg }, { data: j }] = await Promise.all([
      supabase.from('configuracoes').select('domingo_inscricoes_inicio, domingo_inscricoes_fim').limit(1).maybeSingle(),
      supabase.rpc('janela_domingo'),
    ]);
    setInicio(cfg?.domingo_inscricoes_inicio || '');
    setFim(cfg?.domingo_inscricoes_fim || '');
    gravadas.current = { inicio: cfg?.domingo_inscricoes_inicio || '', fim: cfg?.domingo_inscricoes_fim || '' };
    setJanela(j || null);
    setCarregado(true);
  };

  useEffect(() => { ler(); }, []);

  useEffect(() => {
    if (!registrar) return;
    registrar(async () => {
      if (!carregado) return { ok: true };
      if (inicio === gravadas.current.inicio && fim === gravadas.current.fim) return { ok: true };
      const { data, error } = await supabase.rpc('definir_janela_domingo', { p_inicio: inicio || null, p_fim: fim || null });
      if (error) return { ok: false, erro: 'Não foi possível salvar. Tente de novo.' };
      if (!data?.ok) return { ok: false, erro: data?.erro || 'Não foi possível salvar.' };
      gravadas.current = { inicio, fim };
      setJanela(data);
      return { ok: true };
    });
  }, [registrar, carregado, inicio, fim]);

  return (
    <div className="pt-4 border-t border-white/10 space-y-4">
      <div>
        <h3 className="text-lg font-medium text-white flex items-center space-x-2">
          <CalendarDays className="w-5 h-5 text-orange-300" /><span>Inscrição só domingo (equipantes)</span>
        </h3>
        <p className="text-sm text-gray-400 mt-1">
          Nesse período, quem ainda não tem inscrição escolhe entre <strong className="text-gray-300">todos os dias</strong> e{' '}
          <strong className="text-gray-300">somente no domingo</strong> (sem áreas de trabalho, taxa de 50% do lote, fora da
          escala). Deixe em branco para o padrão: de segunda a quarta da semana do evento.
        </p>
        {janela?.inicio && (
          <p className="text-sm mt-2 text-orange-200">
            Valendo: {dataBR(janela.inicio)} a {dataBR(janela.fim)}
            {janela.personalizada ? '' : ' (padrão)'} · {janela.aberta ? 'aberta agora' : 'fechada agora'}
          </p>
        )}
      </div>
      <div className="grid gap-3 items-end grid-cols-1 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="domingoInicio" className="text-gray-300">Início</Label>
          <Input id="domingoInicio" type="date" value={inicio} disabled={!carregado}
            onChange={(e) => setInicio(e.target.value)} className="bg-white/10 border-white/20 text-white [color-scheme:dark]" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="domingoFim" className="text-gray-300">Fim</Label>
          <Input id="domingoFim" type="date" value={fim} disabled={!carregado}
            onChange={(e) => setFim(e.target.value)} className="bg-white/10 border-white/20 text-white [color-scheme:dark]" />
        </div>
      </div>
    </div>
  );
};

export default JanelaDomingoCard;
