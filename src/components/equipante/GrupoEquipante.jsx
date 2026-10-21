import React, { useEffect, useState } from 'react';
import { MessageCircle, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { grupoAbriu, grupoNaoConsegui } from '@/services/equipantesService';

/**
 * Grupo de WhatsApp da area na tela do equipante (21/10/2026, Patrick): o
 * link que o lider salvou aparece para quem esta escalado ali. Abrir o link
 * avisa o lider; se o WhatsApp nao deixar entrar (removido de um grupo antigo),
 * "Nao consegui entrar" poe a pessoa na lista do lider para ser adicionada
 * pelo contato.
 */
const Linha = ({ equipanteId, dono, a }) => {
  const [aberto, setAberto] = useState(!!a.grupo_aberto_em);
  const [pedido, setPedido] = useState(!!a.grupo_pedido_em);
  const [noGrupo, setNoGrupo] = useState(!!a.no_grupo_em);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    setAberto(!!a.grupo_aberto_em);
    setPedido(!!a.grupo_pedido_em);
    setNoGrupo(!!a.no_grupo_em);
  }, [a.grupo_aberto_em, a.grupo_pedido_em, a.no_grupo_em]);

  const entrar = () => {
    // O clique abre o WhatsApp; o aviso ao lider vai em segundo plano.
    setAberto(true);
    grupoAbriu(equipanteId, dono, a.escala_id);
  };

  const alternarPedido = async () => {
    setOcupado(true);
    const novo = !pedido;
    const r = await grupoNaoConsegui(equipanteId, dono, a.escala_id, novo);
    setOcupado(false);
    if (r?.ok) { setPedido(novo); if (novo) setNoGrupo(false); }
  };

  return (
    <div className="rounded-lg border border-[#25D366]/30 bg-[#25D366]/5 p-3 space-y-2 text-left">
      <p className="text-sm text-white font-medium flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-[#25D366]" />
        Grupo de WhatsApp · {a.area}{a.cor ? ` ${a.cor}` : ''}
      </p>
      {noGrupo ? (
        <p className="text-xs text-green-400">Você já está no grupo.</p>
      ) : (
        <>
          <a href={a.grupo_link} target="_blank" rel="noopener noreferrer" onClick={entrar}
            className="block rounded-md bg-[#25D366] hover:bg-[#20bd5a] text-white text-center text-sm font-semibold py-2.5">
            Entrar no grupo
          </a>
          {pedido ? (
            <div className="space-y-1">
              <p className="text-xs text-amber-200 flex items-start gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Avisamos o seu líder. Ele vai te adicionar ao grupo pelo seu número de WhatsApp.
              </p>
              <Button size="sm" variant="ghost" onClick={alternarPedido} disabled={ocupado}
                className="h-7 px-2 text-xs text-gray-400 hover:text-white hover:bg-white/10">
                {ocupado ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Consegui entrar'}
              </Button>
            </div>
          ) : aberto ? (
            <Button size="sm" variant="ghost" onClick={alternarPedido} disabled={ocupado}
              className="h-8 px-2 text-xs text-amber-200 hover:text-amber-100 hover:bg-white/10">
              {ocupado ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Não consegui entrar'}
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
};

const GrupoEquipante = ({ equipanteId, dono, areas = [] }) => {
  // Uma linha por link diferente (quem tem duas areas no mesmo grupo ve um so).
  const vistos = new Set();
  const comLink = areas.filter((a) => {
    if (!a.grupo_link || !a.escala_id || vistos.has(a.grupo_link)) return false;
    vistos.add(a.grupo_link);
    return true;
  });
  if (comLink.length === 0) return null;
  return (
    <div className="w-full space-y-2">
      {comLink.map((a) => <Linha key={a.escala_id} equipanteId={equipanteId} dono={dono} a={a} />)}
    </div>
  );
};

export default GrupoEquipante;
