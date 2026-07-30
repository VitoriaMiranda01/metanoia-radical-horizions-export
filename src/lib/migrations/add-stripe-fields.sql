-- Migration: Add Stripe fields and remove Sicoob fields
-- Note: PostgreSQL supports transactional DDL

-- Equipantes Table
ALTER TABLE equipantes 
ADD COLUMN IF NOT EXISTS id_transacao_stripe TEXT,
ADD COLUMN IF NOT EXISTS metodo_pagamento_stripe TEXT;

-- Acampantes Table
ALTER TABLE acampantes 
ADD COLUMN IF NOT EXISTS id_transacao_stripe TEXT,
ADD COLUMN IF NOT EXISTS metodo_pagamento_stripe TEXT;

-- Create Indexes for performance
CREATE INDEX IF NOT EXISTS idx_equipantes_id_transacao_stripe ON equipantes(id_transacao_stripe);
CREATE INDEX IF NOT EXISTS idx_acampantes_id_transacao_stripe ON acampantes(id_transacao_stripe);

-- Deprecate Sicoob Fields (Drop if they exist to clean up schema)
-- Using DO block to handle conditional dropping safely
DO $$
BEGIN
    -- Drop from equipantes
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'equipantes' AND column_name = 'txid_pix') THEN
        ALTER TABLE equipantes DROP COLUMN txid_pix;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'equipantes' AND column_name = 'nosso_numero_boleto') THEN
        ALTER TABLE equipantes DROP COLUMN nosso_numero_boleto;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'equipantes' AND column_name = 'codigo_barras_boleto') THEN
        ALTER TABLE equipantes DROP COLUMN codigo_barras_boleto;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'equipantes' AND column_name = 'data_vencimento_boleto') THEN
        ALTER TABLE equipantes DROP COLUMN data_vencimento_boleto;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'equipantes' AND column_name = 'id_transacao_sicoob') THEN
        ALTER TABLE equipantes DROP COLUMN id_transacao_sicoob;
    END IF;

    -- Drop from acampantes
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'acampantes' AND column_name = 'txid_pix') THEN
        ALTER TABLE acampantes DROP COLUMN txid_pix;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'acampantes' AND column_name = 'nosso_numero_boleto') THEN
        ALTER TABLE acampantes DROP COLUMN nosso_numero_boleto;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'acampantes' AND column_name = 'codigo_barras_boleto') THEN
        ALTER TABLE acampantes DROP COLUMN codigo_barras_boleto;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'acampantes' AND column_name = 'data_vencimento_boleto') THEN
        ALTER TABLE acampantes DROP COLUMN data_vencimento_boleto;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'acampantes' AND column_name = 'id_transacao_sicoob') THEN
        ALTER TABLE acampantes DROP COLUMN id_transacao_sicoob;
    END IF;
END $$;