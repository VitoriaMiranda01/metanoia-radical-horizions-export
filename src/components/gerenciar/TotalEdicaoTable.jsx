import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Eye, Search } from 'lucide-react';
import Paginacao, { usePaginacao } from '@/components/common/Paginacao';
import NomeComBandeira from '@/components/common/NomeComBandeira';
import { nomeDaIgreja } from '@/constants/igrejas';
import { casaBusca } from '@/utils/busca';
import { cn } from '@/lib/utils';

/**
 * Aba "Total da edição" de Gerenciar Inscricoes (Patrick, 07/10/2026): quem
 * vai estar no acampamento -- todos os acampantes + os equipantes confirmados
 * na chamada da reuniao de escala. So para ver (o olho abre a ficha); editar
 * continua nas abas de Acampantes e Equipantes.
 */
const TIPOS = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'acampante', rotulo: 'Acampantes' },
  { valor: 'equipante', rotulo: 'Equipantes' },
];

const igrejaDe = (p) => (p.tipoNaEdicao === 'equipante'
  ? nomeDaIgreja(p)
  : (p.igreja || p.admin_responsavel)) || '-';

const TotalEdicaoTable = ({ acampantes, equipantesConfirmados, confirmadosDisponivel = true, onVerAcampante, onVerEquipante }) => {
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState('todos');

  const pessoas = useMemo(() => [
    ...acampantes.map((a) => ({ ...a, tipoNaEdicao: 'acampante' })),
    ...equipantesConfirmados.map((e) => ({ ...e, tipoNaEdicao: 'equipante' })),
  ].sort((x, y) => (x.nome || '').localeCompare(y.nome || '', 'pt-BR')), [acampantes, equipantesConfirmados]);

  const contagem = useMemo(() => ({
    todos: pessoas.length,
    acampante: acampantes.length,
    equipante: equipantesConfirmados.length,
  }), [pessoas, acampantes, equipantesConfirmados]);

  const filtradas = useMemo(() => pessoas.filter((p) =>
    (tipo === 'todos' || p.tipoNaEdicao === tipo)
    && casaBusca(busca, [p.nome, p.cpf, p.whatsapp, igrejaDe(p), p.igreja_outra])
  ), [pessoas, tipo, busca]);

  const paginacao = usePaginacao(filtradas);

  return (
    <Card className="bg-black/60 glass-effect border-white/10">
      <CardHeader>
        <div className="flex flex-col space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div>
              <CardTitle className="text-white flex items-center space-x-2">
                <Users className="w-5 h-5" />
                <span>Total da edição</span>
              </CardTitle>
              <CardDescription className="text-blue-200">
                {filtradas.length} registros · acampantes + equipantes confirmados
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2 md:flex-1 md:justify-end" role="group" aria-label="Tipo">
              {TIPOS.map((t) => (
                <button
                  key={t.valor}
                  type="button"
                  onClick={() => setTipo(t.valor)}
                  aria-pressed={tipo === t.valor}
                  className={cn(
                    'h-9 px-3 rounded-md border text-sm font-medium transition-colors',
                    tipo === t.valor
                      ? 'bg-white/20 text-white border-white/40'
                      : 'bg-white/5 text-gray-300 border-white/15 hover:bg-white/10 hover:text-white'
                  )}
                >
                  {t.rotulo} ({contagem[t.valor]})
                </button>
              ))}
            </div>
          </div>
          {!confirmadosDisponivel && (
            <p className="text-sm text-amber-300/90">
              A lista de equipantes confirmados não pôde ser carregada agora; aparecem só os acampantes.
            </p>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/50" />
            <Input
              type="text"
              placeholder="Buscar por CPF, Nome, Igreja..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:ring-2 focus:ring-blue-500 h-11"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filtradas.length === 0 ? (
          <div className="text-center py-8 text-white/70">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma pessoa encontrada</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-white/10">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 bg-white/5 hover:bg-white/5">
                    <TableHead className="text-white">Nome</TableHead>
                    <TableHead className="text-white">Tipo</TableHead>
                    <TableHead className="text-white">CPF</TableHead>
                    <TableHead className="text-white">Igreja</TableHead>
                    <TableHead className="text-white text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginacao.itensDaPagina.map((p) => (
                    <TableRow key={`${p.tipoNaEdicao}-${p.id}`} className="border-white/10 hover:bg-white/5">
                      <TableCell className="text-white font-medium"><NomeComBandeira nome={p.nome} nacionalidade={p.nacionalidade} /></TableCell>
                      <TableCell>
                        {p.tipoNaEdicao === 'equipante'
                          ? <Badge variant="outline" className="border bg-red-500/15 text-red-300 border-red-500/50">Equipante</Badge>
                          : <Badge variant="outline" className="border bg-green-500/15 text-green-300 border-green-500/50">Acampante</Badge>}
                      </TableCell>
                      <TableCell className="text-gray-300">{p.cpf || '-'}</TableCell>
                      <TableCell className="text-gray-300">{igrejaDe(p)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost" size="sm"
                          data-dica="Ver a ficha."
                          aria-label={`Ver a ficha de ${p.nome}`}
                          onClick={() => (p.tipoNaEdicao === 'equipante' ? onVerEquipante(p) : onVerAcampante(p))}
                          className="text-blue-300 hover:bg-blue-500/20"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Paginacao {...paginacao} />
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default TotalEdicaoTable;
