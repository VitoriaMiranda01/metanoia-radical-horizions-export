# Passo 2 — plano de execução (v2)

> Substitui `PLANO_PASSO2_TRANCAR_BANCO.md`, incorporando a revisão completa de
> 11/09 e as decisões tomadas com o Patrick.
>
> ⚠️ **Este arquivo é local — não foi enviado ao GitHub**, porque o repositório
> ainda é público. Ver seção 6.

## 1. Decisões já tomadas

| Tema | Decisão |
|---|---|
| Preço do acampante | **Preço único** (sem lotes). O servidor trata os dois tipos igual, então cadastrar lotes no futuro não exige mexer no código. |
| Preço do equipante | Mantém os 3 lotes já cadastrados. |
| Isenção | **Continua existindo, mas quem decide é sempre um organizador.** |
| Pagamento travado | **Sem consulta automática ao Sicoob.** A rede de segurança é uma tela de pendências onde o organizador libera manualmente. |
| Buckets de Storage | **Nada separado a fazer.** Resolvido junto com o travamento das tabelas (ver 4.4). |

## 2. 🔴 Achado novo: hoje qualquer pessoa se isenta sozinha

A decisão "quem decide a isenção é sempre um organizador" **não é o que
acontece hoje**. Os cupons cadastrados são:

| Código | Desconto | Ativo |
|---|---|---|
| `PASTOR` | R$ 50 | sim |
| `OVELHA` | R$ 50 | não |
| `ISENTO_ACAMPANTE` | **R$ 220** | sim |
| `ISENTO_EQUIPANTE` | **R$ 80** | sim |

`ISENTO_ACAMPANTE` vale exatamente o preço do acampante (R$ 220) — zera a
inscrição. E a tabela `cupons` é **legível por qualquer visitante**: dá para
listar todos os códigos e usar o de isenção. Nem precisa listar: os códigos são
adivinháveis.

Com o valor zerado, o site chama `finalizeZeroValuePayment` e **o próprio
navegador marca a inscrição como confirmada**, sem passar por PIX nenhum.

> **Resumo:** hoje qualquer pessoa se inscreve de graça digitando
> `ISENTO_ACAMPANTE`. Isso contradiz diretamente a regra que vocês definiram.

### 2.1 🟠 E um bug que vai aparecer no dia 30/10

`ISENTO_EQUIPANTE` dá R$ 80 de desconto, mas o preço do equipante muda por lote:

| Lote | Período | Preço | Com `ISENTO_EQUIPANTE` |
|---|---|---|---|
| 1 | 09/09 → 18/10 | R$ 70 | R$ 0 ✅ |
| 2 | 19/10 → 29/10 | R$ 80 | R$ 0 ✅ |
| 3 | **30/10 → 01/11** | R$ 90 | **R$ 10** ❌ |

A partir de 30/10 — que é o primeiro dia do evento — quem deveria ser isento
passa a ser cobrado em R$ 10. Isenção feita com "desconto de valor fixo" quebra
sozinha quando o preço sobe.

É mais uma razão para a isenção deixar de ser cupom e virar uma marcação do
organizador na inscrição.

## 3. O desenho

### 3.1 Preço: mesma conta, do lado do servidor

A lógica de lotes **já existe e já está certa** (`useCurrentPrice.js`): pega os
períodos de `configuracoes`, acha o que contém a data de hoje, usa aquele valor.
A tela do organizador que edita isso também já existe (`PricingPeriodsManager`).

Nada disso muda. O que muda é **onde a conta roda**: ela passa a acontecer
também no servidor, e o servidor ignora o valor que o navegador mandar.

- O navegador continua calculando, **só para mostrar na tela**.
- `sicoob-pix-create` recalcula a partir de `configuracoes` + cupom conferido no
  banco, e cobra **o valor que ele mesmo apurou**.
- Se o que o navegador mandou não bater, a função registra a divergência e usa
  o valor correto.

### 3.2 Isenção: deixa de ser cupom, vira decisão do organizador

- `ISENTO_ACAMPANTE` e `ISENTO_EQUIPANTE` são **desativados**.
- Cupom volta a ser só desconto parcial (ex.: `PASTOR`, R$ 50).
- O caminho `finalizeZeroValuePayment` sai das páginas públicas.
- Na tela do organizador, cada inscrição ganha a ação **"Isentar da taxa"**,
  que grava `status_pagamento = 'confirmado'`, `metodo_pagamento = 'isento'` e
  registra quem isentou.

Isso resolve os três problemas de uma vez: acaba a auto-isenção, acaba o bug do
lote 3, e a regra passa a ser exatamente a que vocês definiram.

### 3.3 "Nunca fica pendente": as quatro peças

O requisito não é cumprível hoje. Precisa de quatro correções, e as quatro são
pequenas:

