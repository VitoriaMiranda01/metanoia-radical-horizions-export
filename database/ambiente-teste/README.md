# Ambiente de teste

Projeto Supabase separado **"Metanoia TESTE"** (`oozwcfoidfqperbxnwkk`), criado
em 06/10/2026 como copia do oficial (estrutura + dados do dia). Serve para a
organizacao testar o fluxo inteiro sem mexer em nada de verdade.

- Liga no site pelo link `https://metanoiaradicalserra.com.br/?ambiente=teste`
  (ver `src/services/ambiente.js`); a faixa laranja tem o botao "Sair do teste".
- Login: mesma funcao `login` do oficial, com o segredo `APP_JWT_SECRET` do
  projeto de teste (o JWT Secret dele, configurado no painel).
- PIX: `sicoob-pix-create` de teste NAO vai ao Sicoob -- gera um codigo
  ficticio. O botao "Simular pagamento" chama `simular_pagamento_pix`
  (`simular-pagamento-pix.sql`), que faz o que o webhook faz no oficial.
- Mudancas de banco feitas no oficial depois de 06/10/2026 NAO chegam sozinhas
  ao teste: aplicar a migration nos dois projetos.
- Projeto gratuito: dorme depois de 7 dias sem uso (reativar no painel).
