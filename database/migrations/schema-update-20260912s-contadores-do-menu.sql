-- ---------------------------------------------------------------------------
-- Contadores do menu: os selos vermelhos nos icones do cabecalho.
--
-- POR QUE
-- -------
-- Tres coisas so aparecem para quem abre a tela certa: pedido de senha nova
-- de um parceiro, cobranca PIX travada e inscricao de equipante esperando
-- aprovacao. Nenhuma delas avisa sozinha -- ou seja, ficam paradas ate
-- alguem lembrar de olhar. O Patrick pediu (12/09/2026) um numero pequeno
-- em cima do icone, so para chamar atencao.
--
-- POR QUE UMA FUNCAO SO
-- ---------------------
-- O cabecalho aparece em TODAS as telas do organizador e se atualiza
-- sozinho. Tres consultas separadas, repetidas de minuto em minuto, em oito
-- organizadores, seria barulho a toa no banco. Aqui e uma chamada que
-- devolve os tres numeros, e nada alem deles: a tela nao precisa dos dados,
-- so da contagem.
--
-- As regras espelham exatamente o que cada tela mostra:
--
--   aprovacoes  -> equipantes com status 'pendente' (ApprovalsView)
--   pagamentos  -> PIX 'divergente', ou 'pago' com a inscricao ainda nao
--                  quitada (fetchPixTravados / "cobrancas precisam de
--                  atencao")
--   senhas      -> solicitacoes_senha em aberto (tela de senhas)
--
-- Se uma dessas regras mudar na tela, mude aqui junto -- um selo que aponta
-- para uma lista vazia e pior que selo nenhum.
-- ---------------------------------------------------------------------------

create or replace function public.contadores_do_menu()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select case when not public.eh_organizador() then
    jsonb_build_object('aprovacoes', 0, 'pagamentos', 0, 'senhas', 0)
  else
    jsonb_build_object(
      'aprovacoes', (
        select count(*) from public.equipantes where lower(coalesce(status, '')) = 'pendente'
      ),
      'pagamentos', (
        select count(*)
          from public.pix_sicoob p
          left join public.acampantes a
                 on a.id = p.inscricao_id and coalesce(p.inscricao_tipo, '') <> 'equipante'
          left join public.equipantes e
                 on e.id = p.inscricao_id and p.inscricao_tipo = 'equipante'
         where p.status in ('pago', 'divergente')
           and (
             p.status = 'divergente'
             or lower(coalesce(a.status_pagamento, e.status_pagamento, ''))
                not in ('confirmado', 'pago', 'completed')
           )
      ),
      'senhas', (
        select count(*) from public.solicitacoes_senha where atendida_em is null
      )
    )
  end;
$fn$;

revoke all on function public.contadores_do_menu() from public;
revoke all on function public.contadores_do_menu() from anon;
grant execute on function public.contadores_do_menu() to authenticated;
