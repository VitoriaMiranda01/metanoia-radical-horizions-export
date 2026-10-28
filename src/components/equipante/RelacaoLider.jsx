import { useLocaisReuniao } from '@/constants/locaisReuniao';
import TagEspecialidade from '@/components/common/TagEspecialidade';
import { ESPECIALIDADE_OUTRO } from '@/constants/especialidadesSaude';
import React, {
  memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState
} from 'react';
import {
  AlertTriangle, Camera, Check, CheckCircle2, ChevronDown, ChevronUp, Copy, Loader2, MapPin, MessageCircle,
  Plus, RefreshCw, Search, Send, Trash2, Truck, UserCog, Users, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { nomeDaIgreja } from '@/constants/igrejas';
import { areaExtraPorChave, rotuloAreaExtra } from '@/constants/areasExtra';
import { formatarTelefone } from '@/utils/telefone';
import { gerarVCard, baixarVcf } from '@/utils/vcard';
import { cn } from '@/lib/utils';
import SeloOutraCidade, { ehPresencaAutomatica } from '@/components/scales/SeloOutraCidade';
import {
  fetchRelacaoLider, fetchAssinaturaRelacao, marcarPresenca, salvarGrupoLider, marcarConviteLider, marcarNoGrupo,
  grupoTrilhaFotografo, linkWhatsApp, numeroWhatsApp,
  trocarAtuacaoLider, definirCorLider, delegarReuniao,
  buscarParaAreaExtra, incluirNaAreaExtra, removerDaAreaExtra,
  buscarParaModulo, incluirNoModulo, removerDoModulo
} from '@/services/liderService';

/**
 * "Minha equipe" -- a relacao do lider, no acompanhamento da inscricao.
 *
 * Pedido do Patrick (05/10/2026): depois que a escala PROVISORIA sai, cada
 * lider ve quem esta escalado na sua area (nome completo, igreja e
 * telefone) e faz a CHAMADA na reuniao de escala, como chamada de escola.
 * Toda nova alocacao aparece sozinha (a relacao se atualiza a cada 15 s).
 * Sem codigo de lider: vale a mesma prova de dono do acompanhamento.
 *
 * 15/10/2026 (lider v2):
 *  - so aparece depois que a pessoa viu a propria area;
 *  - uma ABA por equipe (lider de mais de uma area, responsavel pela
 *    reuniao de outra, lider de area extra), um toque troca de uma pra outra;
 *  - busca e filtros, sempre em ordem alfabetica;
 *  - o lider troca a atuacao (areas com 2+ atuacoes alem do lider, menos
 *    Guia) e, so na Fotografia, a cor;
 *  - o Invisivel de cada cor ve tambem os Marcadores da cor (selo Marcador);
 *  - "Delegar reuniao": outra pessoa da equipe faz a chamada e o grupo;
 *  - lider de area extra ve os aprovados e pode puxar mais gente.
 *
 * 23/10/2026: o lider da Recepcao Igreja conduz as cinco areas da igreja
 * (equipe.pode_gerenciar) e inclui/tira gente da escala nelas.
 *
 * Feito para celular: so a aba aberta e desenhada, cada linha so redesenha
 * quando os dados DELA mudam, e a atualizacao automatica para quando a tela
 * esta em segundo plano.
 */

const CORES = { Amarelo: '#facc15', Azul: '#3b82f6', Roxo: '#a855f7', Verde: '#22c55e', Vermelho: '#ef4444' };
const LISTA_CORES = Object.keys(CORES);

const TEXTO_PENDENCIA = {
  telefone: 'WhatsApp fora do padrão',
  igreja: 'falta a igreja',
  autorizacao: 'falta a autorização dos pais (menor de idade)'
};

// 18/10/2026 (dia de ~1000 acessos): o celular pergunta so a ASSINATURA das
// suas equipes (62 bytes) e baixa a lista inteira (50-70 KB) apenas quando ela
// muda -- ou a cada 60 s, por garantia (ex.: pendencia corrigida na ficha).
const CONFERIR_A_CADA_MS = 10000;
// Equipe que mais de uma pessoa conduz (lider + responsavel, ou dois
// responsaveis): a chamada de um aparece para o outro em poucos segundos.
const CONFERIR_COMPARTILHADA_MS = 4000;
const RECARREGAR_SEMPRE_MS = 60000;

// Linhas longas so sao desenhadas quando chegam perto da tela.
const LINHA_LEVE = { contentVisibility: 'auto', containIntrinsicSize: 'auto 104px' };

const porNome = (a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' });
const semAcento = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const Cor = ({ cor }) => cor ? (
  <span className="inline-flex items-center gap-1 text-xs text-gray-300">
    <span className="h-2.5 w-2.5 rounded-full" style={{ background: CORES[cor] || '#999' }} />
    {cor}
  </span>
) : null;

// "Maria da Silva Souza" -> "Maria da Silva" (nome e primeiro sobrenome).
const nomeCurto = (nome) => {
  const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 1) return partes[0] || '';
  const ligas = ['da', 'de', 'do', 'das', 'dos', 'e'];
  const out = [partes[0]];
  for (let i = 1; i < partes.length; i += 1) {
    out.push(partes[i]);
    if (!ligas.includes(partes[i].toLowerCase())) break;
  }
  return out.join(' ');
};

// Responsaveis pela reuniao de uma equipe (lista; telas antigas tinham um so).
const responsaveisDe = (e) => e?.delegados || (e?.delegado ? [e.delegado] : []);

const tituloEquipe = (e) => `${e.area}${e.cor ? ` · ${e.cor}` : ''}`;

// Grupos de trilha (19/10/2026, Patrick): o RESPONSAVEL pela reuniao de varias
// destas equipes ve uma aba por COR ("Grupo Amarelo"...), com todas as areas
// da cor juntas, separadas em blocos nesta ordem e com a etiqueta da area em
// cada pessoa. O lider continua vendo a sua equipe como antes. So a tela
// muda: presenca, convite e grupo continuam por equipe no servidor.
const AREAS_TRILHA = ['Guia', 'Invisível', 'Marcador', 'Pastor Invisível', 'Espírito Santo', 'Inimigo'];
const ORDEM_CORES_TRILHA = ['Amarelo', 'Azul', 'Vermelho', 'Verde', 'Roxo'];
const ETIQUETA_TRILHA = {
  'Guia': 'bg-teal-500/15 text-teal-200',
  'Invisível': 'bg-violet-500/15 text-violet-200',
  'Marcador': 'bg-pink-500/15 text-pink-200',
  'Pastor Invisível': 'bg-orange-500/15 text-orange-200',
  'Espírito Santo': 'bg-sky-500/15 text-sky-200',
  'Inimigo': 'bg-zinc-500/25 text-zinc-200'
};

const agruparTrilhaPorCor = (equipes) => {
  // Entra tambem a equipe em que a pessoa e LIDER (19/10/2026: o Mauricio e
  // lider do Guia Roxo e responsavel pelo resto -- o Guia Roxo ficava numa aba
  // separada, fora do Grupo Roxo). So agrupa quem e responsavel de alguma.
  const daTrilha = equipes.filter((e) => AREAS_TRILHA.includes(e.area));
  if (daTrilha.length < 2 || !daTrilha.some((e) => e.papel === 'delegado')) return { grupos: [], resto: equipes };
  const porCor = new Map();
  daTrilha.forEach((e) => (e.membros || []).forEach((m) => {
    // Sem cor vai para o grupo "Sem cor", nunca para a cor da equipe: o
    // servidor manda quem esta sem cor em TODAS as equipes da area (para o
    // lider poder marcar e escolher a cor), e a pessoa aparecia em todos os
    // grupos (caso da Laiza, 23/10/2026).
    const cor = m.cor ? (e.cor || m.cor) : 'Sem cor';
    if (!porCor.has(cor)) porCor.set(cor, { membros: new Map(), origens: new Set(), fotografos: new Map() });
    const g = porCor.get(cor);
    g.origens.add(e);
    if (!g.membros.has(m.escala_id)) {
      g.membros.set(m.escala_id, {
        ...m,
        _grupo_link: e.grupo_link || null,
        _atuacoes: !m.eh_lider && m.area === e.area ? e.atuacoes : null,
        _responsavel: responsaveisDe(e).some((d) => d.equipante_id === m.equipante_id),
        // 19/10/2026: o responsavel/lider da trilha troca a cor (mesma area).
        _podeCor: !!e.pode_trocar_cor && !m.eh_lider
      });
    }
  }));
  // Fotografos da cor (27/10/2026): o servidor manda em cada equipe da trilha
  // com cor (Guia Verde, Invisivel Verde...); aqui ficam uma vez so por cor.
  daTrilha.forEach((e) => {
    if (!e.cor || !(e.fotografos || []).length) return;
    if (!porCor.has(e.cor)) porCor.set(e.cor, { membros: new Map(), origens: new Set(), fotografos: new Map() });
    const g = porCor.get(e.cor);
    g.origens.add(e);
    e.fotografos.forEach((f) => { if (!g.fotografos.has(f.escala_id)) g.fotografos.set(f.escala_id, f); });
  });
  const ordem = [...ORDEM_CORES_TRILHA, ...[...porCor.keys()].filter((c) => !ORDEM_CORES_TRILHA.includes(c))];
  const grupos = ordem.filter((c) => porCor.has(c)).map((cor) => {
    const g = porCor.get(cor);
    const origens = [...g.origens];
    // UM grupo de WhatsApp por cor (19/10/2026, Patrick), nao por area. O link
    // fica gravado nas equipes daquela cor (Guia Amarelo, Invisivel Amarelo):
    // o lider de cada uma ve o mesmo link. Espirito Santo, Inimigo e Pastor
    // Invisivel sao uma equipe so para todas as cores, entao nao guardam o
    // link da cor -- o convite deles usa o link do grupo da cor da pessoa.
    // Sem cor nao tem grupo de WhatsApp: guardar o link ali gravaria por cima
    // do grupo de uma cor.
    const semCor = cor === 'Sem cor';
    const guardam = origens.filter((e) => e.cor && e.escala_id);
    const ondeGuardar = semCor ? [] : guardam.length > 0 ? guardam : origens.filter((e) => e.escala_id);
    const link = ondeGuardar.map((e) => e.grupo_link).find(Boolean) || null;
    return {
      chave: `cor:${cor}`, area: semCor ? 'Sem cor' : `Grupo ${cor}`, cor: CORES[cor] ? cor : null,
      papel: 'delegado', porCor: true, semCor, origens, ondeGuardar, grupo_link: link,
      trocados: semCor ? [] : [...new Map(origens.flatMap((e) => e.trocados || []).map((t) => [t.escala_id, t])).values()],
      membros: [...g.membros.values()].map((m) => ({ ...m, _grupo_link: link })),
      fotografos: semCor ? [] : [...g.fotografos.values()],
      lideres: [...new Set(origens.flatMap((e) => e.lideres || []))]
    };
  });
  return { grupos, resto: equipes.filter((e) => !daTrilha.includes(e)) };
};

// Equipe com cor (Guia Azul...): quem esta sem cor sai da lista dela e vai
// para uma aba "<area> · Sem cor", uma por area, depois das equipes. So
// aparece quando ha alguem sem cor (Patrick, 23/10/2026).
const separarSemCor = (equipes) => {
  const semCor = new Map();
  const comCor = equipes.map((e) => {
    if (!e.cor) return e;
    const fora = (e.membros || []).filter((m) => !m.cor);
    if (fora.length === 0) return e;
    if (!semCor.has(e.area)) semCor.set(e.area, { origens: [], membros: new Map() });
    const g = semCor.get(e.area);
    g.origens.push(e);
    fora.forEach((m) => {
      if (!g.membros.has(m.escala_id)) {
        g.membros.set(m.escala_id, {
          ...m,
          _grupo_link: null,
          _atuacoes: !m.eh_lider && m.area === e.area ? e.atuacoes : null,
          _responsavel: responsaveisDe(e).some((d) => d.equipante_id === m.equipante_id),
          _podeCor: !!e.pode_trocar_cor && !m.eh_lider
        });
      }
    });
    return { ...e, membros: e.membros.filter((m) => m.cor) };
  });
  const abasSemCor = [...semCor.entries()].map(([area, g]) => ({
    chave: `semcor:${area}`, area: `${area} · Sem cor`, cor: null,
    papel: 'sem_cor', porCor: true, semCor: true, origens: g.origens, ondeGuardar: [], grupo_link: null,
    trocados: [], membros: [...g.membros.values()],
    lideres: [...new Set(g.origens.flatMap((e) => e.lideres || []))]
  }));
  return { comCor, abasSemCor };
};

const telefoneVisivel = (m) => (m.whatsapp ? (m.estrangeiro ? m.whatsapp : formatarTelefone(m.whatsapp)) : 'Sem telefone');

const RelacaoLider = ({ equipanteId, dono: donoBruto, liderDe = [], delegadoDe = [], liderExtraDe = [], onPresencaPropria }) => {
  const { toast } = useToast();
  // O mesmo objeto enquanto CPF/nome/nascimento nao mudam: sem isso as
  // funcoes de cada linha mudariam a cada desenho e a lista inteira redesenharia.
  const dono = useMemo(() => donoBruto, [donoBruto?.cpf, donoBruto?.nome, donoBruto?.nascimento]); // eslint-disable-line react-hooks/exhaustive-deps
  const [aberta, setAberta] = useState(true);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [ocupado, setOcupado] = useState({});
  const [aba, setAba] = useState(null);
  const [delegando, setDelegando] = useState(false);
  const temDados = useRef(false);
  const ultimo = useRef(null);
  const meusToques = useRef(new Set());
  // Atualizacao que saiu ANTES de um toque (presenca, atuacao...) chega com
  // a lista velha: e descartada, senao o botao "voltava" por um instante.
  const versao = useRef(0);
  const emVoo = useRef(0);
  const assinatura = useRef(null);
  const carregadoEm = useRef(0);
  const conferindo = useRef(false);

  const carregar = useCallback(async (silencioso = false) => {
    const v = versao.current;
    if (!silencioso) setCarregando(true);
    const r = await fetchRelacaoLider(equipanteId, dono);
    if (!silencioso) setCarregando(false);
    if (r.ok) {
      if (silencioso && (emVoo.current > 0 || v !== versao.current)) return;
      // O que OUTRA pessoa mudou desde a ultima leitura (presenca marcada pelo
      // outro responsavel/lider): avisa, para ninguem achar que a tela errou.
      if (silencioso && ultimo.current) {
        const antes = new Map();
        (ultimo.current.equipes || []).forEach((e) => (e.membros || []).forEach((m) => antes.set(m.escala_id, m.presente)));
        const mudou = [];
        (r.equipes || []).forEach((e) => (e.membros || []).forEach((m) => {
          // So o que OUTRA pessoa mudou (nao o meu proprio toque).
          if (antes.has(m.escala_id) && (antes.get(m.escala_id) ?? null) !== (m.presente ?? null)
              && !meusToques.current.has(m.escala_id) && m.marcado_por !== r.lider
              && !mudou.some((x) => x.escala_id === m.escala_id)) mudou.push({ ...m, equipe: e });
        }));
        if (mudou.length > 0) {
          const por = [...new Set(mudou.map((m) => m.marcado_por).filter(Boolean))];
          const primeiro = mudou[0];
          toast({
            title: mudou.length === 1
              ? `${(primeiro.nome || '').split(' ')[0]} agora está ${primeiro.presente === true ? 'presente' : primeiro.presente === false ? 'ausente' : 'sem chamada'}`
              : `${mudou.length} presenças atualizadas`,
            description: `${por.length ? `Marcado por ${por.join(' e ')}. ` : ''}Equipe ${tituloEquipe(primeiro.equipe)}${mudou.length > 1 ? ' e outras' : ''}.`,
            className: 'bg-sky-700 text-white'
          });
        }
      }
      ultimo.current = r;
      assinatura.current = r.assinatura || null;
      carregadoEm.current = Date.now();
      meusToques.current.clear();
      temDados.current = true;
      setDados(r);
      setErro('');
    } else if (!silencioso || !temDados.current) {
      setErro(r.erro || 'Não foi possível abrir a relação.');
    }
  }, [equipanteId, dono?.cpf, dono?.nome, dono?.nascimento]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { carregar(); }, [carregar]);

  // Atualiza sozinha -- mas so com a tela a vista (celular no bolso nao
  // fica baixando a lista).
  // Mais rapido quando alguma equipe tem outra pessoa conduzindo junto.
  const compartilhada = (dados?.equipes || []).some((e) => {
    const delegados = e.delegados || (e.delegado ? [e.delegado] : []);
    return delegados.length >= 2 || (delegados.length >= 1 && (e.lideres || []).length > 0);
  });
  // Confere a assinatura; so recarrega a lista se algo mudou (ou deu 60 s).
  const conferir = useCallback(async () => {
    if (conferindo.current || emVoo.current > 0) return;
    conferindo.current = true;
    try {
      if (!assinatura.current || Date.now() - carregadoEm.current > RECARREGAR_SEMPRE_MS) {
        await carregar(true);
        return;
      }
      const r = await fetchAssinaturaRelacao(equipanteId, dono);
      // Sem resposta valida (rede, servidor antigo): recarrega do jeito antigo.
      if (!r.ok || !r.assinatura || r.assinatura !== assinatura.current) await carregar(true);
    } finally {
      conferindo.current = false;
    }
  }, [carregar, equipanteId, dono]);

  useEffect(() => {
    const t = setInterval(() => {
      if (typeof document === 'undefined' || !document.hidden) conferir();
    }, compartilhada ? CONFERIR_COMPARTILHADA_MS : CONFERIR_A_CADA_MS);
    const aoVoltar = () => { if (!document.hidden) conferir(); };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', aoVoltar); };
  }, [conferir, compartilhada]);

  // Muda um membro na tela na hora (o toque responde sem esperar o servidor).
  const ajustarMembro = useCallback((escalaId, mudanca) => {
    versao.current += 1;
    setDados((d) => d && ({
      ...d,
      equipes: (d.equipes || []).map((e) => (
        (e.membros || []).some((m) => m.escala_id === escalaId)
          ? { ...e, membros: e.membros.map((m) => (m.escala_id === escalaId ? { ...m, ...mudanca } : m)) }
          : e))
    }));
  }, []);

  // Executa uma acao e recarrega a relacao. `id` marca o botao como ocupado.
  const agir = useCallback(async (id, acao, sucesso) => {
    setOcupado((o) => ({ ...o, [id]: true }));
    emVoo.current += 1;
    const r = await acao();
    emVoo.current -= 1;
    versao.current += 1;
    setOcupado((o) => { const c = { ...o }; delete c[id]; return c; });
    if (!r.ok) {
      toast({ title: 'Não deu certo', description: r.erro, variant: 'destructive' });
      await carregar(true);
      return r;
    }
    if (sucesso) toast({ title: sucesso(r), className: 'bg-green-600 text-white' });
    await carregar(true);
    return r;
  }, [carregar, toast]);

  const onPresenca = useCallback((m, presente) => {
    meusToques.current.add(m.escala_id);
    ajustarMembro(m.escala_id, { presente });
    agir(`p-${m.escala_id}`, () => marcarPresenca(equipanteId, dono, m.escala_id, presente))
      .then((r) => { if (r.ok && m.eu) onPresencaPropria?.(); });
  }, [agir, ajustarMembro, equipanteId, dono, onPresencaPropria]);

  const onConvite = useCallback((m) => {
    agir(`c-${m.escala_id}`, () => marcarConviteLider(equipanteId, dono, m.escala_id));
  }, [agir, equipanteId, dono]);

  // "Ja esta no grupo" (marcado a mao; o site nao sabe se a pessoa entrou).
  const onNoGrupo = useCallback((m, valor) => {
    ajustarMembro(m.escala_id, valor
      ? { no_grupo_em: new Date().toISOString(), grupo_pedido_em: null }
      : { no_grupo_em: null });
    agir(`n-${m.escala_id}`, () => marcarNoGrupo(equipanteId, dono, m.escala_id, valor));
  }, [agir, ajustarMembro, equipanteId, dono]);

  // Fotografos no grupo da trilha (27/10/2026): mesmo convite e mesma marcacao,
  // gravados a parte (o fotografo tem tambem o grupo da Fotografia).
  const ajustarFotografo = useCallback((escalaId, mudanca) => {
    versao.current += 1;
    setDados((d) => d && ({
      ...d,
      equipes: (d.equipes || []).map((e) => (
        (e.fotografos || []).some((f) => f.escala_id === escalaId)
          ? { ...e, fotografos: e.fotografos.map((f) => (f.escala_id === escalaId ? { ...f, ...mudanca } : f)) }
          : e))
    }));
  }, []);

  const onConviteFoto = useCallback((f) => {
    agir(`cf-${f.escala_id}`, () => grupoTrilhaFotografo(equipanteId, dono, f.escala_id, 'convite'));
  }, [agir, equipanteId, dono]);

  const onNoGrupoFoto = useCallback((f, valor) => {
    ajustarFotografo(f.escala_id, valor
      ? { no_grupo_em: new Date().toISOString(), grupo_pedido_em: null }
      : { no_grupo_em: null });
    agir(`nf-${f.escala_id}`, () => grupoTrilhaFotografo(equipanteId, dono, f.escala_id, valor ? 'no_grupo' : 'fora_do_grupo'));
  }, [agir, ajustarFotografo, equipanteId, dono]);

  const onAtuacao = useCallback((m, atuacao) => {
    ajustarMembro(m.escala_id, { atuacao });
    agir(`e-${m.escala_id}`, () => trocarAtuacaoLider(equipanteId, dono, m.escala_id, atuacao),
      () => `${(m.nome || '').split(' ')[0]} agora é ${atuacao}`);
  }, [agir, ajustarMembro, equipanteId, dono]);

  const onCor = useCallback((m, cor) => {
    ajustarMembro(m.escala_id, { cor: cor || null });
    agir(`e-${m.escala_id}`, () => definirCorLider(equipanteId, dono, m.escala_id, cor),
      () => (cor ? `${(m.nome || '').split(' ')[0]} agora é ${cor}` : 'Cor retirada'));
  }, [agir, ajustarMembro, equipanteId, dono]);

  // Lider da Recepcao Igreja: tirar alguem de uma das cinco areas da igreja.
  const onRemover = useCallback((m) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Tirar ${m.nome} de ${m.area}?`)) return;
    agir(`r-${m.escala_id}`, () => removerDoModulo(equipanteId, dono, m.escala_id),
      () => `${(m.nome || '').split(' ')[0]} saiu de ${m.area}`);
  }, [agir, equipanteId, dono]);

  const onBuscarModulo = useCallback((area, termo) => buscarParaModulo(equipanteId, dono, area, termo), [equipanteId, dono]);

  const onIncluirModulo = useCallback((area, p) => agir(`i-${p.equipante_id}`,
    () => incluirNoModulo(equipanteId, dono, area, p.equipante_id),
    () => `${p.nome} incluído em ${area}`), [agir, equipanteId, dono]);

  const equipes = dados?.equipes || [];
  const extras = dados?.extras || [];

  const trilha = useMemo(() => agruparTrilhaPorCor(equipes), [equipes]);
  const resto = useMemo(() => separarSemCor(trilha.resto), [trilha]);

  const abas = useMemo(() => [
    ...trilha.grupos.map((g) => ({
      chave: g.chave, tipo: 'equipe', equipe: g, rotulo: g.area, corDot: g.cor, qtd: g.membros.length
    })),
    ...resto.comCor.map((e) => ({
      chave: `e:${e.chave}`, tipo: 'equipe', equipe: e,
      rotulo: tituloEquipe(e), selo: e.papel === 'delegado' ? 'reunião' : null
    })),
    ...resto.abasSemCor.map((g) => ({
      chave: g.chave, tipo: 'equipe', equipe: g, rotulo: g.area, qtd: g.membros.length
    })),
    ...extras.map((x) => ({
      chave: `x:${x.area}`, tipo: 'extra', extra: x,
      rotulo: rotuloAreaExtra(x.area), selo: 'extra'
    }))
  ], [trilha, resto, extras]);

  const abaAtual = abas.find((a) => a.chave === aba) || abas[0] || null;
  const equipeAtual = abaAtual?.tipo === 'equipe' ? abaAtual.equipe : null;
  const podeDelegar = equipeAtual?.papel === 'lider';

  // Muitas equipes (ex.: responsavel por 13): so a quantidade -- as abas listam cada uma.
  const resumo = (lista, rotulo) => (lista.length > 4 ? `${lista.length} equipes` : lista.map(rotulo).join(', '));
  const titulo = liderDe.length > 0
    ? `Você é líder: ${resumo(liderDe, tituloEquipe)}`
    : delegadoDe.length > 0
      ? `Responsável pela reunião: ${resumo(delegadoDe, tituloEquipe)}`
      : `Líder da área extra: ${resumo(liderExtraDe, rotuloAreaExtra)}`;

  return (
    <div id="relacao-lider" className="bg-black/40 border border-amber-500/30 rounded-xl p-4 sm:p-6 scroll-mt-20">
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <Users className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h3 className="text-white font-semibold text-lg leading-snug">{titulo}</h3>
            <p className="text-gray-400 text-sm">A lista se atualiza sozinha, sempre em ordem alfabética.</p>
          </div>
        </div>
        {/* Celular: Atualizar e Esconder lado a lado, Delegar na linha de
            baixo, inteiro (o nome e grande). */}
        <div className="grid grid-cols-2 sm:flex sm:justify-end gap-2">
          <Button variant="outline" onClick={() => carregar()} disabled={carregando}
            className="h-10 border-white/20 bg-transparent text-gray-200 hover:bg-white/10 hover:text-white">
            {carregando ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
            Atualizar
          </Button>
          <Button variant="ghost" onClick={() => setAberta((v) => !v)}
            className="h-10 text-gray-400 hover:text-white hover:bg-white/10 sm:order-last">
            {aberta ? <><ChevronUp className="w-4 h-4 mr-1" /> Esconder</> : <><ChevronDown className="w-4 h-4 mr-1" /> Mostrar</>}
          </Button>
          {podeDelegar && (
            <Button variant="outline" onClick={() => setDelegando(true)}
              title="Delegar responsável pela reunião da escala"
              className="col-span-2 h-10 border-amber-500/40 bg-transparent text-amber-200 hover:bg-amber-500/10 hover:text-amber-100">
              <UserCog className="w-4 h-4 mr-1.5 shrink-0" />
              <span className="truncate">Delegar responsável pela reunião</span>
            </Button>
          )}
        </div>
        {/* Quem conduz a reuniao, com o nome completo, logo abaixo do botao.
            Pode ter mais de um, e de outra area (17/10/2026). */}
        {podeDelegar && responsaveisDe(equipeAtual).length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm space-y-1">
            {responsaveisDe(equipeAtual).map((d) => (
              <div key={d.equipante_id}>
                <p className="text-amber-100">
                  <UserCog className="inline w-4 h-4 mr-1.5 -mt-0.5" />
                  Responsável pela reunião{abas.length > 1 ? ` (${tituloEquipe(equipeAtual)})` : ''}:{' '}
                  <strong className="text-white">{d.nome}</strong>
                  {d.de_fora && <span className="text-xs text-sky-200"> · de outra área</span>}
                </p>
                {d.definido_por && (
                  <p className="text-xs text-amber-200/70 mt-0.5">definido por {d.definido_por}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {aberta && !dados && (
        <div className="mt-5 text-center text-gray-400 py-6">
          {carregando ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : (erro || 'Carregando...')}
        </div>
      )}

      {aberta && dados && dados.presenca_aberta === false && (
        <p className="mt-3 text-sm text-amber-200 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
          A chamada só podia ser feita no dia da reunião de leitura da escala e já foi encerrada.
          Você continua com a lista e o WhatsApp da sua equipe para entrar em contato.
        </p>
      )}

      {aberta && dados && trilha.grupos.length > 0 && (
        <p className="mt-3 text-xs text-amber-200/90">
          Os grupos de trilha estão juntos por cor: cada aba traz Guias, Invisíveis, Marcadores, Pastores
          Invisíveis, Espírito Santo e Inimigo daquela cor, separados por área. Confira a cor antes de marcar a presença.
        </p>
      )}

      {aberta && dados && trilha.grupos.length === 0 && equipes.length > 3 && (
        <p className="mt-3 text-xs text-amber-200/90">
          Você conduz a reunião de {equipes.length} equipes. Cada uma tem a sua lista, a sua chamada e o seu grupo de
          WhatsApp: escolha a equipe nas abas abaixo e confira o nome dela antes de marcar a presença ou mandar convite.
        </p>
      )}

      {aberta && dados && abas.length > 1 && (
        <div className="mt-4 -mx-1 flex gap-2 overflow-x-auto pb-1 px-1" role="tablist">
          {abas.map((a) => {
            const ativa = a.chave === abaAtual?.chave;
            return (
              <button key={a.chave} type="button" role="tab" aria-selected={ativa}
                onClick={() => setAba(a.chave)}
                className={cn('shrink-0 rounded-full border px-3 py-2 text-sm font-medium flex items-center gap-1.5',
                  ativa ? 'border-amber-400 bg-amber-400/15 text-amber-100' : 'border-white/15 bg-white/5 text-gray-300')}>
                {a.tipo === 'extra' && <Truck className="w-3.5 h-3.5" />}
                {a.corDot && <span className="h-2.5 w-2.5 rounded-full" style={{ background: CORES[a.corDot] }} />}
                {a.rotulo}
                {a.qtd != null && <span className="text-xs text-gray-400">{a.qtd}</span>}
                {a.selo === 'reunião' && <span className="text-[10px] uppercase text-amber-300/80">reunião</span>}
              </button>
            );
          })}
        </div>
      )}

      {aberta && dados && abas.length === 0 && (
        <p className="mt-5 text-sm text-gray-400">Nenhuma equipe por enquanto.</p>
      )}

      {aberta && dados && abaAtual?.tipo === 'equipe' && (
        <div className="mt-5">
          <Equipe
            key={abaAtual.chave}
            presencaAberta={dados.presenca_aberta !== false}
            equipe={abaAtual.equipe}
            ocupado={ocupado}
            onPresenca={onPresenca}
            onConvite={onConvite}
            onNoGrupo={onNoGrupo}
            onConviteFoto={onConviteFoto}
            onNoGrupoFoto={onNoGrupoFoto}
            envios={dados.envios}
            onAtuacao={onAtuacao}
            onCor={onCor}
            onRemover={onRemover}
            onBuscarModulo={onBuscarModulo}
            onIncluirModulo={onIncluirModulo}
            remetente={dados.lider}
            mostrarEquipe={abas.length > 1}
            onSalvarGrupo={(eq, link) => agir(`g-${eq.escala_id}`,
              () => salvarGrupoLider(equipanteId, dono, eq.escala_id, link),
              (r) => (r.link ? 'Link do grupo salvo' : 'Link do grupo apagado'))}
            onSalvarGrupoCor={(g, link) => agir(`g-${g.chave}`, async () => {
              // O mesmo link em todas as equipes da cor (Guia e Invisivel da cor).
              let r = { ok: true };
              for (const eq of g.ondeGuardar) {
                r = await salvarGrupoLider(equipanteId, dono, eq.escala_id, link);
                if (!r.ok) return r;
              }
              return r;
            }, (r) => (r.link ? `Link do ${g.area} salvo` : `Link do ${g.area} apagado`))}
          />
        </div>
      )}

      {aberta && dados && abaAtual?.tipo === 'extra' && (
        <div className="mt-5">
          <EquipeExtra key={abaAtual.chave} extra={abaAtual.extra} equipanteId={equipanteId} dono={dono}
            onMudou={() => carregar(true)} />
        </div>
      )}

      {delegando && equipeAtual && (
        <DelegarDialog equipe={equipeAtual}
          onClose={() => setDelegando(false)}
          onEscolher={async (pessoa) => {
            const r = await agir('delegar',
              () => delegarReuniao(equipanteId, dono, equipeAtual.area, equipeAtual.cor, pessoa?.equipante_id || null),
              () => (pessoa ? `${pessoa.nome} é o responsável pela reunião` : 'Responsável retirado'));
            if (r.ok) setDelegando(false);
          }}
          ocupado={!!ocupado.delegar} />
      )}
    </div>
  );
};

const Numero = ({ valor, rotulo, cor, ativo, onClick }) => (
  <button type="button" onClick={onClick}
    className={cn('rounded-lg border px-2 py-2 text-center',
      ativo ? 'border-amber-400/70 bg-amber-400/10' : 'border-white/10 bg-white/5')}>
    <p className={cn('text-2xl font-bold leading-none', cor)}>{valor}</p>
    <p className="text-[11px] text-gray-400 mt-1">{rotulo}</p>
  </button>
);

const FILTROS = {
  todos: () => true,
  presentes: (m) => m.presente === true,
  ausentes: (m) => m.presente === false,
  sem_chamada: (m) => m.presente !== true && m.presente !== false,
  pendencia: (m) => m.pendencias?.length > 0,
  // Grupo de WhatsApp (21/10/2026): a propria lider/responsavel nao entra na conta.
  no_grupo: (m) => !!m.no_grupo_em && !m.eu,
  fora_do_grupo: (m) => !m.no_grupo_em && !m.eu,
  nao_conseguiu: (m) => !!m.grupo_pedido_em && !m.no_grupo_em && !m.eu,
  // Quem vem de outra area para a reuniao desta equipe (Marcadores na
  // Invisivel, Perseguidos na Selva).
  agregados: (m, equipe) => m.area !== equipe.area,
  da_area: (m, equipe) => m.area === equipe.area
};

// Filtros que valem tambem para os fotografos da cor (27/10/2026).
const FILTROS_DO_GRUPO = ['todos', 'no_grupo', 'fora_do_grupo', 'nao_conseguiu'];

// Area que se reune junto com esta equipe (17/10/2026).
const AGREGADOS = {
  'Invisível': { area: 'Marcador', um: 'marcador', varios: 'Marcadores' },
  'Selva': { area: 'Perseguidos', um: 'perseguido', varios: 'Perseguidos' }
};

// Limite de envios do convite (21/10/2026): o WhatsApp trava o numero de quem
// manda o mesmo convite a muita gente. Vem do servidor ({ usados, limite, libera_em }).
const horaDe = (iso) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
const enviosEsgotados = (envios) => !!envios && envios.usados >= envios.limite;

const Equipe = ({ presencaAberta, equipe, ocupado, onPresenca, onConvite, onNoGrupo, onConviteFoto, onNoGrupoFoto, envios, onAtuacao, onCor, onRemover, onBuscarModulo, onIncluirModulo, onSalvarGrupo, onSalvarGrupoCor, remetente, mostrarEquipe }) => {
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [atuacao, setAtuacao] = useState('');
  const termo = semAcento(useDeferredValue(busca).trim());

  const membros = useMemo(() => [...(equipe.membros || [])].sort(porNome), [equipe.membros]);
  // Fotografos da cor (27/10/2026): entram no grupo de WhatsApp desta cor,
  // mas a chamada deles e na reuniao da Fotografia.
  const fotografos = useMemo(() => [...(equipe.fotografos || [])].sort(porNome), [equipe.fotografos]);

  const contas = useMemo(() => {
    const c = { total: membros.length, presentes: 0, ausentes: 0, sem: 0, pend: 0, agregados: 0, noGrupo: 0, foraGrupo: 0, naoConseguiu: 0 };
    fotografos.forEach((f) => {
      if (FILTROS.no_grupo(f)) c.noGrupo += 1;
      if (FILTROS.fora_do_grupo(f)) c.foraGrupo += 1;
      if (FILTROS.nao_conseguiu(f)) c.naoConseguiu += 1;
    });
    membros.forEach((m) => {
      if (FILTROS.no_grupo(m)) c.noGrupo += 1;
      if (FILTROS.fora_do_grupo(m)) c.foraGrupo += 1;
      if (FILTROS.nao_conseguiu(m)) c.naoConseguiu += 1;
      if (m.presente === true) c.presentes += 1;
      else if (m.presente === false) c.ausentes += 1;
      else c.sem += 1;
      if (m.pendencias?.length) c.pend += 1;
      if (m.area !== equipe.area) c.agregados += 1;
    });
    return c;
  }, [membros, fotografos, equipe.area]);
  const agregado = AGREGADOS[equipe.area];

  const atuacoesNaLista = useMemo(
    () => [...new Set(membros.map((m) => m.atuacao).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [membros]);

  const mostrados = useMemo(() => membros.filter((m) => FILTROS[filtro](m, equipe)
    && (!atuacao || m.atuacao === atuacao)
    && (!termo || semAcento(`${m.nome} ${nomeDaIgreja(m) || ''} ${m.whatsapp || ''}`).includes(termo))),
  [membros, filtro, atuacao, termo, equipe]);

  // Os filtros de chamada, pendencia e atuacao nao valem para o fotografo
  // (somem da lista); os do grupo de WhatsApp e a busca valem.
  const fotografosMostrados = useMemo(() => (
    !FILTROS_DO_GRUPO.includes(filtro) || atuacao ? [] : fotografos.filter((f) => FILTROS[filtro](f, equipe)
      && (!termo || semAcento(`${f.nome} ${nomeDaIgreja(f) || ''} ${f.whatsapp || ''}`).includes(termo)))
  ), [fotografos, filtro, atuacao, termo, equipe]);
  const noGrupoDaCor = useMemo(() => [...membros, ...fotografos], [membros, fotografos]);

  // O proprio lider criou o grupo -- nao precisa de convite.
  const prontosConvite = useMemo(
    () => membros.filter((m) => m.presente === true && !m.eu), [membros]);

  const alternarFiltro = (f) => setFiltro((atual) => (atual === f ? 'todos' : f));
  const filtrando = filtro !== 'todos' || atuacao || termo;
  const textoLocalReuniao = useLocaisReuniao();
  const locais = equipe.porCor
    ? [...new Set(AREAS_TRILHA.filter((a) => membros.some((m) => m.area === a)).map(textoLocalReuniao).filter(Boolean))]
    : [textoLocalReuniao(equipe.area)].filter(Boolean);

  // Grupo por cor: blocos por area, na ordem dos grupos de trilha.
  const blocos = useMemo(() => {
    if (!equipe.porCor) return null;
    const ordem = [...AREAS_TRILHA, ...new Set(mostrados.map((m) => m.area).filter((a) => !AREAS_TRILHA.includes(a)))];
    return ordem.map((area) => ({
      area,
      total: membros.filter((m) => m.area === area).length,
      lista: mostrados.filter((m) => m.area === area)
    })).filter((b) => b.lista.length > 0);
  }, [equipe.porCor, membros, mostrados]);

  const linha = (m) => (
    <Membro key={m.escala_id} m={m} presencaAberta={presencaAberta} grupoLink={equipe.porCor ? m._grupo_link : equipe.grupo_link}
      area={equipe.porCor ? m.area : equipe.area} remetente={remetente}
      etiquetaArea={equipe.porCor ? m.area : null}
      atuacoes={equipe.porCor ? m._atuacoes : (!m.eh_lider && m.area === equipe.area ? equipe.atuacoes : null)}
      responsavel={equipe.porCor ? m._responsavel : responsaveisDe(equipe).some((d) => d.equipante_id === m.equipante_id)}
      podeCor={equipe.porCor ? m._podeCor : (equipe.pode_trocar_cor && !m.eh_lider)}
      ocupadoPresenca={!!ocupado[`p-${m.escala_id}`]}
      ocupadoConvite={!!ocupado[`c-${m.escala_id}`]}
      ocupadoEdicao={!!ocupado[`e-${m.escala_id}`]}
      ocupadoNoGrupo={!!ocupado[`n-${m.escala_id}`]}
      podeRemover={!!equipe.pode_gerenciar && !m.eh_lider && !m.eu && m.area === equipe.area}
      ocupadoRemover={!!ocupado[`r-${m.escala_id}`]}
      bloqueado={enviosEsgotados(envios)} liberaEm={envios?.libera_em || null}
      onPresenca={onPresenca} onConvite={onConvite} onNoGrupo={onNoGrupo} onAtuacao={onAtuacao} onCor={onCor} onRemover={onRemover} />
  );

  return (
    <section className="space-y-4">
      <div className="border-b border-white/10 pb-3 space-y-3">
        <h4 className="text-xl font-bold text-white flex items-center gap-2 flex-wrap">
          {equipe.porCor
            ? <>{equipe.cor && <span className="h-3.5 w-3.5 rounded-full" style={{ background: CORES[equipe.cor] }} />}{equipe.area}</>
            : <>{equipe.area} <Cor cor={equipe.cor} /></>}
        </h4>
        {/* Local da reuniao de leitura de escala (19/10/2026). No grupo por
            cor, os locais das areas que estao nele (sem repetir). */}
        {locais.length > 0 && (
          <p className="text-sm text-sky-200 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 shrink-0" />
            Local da reunião: <strong className="font-semibold">{locais.join(' · ')}</strong>
          </p>
        )}

        {equipe.semCor ? (
          <p className="text-xs text-amber-200/90">
            Estas pessoas ainda <strong>não têm cor</strong>, por isso não entram em nenhum grupo. Faça a chamada aqui e
            escolha a cor de cada uma{equipe.membros?.some((m) => m.eh_lider) ? ' (a cor do líder só a organização troca)' : ''}.
          </p>
        ) : equipe.papel === 'delegado' ? (
          <p className="text-xs text-amber-200/90">
            Você é o <strong>responsável pela reunião</strong> {equipe.porCor ? 'deste grupo' : 'desta equipe'}
            {equipe.lideres?.length ? ` (líder: ${equipe.lideres.join(', ')})` : ''}. {presencaAberta ? 'Faça a chamada e mande o convite do grupo.' : 'Mande o convite do grupo e fale com a equipe pelo WhatsApp.'}
          </p>
        ) : null}

        {equipe.pode_gerenciar && (
          <p className="text-xs text-amber-200/90">
            Como líder da Recepção Igreja, você inclui e tira pessoas das cinco áreas da igreja
            (Recepção Igreja, Cozinha Igreja, Som / Multimídia, Estacionamento e Mesa crachá).
          </p>
        )}

        <div className="grid grid-cols-4 gap-2">
          <Numero valor={contas.total} rotulo={contas.total === 1 ? 'pessoa' : 'pessoas'} cor="text-white"
            ativo={filtro === 'todos'} onClick={() => setFiltro('todos')} />
          <Numero valor={contas.presentes} rotulo="presentes" cor="text-green-400"
            ativo={filtro === 'presentes'} onClick={() => alternarFiltro('presentes')} />
          <Numero valor={contas.ausentes} rotulo="ausentes" cor="text-red-400"
            ativo={filtro === 'ausentes'} onClick={() => alternarFiltro('ausentes')} />
          <Numero valor={contas.sem} rotulo="sem chamada" cor="text-gray-300"
            ativo={filtro === 'sem_chamada'} onClick={() => alternarFiltro('sem_chamada')} />
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, igreja ou telefone"
              inputMode="search" className="h-10 pl-8 bg-black/40 border-white/20 text-white" />
          </div>
          {atuacoesNaLista.length > 1 && (
            <select value={atuacao} onChange={(e) => setAtuacao(e.target.value)} aria-label="Filtrar por atuação"
              className="h-10 rounded-md border border-white/20 bg-black/40 px-2 text-sm text-white">
              <option value="">Todas as atuações</option>
              {atuacoesNaLista.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          )}
        </div>

        {/* Invisivel + Marcadores, Selva + Perseguidos: quantos de cada e o total. */}
        {agregado && contas.agregados > 0 && (
          <div className="flex flex-wrap gap-2 text-xs">
            {/* Total primeiro e ja marcado: o lider faz a chamada de todos
                (Perseguidos/Marcadores juntos) sem precisar descobrir o filtro. */}
            <button type="button" onClick={() => setFiltro('todos')}
              className={cn('rounded-full border px-3 py-1',
                filtro === 'todos' ? 'border-amber-400 bg-amber-400/15 text-amber-100' : 'border-white/20 text-gray-200')}>
              Total: <strong>{contas.total}</strong>
            </button>
            <button type="button" onClick={() => alternarFiltro('da_area')}
              className={cn('rounded-full border px-3 py-1',
                filtro === 'da_area' ? 'border-amber-400 bg-amber-400/15 text-amber-100' : 'border-white/20 text-gray-300')}>
              {equipe.area}: <strong>{contas.total - contas.agregados}</strong>
            </button>
            <button type="button" onClick={() => alternarFiltro('agregados')}
              className={cn('rounded-full border px-3 py-1',
                filtro === 'agregados' ? 'border-sky-400 bg-sky-400/15 text-sky-100' : 'border-sky-500/30 text-sky-300')}>
              {agregado.varios}: <strong>{contas.agregados}</strong>
            </button>
          </div>
        )}

        {/* Quem ja esta no grupo de WhatsApp e quem ainda nao (so com o link salvo). */}
        {(equipe.grupo_link || contas.noGrupo > 0) && (
          <div className="flex flex-wrap gap-2 text-xs">
            <button type="button" onClick={() => alternarFiltro('no_grupo')}
              className={cn('rounded-full border px-3 py-1',
                filtro === 'no_grupo' ? 'border-green-400 bg-green-400/15 text-green-100' : 'border-green-500/30 text-green-300')}>
              No grupo: <strong>{contas.noGrupo}</strong>
            </button>
            <button type="button" onClick={() => alternarFiltro('fora_do_grupo')}
              className={cn('rounded-full border px-3 py-1',
                filtro === 'fora_do_grupo' ? 'border-white/60 bg-white/15 text-white' : 'border-white/20 text-gray-300')}>
              Fora do grupo: <strong>{contas.foraGrupo}</strong>
            </button>
            {contas.naoConseguiu > 0 && (
              <button type="button" onClick={() => alternarFiltro('nao_conseguiu')}
                className={cn('rounded-full border px-3 py-1',
                  filtro === 'nao_conseguiu' ? 'border-amber-400 bg-amber-400/15 text-amber-100' : 'border-amber-500/30 text-amber-300')}>
                Não conseguiu entrar: <strong>{contas.naoConseguiu}</strong>
              </button>
            )}
          </div>
        )}

        {contas.pend > 0 && (
          <div className="flex flex-wrap gap-2">
            {contas.pend > 0 && (
              <button type="button" onClick={() => alternarFiltro('pendencia')}
                className={cn('rounded-full border px-3 py-1 text-xs',
                  filtro === 'pendencia' ? 'border-amber-400 bg-amber-400/15 text-amber-100' : 'border-amber-500/30 text-amber-300')}>
                {contas.pend} com pendência no cadastro
              </button>
            )}
          </div>
        )}

        {filtrando && (
          <p className="text-xs text-gray-400">
            Mostrando {mostrados.length} de {membros.length}.{' '}
            <button type="button" className="text-sky-300 underline"
              onClick={() => { setBusca(''); setFiltro('todos'); setAtuacao(''); }}>
              limpar
            </button>
          </p>
        )}
      </div>

      <ul className="space-y-2">
        {blocos
          ? blocos.map((b) => (
            <li key={b.area} className="space-y-2">
              <p className="pt-2 flex items-center justify-between text-sm text-gray-300 border-b border-white/10 pb-1">
                <span className="font-semibold text-white">{b.area}</span>
                <span className="text-xs text-gray-400">
                  {b.lista.length === b.total ? b.total : `${b.lista.length} de ${b.total}`}
                </span>
              </p>
              <ul className="space-y-2">{b.lista.map(linha)}</ul>
            </li>
          ))
          : mostrados.map(linha)}
        {membros.length === 0 && <li className="text-sm text-gray-500">Ninguém nesta equipe ainda.</li>}
        {membros.length > 0 && mostrados.length === 0 && fotografosMostrados.length === 0 && <li className="text-sm text-gray-500">Ninguém com esse filtro.</li>}
      </ul>

      {/* Fotografos da cor (27/10/2026): so o grupo de WhatsApp desta cor. */}
      {fotografosMostrados.length > 0 && (
        <div className="space-y-2">
          <p className="pt-2 flex items-center justify-between text-sm text-gray-300 border-b border-rose-400/30 pb-1">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-rose-300" /> Fotógrafos{equipe.cor ? ` · ${equipe.cor}` : ''}
            </span>
            <span className="text-xs text-gray-400">
              {fotografosMostrados.length === fotografos.length ? fotografos.length : `${fotografosMostrados.length} de ${fotografos.length}`}
            </span>
          </p>
          <p className="text-xs text-gray-400">
            Os fotógrafos desta cor também entram no grupo de WhatsApp da trilha. A chamada deles é na reunião da Fotografia.
          </p>
          <ul className="space-y-2">
            {fotografosMostrados.map((f) => (
              <Fotografo key={f.escala_id} f={f} grupoLink={equipe.grupo_link} remetente={remetente}
                ocupadoConvite={!!ocupado[`cf-${f.escala_id}`]} ocupadoNoGrupo={!!ocupado[`nf-${f.escala_id}`]}
                bloqueado={enviosEsgotados(envios)} liberaEm={envios?.libera_em || null}
                onConvite={onConviteFoto} onNoGrupo={onNoGrupoFoto} />
            ))}
          </ul>
        </div>
      )}

      {equipe.pode_gerenciar && (
        <IncluirNaEquipe area={equipe.area} ocupado={ocupado}
          onBuscar={onBuscarModulo} onIncluir={onIncluirModulo} />
      )}

      {/* Quem a organizacao trocou de area (21/10/2026): ainda pode estar no grupo desta equipe. */}
      {(equipe.trocados || []).length > 0 && (
        <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-3 space-y-1.5">
          <p className="text-xs font-semibold text-sky-200">
            Trocados de área pela organização: remova do grupo desta equipe
          </p>
          <ul className="space-y-1">
            {equipe.trocados.map((t) => (
              <li key={t.escala_id} className="text-sm text-gray-300">
                <span className="line-through text-gray-400">{t.nome}</span>
                <span className="text-sky-200"> · foi para {t.foi_para}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {equipe.escala_id && (
        <GrupoWhatsApp equipe={equipe} prontos={prontosConvite} membros={noGrupoDaCor} envios={envios} ocupado={!!ocupado[`g-${equipe.escala_id}`]}
          onSalvar={(link) => onSalvarGrupo(equipe, link)} mostrarEquipe={mostrarEquipe} />
      )}

      {/* Grupo por cor: UM grupo de WhatsApp para a cor inteira. */}
      {equipe.porCor && equipe.ondeGuardar.length > 0 && (
        <GrupoWhatsApp equipe={equipe} prontos={prontosConvite} membros={noGrupoDaCor} envios={envios} ocupado={!!ocupado[`g-${equipe.chave}`]}
          onSalvar={(link) => onSalvarGrupoCor(equipe, link)} mostrarEquipe={mostrarEquipe} />
      )}
    </section>
  );
};

const mesmasProps = (a, b) => (
  a.presencaAberta === b.presencaAberta && a.grupoLink === b.grupoLink && a.area === b.area && a.etiquetaArea === b.etiquetaArea && a.remetente === b.remetente && a.podeCor === b.podeCor && a.responsavel === b.responsavel
  && (a.atuacoes === b.atuacoes || JSON.stringify(a.atuacoes) === JSON.stringify(b.atuacoes))
  && a.ocupadoPresenca === b.ocupadoPresenca && a.ocupadoConvite === b.ocupadoConvite
  && a.ocupadoEdicao === b.ocupadoEdicao && a.ocupadoNoGrupo === b.ocupadoNoGrupo
  && a.podeRemover === b.podeRemover && a.ocupadoRemover === b.ocupadoRemover && a.onRemover === b.onRemover
  && a.bloqueado === b.bloqueado && a.liberaEm === b.liberaEm
  && a.onPresenca === b.onPresenca && a.onConvite === b.onConvite && a.onNoGrupo === b.onNoGrupo && a.onAtuacao === b.onAtuacao && a.onCor === b.onCor
  && (a.m === b.m || JSON.stringify(a.m) === JSON.stringify(b.m))
);

const Membro = memo(({ presencaAberta, m, grupoLink, area, etiquetaArea, remetente, atuacoes, podeCor, responsavel, ocupadoPresenca, ocupadoConvite, ocupadoEdicao,
  ocupadoNoGrupo, podeRemover, ocupadoRemover, onRemover, bloqueado, liberaEm, onPresenca, onConvite, onNoGrupo, onAtuacao, onCor }) => {
  const { toast } = useToast();
  const pendente = m.pendencias?.length > 0;
  const zap = linkWhatsApp(m.whatsapp, m.estrangeiro);
  // 19/10/2026 (Patrick): pendencia no cadastro nao trava mais o convite --
  // basta estar presente. So precisa de um WhatsApp que abra a conversa.
  // 21/10/2026: a presenca so e marcada no dia da leitura; depois, convidar a
  // pessoa a mao e decisao do lider (dentro do limite de envios).
  const podeConvidar = grupoLink && !m.eu && !!zap;
  // Pediu ajuda: o WhatsApp nao o deixou entrar pelo link (ex.: removido de um grupo antigo).
  const pedidoGrupo = !!m.grupo_pedido_em && !m.no_grupo_em;
  // Marcador na lista da Invisivel, Perseguido na lista da Selva.
  const etiquetaAgregado = m.area !== area ? (m.area === 'Perseguidos' ? 'Perseguido' : m.area) : null;

  const salvarContato = () => {
    const numero = numeroWhatsApp(m.whatsapp, m.estrangeiro);
    if (!numero) return;
    baixarVcf(gerarVCard([{ nome: m.nome, numero }], `Metanoia ${area}`), `${m.nome}-Metanoia-${area}`);
    toast({
      title: 'Contato baixado',
      description: 'Abra o arquivo baixado para adicionar à sua agenda. Depois adicione a pessoa ao grupo.',
      className: 'bg-green-600 text-white'
    });
  };

  // Sem o nome da area na mensagem (17/10/2026, Patrick): so quem esta
  // mandando -- o lider ou o responsavel pela reuniao.
  const enviarConvite = () => {
    if (bloqueado) return;
    const quem = nomeCurto(remetente);
    const texto = `Olá, ${(m.nome || '').split(' ')[0]}! Aqui é ${quem ? `${quem}, ` : ''}da equipe do Metanoia Radical Serra. `
      + `Entre no nosso grupo pelo link: ${grupoLink}`;
    const link = linkWhatsApp(m.whatsapp, m.estrangeiro, texto);
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
    onConvite(m);
  };

  return (
    <li style={LINHA_LEVE} className={cn('rounded-lg border p-3',
      pendente ? 'border-amber-500/40 bg-amber-500/5'
        : pedidoGrupo ? 'border-amber-400/70 bg-amber-400/10'
        : m.presente === true ? 'border-green-500/30 bg-green-500/5'
          : m.presente === false ? 'border-red-500/30 bg-red-500/5'
            : 'border-white/10 bg-white/5')}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium flex items-center gap-2 flex-wrap">
            {/* Especialidade da Saude (18/10/2026): opcao da lista vira tag;
                o que a pessoa escreveu em "Outro" vai ao lado do nome. */}
            <span>
              {m.nome}
              {m.especialidade_saude === ESPECIALIDADE_OUTRO && <TagEspecialidade especialidade={ESPECIALIDADE_OUTRO} outro={m.especialidade_saude_outro} />}
            </span>
            {m.especialidade_saude && m.especialidade_saude !== ESPECIALIDADE_OUTRO && <TagEspecialidade especialidade={m.especialidade_saude} adicionais={m.especialidades_saude_adicionais} />}
            {m.especialidade_saude === ESPECIALIDADE_OUTRO && (m.especialidades_saude_adicionais || []).map((x) => <TagEspecialidade key={x} especialidade={x} />)}
            {/* Grupo por cor: a area de cada pessoa como etiqueta. */}
            {etiquetaArea && (
              <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full', ETIQUETA_TRILHA[etiquetaArea] || 'bg-white/10 text-gray-200')}>
                {etiquetaArea}
              </span>
            )}
            {m.eu && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-300">você</span>}
            <SeloOutraCidade p={m} />
            {m.veio_de && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-sky-400/50 bg-sky-500/15 text-sky-200"
                title="Trocado de área pela organização: confira se já está no grupo certo.">
                veio de {m.veio_de}
              </span>
            )}
            {m.eh_lider && !m.eu &&<span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">líder</span>}
            {etiquetaAgregado && <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300">{etiquetaAgregado}</span>}
            {responsavel && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/40">
                responsável pela reunião
              </span>
            )}
          </p>
          <p className="text-xs text-gray-400 truncate">{nomeDaIgreja(m) || 'Igreja não informada'}</p>
          <p className="text-sm text-gray-300 flex items-center gap-2 mt-0.5 flex-wrap">
            {/* Tocar no numero baixa o contato da pessoa, pronto para adicionar a agenda (21/10/2026). */}
            {numeroWhatsApp(m.whatsapp, m.estrangeiro) ? (
              <button type="button" onClick={salvarContato} title="Toque para adicionar esta pessoa aos seus contatos"
                className="underline decoration-dotted underline-offset-4 hover:text-white text-left">
                {telefoneVisivel(m)}
              </button>
            ) : telefoneVisivel(m)}
            {zap && (
              <a href={zap} target="_blank" rel="noopener noreferrer" aria-label="Abrir conversa no WhatsApp"
                className="text-green-400 hover:text-green-300">
                <MessageCircle className="w-4 h-4" />
              </a>
            )}
            {!atuacoes && m.atuacao && <span className="text-xs text-gray-500">· {m.atuacao}</span>}
            {!podeCor && !etiquetaArea && m.cor && <Cor cor={m.cor} />}
          </p>

          {(atuacoes || podeCor) && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {atuacoes && (
                <select value={m.atuacao || ''} disabled={ocupadoEdicao}
                  onChange={(e) => onAtuacao(m, e.target.value)} aria-label={`Atuação de ${m.nome}`}
                  className="h-9 rounded-md border border-white/20 bg-black/50 px-2 text-sm text-white">
                  {!atuacoes.includes(m.atuacao) && <option value={m.atuacao || ''}>{m.atuacao || 'Sem atuação'}</option>}
                  {atuacoes.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              )}
              {podeCor && (
                <select value={m.cor || ''} disabled={ocupadoEdicao}
                  onChange={(e) => onCor(m, e.target.value)} aria-label={`Cor de ${m.nome}`}
                  className="h-9 rounded-md border border-white/20 bg-black/50 px-2 text-sm text-white">
                  {/* Grupo de trilha: cor obrigatoria (o servidor tambem recusa). */}
                  {(!AREAS_TRILHA.includes(m.area) || !m.cor) && <option value="">Sem cor</option>}
                  {LISTA_CORES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
              {podeCor && m.cor && <span className="h-3 w-3 rounded-full" style={{ background: CORES[m.cor] }} />}
              {ocupadoEdicao && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
            </div>
          )}
        </div>

        {!presencaAberta ? (
          // Depois do dia da reuniao: so o resultado, sem botoes (o servidor tambem recusa).
          <span className={cn('shrink-0 rounded-md border px-3 py-2 text-sm font-medium text-center',
            m.presente === true ? 'border-green-600/50 text-green-300'
              : m.presente === false ? 'border-red-600/50 text-red-300'
                : 'border-white/15 text-gray-400')}>
            {m.presente === true ? 'Presente' : m.presente === false ? 'Ausente' : 'Sem chamada'}
          </span>
        ) : (
        <div className="grid grid-cols-2 gap-2 shrink-0">
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
        )}
      </div>

      {/* DDD 22/24 (28/10/2026): ja vem presente; o lider decide se fica. */}
      {ehPresencaAutomatica(m) && (
        <p className="mt-2 text-xs text-sky-200 flex items-start gap-1.5">
          <MapPin className="w-4 h-4 shrink-0 text-sky-400" />
          <span>
            Presença marcada automaticamente porque a pessoa mora em outra cidade (WhatsApp DDD 22 ou 24).
            Se ela não vai servir, marque <strong>Ausente</strong>: vale a sua marcação.
          </span>
        </p>
      )}

      {pendente && (
        <p className="mt-2 text-xs text-amber-200 flex items-start gap-1.5">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>
            Cadastro com pendência: {m.pendencias.map((p) => TEXTO_PENDENCIA[p.tipo] || p.tipo).join(', ')}.
            A pessoa precisa corrigir no acompanhamento da inscrição dela (site → Equipante → CPF).
          </span>
        </p>
      )}

      {podeConvidar && (
        <div className="mt-2 flex items-center gap-2">
          <Button size="sm" onClick={enviarConvite} disabled={ocupadoConvite || bloqueado}
            className={cn('h-8', m.convite_enviado_em
              ? 'bg-transparent border border-white/20 text-gray-300 hover:bg-white/10'
              : 'bg-[#25D366] hover:bg-[#20bd5a] text-white')}>
            <Send className="w-3.5 h-3.5 mr-1.5" />
            {bloqueado ? `Limite de envios (libera às ${horaDe(liberaEm)})`
              : m.convite_enviado_em ? 'Reenviar convite' : 'Enviar convite do grupo'}
          </Button>
          {m.convite_enviado_em && (
            <span className="text-xs text-green-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> convite enviado
            </span>
          )}
        </div>
      )}

      {/* Grupo de WhatsApp (21/10/2026): o que a pessoa fez com o link, e a marcacao manual. */}
      {grupoLink && !m.eu && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          {pedidoGrupo && (
            <span className="rounded-full border border-amber-400/60 bg-amber-400/15 px-2 py-0.5 font-medium text-amber-100">
              Não conseguiu entrar: adicione pelo contato
            </span>
          )}
          {m.grupo_aberto_em && !m.no_grupo_em && !pedidoGrupo && (
            <span className="text-sky-300">abriu o link do grupo</span>
          )}
          {m.no_grupo_em && (
            <span className="text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> está no grupo</span>
          )}
          <Button size="sm" variant="outline" disabled={ocupadoNoGrupo} onClick={() => onNoGrupo(m, !m.no_grupo_em)}
            className="h-7 px-2 text-xs border-white/25 bg-transparent text-gray-200 hover:text-white hover:bg-white/10">
            {m.no_grupo_em ? 'Desmarcar' : 'Marcar como já está no grupo'}
          </Button>
        </div>
      )}

      {podeRemover && (
        <div className="mt-2 flex justify-end">
          <Button size="sm" variant="ghost" disabled={ocupadoRemover} onClick={() => onRemover(m)}
            className="h-7 px-2 text-xs text-gray-400 hover:text-red-300 hover:bg-white/10">
            {ocupadoRemover ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1" />}
            Tirar desta área
          </Button>
        </div>
      )}
    </li>
  );
}, mesmasProps);
Membro.displayName = 'Membro';

// Fotografo da cor na lista da trilha (27/10/2026, Patrick): identificado como
// fotografo, so com o grupo de WhatsApp (convite e "ja esta no grupo"). Sem
// chamada, cor ou atuacao: isso e da Fotografia.
const Fotografo = memo(({ f, grupoLink, remetente, ocupadoConvite, ocupadoNoGrupo, bloqueado, liberaEm, onConvite, onNoGrupo }) => {
  const { toast } = useToast();
  const zap = linkWhatsApp(f.whatsapp, f.estrangeiro);
  const podeConvidar = grupoLink && !f.eu && !!zap;
  const pedidoGrupo = !!f.grupo_pedido_em && !f.no_grupo_em;

  const salvarContato = () => {
    const numero = numeroWhatsApp(f.whatsapp, f.estrangeiro);
    if (!numero) return;
    baixarVcf(gerarVCard([{ nome: f.nome, numero }], `Metanoia Fotografia ${f.cor || ''}`.trim()), `${f.nome}-Metanoia-Fotografia`);
    toast({
      title: 'Contato baixado',
      description: 'Abra o arquivo baixado para adicionar à sua agenda. Depois adicione a pessoa ao grupo.',
      className: 'bg-green-600 text-white'
    });
  };

  const enviarConvite = () => {
    if (bloqueado) return;
    const quem = nomeCurto(remetente);
    const texto = `Olá, ${(f.nome || '').split(' ')[0]}! Aqui é ${quem ? `${quem}, ` : ''}da equipe de trilha ${f.cor} do Metanoia Radical Serra. `
      + `Como fotógrafo da cor ${f.cor}, entre no nosso grupo pelo link: ${grupoLink}`;
    const link = linkWhatsApp(f.whatsapp, f.estrangeiro, texto);
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
    onConvite(f);
  };

  return (
    <li style={LINHA_LEVE} className={cn('rounded-lg border p-3',
      pedidoGrupo ? 'border-amber-400/70 bg-amber-400/10' : 'border-rose-400/30 bg-rose-500/5')}>
      <p className="text-white font-medium flex items-center gap-2 flex-wrap">
        <span>{f.nome}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-200 flex items-center gap-1">
          <Camera className="w-3 h-3" /> Fotógrafo
        </span>
        {f.eh_lider && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">líder da Fotografia</span>}
        {f.eu && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-300">você</span>}
      </p>
      <p className="text-xs text-gray-400 truncate">{nomeDaIgreja(f) || 'Igreja não informada'}</p>
      <p className="text-sm text-gray-300 flex items-center gap-2 mt-0.5 flex-wrap">
        {numeroWhatsApp(f.whatsapp, f.estrangeiro) ? (
          <button type="button" onClick={salvarContato} title="Toque para adicionar esta pessoa aos seus contatos"
            className="underline decoration-dotted underline-offset-4 hover:text-white text-left">
            {telefoneVisivel(f)}
          </button>
        ) : telefoneVisivel(f)}
        {zap && (
          <a href={zap} target="_blank" rel="noopener noreferrer" aria-label="Abrir conversa no WhatsApp"
            className="text-green-400 hover:text-green-300">
            <MessageCircle className="w-4 h-4" />
          </a>
        )}
        {f.atuacao && <span className="text-xs text-gray-500">· {f.atuacao}</span>}
      </p>

      {podeConvidar && (
        <div className="mt-2 flex items-center gap-2">
          <Button size="sm" onClick={enviarConvite} disabled={ocupadoConvite || bloqueado}
            className={cn('h-8', f.convite_enviado_em
              ? 'bg-transparent border border-white/20 text-gray-300 hover:bg-white/10'
              : 'bg-[#25D366] hover:bg-[#20bd5a] text-white')}>
            <Send className="w-3.5 h-3.5 mr-1.5" />
            {bloqueado ? `Limite de envios (libera às ${horaDe(liberaEm)})`
              : f.convite_enviado_em ? 'Reenviar convite' : 'Enviar convite do grupo'}
          </Button>
          {f.convite_enviado_em && (
            <span className="text-xs text-green-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> convite enviado
            </span>
          )}
        </div>
      )}

      {grupoLink && !f.eu && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          {pedidoGrupo && (
            <span className="rounded-full border border-amber-400/60 bg-amber-400/15 px-2 py-0.5 font-medium text-amber-100">
              Não conseguiu entrar: adicione pelo contato
            </span>
          )}
          {f.grupo_aberto_em && !f.no_grupo_em && !pedidoGrupo && (
            <span className="text-sky-300">abriu o link do grupo</span>
          )}
          {f.no_grupo_em && (
            <span className="text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> está no grupo</span>
          )}
          <Button size="sm" variant="outline" disabled={ocupadoNoGrupo} onClick={() => onNoGrupo(f, !f.no_grupo_em)}
            className="h-7 px-2 text-xs border-white/25 bg-transparent text-gray-200 hover:text-white hover:bg-white/10">
            {f.no_grupo_em ? 'Desmarcar' : 'Marcar como já está no grupo'}
          </Button>
        </div>
      )}
    </li>
  );
});
Fotografo.displayName = 'Fotografo';

// "Delegar responsável pela reuniao da escala": quem faz a chamada e o grupo
// quando o lider nao vai estar. So gente da propria equipe.
const DelegarDialog = ({ equipe, onClose, onEscolher, ocupado }) => {
  const [busca, setBusca] = useState('');
  // O que o lider escolhe e o responsavel de DENTRO da equipe; os de outra
  // area, postos pela organizacao, nao mudam por aqui.
  const doLider = responsaveisDe(equipe).find((d) => !d.de_fora) || null;
  const termo = semAcento(busca.trim());
  const candidatos = useMemo(() => (equipe.membros || [])
    .filter((m) => !m.eu && m.area === equipe.area)
    .filter((m) => !termo || semAcento(m.nome).includes(termo))
    .sort(porNome), [equipe, termo]);

  useEffect(() => {
    const aoTeclar = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-md max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-white/10 bg-neutral-950"
        onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-white/10 flex items-start gap-3">
          <UserCog className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h4 className="text-white font-semibold leading-snug">Delegar responsável pela reunião da escala</h4>
            <p className="text-xs text-gray-400 mt-0.5">
              {tituloEquipe(equipe)} · a pessoa escolhida faz a chamada e o grupo do WhatsApp. Você continua com acesso.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-gray-500 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {doLider && (
          <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
            <p className="flex-1 text-sm text-gray-200">
              Hoje: <strong className="text-white">{doLider.nome}</strong>
            </p>
            <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => onEscolher(null)}
              className="text-red-300 hover:text-red-200 hover:bg-white/10">
              Tirar
            </Button>
          </div>
        )}

        <div className="p-3 border-b border-white/10">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
            <Input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar na equipe"
              className="h-10 pl-8 bg-black/40 border-white/20 text-white" />
          </div>
        </div>

        <ul className="flex-1 overflow-y-auto p-2 space-y-1">
          {candidatos.map((m) => {
            const atual = doLider?.equipante_id === m.equipante_id;
            return (
              <li key={m.escala_id}>
                <button type="button" disabled={ocupado || atual} onClick={() => onEscolher(m)}
                  className={cn('w-full text-left rounded-lg px-3 py-2.5 flex items-center gap-2',
                    atual ? 'bg-amber-500/15 text-amber-100' : 'hover:bg-white/10 text-gray-100')}>
                  <span className="flex-1 min-w-0">
                    <span className="block truncate">{m.nome}</span>
                    <span className="block text-xs text-gray-500 truncate">{m.atuacao}{m.eh_lider ? ' · líder' : ''}</span>
                  </span>
                  {atual ? <Check className="w-4 h-4" /> : ocupado ? null : <Plus className="w-4 h-4 text-gray-500" />}
                </button>
              </li>
            );
          })}
          {candidatos.length === 0 && <li className="text-sm text-gray-500 text-center py-6">Ninguém encontrado.</li>}
        </ul>
      </div>
    </div>
  );
};

// Lider da Recepcao Igreja: incluir alguem nesta area da igreja (23/10/2026).
// Busca entre os equipantes aprovados que ainda nao estao nela.
const IncluirNaEquipe = ({ area, ocupado, onBuscar, onIncluir }) => {
  const [procura, setProcura] = useState('');
  const [achados, setAchados] = useState([]);
  const [procurando, setProcurando] = useState(false);

  useEffect(() => {
    const t = procura.trim();
    if (t.length < 3) { setAchados([]); return undefined; }
    let vivo = true;
    const timer = setTimeout(async () => {
      setProcurando(true);
      const r = await onBuscar(area, t);
      if (!vivo) return;
      setProcurando(false);
      setAchados(r.ok ? (r.pessoas || []) : []);
    }, 400);
    return () => { vivo = false; clearTimeout(timer); };
  }, [procura, area, onBuscar]);

  return (
    <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 space-y-3">
      <p className="text-white font-medium flex items-center gap-2">
        <Plus className="w-4 h-4 text-blue-300" /> Incluir alguém em {area}
      </p>
      <Input value={procura} onChange={(e) => setProcura(e.target.value)} placeholder="Digite pelo menos 3 letras do nome"
        className="h-10 bg-black/40 border-white/20 text-white" />
      {procurando && <p className="text-xs text-gray-400 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Procurando...</p>}
      {!procurando && procura.trim().length >= 3 && achados.length === 0 && (
        <p className="text-xs text-gray-400">Ninguém encontrado (só aparecem inscrições aprovadas que ainda não estão nesta área).</p>
      )}
      <ul className="space-y-1">
        {achados.map((p) => (
          <li key={p.equipante_id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/5">
            <span className="flex-1 min-w-0">
              <span className="block text-sm text-gray-100 truncate">{p.nome}</span>
              <span className="block text-xs text-gray-500 truncate">
                {nomeDaIgreja(p) || ''}{p.areas ? ` · já em: ${p.areas}` : ' · ainda sem área'}
              </span>
            </span>
            <Button size="sm" disabled={!!ocupado[`i-${p.equipante_id}`]}
              onClick={async () => {
                const r = await onIncluir(area, p);
                if (r?.ok) setAchados((l) => l.filter((x) => x.equipante_id !== p.equipante_id));
              }}
              className="h-8 bg-blue-600 hover:bg-blue-700 text-white shrink-0">
              Incluir
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
};

// Area extra (caminhao, cozinha, limpeza): os aprovados pela organizacao e
// quem os lideres puxaram. Os lideres so tiram quem algum lider incluiu
// (a area pode ter varios lideres desde 23/10/2026).
const EquipeExtra = ({ extra, equipanteId, dono, onMudou }) => {
  const { toast } = useToast();
  const info = areaExtraPorChave(extra.area);
  const [busca, setBusca] = useState('');
  const [procura, setProcura] = useState('');
  const [achados, setAchados] = useState([]);
  const [procurando, setProcurando] = useState(false);
  const [ocupado, setOcupado] = useState({});
  const termo = semAcento(useDeferredValue(busca).trim());

  const membros = useMemo(() => [...(extra.membros || [])].sort(porNome), [extra.membros]);
  const mostrados = useMemo(() => membros.filter((m) => !termo
    || semAcento(`${m.nome} ${nomeDaIgreja(m) || ''} ${m.whatsapp || ''}`).includes(termo)), [membros, termo]);

  // Busca de quem puxar: espera a pessoa parar de digitar.
  useEffect(() => {
    const t = procura.trim();
    if (t.length < 3) { setAchados([]); return undefined; }
    let vivo = true;
    const timer = setTimeout(async () => {
      setProcurando(true);
      const r = await buscarParaAreaExtra(equipanteId, dono, extra.area, t);
      if (!vivo) return;
      setProcurando(false);
      setAchados(r.ok ? (r.pessoas || []) : []);
    }, 400);
    return () => { vivo = false; clearTimeout(timer); };
  }, [procura, equipanteId, dono, extra.area]);

  const agir = async (id, acao, sucesso) => {
    setOcupado((o) => ({ ...o, [id]: true }));
    const r = await acao();
    setOcupado((o) => { const c = { ...o }; delete c[id]; return c; });
    if (!r.ok) {
      toast({ title: 'Não deu certo', description: r.erro, variant: 'destructive' });
      return;
    }
    toast({ title: sucesso, className: 'bg-green-600 text-white' });
    onMudou();
  };

  return (
    <section className="space-y-4">
      <div className="border-b border-white/10 pb-3 space-y-3">
        <h4 className="text-xl font-bold text-white flex items-center gap-2">
          <Truck className="w-5 h-5 text-blue-300" /> {info?.rotulo || extra.area}
        </h4>
        {info?.detalhe && <p className="text-xs text-gray-400">{info.detalhe}</p>}
        {(extra.lideres || []).length > 1 && (
          <p className="text-xs text-amber-200/90">Líderes: {extra.lideres.join(', ')}</p>
        )}
        <p className="text-sm text-gray-300">
          <strong className="text-white">{membros.length}</strong> {membros.length === 1 ? 'pessoa' : 'pessoas'} na lista
          (aprovadas pela organização ou incluídas pelos líderes).
        </p>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar na lista"
            inputMode="search" className="h-10 pl-8 bg-black/40 border-white/20 text-white" />
        </div>
      </div>

      <ul className="space-y-2">
        {mostrados.map((m) => {
          const zap = linkWhatsApp(m.whatsapp, m.estrangeiro);
          return (
            <li key={m.equipante_id} style={LINHA_LEVE} className="rounded-lg border border-white/10 bg-white/5 p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium flex items-center gap-2 flex-wrap">
                  {m.nome}
                  {m.eu && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-300">você</span>}
                  {m.incluido_pelo_lider && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300">
                      incluído por {m.incluido_por ? nomeCurto(m.incluido_por) : 'líder'}
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-400 truncate">{nomeDaIgreja(m) || 'Igreja não informada'}</p>
                <p className="text-sm text-gray-300 flex items-center gap-2 mt-0.5">
                  {telefoneVisivel(m)}
                  {zap && (
                    <a href={zap} target="_blank" rel="noopener noreferrer" aria-label="Abrir conversa no WhatsApp"
                      className="text-green-400 hover:text-green-300">
                      <MessageCircle className="w-4 h-4" />
                    </a>
                  )}
                </p>
              </div>
              {m.incluido_pelo_lider && !m.eu && (
                <Button size="sm" variant="ghost" disabled={!!ocupado[`r-${m.equipante_id}`]}
                  onClick={() => agir(`r-${m.equipante_id}`,
                    () => removerDaAreaExtra(equipanteId, dono, extra.area, m.equipante_id), 'Retirado da lista')}
                  aria-label={`Tirar ${m.nome} da lista`}
                  className="text-gray-400 hover:text-red-300 hover:bg-white/10 shrink-0">
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </li>
          );
        })}
        {membros.length === 0 && <li className="text-sm text-gray-500">Ninguém aprovado ainda.</li>}
        {membros.length > 0 && mostrados.length === 0 && <li className="text-sm text-gray-500">Ninguém com essa busca.</li>}
      </ul>

      <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 space-y-3">
        <p className="text-white font-medium flex items-center gap-2">
          <Plus className="w-4 h-4 text-blue-300" /> Puxar alguém para a lista
        </p>
        <Input value={procura} onChange={(e) => setProcura(e.target.value)} placeholder="Digite pelo menos 3 letras do nome"
          className="h-10 bg-black/40 border-white/20 text-white" />
        {procurando && <p className="text-xs text-gray-400 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Procurando...</p>}
        {!procurando && procura.trim().length >= 3 && achados.length === 0 && (
          <p className="text-xs text-gray-400">Ninguém encontrado (ou já está na lista).</p>
        )}
        <ul className="space-y-1">
          {achados.map((p) => (
            <li key={p.equipante_id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/5">
              <span className="flex-1 min-w-0">
                <span className="block text-sm text-gray-100 truncate">{p.nome}</span>
                <span className="block text-xs text-gray-500 truncate">{nomeDaIgreja(p) || ''}</span>
              </span>
              <Button size="sm" disabled={!!ocupado[`i-${p.equipante_id}`]}
                onClick={async () => {
                  await agir(`i-${p.equipante_id}`,
                    () => incluirNaAreaExtra(equipanteId, dono, extra.area, p.equipante_id), `${p.nome} incluído`);
                  setAchados((l) => l.filter((x) => x.equipante_id !== p.equipante_id));
                }}
                className="h-8 bg-blue-600 hover:bg-blue-700 text-white shrink-0">
                Incluir
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

const GrupoWhatsApp = ({ equipe, prontos, membros = [], envios, ocupado, onSalvar, mostrarEquipe }) => {
  const { toast } = useToast();
  const precisamAdicionar = membros.filter((m) => m.grupo_pedido_em && !m.no_grupo_em && !m.eu);

  const [editando, setEditando] = useState(!equipe.grupo_link);
  const [link, setLink] = useState(equipe.grupo_link || '');

  useEffect(() => {
    setEditando(!equipe.grupo_link);
    setLink(equipe.grupo_link || '');
  }, [equipe.grupo_link]);

  const convidaveis = membros.filter((m) => !m.eu && numeroWhatsApp(m.whatsapp, m.estrangeiro));
  const enviados = convidaveis.filter((m) => m.convite_enviado_em).length;

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
        <MessageCircle className="w-4 h-4 text-[#25D366]" />
        {equipe.porCor ? `Grupo de WhatsApp do ${equipe.area}` : 'Grupo de WhatsApp da equipe'}
      </p>
      {equipe.porCor && (
        <p className="text-xs text-gray-300">
          Um grupo só para a cor inteira: Guias, Invisíveis, Marcadores, Pastores Invisíveis, Espírito Santo, Inimigo
          e os fotógrafos da cor.
        </p>
      )}
      {/* Quem conduz varias equipes: cada grupo diz de qual equipe e, para nao misturar. */}
      {mostrarEquipe && !equipe.porCor && (
        <p className="rounded-md border border-[#25D366]/40 bg-black/30 px-3 py-1.5 text-sm text-white flex items-center gap-2 flex-wrap">
          Este grupo é da equipe <strong>{equipe.area}</strong>
          {equipe.cor && <Cor cor={equipe.cor} />}
        </p>
      )}

      {editando ? (
        <>
          <ol className="text-xs text-gray-300 list-decimal pl-4 space-y-0.5">
            <li>Crie o grupo no seu WhatsApp.</li>
            <li>No grupo, toque em “Convidar via link” e copie o link.</li>
            <li>Cole aqui. Quem estiver <strong>presente</strong> já vê o botão de entrar; o convite manual vale para qualquer pessoa da equipe.</li>
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
            Quem está <strong>presente</strong> já vê o botão <strong>Entrar no grupo</strong> na própria tela (depois da
            escala oficial, todos da equipe veem). Peça para entrarem por ali: é o jeito mais seguro.
          </p>
          <p className="text-xs text-gray-400">
            {convidaveis.length} podem receber o convite manual · {enviados} já enviados.
          </p>
          {/* Aviso fixo (21/10/2026): enviar o link a muita gente trava o WhatsApp de quem envia. */}
          <div className={cn('rounded-md border px-3 py-2 text-xs flex items-start gap-2',
            enviosEsgotados(envios) ? 'border-red-500/50 bg-red-500/10 text-red-200' : 'border-amber-500/30 bg-amber-500/5 text-amber-200')}>
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              Mandar o link para muitas pessoas seguidas pode <strong>travar o seu WhatsApp por 24 horas</strong>.
              Por isso o site limita a {envios?.limite ?? 40} envios a cada 24 horas
              {envios ? ` (você usou ${envios.usados})` : ''}.
              {enviosEsgotados(envios) ? ` Novo envio liberado às ${horaDe(envios.libera_em)}.` : ''}
            </span>
          </div>
          {precisamAdicionar.length > 0 && (
            <p className="text-xs text-amber-100 rounded-md border border-amber-400/50 bg-amber-400/10 px-3 py-2">
              <strong>{precisamAdicionar.length}</strong> {precisamAdicionar.length === 1 ? 'pessoa não conseguiu' : 'pessoas não conseguiram'} entrar
              pelo link (o WhatsApp avisa “um admin removeu você”). Toque no número de {precisamAdicionar.length === 1 ? 'quem apareceu em âmbar' : 'cada uma'} para salvar o contato e
              adicione {precisamAdicionar.length === 1 ? 'a pessoa' : 'elas'} direto no grupo.
            </p>
          )}
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
