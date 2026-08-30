# Metanoia Radical - Serra

Sistema de inscrição, aprovação e gestão de participantes (acampantes e equipantes) do projeto Metanoia Radical Serra. Frontend em React, com backend próprio (repositório separado) responsável pela emissão de cobranças PIX via Sicoob.

## Stack

- [React 18](https://react.dev/) + [Vite 7](https://vitejs.dev/)
- [React Router 6](https://reactrouter.com/)
- [Supabase](https://supabase.com/) (banco de dados, autenticação e realtime)
- [Tailwind CSS](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/) / [shadcn/ui](https://ui.shadcn.com/)
- [Framer Motion](https://www.framer.com/motion/)

## Pré-requisitos

- Node.js 22 (versão fixada em `.nvmrc`)
- Acesso a um projeto Supabase (URL + chave anônima)

## Configuração

1. Clone o repositório e instale as dependências:
   ```bash
   npm install
   ```
2. Crie um arquivo `.env` na raiz com as variáveis abaixo (nenhuma delas é versionada, veja `.gitignore`):
   ```env
   VITE_SUPABASE_URL=
   VITE_SUPABASE_ANON_KEY=
   VITE_SICOOB_API_URL=
   VITE_PAYMENT_TIMEOUT_MINUTES=
   ```
3. Rode o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

## Scripts disponíveis

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe o servidor de desenvolvimento (Vite) na porta 3000 |
| `npm run build` | Gera `public/llms.txt` e cria o build de produção em `dist/` |
| `npm run preview` | Serve o build de produção localmente |
| `npm run lint` | Roda o ESLint no projeto |

## Estrutura do projeto

```
src/
├── pages/            # Uma página por rota (App.jsx)
├── components/
│   ├── ui/            # Primitivos shadcn/ui
│   ├── route-guards/  # Guards de rota (autenticação/autorização)
│   ├── common/        # Componentes usados em mais de um domínio
│   └── {aprovacoes,equipante,gerenciar,inscricao,landing,organizer,payment,scales}/
├── services/          # Toda chamada ao Supabase mora aqui (nenhuma tela chama o Supabase direto)
├── utils/             # Lógica pura (validação, formatação, exportação), sem I/O
├── hooks/              # Hooks React reutilizáveis
├── contexts/           # AuthContext (autenticação)
├── constants/           # Constantes e mapeamento de schema
└── lib/utils.js         # Só o cn() do shadcn/ui (alias fixo em components.json)

database/               # Scripts SQL de setup e migrações (fora do bundle da aplicação)
dev-tools/               # Plugins do Vite (editor visual, etc.) e scripts auxiliares de build
```

A camada `services/` é dividida por responsabilidade (ex.: `organizerConfigService.js`, `scalesService.js`, `inscricoesStatusService.js`) em vez de um único arquivo genérico — cada serviço concentra as chamadas ao Supabase de uma área específica do sistema.

## Pagamento

O sistema emite cobranças exclusivamente via **PIX**, através de um backend próprio (repositório separado, não incluído aqui) que se integra com o Sicoob. Não há emissão de boleto bancário.

## Histórico de refatoração

Este projeto passou por uma refatoração completa de organização de código (sem alteração de regras de negócio, schema de banco ou comportamento de tela). O relatório detalhado de tudo que foi removido, movido, criado e refatorado está em [`RELATORIO_FINAL_CONSOLIDADO.md`](./RELATORIO_FINAL_CONSOLIDADO.md).
