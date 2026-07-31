-- Migration to ensure 'equipantes' table has specific fields for auto-fill and allocation
-- Run this in Supabase SQL Editor

-- 1. Ensure columns exist for work areas (text based)
ALTER TABLE equipantes ADD COLUMN IF NOT EXISTS area_trabalho_opcao1 VARCHAR(100);
ALTER TABLE equipantes ADD COLUMN IF NOT EXISTS area_trabalho_opcao2 VARCHAR(100);
ALTER TABLE equipantes ADD COLUMN IF NOT EXISTS area_trabalho_opcao3 VARCHAR(100);
ALTER TABLE equipantes ADD COLUMN IF NOT EXISTS area_trabalho_extra TEXT;

-- 2. Ensure basic personal fields exist (if not already present from previous migrations)
ALTER TABLE equipantes ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(20);
ALTER TABLE equipantes ADD COLUMN IF NOT EXISTS tamanho_camisa VARCHAR(10);
ALTER TABLE equipantes ADD COLUMN IF NOT EXISTS igreja VARCHAR(255);

-- 3. Create index on CPF for faster lookup
CREATE INDEX IF NOT EXISTS idx_equipantes_cpf ON equipantes(cpf);

-- 4. Create index on created_at for retrieving most recent record efficiently
CREATE INDEX IF NOT EXISTS idx_equipantes_created_at ON equipantes(created_at);

-- Comments
COMMENT ON COLUMN equipantes.area_trabalho_opcao1 IS 'Primary choice for work area';
COMMENT ON COLUMN equipantes.area_trabalho_opcao2 IS 'Secondary choice for work area';
COMMENT ON COLUMN equipantes.area_trabalho_opcao3 IS 'Tertiary choice for work area';