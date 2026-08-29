# Relatório Final Consolidado — Refatoração Metanoia Radical Horizons

Esse é o fechamento do trabalho pedido lá no início: reorganizar a implementação sem alterar regra de negócio, comportamento de tela ou schema de banco, sempre validando antes de remover e sinalizando qualquer dúvida em vez de decidir sozinho. Cobre tudo que foi feito, do primeiro relatório de auditoria até os dois itens opcionais de agora pouco.

**Números gerais**: `src/` foi de **160 para 103 arquivos** `.js`/`.jsx` (-36%), mais **36 documentos `.md` obsoletos** removidos da raiz e de dentro de `src/`, **26 dependências** tiradas do `package.json`, e o backend voltou a ter só os testes que correspondem a rotas que realmente existem (12 → 6 testes, todos passando). Em nenhum momento uma coluna de banco, política de RLS ou regra de negócio foi tocada.

---

## 1. Arquivos removidos

### 1.1 Código morto confirmado (primeira leva, após a auditoria)
Contexto/cliente Supabase duplicado (continha chave hardcoded):
`src/contexts/SupabaseAuthContext.jsx`, `src/lib/customSupabaseClient.js`

Stubs e componentes autodeclarados obsoletos:
`src/lib/api/sicoobPix.js`, `src/components/TelaPagamento.jsx`, `src/components/aprovacoes/FilterInputRow.jsx`, `src/components/payment/PIXPaymentForm.jsx`, `src/components/payment/SicoobPaymentForm.jsx`

Duplicatas/hooks/helpers órfãos:
`src/hooks/use-toast.js`, `src/hooks/useEditionDate.js`, `src/hooks/useEquipanteInscriptionValue.js`, `src/lib/equipanteHelpers.js`, `src/lib/inscricaoValoresHelpers.js`, `src/lib/ageCalculationHelpers.js`, `src/components/gerenciar/ColumnVisibilityModal.jsx`, `src/components/equipante/EquipantesListDisplay.jsx`, `src/components/equipante/LoadingState.jsx`, `src/components/inscricao/AreaTrabalhoExtra.jsx`, `src/components/inscricao/ExperienciaMotivacao.jsx`, `src/components/inscricao/Pagamento.jsx`, `src/components/ui/sonner.jsx`

Itens "possivelmente obsoletos" que vocês confirmaram:
`src/components/gerenciar/RelatoriosRapidos.jsx`, `src/pages/Inscricao.jsx` (lógica de redirecionamento migrada pro `App.jsx` antes de remover), `src/components/ScrollToTop.jsx`

Primitivos `ui/*` do shadcn sem nenhum uso (31 arquivos): `accordion`, `alert`, `aspect-ratio`, `avatar`, `breadcrumb`, `button-group`, `calendar`, `carousel`, `chart`, `collapsible`, `command`, `context-menu`, `drawer`, `empty`, `field`, `form`, `hover-card`, `input-group`, `input-otp`, `item`, `kbd`, `menubar`, `navigation-menu`, `pagination`, `progress`, `radio-group`, `resizable`, `sidebar`, `slider`, `spinner`, `toggle-group` — mais **7 órfãos em cascata** que só existiam pra dar suporte aos anteriores: `separator.jsx`, `sheet.jsx`, `skeleton.jsx`, `textarea.jsx`, `toggle.jsx`, `tooltip.jsx`, `use-mobile.jsx`.

Documentação solta: 19 `.md` na raiz + 17 `.md` dentro de `src/` (35... conferido: 36 no total).

**Subtotal: 22 arquivos de código + 38 primitivos/hook de UI + 36 documentos = 96 arquivos.**

### 1.2 Etapa C
`src/components/payment/PaymentSection.jsx` (órfão confirmado) — e a unificação que removeu 2 arquivos e criou 1 (ver seção "Criados").

### 1.3 Funções mortas descobertas durante os splits de serviço, removidas depois de investigação e confirmação de vocês
`src/services/relatoriosService.js` (arquivo inteiro — só continha `fetchRelatoriosRapidos`, órfã desde a remoção do `RelatoriosRapidos.jsx`), `fetchEquipantesByArea` e `fetchEquipantesByAreaAndGender` (`scalesService.js` — substituídas por filtro em memória que a tela já fazia), `saveAcampante`, `updateAcampante`, `getAcampanteById` e `validateAcampanteForm` (`acampantesService.js`/`utils/validation.js` — CRUD antigo de antes da unificação via `criarInscricao`, sem nenhuma rota que alcance). Antes de remover, verifiquei que a validação de CPF que `validateAcampanteForm` fazia não é uma lacuna hoje — o mesmo cheque já acontece na tela `VerificacaoCPF.jsx`.

