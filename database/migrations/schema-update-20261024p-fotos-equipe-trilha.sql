-- 24/10/2026 (Patrick): fotos da equipe de trilha.
--
-- Toda edicao a Victoria montava a arte dos grupos (Guias, Inimigo,
-- Infiltrados, Espirito Santo de cada cor) a mao no Canva. Agora o sistema
-- guarda a foto de cada pessoa e gera a arte pela escala.
--
-- Regras:
--   * Um banco de fotos: uma foto por ficha (equipantes.id). A foto fica mesmo
--     que a pessoa nao esteja escalada nesta edicao (vale para as proximas).
--   * PRIVADO: bucket nao publico; tabela e arquivos so para organizadores
--     (eh_organizador). Quem envia e troca e o organizador (a Victoria).
--   * nome_arte: o nome como sai na arte ("Pr. Joao Branco"). Vazio = a tela
--     usa primeiro + ultimo nome.
--   * LGPD: a foto acompanha a ficha. Ficha apagada (rotina dos 24 meses,
--     excluir cadastro...) -> a linha sai em cascata e o arquivo vai para a
--     fila lgpd_arquivos_a_apagar (a Edge Function lgpd-arquivos apaga).
--     Troca/remocao pela tela: o mesmo gatilho poe o arquivo antigo na fila
--     (a tela nao apaga arquivo); sai na rotina das 03:30.

-- ------------------------------------------------------------ bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-equipe-trilha', 'fotos-equipe-trilha', false, 3145728,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Fotos da trilha: organizador le" on storage.objects;
drop policy if exists "Fotos da trilha: organizador envia" on storage.objects;
drop policy if exists "Fotos da trilha: organizador troca" on storage.objects;
drop policy if exists "Fotos da trilha: organizador apaga" on storage.objects;
create policy "Fotos da trilha: organizador le" on storage.objects
  for select to authenticated using (bucket_id = 'fotos-equipe-trilha' and public.eh_organizador());
create policy "Fotos da trilha: organizador envia" on storage.objects
  for insert to authenticated with check (bucket_id = 'fotos-equipe-trilha' and public.eh_organizador());
create policy "Fotos da trilha: organizador troca" on storage.objects
  for update to authenticated using (bucket_id = 'fotos-equipe-trilha' and public.eh_organizador())
  with check (bucket_id = 'fotos-equipe-trilha' and public.eh_organizador());
create policy "Fotos da trilha: organizador apaga" on storage.objects
  for delete to authenticated using (bucket_id = 'fotos-equipe-trilha' and public.eh_organizador());

-- ------------------------------------------------------------ tabela
create table if not exists public.fotos_trilha (
  equipante_id   uuid primary key references public.equipantes(id) on delete cascade,
  caminho        text not null,
  nome_arte      text,
  atualizado_em  timestamptz not null default now(),
  atualizado_por text
);

alter table public.fotos_trilha enable row level security;
revoke all on public.fotos_trilha from anon;
grant select, insert, update, delete on public.fotos_trilha to authenticated;

drop policy if exists "Fotos da trilha: organizador" on public.fotos_trilha;
create policy "Fotos da trilha: organizador" on public.fotos_trilha
  for all to authenticated using (public.eh_organizador()) with check (public.eh_organizador());

-- Quem mexeu por ultimo (nome do organizador logado) e quando.
create or replace function public._fotos_trilha_carimbo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.atualizado_em := now();
  new.atualizado_por := public._nome_organizador_logado();
  new.nome_arte := nullif(btrim(regexp_replace(coalesce(new.nome_arte, ''), '\s+', ' ', 'g')), '');
  return new;
end;
$$;
drop trigger if exists fotos_trilha_carimbo on public.fotos_trilha;
create trigger fotos_trilha_carimbo before insert or update on public.fotos_trilha
  for each row execute function public._fotos_trilha_carimbo();

-- Linha saiu (ou trocou de arquivo) e o arquivo antigo ainda esta no Storage:
-- vai para a fila da LGPD (o banco nao apaga arquivo sozinho).
create or replace function public._fotos_trilha_arquivo_para_fila()
returns trigger language plpgsql security definer set search_path = public, storage as $$
begin
  if tg_op = 'UPDATE' and new.caminho is not distinct from old.caminho then
    return null;
  end if;
  insert into public.lgpd_arquivos_a_apagar (bucket, nome, objeto_id)
  select o.bucket_id, o.name, o.id from storage.objects o
   where o.bucket_id = 'fotos-equipe-trilha' and o.name = old.caminho
  on conflict (bucket, nome) do nothing;
  return null;
