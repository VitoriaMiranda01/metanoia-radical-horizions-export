
# Auditoria Completa: Coluna `forma_pagamento`

Este documento apresenta uma auditoria detalhada da coluna `forma_pagamento` em toda a base de código do projeto Metanoia Radical, analisando seu esquema, operações de leitura/escrita, lógica associada e status de manutenção.

---

## 1. Database Schema (Esquema de Banco de Dados)
A coluna `forma_pagamento` existe e está confirmada nas tabelas principais de inscrições:
*   **Tabela `acampantes`**: Definida como `forma_pagamento text`.
*   **Tabela `equipantes`**: Definida como `forma_pagamento text`.

Ela coexiste com colunas mais recentes que parecem ter assumido seu papel, como `metodo_pagamento` (text), `status_pagamento` (text) e a nova tabela `payment_info`.

---

## 2. Write Operations (Operações de Escrita)
As operações de escrita que ainda referenciam `forma_pagamento` ocorrem estritamente na fase de mapeamento de dados (preparação do payload para o banco de dados):

*   **`src/lib/acampanteHelpers.js`**: Na função `mapFormDataToDb`, a linha `forma_pagamento: formData.formaPagamento || null,` tenta capturar o valor do estado.
*   **`src/lib/equipanteHelpers.js`**: Na função `mapFormDataToDb`, a linha `forma_pagamento: formData.formaPagamento,` faz o mesmo para equipantes.
*   **`src/lib/api/inscricaoApi.js`**: Na função interna `mapEquipanteToDb`, a linha `forma_pagamento: formData.formaPagamento,` tenta mapear o dado.

**Problema Crítico de Escrita:**
Embora os helpers tentem salvar o dado, os formulários de origem (`src/pages/Acampante.jsx` e `src/pages/Equipante.jsx`) **não possuem** o campo `formaPagamento` no estado inicial e não renderizam nenhum input para populá-lo. Portanto, a operação de escrita efetiva no banco de dados para novas inscrições resultará sempre em `null` ou valor indefinido.

---

## 3. Read Operations (Operações de Leitura)
*   **Consultas Gerais:** É recuperada indiretamente através de queries `select('*')` em funções como `getAcampantes` e `getAllEquipantes`.
*   **Exibições em Tela:** Não foi encontrada **nenhuma** referência explícita para exibição de `forma_pagamento` em modais de detalhes ou tabelas nos arquivos analisados.
*   **Exportação:** Na função `exportAcampantesToExcel` (`src/lib/acampanteHelpers.js`), a coluna `forma_pagamento` **não** é incluída no arquivo Excel gerado.

---

## 4. Logic/Conditions (Lógica e Condicionais)
Não foi identificada nenhuma lógica de negócios, validação ou filtro que dependa da coluna `forma_pagamento`.
O fluxo de roteamento de pagamento, validação e verificação de status utiliza exclusivamente as colunas `status_pagamento`, `metodo_pagamento` e a tabela `payment_info`.

---

## 5. File-by-File Analysis (Análise Arquivo por Arquivo)

| Arquivo | Linhas / Contexto | Status de Uso |
| :--- | :--- | :--- |
| `src/lib/acampanteHelpers.js` | ~L71: `forma_pagamento: formData.formaPagamento \|\| null` no `mapFormDataToDb` | Escrita passiva (mapeamento legado). |
| `src/lib/equipanteHelpers.js` | ~L56: `forma_pagamento: formData.formaPagamento` no `mapFormDataToDb` | Escrita passiva (mapeamento legado). |
| `src/lib/api/inscricaoApi.js` | ~L47: `forma_pagamento: formData.formaPagamento` no `mapEquipanteToDb` | Escrita passiva (mapeamento legado). |
| `src/pages/Acampante.jsx` | N/A | Removido/Inexistente no estado `formData` inicial. |
| `src/pages/Equipante.jsx` | N/A | Removido/Inexistente no estado `formData` inicial. |
| `src/pages/PaymentMethodSelection.jsx` | N/A | Utiliza e atualiza `metodo_pagamento`, ignorando `forma_pagamento`. |
| `src/lib/paymentHelpers.js` | N/A | A tabela `payment_info` foca em `payment_method`. Não interage com `forma_pagamento`. |

---

## 6. Active vs Abandoned Status (Status: Ativo ou Abandonado)

**Avaliação Geral:** A coluna `forma_pagamento` encontra-se em status **ABANDONADO (LEGACY)**.

**Justificativa:**
1. **Não é populada:** Nenhum fluxo de usuário ou formulário atual captura o dado `formaPagamento`.
2. **Substituição Evidente:** Todo o ecossistema foi refatorado para utilizar a propriedade `metodo_pagamento` na tabela de usuários e `payment_method` na tabela `payment_info`.
3. **Resquícios de Código:** As únicas referências restantes no código são linhas órfãs em funções mapeadoras (`mapFormDataToDb`) que tentam ler uma chave inexistente do objeto `formData`, resultando em gravações `null` inofensivas.
4. **Sem impacto na leitura:** A aplicação não exibe, filtra ou exporta este campo.

**Recomendação:** A coluna `forma_pagamento` pode ser seguramente removida dos objetos de mapeamento (`Helpers` e `inscricaoApi.js`) para limpar o código. Em uma futura migração de banco de dados, a própria coluna poderá ser "dropada" das tabelas `acampantes` e `equipantes` sem causar impacto no sistema.
