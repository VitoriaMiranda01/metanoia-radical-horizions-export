import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import {
  Camera, X, Loader2, Upload, Trash2, Pencil, Search, ImageOff, Download, Image as ImageIcon, AlertTriangle, UserPlus, Check
} from 'lucide-react';
import {
  listarFotosTrilha, buscarFichasParaFoto, linksDasFotos, baixarFoto, salvarFoto, salvarNomeArte, removerFoto,
  dadosDaEdicaoParaArte
} from '@/services/fotosTrilhaService';
import { CORES_ARTE, FUNDOS_ARTE, desenharArteGrupo, desenharArteInfiltrados, desenharSlideGrupo } from '@/utils/arteTrilha';

/**
 * FOTOS DA TRILHA (24/10/2026, Patrick): banco de fotos da equipe de trilha e
 * a arte de cada grupo (que a Victória fazia à mão no Canva).
 *
 *  - "Escalados na arte": quem está em Guia, Inimigo, Infiltrados e Espírito
 *    Santo nesta escala, por cor, com ou sem foto.
 *  - "Banco de fotos": todos que têm foto, escalados ou não (a foto vale para
 *    as próximas edições). "Adicionar foto" busca qualquer ficha.
 *  - "Gerar artes": uma imagem por grupo. Quem está sem foto (ou sem cor) é
 *    avisado ANTES; se gerar assim mesmo, essa pessoa fica fora da arte.
 *
 * Fotos privadas (só organizadores). Ver fotosTrilhaService.js.
 */

const sem = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const comparar = (a, b) => String(a || '').localeCompare(String(b || ''), 'pt-BR', { sensitivity: 'base' });

// Papéis que entram na arte, na ordem da arte.
const PAPEIS = [
  { area: 'guia', chave: 'guias', titulo: 'Guias' },
  { area: 'inimigo', chave: 'inimigo', titulo: 'Inimigo' },
  { area: 'infiltrados', chave: 'infiltrados', titulo: 'Infiltrados' },
  { area: 'espirito santo', chave: 'espirito', titulo: 'Espírito Santo' }
];
const PAPEL_DA_AREA = Object.fromEntries(PAPEIS.map((p) => [p.area, p]));

const COR_CHIP = {
  ROXO: 'bg-purple-600/30 text-purple-200 border-purple-500/50',
  VERMELHO: 'bg-red-600/30 text-red-200 border-red-500/50',
  AMARELO: 'bg-yellow-500/25 text-yellow-200 border-yellow-500/50',
  VERDE: 'bg-green-600/30 text-green-200 border-green-500/50',
  AZUL: 'bg-sky-600/30 text-sky-200 border-sky-500/50'
};

// Botão "Gerar grupo X" na cor do grupo.
const COR_BOTAO = {
  ROXO: 'bg-purple-600/25 text-purple-200 border-purple-500/60 hover:bg-purple-600/45',
  VERMELHO: 'bg-red-600/25 text-red-200 border-red-500/60 hover:bg-red-600/45',
  AMARELO: 'bg-yellow-500/20 text-yellow-200 border-yellow-500/60 hover:bg-yellow-500/40',
  VERDE: 'bg-green-600/25 text-green-200 border-green-500/60 hover:bg-green-600/45',
  AZUL: 'bg-sky-600/25 text-sky-200 border-sky-500/60 hover:bg-sky-600/45'
};

const MINUSCULAS =new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
const tituloPt = (p) => p.toLocaleLowerCase('pt-BR').replace(/(^|[\s-])(\S)/g, (m, a, b) => a + b.toLocaleUpperCase('pt-BR'));
// Sem nome na arte: primeiro + último nome ("JOÃO DA SILVA BRANCO" -> "João Branco").
export const nomeCurto = (nome) => {
  const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '';
  const ult = [...partes].reverse().find((p, i) => i < partes.length - 1 && !MINUSCULAS.has(p.toLowerCase()));
  return [partes[0], ult].filter(Boolean).map(tituloPt).join(' ');
};

const lerComoDataUrl = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

// ------------------------------------------------------------------ recorte
// Quadro 4:5 (como os cartões da arte). Arrastar move, a barra aproxima.
// Sai um JPEG 600x750.
const QW = 240;
const QH = 300;