| # | Problema atual | Correção |
|---|---|---|
| 1 | O `insert` em `pix_sicoob` não é aguardado — se falhar, o `txid` nunca é gravado e o pagamento **nunca** pode ser confirmado | aguardar o insert; se falhar, **não** devolver o PIX ao usuário |
| 2 | As funções Sicoob usam a chave anônima — vão parar quando as tabelas forem trancadas | trocar para `service_role` **na mesma janela** |
| 3 | A tela "Pagamentos Pendentes" só mostra `manual`/`isento` — **PIX travado não aparece em lugar nenhum** | passar a listar também PIX pago-mas-não-confirmado e PIX vencido |
| 4 | O webhook não confere o valor | comparar com `pix_sicoob.valor` (já existe a coluna). Se divergir, **não confirma** e manda para a tela de pendências |

A peça 3 é a rede de segurança que vocês escolheram: o organizador vê o que
travou e libera. Vale tratar como tela operacional do evento, não como
exceção rara.

### 3.4 Travamento das tabelas

Como no plano anterior: revogar o acesso amplo, remover a policy `"Pode tudo"`,
criar policies por papel (`organizador`, `parceiro` com `igreja_codigo`), e
transformar os fluxos públicos em funções controladas:

| Função | Devolve |
|---|---|
| `config_publica()` | preços, datas e se as inscrições estão abertas — sem as colunas de CPF |
| `verificar_inscricao(cpf, tipo)` | só `{ existe, pago }` |
| `ocupacao_igrejas()` | só `{ igreja, quantidade }` |
| `validar_cupom(codigo)` | só `{ valido, desconto }` |
| `criar_inscricao(dados)` | só o `id`; o servidor decide o grupo de trilha e força `status_pagamento = 'pendente'` |

E revogar de `anon` as 4 funções de alocação de equipante, que hoje qualquer
visitante pode chamar.

### 3.5 O que sai de graça junto

Trancar `equipantes` esconde a coluna `parental_auth_file_url`. Como o nome do
arquivo é aleatório, o documento de autorização deixa de ser alcançável sem
mexer em Storage nenhum. O modelo em branco continua público, como deve ser.

## 4. Ordem de execução

Cada etapa é reversível sozinha. A ordem importa.

| # | Etapa | Quebra algo se falhar? |
|---|---|---|
| 1 | ~~Desativar `ISENTO_ACAMPANTE` e `ISENTO_EQUIPANTE`~~ **✅ FEITO em 11/09** | Não. Fecha a auto-isenção **hoje**, sem depender do resto |
| 2 | Corrigir o `insert` de `pix_sicoob` e o valor no servidor | Não. Melhora isolada nas Edge Functions |
| 3 | Tela de pendências mostrando PIX travado + ação "Isentar" | Não. Só acrescenta |
| 4 | Escrever policies e RPCs e testar em projeto descartável | Não toca produção |
| 5 | Ajustar o frontend para usar as RPCs | Não toca produção até publicar |
| 6 | **Janela única:** trocar `APP_JWT_SECRET`, trocar as funções Sicoob para `service_role`, aplicar policies e revogações | Sim — é o ponto de atenção |
| 7 | Teste ponta a ponta: inscrição, PIX, isenção, organizador, parceiro, escalas | — |

A etapa 1 pode ser feita **agora**, em um minuto, e fecha o buraco mais fácil de
explorar depois das senhas.

A etapa 6 é a única que precisa de janela combinada: as três coisas têm que
entrar juntas, senão ou o login para de enxergar dados, ou os pagamentos param
de ser confirmados.

### 4.1 Registro da etapa 1 (aplicada em 11/09/2026)

```sql
update public.cupons set ativo = false
where codigo in ('ISENTO_ACAMPANTE','ISENTO_EQUIPANTE');
```

Estado depois: `PASTOR` (R$ 50) é o único cupom ativo. Verificado de fora, com
a chave pública, usando a mesma consulta que o site faz
(`findActiveCouponByCode`): os dois códigos de isenção passaram a responder
"cupom inválido ou expirado" e `PASTOR` continua aceito.

Não houve impacto em inscrições: as tabelas `acampantes` e `equipantes` estavam
vazias no momento da mudança. Nenhum código foi alterado — é só dado, então não
houve publicação nem necessidade de limpar cache.

**Como reverter:** `update public.cupons set ativo = true where codigo = '...';`
(não recomendado — reabre a auto-isenção).

**Enquanto a tela não fica pronta:** quem tiver direito à isenção é liberado
manualmente por um organizador em "Pagamentos Pendentes". A inscrição é feita
normalmente e fica como pendente até a liberação.

## 5. O que continua fora deste passo

- Troca das 154 senhas (combinado para depois, com lista por parceiro)
- Tornar o repositório privado (decisão da Vitória)

## 6. ⚠️ Documentos de segurança e o repositório público

`docs/PLANO_PASSO2_TRANCAR_BANCO.md` foi enviado ao GitHub em 11/09, antes de
eu descobrir que o repositório é público. Ele descreve quais tabelas estão
abertas e quais dados sensíveis elas guardam — num repositório público, isso é
um roteiro para quem quiser atacar.

**Providências:** tornar o repositório privado; enquanto isso não acontecer,
nenhum documento novo de segurança sobe (é o caso deste arquivo). Depois de
privado, vale mover os dois para dentro do repo e manter tudo junto.
