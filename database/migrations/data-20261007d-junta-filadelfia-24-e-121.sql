-- =============================================================================
-- Junta as duas Filadelfia no codigo 24 (Patrick, 07/10/2026)
--
--   "24 - FILADELFIA"                     -> "24 - ASSEMBLEIA DE DEUS FILADÉLFIA"
--   "121 - ASSEMBLEIA DE DEUS FILADÉLFIA" -> passa toda para a 24 e o 121 some
--
-- Como estava em 07/10/2026: 4 equipantes em cada uma, nenhum acampante, um
-- limite por igreja em cada (24 = 1, 121 = 3) e as duas contas de parceiro
-- nunca usadas (acesso nao liberado, sem senha definida, sem ultimo acesso).
--
-- Decisoes do Patrick:
--   * o limite da 24 continua 1 (o do 121 e apagado, nao somado);
--   * o equipante que marcou OUTRA e escreveu "FILADEUFIA" vai para a 24
--     (mesma troca que a tela "Igrejas OUTRA" faz: igreja = a da lista,
--     igreja_outra = null).
--
-- O nome completo ("NNN - NOME") esta gravado nas fichas e nos limites; a
-- conta do parceiro guarda so o nome. O site (IGREJAS_PARCEIRAS) muda junto.
-- O login do parceiro 24 e pelo codigo e nao muda.
--
-- Recusa (e nao muda nada) se a conta 24 ou a 121 nao estiver com o nome
-- esperado. O 121 so e apagado no fim, depois de ninguem mais apontar para ele.
-- =============================================================================

do $m$
declare
  v_24_antes  constant text := '24 - FILADELFIA';
  v_121       constant text := '121 - ASSEMBLEIA DE DEUS FILADÉLFIA';
  v_novo      constant text := '24 - ASSEMBLEIA DE DEUS FILADÉLFIA';
  v_n int;
begin
  -- 1. A conta do parceiro 24 ganha o nome novo.
  update public.igrejas_parceiras set nome = 'ASSEMBLEIA DE DEUS FILADÉLFIA'
   where codigo = '24' and nome = 'FILADELFIA';
  get diagnostics v_n = row_count;
  if v_n <> 1 then
    raise exception 'conta do parceiro 24 nao encontrada com o nome FILADELFIA';
  end if;
  if not exists (select 1 from public.igrejas_parceiras
                  where codigo = '121' and nome = 'ASSEMBLEIA DE DEUS FILADÉLFIA') then
    raise exception 'conta do parceiro 121 nao encontrada com o nome esperado';
  end if;

  -- 2. Fichas da 24 e da 121 passam para o nome novo.
  update public.equipantes set igreja = v_novo where igreja in (v_24_antes, v_121);
  update public.equipantes set decidido_por_igreja = v_novo where decidido_por_igreja in (v_24_antes, v_121);
  update public.acampantes set admin_responsavel = v_novo where admin_responsavel in (v_24_antes, v_121);
  update public.acampantes set igreja = v_novo where igreja in (v_24_antes, v_121);
  update public.lotes_aprovacao_itens set igreja = v_novo where igreja in (v_24_antes, v_121);

  -- 3. Quem escreveu "FILADEUFIA" em OUTRA.
  update public.equipantes
     set igreja = v_novo, igreja_outra = null
   where tipo = 'equipante'
     and upper(coalesce(igreja, '')) = 'OUTRA'
     and upper(btrim(coalesce(igreja_outra, ''))) = 'FILADEUFIA';

  -- 4. Limite por igreja: o da 24 muda de nome e fica 1; o do 121 sai.
  update public.limites_igrejas set igreja = v_novo, updated_at = now() where igreja = v_24_antes;
  delete from public.limites_igrejas where igreja = v_121;

  -- 5. Por ultimo, o 121 -- so se ninguem mais aponta para ele.
  if exists (select 1 from public.equipantes where igreja = v_121 or decidido_por_igreja = v_121)
     or exists (select 1 from public.acampantes where admin_responsavel = v_121 or igreja = v_121) then
    raise exception 'ainda ha ficha apontando para o 121';
  end if;
  delete from public.primeiro_acesso_parceiros where codigo = '121';
  delete from public.solicitacoes_senha where codigo = '121';
  delete from public.igrejas_parceiras where codigo = '121';
end;
$m$;
