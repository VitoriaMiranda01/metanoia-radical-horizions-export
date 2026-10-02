import React, { useEffect, useState } from 'react';
import { CheckCircle2, DatabaseBackup, Loader2, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchSituacaoBackup, descreverQuedas, dataDoBackup } from '@/services/backupService';
import { cn } from '@/lib/utils';

/**
 * Quadro "Backups automaticos" em Configuracoes. So existe para a conta
 * "Desenvolvedores": para os outros logins o banco devolve null e o quadro
 * nem aparece.
 *
 * E o lugar para conferir que o backup esta rodando -- a faixa vermelha do
 * topo so aparece quando algo da errado.
 */

const fmtHora = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
  });
};

const fmtTamanho = (bytes) => (bytes ? `${(bytes / 1024).toFixed(0)} KB` : '—');

const ROTULO_STATUS = {
  ok: { texto: 'ok', classe: 'border-green-500/40 bg-green-500/10 text-green-300' },
  alerta: { texto: 'queda brusca', classe: 'border-amber-500/40 bg-amber-500/10 text-amber-300' },
  erro: { texto: 'falhou', classe: 'border-red-500/40 bg-red-500/10 text-red-300' },
  rodando: { texto: 'rodando', classe: 'border-blue-500/40 bg-blue-500/10 text-blue-300' },
};

const Copia = ({ ok, nome }) => (
  <span className={cn('inline-flex items-center gap-1', ok ? 'text-green-400' : 'text-gray-500')}>
    {ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
    {nome}
  </span>
);

const BackupStatusCard = () => {
  const [situacao, setSituacao] = useState(undefined);

  useEffect(() => {
    fetchSituacaoBackup().then(setSituacao).catch(() => setSituacao(null));
  }, []);

  // Quem chega pelo "ver detalhes" da faixa vermelha cai direto aqui.
  useEffect(() => {
    if (situacao && window.location.hash === '#backups') {
      document.getElementById('backups')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [situacao]);

  if (situacao === null) return null;

  const problemas = situacao?.problemas || [];
  const recentes = situacao?.recentes || [];

  return (
    <Card id="backups" className="glass-effect border-white/10 bg-black/40 scroll-mt-28">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-white">
          <DatabaseBackup className="w-5 h-5 text-sky-400" />
          <span>Backups automáticos</span>
        </CardTitle>
        <CardDescription className="text-gray-400">
          Todo dia às 03:00: uma cópia no Supabase e outra no GitHub privado
          (Patrick-rios/metanoia-backups). Ficam 7 diários, 12 semanais e os de fim de
          edição. Só a conta Desenvolvedores vê este quadro.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {situacao === undefined && (
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
          </div>
        )}

        {situacao && (
          problemas.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-green-300">
              <CheckCircle2 className="w-4 h-4" />
              Em dia. Último backup completo: {fmtHora(situacao.ultimo_completo_em)}.
            </p>
          ) : (
            <ul className="text-sm text-red-300 space-y-1">
              {problemas.map((p) => (
                <li key={p} className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 shrink-0 mt-0.5" /> {p}
                </li>
              ))}
            </ul>
          )
        )}

        {recentes.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs uppercase tracking-wider text-gray-500">Últimas execuções</p>
            {recentes.map((e) => {
              const st = ROTULO_STATUS[e.status] || ROTULO_STATUS.erro;
              return (
                <div key={e.iniciado_em} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-300 border-b border-white/5 pb-1.5">
                  <span className="w-20 text-white">{dataDoBackup(e.data_ref)}</span>
                  <span className={cn('px-2 py-0.5 rounded-full border', st.classe)}>{st.texto}</span>
                  {e.tipo === 'edicao' && <span className="text-purple-300">fim de edição</span>}
                  <span className="text-gray-500">{fmtTamanho(e.bytes_gzip)}</span>
                  <Copia ok={e.supabase_ok} nome="Supabase" />
                  <Copia ok={e.github_ok} nome="GitHub" />
                  {e.erro && <span className="basis-full text-red-300/80">{e.erro}</span>}
                </div>
              );
            })}
          </div>
        )}

        {(situacao?.alertas || []).length > 0 && (
          <p className="text-xs text-amber-300">
            Quedas bruscas ainda não confirmadas:{' '}
            {situacao.alertas.map((a) => `${dataDoBackup(a.data_ref)} (${descreverQuedas(a.quedas)})`).join('; ')}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default BackupStatusCard;
