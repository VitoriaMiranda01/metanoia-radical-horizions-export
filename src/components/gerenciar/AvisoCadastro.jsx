import React, { useState } from 'react';
import { ClipboardList, EyeOff, Loader2, MessageCircle, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import CampoDataNascimento from '@/components/inscricao/CampoDataNascimento';
import { updateAcampante } from '@/services/acampantesService';
import { formatarTelefone, digitosTelefone } from '@/utils/telefone';
import { limparNomePessoa, problemaNomePessoa } from '@/utils/nomePessoa';
import {
  UFS, mascararCep, problemaCep, problemaEmail, problemaNascimento, problemaNomeSimples,
  limparSemNumero, problemaSemNumero
} from '@/utils/validacoesInscricao';
import QuadroAviso from './QuadroAviso';

/**
 * Aviso em Gerenciar Inscricoes: acampantes com DADO FORA DO PADRAO na ficha
 * (nome com numero, nascimento ou sexo em branco, CEP ou estado invalido,
 * e-mail errado...). Acampante nao entra para ver status, entao quem ajusta e
 * a organizacao (Patrick, 06/10/2026).
 *
 * Mesmo jeito dos outros avisos (telefones, contato de emergencia): cada ficha
 * diz o que esta errado e como esta hoje, e o campo certo e preenchido e salvo
 * ali mesmo -- sem abrir a ficha. Ao salvar, a ficha sai do quadro. Telefones,
 * contato de emergencia e camisa tem quadro proprio.
 *
 * Os dados vem do useAvisosInscricoes (a pagina), que recarrega a cada 20s e
 * cuida do "Ocultar" (o aviso continua no sino).
 */

const hojeISO = () => new Date().toISOString().slice(0, 10);
const dataBR = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '');

// Cada problema: o campo da tela, a(s) coluna(s) do banco, como esta hoje e a
// regra. `opcional`: pode ficar em branco (vira vazio no banco).
const CAMPOS = {
  nome: {
    rotulo: 'Nome', motivo: 'só letras, com nome e sobrenome', colunas: ['nome'],
    atual: (i) => i.nome, tipo: 'texto', limpar: limparNomePessoa, conferir: problemaNomePessoa,
  },
  sexo: { rotulo: 'Sexo', motivo: 'em branco', colunas: ['sexo'], atual: (i) => i.sexo, tipo: 'sexo' },
  nascimento: {
    // Em branco tem aviso proprio (AvisoNascimento); aqui so data impossivel.
    rotulo: 'Data de nascimento', motivo: 'idade impossível', colunas: ['data_nascimento'],
    atual: (i) => dataBR(i.data_nascimento), tipo: 'data', conferir: problemaNascimento,
  },
  email: {
    rotulo: 'E-mail', motivo: 'formato inválido', colunas: ['email'], atual: (i) => i.email,
    tipo: 'texto', conferir: problemaEmail, opcional: true, prefixar: false,
  },
  cep: {
    rotulo: 'CEP', motivo: 'precisa ter 8 números', colunas: ['cep'], atual: (i) => i.cep,
    tipo: 'texto', limpar: mascararCep, conferir: problemaCep, prefixar: false,
  },
  estado: { rotulo: 'Estado', motivo: 'fora da lista', colunas: ['estado'], atual: (i) => i.estado, tipo: 'uf' },
  cidade: {
    rotulo: 'Cidade', motivo: 'em branco ou com número', colunas: ['cidade'], atual: (i) => i.cidade,
    tipo: 'texto', limpar: limparSemNumero, conferir: (v) => problemaSemNumero(v, 'A cidade'),
  },
  pastor: {
    rotulo: 'Nome do pastor', motivo: 'com número ou símbolo', colunas: ['pastor_nome', 'pastor'],
    atual: (i) => i.pastor_nome, tipo: 'texto', limpar: limparNomePessoa, conferir: problemaNomeSimples, opcional: true,
  },
  indicou: {
    rotulo: 'Nome de quem indicou', motivo: 'com número ou símbolo', colunas: ['quem_indicou_nome'],
    atual: (i) => i.quem_indicou_nome, tipo: 'texto', limpar: limparNomePessoa, conferir: problemaNomeSimples,
  },
  conhecido: {
    rotulo: 'Nome do familiar / conhecido', motivo: 'com número ou símbolo', colunas: ['nome_familiar_conhecido'],
    atual: (i) => i.nome_familiar_conhecido, tipo: 'texto', limpar: limparNomePessoa, conferir: problemaNomeSimples, opcional: true,
  },
  profissao: {
    rotulo: 'Profissão', motivo: 'com número', colunas: ['profissao'], atual: (i) => i.profissao,
    tipo: 'texto', limpar: limparSemNumero, conferir: (v) => problemaSemNumero(v, 'A profissão'), opcional: true,
  },
};

