-- ---------------------------------------------------------------------------
-- Pre-cadastro sem CPF (14/10/2026, Patrick).
--
-- Interruptor em Configuracoes: ligado, o pre-cadastro das Areas Especiais e
-- da Recepção Igreja aceita escolher pelo NOME quem nao tem CPF (inscricoes
-- manuais). A lista (configuracoes.cpfs_area_<key>, jsonb) guarda entao
-- 'id:<uuid do equipante>' no lugar do CPF -- so o site le essas listas; o
-- banco nao interpreta o conteudo. Desligado (padrao), fica como era.
-- ---------------------------------------------------------------------------
alter table public.configuracoes
  add column if not exists pre_cadastro_sem_cpf boolean not null default false;

comment on column public.configuracoes.pre_cadastro_sem_cpf is
  'Pre-cadastro das areas especiais/Recepção Igreja aceita pessoa sem CPF (guardada como id:<uuid>).';
