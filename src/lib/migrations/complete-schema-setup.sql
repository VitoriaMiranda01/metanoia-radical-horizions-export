/*
 * =================================================================================
 * COMPLETE DATABASE SCHEMA MIGRATION SCRIPT (IDEMPOTENT)
 * =================================================================================
 * 
 * INSTRUCTIONS:
 * 1. Go to your Supabase project dashboard.
 * 2. Navigate to the "SQL Editor".
 * 3. Copy the entire content of this file.
 * 4. Paste it into a new query window in the SQL Editor.
 * 5. Click "Run" to execute the script.
 * 
 * This script is idempotent (it uses "IF NOT EXISTS"), which means it is safe to run
 * multiple times. It will create all necessary tables and add required RLS policies
 * for the Metanoia Radical application to function correctly.
 * 
 * =================================================================================
 */

-- ============================================================================
-- PRELIMINARY: Enable UUID extension if not already enabled
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLE 1: configuracoes - Global event configuration
-- Referenced in: organizerHelpers.js, OrganizerConfigPage.jsx
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.configuracoes (
    id BIGINT PRIMARY KEY DEFAULT 1,
    numero_edicao INTEGER NOT NULL DEFAULT 1,
    max_equipantes INTEGER NOT NULL DEFAULT 50,
    max_acampantes INTEGER NOT NULL DEFAULT 200,
    inscricoes_abertas BOOLEAN DEFAULT false,
    data_inicio DATE,
    data_fim DATE,
    observacoes TEXT, -- Missing field identified from organizerHelpers.js
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT single_row_check CHECK (id = 1)
);
COMMENT ON TABLE public.configuracoes IS 'Stores global settings for the current event edition. Enforces a single row.';

