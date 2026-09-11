# Passo 2 — Trancar o banco (achado C-1)

> Preparado em 2026-09-11. **Nada aqui foi aplicado ainda.**
> Pré-requisito já concluído: [Passo 1 — login no servidor](../supabase/functions/login/README.md).

## 1. Por que agora é a hora certa

Levantamento feito na produção em 2026-09-11:

| Tabela | Linhas hoje |
|---|---|
| `acampantes` | **0** |
| `equipantes` | **0** |
| `pagamentos` | **0** |
| `escalas` | **0** |
| `cupons` | 4 |

E a configuração da edição 37:

| Campo | Valor |
|---|---|
| `inscricoes_acampantes` | **aberta** (desde 10/09/2026) |
| `inscricoes_equipantes` | fechada |
| `data_limite_inscricao_pagamento` | **27/09/2026** |
| `data_evento_inicio` | 30/10/2026 |

As inscrições **acabaram de abrir e ainda não chegou ninguém**. Ou seja:
existe agora uma janela — provavelmente de poucos dias — em que dá para
trancar o banco **sem nenhum dado real em risco e sem nenhum usuário para
quebrar**. Depois que as inscrições começarem a entrar, a mesma mudança passa
a ser feita em cima de dados de pessoas reais, com o site em uso.

**Esta janela é o melhor momento do ano para fazer o Passo 2.**

## 2. O que ainda está aberto

Nove tabelas continuam com a policy `"Pode tudo"` (`ALL`, `using true`) e com
`DELETE, INSERT, SELECT, UPDATE, TRUNCATE` liberados para `anon` — isto é,
para qualquer visitante do site:

`acampantes`, `equipantes`, `pagamentos`, `pix_sicoob`, `configuracoes`,
`cupons`, `escalas`, `limites_areas`, `limites_igrejas`

### O que isso significa na prática

A tabela `acampantes` tem **48 colunas**, entre elas:

> `cpf`, `nome`, `idade`, `email`, `whatsapp`, `cep`, `endereco`, `numero`,
> `bairro`, `cidade`, `tem_problema_saude`, `condicoes_medicas`,
> `usa_medicamento`, `medicamentos`, `esta_gravida`,
> `restricoes_alimentares`, `contato_emergencia_nome`,
> `contato_emergencia_telefone`

São **dados pessoais sensíveis de saúde, de menores de idade**, hoje
legíveis — e apagáveis — por qualquer pessoa. Pela LGPD, dado de saúde é
categoria especial (art. 11) e dado de criança/adolescente tem proteção
reforçada (art. 14). Hoje a tabela está vazia; a partir da primeira inscrição,
não estará mais.

## 3. Os 8 fluxos públicos que precisam continuar funcionando

Trancar o banco não é só "desligar o acesso": estas oito coisas acontecem com
o visitante **deslogado** e precisam continuar funcionando. É isto que torna o
Passo 2 maior que o Passo 1.

| # | Onde | O que faz hoje | Problema além do acesso aberto |
|---|---|---|---|
| 1 | HomePage, formulários | lê `configuracoes` (preços, datas, inscrições abertas) | traz colunas administrativas junto (`cpfs_area_guia`, `cpfs_area_inimigo`, `cpfs_area_espirito_santo`) |
| 2 | `/acampante` | `verificarCPF` / `verificarNome` fazem `select('*')` | devolve **a linha inteira** de outra pessoa só para responder "já existe?" |
| 3 | `/acampante` | `fetchOcupacaoIgrejasAcampantes` lê `admin_responsavel` de **todos** os acampantes | baixa a base inteira para fazer uma contagem |
| 4 | `/acampante` | lê `limites_igrejas` | — |
| 5 | `/acampante`, `/equipante` | `criarInscricao` insere em `acampantes` / `equipantes` | precisa continuar podendo inserir, mas **só inserir** |
| 6 | `/inscricao-pix`, `/inscricao-manual` | `findActiveCouponByCode` faz `select('*')` em `cupons` | dá para **listar todos os cupons** e usar o de maior desconto |
| 7 | `/payment-method-selection`, páginas de pagamento | `atualizarStatusPagamento` faz `UPDATE` do status | **qualquer um pode se marcar como "pago"** (achado A-1) |
| 8 | sorteio do grupo de trilha | grava `grupo_trailha` | — |

