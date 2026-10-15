-- Responsavel pela reuniao que sai da equipe (15/10/2026, revisao do lider v2)
--
-- Se o organizador tira da area (ou troca de cor) quem foi delegado, a
-- delegacao cai sozinha: senao a pessoa continuaria vendo e marcando a
-- chamada de uma equipe da qual nao faz mais parte, e o lider veria o nome
-- dela como responsavel.

create or replace function public._limpar_responsavel_reuniao()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.responsaveis_reuniao r
   where r.equipante_id = old.equipante_id
     and not exists (select 1 from public.escalas s
                      where s.equipante_id = r.equipante_id
                        and public._na_equipe_de(r.area, r.cor, s.id));
  return null;
end;
$$;

drop trigger if exists limpar_responsavel_reuniao on public.escalas;
create trigger limpar_responsavel_reuniao
  after delete or update of area_alocada, cor on public.escalas
  for each row execute function public._limpar_responsavel_reuniao();

-- Quem ja estiver nessa situacao hoje.
delete from public.responsaveis_reuniao r
 where not exists (select 1 from public.escalas s
                    where s.equipante_id = r.equipante_id
                      and public._na_equipe_de(r.area, r.cor, s.id));
