-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- Tabela de Equipantes (Staff/Voluntários)
-- ==========================================
CREATE TABLE IF NOT EXISTS equipantes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  user_id TEXT, -- Pode ser UUID se autenticado via Supabase Auth ou string se externo
  status TEXT DEFAULT 'pendente', -- pendente, aprovada, rejeitada, lista_espera
  tipo TEXT DEFAULT 'equipante',
  
  -- Dados Pessoais
  nome TEXT NOT NULL,
  cpf TEXT NOT NULL,
  data_nascimento DATE,
  sexo TEXT,
  estado_civil TEXT,
  profissao TEXT,
  tamanho_camisa TEXT,
  email TEXT,
  whatsapp TEXT,
  telefone_residencial TEXT,
  idade INTEGER,
  
  -- Endereço
  cep TEXT,
  endereco TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT,
  
  -- Saúde
  tem_problema_saude BOOLEAN DEFAULT false,
  condicoes_medicas TEXT,
  usa_medicamento BOOLEAN DEFAULT false,
  medicamentos TEXT,
  tem_restricao_alimentar BOOLEAN DEFAULT false,
  restricoes_alimentares TEXT,
  vacina_covid TEXT,
  esta_gravida BOOLEAN DEFAULT false,
  
  -- Eclesiásticos
  igreja TEXT,
  e_pastor BOOLEAN DEFAULT false,
  e_pastor_outro TEXT,
  pastor_nome TEXT,
  esta_afastado BOOLEAN DEFAULT false,
  cargo_igreja TEXT,
  cargo_igreja_outro TEXT,
  frequenta_ebd BOOLEAN DEFAULT false,
  voce_canta BOOLEAN DEFAULT false,
  toca_instrumento BOOLEAN DEFAULT false,
  
  -- Dados Específicos Equipante
  familiar_trabalhando BOOLEAN DEFAULT false,
  familiar_trabalhando_outro TEXT,
  parentesco TEXT,
  familiar_nome TEXT,
  qual_radical_acampante TEXT,
  qual_radical_acampante_outro TEXT,
  numero_edicao_participou TEXT,
  ja_trabalhou_equipe BOOLEAN DEFAULT false,
  edicao_trabalhou TEXT,
  deseja_trabalhar_edicao TEXT,
  autorizacao_imagem BOOLEAN DEFAULT false,
  
  -- Contato Emergência
  contato_emergencia_nome TEXT,
  contato_emergencia_telefone TEXT,
  
  -- Áreas de Trabalho
  area_trabalho_opcao1 TEXT,
  area_trabalho_opcao2 TEXT,
  area_trabalho_opcao3 TEXT,
  area_trabalho_extra TEXT,
  
  -- Pagamento
  forma_pagamento TEXT,
  pagamento_dinheiro_descricao TEXT,
  
  -- Termos
  termo_covid_aceito BOOLEAN DEFAULT false,
  data_aceite_covid TIMESTAMP WITH TIME ZONE
);

-- Habilitar Row Level Security (RLS) para Equipantes
ALTER TABLE equipantes ENABLE ROW LEVEL SECURITY;

-- Políticas Equipantes
CREATE POLICY "Equipantes podem ver suas proprias inscricoes" 
ON equipantes FOR SELECT 
USING (auth.uid()::text = user_id OR email = auth.jwt() ->> 'email');

CREATE POLICY "Organizadores podem ver tudo equipantes" 
ON equipantes FOR ALL 
USING (true);

-- Índices Equipantes
CREATE INDEX IF NOT EXISTS idx_equipantes_cpf ON equipantes(cpf);
CREATE INDEX IF NOT EXISTS idx_equipantes_status ON equipantes(status);

