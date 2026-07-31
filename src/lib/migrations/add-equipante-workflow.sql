CREATE TABLE IF NOT EXISTS equipante_workflow_status (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    equipante_id uuid REFERENCES public.equipantes(id) ON DELETE CASCADE,
    age_group text CHECK (age_group IN ('minor', 'adult')),
    current_stage text,
    parental_auth_file_url text,
    parental_auth_uploaded_at timestamp with time zone,
    pastoral_auth_status text DEFAULT 'pendente',
    scale_status text DEFAULT 'pendente',
    payment_status text DEFAULT 'pendente',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_equipante_workflow_equipante_id ON equipante_workflow_status(equipante_id);
CREATE INDEX IF NOT EXISTS idx_equipante_workflow_current_stage ON equipante_workflow_status(current_stage);

ALTER TABLE equipante_workflow_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on equipante_workflow_status"
    ON equipante_workflow_status FOR ALL USING (true);

CREATE OR REPLACE FUNCTION update_workflow_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_equipante_workflow_updated_at ON equipante_workflow_status;
CREATE TRIGGER update_equipante_workflow_updated_at
    BEFORE UPDATE ON equipante_workflow_status
    FOR EACH ROW
    EXECUTE FUNCTION update_workflow_updated_at_column();

INSERT INTO storage.buckets (id, name, public) 
VALUES ('equipante-authorizations', 'equipante-authorizations', true) 
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public Access" 
ON storage.objects FOR ALL 
USING (bucket_id = 'equipante-authorizations');