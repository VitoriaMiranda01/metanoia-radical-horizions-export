import React, { useEffect, useState } from 'react';
import { CalendarDays, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/services/supabaseClient';
import { definirDatasReunioes } from '@/services/acessoCadastroService';

/**
 * Datas das reunioes da edicao (16/10/2026, Patrick).
 *
 * A da Reuniao de Leitura de Escala abre, das 15h as 19h, a busca pelo nome e
 * o "Não consigo acessar meu cadastro" na Area do Equipante. A virada de
 * edicao exige as duas datas da edicao nova (a partir da 38).
 */
const DatasReunioesCard = () => {
  const { toast } = useToast();
  const [inscricao, setInscricao] = useState('');
  const [leitura, setLeitura] = useState('');
  const [carregado, setCarregado] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    supabase.from('configuracoes').select('reuniao_inscricao_em, reuniao_leitura_escala_em').limit(1).maybeSingle()
      .then(({ data }) => {
        setInscricao(data?.reuniao_inscricao_em || '');
        setLeitura(data?.reuniao_leitura_escala_em || '');
        setCarregado(true);
      });
  }, []);

  const salvar = async () => {
    setSalvando(true);
    const r = await definirDatasReunioes(inscricao, leitura);
    setSalvando(false);
    if (!r.ok) { toast({ title: 'Não deu para salvar', description: r.erro, variant: 'destructive' }); return; }
    toast({ title: 'Datas salvas', className: 'bg-emerald-600 text-white border-none' });
  };

  return (
    <Card className="glass-effect border-white/10 bg-black/40">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-white">
          <CalendarDays className="w-5 h-5 text-sky-400" />
          <span>Reuniões da edição</span>
        </CardTitle>
        <CardDescription className="text-gray-400">
          No dia da Reunião de Leitura de Escala, das 15h às 19h, a Área do Equipante aceita a busca pelo nome e o
          pedido "Não consigo acessar meu cadastro". A virada de edição pede as duas datas da edição nova.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <div className="space-y-1.5">
            <Label htmlFor="reuniaoInscricao" className="text-white">Reunião de Inscrição</Label>
            <Input id="reuniaoInscricao" type="date" value={inscricao} disabled={!carregado}
              onChange={(e) => setInscricao(e.target.value)} className="bg-white/10 border-white/20 text-white [color-scheme:dark]" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reuniaoLeitura" className="text-white">Reunião de Leitura de Escala</Label>
            <Input id="reuniaoLeitura" type="date" value={leitura} disabled={!carregado}
              onChange={(e) => setLeitura(e.target.value)} className="bg-white/10 border-white/20 text-white [color-scheme:dark]" />
          </div>
          <Button onClick={salvar} disabled={!carregado || salvando} className="bg-sky-600 hover:bg-sky-700 text-white">
            {salvando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default DatasReunioesCard;