-- ==========================================
-- Tabela de Acampantes (Participantes)
-- ==========================================
CREATE TABLE IF NOT EXISTS acampantes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  user_id UUID REFERENCES auth.users(id), -- Link direto para auth.users se possível, ou TEXT se misto
  status TEXT DEFAULT 'pendente', -- pendente, aprovado, rejeitado
  tipo TEXT DEFAULT 'acampante',
  
  -- Dados Pessoais
  nome TEXT NOT NULL,
  cpf TEXT UNIQUE,
  email TEXT,
  whatsapp TEXT,
  data_nascimento DATE,
  genero TEXT,
  estado_civil TEXT,
  profissao TEXT,
  tamanho_camisa TEXT,
  idade INTEGER,
  
  -- Campos Específicos Solicitados
  areas_interesse TEXT[], -- Array de texto
  experiencia_anterior TEXT,
  motivacao TEXT,
  disponibilidade TEXT,

  -- Endereço (Necessário para a ficha)
  cep TEXT,
  endereco TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT,

  -- Saúde (Necessário para a ficha)
  tem_problema_saude BOOLEAN DEFAULT false,
  condicoes_medicas TEXT,
  usa_medicamento BOOLEAN DEFAULT false,
  medicamentos TEXT,
  tem_restricao_alimentar BOOLEAN DEFAULT false,
  restricoes_alimentares TEXT,
  vacina_covid TEXT,
  esta_gravida BOOLEAN DEFAULT false,

  -- Eclesiásticos & Outros
  igreja TEXT,
  pastor_nome TEXT,
  
  -- Administrativo / Indicação
  admin_responsavel TEXT,
  codigo_admin TEXT,
  quem_indicou_nome TEXT,
  quem_indicou_telefone TEXT,
  
  -- Contato Emergência
  contato_emergencia_nome TEXT,
  contato_emergencia_telefone TEXT,
  
  -- Pagamento e Termos
  forma_pagamento TEXT,
  autorizacao_imagem BOOLEAN DEFAULT false,
  termo_responsabilidade_aceito BOOLEAN DEFAULT false
);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now(); 
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_acampantes_updated_at
BEFORE UPDATE ON acampantes
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Habilitar Row Level Security (RLS) para Acampantes
ALTER TABLE acampantes ENABLE ROW LEVEL SECURITY;

-- Políticas Acampantes
CREATE POLICY "Usuarios podem ver seus proprios registros" 
ON acampantes FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Usuarios podem editar seus proprios registros" 
ON acampantes FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Usuarios podem deletar seus proprios registros" 
ON acampantes FOR DELETE 
USING (auth.uid() = user_id);

CREATE POLICY "Usuarios podem inserir seus proprios registros" 
ON acampantes FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Política para Admins (Acesso Total)
CREATE POLICY "Organizadores podem gerenciar acampantes" 
ON acampantes FOR ALL 
USING (true); 

-- Índices Acampantes
CREATE INDEX IF NOT EXISTS idx_acampantes_user_id ON acampantes(user_id);
CREATE INDEX IF NOT EXISTS idx_acampantes_status ON acampantes(status);
CREATE INDEX IF NOT EXISTS idx_acampantes_cpf ON acampantes(cpf);
CREATE INDEX IF NOT EXISTS idx_acampantes_email ON acampantes(email);

-- ==========================================
-- Tabela de Configurações Gerais
-- ==========================================
CREATE TABLE IF NOT EXISTS configuracoes (
  id INTEGER PRIMARY KEY DEFAULT 1, -- Singleton row
  max_equipantes INTEGER DEFAULT 0,
  max_acampantes INTEGER DEFAULT 0,
  numero_edicao INTEGER DEFAULT 0,
  data_inicio DATE,
  data_fim DATE,
  valor_inscricao DECIMAL(10,2),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for configuracoes" 
ON configuracoes FOR SELECT 
USING (true);

CREATE POLICY "Admin write access for configuracoes" 
ON configuracoes FOR ALL 
USING (true);

-- ==========================================
-- Tabela de Configurações de Inscrições
-- ==========================================
CREATE TABLE IF NOT EXISTS configuracoes_inscricoes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  inscricoes_equipantes BOOLEAN DEFAULT true,
  inscricoes_acampantes BOOLEAN DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE configuracoes_inscricoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for configuracoes_inscricoes" 
ON configuracoes_inscricoes FOR SELECT 
USING (true);

CREATE POLICY "Admin write access for configuracoes_inscricoes" 
ON configuracoes_inscricoes FOR ALL 
USING (true);

-- ==========================================
-- Tabela de Usuários (Profiles)
-- ==========================================
CREATE TABLE IF NOT EXISTS users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT,
  role TEXT DEFAULT 'user', -- 'admin', 'organizer', 'user'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile" 
ON users FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
ON users FOR UPDATE 
USING (auth.uid() = id);

CREATE POLICY "Admins can read all profiles" 
ON users FOR SELECT 
USING (true); -- Adjust for real admin check

-- ==========================================
-- Tabela de Escalas (Alocações)
-- ==========================================
CREATE TABLE IF NOT EXISTS escalas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  equipante_id UUID REFERENCES equipantes(id),
  equipante_nome TEXT,
  area_alocada TEXT,
  is_manual BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE escalas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for escalas" 
ON escalas FOR SELECT 
USING (true);

CREATE POLICY "Admin write access for escalas" 
ON escalas FOR ALL 
USING (true);

-- ==========================================
-- Tabela de Limites de Áreas
-- ==========================================
CREATE TABLE IF NOT EXISTS limites_areas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  area_nome TEXT NOT NULL UNIQUE,
  limite_maximo INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE limites_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for limites_areas" 
ON limites_areas FOR SELECT 
USING (true);

CREATE POLICY "Admin write access for limites_areas" 
ON limites_areas FOR ALL 
USING (true);