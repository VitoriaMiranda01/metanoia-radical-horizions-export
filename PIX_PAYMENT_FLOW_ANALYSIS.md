
# Análise do Fluxo de Pagamento PIX (Sicoob)

Este documento apresenta uma auditoria completa do fluxo de pagamentos via PIX no sistema Metanoia Radical, cobrindo desde a geração da cobrança até a confirmação no banco de dados e fluxos administrativos.

---

## 1. Geração e Exibição do PIX

A geração do PIX é tratada principalmente por três frentes no front-end:
*   **`src/pages/InscricaoPixPage.jsx`**: Uma página dedicada onde o usuário preenche/confirma CPF e Nome e gera o PIX. Ela calcula o valor (incluindo validação de cupons) e chama a API.
*   **`src/components/payment/PIXPaymentForm.jsx` e `SicoobPaymentForm.jsx`**: Componentes reutilizáveis que lidam com a interface de exibição do QR Code (usando `qrcode.react`) e a opção "Pix Copia e Cola".
*   **`src/lib/api/sicoobApi.js`**: Centraliza as chamadas. A função `gerarPixSicoob` invoca a Edge Function do Supabase chamada `sicoob-pix-create`. A Edge Function é responsável por se comunicar com o banco Sicoob, registrar a intenção e retornar o payload (QR Code e string Copia e Cola).

---

## 2. Rastreamento de Status do Pagamento

O acompanhamento imediato para o usuário final é feito via **Polling (Varredura Contínua)** no front-end:
*   Em `SicoobPaymentForm.jsx` e `PIXPaymentForm.jsx`, existem blocos `useEffect` que configuram um `setInterval` (a cada 5 ou 10 segundos).
*   Eles chamam `consultarStatusPagamentoSicoob`, que invoca a Edge Function `sicoob-pix-consulta`.
*   Se o status retornado for `'PAID'`, o front-end dispara os callbacks `onPaymentSuccess` ou `onPaymentConfirmed`, atualizando a UI para mostrar a mensagem de sucesso.
*   *Nota:* O `paymentHelpers.js` e `inscricaoApi.js` possuem métodos como `updatePaymentStatus` e `atualizarStatusPagamento` que podem ser chamados pelo front-end após o sucesso do polling.

---

## 3. Esquema de Banco de Dados

O rastreamento de pagamentos se divide em três níveis de tabelas na base `public`:

1.  **`payment_info`**: Tabela centralizada e moderna para rastrear pagamentos. Armazena `inscription_id`, `payment_method` (PIX, BOLETO, etc), `amount`, `status` (PENDING, CONFIRMED), e `transaction_id` (o ID do Sicoob).
2.  **`pix_sicoob`**: Tabela específica da integração, registrando `sicoob_id`, `valor`, `qr_code`, `status`, `expires_at`, e referências de `inscricao_id` e `user_id`. Provavelmente alimentada pela Edge Function `sicoob-pix-create`.
3.  **`acampantes` / `equipantes`**: Tabelas legadas de inscrição que possuem colunas redundantes: `status_pagamento`, `data_pagamento`, `metodo_pagamento`, `id_transacao_sicoob` e `txid_pix`. A lógica de negócio ainda depende de `status_pagamento` estar como `'pago'` ou `'confirmado'` nessas tabelas.

---

## 4. Sistema de Webhooks e Notificações

*   **Existência de Webhook**: A base de dados lista uma Edge Function chamada `sicoob-webhook-handler`. 
*   **Mecanismo**: Esta função serve como endpoint para o Sicoob notificar o sistema de forma assíncrona (callback) quando o cliente paga o PIX no aplicativo do banco.
*   **Importância**: O webhook é crucial porque o usuário pode gerar o PIX na página web, fechar o navegador e pagar 10 minutos depois. Sem o webhook, o sistema nunca saberia do pagamento apenas com o polling do front-end. O webhook deve atualizar as tabelas `pix_sicoob`, `payment_info` e sincronizar o `status_pagamento` nas tabelas principais.

---

## 5. Fluxo de Confirmação do Administrador (Admin Workflow)

*   **`src/pages/PagamentosPendentes.jsx`**: Atualmente, esta tela foca estritamente em pagamentos que foram marcados com `metodo_pagamento = 'manual'`. Ela permite que o administrador clique em "Dar Baixa", o que atualiza manualmente o `status_pagamento` para `'confirmado'`.
*   **`src/pages/GerenciarInscricoes.jsx`**: Exibe a lista geral.
*   **`src/components/aprovacoes/ApprovalsView.jsx`**: Focado na triagem de perfil (Aprovar/Rejeitar o candidato), e não diretamente na liquidação financeira, apesar de ambas estarem interligadas no processo final.

---

## 6. Lógica de Confirmação de Pagamento

A confirmação ocorre de 3 formas:
1.  **Automática via Polling (Front-end Ativo)**: O usuário escaneia e paga com a tela aberta. O `setInterval` detecta o pagamento, mostra a tela verde e atualiza o DB.
2.  **Automática via Webhook (Assíncrono)**: O usuário paga com a tela fechada. O banco avisa o Supabase via `sicoob-webhook-handler`, que liquida a fatura no banco de dados "por trás dos panos".
3.  **100% de Desconto (Cupom Integral)**: A função `finalizeZeroValuePayment` (`paymentHelpers.js`) pula o PIX e muda imediatamente o status para `'completed'`.
4.  **Manual**: O administrador dá baixa em transações manuais pela página `PagamentosPendentes`.

---

## 7. Gaps e Recomendações de Melhoria

### Identificação de Problemas (Gaps):
1.  **Falta de Polling na `InscricaoPixPage.jsx`**: Diferente dos componentes internos (`PIXPaymentForm`), a página completa `InscricaoPixPage.jsx` gera o PIX mas **não possui** lógica de polling (`setInterval`) para redirecionar o usuário automaticamente após o pagamento. Ela depende exclusivamente do usuário clicar num botão ausente ou do fluxo terminar de forma silenciosa via webhook.
2.  **Ponto Cego no Painel Admin**: A tela de `PagamentosPendentes.jsx` filtra *apenas* por `metodo_pagamento = 'manual'`. Se um PIX falhar na comunicação de webhook e ficar "perdido", o administrador não tem uma visualização dedicada para "PIX não conciliados" ou pendentes.
3.  **Redundância de Dados de Pagamento**: Existem três locais que armazenam o status (`payment_info`, `pix_sicoob` e tabela de `acampantes`/`equipantes`). Se o webhook atualizar um e não o outro, o sistema entrará em um estado de divergência.

### Recomendações:
1.  **Implementar Polling na `InscricaoPixPage`**: Adicionar a lógica de verificação a cada 10s em `InscricaoPixPage.jsx`, redirecionando para uma página de "Inscrição Concluída" ao confirmar o pagamento.
2.  **Unificar Painel de Pendências**: Atualizar `PagamentosPendentes.jsx` para listar *todos* os pagamentos pendentes (Manuais, PIX pendentes há mais de X horas, Boletos), adicionando filtros e botão para "Forçar Sincronização Sicoob" em PIX travados.
3.  **Consolidar Escrita em Transações Síncronas**: Garantir que as funções `atualizarStatusPagamento` e o `sicoob-webhook-handler` utilizem chamadas RPC (Stored Procedures) no Supabase para atualizar as tabelas de forma atômica (atualizando `payment_info` E `acampantes` na mesma transação de banco de dados).
