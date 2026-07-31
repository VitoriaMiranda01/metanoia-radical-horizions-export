# Documentação de Requisitos e Arquitetura - Metanoia Radical

## 1. INTRODUÇÃO
* **Nome do Sistema:** Metanoia Radical
* **Objetivo:** Sistema integrado de inscrições para o acampamento Metanoia Radical, englobando o fluxo de ponta a ponta: landing page, registro de participantes (Acampantes e Equipantes), gestão de pagamentos, alocação de equipes, painel gerencial e sistema de aprovações.
* **Versão:** Atual (Migrado para integração Sicoob, Stripe removido)
* **Data:** 2026-03-02
* **Público-alvo:** Desenvolvedores, Engenheiros de Software, Arquitetos de Soluções e Stakeholders (Organizadores do Evento).

---

## 2. VISÃO GERAL DO SISTEMA
O sistema Metanoia Radical foi projetado para digitalizar e otimizar todo o processo de triagem e gestão do acampamento religioso. A plataforma oferece uma interface pública atrativa (Landing Page) que direciona os usuários para dois fluxos distintos de inscrição: **Acampante** (participante do evento) e **Equipante** (voluntário de trabalho).

### Principais Módulos:
1. **Página Inicial (Landing Page):** Apresentação do evento, FAQs e links de acesso.
2. **Módulo de Inscrições:** Formulários multi-etapas dinâmicos com busca automática de CPF para retorno de dados (Equipantes).
3. **Módulo de Pagamento:** Integração com Sicoob para transações via PIX (QR Code) e Boleto Bancário.
4. **Painel do Organizador:** Gestão de inscritos, exportação de dados, relatórios e definição de Grupos de Trilha.
5. **Módulo de Aprovações:** Fluxo de triagem para aprovar ou rejeitar voluntários (Equipantes).
6. **Módulo de Escalas:** Algoritmo automático de distribuição de equipantes em áreas de trabalho baseado em limites de vagas e preferências.
7. **Configurações:** Controle de abertura/fechamento de inscrições, valores e metadados da edição.

### Atores do Sistema:
* **Usuário Anônimo:** Acessa a página inicial e inicia o fluxo de inscrição.
* **Acampante:** Realiza inscrição para participar do evento e efetua pagamento.
* **Equipante:** Realiza inscrição para servir, escolhe áreas de atuação, efetua pagamento e aguarda aprovação.
* **Organizador:** Acesso administrativo total. Gerencia cadastros, gera escalas e configura o sistema.
* **Aprovador (organizador-aprovador):** Acesso limitado à tela de aprovações.
* **Parceiro:** Visualiza inscrições pertinentes a grupos parceiros.

---

## 3. ARQUITETURA

### Stack Tecnológico
* **Frontend:** React 18.2.0, Vite
* **Roteamento:** React Router v6
* **Estilização:** Tailwind CSS 3.3, Radix UI, Framer Motion (Animações), Lucide React (Ícones)
* **Backend as a Service (BaaS):** Supabase (PostgreSQL para Banco de Dados e Authentication para gestão de identidade)
* **Pagamentos:** Integração Backend customizada via API REST com Sicoob (PIX e Boleto).

### Estrutura de Pastas