const RecorteFoto = ({ arquivo, pessoa, nomeInicial, onCancelar, onSalvo }) => {
  const { toast } = useToast();
  const [img, setImg] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [nomeArte, setNomeArte] = useState(nomeInicial || '');
  const [salvando, setSalvando] = useState(false);
  const arrasto = useRef(null);

  // Lê como data: -- a CSP do site (public/.htaccess) não libera blob: em img-src.
  useEffect(() => {
    let vivo = true;
    lerComoDataUrl(arquivo)
      .then((url) => new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = url;
      }))
      .then((i) => { if (vivo) setImg(i); })
      .catch(() => {
        if (!vivo) return;
        toast({
          title: 'Não consegui abrir essa imagem.',
          description: 'Use JPG, PNG ou WEBP. Foto do iPhone (HEIC): exporte ou mande pelo WhatsApp e salve de novo.',
          variant: 'destructive'
        });
        onCancelar();
      });
    return () => { vivo = false; };
  }, [arquivo]); // eslint-disable-line react-hooks/exhaustive-deps

  const base = img ? Math.max(QW / img.width, QH / img.height) : 1;
  const dw = img ? img.width * base * zoom : QW;
  const dh = img ? img.height * base * zoom : QH;
  const limitar = useCallback((p) => ({
    x: Math.min(0, Math.max(QW - dw, p.x)),
    y: Math.min(0, Math.max(QH - dh, p.y))
  }), [dw, dh]);

  // centraliza ao abrir; ao aproximar, mantém o centro
  useEffect(() => { if (img) setPos({ x: (QW - img.width * base) / 2, y: (QH - img.height * base) / 2 }); }, [img]); // eslint-disable-line react-hooks/exhaustive-deps
  const mudarZoom = (z) => {
    const cx = (QW / 2 - pos.x) / dw;
    const cy = (QH / 2 - pos.y) / dh;
    const nw = img.width * base * z;
    const nh = img.height * base * z;
    setZoom(z);
    setPos({
      x: Math.min(0, Math.max(QW - nw, QW / 2 - cx * nw)),
      y: Math.min(0, Math.max(QH - nh, QH / 2 - cy * nh))
    });
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      const k = 600 / QW;
      const c = document.createElement('canvas');
      c.width = 600;
      c.height = 750;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 600, 750);
      ctx.drawImage(img, pos.x * k, pos.y * k, dw * k, dh * k);
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.88));
      await salvarFoto(pessoa.id, blob, nomeArte.trim() || null);
      toast({ title: 'Foto salva.', description: pessoa.nome });
      onSalvo();
    } catch (e) {
      toast({ title: 'Não foi possível salvar a foto.', description: e.message, variant: 'destructive' });
      setSalvando(false);
    }
  };

  return (
    <div role="dialog" data-state="open" className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-3">
      <div className="bg-zinc-900 border border-white/10 rounded-lg w-full max-w-md p-5 space-y-4">
        <div className="flex justify-between items-start gap-3">
          <div>
            <h4 className="text-lg font-bold text-white">Ajustar foto</h4>
            <p className="text-sm text-gray-400">{pessoa.nome}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onCancelar} className="text-gray-400 hover:text-white"><X className="h-5 w-5" /></Button>
        </div>
        <div className="flex justify-center">
          <div
            className="relative overflow-hidden rounded border-4 border-white bg-zinc-800 cursor-grab active:cursor-grabbing touch-none select-none"
            style={{ width: QW, height: QH }}
            onPointerDown={(e) => { arrasto.current = { x: e.clientX, y: e.clientY, p: pos }; e.currentTarget.setPointerCapture(e.pointerId); }}
            onPointerMove={(e) => {
              if (!arrasto.current) return;
              const a = arrasto.current;
              setPos(limitar({ x: a.p.x + e.clientX - a.x, y: a.p.y + e.clientY - a.y }));
            }}
            onPointerUp={() => { arrasto.current = null; }}
            onWheel={(e) => img && mudarZoom(Math.min(4, Math.max(1, zoom - e.deltaY * 0.0015)))}
          >
            {img
              ? <img src={img.src} alt="" draggable={false} className="absolute max-w-none pointer-events-none"
                  style={{ left: pos.x, top: pos.y, width: dw, height: dh }} />
              : <Loader2 className="absolute inset-0 m-auto h-6 w-6 animate-spin text-gray-400" />}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 w-16">Aproximar</span>
          <input type="range" min={1} max={4} step={0.01} value={zoom} disabled={!img}
            onChange={(e) => mudarZoom(Number(e.target.value))} className="flex-1 accent-emerald-500" />
        </div>
        <p className="text-xs text-gray-500">Arraste a foto para enquadrar o rosto. É assim que ela sai no cartão da arte.</p>
        <div className="space-y-1">
          <label className="text-xs text-gray-400">Nome na arte</label>
          <Input value={nomeArte} onChange={(e) => setNomeArte(e.target.value)} maxLength={40}
            placeholder={nomeCurto(pessoa.nome)} className="bg-black/40 border-white/15 text-white" />
          <p className="text-[11px] text-gray-500">Ex.: “Pr. João Branco”. Vazio = {nomeCurto(pessoa.nome)}.</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancelar} className="border-white/20 bg-transparent text-gray-300 hover:bg-white/10">Cancelar</Button>
          <Button onClick={salvar} disabled={!img || salvando} className="bg-emerald-600 hover:bg-emerald-500 text-white">
            {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />} Salvar foto
          </Button>
        </div>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------ cartão
