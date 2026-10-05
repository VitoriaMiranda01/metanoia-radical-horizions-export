import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, Check, CheckCircle2, ChevronDown, ChevronUp, Copy, Loader2, MessageCircle,
  RefreshCw, Send, Users, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { nomeDaIgreja } from '@/constants/igrejas';
import { formatarTelefone } from '@/utils/telefone';
import { cn } from '@/lib/utils';
import {
  fetchRelacaoLider, marcarPresenca, salvarGrupoLider, marcarConviteLider, linkWhatsApp
} from '@/services/liderService';

/**
 * "Minha equipe" -- a relacao do lider, no acompanhamento da inscricao.
 *
 * Pedido do Patrick (05/10/2026): depois que a escala PROVISORIA sai, cada
 * lider ve quem esta escalado na sua area (nome completo, igreja e
 * telefone), quantas pessoas sao, e faz a CHAMADA na reuniao de escala,
 * como chamada de escola. Quem tem pendencia no cadastro (fora a taxa)
 * aparece com aviso: a pessoa corrige no acompanhamento dela e a relacao
 * acompanha.
 *
 * O lider NAO inclui ninguem: quem manda gente para a area sao os
 * organizadores, na Geracao de Escalas. Toda nova alocacao aparece aqui
 * sozinha -- a relacao se atualiza a cada 15 segundos.
 *
 * Sem codigo de lider (decisao do Patrick): vale a mesma prova de dono do
 * acompanhamento.
 *
 * Grupo de WhatsApp: o site nao consegue criar o grupo sozinho (o WhatsApp
 * nao deixa). O lider cria o grupo, cola aqui o link de convite, e o site
 * monta a mensagem pronta para cada pessoa PRESENTE e sem pendencia -- esse
 * e o "gatilho" combinado.
 */

const CORES = { Amarelo: '#facc15', Azul: '#3b82f6', Roxo: '#a855f7', Verde: '#22c55e', Vermelho: '#ef4444' };

const TEXTO_PENDENCIA = {
  telefone: 'WhatsApp fora do padrão',
  igreja: 'falta a igreja',
  autorizacao: 'falta a autorização dos pais (menor de idade)'
};

const ATUALIZAR_A_CADA_MS = 15000;

const Cor = ({ cor }) => cor ? (
  <span className="inline-flex items-center gap-1 text-xs text-gray-300">
    <span className="h-2.5 w-2.5 rounded-full" style={{ background: CORES[cor] || '#999' }} />
    {cor}
  </span>
) : null;

const tituloEquipe = (e) => `${e.area}${e.cor ? ` · ${e.cor}` : ''}`;

