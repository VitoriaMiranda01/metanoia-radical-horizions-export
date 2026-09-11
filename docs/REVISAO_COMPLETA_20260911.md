# Revisão completa do projeto — 11/09/2026

Segunda passagem, desta vez cobrindo **tudo**: frontend, banco, Edge Functions,
Storage, infraestrutura e higiene do repositório. A primeira auditoria
(`DIAGNOSTICO_SEGURANCA.md`) olhou só o código do frontend e o schema; esta
alcançou as partes que não estão neste repositório.

**Quatro achados novos, todos críticos.** Três deles são mais graves que
qualquer coisa do diagnóstico original.

---

## 🔴 N-1 — O repositório é público e ensina a senha de todas as igrejas

`https://github.com/VitoriaMiranda01/metanoia-radical-horizions-export`
responde **HTTP 200 sem autenticação**: é um repositório **público**.

Dentro dele, `database/migrations/data-20260910-cria-login-parceiros-igrejas-142-146.sql`
diz, em texto claro:

> `senha: bcrypt hash de "<codigo>.123456" (ex: "142.123456" pra codigo "142"),
> cost factor 6`

Ou seja: qualquer pessoa na internet lê o repositório e descobre que a senha da
igreja `142` é `142.123456`. **Não precisa quebrar hash nenhum** — a fórmula
está documentada. São **146 igrejas** comprometidas dessa forma, mais
**107 hashes bcrypt de custo 06** versionados em três arquivos.

Isso reordena a prioridade: fechar o acesso anônimo às tabelas (feito no Passo 1)
não protege contra isto, porque o atacante entra pela porta da frente, com a
senha certa.

**O que fazer:** trocar as senhas (já combinado) **e** decidir o que fazer com o
repositório — torná-lo privado e/ou limpar o histórico. Trocar a senha sem
tornar o repositório privado só adianta se as senhas novas não seguirem padrão
algum, o que já é o plano.

---

## 🔴 N-2 — Documentos de menores em buckets públicos

Dois buckets no Supabase Storage, **ambos com `public: true`**:

| Bucket | Conteúdo | Arquivos hoje |
|---|---|---|
| `autorizacao-menor-idade-equipante` | autorização dos pais para menores | 2 |
| `termo-responsabilidade-acampante` | termo de responsabilidade assinado | 2 |

`public: true` no Supabase significa que o arquivo é servido em
`/storage/v1/object/public/<bucket>/<caminho>` **sem autenticação e ignorando
qualquer RLS**.

A defesa que existe é o nome do arquivo ser difícil de adivinhar
(`envios/<id>-<random>.pdf`, em `equipantesService.js:131`). **Mas essa defesa
não vale nada aqui**, porque a URL completa é gravada na coluna
`equipantes.parental_auth_file_url` — e a tabela `equipantes` é legível por
qualquer visitante. A cadeia é:

```
ler equipantes (aberto)  →  pegar parental_auth_file_url  →  baixar o PDF
```

Hoje há só 4 arquivos, aparentemente de teste (04/09 a 09/09). O risco é o que
vem: são documentos assinados, com dados dos pais, de **menores de idade**.

**O que fazer:** tornar os dois buckets privados e passar a servir os arquivos
por URL assinada, com validade curta, só para organizador logado. O upload
anônimo pode continuar — já existe policy correta só de INSERT.

---

## 🔴 N-3 — Qualquer um gera cobrança PIX de qualquer valor

A Edge Function `sicoob-pix-create` está com **`verify_jwt: false`** — aceita
chamada de qualquer origem, sem nem a chave pública. E o valor cobrado vem
**inteiro do navegador**:

```ts
const { valor, descricao, cpf, nome_pagador, ... } = await req.json();
const valorReais = (valor / 100).toFixed(2);
// ...repassado direto ao backend, sem nenhuma conferência
```

Não há **nenhuma** validação contra a tabela `configuracoes` (onde o preço real
mora). O `coupon_code` é recebido no corpo e **simplesmente ignorado** — o
desconto é calculado no navegador, em `InscricaoPixPage.jsx:103`.

Além disso, o backend para onde ela encaminha
(`https://metanoia-backend-...run.app`, Google Cloud Run) **responde
publicamente**: `GET /health` retorna 200 sem autenticação. Não testei
`POST /gerar-pix` de propósito, porque isso criaria uma cobrança real na conta
Sicoob — mas a chamada que a Edge Function faz não leva credencial nenhuma,
o que indica que o endpoint aceita qualquer um.

