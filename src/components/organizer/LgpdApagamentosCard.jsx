import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchSituacaoLgpd, ROTULO_TIPO_LGPD } from '@/services/lgpdService';

/**
 * Quadro "LGPD — apagamentos automáticos" em Configuracoes (Patrick,
 * 24/10/2026). So existe para a conta "Desenvolvedores": para os outros
 * logins o banco devolve null e o quadro nem aparece.
 *
 * O aviso de privacidade promete apagar os dados da edicao (saude, areas,
 * autorizacao) 12 meses apos o evento e o cadastro 24 meses apos a ultima
 * participacao. O banco faz isso sozinho todo dia as 03:30; aqui se confere
 * que a rotina esta rodando, o que vence a seguir e o que ja saiu -- so pelo
 * codigo interno, sem nome nem CPF, para o registro nao virar outro dado
 * pessoal.
 */

const fmtData = (d) => {
  if (!d) return '—';
  const [a, m, dia] = String(d).slice(0, 10).split('-');
  return `${dia}/${m}/${a}`;
};

const fmtHora = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};

const LgpdApagamentosCard = () => {
  const [situacao, setSituacao] = useState(undefined);
  const [verRegistros, setVerRegistros] = useState(false);

  useEffect(() => {
    fetchSituacaoLgpd().then(setSituacao).catch(() => setSituacao(null));
  }, []);

  if (situacao === null) return null;

  const ultima = situacao?.ultima_execucao;
  // A rotina roda todo dia: mais de 28 h sem uma execucao boa e sinal de problema.
  const atrasada = situacao && (!situacao.ultima_sem_erro
    || Date.now() - new Date(situacao.ultima_sem_erro).getTime() > 28 * 3600 * 1000);
  const fila = situacao?.fila_arquivos;
  const totais = situacao?.totais || {};
  const registros = situacao?.registros || [];

  return (
    <Card className="glass-effect border-white/10 bg-black/40">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-white">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <span>LGPD — apagamentos automáticos</span>
        </CardTitle>
        <CardDescription className="text-gray-400">
          Cumpre os prazos do aviso de privacidade do equipante. Todo dia às 03:30 o sistema só confere
          os prazos; um dado é apagado apenas quando o prazo dele vence:
          saúde, áreas de trabalho e autorização do responsável, 12 meses após o evento;
          o cadastro inteiro, 24 meses após a última participação da pessoa.
          Do que é apagado, fica só o código interno. Só a conta Desenvolvedores vê este quadro.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {situacao === undefined && (
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
          </div>
        )}

        {situacao && (
          <div className="space-y-1 text-sm">
            {ultima?.erro ? (
              <p className="flex items-start gap-2 text-red-300">
                <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                A última execução ({fmtHora(ultima.em)}) falhou: {ultima.erro}. Nada foi apagado nela.
              </p>
            ) : atrasada ? (
              <p className="flex items-start gap-2 text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                {ultima ? `A rotina não roda desde ${fmtHora(situacao.ultima_sem_erro)}.` : 'A rotina ainda não rodou nenhuma vez (a primeira é às 03:30).'}
              </p>
            ) : (
              <p className="flex items-center gap-2 text-green-300">
                <CheckCircle2 className="w-4 h-4" />
                Em dia. Última execução: {fmtHora(ultima.em)}
                {' '}({ultima.dados_edicao} dados da edição, {ultima.cadastros} cadastros, {ultima.arquivos} arquivos).
              </p>
            )}
            {fila?.quantidade > 0 && (
              <p className={fila.com_erro > 0 ? 'text-amber-300 text-xs' : 'text-gray-400 text-xs'}>
                {fila.quantidade} arquivo(s) de autorização esperando para sair do Storage
                {fila.com_erro > 0 ? ` — ${fila.com_erro} com erro: ${fila.ultimo_erro}` : '.'}
              </p>
            )}
            {situacao.sem_data > 0 && (
              <p className="text-amber-300 text-xs">
                {situacao.sem_data} cadastro(s) sem edição ou de edição sem data do evento: esses nunca são apagados
                automaticamente.
              </p>
            )}
          </div>
        )}

        {(situacao?.edicoes || []).length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs uppercase tracking-wider text-gray-500">Prazos por edição</p>
            {situacao.edicoes.map((e) => (
              <div key={e.numero} className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-300 border-b border-white/5 pb-1.5">
                <span className="w-16 text-white">{e.numero}ª</span>
                <span>evento até {fmtData(e.evento_fim)}</span>
                <span>dados da edição saem em <span className="text-white">{fmtData(e.apaga_dados_em)}</span></span>
                <span>cadastro sai em <span className="text-white">{fmtData(e.apaga_cadastro_em)}</span></span>
                <span className="text-gray-500">{e.pessoas} pessoa(s) com esta como última edição</span>
              </div>
            ))}
            <p className="text-[11px] text-gray-500">
              A data vem do “Data Fim” do evento em Configurações → Geral. Quem se inscreve numa edição nova passa a
              contar a partir dela.
            </p>
          </div>
        )}

        {(situacao?.proximos || []).length > 0 && (
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wider text-gray-500">Próximos apagamentos</p>
            {situacao.proximos.slice(0, 6).map((p) => (
              <p key={`${p.data}-${p.tipo}`} className="text-xs text-gray-300">
                <span className="text-white">{fmtData(p.data)}</span> · {ROTULO_TIPO_LGPD[p.tipo] || p.tipo} de {p.quantidade} pessoa(s)
              </p>
            ))}
          </div>
        )}

        {situacao && (
          <div className="space-y-2">
            <p className="text-xs text-gray-400">
              Já apagados: {totais.dados_da_edicao || 0} dados da edição · {totais.cadastro || 0} cadastros ·{' '}
              {totais.arquivo_autorizacao || 0} arquivos de autorização
            </p>
            {registros.length > 0 && (
              <button type="button" onClick={() => setVerRegistros((v) => !v)}
                className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white">
                {verRegistros ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                {verRegistros ? 'Esconder o registro' : `Ver o registro (${registros.length} mais recentes)`}
              </button>
            )}
            {verRegistros && (
              <div className="max-h-72 overflow-y-auto rounded-md border border-white/10">
                {registros.map((r) => (
                  <div key={r.id} className="flex flex-wrap gap-x-3 gap-y-0.5 px-3 py-1.5 text-xs text-gray-300 border-b border-white/5">
                    <span className="w-32 text-gray-400">{fmtHora(r.em)}</span>
                    <span className="w-40 text-white">{ROTULO_TIPO_LGPD[r.tipo] || r.tipo}</span>
                    <span className="font-mono text-gray-400 break-all">{r.codigo || '—'}</span>
                    {r.edicao && <span className="text-gray-500">{r.edicao}ª edição</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LgpdApagamentosCard;
