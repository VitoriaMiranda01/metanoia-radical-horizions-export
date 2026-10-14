import React, { useState } from 'react';
import { nomeDaIgreja } from '@/constants/igrejas';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCPF, formatNomeExibicao } from '@/utils/formatters';
import { User, Download, Loader2, Star, X, Plus, Pin, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { WORK_AREAS, CORES_GRUPO, AREAS_AGRUPADAS_POR_COR } from '@/constants/workAreas';
import NomeComBandeira from '@/components/common/NomeComBandeira';
import SeloPastor from '@/components/common/SeloPastor';
import { cn } from '@/lib/utils';

const EquipantesGridDisplay = ({
  equipantes = [],
  areaName,
  onExport,
  onRealocar,
  realocarAreaChoice = {},
  onRealocarAreaChoiceChange,
  realocando = {},
  onRemover,
  onAdicionarArea,
  // Quantas areas cada pessoa tem no total. Serve para mostrar "+1 área" ao
  // lado do nome de quem esta em mais de uma -- nas escalas oficiais isso e
  // ~6% da equipe.
  areasPorEquipante = {},
  nomesAreasPorEquipante = {},
  // Atuacoes possiveis NESTA area, na ordem do banco (a primeira e a
  // padrao, que todo mundo recebe ao ser alocado).
  atuacoes = [],
  onDefinirAtuacao,
  salvandoAtuacao = {},
  // Cor do grupo de trilha. So aparece nas areas que trabalham divididas por
  // cor -- nas outras a coluna nem existe.
  mostrarCor = false,
  onDefinirCor,
  salvandoCor = {},
  // Fixos na area (13/10/2026): { equipanteId: [areas fixas] }. O 📌 aparece
  // para qualquer organizador; o botao de marcar so com onFixar.
  fixasPorEquipante = {},
  onFixar
}) => {
  // Ordenar pelos cabecalhos (13/10/2026). campo null = ordem padrao (lider no
  // topo e o resto em ordem alfabetica, como vem da pagina). Clicar no mesmo
  // cabecalho: crescente -> decrescente -> volta ao padrao.
  const [ordem, setOrdem] = useState({ campo: null, desc: false });
  const clicarCabecalho = (campo) => setOrdem((o) => (
    o.campo !== campo ? { campo, desc: false } : !o.desc ? { campo, desc: true } : { campo: null, desc: false }
  ));

  if (!equipantes || equipantes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-gray-500 bg-white/5 rounded-md border border-white/5 border-dashed">
        <User className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">Nenhum equipante alocado.</p>
      </div>
    );
  }

  // So faz sentido mostrar a coluna quando a area tem mais de uma opcao --
  // em Estacionamento ou Secretaria, por exemplo, a atuacao e uma so.
  const mostrarAtuacao = onDefinirAtuacao && atuacoes.length > 1;
  const ehLider = (valor) => atuacoes.some(a => a.atuacao === valor && a.ehLider);
  const colunaCor = mostrarCor && !!onDefinirCor;
  // Atuacao que nao usa cor (ex.: Celular / Mesa na Recepção Sítio).
  const atuacaoSemCor = (valor) => atuacoes.some(a => a.atuacao === valor && a.semCor);

  // Bolinha da cor, para o organizador achar a pessoa correndo o olho pela
  // coluna em vez de ler palavra por palavra.
  const TINTA = {
    Amarelo:  'bg-yellow-400',
    Azul:     'bg-blue-500',
    Roxo:     'bg-purple-500',
    Verde:    'bg-green-500',
    Vermelho: 'bg-red-500'
  };
  const Bolinha = ({ cor }) => (
    <span className={cn('inline-block w-2.5 h-2.5 rounded-full shrink-0 border border-black/40', TINTA[cor] || 'bg-transparent')} />
  );

  const ehFixo = (eq) => (fixasPorEquipante[eq.id] || []).includes(areaName);
  const posCor = (eq) => { const i = CORES_GRUPO.indexOf(eq.cor); return i < 0 ? CORES_GRUPO.length : i; };
  const porNome = (a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', { sensitivity: 'base' });
  const texto = (v) => String(v || '').trim();
  // Em cada campo, vazio vai sempre para o fim; o nome desempata.
  const COMPARAR = {
    nome: porNome,
    cpf: (a, b) => texto(a.cpf).replace(/\D/g, '').localeCompare(texto(b.cpf).replace(/\D/g, '')),
    igreja: (a, b) => texto(nomeDaIgreja(a)).localeCompare(texto(nomeDaIgreja(b)), 'pt-BR', { sensitivity: 'base' }),
    atuacao: (a, b) => (Number(ehLider(b.atuacao)) - Number(ehLider(a.atuacao))) ||
      texto(a.atuacao).localeCompare(texto(b.atuacao), 'pt-BR', { sensitivity: 'base' }),
    cor: (a, b) => posCor(a) - posCor(b),
    fixo: (a, b) => Number(ehFixo(b)) - Number(ehFixo(a)),
  };
  const vazio = {
    cpf: (eq) => !texto(eq.cpf), igreja: (eq) => !texto(nomeDaIgreja(eq)),
    atuacao: (eq) => !texto(eq.atuacao), cor: (eq) => !eq.cor,
  };
  // Lider fica SEMPRE no topo, qualquer que seja a ordenacao (13/10/2026,
  // Patrick). Sem coluna escolhida, nas areas por cor os lideres seguem a
  // ordem das cores; com coluna, ela vale entre os lideres tambem.
  // Pela coluna escolhida (sem coluna: pelo nome).
  const pelaColuna = (a, b) => {
    if (!ordem.campo) return porNome(a, b);
    const ehVazio = vazio[ordem.campo];
    if (ehVazio && ehVazio(a) !== ehVazio(b)) return ehVazio(a) ? 1 : -1;
    const d = COMPARAR[ordem.campo](a, b);
    return (ordem.desc ? -d : d) || porNome(a, b);
  };
  // Agrupada por cor (ver AREAS_AGRUPADAS_POR_COR): lider sem cor no topo,
  // depois cada cor com o seu lider na primeira linha; a coluna escolhida
  // ordena dentro de cada cor.
  const porCor = AREAS_AGRUPADAS_POR_COR.includes(areaName);
  const liderGeral = (eq) => ehLider(eq.atuacao) && !eq.cor;
  const linhas = porCor
    ? [...equipantes].sort((a, b) =>
        (Number(liderGeral(b)) - Number(liderGeral(a))) ||
        (posCor(a) - posCor(b)) ||
        (Number(ehLider(b.atuacao)) - Number(ehLider(a.atuacao))) ||
        pelaColuna(a, b))
    : !ordem.campo ? equipantes : [...equipantes].sort((a, b) => {
    const lider = Number(ehLider(b.atuacao)) - Number(ehLider(a.atuacao));
    if (lider) return lider;
    // Entre os lideres tambem vale a coluna escolhida (14/10/2026): eles
    // continuam no topo, mas se ordenam entre si (nome, igreja, cor...).
    return pelaColuna(a, b);
  });
  // Linha que abre um grupo de cor (para a linha divisoria).
  const grupoDe = (eq) => (liderGeral(eq) ? '*' : eq.cor || '');
  const abreGrupo = (index) => porCor && index > 0 && grupoDe(linhas[index]) !== grupoDe(linhas[index - 1]);

  // Funcao (nao componente): um componente criado dentro do render seria
  // desmontado e montado de novo a cada atualizacao da tabela.
  const cabecalho = ({ campo, children, className, dica }) => {
    const ativo = ordem.campo === campo;
    const Seta = !ativo ? ArrowUpDown : ordem.desc ? ArrowDown : ArrowUp;
    return (
      <TableHead key={campo} className={cn('text-[11px] uppercase tracking-wider font-semibold text-gray-400', className)}>
        <button type="button" onClick={() => clicarCabecalho(campo)}
          data-dica={dica || 'Ordenar por esta coluna (clique de novo para inverter; a terceira vez volta ao padrão: líder no topo).'}
          className={cn('inline-flex items-center gap-1 uppercase tracking-wider hover:text-white', ativo && 'text-white')}>
          {children}
          <Seta className={cn('h-3 w-3 shrink-0', ativo ? 'opacity-100' : 'opacity-40')} />
        </button>
      </TableHead>
    );
  };

  return (
    <div className="space-y-3">
      {onExport && (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onExport(areaName, equipantes)}
            data-dica="Baixar a lista desta área em planilha."
            className="h-8 text-xs bg-white/5 border-white/20 text-white hover:bg-white/10 hover:text-white"
          >
            <Download className="mr-2 h-3 w-3" />
            Exportar
          </Button>
        </div>
      )}

      <div className="rounded-md border border-white/10 overflow-hidden bg-black/20">
        <Table>
          <TableHeader className="bg-white/5 hover:bg-white/5">
            <TableRow className="border-white/10 hover:bg-transparent">
              {cabecalho({ campo: 'nome', className: 'w-[24%]', children: 'Nome' })}
              {cabecalho({ campo: 'cpf', className: 'w-[14%] hidden sm:table-cell', children: 'CPF' })}
              {cabecalho({ campo: 'igreja', className: 'w-[22%] hidden md:table-cell', children: 'Igreja' })}
              {mostrarAtuacao && cabecalho({ campo: 'atuacao', className: 'w-[18%]', children: 'Atuação' })}
              {colunaCor && cabecalho({ campo: 'cor', className: 'w-[13%]', children: 'Cor' })}
              {cabecalho({ campo: 'fixo', className: 'w-[1%] whitespace-nowrap', children: '📌',
                dica: 'Ordenar por quem é fixo 📌 nesta área (clique de novo para inverter).' })}
              {onRealocar && <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 w-[22%]">Ação</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map((eq, index) => (
              <TableRow
                key={eq.escalaId || eq.id || index}
                className={cn('border-white/10 hover:bg-white/5 transition-colors', abreGrupo(index) && 'border-t-2 border-t-white/30')}
              >
                <TableCell className="font-semibold text-white min-w-[230px]">
                  <div className="flex flex-col">
                    <span className="flex items-center gap-1.5">
                      <NomeComBandeira nome={formatNomeExibicao(eq.nome)} nacionalidade={eq.nacionalidade} />
                      <SeloPastor pessoa={eq} />
                      {ehLider(eq.atuacao) && (
                        <Star
                          className="h-3 w-3 text-amber-400 shrink-0"
                          fill="currentColor"
                          title={eq.cor ? `Líder do ${eq.cor}` : 'Líder da área'}
                        />
                      )}
                      {eq.regraGuia && (
                        <span
                          className="shrink-0 text-[9px] px-1 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30"
                          data-dica="É Guia: pela regra, todo Guia também fica na Recepção Sítio (Fila / Confronto). A cor é a mesma nas duas áreas."
                        >
                          Guia
                        </span>
                      )}
                      {areasPorEquipante[eq.id] > 1 && (
                        <span
                          className="shrink-0 text-[9px] px-1 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30"
                          title={`Esta pessoa está em ${areasPorEquipante[eq.id]} áreas: ${(nomesAreasPorEquipante[eq.id] || []).join(', ')}.`}
                        >
                          +{areasPorEquipante[eq.id] - 1}
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-gray-500 sm:hidden">{formatCPF(eq.cpf)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-gray-400 hidden sm:table-cell font-mono text-xs whitespace-nowrap">
                  {formatCPF(eq.cpf)}
                </TableCell>
                <TableCell className="text-gray-400 hidden md:table-cell text-[12.5px] max-w-[200px] truncate" title={nomeDaIgreja(eq) || '-'}>
                  {nomeDaIgreja(eq) || '-'}
                </TableCell>
                {mostrarAtuacao && (
                  <TableCell>
                    <Select
                      value={eq.atuacao || ''}
                      onValueChange={(val) => onDefinirAtuacao(eq.escalaId, val)}
                      disabled={!!salvandoAtuacao[eq.escalaId]}
                    >
                      <SelectTrigger
                        className={cn(
                          "h-8 w-full sm:w-[170px] bg-black/40 border-white/20 text-xs",
                          ehLider(eq.atuacao) ? "text-amber-300 border-amber-500/40" : "text-white"
                        )}
                      >
                        {salvandoAtuacao[eq.escalaId]
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <SelectValue placeholder="Definir..." />}
                      </SelectTrigger>
                      <SelectContent>
                        {atuacoes.map(a => (
                          <SelectItem key={a.atuacao} value={a.atuacao}>
                            {a.ehLider ? `★ ${a.atuacao}` : a.atuacao}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                )}
                {colunaCor && atuacaoSemCor(eq.atuacao) && (
                  <TableCell>
                    <span className="text-xs text-gray-500" data-dica={`${eq.atuacao} não usa cor de grupo.`}>Não usa cor</span>
                  </TableCell>
                )}
                {colunaCor && !atuacaoSemCor(eq.atuacao) && (
                  <TableCell>
                    <Select
                      value={eq.cor || 'sem'}
                      onValueChange={(val) => onDefinirCor(eq.escalaId, val === 'sem' ? '' : val)}
                      disabled={!!salvandoCor[eq.escalaId]}
                    >
                      <SelectTrigger
                        data-dica={eq.cor ? undefined : ehLider(eq.atuacao)
                          ? 'Líder sem cor = líder da área inteira. Escolha uma cor só se ele for líder apenas daquela cor.'
                          : 'Sem cor: esta área é dividida por cor. Escolha a cor do grupo.'}
                        className={cn('h-8 w-full sm:w-[130px] bg-black/40 text-xs',
                          eq.cor || ehLider(eq.atuacao) ? 'border-white/20 text-white' : 'border-amber-500/60 text-amber-300')}>
                        {salvandoCor[eq.escalaId]
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : (
                            <span className="flex items-center gap-1.5 truncate">
                              <Bolinha cor={eq.cor} />
                              <span className="truncate">{eq.cor || (ehLider(eq.atuacao) ? 'Toda a área' : '⚠ Sem cor')}</span>
                            </span>
                          )}
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sem">Sem cor</SelectItem>
                        {CORES_GRUPO.map(cor => (
                          <SelectItem key={cor} value={cor}>
                            <span className="flex items-center gap-2">
                              <Bolinha cor={cor} />
                              {cor}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                )}
                <TableCell className="text-center">
                  {onFixar ? (
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => onFixar(eq, areaName)}
                      disabled={realocando[eq.escalaId]}
                      data-dica={ehFixo(eq)
                        ? `Fixo em ${(fixasPorEquipante[eq.id] || []).join(', ')}: entra primeiro no Alocar automático, toda edição. Clique para mudar.`
                        : 'Marcar como fixo nesta área: entra primeiro no Alocar automático, toda edição.'}
                      className={cn('h-8 w-8 p-0 shrink-0 hover:bg-amber-500/10',
                        ehFixo(eq) ? 'text-amber-400 hover:text-amber-300' : 'text-gray-600 hover:text-amber-400')}
                    >
                      <Pin className="h-4 w-4" fill={ehFixo(eq) ? 'currentColor' : 'none'} />
                    </Button>
                  ) : ehFixo(eq) ? (
                    <span className="text-[13px]" title={`Fixo em ${(fixasPorEquipante[eq.id] || []).join(', ')}: entra primeiro no Alocar automático.`}>📌</span>
                  ) : null}
                </TableCell>
                {onRealocar && (
                  <TableCell>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <Select
                        value={realocarAreaChoice[eq.escalaId] || ''}
                        onValueChange={(val) => onRealocarAreaChoiceChange(eq.escalaId, val)}
                      >
                        <SelectTrigger className="h-8 w-full sm:w-[150px] bg-black/40 border-white/20 text-white text-xs">
                          <SelectValue placeholder="Mover para..." />
                        </SelectTrigger>
                        <SelectContent>
                          {WORK_AREAS.filter(area => area !== areaName).map(area => (
                            <SelectItem key={area} value={area}>{area}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        onClick={() => onRealocar(eq.escalaId, eq.nome, areaName)}
                        data-dica="Mudar a pessoa desta área para a área escolhida ao lado."
                        disabled={!realocarAreaChoice[eq.escalaId] || realocando[eq.escalaId]}
                        className="h-8 text-xs font-semibold whitespace-nowrap bg-blue-600 hover:bg-blue-700 text-white disabled:bg-white/5 disabled:text-white/40 disabled:border disabled:border-white/20"
                      >
                        {realocando[eq.escalaId] ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Mover'}
                      </Button>
                      {/* A mesma pessoa pode trabalhar em mais de uma area
                          -- nas escalas oficiais sao ~55 por edicao. Este
                          botao ACRESCENTA a area escolhida ao lado, sem
                          tirar a pessoa desta aqui. */}
                      {onAdicionarArea && (
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => onAdicionarArea(eq.id, eq.escalaId, eq.nome)}
                          disabled={!realocarAreaChoice[eq.escalaId] || realocando[eq.escalaId]}
                          title={realocarAreaChoice[eq.escalaId]
                            ? `Escalar TAMBEM em ${realocarAreaChoice[eq.escalaId]}, sem tirar de ${areaName}`
                            : 'Escolha a area ao lado para escalar esta pessoa tambem nela'}
                          className="h-8 w-8 p-0 shrink-0 text-gray-500 hover:text-green-400 hover:bg-green-500/10 disabled:opacity-40"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      )}
                      {onRemover && (
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => onRemover(eq.escalaId, eq.nome, areaName, areasPorEquipante[eq.id] || 1)}
                          disabled={realocando[eq.escalaId]}
                          title={`Tirar ${formatNomeExibicao(eq.nome)} de ${areaName}`}
                          className="h-8 w-8 p-0 shrink-0 text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

// memo (13/10/2026): a pagina de escalas tem ~40 destas tabelas; sem isso,
// cada letra numa busca da pagina redesenhava todas (~1,5 s travado).
export default React.memo(EquipantesGridDisplay);
