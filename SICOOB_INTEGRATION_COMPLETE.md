# Integração Sicoob - Documentação Completa

## Visão Geral
A integração com o Sicoob permite a emissão de cobranças via PIX e Boleto Bancário. A arquitetura foi construída utilizando Supabase Edge Functions para abstrair e proteger as credenciais de acesso, e interagir diretamente com as APIs do Sicoob.

## Variáveis de Ambiente Necessárias (Supabase Edge Functions)
Para que as funções Edge funcionem corretamente, configure as seguintes variáveis no painel do Supabase:
- `SICOOB_CLIENT_ID`
- `SICOOB_CLIENT_SECRET`

## Edge Functions
- **sicoob-auth**: Autentica no Sicoob e retorna o `access_token`.
- **sicoob-boleto-create**: Recebe dados, aciona a auth, e gera um boleto no Sicoob. Salva em `boletos_sicoob`.
- **sicoob-boleto-consulta**: Consulta o status atual de um boleto na tabela `boletos_sicoob` e no Sicoob.
- **sicoob-pix-create**: Gera cobrança PIX imediata. Salva em `pix_sicoob`.
- **sicoob-pix-consulta**: Consulta status de PIX.
- **sicoob-webhook-handler**: Recebe callbacks do Sicoob atualizando status de pagamentos.

## Tabelas no Banco de Dados
### `boletos_sicoob`
- `id` (UUID), `sicoob_id` (Text), `valor` (Numeric), `vencimento` (Date), `status` (Text), `codigo_barras` (Text), `linha_digitavel` (Text)

### `pix_sicoob`
- `id` (UUID), `sicoob_id` (Text), `valor` (Numeric), `qr_code` (Text), `status` (Text), `expires_at` (Timestamp)

## Configuração de Webhook
No painel do Sicoob Developers, configure a URL de Webhook para apontar para a sua Edge Function:
`https://[SEU_PROJETO].supabase.co/functions/v1/sicoob-webhook-handler`

## Testes e Troubleshooting
1. Certifique-se de estar usando um ambiente de Sandbox no Sicoob (se disponível) para testes.
2. Cheque os logs das Edge Functions no Supabase Dashboard em caso de erros de "Missing credentials".
3. Valide se a extensão `pg_crypto` ou similares (para UUID) está habilitada no banco, o que normalmente é padrão no Supabase.