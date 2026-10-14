import React from 'react';
import { X, Pin, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger } from '@/components/ui/select';
import SeloPastor from '@/components/common/SeloPastor';
import SelectSobDemanda from '@/components/common/SelectSobDemanda';
import { nomeDaIgreja } from '@/constants/igrejas';
import { WORK_AREAS } from '@/constants/workAreas';
import { cn } from '@/lib/utils';

const VAZIO = [];

// As 3 areas que a pessoa marcou, sem repetir e so as que existem na escala.
const preferenciasValidas = (eq) => [
  eq.area_trabalho_opcao1, eq.area_trabalho_opcao2, eq.area_trabalho_opcao3
].filter((a, i, todas) => a && WORK_AREAS.includes(a) && todas.indexOf(a) === i);

/**
 * Um cartao da fila "A escalar" (Geracao de Escalas).
 *
 * Saiu de OrganizerScalesPage.jsx em 14/10/2026 por desempenho: a fila mostra
 * ate 100 cartoes, e cada um tem um menu com ~40 areas. Dentro da pagina, eles
 * se redesenhavam a cada clique em qualquer lugar (trocar a cor de um Guia
 * levava ~1s). Com React.memo, so se redesenha o cartao cujas informacoes
 * mudaram. Por isso as props sao valores simples ou listas que so mudam
 * quando o conteudo muda, e as acoes chegam num objeto fixo (`acoes`).
 *
 * acoes: { alternar(id, area), alternarFixar(id), alocar(id, nome) }
 */
const CartaoFila = ({
  eq, semVagaDica = '', manual = false, fixas = VAZIO, escolhidas = VAZIO,
  fixar = false, alocando = false, podeGerir = false, maxAreas = 5, acoes
}) => {
  const prefs = preferenciasValidas(eq);
  return (
    <div className="bg-red-900/20 border border-red-700/30 rounded-md p-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium truncate">
          {eq.nome} <SeloPastor pessoa={eq} className="align-[-2px] mx-0.5" /> <span className="text-xs text-red-300/70">({eq.sexo || 'sexo não informado'})</span>
          {semVagaDica && (
            <span className="ml-1.5 text-[11px] px-1.5 py-0.5 rounded border border-amber-500/50 bg-amber-500/15 text-amber-200"
              title={semVagaDica}>
              ⚠ Sugestões cheias
            </span>
          )}
          {manual && (
            <span className="ml-1.5 text-[11px] px-1.5 py-0.5 rounded border border-white/15 bg-white/5 text-gray-400"
              title="Inscrição manual que ainda não completou o cadastro: sem as opções de área (e às vezes sem sexo). Vai à mão.">
              Inscrição manual
            </span>
          )}
          {fixas.length > 0 && (
            <span className="ml-1.5 text-[11px] px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-200"
              title="Fixo: o Alocar automático coloca primeiro nesta(s) área(s).">
              📌 {fixas.join(', ')}
            </span>
          )}
        </p>
        <p className="text-[11px] text-gray-500 truncate mb-1.5" title={nomeDaIgreja(eq) || ''}>{nomeDaIgreja(eq) || '—'}</p>

        {/* As 3 areas que a PESSOA marcou na inscricao. E sugestao: a escolha
            final e do organizador -- por isso o menu ao lado tem todas. */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider text-gray-500 shrink-0">
            Pediu (sugestão)
          </span>
          {[eq.area_trabalho_opcao1, eq.area_trabalho_opcao2, eq.area_trabalho_opcao3].map((area, i) => (
            <span
              key={i}
              className={cn(
                "text-[11px] px-1.5 py-0.5 rounded border",
                area
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                  : "border-white/10 bg-white/5 text-gray-600"
              )}
            >
              <span className="opacity-60 mr-1">{i + 1}ª</span>{area || '—'}
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0">
        {/* As areas ja escolhidas, como selos removiveis. */}
        {escolhidas.length > 0 && (
          <div className="flex flex-wrap gap-1 justify-end">
            {escolhidas.map(area => (
              <button
                key={area}
                onClick={() => acoes.alternar(eq.id, area)}
                title={`Tirar ${area} da escolha`}
                className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border border-blue-500/40 bg-blue-500/15 text-blue-200 hover:bg-blue-500/25"
              >
                {area} <X className="h-3 w-3" />
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <SelectSobDemanda value="" onValueChange={(val) => acoes.alternar(eq.id, val)}>
            {(aberto) => (<>
            <SelectTrigger className="h-9 w-[200px] bg-black/40 border-white/20 text-white text-xs">
              <span className="truncate">
                {escolhidas.length === 0
                  ? 'Escolher área'
                  : `Adicionar outra (${escolhidas.length}/${maxAreas})`}
              </span>
            </SelectTrigger>
            <SelectContent>
              {/* As 3 escolhas da pessoa vem primeiro, num grupo separado; todas
                  as areas continuam logo abaixo. Fechado, nada (ver
                  SelectSobDemanda). */}
              {aberto && prefs.length > 0 && (
                <SelectGroup>
                  <SelectLabel className="text-amber-300/80 text-[11px]">
                    O que o equipante pediu
                  </SelectLabel>
                  {prefs.map(area => (
                    <SelectItem key={`pref-${area}`} value={area}>★ {area}</SelectItem>
                  ))}
                </SelectGroup>
              )}
              {aberto && (
              <SelectGroup>
                <SelectLabel className="text-gray-400 text-[11px]">Todas as áreas</SelectLabel>
                {WORK_AREAS.filter(area => !prefs.includes(area)).map(area => (
                  <SelectItem key={area} value={area}>{area}</SelectItem>
                ))}
              </SelectGroup>
              )}
            </SelectContent>
            </>)}
          </SelectSobDemanda>
          {podeGerir && (
            <Button
              type="button" size="sm" variant="ghost"
              onClick={() => acoes.alternarFixar(eq.id)}
              data-dica={fixar
                ? 'Vai alocar já como fixo 📌 na(s) área(s) escolhida(s). Clique para desligar.'
                : 'Alocar já como fixo 📌 na(s) área(s) escolhida(s): entra primeiro no Alocar automático, toda edição.'}
              className={cn('h-9 w-9 p-0 shrink-0 border',
                fixar
                  ? 'border-amber-500/60 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 hover:text-amber-200'
                  : 'border-white/15 text-gray-400 hover:text-amber-300 hover:bg-amber-500/10')}
            >
              <Pin className="h-4 w-4" fill={fixar ? 'currentColor' : 'none'} />
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => acoes.alocar(eq.id, eq.nome)}
            data-dica="Colocar esta pessoa na(s) área(s) escolhida(s) ao lado."
            disabled={escolhidas.length === 0 || alocando}
            className="bg-blue-600 hover:bg-blue-700 text-white h-9"
          >
            {alocando
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : `${fixar ? '📌 ' : ''}Alocar${escolhidas.length > 1 ? ` (${escolhidas.length})` : ''}`}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(CartaoFila);