### 1.4 Backend (`metanoia-radical-backend`)
Em `server.test.js`: bloco "3.6 — POST /gerar-boleto continua funcionando independentemente" (3 testes) e bloco "3.5 — GET /token continua funcionando independentemente" (3 testes) — ambos testavam rotas que não existem em `server.js` (que só tem `/health` e `/gerar-pix`). Confirmado rodando a suíte antes de mexer (5 de 12 testes falhando com 404) e depois (6 de 6 passando).

### 1.5 Campos de boleto no frontend
3 blocos de exibição (Nosso Número, Código de Barras, Data de Vencimento do boleto) e a função `formatarDataSimples`, que ficou sem uso, removidos do modal de detalhes de inscrição — confirmado por vocês que só PIX é emitido hoje.

---

## 2. Arquivos movidos

### 2.1 Etapa B — reorganização de pastas
| De | Para |
|---|---|
| `src/lib/database-setup.sql` | `database/database-setup.sql` |
| `src/lib/migrations/schema-update-20260211.sql` | `database/migrations/schema-update-20260211.sql` |
| `src/lib/api/equipanteApi.js` | `src/services/equipantesService.js` |
| `src/lib/api/inscricaoApi.js` | `src/services/inscricoesService.js` |
| `src/lib/api/sicoobApi.js` | `src/services/sicoobService.js` |
| `src/lib/api/workScheduleApi.js` | `src/services/workScheduleService.js` |
| `src/lib/supabase.js` | `src/services/supabaseClient.js` |
| `src/lib/authHelpers.js` | `src/services/authService.js` |
| `src/lib/paymentHelpers.js` | `src/services/paymentService.js` |
| `src/lib/limiteAreasHelpers.js` | `src/services/limiteAreasService.js` |
| `src/lib/databaseVerification.js` | `src/services/databaseVerification.js` |
| `src/lib/acampanteHelpers.js` | `src/services/acampantesService.js` |
| `src/lib/organizerHelpers.js` | `src/services/organizerService.js` (depois dividido, ver 2.3) |
| `src/lib/gruposTrailhaHelpers.js` | `src/utils/gruposTrailha.js` |
| `src/lib/validationHelpers.js` | `src/utils/validation.js` |
| `src/lib/columnVisibilityHelpers.js` | `src/utils/columnVisibility.js` |
| `src/lib/excelExportHelpers.js` | `src/utils/excelExport.js` |
| `src/lib/database-schema-mapping.js` | `src/constants/databaseSchema.js` |
| `src/components/ProtectedRoute.jsx` | `src/components/route-guards/ProtectedRoute.jsx` |
| `src/components/OrganizerProtectedRoute.jsx` | `src/components/route-guards/OrganizerProtectedRoute.jsx` |
| `src/components/IgrejaProtectedRoute.jsx` | `src/components/route-guards/IgrejaProtectedRoute.jsx` |
| `src/components/VerificacaoCPF.jsx` | `src/components/common/VerificacaoCPF.jsx` |
| `src/components/PricingPeriodsManager.jsx` | `src/components/organizer/PricingPeriodsManager.jsx` |

`src/lib/utils.js` ficou onde estava nessa etapa (alias fixo do shadcn) — só foi reduzido depois, na etapa dos itens opcionais (ver 2.4). 42 arquivos tiveram o caminho de import atualizado nessa movimentação.

### 2.2 Etapa C — renomeações
`src/components/aprovacoes/Statistics.jsx` → `AprovacoesStatsCards.jsx`; `src/components/gerenciar/Statistics.jsx` → `InscricoesStatsCards.jsx` (mesmo nome, componentes diferentes — ganharam nomes que dizem a que vieram).

### 2.3 Divisão de `organizerService.js` e `acampantesService.js`
`organizerService.js` (19 chamadas Supabase, 4 assuntos misturados) virou `organizerConfigService.js`, `inscricoesStatusService.js`, `scalesService.js` e (temporariamente) `relatoriosService.js`, mais um `serviceHelpers.js` compartilhado — detalhado na seção 4. `acampantesService.js` (validação + mapeamento + CRUD + exportação misturados) teve `mapFormDataToDb` e `validateAcampanteForm`/`exportAcampantesToExcel` realocados pra `utils/` — mesma seção.