const RelacaoLider = ({ equipanteId, dono, liderDe = [] }) => {
  const { toast } = useToast();
  const [aberta, setAberta] = useState(true);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [ocupado, setOcupado] = useState({});

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    const r = await fetchRelacaoLider(equipanteId, dono);
    if (!silencioso) setCarregando(false);
    if (r.ok) {
      setDados(r);
      setErro('');
    } else if (!silencioso || !dados) {
      setErro(r.erro || 'Não foi possível abrir a relação.');
    }
  }, [equipanteId, dono?.cpf, dono?.nome, dono?.nascimento]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { carregar(); }, [carregar]);

  // Atualiza sozinha: quem os organizadores alocarem aparece aqui, e quem
  // corrigiu a ficha sai do aviso, sem o lider precisar tocar em nada.
  useEffect(() => {
    const t = setInterval(() => carregar(true), ATUALIZAR_A_CADA_MS);
    return () => clearInterval(t);
  }, [carregar]);

  // Executa uma acao e recarrega a relacao. `id` marca o botao como ocupado.
  const agir = async (id, acao, sucesso) => {
    setOcupado((o) => ({ ...o, [id]: true }));
    const r = await acao();
    setOcupado((o) => ({ ...o, [id]: false }));
    if (!r.ok) {
      toast({ title: 'Não deu certo', description: r.erro, variant: 'destructive' });
      return r;
    }
    if (sucesso) toast({ title: sucesso(r), className: 'bg-green-600 text-white' });
    await carregar(true);
    return r;
  };

  const equipes = dados?.equipes || [];
  const total = equipes.reduce((n, e) => n + (e.membros || []).length, 0);
  const resumoLider = liderDe.map(tituloEquipe).join(', ');

  return (
    <div className="bg-black/40 border border-amber-500/30 rounded-xl p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-start gap-3 flex-1">
          <Users className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-white font-semibold text-lg">Você é líder: {resumoLider}</h3>
            <p className="text-gray-400 text-sm">
              {dados
                ? <>Sua equipe tem <strong className="text-white">{total} {total === 1 ? 'pessoa' : 'pessoas'}</strong>. A lista se atualiza sozinha.</>
                : 'A relação da sua equipe, para a chamada da reunião de escala.'}
            </p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" onClick={() => carregar()} disabled={carregando}
            className="border-white/20 bg-transparent text-gray-200 hover:bg-white/10 hover:text-white">
            {carregando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Atualizar
          </Button>
          <Button variant="ghost" onClick={() => setAberta((v) => !v)}
            className="text-gray-400 hover:text-white hover:bg-white/10">
            {aberta ? <><ChevronUp className="w-4 h-4 mr-1" /> Esconder</> : <><ChevronDown className="w-4 h-4 mr-1" /> Mostrar</>}
          </Button>
        </div>
      </div>

      {aberta && !dados && (
        <div className="mt-5 text-center text-gray-400 py-6">
          {carregando ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : (erro || 'Carregando...')}
        </div>
      )}

      {aberta && dados && (
        <div className="mt-5 space-y-8">
          {equipes.map((equipe) => (
            <Equipe
              key={equipe.escala_id}
              equipe={equipe}
              ocupado={ocupado}
              onPresenca={(m, presente) => agir(`p-${m.escala_id}`,
                () => marcarPresenca(equipanteId, dono, m.escala_id, presente))}
              onConvite={(m) => agir(`c-${m.escala_id}`,
                () => marcarConviteLider(equipanteId, dono, m.escala_id))}
              onSalvarGrupo={(link) => agir(`g-${equipe.escala_id}`,
                () => salvarGrupoLider(equipanteId, dono, equipe.escala_id, link),
                (r) => (r.link ? 'Link do grupo salvo' : 'Link do grupo apagado'))}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const Numero = ({ valor, rotulo, cor }) => (
  <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center">
    <p className={cn('text-2xl font-bold leading-none', cor)}>{valor}</p>
    <p className="text-[11px] text-gray-400 mt-1">{rotulo}</p>
  </div>
);

const Equipe = ({ equipe, ocupado, onPresenca, onConvite, onSalvarGrupo }) => {
  const membros = equipe.membros || [];
  const presentes = membros.filter((m) => m.presente === true).length;
  const ausentes = membros.filter((m) => m.presente === false).length;
  const semChamada = membros.length - presentes - ausentes;
  const comPendencia = membros.filter((m) => m.pendencias?.length > 0).length;
  // O proprio lider criou o grupo -- nao precisa de convite.
  const prontosConvite = membros.filter((m) => m.presente === true && !m.pendencias?.length && !m.eu);

  return (
    <section className="space-y-4">
      <div className="border-b border-white/10 pb-3 space-y-3">
        <h4 className="text-xl font-bold text-white flex items-center gap-2 flex-wrap">
          {equipe.area} <Cor cor={equipe.cor} />
        </h4>
        <div className="grid grid-cols-4 gap-2">
          <Numero valor={membros.length} rotulo={membros.length === 1 ? 'pessoa' : 'pessoas'} cor="text-white" />
          <Numero valor={presentes} rotulo="presentes" cor="text-green-400" />
          <Numero valor={ausentes} rotulo="ausentes" cor="text-red-400" />
          <Numero valor={semChamada} rotulo="sem chamada" cor="text-gray-300" />
        </div>
        {comPendencia > 0 && (
          <p className="text-xs text-amber-300">
            {comPendencia} {comPendencia === 1 ? 'pessoa está' : 'pessoas estão'} com pendência no cadastro.
          </p>
        )}
      </div>

      <ul className="space-y-2">
        {membros.map((m) => (
          <Membro key={m.escala_id} m={m} grupoLink={equipe.grupo_link} area={equipe.area}
            ocupado={ocupado} onPresenca={onPresenca} onConvite={onConvite} />
        ))}
        {membros.length === 0 && <li className="text-sm text-gray-500">Ninguém nesta equipe ainda.</li>}
      </ul>

      <GrupoWhatsApp equipe={equipe} prontos={prontosConvite} ocupado={ocupado[`g-${equipe.escala_id}`]}
        onSalvar={onSalvarGrupo} />
    </section>
  );
};

const Membro = ({ m, grupoLink, area, ocupado, onPresenca, onConvite }) => {
  const pendente = m.pendencias?.length > 0;
  const zap = linkWhatsApp(m.whatsapp, m.estrangeiro);
  const podeConvidar = grupoLink && m.presente === true && !pendente && !m.eu;
  const conviteTexto = `Olá, ${(m.nome || '').split(' ')[0]}! Aqui é da equipe ${area} do Metanoia Radical Serra. `
    + `Entre no nosso grupo pelo link: ${grupoLink}`;
  const ocupadoPresenca = ocupado[`p-${m.escala_id}`];

  const enviarConvite = () => {
    const link = linkWhatsApp(m.whatsapp, m.estrangeiro, conviteTexto);
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
    onConvite(m);
  };

  return (
    <li className={cn('rounded-lg border p-3',
      pendente ? 'border-amber-500/40 bg-amber-500/5'
        : m.presente === true ? 'border-green-500/30 bg-green-500/5'
          : m.presente === false ? 'border-red-500/30 bg-red-500/5'
            : 'border-white/10 bg-white/5')}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium flex items-center gap-2 flex-wrap">
            {m.nome}
            {m.eu && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-300">você</span>}
            {m.eh_lider && !m.eu && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">líder</span>}
            {m.incluido_por?.startsWith('Líder') && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300">incluído na reunião</span>
            )}
          </p>
          <p className="text-xs text-gray-400 truncate">{nomeDaIgreja(m) || 'Igreja não informada'}</p>
          <p className="text-sm text-gray-300 flex items-center gap-2 mt-0.5">
            {m.whatsapp ? (m.estrangeiro ? m.whatsapp : formatarTelefone(m.whatsapp)) : 'Sem telefone'}
            {zap && (
              <a href={zap} target="_blank" rel="noopener noreferrer" aria-label="Abrir conversa no WhatsApp"
                className="text-green-400 hover:text-green-300">
                <MessageCircle className="w-4 h-4" />
              </a>
            )}
            {m.atuacao && <span className="text-xs text-gray-500">· {m.atuacao}</span>}
            {m.cor && <Cor cor={m.cor} />}
          </p>
        </div>

        <div className="flex gap-2 shrink-0">
          <Button size="sm" disabled={ocupadoPresenca}
            onClick={() => onPresenca(m, m.presente === true ? null : true)}
            className={cn('h-10 px-3', m.presente === true
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-transparent border border-green-600/50 text-green-300 hover:bg-green-600/20')}>
            <Check className="w-4 h-4 mr-1" /> Presente
          </Button>
          <Button size="sm" disabled={ocupadoPresenca}
            onClick={() => onPresenca(m, m.presente === false ? null : false)}
            className={cn('h-10 px-3', m.presente === false
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-transparent border border-red-600/50 text-red-300 hover:bg-red-600/20')}>
            <X className="w-4 h-4 mr-1" /> Ausente
          </Button>
        </div>
      </div>

      {pendente && (
        <p className="mt-2 text-xs text-amber-200 flex items-start gap-1.5">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>
            Cadastro com pendência: {m.pendencias.map((p) => TEXTO_PENDENCIA[p.tipo] || p.tipo).join(', ')}.
            A pessoa precisa corrigir no acompanhamento da inscrição dela (site → Equipante → CPF).
            Depois toque em <strong>Atualizar</strong>.
          </span>
        </p>
      )}

      {podeConvidar && (
        <div className="mt-2 flex items-center gap-2">
          <Button size="sm" onClick={enviarConvite} disabled={ocupado[`c-${m.escala_id}`]}
            className={cn('h-8', m.convite_enviado_em
              ? 'bg-transparent border border-white/20 text-gray-300 hover:bg-white/10'
              : 'bg-[#25D366] hover:bg-[#20bd5a] text-white')}>
            <Send className="w-3.5 h-3.5 mr-1.5" />
            {m.convite_enviado_em ? 'Reenviar convite' : 'Enviar convite do grupo'}
          </Button>
          {m.convite_enviado_em && (
            <span className="text-xs text-green-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> convite enviado
            </span>
          )}
        </div>
      )}
    </li>
  );
};

const GrupoWhatsApp = ({ equipe, prontos, ocupado, onSalvar }) => {
  const { toast } = useToast();
  const [editando, setEditando] = useState(!equipe.grupo_link);
  const [link, setLink] = useState(equipe.grupo_link || '');

  useEffect(() => {
    setEditando(!equipe.grupo_link);
    setLink(equipe.grupo_link || '');
  }, [equipe.grupo_link]);

  const enviados = prontos.filter((m) => m.convite_enviado_em).length;

  const copiarTelefones = async () => {
    const lista = prontos.map((m) => `${m.nome} - ${m.estrangeiro ? m.whatsapp : formatarTelefone(m.whatsapp)}`).join('\n');
    try {
      await navigator.clipboard.writeText(lista);
      toast({ title: `${prontos.length} telefones copiados`, className: 'bg-green-600 text-white' });
    } catch {
      toast({ title: 'Não consegui copiar', description: 'Seu navegador bloqueou a área de transferência.', variant: 'destructive' });
    }
  };

  return (
    <div className="rounded-lg border border-[#25D366]/30 bg-[#25D366]/5 p-4 space-y-3">
      <p className="text-white font-medium flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-[#25D366]" /> Grupo de WhatsApp da equipe
      </p>

      {editando ? (
        <>
          <ol className="text-xs text-gray-300 list-decimal pl-4 space-y-0.5">
            <li>Crie o grupo no seu WhatsApp.</li>
            <li>No grupo, toque em “Convidar via link” e copie o link.</li>
            <li>Cole aqui. O botão de convite aparece para quem estiver <strong>presente e sem pendência</strong>.</li>
          </ol>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input value={link} onChange={(e) => setLink(e.target.value)}
              placeholder="https://chat.whatsapp.com/..."
              className="bg-black/40 border-white/20 text-white" />
            <div className="flex gap-2">
              <Button onClick={() => onSalvar(link)} disabled={ocupado || !link.trim()}
                className="bg-[#25D366] hover:bg-[#20bd5a] text-white">
                {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar link'}
              </Button>
              {equipe.grupo_link && (
                <Button variant="ghost" onClick={() => setEditando(false)} className="text-gray-400 hover:text-white hover:bg-white/10">
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-gray-300 break-all">{equipe.grupo_link}</p>
          <p className="text-xs text-gray-400">
            {prontos.length === 0
              ? 'Ninguém liberado ainda: o convite aparece para quem for marcado presente e estiver sem pendência.'
              : `${prontos.length} liberados para o convite · ${enviados} já enviados.`}
          </p>
          <div className="flex flex-wrap gap-2">
            {prontos.length > 0 && (
              <Button size="sm" variant="outline" onClick={copiarTelefones}
                className="border-white/20 bg-transparent text-gray-200 hover:bg-white/10 hover:text-white">
                <Copy className="w-4 h-4 mr-1.5" /> Copiar telefones dos presentes
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setEditando(true)}
              className="text-gray-400 hover:text-white hover:bg-white/10">
              Trocar link
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onSalvar('')} disabled={ocupado}
              className="text-gray-500 hover:text-red-300 hover:bg-white/10">
              Apagar link
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default RelacaoLider;