**O que fazer:** ligar `verify_jwt`, e recalcular o valor **no servidor** a
partir de `configuracoes` + cupom validado no banco, ignorando o que o
navegador mandar.

---

## 🔴 N-4 — O webhook não confere quanto foi pago

`sicoob-webhook-handler` é, no geral, **a peça mais bem construída do sistema**:
tem token secreto na query string, rejeita chamada sem ele, e tem proteção
contra notificação duplicada. Bom trabalho.

Mas ele nunca olha `notif.valor`. Confirma a inscrição inteira com base só no
`txid` bater. Combinado com o N-3, fecha um contorno completo de pagamento:

1. gerar um PIX de **R$ 0,01** (valor decidido pelo navegador);
2. pagar R$ 0,01 de verdade;
3. o Sicoob notifica, o webhook acha o `txid` e marca
   `status_pagamento = 'confirmado'`.

**O que fazer:** comparar o valor pago com o valor esperado antes de confirmar,
e registrar divergência em vez de confirmar.

---

## 🟠 Achados médios (novos)

| # | Achado | Onde |
|---|---|---|
| N-5 | As 4 funções de alocação de equipante (`alocar_equipante_manualmente`, `realocar_equipante`, `liberar_vaga_e_realocar`, `alocar_equipante_automaticamente`) são **executáveis por `anon`** — um visitante pode remanejar as escalas | banco |
| N-6 | `console.log('Calling Cloud Run backend:', ...)` grava **nome + CPF + valor** nos logs da Edge Function | `sicoob-pix-create` |
| N-7 | O `insert` em `pix_sicoob` **não é aguardado** (`.then()` solto): se falhar, o PIX é gerado mas nunca poderá ser reconciliado, e o usuário não fica sabendo | `sicoob-pix-create` |
| N-8 | As duas funções Sicoob usam `SUPABASE_ANON_KEY`. Quando o Passo 2 trancar as tabelas, **o webhook para de funcionar** e pagamentos deixarão de ser confirmados | ambas |
| N-9 | O mock client não implementa `functions` nem `rpc` — se as variáveis de ambiente sumirem, o erro vira `TypeError` em vez de mensagem clara | `supabaseClient.js` |
| N-10 | `is_admin()` consulta `public.users`, tabela que **não existe** no banco. Código morto, hoje inofensivo porque nenhuma policy a usa | banco |

> **N-8 é uma dependência dura do Passo 2.** Precisa entrar no mesmo pacote,
> senão o efeito colateral é silencioso e caro: gente pagando e ficando como
> "pendente".

---

## ✅ O que está bem feito

Vale registrar, porque não é pouco:

- **O webhook do Sicoob** tem autenticação por token e é idempotente — foi
  pensado com cuidado.
- **`.env` nunca foi versionado**, nem hoje nem no histórico do Git.
- **Todas as funções `SECURITY DEFINER` têm `search_path` fixo** — fecha uma
  classe inteira de ataque de escalação de privilégio.
- Existe um event trigger **`rls_auto_enable`** que liga RLS automaticamente em
  qualquer tabela nova. É uma boa defesa, colocada por alguém que sabia o que
  estava fazendo.
- A camada `services/` é limpa: nenhuma tela fala com o banco direto, o que fez
  o mapeamento de acesso ser confiável e rápido.
- Validação de CPF implementa o algoritmo oficial, com dígitos verificadores.
- Storage já tem policy correta de **só INSERT** para anônimo.

---

## Como isso muda o plano

A ordem que estava no `PLANO_PASSO2_TRANCAR_BANCO.md` continua válida, mas os
achados novos **entram na frente ou junto**:

| Prioridade | Item | Por quê |
|---|---|---|
| 1 | **N-1** — repositório público + senhas | É a porta mais fácil, e não exige habilidade nenhuma |
| 2 | **N-2** — buckets públicos | Documento de menor, e o volume só cresce |
| 3 | **N-3 + N-4** — pagamento | Entram junto com o Passo 2 de qualquer forma |
| 4 | **N-8** | Sem isso, o Passo 2 quebra a confirmação de pagamento |
| 5 | C-1 / Passo 2 — trancar o banco | A janela de base vazia ainda está aberta |

N-1 e N-2 são **rápidos** e independentes do Passo 2 — dá para fazer os dois
antes, sem tocar no código do site.
