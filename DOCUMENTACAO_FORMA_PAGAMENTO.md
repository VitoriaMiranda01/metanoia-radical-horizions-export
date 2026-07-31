
# Documentação: Fluxo da Coluna `forma_pagamento` (Acampantes)

Este documento analisa em detalhes como a coluna `forma_pagamento` é populada no banco de dados para os registros da tabela `acampantes`. A análise cobre os componentes envolvidos, os valores possíveis, o fluxo de registro, a lógica de mapeamento de dados e os trechos de código relevantes.

---

## 1. Componentes de Formulário e Páginas de Captura

Através da análise do código, identificamos que a seleção de método de pagamento passou por uma refatoração no sistema. Os principais pontos de interação são:

1. **`src/pages/Acampante.jsx` (Fluxo Principal Atual):** O formulário principal de inscrição do acampante. Curiosamente, o estado inicial do formulário (`formData`) **não inclui** o campo `formaPagamento`. A inscrição é criada sem essa informação e o usuário é redirecionado para uma página separada (`/payment-method-selection`).
2. **`src/components/inscricao/Pagamento.jsx` (Componente Legado/Alternativo):** Um componente de formulário que injetava estaticamente o valor `'SICOOB_INTEGRATION'` no estado do formulário após a confirmação.
3. **`src/pages/PaymentMethodSelection.jsx`:** A página de destino após o cadastro, onde a verdadeira escolha de pagamento ocorre (atualizando preferencialmente a tabela de pagamentos dedicada ou a coluna `metodo_pagamento`).

---

## 2. Valores Possíveis

Com base nos arquivos de helper e componentes de pagamento (`PaymentSection.jsx`, `PIXPaymentForm.jsx`, `SicoobPaymentForm.jsx`, `paymentHelpers.js`), os métodos de pagamento suportados e valores literais mapeados historicamente ou atualmente incluem:

*   `'SICOOB_INTEGRATION'` (Definido no componente `Pagamento.jsx`)
*   `'PIX'` (Tratado nas APIs do Sicoob)
*   `'BOLETO'` (Mencionado na estrutura de banco de dados e helpers)
*   `'CREDIT_CARD'` (Mencionado nos comentários do esquema)
*   `'CUPOM_INTEGRAL'` (Definido em `paymentHelpers.js` ao finalizar pagamentos zerados)
*   `'manual'` (Visto nos componentes de baixa de pagamentos pendentes)

---

## 3. Ponto Exato no Fluxo de Registro

O fluxo exato de como o usuário percorre o sistema até o salvamento da coluna é o seguinte:

1. **Boas-vindas (`WelcomeScreen`):** O usuário lê as regras e prossegue.
2. **Validação de CPF (`VerificacaoCPF`):** O sistema checa se o CPF já está na edição atual.
3. **Preenchimento do Formulário (`Acampante.jsx`):** O usuário preenche dados pessoais, médicos, endereço, etc. O campo de forma de pagamento não está presente visualmente.
4. **Submissão (`handleSubmit` em `Acampante.jsx`):** O formulário chama a API `criarInscricao`.
5. **Salvamento Parcial (`inscricaoApi.js` -> `acampanteHelpers.js`):** A função de mapeamento busca `formData.formaPagamento`. Como é indefinido/vazio neste ponto do novo fluxo, ele salva `forma_pagamento: null` e `status_pagamento: 'pendente'`.
6. **Redirecionamento:** O usuário é levado à rota `/payment-method-selection` com o ID da inscrição para gerar a cobrança (PIX, etc).
7. **Atualização Pós-Pagamento (`atualizarStatusPagamento`):** Ao concluir ou selecionar o pagamento, o sistema geralmente atualiza a coluna `metodo_pagamento` (não `forma_pagamento`), indicando que `forma_pagamento` é um campo que provavelmente ficou obsoleto em favor de `metodo_pagamento` e da nova tabela `payment_info`.

---

## 4. Lógica de Mapeamento de Dados

A transição dos dados da memória (React State) para o banco (Supabase) acontece através do helper `mapFormDataToDb` e da chamada à API `criarInscricao`. 

*   O objeto JavaScript `formData` possui chaves em *camelCase*.
*   O helper `mapFormDataToDb` cria um novo objeto em *snake_case*. 
*   A linha exata que tenta capturar o valor é: `forma_pagamento: formData.formaPagamento || null,`.

---

## 5. Trechos de Código Relevantes

### 5.1 Definição do Formulário (Omissão da Forma de Pagamento)
*Arquivo: `src/pages/Acampante.jsx`*