const CartaoPessoa = ({ pessoa, foto, link, papel, onEnviar, onNome, onRemover }) => {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(foto?.nome_arte || '');
  useEffect(() => { setNome(foto?.nome_arte || ''); }, [foto?.nome_arte]);
  const nomeNaArte = foto?.nome_arte || nomeCurto(pessoa.nome);
  return (
    <div className={`w-40 shrink-0 rounded-lg border ${foto ? 'border-white/10 bg-white/[0.04]' : 'border-amber-500/40 bg-amber-500/[0.06]'} p-2 flex flex-col gap-1.5`}>
      <div className="relative w-full aspect-[4/5] rounded bg-zinc-800 overflow-hidden flex items-center justify-center">
        {foto && link
          ? <img src={link} alt={pessoa.nome} className="w-full h-full object-cover" />
          : foto ? <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
            : <div className="text-center text-amber-300/80 text-xs px-2"><ImageOff className="h-6 w-6 mx-auto mb-1" />Sem foto</div>}
        {papel && <span className="absolute top-1 left-1 text-[10px] px-1.5 py-0.5 rounded bg-black/70 text-gray-200">{papel}</span>}
      </div>
      {editando ? (
        <div className="flex gap-1">
          <Input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={40} autoFocus
            placeholder={nomeCurto(pessoa.nome)}
            onKeyDown={(e) => { if (e.key === 'Enter') { onNome(nome); setEditando(false); } if (e.key === 'Escape') { e.stopPropagation(); setEditando(false); } }}
            className="h-7 px-1.5 text-xs bg-black/40 border-white/15 text-white" />
          <Button size="sm" className="h-7 px-1.5 bg-emerald-600 hover:bg-emerald-500" onClick={() => { onNome(nome); setEditando(false); }}><Check className="h-3.5 w-3.5" /></Button>
        </div>
      ) : (
        <p className="text-sm font-semibold text-white leading-tight truncate" title="Nome na arte">{nomeNaArte}</p>
      )}
      {/* sempre a altura de 2 linhas: nome curto não deixa o cartão mais baixo */}
      <p className="text-[11px] text-gray-500 leading-tight line-clamp-2 min-h-[2.5em]" title={pessoa.nome}>{pessoa.nome}</p>
      <div className="flex gap-1 mt-auto">
        <Button size="sm" variant="outline" onClick={onEnviar}
          className="h-7 flex-1 px-1 text-xs border-white/15 bg-transparent text-gray-200 hover:bg-white/10">
          <Upload className="mr-1 h-3.5 w-3.5" />{foto ? 'Trocar' : 'Enviar'}
        </Button>
        {foto && (
          <>
            <Button size="sm" variant="outline" onClick={() => setEditando(true)} title="Nome na arte"
              className="h-7 px-1.5 border-white/15 bg-transparent text-gray-300 hover:bg-white/10"><Pencil className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="outline" onClick={onRemover} title="Remover foto"
              className="h-7 px-1.5 border-white/15 bg-transparent text-red-300 hover:bg-red-500/20"><Trash2 className="h-3.5 w-3.5" /></Button>
          </>
        )}
      </div>
    </div>
  );
};

