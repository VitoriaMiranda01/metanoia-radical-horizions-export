-- Add payment and edition tracking columns to 'equipantes' table
ALTER TABLE equipantes 
ADD COLUMN IF NOT EXISTS status_pagamento TEXT DEFAULT 'pendente',
ADD COLUMN IF NOT EXISTS data_pagamento TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS metodo_pagamento TEXT,
ADD COLUMN IF NOT EXISTS id_transacao_sicoob TEXT,
ADD COLUMN IF NOT EXISTS numero_edicao INTEGER;

-- Add payment and edition tracking columns to 'acampantes' table
ALTER TABLE acampantes 
ADD COLUMN IF NOT EXISTS status_pagamento TEXT DEFAULT 'pendente',
ADD COLUMN IF NOT EXISTS data_pagamento TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS metodo_pagamento TEXT,
ADD COLUMN IF NOT EXISTS id_transacao_sicoob TEXT,
ADD COLUMN IF NOT EXISTS numero_edicao INTEGER;

-- Create indexes for performance on frequent lookups
CREATE INDEX IF NOT EXISTS idx_equipantes_cpf_edicao ON equipantes(cpf, numero_edicao);
CREATE INDEX IF NOT EXISTS idx_acampantes_cpf_edicao ON acampantes(cpf, numero_edicao);

-- Comments for documentation
COMMENT ON COLUMN equipantes.status_pagamento IS 'Status of payment: pendente, processando, pago, cancelado';
COMMENT ON COLUMN acampantes.status_pagamento IS 'Status of payment: pendente, processando, pago, cancelado';