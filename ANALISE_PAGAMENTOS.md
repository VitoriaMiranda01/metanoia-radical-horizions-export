
# Análise das Colunas `forma_pagamento` e `metodo_pagamento`

Este relatório documenta como as colunas `forma_pagamento` e `metodo_pagamento` estão sendo utilizadas e populadas nos registros de acampantes e equipantes ao longo da aplicação Metanoia Radical.

## 1. Locais de Criação e Atualização

### `src/lib/acampanteHelpers.js` (Criação/Atualização via Formulário)
Na função `mapFormDataToDb`, apenas a coluna `forma_pagamento` é mapeada a partir dos dados do formulário. A coluna `metodo_pagamento` não é referenciada na criação inicial.