const linkWhats = (valor) => {
  const d = digitosTelefone(valor);
  return d.length >= 10 && d.length <= 11 ? `https://wa.me/55${d}` : null;
};

const campoCls = 'h-9 bg-white/10 border-white/20 text-white placeholder:text-white/50';

const ItemCadastro = ({ item, onSalvo, onAbrirFicha, onOcultar }) => {
  const { toast } = useToast();
  const problemas = item.problemas.filter((p) => CAMPOS[p]);
  // Texto: ja vem com o que da para aproveitar (sem os numeros/simbolos);
  // o resto comeca vazio.
  const [valores, setValores] = useState(() => Object.fromEntries(problemas.map((p) => {
    const c = CAMPOS[p];
    const atual = c.atual(item) || '';
    return [p, c.tipo === 'texto' && c.prefixar !== false && c.limpar ? c.limpar(atual).replace(/\s+/g, ' ').trim() : ''];
  })));
  const [salvando, setSalvando] = useState(false);
  const mudar = (p, v) => setValores((atual) => ({ ...atual, [p]: v }));

  const salvar = async () => {
    const dados = {};
    for (const p of problemas) {
      const c = CAMPOS[p];
      const v = String(valores[p] ?? '').trim();
      if (!v) {
        if (c.opcional) { c.colunas.forEach((col) => { dados[col] = null; }); continue; }
        toast({ title: `Preencha: ${c.rotulo}`, variant: 'destructive' });
        return;
      }
      const problema = c.conferir ? c.conferir(v) : null;
      if (problema) {
        toast({ title: `Confira: ${c.rotulo}`, description: problema, variant: 'destructive' });
        return;
      }
      c.colunas.forEach((col) => { dados[col] = v; });
    }
    setSalvando(true);
    const r = await updateAcampante(item.id, dados);
    setSalvando(false);
    if (!r.success) {
      toast({ title: 'Não deu para salvar', description: r.error, variant: 'destructive' });
      return;
    }
    toast({ title: 'Cadastro corrigido', description: item.nome, className: 'bg-green-600 text-white' });
    onSalvo?.();
  };

  const whats = linkWhats(item.whatsapp);

  return (
    <div className="rounded-md border border-sky-500/25 bg-black/30 p-3 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-white font-medium">{item.nome}</p>
          <p className="text-xs text-gray-400">{item.admin_responsavel || item.igreja || 'sem igreja'}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {whats && (
            <a
              href={whats} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-green-500/40 px-2 h-8 text-xs text-green-300 hover:bg-green-500/10"
              data-dica="Conversar com o acampante no WhatsApp para pedir o dado certo."
            >
              <MessageCircle className="w-3.5 h-3.5" /> {formatarTelefone(digitosTelefone(item.whatsapp))}
            </a>
          )}
          <Button
            size="sm" variant="outline" onClick={() => onAbrirFicha?.(item.id)}
            data-dica="Abrir a ficha completa deste acampante para editar."
            className="h-8 border-white/20 bg-transparent text-gray-300 hover:bg-white/10 hover:text-white"
          >
            <Pencil className="w-3.5 h-3.5 mr-1" /> Abrir ficha
          </Button>
          {onOcultar && (
            <Button
              size="sm" variant="ghost" onClick={onOcultar}
              data-dica="Ocultar só esta ficha. Ela continua no sino de notificações, de onde dá para trazer de volta."
              className="h-8 px-2 text-gray-500 hover:text-white hover:bg-white/10"
            >
              <EyeOff className="w-3.5 h-3.5 mr-1" /> Ocultar
            </Button>
          )}
        </div>
      </div>

      <div className="text-xs text-sky-200 space-y-0.5">
        {problemas.map((p) => {
          const c = CAMPOS[p];
          return (
            <p key={p}>
              {c.rotulo}: <strong className="text-white">{c.atual(item) || '(vazio)'}</strong>
              <span className="text-sky-300/80"> — {c.motivo}.</span>
            </p>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end gap-2">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {problemas.map((p) => {
            const c = CAMPOS[p];
            if (c.tipo === 'sexo') {
              return (
                <Select key={p} value={valores[p] || undefined} onValueChange={(v) => mudar(p, v)}>
                  <SelectTrigger className={campoCls}><SelectValue placeholder="Sexo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Masculino">Masculino</SelectItem>
                    <SelectItem value="Feminino">Feminino</SelectItem>
                  </SelectContent>
                </Select>
              );
            }
            if (c.tipo === 'uf') {
              return (
                <Select key={p} value={valores[p] || undefined} onValueChange={(v) => mudar(p, v)}>
                  <SelectTrigger className={campoCls}><SelectValue placeholder="Estado" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {UFS.map(([uf, nome]) => <SelectItem key={uf} value={uf}>{nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              );
            }
            if (c.tipo === 'data') {
              return (
                <CampoDataNascimento
                  key={p} id={`cad-${item.id}-${p}`} max={hojeISO()}
                  value={valores[p]} onChange={(e) => mudar(p, e.target.value)}
                  className={`${campoCls} [color-scheme:dark]`}
                />
              );
            }
            return (
              <Input
                key={p}
                value={valores[p]}
                onChange={(e) => mudar(p, c.limpar ? c.limpar(e.target.value) : e.target.value)}
                placeholder={`${c.rotulo} correto`}
                type={p === 'email' ? 'email' : 'text'}
                inputMode={p === 'cep' ? 'numeric' : undefined}
                className={campoCls}
              />
            );
          })}
        </div>
        <Button
          data-dica="Gravar a correção. A ficha sai deste quadro."
          onClick={salvar} disabled={salvando}
          className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
        >
          {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
        </Button>
      </div>
    </div>
  );
};

const AvisoCadastro = ({ aviso, onRecarregar, onOcultar, onOcultarFicha, onCorrigido, onAbrirFicha }) => {
  // So as fichas que nao foram ocultadas uma a uma.
  const itens = aviso?.visiveis || [];
  if (itens.length === 0 || aviso.oculto) return null;

  return (
    <QuadroAviso
      id="aviso-cadastro"
      cor="sky"
      Icone={ClipboardList}
      titulo={itens.length === 1
        ? '1 acampante está com dado fora do padrão no cadastro'
        : `${itens.length} acampantes estão com dado fora do padrão no cadastro`}
      explicacao={aviso.perfil === 'desenvolvedores'
        ? 'Este aviso está no perfil da Raquel para ela verificar. Se ela não conseguir, dá para corrigir por aqui também.'
        : 'Cada ficha mostra o que está errado. Peça o dado certo e corrija aqui mesmo — ao salvar, a ficha sai deste quadro.'}
      onOcultar={onOcultar}
      ocultas={aviso.fichasOcultas?.length || 0}
    >
      {itens.map((item) => (
        <ItemCadastro
          key={item.id}
          item={item}
          onAbrirFicha={onAbrirFicha}
          onOcultar={onOcultarFicha ? () => onOcultarFicha(item.id) : undefined}
          onSalvo={() => { onRecarregar?.(); onCorrigido?.(); }}
        />
      ))}
    </QuadroAviso>
  );
};

export default AvisoCadastro;
