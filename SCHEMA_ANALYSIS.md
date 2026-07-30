# Database Schema Analysis: `acampantes` and `equipantes` Tables

This document contains a comprehensive analysis of the database schema for the `acampantes` and `equipantes` tables, extracted directly from the system database.

## 1. Table: `acampantes`

### Columns and Data Types
- `id`: uuid (NOT NULL)
- `created_at`: timestamp with time zone (NOT NULL)
- `updated_at`: timestamp with time zone (NOT NULL)
- `status`: text
- `tipo`: text
- `full_name`: text
- `cpf`: text
- `telefone`: text
- `genero`: text
- `profissao`: text
- `tamanho_camisa`: text
- `idade`: integer
- `cep`: text
- `endereco`: text
- `numero`: text
- `complemento`: text
- `bairro`: text
- `cidade`: text
- `estado`: text
- `igreja`: text
- `pastor_nome`: text
- `quem_indicou_nome`: text
- `forma_pagamento`: text
- `status_pagamento`: text
- `data_pagamento`: timestamp with time zone
- `metodo_pagamento`: text
- `id_transacao_sicoob`: text
- `numero_edicao`: integer **(Edition/Event related)**
- `pastor`: text
- `sexo`: text
- `txid_pix`: text
- `nome_completo`: text
- `email`: text
- `estado_civil`: text
- `tem_problema_saude`: boolean
- `problemas_saude`: boolean
- `condicoes_medicas`: text
- `usa_medicamento`: boolean
- `usa_medicamentos`: boolean
- `tem_restricao_alimentar`: boolean
- `restricoes_alimentares`: text
- `esta_gravida`: boolean
- `admin_responsavel`: text
- `quem_indicou_telefone`: text
- `contato_emergencia_nome`: text
- `contato_emergencia_telefone`: text
- `autorizacao_imagem`: boolean
- `termo_responsabilidade_aceito`: boolean
- `user_id`: uuid
- `nome`: text
- `medicamentos`: text
- `whatsapp`: text
- `conhecido_no_projeto`: text
- `nome_familiar_conhecido`: text

### Relationships and Rules
- **Foreign Keys:** None
- **Row Level Security (RLS) Policies:** 
  - `CREATE POLICY "Pode tudo" ON acampantes FOR ALL USING (true)`
- **Triggers:**
  - `CREATE TRIGGER update_acampantes_updated_at BEFORE UPDATE ON acampantes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()`

---

## 2. Table: `equipantes`

### Columns and Data Types
- `id`: uuid (NOT NULL)
- `created_at`: timestamp with time zone (NOT NULL)
- `updated_at`: timestamp with time zone (NOT NULL)
- `status`: text
- `tipo`: text
- `full_name`: text (NOT NULL)
- `cpf`: text (NOT NULL)
- `sexo`: text
- `estado_civil`: text
- `profissao`: text
- `tamanho_camisa`: text
- `email`: text
- `whatsapp`: text
- `telefone_residencial`: text
- `idade`: integer
- `cep`: text
- `endereco`: text
- `numero`: text
- `complemento`: text
- `bairro`: text
- `cidade`: text
- `estado`: text
- `tem_problema_saude`: boolean
- `condicoes_medicas`: text
- `usa_medicamento`: boolean
- `medicamentos`: text
- `tem_restricao_alimentar`: boolean
- `restricoes_alimentares`: text
- `vacina_covid`: text
- `esta_gravida`: boolean
- `igreja`: text
- `e_pastor`: boolean
- `e_pastor_outro`: text
- `pastor_nome`: text
- `esta_afastado`: boolean
- `cargo_igreja`: text
- `cargo_igreja_outro`: text
- `frequenta_ebd`: boolean
- `voce_canta`: boolean
- `toca_instrumento`: boolean
- `familiar_trabalhando`: boolean
- `familiar_trabalhando_outro`: text
- `parentesco`: text
- `familiar_nome`: text
- `qual_radical_acampante`: text
- `qual_radical_acampante_outro`: text
- `numero_edicao_participou`: text **(Edition/Event related)**
- `ja_trabalhou_equipe`: boolean
- `edicao_trabalhou`: text **(Edition/Event related)**
- `deseja_trabalhar_edicao`: text **(Edition/Event related)**
- `autorizacao_imagem`: boolean
- `contato_emergencia_nome`: text
- `contato_emergencia_telefone`: text
- `area_trabalho_opcao1`: text
- `area_trabalho_opcao2`: text
- `area_trabalho_opcao3`: text
- `area_trabalho_extra`: text
- `forma_pagamento`: text
- `pagamento_dinheiro_descricao`: text
- `termo_covid_aceito`: boolean
- `data_aceite_covid`: timestamp with time zone
- `camisa`: text
- `status_pagamento`: text
- `data_pagamento`: timestamp with time zone
- `metodo_pagamento`: text
- `id_transacao_sicoob`: text
- `numero_edicao`: integer **(Edition/Event related)**
- `txid_pix`: text
- `nosso_numero_boleto`: text
- `codigo_barras_boleto`: text
- `data_vencimento_boleto`: date
- `nome`: text
- `nome_completo`: text
- `genero`: text
- `tamanho_camiseta`: text
- `telefone`: text
- `nome_igreja`: text
- `frequenta_grupo_cuidado`: boolean
- `experiencia_acampamento`: text
- `motivacao`: text
- `current_stage`: text
- `parental_auth_file_url`: text
- `parental_auth_uploaded_at`: timestamp with time zone
- `pastoral_auth_status`: text
- `scale_status`: text

### Relationships and Rules
- **Foreign Keys:** None
- **Row Level Security (RLS) Policies:**
  - `CREATE POLICY "Pode tudo" ON equipantes FOR ALL USING (true)`
- **Triggers:** None

---

## 3. Highlighted Edition/Event Related Fields

### `acampantes` Table
1. **`numero_edicao`** (integer): Stores the edition number of the event the acampante is registered for.

### `equipantes` Table
1. **`numero_edicao_participou`** (text): Indicates which previous edition the equipante participated in as an acampante.
2. **`edicao_trabalhou`** (text): Indicates which previous edition(s) the equipante worked at.
3. **`deseja_trabalhar_edicao`** (text): Indicates the specific edition they wish to work at now.
4. **`numero_edicao`** (integer): Tracks the actual edition number of their current registration (similar to the acampantes table).

---

## 4. Summary and Comparison

**Similarities:**
- Both tables contain a fundamental `numero_edicao` integer field to permanently associate the record with a specific event edition.
- Both tables share common policy structures allowing full access via the `"Pode tudo"` RLS policy.
- Both tables do not utilize strict foreign key constraints at the database level for the core entity relationships, relying on application logic.

**Differences:**
- The `equipantes` table has significantly more edition-related fields, primarily because team members (equipantes) have historical context (which editions they attended as participants `numero_edicao_participou`, which ones they previously worked at `edicao_trabalhou`, and their intentions `deseja_trabalhar_edicao`). 
- The `acampantes` table simply records the edition they are currently attending via `numero_edicao`.
- The historical fields in `equipantes` (`numero_edicao_participou`, `edicao_trabalhou`, `deseja_trabalhar_edicao`) are typed as `text`, allowing them to store multiple comma-separated values, whereas the current tracking field `numero_edicao` is strictly an `integer` in both tables.