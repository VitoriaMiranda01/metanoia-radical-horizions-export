-- =============================================================================
-- Duas igrejas novas que estavam em OUTRA (04/10/2026, pedido do Patrick)
--   163 - CARA DE LEAO IRAJA
--   164 - METODISTA WESLEYANA
-- Sem "IGREJA" na frente (regra de 04/10). Conta de parceiro igual as outras
-- (primeiro acesso pela formula do banco, trancado ate liberar) e os 4
-- equipantes que escreveram exatamente esses nomes saem do OUTRA.
-- "METODISTA WESLEYANA CARANGOLA" e "... LOTEAMENTO SAMAMBAIA" continuam em
-- OUTRA, esperando a diretoria.
-- =============================================================================

do $m$
declare
  v_n int;
begin
  if exists (select 1 from public.igrejas_parceiras where codigo in ('163', '164')) then
    raise exception 'codigo 163 ou 164 ja existe em igrejas_parceiras';
  end if;

  insert into public.igrejas_parceiras (codigo, nome, senha, acesso_liberado, senha_definida) values
    ('163', 'CARA DE LEÃO IRAJÁ',
     extensions.crypt(public._senha_primeiro_acesso('163'), extensions.gen_salt('bf', 12)), false, false),
    ('164', 'METODISTA WESLEYANA',
     extensions.crypt(public._senha_primeiro_acesso('164'), extensions.gen_salt('bf', 12)), false, false);

  update public.equipantes e
     set igreja = m.igreja, igreja_outra = null
    from (values
      ('3c851b2c-cceb-4e86-bf56-f1c9cf6b29f1'::uuid, '163 - CARA DE LEÃO IRAJÁ'),
      ('a0368fda-ff4b-4a62-91a8-836564afd1cd'::uuid, '163 - CARA DE LEÃO IRAJÁ'),
      ('fb2ec76b-2b24-4e30-9220-6f8d7b994b58'::uuid, '164 - METODISTA WESLEYANA'),
      ('7910626b-f611-404d-a852-7f95a6382a40'::uuid, '164 - METODISTA WESLEYANA')
    ) as m(id, igreja)
   where e.id = m.id and upper(coalesce(e.igreja, '')) = 'OUTRA';
  get diagnostics v_n = row_count;
  if v_n <> 4 then
    raise exception 'esperava mover 4 equipantes de OUTRA, moveu %', v_n;
  end if;
end;
$m$;
