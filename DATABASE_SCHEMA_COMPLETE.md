# Complete Database Schema Analysis & Migration Report

## 1. Executive Summary

This document provides a comprehensive analysis of the database schema required for the Metanoia Radical application. The schema has been derived by scanning the entire codebase for data access patterns, form submissions, and API calls.

**Key Findings:**
- The application requires **8 core tables**: `configuracoes`, `inscricoes_status`, `users`, `equipantes`, `acampantes`, `limites_areas`, `escalas`, and `payment_info`.
- Tables `equipantes` and `acampantes` share many common fields but have specific divergences (e.g., work areas for equipantes, referral info for acampantes).
- Several fields have aliases in the frontend code (e.g., `sexo` vs `genero`, `tamanho_camisa` vs `tamanho_camiseta`). The schema includes columns for the primary names and ensures compatibility.
- Payment integration requires specific transaction fields (`id_transacao_stripe`, `id_transacao_sicoob`) on participant tables.

---

## 2. Table Structures

### 2.1 Core Configuration
**Table:** `configuracoes`
| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGINT (PK) | Singleton ID (usually 1) |
| `max_equipantes` | INTEGER | Maximum allowed equipantes |
| `max_acampantes` | INTEGER | Maximum allowed acampantes |
| `edicao_numero` | INTEGER | Current edition number |
| `observacoes` | TEXT | General notes |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

**Table:** `inscricoes_status`
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Unique ID |
| `inscricoes_equipantes` | BOOLEAN | Open/Closed toggle |
| `inscricoes_acampantes` | BOOLEAN | Open/Closed toggle |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

### 2.2 Users & Authentication
**Table:** `users`
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | References `auth.users(id)` |
| `email` | TEXT | User email |
| `role` | TEXT | 'organizador', 'equipante', 'acampante', 'parceiro' |
| `created_at` | TIMESTAMPTZ | Registration timestamp |

### 2.3 Participants (Equipantes)
**Table:** `equipantes`
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Unique ID |
| `status` | TEXT | 'pendente', 'aprovado', 'rejeitado' |
| `tipo` | TEXT | Default 'equipante' |
| `numero_edicao` | INTEGER | Edition number |
| `nome`, `nome_completo` | TEXT | Name variations |
| `cpf` | TEXT | Unique identifier (Indexed) |
| `email`, `whatsapp` | TEXT | Contact info |
| `data_nascimento` | DATE | Birth date |
| `sexo`, `genero` | TEXT | Gender variations |
| `area_trabalho_opcao1..3` | TEXT | Work preferences |
| `status_pagamento` | TEXT | Payment status |
| ... | ... | (See SQL for full list) |

### 2.4 Participants (Acampantes)
**Table:** `acampantes`
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Unique ID |
| `status` | TEXT | 'aprovado', 'confirmado' |
| `tipo` | TEXT | Default 'acampante' |
| `numero_edicao` | INTEGER | Edition number |
| `cpf` | TEXT | Unique identifier (Indexed) |
| `admin_responsavel` | TEXT | Referral/Admin link |
| `quem_indicou_nome` | TEXT | Referral name |
| ... | ... | (See SQL for full list) |

### 2.5 Organization & Logistics
**Table:** `limites_areas`
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Unique ID |
| `area_nome` | TEXT | Name of work area |
| `limite_maximo` | INTEGER | Max capacity |

**Table:** `escalas`
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Unique ID |
| `equipante_id` | UUID | References `equipantes(id)` |
| `area_alocada` | TEXT | Assigned area |
| `is_manual` | BOOLEAN | Was manually assigned |

**Table:** `payment_info`
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Unique ID |
| `inscription_id` | UUID | Linked participant ID |
| `amount` | DECIMAL | Transaction amount |
| `status` | TEXT | Payment status |

---

## 3. Relationships
- `users.id` -> `auth.users.id` (1:1)
- `escalas.equipante_id` -> `equipantes.id` (1:1)
- `payment_info.user_id` -> `auth.users.id` (Optional)

---

## 4. Definitive SQL Script
Copy and run the following SQL script in your Supabase SQL Editor. It is idempotent (safe to run multiple times).