### 2.4 Itens opcionais — `dev-tools/` e `lib/utils.js`
`plugins/` → `dev-tools/plugins/` (52 arquivos) e `tools/` → `dev-tools/tools/` (2 arquivos), com correção de 3 cálculos de caminho absoluto que dependiam da profundidade da pasta (`ast-utils.js`, `site-pages-server.js`, `install-missing-components.js`) pra não quebrar silenciosamente. `formatCPF` e `toBoolean` saíram de `src/lib/utils.js` para o novo `src/utils/formatters.js`; `validateCPF` foi para `src/utils/validation.js`. `cn()` ficou em `src/lib/utils.js`, que é o alias fixo do `components.json`.

### 2.5 Padronização de `src/pages/` (sufixo "Page")
7 dos 14 arquivos de página não tinham o sufixo "Page" no nome (o projeto estava dividido ao meio). A pedido de vocês, padronizei adicionando o sufixo nos que faltavam: `Acampante.jsx` → `AcampantePage.jsx`, `Aprovacoes.jsx` → `AprovacoesPage.jsx`, `Equipante.jsx` → `EquipantePage.jsx`, `GerenciarInscricoes.jsx` → `GerenciarInscricoesPage.jsx`, `Login.jsx` → `LoginPage.jsx`, `PagamentosPendentes.jsx` → `PagamentosPendentesPage.jsx`, `PaymentMethodSelection.jsx` → `PaymentMethodSelectionPage.jsx`. Em cada arquivo, o nome do componente interno e o `export default` foram renomeados junto; em `App.jsx` (único importador de cada uma dessas páginas), os 7 imports e os respectivos usos em JSX/rotas foram atualizados. `src/pages/` agora tem as 14 páginas com o mesmo padrão de nome.

---

## 3. Arquivos criados

| Arquivo | Motivo |
|---|---|
| `src/services/couponsService.js` | Não existia serviço dedicado a cupons; consolidou lógica que estava espalhada entre uma página e um hook. |
| `src/services/serviceHelpers.js` | `withRetry`/`handleSupabaseError` extraídos do antigo `organizerService.js` pra não duplicar em 4 arquivos novos. |
| `src/services/organizerConfigService.js` | Configurações gerais do evento (7 funções). |
| `src/services/inscricoesStatusService.js` | Status de inscrições abertas/fechadas (2 funções). |
| `src/services/scalesService.js` | Escalas/alocação de equipantes por área (4 funções, depois de remover as 2 mortas). |
| `src/utils/acampanteForm.js` | `mapFormDataToDb` (mapeamento puro formulário → banco). |
| `src/utils/formatters.js` | `formatCPF`, `toBoolean` (formatação/normalização pura). |
| `src/components/common/InscricaoDetalhesModal.jsx` | Versão única do modal de detalhes (substituiu as 2 divergentes). |
| `dev-tools/` | Agrupa `plugins/` e `tools/`, que antes ficavam soltos na raiz. |

*(`src/services/relatoriosService.js` chegou a ser criado nessa lista, mas como só continha a função `fetchRelatoriosRapidos` — que se confirmou morta — foi removido de novo pouco depois. Não aparece na lista final de arquivos vivos.)*

Ferramentas de análise que usei para validar cada etapa (`audit.mjs`, `deps.mjs`, `audit_devtools.mjs`) **não fazem parte do projeto** — rodaram só no meu ambiente de trabalho, nunca foram copiadas pra dentro do repositório de vocês.

---

## 4. Arquivos refatorados (conteúdo alterado, sem mudar comportamento)

