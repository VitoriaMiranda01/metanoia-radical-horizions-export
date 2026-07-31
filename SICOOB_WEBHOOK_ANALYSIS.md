
# Relatório de Análise: Integração Sicoob e Webhooks

Este documento apresenta uma análise detalhada da integração do Sicoob e do gerenciamento de webhooks na base de código atual, conforme solicitado.

---

## 1. Status Geral da Integração
A integração com o Sicoob **existe e possui infraestrutura funcional** no repositório, suportada primariamente por Supabase Edge Functions. No entanto, há uma **contradição de status**: o arquivo de documentação `SICOOB_INTEGRATION.md` declara que a integração está **DEPRECATED** e foi substituída pela Stripe. Apesar disso, o código de frontend (ex: `InscricaoPixPage.jsx`, `SicoobPaymentForm.jsx`) ainda faz chamadas ativas às APIs do Sicoob.

**Status de Implementação:** Funcional (na parte de infraestrutura), porém marcado como Obsoleto (Deprecated) pela documentação.

---

## 2. Arquivos Envolvidos na Integração
Os seguintes arquivos gerenciam o fluxo de pagamentos Sicoob:

*   **Frontend UI & Fluxo:**
    *   `src/pages/InscricaoPixPage.jsx`: Página de geração de PIX.
    *   `src/components/payment/PIXPaymentForm.jsx`: Componente de exibição e polling do PIX.
    *   `src/components/payment/SicoobPaymentForm.jsx`: Componente alternativo de pagamento Sicoob com polling ativo.
*   **APIs e Helpers (Frontend):**
    *   `src/lib/api/sicoobApi.js`: Centraliza chamadas para as Edge Functions `sicoob-pix-create` e `sicoob-pix-consulta`.
    *   `src/lib/paymentHelpers.js`: Atualiza tabelas de status de pagamento (`payment_info`).
*   **Documentação:**
    *   `SICOOB_INTEGRATION.md`
    *   `SICOOB_INTEGRATION_COMPLETE.md`
*   **Configurações:**
    *   `.env`

---

## 3. Webhooks: Endpoint e Processamento
*   **Endpoint de Webhook Configurado:** 
    A URL padrão de recepção de webhooks é definida diretamente na Edge Function do Supabase:
    `https://[SEU_PROJETO].supabase.co/functions/v1/sicoob-webhook-handler`
*   **Como é Recebido e Processado:**
    O webhook não é recebido pela aplicação frontend (React/Vite) nem pelo `App.jsx`. Ele é capturado e processado inteiramente no backend pela **Edge Function `sicoob-webhook-handler`**.
    1. O banco Sicoob dispara um POST (callback) para a Edge Function quando o PIX/Boleto é pago.
    2. A função valida o payload.
    3. A função atualiza as tabelas correspondentes (`pix_sicoob`, `boletos_sicoob`, e centralmente `payment_info`).

*Nota:* O banco de dados do projeto lista explicitamente a existência da function `sicoob-webhook-handler`.

---

## 4. Variáveis de Ambiente
As configurações do Sicoob estão separadas entre Frontend e Backend (Edge Functions):

**Frontend (`.env`):**
*   `VITE_SICOOB_API_URL=http://localhost:3001/api` (Aparentemente remanescente de testes locais)
*   `VITE_PAYMENT_TIMEOUT_MINUTES=30`

**Backend (Supabase Edge Functions / Secrets):**
Conforme `SICOOB_INTEGRATION_COMPLETE.md`, são requeridas:
*   `SICOOB_CLIENT_ID`
*   `SICOOB_CLIENT_SECRET`

---

## 5. Falhas e Gaps Identificados
Apesar da infraestrutura existir, há pontos de atenção:
1.  **Polling Inconsistente:** Enquanto os componentes isolados (`PIXPaymentForm.jsx` e `SicoobPaymentForm.jsx`) executam `setInterval` para validar o pagamento via API a cada 5-10 segundos, a página principal `src/pages/InscricaoPixPage.jsx` **não implementa polling nenhum**. Ela gera o QR Code mas exige fechamento da tela manual, dependendo 100% do Webhook oculto.
2.  **Conflito de Arquitetura (Sicoob vs Stripe):** `SICOOB_INTEGRATION.md` informa descontinuidade, mas o frontend segue chamando Sicoob para geração de PIX.
3.  **Falta de Tela de Conciliação:** Se o Webhook falhar, o administrador não possui uma interface unificada fácil para reprocessar ou consultar Webhooks falhos (apenas um painel de pendências de pagamento manual).
4.  **Variável Local Localhost:** O uso de `VITE_SICOOB_API_URL=http://localhost:3001/api` no `.env` está obsoleto perante a arquitetura de invocar funções do Supabase (`supabase.functions.invoke`), já que o `sicoobApi.js` invoca a edge function diretamente pelo SDK do Supabase e não faz fetch nessa variável localhost.