// ------------------------------------------------------------------ janela
const FotosTrilhaDialog = ({ allocations = [], atuacoesPorArea = {}, onClose }) => {
  const { toast } = useToast();
  const [aba, setAba] = useState('escalados');
  const [filtro, setFiltro] = useState('todos'); // todos | sem
  const [busca, setBusca] = useState('');
  const [fotos, setFotos] = useState([]);
  const [links, setLinks] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [recorte, setRecorte] = useState(null); // { arquivo, pessoa, nomeInicial }
  const [aviso, setAviso] = useState(null); // { semFoto, semCor, alvo }
  const [gerando, setGerando] = useState(null); // alvo sendo gerado ('TODOS' ou a cor)
  const [artes, setArtes] = useState(null); // [{ cor, url, blob }]
  // Fundo da arte (25/10/2026, Patrick: o modelo branco da arte antiga do
  // roxo). Gerar um grupo só: botão no cabeçalho de cada cor.
  const [fundo, setFundo] = useState(() => { try { return localStorage.getItem('fotos_trilha_fundo') || 'escuro'; } catch { return 'escuro'; } });
  useEffect(() => { try { localStorage.setItem('fotos_trilha_fundo', fundo); } catch { /* sem armazenamento */ } }, [fundo]);
  const [adicionar, setAdicionar] = useState(false);
  const [buscaFicha, setBuscaFicha] = useState('');
  const [fichas, setFichas] = useState([]);
  const [buscandoFicha, setBuscandoFicha] = useState(false);
  const [removendo, setRemovendo] = useState(null);
  const arquivoRef = useRef(null);
  const pessoaDoArquivo = useRef(null);

  const recarregar = useCallback(async () => {
    try {
      const lista = await listarFotosTrilha();
      setFotos(lista);
      setLinks(await linksDasFotos(lista.map((f) => f.caminho)));
    } catch (e) {
      toast({ title: 'Não foi possível carregar as fotos.', description: e.message, variant: 'destructive' });
    } finally {
      setCarregando(false);
    }
  }, [toast]);
  useEffect(() => { recarregar(); }, [recarregar]);

  useEffect(() => {
    const aoTeclar = (e) => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')) return;
      onClose();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onClose]);

  const fotoPorId = useMemo(() => Object.fromEntries(fotos.map((f) => [f.equipante_id, f])), [fotos]);

  // Escalados nos 4 papéis, por cor; o líder da Guia primeiro.
  const escalados = useMemo(() => {
    const ehLider = (a) => {
      const lista = atuacoesPorArea[a.allocatedArea] || [];
      const base = a.atuacao || lista.find((x) => x.ehPadrao)?.atuacao || '';
      return !!lista.find((x) => x.atuacao === base)?.ehLider;
    };
    return allocations
      .filter((a) => PAPEL_DA_AREA[sem(a.allocatedArea)])
      .map((a) => {
        const cor = sem(a.cor).toUpperCase();
        return {
          id: a.id,
          nome: String(a.nome || '').replace(/\s+/g, ' ').trim(),
          papel: PAPEL_DA_AREA[sem(a.allocatedArea)],
          cor: CORES_ARTE.includes(cor) ? cor : '',
          lider: ehLider(a)
        };
      })
      .sort((x, y) => (Number(y.lider) - Number(x.lider)) || comparar(x.nome, y.nome));
  }, [allocations, atuacoesPorArea]);

  const passaFiltro = (p) => {
    if (filtro === 'sem' && fotoPorId[p.id]) return false;
    if (filtro === 'com' && !fotoPorId[p.id]) return false;
    const b = sem(busca);
    if (!b) return true;
    return sem(p.nome).includes(b) || sem(fotoPorId[p.id]?.nome_arte).includes(b);
  };

  const comFoto = escalados.filter((p) => fotoPorId[p.id]).length;

  // ---- ações
  const escolherArquivo = (pessoa) => {
    pessoaDoArquivo.current = pessoa;
    if (arquivoRef.current) { arquivoRef.current.value = ''; arquivoRef.current.click(); }
  };
  const aoEscolherArquivo = (e) => {
    const arquivo = e.target.files?.[0];
    const pessoa = pessoaDoArquivo.current;
    if (!arquivo || !pessoa) return;
    if (!/^image\//.test(arquivo.type)) {
      toast({ title: 'Escolha uma imagem (JPG, PNG...).', variant: 'destructive' });
      return;
    }
    setRecorte({ arquivo, pessoa, nomeInicial: fotoPorId[pessoa.id]?.nome_arte || '' });
  };
  const trocarNome = async (pessoa, nome) => {
    try {
      await salvarNomeArte(pessoa.id, nome.trim());
      setFotos((fs) => fs.map((f) => (f.equipante_id === pessoa.id ? { ...f, nome_arte: nome.trim() || null } : f)));
    } catch (e) {
      toast({ title: 'Não foi possível salvar o nome.', description: e.message, variant: 'destructive' });
    }
  };
  const confirmarRemover = async () => {
    const pessoa = removendo;
    setRemovendo(null);
    try {
      await removerFoto(pessoa.id);
      setFotos((fs) => fs.filter((f) => f.equipante_id !== pessoa.id));
      toast({ title: 'Foto removida.', description: pessoa.nome });
    } catch (e) {
      toast({ title: 'Não foi possível remover.', description: e.message, variant: 'destructive' });
    }
  };

  useEffect(() => {
    if (!adicionar) return undefined;
    const t = buscaFicha.trim();
    if (t.length < 3) { setFichas([]); return undefined; }
    const id = setTimeout(async () => {
      setBuscandoFicha(true);
      try { setFichas(await buscarFichasParaFoto(t)); } catch (e) { toast({ title: 'Erro na busca.', description: e.message, variant: 'destructive' }); }
      setBuscandoFicha(false);
    }, 350);
    return () => clearTimeout(id);
  }, [buscaFicha, adicionar, toast]);

  // ---- arte
  // alvo: 'TODOS' ou a cor de um grupo só
  // 'INFILTRADOS' = imagem única só com a área Infiltrados (todas as cores juntas)
  const ehInfil = (p) => p.papel.area === 'infiltrados';
  // modelo 'slide' = slide simples, sem os Guias
  const doAlvo = (alvo, modelo = 'completo') => (p) => {
    if (modelo === 'slide' && p.papel.area === 'guia') return false;
    if (alvo === 'INFILTRADOS') return ehInfil(p) && !!p.cor;
    return alvo === 'TODOS' ? !!p.cor : p.cor === alvo;
  };
  const pedirArtes = (alvo, modelo = 'completo') => {
    const noAlvo = doAlvo(alvo, modelo);
    const semFoto = escalados.filter((p) => noAlvo(p) && !fotoPorId[p.id]);
    // sem cor só importa quando gera todos os grupos (ou só os infiltrados)
    const semCor = alvo === 'TODOS' ? escalados.filter((p) => !p.cor && !(modelo === 'slide' && p.papel.area === 'guia'))
      : alvo === 'INFILTRADOS' ? escalados.filter((p) => ehInfil(p) && !p.cor) : [];
    if (escalados.filter((p) => noAlvo(p) && fotoPorId[p.id]).length === 0) {
      toast({
        title: alvo === 'TODOS' ? 'Ninguém com foto e cor nos papéis da arte.'
          : alvo === 'INFILTRADOS' ? 'Nenhum infiltrado com foto e cor.' : `Ninguém com foto no grupo ${alvo.toLowerCase()}.`,
        description: 'Envie as fotos ou confira as cores na escala.',
        variant: 'destructive'
      });
      return;
    }
    if (semFoto.length || semCor.length) setAviso({ semFoto, semCor, alvo, modelo });
    else gerarArtes(alvo, modelo);
  };

  const gerarArtes = async (alvo, modelo = 'completo') => {
    setAviso(null);
    setGerando(modelo === 'slide' ? `slide-${alvo}` : alvo);
    try {
      const edicao = await dadosDaEdicaoParaArte();
      const usados = escalados.filter((p) => doAlvo(alvo, modelo)(p) && fotoPorId[p.id]);
      const imagens = {};
      await Promise.all(usados.map(async (p) => {
        const blob = await baixarFoto(fotoPorId[p.id].caminho);
        imagens[p.id] = await createImageBitmap(blob);
      }));
      const novas = [];
      if (alvo === 'INFILTRADOS') {
        const pessoas = usados.map((p) => ({ nome: fotoPorId[p.id].nome_arte || nomeCurto(p.nome), cor: p.cor, imagem: imagens[p.id] }));
        const blob = await desenharArteInfiltrados(pessoas, edicao, { fundo });
        setArtes([{ cor: 'INFILTRADOS', blob, url: await lerComoDataUrl(blob) }]);
        return;
      }
      for (const cor of CORES_ARTE) {
        const doGrupo = usados.filter((p) => p.cor === cor);
        if (doGrupo.length === 0) continue;
        const grupo = { cor };
        PAPEIS.forEach(({ chave, area }) => {
          grupo[chave] = doGrupo.filter((p) => p.papel.area === area)
            .map((p) => ({ nome: fotoPorId[p.id].nome_arte || nomeCurto(p.nome), imagem: imagens[p.id] }));
        });
        const blob = modelo === 'slide'
          ? await desenharSlideGrupo(grupo, edicao, { fundo })
          : await desenharArteGrupo(grupo, edicao, { fundo });
        novas.push({ cor, blob, url: await lerComoDataUrl(blob), slide: modelo === 'slide' });
      }
      setArtes(novas);
    } catch (e) {
      toast({ title: 'Não foi possível gerar as artes.', description: e.message, variant: 'destructive' });
    } finally {
      setGerando(null);
    }
  };

  const baixar = (blob, nome) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const nomeArquivo = (cor, slide) => (cor === 'INFILTRADOS' ? 'Infiltrados.png'
    : `${slide ? 'Slide_Grupo' : 'Grupo'}_${cor.charAt(0) + cor.slice(1).toLowerCase()}.png`);
  const baixarTodas = async () => {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    artes.forEach((a) => zip.file(nomeArquivo(a.cor, a.slide), a.blob));
    baixar(await zip.generateAsync({ type: 'blob' }), `Artes_Equipe_de_Trilha_${new Date().toISOString().slice(0, 10)}.zip`);
  };

  // ---- partes da tela
  const cartao = (p, papel) => (
    <CartaoPessoa key={`${p.id}-${papel || ''}`} pessoa={p} foto={fotoPorId[p.id]} link={links[fotoPorId[p.id]?.caminho]} papel={papel}
      onEnviar={() => escolherArquivo(p)} onNome={(n) => trocarNome(p, n)} onRemover={() => setRemovendo(p)} />
  );

  const blocoDaCor = (cor) => {
    const daCor = escalados.filter((p) => p.cor === cor);
    if (daCor.length === 0) return null;
    const visiveis = daCor.filter(passaFiltro);
    if (visiveis.length === 0) return null;
    const ok = daCor.filter((p) => fotoPorId[p.id]).length;
    return (
      <section key={cor || 'sem'} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
        <div className="flex items-center gap-2 mb-3">
          <span className={`text-xs font-bold px-2 py-0.5 rounded border ${COR_CHIP[cor] || 'bg-zinc-700/40 text-gray-300 border-white/20'}`}>
            {cor ? `GRUPO ${cor}` : 'SEM COR'}
          </span>
          <span className={`text-xs ${ok === daCor.length ? 'text-emerald-400' : 'text-amber-300'}`}>{ok} de {daCor.length} com foto</span>
          {!cor && <span className="text-xs text-gray-500">— não entram na arte até ter cor na escala.</span>}
          {cor && (
            <Button size="sm" onClick={() => pedirArtes(cor)} disabled={!!gerando || carregando}
              data-dica={`Gerar (ou refazer) só a arte do grupo ${cor.toLowerCase()}.`}
              className={`ml-auto h-8 border ${COR_BOTAO[cor]}`}>
              {gerando === cor ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImageIcon className="mr-2 h-4 w-4" />}
              Gerar grupo {cor.toLowerCase()}
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          {PAPEIS.map(({ area, titulo }) => {
            const doPapel = visiveis.filter((p) => p.papel.area === area);
            if (doPapel.length === 0) return null;
            return (
              // Guias numa linha; Inimigo, Infiltrados e Espírito Santo lado a lado
              <div key={area} className={area === 'guia' ? 'basis-full' : ''}>
                <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-1.5">{titulo}</p>
                <div className="flex flex-wrap gap-2">{doPapel.map((p) => cartao(p))}</div>
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  const doBanco = fotos
    .map((f) => ({ id: f.equipante_id, nome: f.nome }))
    .filter((p) => { const b = sem(busca); return !b || sem(p.nome).includes(b) || sem(fotoPorId[p.id]?.nome_arte).includes(b); });
  const papelNaEscala = (id) => {
    const e = escalados.find((p) => p.id === id);
    return e ? `${e.papel.titulo}${e.cor ? ` ${e.cor.toLowerCase()}` : ''}` : null;
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50">
      <input ref={arquivoRef} type="file" accept="image/jpeg,image/png,image/webp,image/*" className="hidden" onChange={aoEscolherArquivo} />
      <div className="bg-black border border-white/10 rounded-lg shadow-2xl w-full max-w-[min(96vw,1700px)] h-[96vh] sm:h-[94vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-start gap-4 p-5 border-b border-white/10 bg-zinc-900">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Camera className="h-5 w-5 text-pink-400" /> Fotos Eq. Trilha
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              Banco de fotos da equipe de trilha e a arte de cada grupo (Guias, Inimigo, Infiltrados e Espírito Santo), montada pela escala.
              As fotos ficam guardadas para as próximas edições e só os organizadores veem.
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {carregando ? 'Carregando…' : `${comFoto} de ${escalados.length} escalados nos papéis da arte com foto · ${fotos.length} fotos no banco.`}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-white shrink-0"><X className="h-5 w-5" /></Button>
        </div>

        <div className="px-4 py-3 border-b border-white/10 flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-white/15 overflow-hidden">
            {[['escalados', `Escalados na arte (${escalados.length})`], ['banco', `Banco de fotos (${fotos.length})`]].map(([k, t]) => (
              <button key={k} type="button" onClick={() => setAba(k)}
                className={`px-3 py-1.5 text-sm ${aba === k ? 'bg-white/15 text-white' : 'text-gray-400 hover:bg-white/5'}`}>{t}</button>
            ))}
          </div>
          {aba === 'escalados' && (
            <div className="flex rounded-md border border-white/15 overflow-hidden">
              {[['todos', 'Todos'], ['sem', 'Sem foto'], ['com', 'Com foto']].map(([k, t]) => (
                <button key={k} type="button" onClick={() => setFiltro(k)}
                  className={`px-3 py-1.5 text-sm ${filtro === k ? 'bg-white/15 text-white' : 'text-gray-400 hover:bg-white/5'}`}>{t}</button>
              ))}
            </div>
          )}
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome"
              className="pl-8 h-9 w-56 bg-black/40 border-white/15 text-white" />
          </div>
          {aba === 'banco' && (
            <Button variant="outline" onClick={() => { setAdicionar(true); setBuscaFicha(''); setFichas([]); }}
              className="h-9 border-white/20 bg-transparent text-gray-200 hover:bg-white/10">
              <UserPlus className="mr-2 h-4 w-4" /> Adicionar foto de alguém
            </Button>
          )}
          <div className="flex-1" />
          <div className="flex items-center gap-1.5" data-dica="Fundo da arte: escuro ou branco (modelo da arte antiga do roxo).">
            <span className="text-xs text-gray-500">Fundo</span>
            <div className="flex rounded-md border border-white/15 overflow-hidden">
              {FUNDOS_ARTE.map(({ valor, rotulo }) => (
                <button key={valor} type="button" onClick={() => setFundo(valor)}
                  className={`px-3 py-1.5 text-sm ${fundo === valor ? 'bg-white/15 text-white' : 'text-gray-400 hover:bg-white/5'}`}>{rotulo}</button>
              ))}
            </div>
          </div>
          <Button onClick={() => pedirArtes('INFILTRADOS')} disabled={!!gerando || carregando}
            data-dica="Gerar uma imagem só com os infiltrados (cores aglutinadas, no fundo escolhido)."
            className="h-9 border border-white/20 bg-transparent text-gray-100 hover:bg-white/10">
            {gerando === 'INFILTRADOS' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImageIcon className="mr-2 h-4 w-4" />}
            Gerar só infiltrados
          </Button>
          <Button onClick={() => pedirArtes('TODOS', 'slide')} disabled={!!gerando || carregando}
            data-dica="Slides simples de todos os grupos (Inimigo, Infiltrados e Espírito Santo, sem os Guias), no fundo escolhido."
            className="h-9 border border-white/20 bg-transparent text-gray-100 hover:bg-white/10">
            {gerando === 'slide-TODOS' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImageIcon className="mr-2 h-4 w-4" />}
            Equipe de trilha sem guias
          </Button>
          <Button onClick={() => pedirArtes('TODOS')} disabled={!!gerando || carregando}
            data-dica="Gerar a arte de todos os grupos. Para um grupo só, use o botão no cabeçalho da cor."
            className="h-9 bg-pink-600 hover:bg-pink-500 text-white">
            {gerando === 'TODOS' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImageIcon className="mr-2 h-4 w-4" />}
            Gerar todos
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {carregando ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-500" /></div>
          ) : aba === 'escalados' ? (
            escalados.length === 0 ? (
              <p className="text-center text-gray-500 py-16">Ninguém escalado em Guia, Inimigo, Infiltrados ou Espírito Santo ainda.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {[...CORES_ARTE, ''].map(blocoDaCor)}
                {escalados.filter(passaFiltro).length === 0 && <p className="text-center text-gray-500 py-10">Nada com esse filtro.</p>}
              </div>
            )
          ) : (
            doBanco.length === 0
              ? <p className="text-center text-gray-500 py-16">{fotos.length === 0 ? 'Nenhuma foto no banco ainda.' : 'Nada com essa busca.'}</p>
              : <div className="flex flex-wrap gap-2">{doBanco.map((p) => cartao(p, papelNaEscala(p.id)))}</div>
          )}
        </div>

        <div className="p-4 border-t border-white/10 bg-zinc-900 flex justify-end">
          <Button onClick={onClose} variant="outline" className="border-white/20 bg-transparent text-gray-300 hover:bg-white/10 hover:text-white">Fechar</Button>
        </div>
      </div>

      {recorte && (
        <RecorteFoto {...recorte} onCancelar={() => setRecorte(null)}
          onSalvo={() => { setRecorte(null); recarregar(); }} />
      )}

      {removendo && (
        <div role="dialog" data-state="open" className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-3">
          <div className="bg-zinc-900 border border-white/10 rounded-lg w-full max-w-sm p-5 space-y-4">
            <h4 className="text-lg font-bold text-white">Remover a foto?</h4>
            <p className="text-sm text-gray-300">{removendo.nome} fica sem foto no banco. Para voltar, é preciso enviar de novo.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRemovendo(null)} className="border-white/20 bg-transparent text-gray-300 hover:bg-white/10">Cancelar</Button>
              <Button onClick={confirmarRemover} className="bg-red-600 hover:bg-red-500 text-white"><Trash2 className="mr-2 h-4 w-4" /> Remover</Button>
            </div>
          </div>
        </div>
      )}

      {aviso && (
        <div role="dialog" data-state="open" className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-3">
          <div className="bg-zinc-900 border border-amber-500/40 rounded-lg w-full max-w-lg p-5 space-y-4 max-h-[90vh] flex flex-col">
            <h4 className="text-lg font-bold text-white flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-400" /> Antes de gerar</h4>
            <div className="overflow-y-auto space-y-3 text-sm">
              {aviso.semFoto.length > 0 && (
                <div>
                  <p className="text-amber-200 font-medium">{aviso.semFoto.length} {aviso.semFoto.length === 1 ? 'pessoa escalada está' : 'pessoas escaladas estão'} sem foto e {aviso.semFoto.length === 1 ? 'ficará' : 'ficarão'} FORA da arte:</p>
                  <ul className="mt-1 text-gray-300 space-y-0.5">
                    {aviso.semFoto.map((p) => <li key={p.id}>• {p.nome} <span className="text-gray-500">— {p.papel.titulo} {p.cor.toLowerCase()}</span></li>)}
                  </ul>
                </div>
              )}
              {aviso.semCor.length > 0 && (
                <div>
                  <p className="text-amber-200 font-medium">{aviso.semCor.length} sem cor na escala (não {aviso.semCor.length === 1 ? 'entra' : 'entram'} em nenhum grupo):</p>
                  <ul className="mt-1 text-gray-300 space-y-0.5">
                    {aviso.semCor.map((p) => <li key={p.id}>• {p.nome} <span className="text-gray-500">— {p.papel.titulo}</span></li>)}
                  </ul>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setAviso(null); setAba('escalados'); setFiltro(aviso.semFoto.length ? 'sem' : 'todos'); }}
                className="border-white/20 bg-transparent text-gray-200 hover:bg-white/10">Corrigir antes</Button>
              <Button onClick={() => gerarArtes(aviso.alvo, aviso.modelo)}className="bg-pink-600 hover:bg-pink-500 text-white">Gerar assim mesmo</Button>
            </div>
          </div>
        </div>
      )}

      {artes && (
        <div role="dialog" data-state="open" className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center p-3">
          <div className="bg-zinc-900 border border-white/10 rounded-lg w-full max-w-6xl p-5 space-y-4 max-h-[94vh] flex flex-col">
            <div className="flex justify-between items-center gap-3">
              <h4 className="text-lg font-bold text-white">
                {artes[0].cor === 'INFILTRADOS' ? 'Arte dos infiltrados'
                  : artes.length === 1 ? `Arte do grupo ${artes[0].cor.toLowerCase()}` : `Artes geradas (${artes.length})`}
              </h4>
              <div className="flex gap-2">
                {artes.length > 1 && <Button onClick={baixarTodas} className="bg-emerald-600 hover:bg-emerald-500 text-white"><Download className="mr-2 h-4 w-4" /> Baixar todas (.zip)</Button>}
                <Button variant="ghost" size="sm" onClick={() => setArtes(null)} className="text-gray-400 hover:text-white"><X className="h-5 w-5" /></Button>
              </div>
            </div>
            <div className="overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4">
              {artes.map((a) => (
                <div key={a.cor} className="space-y-2">
                  <img src={a.url} alt={`Grupo ${a.cor}`} className="w-full rounded border border-white/10" />
                  <Button size="sm" variant="outline" onClick={() => baixar(a.blob, nomeArquivo(a.cor, a.slide))}
                    className="border-white/20 bg-transparent text-gray-200 hover:bg-white/10">
                    <Download className="mr-2 h-4 w-4" /> {a.cor === 'INFILTRADOS' ? 'Infiltrados' : `${a.slide ? 'Slide ' : 'Grupo '}${a.cor.toLowerCase()}`} (PNG)
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {adicionar && (
        <div role="dialog" data-state="open" className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-3">
          <div className="bg-zinc-900 border border-white/10 rounded-lg w-full max-w-lg p-5 space-y-3 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="text-lg font-bold text-white">Adicionar foto de alguém</h4>
                <p className="text-xs text-gray-400">Qualquer ficha de equipante, mesmo quem não está escalado. Busque pelo nome ou pelo CPF completo.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setAdicionar(false)} className="text-gray-400 hover:text-white"><X className="h-5 w-5" /></Button>
            </div>
            <Input value={buscaFicha} onChange={(e) => setBuscaFicha(e.target.value)} autoFocus placeholder="Nome ou CPF (mín. 3 letras)"
              className="bg-black/40 border-white/15 text-white" />
            <div className="overflow-y-auto divide-y divide-white/5">
              {buscandoFicha && <div className="py-4 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-gray-500" /></div>}
              {!buscandoFicha && buscaFicha.trim().length >= 3 && fichas.length === 0 && <p className="py-4 text-center text-sm text-gray-500">Ninguém encontrado.</p>}
              {fichas.map((f) => (
                <button key={f.equipante_id} type="button"
                  onClick={() => { setAdicionar(false); escolherArquivo({ id: f.equipante_id, nome: f.nome }); }}
                  className="w-full text-left py-2 px-1 hover:bg-white/5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{f.nome}</p>
                    <p className="text-xs text-gray-500 truncate">{[f.cpf_final, f.igreja, f.edicao ? `${f.edicao}ª edição` : null].filter(Boolean).join(' · ')}</p>
                  </div>
                  {f.tem_foto ? <span className="text-xs text-emerald-400">já tem foto</span> : <Upload className="h-4 w-4 text-gray-400" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default FotosTrilhaDialog;