- **`src/App.jsx`** — rota `/inscricao` recuperou o redirecionamento por papel (acampante/equipante/login) via componente `InscricaoRedirect`, depois que `pages/Inscricao.jsx` foi removido.
- **`package.json`** — 26 dependências removidas ao todo (`sonner`, `@emotion/is-prop-valid` na primeira leva; 24 pacotes Radix/`cmdk`/`embla-carousel-react`/etc. na Etapa C); script `build` atualizado pro novo caminho de `dev-tools/tools/generate-llms.js`.
- **`src/services/organizerService.js` → dividido e apagado** — 6 arquivos importadores atualizados (`WelcomeScreen.jsx`, `useCurrentPrice.js`, `useInscricoesStatus.js`, `HomePage.jsx`, `OrganizerScalesPage.jsx`, `OrganizerConfigPage.jsx`).
- **`src/services/acampantesService.js` → reduzido duas vezes** — primeiro para separar validação/mapeamento/exportação em `utils/`, depois para tirar as 3 funções mortas; 2 importadores atualizados (`inscricoesService.js`, `AcampantesTable.jsx`).
- **Consolidação de chamadas Supabase espalhadas** (22 arquivos → só `services/`, com 1 exceção legítima) — `HomePage.jsx`, `WelcomeScreen.jsx`, `ApprovalsView.jsx`, `PagamentosPendentes.jsx`, `GerenciarInscricoes.jsx`, `OrganizerConfigPage.jsx`, `useCouponValidation.js`, `useCurrentPrice.js`, `useOrganizerAuth.js`.
- **`src/utils/validation.js`** — ganhou `validateCPF` (união dos dois raciocínios: primeiro recebeu `validateAcampanteForm`, que depois foi removida por ser código morto; `validateCPF` ficou).
- **`src/utils/excelExport.js`** — ganhou `exportAcampantesToExcel`; import de `formatCPF` atualizado pro novo `utils/formatters.js`.
- **`src/lib/utils.js`** — reduzido a só `cn()`.
- **8 importadores de `formatCPF`/`validateCPF`/`toBoolean`** atualizados: `VerificacaoCPF.jsx`, `DadosPessoais.jsx`, `InfoSaude.jsx`, `EquipantesGridDisplay.jsx`, `InscricaoPixPage.jsx`, `inscricoesService.js`, `utils/acampanteForm.js`, `utils/excelExport.js`.
- **`src/App.jsx`** (segunda passagem) — 7 imports de página e seus usos em JSX/rotas atualizados pro sufixo "Page" novo (ver seção 2.5).
- **`dev-tools/plugins/utils/ast-utils.js`, `dev-tools/plugins/site-pages/site-pages-server.js`, `dev-tools/tools/install-missing-components.js`** — profundidade dos caminhos relativos corrigida depois da mudança de pasta (ver seção 2.4).
- **`vite.config.js`, `eslint.config.mjs`** — caminhos atualizados pra `dev-tools/`.
- **42 arquivos** com import reescrito na Etapa B (`@/lib/X` → novo caminho em `services/`/`utils/`/`constants/`); 1 import relativo quebrado corrigido no processo (`src/utils/excelExport.js`).

---

## 5. Código duplicado consolidado

| Duplicação | Resolução |
|---|---|
| 2 implementações de `useToast`/`toast` | Ficou só a usada em produção. |
| 2 Toasters (Radix vs Sonner) | Ficou só o Radix, já montado em `App.jsx`. |
| 2 clientes Supabase (um com chave hardcoded) | Ficou só o que lê de `.env`. |
| 2 sistemas de autenticação | Ficou só `AuthContext.jsx`. |
| `InscricaoDetalhesModal.jsx` (aprovacoes vs gerenciar, campos divergentes) | Unificado num componente só, com 2 correções de comportamento que vocês aprovaram explicitamente (título genérico, fallback de telefone). |
| `Statistics.jsx` (mesmo nome, componentes diferentes) | Renomeados para `AprovacoesStatsCards.jsx`/`InscricoesStatsCards.jsx`. |
| 80 chamadas `supabase.from()`/`channel()` espalhadas em 22 arquivos de tela | Consolidadas na camada `services/`. |
| `organizerHelpers.js`/`acampanteHelpers.js` (múltiplas responsabilidades cada) | Divididos por responsabilidade (ver seção 2.3/3). |

**Não consolidado (achado, não decidido — ver seção 9):** o projeto tem **3 implementações diferentes de formatação de CPF** — `utils/formatters.js`, uma cópia local dentro de `exportAcampantesToExcel` e outra dentro de `InscricaoPixPage.jsx`. Fazem a mesma coisa, mas são código duplicado. Não mexi porque escolher uma como "oficial" muda o que roda em produção.

---

## 6. Dúvidas de regra de negócio levantadas ao longo do trabalho

Duas surgiram de verdade — nenhuma foi decidida por conta própria:

1. **Modal de detalhes de inscrição**: título fixo "- Equipante" aparecia mesmo para acampantes, e o telefone ficava em branco pra acampantes sem `telefone_residencial` preenchido. Perguntei antes de unificar; vocês confirmaram título genérico e fallback pro campo `telefone`. **Resolvida.**
2. **Validação de CPF possivelmente perdida** ao remover `validateAcampanteForm`: investiguei antes de apagar — não é uma lacuna, o mesmo CPF já é validado antes, na tela `VerificacaoCPF.jsx`. **Verificada, sem ação necessária.**