end;
$$;
drop trigger if exists fotos_trilha_arquivo_para_fila on public.fotos_trilha;
create trigger fotos_trilha_arquivo_para_fila after delete or update of caminho on public.fotos_trilha
  for each row execute function public._fotos_trilha_arquivo_para_fila();

revoke all on function public._fotos_trilha_carimbo() from public, anon, authenticated;
revoke all on function public._fotos_trilha_arquivo_para_fila() from public, anon, authenticated;

-- ------------------------------------------------------------ busca
-- (sem a extensao unaccent nos bancos)
create or replace function public._fotos_trilha_sem_acento(t text)
returns text language sql immutable as $$
  select translate(lower(coalesce(t, '')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn');
$$;
revoke all on function public._fotos_trilha_sem_acento(text) from public, anon, authenticated;

-- Para vincular foto a quem NAO esta escalado: busca na base de fichas
-- (nome ou CPF). Devolve so o necessario (CPF mascarado).
create or replace function public.fotos_trilha_buscar(p_texto text)
returns table (equipante_id uuid, nome text, cpf_final text, igreja text, edicao int, tem_foto boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  v_txt text := btrim(coalesce(p_texto, ''));
  v_dig text := regexp_replace(v_txt, '\D', '', 'g');
begin
  if not public.eh_organizador() then
    raise exception 'Somente organizadores.';
  end if;
  if length(v_txt) < 3 then
    return;
  end if;
  return query
  select e.id, e.nome::text,
         case when length(regexp_replace(coalesce(e.cpf, ''), '\D', '', 'g')) = 11
              then '***.' || substr(regexp_replace(e.cpf, '\D', '', 'g'), 7, 3) || '-' || right(regexp_replace(e.cpf, '\D', '', 'g'), 2)
              else null end,
         coalesce(nullif(e.igreja_outra, ''), e.igreja)::text,
         e.numero_edicao,
         exists (select 1 from public.fotos_trilha f where f.equipante_id = e.id)
    from public.equipantes e
   where e.tipo = 'equipante'
     and ((length(v_dig) = 11 and regexp_replace(coalesce(e.cpf, ''), '\D', '', 'g') = v_dig)
          or public._fotos_trilha_sem_acento(e.nome) like '%' || public._fotos_trilha_sem_acento(v_txt) || '%')
   order by e.nome
   limit 30;
end;
$$;
revoke all on function public.fotos_trilha_buscar(text) from public, anon;
grant execute on function public.fotos_trilha_buscar(text) to authenticated;

-- Banco de fotos com o nome da ficha (inclui quem nao esta escalado).
create or replace function public.fotos_trilha_lista()
returns table (equipante_id uuid, nome text, caminho text, nome_arte text, edicao int,
               atualizado_em timestamptz, atualizado_por text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.eh_organizador() then
    raise exception 'Somente organizadores.';
  end if;
  return query
  select f.equipante_id, e.nome::text, f.caminho, f.nome_arte, e.numero_edicao, f.atualizado_em, f.atualizado_por
    from public.fotos_trilha f
    join public.equipantes e on e.id = f.equipante_id
   order by e.nome;
end;
$$;
revoke all on function public.fotos_trilha_lista() from public, anon;
grant execute on function public.fotos_trilha_lista() to authenticated;

-- ------------------------------------------------------------ LGPD
-- O registro do apagamento diz se era autorizacao ou foto.
alter table public.lgpd_apagamentos drop constraint if exists lgpd_apagamentos_tipo_check;
alter table public.lgpd_apagamentos add constraint lgpd_apagamentos_tipo_check
  check (tipo in ('dados_da_edicao', 'cadastro', 'arquivo_autorizacao', 'arquivo_foto'));

do $$
declare
  v_def text := pg_get_functiondef('public.lgpd_arquivos_conferir(text)'::regprocedure);
  v_de  text := $q$returning f.objeto_id
  )
  insert into public.lgpd_apagamentos (tipo, codigo)
  select 'arquivo_autorizacao', objeto_id from feitos;$q$;
  v_para text := $q$returning f.objeto_id, f.bucket
  )
  insert into public.lgpd_apagamentos (tipo, codigo)
  select case when bucket = 'fotos-equipe-trilha' then 'arquivo_foto' else 'arquivo_autorizacao' end, objeto_id from feitos;$q$;
begin
  if position(v_para in v_def) > 0 then
    return; -- ja aplicado
  end if;
  if position(v_de in v_def) = 0 then
    raise exception 'lgpd_arquivos_conferir: trecho nao encontrado';
  end if;
  execute replace(v_def, v_de, v_para);
end $$;