-- ============================================================================
-- TABLE 2: inscricoes_status - Controls registration open/close status
-- Referenced in: useInscricoesStatus.js, Acampante.jsx, Equipante.jsx
-- Note: Some helpers reference a combined 'configuracoes_inscricoes', this normalizes it.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.inscricoes_status (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    equipantes_abertos BOOLEAN DEFAULT false,
    acampantes_abertos BOOLEAN DEFAULT false,
    data_abertura_equipantes TIMESTAMP WITH TIME ZONE,
    data_fechamento_equipantes TIMESTAMP WITH TIME ZONE,
    data_abertura_acampantes TIMESTAMP WITH TIME ZONE,
    data_fechamento_acampantes TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
COMMENT ON TABLE public.inscricoes_status IS 'Manages the open/closed status for camper and staff registrations.';

-- ============================================================================
-- TABLE 3: limite_areas - Work area capacity limits
-- Referenced in: limiteAreasHelpers.js, OrganizerScalesPage.jsx
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.limite_areas (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    area_nome VARCHAR(100) NOT NULL UNIQUE,
    limite_maximo INTEGER NOT NULL DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
COMMENT ON TABLE public.limite_areas IS 'Defines the maximum capacity for each work area/team.';

-- ============================================================================
-- TABLE 4: pagamentos - Payment records
-- Referenced in: paymentHelpers.js, Acampante.jsx, Equipante.jsx
-- Note: Replaces 'payment_info' and aligns with form fields.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.pagamentos (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    user_id UUID, -- Can be null for offline registrations
    tipo_pagamento VARCHAR(50) NOT NULL, -- 'PIX', 'BOLETO', 'CARTAO'
    valor DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pendente', -- 'pendente', 'confirmado', 'falhou'
    transaction_id VARCHAR(255),
    pix_qr_code TEXT,
    boleto_codigo VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pagamentos_user_id ON public.pagamentos(user_id);
COMMENT ON TABLE public.pagamentos IS 'Stores payment transaction details for all registrations.';

-- ============================================================================
-- TABLE 5: acampantes - Camper registrations
-- Referenced in: acampanteHelpers.js, GerenciarInscricoes.jsx, Acampante.jsx
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.acampantes (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    nome_completo VARCHAR(255) NOT NULL,
    data_nascimento DATE,
    cpf VARCHAR(14) UNIQUE NOT NULL,
    genero VARCHAR(50),
    email VARCHAR(255),
    telefone VARCHAR(20),
    whatsapp VARCHAR(20), -- Added from helper analysis
    cep VARCHAR(10),
    endereco VARCHAR(255),
    numero VARCHAR(10),
    complemento VARCHAR(255),
    bairro VARCHAR(100),
    cidade VARCHAR(100),
    estado VARCHAR(2),
    nome_responsavel VARCHAR(255),
    telefone_responsavel VARCHAR(20),
    email_responsavel VARCHAR(255),
    contato_emergencia_nome VARCHAR(255),
    contato_emergencia_telefone VARCHAR(20),
    contato_emergencia_parentesco VARCHAR(100),
    nome_igreja VARCHAR(255),
    igreja VARCHAR(255), -- Alias found in helpers
    pastor_responsavel VARCHAR(255),
    pastor VARCHAR(255), -- Alias found in helpers
    telefone_pastor VARCHAR(20),
    grupo_trailha VARCHAR(50),
    tamanho_camisa VARCHAR(10), -- Corrected from 'tamanho_camiseta'
    alergias TEXT,
    medicamentos TEXT,
    restricoes_alimentares TEXT,
    necessidades_especiais TEXT,
    quem_indicou_nome VARCHAR(255), -- Corrected from 'quem_indicou'
    admin_responsavel VARCHAR(100), -- From form analysis
    status_inscricao VARCHAR(50) DEFAULT 'pendente',
    status_pagamento VARCHAR(50) DEFAULT 'pendente',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_acampantes_user_id ON public.acampantes(user_id);
CREATE INDEX IF NOT EXISTS idx_acampantes_cpf ON public.acampantes(cpf);
CREATE INDEX IF NOT EXISTS idx_acampantes_status ON public.acampantes(status_inscricao);
COMMENT ON TABLE public.acampantes IS 'Main table for storing camper registration data.';

-- ============================================================================
-- TABLE 6: equipantes - Staff/volunteer registrations
-- Referenced in: equipanteHelpers.js, ApprovalsView.jsx, Equipante.jsx
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.equipantes (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    nome_completo VARCHAR(255) NOT NULL,
    nome VARCHAR(255), -- Alias field
    data_nascimento DATE,
    cpf VARCHAR(14) UNIQUE NOT NULL,
    genero VARCHAR(50),
    sexo VARCHAR(50), -- Alias found in helpers
    email VARCHAR(255),
    telefone VARCHAR(20),
    whatsapp VARCHAR(20), -- Added from helper analysis
    cep VARCHAR(10),
    endereco VARCHAR(255),
    numero VARCHAR(10),
    complemento VARCHAR(255),
    bairro VARCHAR(100),
    cidade VARCHAR(100),
    estado VARCHAR(2),
    nome_igreja VARCHAR(255),
    igreja VARCHAR(255), -- Alias
    pastor_responsavel VARCHAR(255),
    pastor_nome VARCHAR(255), -- Alias from ApprovalsView
    telefone_pastor VARCHAR(20),
    tamanho_camisa VARCHAR(10),
    alergias TEXT,
    medicamentos TEXT,
    restricoes_alimentares TEXT,
    necessidades_especiais TEXT,
    experiencia_anterior TEXT,
    motivacao TEXT,
    area_trabalho_opcao1 TEXT, -- From form analysis
    area_trabalho_opcao2 TEXT, -- From form analysis
    area_trabalho_opcao3 TEXT, -- From form analysis
    ja_trabalhou_equipe BOOLEAN, -- From form analysis
    edicao_trabalhou TEXT, -- From form analysis
    status VARCHAR(50) DEFAULT 'pendente', -- Legacy status field used in ApprovalsView
    status_inscricao VARCHAR(50) DEFAULT 'pendente',
    status_pagamento VARCHAR(50) DEFAULT 'pendente',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_equipantes_user_id ON public.equipantes(user_id);
CREATE INDEX IF NOT EXISTS idx_equipantes_cpf ON public.equipantes(cpf);
CREATE INDEX IF NOT EXISTS idx_equipantes_status ON public.equipantes(status);
COMMENT ON TABLE public.equipantes IS 'Main table for storing staff/volunteer registration data.';

-- ============================================================================
-- TABLE 7: escalas - Staff work schedule allocations
-- Referenced in: organizerHelpers.js, OrganizerScalesPage.jsx
-- Note: Replaces 'escalas_equipantes' for consistency.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.escalas (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    equipante_id BIGINT REFERENCES public.equipantes(id) ON DELETE CASCADE,
    equipante_nome TEXT, -- Denormalized for performance
    area_alocada VARCHAR(100) REFERENCES public.limite_areas(area_nome) ON DELETE RESTRICT,
    is_manual BOOLEAN DEFAULT false,
    turno VARCHAR(50), -- Added based on potential future use
    data_alocacao DATE, -- Added based on potential future use
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(equipante_id) -- An equipante can only be in one main area
);
CREATE INDEX IF NOT EXISTS idx_escalas_equipante_id ON public.escalas(equipante_id);
CREATE INDEX IF NOT EXISTS idx_escalas_area_alocada ON public.escalas(area_alocada);
COMMENT ON TABLE public.escalas IS 'Maps staff members to specific work areas. Replaces escalas_equipantes.';

-- ============================================================================
-- TABLE 8: organizadores - Event organizer accounts
-- Referenced in: useOrganizerAuth.js
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.organizadores (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    nome_completo VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    telefone VARCHAR(20),
    permissoes TEXT, -- JSON array: 'gerenciar_inscricoes', 'gerenciar_escalas', etc.
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_organizadores_user_id ON public.organizadores(user_id);
COMMENT ON TABLE public.organizadores IS 'Stores profiles and permissions for event organizers.';

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- Enable RLS for all tables
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inscricoes_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.limite_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acampantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizadores ENABLE ROW LEVEL SECURITY;

-- Create a helper function to check if a user is an organizer
CREATE OR REPLACE FUNCTION is_organizador(user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organizadores
    WHERE organizadores.user_id = is_organizador.user_id AND organizadores.ativo = true
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Public read-only policies for config tables
CREATE POLICY "Allow public read access to configs" ON public.configuracoes FOR SELECT USING (true);
CREATE POLICY "Allow public read access to inscricoes status" ON public.inscricoes_status FOR SELECT USING (true);

-- Organizer full-access policies
CREATE POLICY "Allow organizers full access to configs" ON public.configuracoes FOR ALL USING (is_organizador(auth.uid()));
CREATE POLICY "Allow organizers full access to inscricoes status" ON public.inscricoes_status FOR ALL USING (is_organizador(auth.uid()));
CREATE POLICY "Allow organizers full access to area limits" ON public.limite_areas FOR ALL USING (is_organizador(auth.uid()));
CREATE POLICY "Allow organizers full access to acampantes" ON public.acampantes FOR ALL USING (is_organizador(auth.uid()));
CREATE POLICY "Allow organizers full access to equipantes" ON public.equipantes FOR ALL USING (is_organizador(auth.uid()));
CREATE POLICY "Allow organizers full access to escalas" ON public.escalas FOR ALL USING (is_organizador(auth.uid()));
CREATE POLICY "Allow organizers to manage other organizers" ON public.organizadores FOR ALL USING (is_organizador(auth.uid()));

-- User-specific policies (self-service)
CREATE POLICY "Allow authenticated users to create their own registration" ON public.acampantes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Allow authenticated users to create their own staff registration" ON public.equipantes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Allow users to view their own acampante registration" ON public.acampantes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Allow users to view their own equipante registration" ON public.equipantes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Allow users to update their own registrations" ON public.acampantes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Allow users to update their own staff registrations" ON public.equipantes FOR UPDATE USING (auth.uid() = user_id);