Não há nenhuma dúvida de regra de negócio em aberto no momento.

---

## 7. Dependências

**Removidas (26 no total, todas confirmadas sem uso em `src/` antes de tirar):** `sonner`, `@emotion/is-prop-valid`, `@radix-ui/react-accordion`, `-aspect-ratio`, `-avatar`, `-collapsible`, `-context-menu`, `-hover-card`, `-menubar`, `-navigation-menu`, `-progress`, `-radio-group`, `-separator`, `-slider`, `-toggle`, `-toggle-group`, `-tooltip`, `cmdk`, `embla-carousel-react`, `input-otp`, `next-themes`, `react-day-picker`, `react-hook-form`, `react-resizable-panels`, `recharts`, `vaul`.

**Mantidas por engano quase cometido**: `tailwindcss-animate` chegou a ser listada como candidata num relatório anterior — reconferi antes de executar e ela está em uso real em `tailwind.config.js`. Não foi removida.

Hoje o `package.json` tem 31 dependências, todas com uso confirmado em `src/` ou em arquivos de configuração. **Não há nenhuma dependência pendente de decisão.**

---

## 8. Melhorias realizadas

- Eliminado o maior risco de segurança da auditoria original: chave do Supabase hardcoded no código-fonte.
- Grafo de imports de `src/` verificado a zero-quebra depois de **cada** mudança, do início ao fim — nunca deixei um estado intermediário quebrado.
- `src/` caiu de 160 para 103 arquivos (-36%); raiz + `src/` perderam 36 documentos obsoletos.
- Estrutura de pastas foi de "tudo em `lib/`" para `services/`/`utils/`/`constants/`/`database/` organizados por responsabilidade.
- Todo acesso direto ao Supabase saiu de telas/hooks e está concentrado em `services/` (única exceção legítima: `AuthContext.jsx` usando `supabase.auth.*`).
- Os dois maiores arquivos "concentradores" (`organizerHelpers.js` com 19 chamadas, `acampanteHelpers.js` misturando 4 responsabilidades) foram divididos.
- Backend com suíte de testes fiel ao que o servidor realmente expõe (6/6 passando, sem testar rota inexistente).
- Frontend sem nenhum resquício de boleto (código morto e UI), confirmado por vocês que só PIX é usado.
- `plugins/`/`tools/` organizados em `dev-tools/`, sem quebrar os 3 pontos que calculavam caminho absoluto por profundidade de pasta.
- `lib/utils.js` reduzido só ao que o shadcn realmente precisa; lógica de negócio (CPF, boolean) foi para `utils/`.
- 7 funções mortas encontradas *durante* os splits (não visíveis antes, porque viviam misturadas em arquivos grandes) e removidas depois de investigação e confirmação seguindo, uma a uma, o mesmo critério: existe outro fluxo que já faz a mesma coisa hoje?

---

## 9. Possíveis melhorias futuras (fora do escopo até agora)

- **Consolidar as 3 implementações de `formatCPF`** (achado nesta última rodada, ainda sem decisão).
- 7 arquivos passam de 400 linhas (`OrganizerConfigPage.jsx` com 785 é o maior) — não é um problema por si só, mas são candidatos a divisão futura se ficarem difíceis de manter.
- Confirmar via `npm install && npm run lint && npm run build` locais que nada quebrou — pedido repetido em cada etapa, ainda não confirmado por vocês.
- Considerar mover os 9 relatórios `.md` que se acumularam na raiz do projeto (incluindo este) para uma pasta tipo `docs/refatoracao/`, já que documentam um processo específico e não são documentação permanente do produto — sugestão, não fiz sozinho porque não foi pedido.

---

## 10. Validação final

A cada etapa, sem exceção, reexecutei a análise estática de grafo de imports antes de considerar a etapa concluída — nunca avancei com um import quebrado pendente. O que **não** consegui fazer pela ponte remota, do início ao fim: um `npm install` completo (o `node_modules` estourava o tempo limite e ficava em estado parcial; hoje o projeto está sem `node_modules`, como um clone limpo) e, por consequência, `npm run lint`/`npm run build` de verdade. Essa é a única etapa que falta pra fechar com 100% de certeza:

```
npm install
npm run lint
npm run build
```

Se algo aparecer, me mandem a saída — a expectativa, com base em tudo que verifiquei estaticamente arquivo por arquivo, é que não apareça nada.
