import React from 'react';
import { ClipboardList, EyeOff, MessageCircle, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatarTelefone, digitosTelefone } from '@/utils/telefone';
import QuadroAviso from './QuadroAviso';

/**
 * Aviso em Gerenciar Inscricoes: acampantes com DADO FORA DO PADRAO na ficha
 * (nome com numero, nascimento ou sexo em branco, CEP ou estado invalido,
 * e-mail errado...). Acampante nao entra para ver status, entao quem ajusta
 * a ficha e a organizacao: cada item mostra o que esta errado e abre a ficha
 * para corrigir (pedido do Patrick, 06/10/2026). Telefones, contato de
 * emergencia e camisa tem quadro proprio. Quando a ficha fica certa, sai daqui.
 *
 * Os dados vem do useAvisosInscricoes (a pagina), que recarrega a cada 20s e
 * cuida do "Ocultar" (o aviso continua no sino).
 */

const PROBLEMA = {
  nome: 'Nome fora do padrão (só letras, nome e sobrenome)',
  sexo: 'Sexo em branco',
  nascimento: 'Data de nascimento em branco ou impossível',
  email: 'E-mail inválido',
  cep: 'CEP inválido',
  estado: 'Estado inválido',
  cidade: 'Cidade em branco ou com número',
  pastor: 'Nome do pastor com número ou símbolo',
  indicou: 'Nome de quem indicou com número ou símbolo',
  conhecido: 'Nome do familiar / conhecido com número ou símbolo',
  profissao: 'Profissão com número',
};

const linkWhats = (valor) => {
  const d = digitosTelefone(valor);
  return d.length >= 10 && d.length <= 11 ? `https://wa.me/55${d}` : null;
};

const ItemCadastro = ({ item, onAbrirFicha, onOcultar }) => {
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
            data-dica="Abrir a ficha para corrigir. Ao salvar com tudo certo, ela sai deste quadro."
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
      <ul className="flex flex-wrap gap-1.5">
        {item.problemas.map((p) => (
          <li key={p} className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-xs text-sky-200">
            {PROBLEMA[p] || p}
          </li>
        ))}
      </ul>
    </div>
  );
};

const AvisoCadastro = ({ aviso, onOcultar, onOcultarFicha, onAbrirFicha }) => {
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
        : 'Cada ficha mostra o que está errado. Abra a ficha e corrija — quando estiver tudo certo, ela sai deste quadro.'}
      onOcultar={onOcultar}
      ocultas={aviso.fichasOcultas?.length || 0}
    >
      {itens.map((item) => (
        <ItemCadastro
          key={item.id}
          item={item}
          onAbrirFicha={onAbrirFicha}
          onOcultar={onOcultarFicha ? () => onOcultarFicha(item.id) : undefined}
        />
      ))}
    </QuadroAviso>
  );
};

export default AvisoCadastro;
