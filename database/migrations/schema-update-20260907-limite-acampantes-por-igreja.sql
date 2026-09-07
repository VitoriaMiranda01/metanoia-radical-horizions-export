-- Migration: Limite de inscricoes de acampantes por igreja
-- Date: 2026-09-07
--
-- Contexto: pedido da usuaria (Vitoria) em 2026-09-07 -- organizadores
-- precisam poder limitar quantos acampantes cada igreja pode inscrever.
--
-- Regras de negocio combinadas com a usuaria:
--   1. Ha um limite padrao (geral, vale pra todas as igrejas que nao tem
--      excecao) e, opcionalmente, um limite especifico por igreja que
--      substitui o padrao pra aquela igreja.
--   2. Limite padrao NULL = sem controle nenhum pras igrejas sem excecao
--      configurada.
--   3. A contagem usada pro limite e o TOTAL de acampantes ja inscritos
--      daquela igreja (campo admin_responsavel = "Igreja Responsavel pela
--      Inscricao"), independente de status de pagamento -- toda inscricao
--      enviada ja ocupa a vaga da igreja.
--   4. Vale APENAS pro campo admin_responsavel (seletor fechado de 141
--      igrejas, IGREJAS_PARCEIRAS). O outro campo de igreja do acampante
--      ("igreja", texto livre, "Igreja que frequenta") nao tem nenhum
--      controle.
--   5. Concorrencia: cadastro de acampante e uma acao de pico (centenas de
--      pessoas podem se inscrever ao mesmo tempo), entao a checagem do
--      limite precisa ser garantida no banco, nao so no navegador -- senao
--      duas pessoas da mesma igreja podem passar da ultima vaga ao mesmo
--      tempo. Usamos um advisory lock do Postgres, no mesmo espirito do que
--      ja e feito pra alocacao de equipantes em areas de trabalho (ver
--      schema-update-20260831-alocacao-equipantes.sql), mas travando POR
--      IGREJA (hashtext do nome da igreja) em vez de travar globalmente --
--      cadastros de igrejas diferentes continuam acontecendo em paralelo,
--      sem se esperar.
--
-- Nao mexe em nenhuma coluna/tabela existente de forma destrutiva: so
-- adiciona uma coluna nova em configuracoes e uma tabela nova
-- (limites_igrejas, no mesmo formato de limites_areas).

-- 1) Limite padrao geral (coluna nova em configuracoes). NULL = sem limite
-- padrao (so as igrejas com excecao em limites_igrejas ficam limitadas).
ALTER TABLE configuracoes
  ADD COLUMN IF NOT EXISTS limite_acampantes_por_igreja INTEGER;

-- 2) Limites especificos por igreja (excecoes ao padrao). Uma linha por
-- igreja que precisa de um valor diferente do padrao geral.
CREATE TABLE IF NOT EXISTS limites_igrejas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  igreja TEXT NOT NULL UNIQUE,
  limite_maximo INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE limites_igrejas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for limites_igrejas"
ON limites_igrejas FOR SELECT
USING (true);

CREATE POLICY "Admin write access for limites_igrejas"
ON limites_igrejas FOR ALL
USING (true);

-- 3) Trava no banco: impede que um INSERT em acampantes ultrapasse o limite
-- da igreja, mesmo com cadastros simultaneos da mesma igreja (regra 5).
CREATE OR REPLACE FUNCTION public._acampantes_verificar_limite_igreja()
RETURNS TRIGGER AS $$
DECLARE
  v_limite INTEGER;
  v_ocupado INTEGER;
BEGIN
  -- So verifica quando a igreja responsavel esta preenchida -- nao e papel
  -- desta trava exigir o campo, so limitar quando ele existe.
  IF NEW.admin_responsavel IS NULL OR NEW.admin_responsavel = '' THEN
    RETURN NEW;
  END IF;

  -- Trava por igreja (nao globalmente): cadastros de igrejas diferentes
  -- continuam em paralelo, so cadastros da MESMA igreja esperam a vez.
  PERFORM pg_advisory_xact_lock(hashtext(NEW.admin_responsavel));

  SELECT limite_maximo INTO v_limite
    FROM limites_igrejas
    WHERE igreja = NEW.admin_responsavel;

  IF NOT FOUND THEN
    SELECT limite_acampantes_por_igreja INTO v_limite
      FROM configuracoes
      WHERE id = 1;
  END IF;

  -- v_limite NULL (nem excecao, nem padrao configurado) = sem limite.
  IF v_limite IS NOT NULL THEN
    SELECT count(*) INTO v_ocupado
      FROM acampantes
      WHERE admin_responsavel = NEW.admin_responsavel;

    IF v_ocupado >= v_limite THEN
      RAISE EXCEPTION 'LIMITE_IGREJA_ATINGIDO: A igreja % atingiu o limite de % inscricoes de acampantes.', NEW.admin_responsavel, v_limite;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_acampantes_verificar_limite_igreja ON acampantes;
CREATE TRIGGER trg_acampantes_verificar_limite_igreja
  BEFORE INSERT ON acampantes
  FOR EACH ROW EXECUTE FUNCTION public._acampantes_verificar_limite_igreja();

-- A funcao roda com os privilegios de quem faz o INSERT (SECURITY INVOKER,
-- padrao do Postgres) -- as policies "Public read access" criadas acima
-- (e a policy ja existente em configuracoes) sao suficientes pra ela
-- funcionar com a chave anon, que e a mesma usada hoje pelo formulario de
-- inscricao pra inserir em acampantes.
