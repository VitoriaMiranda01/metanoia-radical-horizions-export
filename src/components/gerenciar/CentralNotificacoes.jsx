import React, { useState } from 'react';
import { Bell, CalendarX, CheckCircle2, ClipboardList, Eye, PhoneOff, ShieldAlert, Shirt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/**
 * Central de notificacoes de inscricoes (pedido do Patrick, 06/10/2026):
 * o sino ao lado do titulo de Gerenciar Inscricoes, com o numero de fichas
 * com problema. Lista todos os avisos -- inclusive o que foi ocultado, seja
 * o quadro inteiro ou uma ficha so -- e traz de volta qualquer um.
 *
 * Para Desenvolvedores (somenteLeitura) so mostra os numeros e o recado de
 * que os avisos estao no perfil da Raquel.
 */

const ICONES = { nascimento: CalendarX, telefones: PhoneOff, contatos: ShieldAlert, camisas: Shirt, cadastro: ClipboardList };
const ALVOS = { nascimento: 'aviso-nascimento', telefones: 'aviso-telefones', contatos: 'aviso-contatos', camisas: 'aviso-camisas', cadastro: 'aviso-cadastro' };
const COR_ICONE = { nascimento: 'text-red-400', telefones: 'text-amber-400', contatos: 'text-orange-400', camisas: 'text-purple-400', cadastro: 'text-sky-400' };

const CentralNotificacoes = ({ avisos, total, onMostrar, onMostrarFicha, somenteLeitura = false }) => {
  const [aberto, setAberto] = useState(false);
  const comItens = avisos.filter((a) => a.itens.length > 0);

  const irPara = (aviso) => {
    if (aviso.oculto) onMostrar(aviso.chave);
    // Todas as fichas ocultadas uma a uma: o quadro so volta trazendo-as.
    if (aviso.visiveis.length === 0) aviso.fichasOcultas.forEach((f) => onMostrarFicha(aviso.chave, f.id));
    setAberto(false);
    // Espera o quadro voltar para a tela antes de rolar ate ele.
    setTimeout(() => {
      document.getElementById(ALVOS[aviso.chave])?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={total > 0 ? `${total} notificações de inscrições` : 'Notificações de inscrições'}
          data-dica={somenteLeitura
            ? 'Avisos de inscrições com problema — estão no perfil da Raquel.'
            : 'Notificações de inscrições com problema — inclusive as que você ocultou no quadro.'}
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-gray-200 hover:bg-white/10 hover:text-white"
        >
          <Bell className="h-5 w-5" />
          {total > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1 rounded-full bg-red-600 text-white text-[11px] font-bold leading-5 text-center">
              {total > 999 ? '999+' : total}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 bg-zinc-900 border-white/10 text-white">
        <div className="px-4 py-3 border-b border-white/10">
          <p className="font-semibold">Notificações de inscrições</p>
          <p className="text-xs text-gray-400">
            {somenteLeitura
              ? 'Estes avisos estão no perfil da Raquel para ela verificar.'
              : 'Fichas com algum problema para corrigir.'}
          </p>
        </div>
        {comItens.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-gray-400 flex flex-col items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-green-400" />
            Nenhuma inscrição com problema agora.
          </div>
        ) : (
          <ul className="divide-y divide-white/10">
            {comItens.map((a) => {
              const Icone = ICONES[a.chave] || Bell;
              return (
                <li key={a.chave} className="px-4 py-3 flex items-start gap-3">
                  <Icone className={cn('h-5 w-5 shrink-0 mt-0.5', COR_ICONE[a.chave] || 'text-amber-400')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white">{a.titulo}</p>
                    {!somenteLeitura && (
                      <>
                        <p className={cn('text-[11px] mt-0.5', a.oculto ? 'text-gray-500' : 'text-green-400')}>
                          {a.oculto ? 'Quadro oculto — fora da tela' : `${a.visiveis.length} no quadro`}
                          {!a.oculto && a.fichasOcultas.length > 0 && (
                            <span className="text-gray-500"> · {a.fichasOcultas.length} {a.fichasOcultas.length === 1 ? 'oculta' : 'ocultas'}</span>
                          )}
                        </p>
                        <Button size="sm" variant="outline" onClick={() => irPara(a)}
                          className="mt-2 h-7 border-white/20 bg-transparent text-gray-200 hover:bg-white/10 hover:text-white text-xs">
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          {a.oculto || a.visiveis.length === 0 ? 'Mostrar no quadro' : 'Ir para o quadro'}
                        </Button>
                        {/* As fichas ocultadas uma a uma, cada uma com o seu "Mostrar". */}
                        {a.fichasOcultas.length > 0 && (
                          <div className="mt-2 rounded-md border border-white/10 bg-black/30">
                            <p className="px-2 pt-1.5 text-[10px] uppercase tracking-wider text-gray-500">Fichas ocultas</p>
                            <ul className="max-h-36 overflow-y-auto">
                              {a.fichasOcultas.map((f) => (
                                <li key={f.id} className="flex items-center gap-2 px-2 py-1">
                                  <span className="flex-1 min-w-0 truncate text-xs text-gray-300">{f.nome}</span>
                                  <button type="button" onClick={() => onMostrarFicha(a.chave, f.id)}
                                    className="text-[11px] text-cyan-300 hover:text-white shrink-0">
                                    Mostrar
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default CentralNotificacoes;