## 4. Desenho proposto

### 4.1 Regra geral

Para cada uma das 9 tabelas:

1. `revoke all ... from anon, authenticated` (tira o acesso amplo);
2. remover a policy `"Pode tudo"`;
3. criar policies reais baseadas no claim `user_role` do crachá emitido no
   Passo 1 (`organizador`, `organizador-aprovador`, `parceiro`);
4. para parceiro, restringir também pelo claim `igreja_codigo` — cada igreja
   enxerga só as inscrições dela.

### 4.2 Os fluxos públicos viram funções controladas (RPC)

Em vez de o visitante falar com as tabelas, ele passa a chamar funções que
respondem **só o necessário**:

| Função | Entrada | Saída |
|---|---|---|
| `config_publica()` | — | só preços, datas e se as inscrições estão abertas. Sem as colunas de CPF |
| `verificar_inscricao(cpf, tipo)` | CPF | apenas `{ existe, pago }` — **nunca a linha da pessoa** |
| `ocupacao_igrejas()` | — | apenas `{ igreja, quantidade }` |
| `validar_cupom(codigo)` | código | apenas `{ valido, desconto }` — sem listar cupons |
| `criar_inscricao(dados)` | formulário | insere e devolve só o `id`; o servidor decide `grupo_trailha` e força `status_pagamento = 'pendente'` |

> Detalhe importante: **o item 7 (pagamento) não vira RPC pública.** Marcar
> alguém como pago passa a ser exclusividade do servidor — ou o webhook do
> Sicoob, ou um organizador logado. É o que resolve o achado A-1, e por isso o
> Passo 2 e a parte de pagamento se resolvem juntos.

### 4.3 Uma mudança necessária no Passo 1

Hoje o `APP_JWT_SECRET` é um valor **aleatório**: o crachá é emitido e
guardado, mas o banco não o reconhece — foi de propósito, para o Passo 1 não
alterar o acesso a dados.

Para o Passo 2, ele precisa passar a ser o **JWT Secret do próprio projeto**,
senão o banco não aceitará o crachá e as telas de organizador e parceiro
ficarão vazias. É uma troca de segredo no painel, feita **junto** com as
policies — nunca antes.

## 5. Ordem de execução proposta

1. Escrever as funções (RPC) e as policies, e testar tudo num projeto
   descartável — igual ao que foi feito no Passo 1.
2. Ajustar o frontend para usar as RPCs no lugar dos acessos diretos.
3. Trocar o `APP_JWT_SECRET` para o JWT Secret do projeto e passar a enviar o
   crachá nas consultas.
4. Aplicar policies + revogações na produção.
5. Testar ponta a ponta: inscrição de acampante completa, PIX, login de
   organizador, login de parceiro, escalas, aprovações.
6. Confirmar de fora que a base não é mais legível por um visitante.

**Reversão:** cada etapa tem volta. O ponto sem retorno confortável é o passo
4, e por isso ele é o último — e só depois do 5 dar certo em teste.

## 6. Riscos honestos

- É **bem maior** que o Passo 1: mexe em 9 tabelas, ~12 arquivos do frontend e
  no formulário de inscrição, que é o coração do sistema.
- Se algo passar batido, o sintoma provável é "tela vazia" ou "não consigo me
  inscrever" — visível e reversível, não silencioso.
- Por isso a recomendação de fazer **agora, com a base vazia**: se quebrar,
  quebra sem dado de ninguém dentro.

## 7. Decisão pendente

Fazer o Passo 2 **antes** de as inscrições começarem a entrar (recomendado),
ou esperar e fazer depois do evento. Esperar significa a temporada inteira com
os dados de saúde dos acampantes abertos na internet.
