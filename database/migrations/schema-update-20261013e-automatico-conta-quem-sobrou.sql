-- ---------------------------------------------------------------------------
-- Alocar automatico: dizer POR QUE quem sobrou ficou na fila (Patrick,
-- 13/10/2026). Duas contagens novas na resposta:
--   sem_opcao     -- inscricao sem nenhuma das 3 opcoes (as manuais que nao
--                    completaram o cadastro): sempre vao a mao.
--   opcoes_cheias -- pediu areas, mas nenhuma tinha vaga (ou eram so da
--                    diretoria / so preferencia). A tela marca essas pessoas
--                    na fila "A escalar".
-- ---------------------------------------------------------------------------

create or replace function pg_temp._patch(p regprocedure, de text, para text, vezes int)
returns void language plpgsql as $p$
declare d text := pg_get_functiondef(p); n int;
begin
  n := (length(d) - length(replace(d, de, ''))) / length(de);
  if n <> vezes then
    raise exception 'patch em %: esperava % ocorrencia(s) de [%], achei %', p, vezes, de, n;
  end if;
  execute replace(d, de, para);
end;
$p$;

select pg_temp._patch('public.alocar_fila_automaticamente()'::regprocedure,
  '    ''sobraram'',  v_sobraram,',
  '    ''sobraram'',  v_sobraram,
    ''sem_opcao'', (select count(*) from public.equipantes q
                     where q.tipo = ''equipante'' and q.status = ''aprovado''
                       and not exists (select 1 from public.escalas e where e.equipante_id = q.id)
                       and public._area_canonica(q.area_trabalho_opcao1) is null
                       and public._area_canonica(q.area_trabalho_opcao2) is null
                       and public._area_canonica(q.area_trabalho_opcao3) is null),
    ''opcoes_cheias'', v_sobraram - (select count(*) from public.equipantes q
                     where q.tipo = ''equipante'' and q.status = ''aprovado''
                       and not exists (select 1 from public.escalas e where e.equipante_id = q.id)
                       and public._area_canonica(q.area_trabalho_opcao1) is null
                       and public._area_canonica(q.area_trabalho_opcao2) is null
                       and public._area_canonica(q.area_trabalho_opcao3) is null),',
  1);
