-- ---------------------------------------------------------------------------
-- Pastor parceiro aprovado automaticamente (Patrick, 29/10/2026)
--
-- Equipante cujo CPF esta no quadro Pastores Parceiros (Configuracoes) nao
-- precisa de aprovacao: o sistema aprova sozinho.
--
--  * So vale o CPF do quadro (pastores_parceiros ativo). Cargo de pastor na
--    ficha NAO conta (decisao do Patrick).
--  * Nos dois momentos:
--      - a inscricao chega (ou e editada) pendente e o CPF ja esta no quadro;
--      - o pastor entra no quadro (ou ganha CPF) e ja tem inscricao pendente.
--  * Carimbo: decidido_por = 'Sistema', decidido_por_tipo = 'automatico'.
--    A tela mostra "Aprovada por Sistema · pastor parceiro".
--  * So inscricao desta edicao (inscrito = true) e so quem esta pendente.
--    Rejeitado continua rejeitado. Se o organizador VOLTAR a inscricao para
--    pendente (botao ou desfazer lote), a decisao dele vale: o gatilho so age
--    quando a ficha ja estava pendente (ou e nova).
--  * Nao escala ninguem (a aprovacao nao escala desde 12/10).
--  * Aprovado = carta pastoral ok, inclusive no Só Domingo (Patrick: sim).
--  * Sair do quadro nao desfaz a aprovacao.
-- ---------------------------------------------------------------------------

create or replace function public._eh_cpf_pastor_parceiro(p_cpf text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select coalesce(length(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g')) = 11, false)
     and exists (select 1 from public.pastores_parceiros pp
                  where pp.removido_em is null
                    and regexp_replace(coalesce(pp.cpf, ''), '\D', '', 'g')
                        = regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g'));
$fn$;

revoke all on function public._eh_cpf_pastor_parceiro(text) from public, anon, authenticated;

-- Inscricao chegando / editada -----------------------------------------------------
create or replace function public._tg_aprovar_pastor_parceiro()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $fn$
begin
  if new.tipo = 'equipante'
     and new.status = 'pendente'
     and coalesce(new.inscrito, false)
     and (tg_op = 'INSERT' or old.status = 'pendente')
     and public._eh_cpf_pastor_parceiro(new.cpf) then
    new.status              := 'aprovado';
    new.decidido_por        := 'Sistema';
    new.decidido_por_tipo   := 'automatico';
    new.decidido_por_igreja := null;
    new.decidido_em         := now();
  end if;
  return new;
end;
$fn$;

revoke all on function public._tg_aprovar_pastor_parceiro() from public, anon, authenticated;

drop trigger if exists aprovar_pastor_parceiro on public.equipantes;
create trigger aprovar_pastor_parceiro
  before insert or update on public.equipantes
  for each row execute function public._tg_aprovar_pastor_parceiro();

-- Pastor entrando no quadro -------------------------------------------------------
create or replace function public._tg_quadro_aprova_pastor()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_cpf text := regexp_replace(coalesce(new.cpf, ''), '\D', '', 'g');
begin
  if new.removido_em is null and length(v_cpf) = 11 then
    update public.equipantes e set
      status              = 'aprovado',
      decidido_por        = 'Sistema',
      decidido_por_tipo   = 'automatico',
      decidido_por_igreja = null,
      decidido_em         = now()
    where e.tipo = 'equipante'
      and e.status = 'pendente'
      and coalesce(e.inscrito, false)
      and regexp_replace(coalesce(e.cpf, ''), '\D', '', 'g') = v_cpf;
  end if;
  return null;
end;
$fn$;

revoke all on function public._tg_quadro_aprova_pastor() from public, anon, authenticated;

drop trigger if exists aprova_pastor_pendente on public.pastores_parceiros;
create trigger aprova_pastor_pendente
  after insert or update of cpf, removido_em on public.pastores_parceiros
  for each row execute function public._tg_quadro_aprova_pastor();

-- Quem ja esta no quadro e esta pendente hoje -----------------------------------------
update public.equipantes e set
  status              = 'aprovado',
  decidido_por        = 'Sistema',
  decidido_por_tipo   = 'automatico',
  decidido_por_igreja = null,
  decidido_em         = now()
where e.tipo = 'equipante'
  and e.status = 'pendente'
  and coalesce(e.inscrito, false)
  and public._eh_cpf_pastor_parceiro(e.cpf);
