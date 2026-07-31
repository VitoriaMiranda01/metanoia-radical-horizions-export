-- Migration: Create missing tables and add missing columns
-- Date: 2026-02-11

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create 'users' table if it doesn't exist
CREATE TABLE IF NOT EXISTS users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT,
  role TEXT DEFAULT 'user', -- 'admin', 'organizer', 'user'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Create 'inscricoes' table if it doesn't exist
CREATE TABLE IF NOT EXISTS inscricoes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'pendente',
  tipo TEXT, -- 'equipante' or 'acampante'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Create 'configuracoes_inscricoes' table if it doesn't exist
CREATE TABLE IF NOT EXISTS configuracoes_inscricoes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  inscricoes_equipantes BOOLEAN DEFAULT true,
  inscricoes_acampantes BOOLEAN DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Create 'limites_areas' table if it doesn't exist
CREATE TABLE IF NOT EXISTS limites_areas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  area_nome TEXT NOT NULL UNIQUE,
  limite_maximo INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 5. Create 'escalas' table if it doesn't exist
CREATE TABLE IF NOT EXISTS escalas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  equipante_id UUID, -- Loose reference to allow flexibility if equipantes table is rebuilt
  equipante_nome TEXT,
  area_alocada TEXT,
  is_manual BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 6. Update 'configuracoes' table
-- Ensure table exists first (it might be missing entirely)
CREATE TABLE IF NOT EXISTS configuracoes (
  id INTEGER PRIMARY KEY DEFAULT 1,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Add columns if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='configuracoes' AND column_name='numero_edicao') THEN
        ALTER TABLE configuracoes ADD COLUMN numero_edicao INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='configuracoes' AND column_name='max_equipantes') THEN
        ALTER TABLE configuracoes ADD COLUMN max_equipantes INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='configuracoes' AND column_name='max_acampantes') THEN
        ALTER TABLE configuracoes ADD COLUMN max_acampantes INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='configuracoes' AND column_name='observacoes') THEN
        ALTER TABLE configuracoes ADD COLUMN observacoes TEXT DEFAULT '';
    END IF;
END $$;

-- 7. Update 'acampantes' table
-- Add 'nome_completo' as an alias/alternative to 'nome' if needed, or ensure 'nome' is used.
-- The requirement asks for 'nome_completo'. We will add it and sync it with 'nome' via trigger or application logic.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='acampantes' AND column_name='nome_completo') THEN
        ALTER TABLE acampantes ADD COLUMN nome_completo TEXT;
        -- Optional: Backfill data
        -- UPDATE acampantes SET nome_completo = nome WHERE nome_completo IS NULL;
    END IF;
END $$;

-- 8. Update 'equipantes' table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='equipantes' AND column_name='nome_completo') THEN
        ALTER TABLE equipantes ADD COLUMN nome_completo TEXT;
        -- Optional: Backfill data
        -- UPDATE equipantes SET nome_completo = nome WHERE nome_completo IS NULL;
    END IF;
END $$;

-- Enable RLS on new tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE inscricoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracoes_inscricoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE limites_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalas ENABLE ROW LEVEL SECURITY;

-- Create basic policies (Permissive for development/prototype phase, tighten for production)
-- Users
CREATE POLICY "Users read own" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own" ON users FOR UPDATE USING (auth.uid() = id);

-- Inscricoes
CREATE POLICY "Users read own inscricoes" ON inscricoes FOR SELECT USING (auth.uid() = user_id);

-- Configs (Public Read, Admin Write)
CREATE POLICY "Public read config_insc" ON configuracoes_inscricoes FOR SELECT USING (true);
CREATE POLICY "Admin write config_insc" ON configuracoes_inscricoes FOR ALL USING (true); -- Needs admin check in real app

-- Limites (Public Read, Admin Write)
CREATE POLICY "Public read limites" ON limites_areas FOR SELECT USING (true);
CREATE POLICY "Admin write limites" ON limites_areas FOR ALL USING (true);

-- Escalas (Public Read, Admin Write)
CREATE POLICY "Public read escalas" ON escalas FOR SELECT USING (true);
CREATE POLICY "Admin write escalas" ON escalas FOR ALL USING (true);