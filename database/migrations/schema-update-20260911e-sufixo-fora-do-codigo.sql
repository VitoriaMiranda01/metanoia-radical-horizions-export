-- ---------------------------------------------------------------------------
-- O sufixo da senha de primeiro acesso sai do codigo-fonte
--
-- POR QUE
-- -------
-- O repositorio deste projeto e publico, e o JavaScript do site e baixavel
-- por qualquer visitante. Deixar a formula da senha escrita em qualquer um
-- dos dois seria repetir exatamente o erro que acabamos de consertar: a
-- senha antiga ("<codigo>.123456") vazou assim, documentada em texto claro
-- num arquivo de migration publico.
--
-- Duas coisas mudam aqui:
--
--   1. o sufixo passa a morar SO no banco, numa tabela fechada
--      (config_senhas), com o valor gravado fora do controle de versao;
--   2. a MENSAGEM PRONTA para o WhatsApp passa a ser montada no servidor, em
--      listar_contas_parceiros. Antes o site montava o texto sozinho -- o que
--      obrigava a formula a viajar dentro do bundle publico.
--
-- Para preparar um ambiente novo:
--   insert into config_senhas (chave, valor)
--   values ('sufixo_primeiro_acesso', '<combinar com a organizacao>');
-- ---------------------------------------------------------------------------

create table if not exists public.config_senhas (
  chave text primary key,
  valor text not null
);

alter table public.config_senhas enable row level security;
revoke all on public.config_senhas from anon, authenticated;

create or replace function public._sufixo_primeiro_acesso()
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select valor from public.config_senhas where chave = 'sufixo_primeiro_acesso';
$$;

revoke all on function public._sufixo_primeiro_acesso() from public, anon, authenticated;

create or replace function public._senha_primeiro_acesso(p_codigo text)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select p_codigo || coalesce(public._sufixo_primeiro_acesso(), '');
$$;

revoke all on function public._senha_primeiro_acesso(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Listagem do organizador, agora com a mensagem pronta.
--
-- mensagem_pronta so vem preenchida para quem ainda esta com senha
-- temporaria -- para quem ja criou a propria senha a formula nao vale mais,
-- e mandar essa mensagem so confundiria.
-- ---------------------------------------------------------------------------
drop function if exists public.listar_contas_parceiros();

create or replace function public.listar_contas_parceiros()
returns table (
  codigo              text,
  nome                text,
  acesso_liberado     boolean,
  senha_definida      boolean,
  ultimo_acesso       timestamptz,
  senha_atualizada_em timestamptz,
  pedido_aberto_em    timestamptz,
  mensagem_pronta     text
)
language sql
security definer
stable
set search_path to 'public'
as $$
  select i.codigo,
         i.nome,
         i.acesso_liberado,
         i.senha_definida,
         i.ultimo_acesso,
         i.senha_atualizada_em,
         s.criado_em,
         case when i.senha_definida then null else
           'Olá! Segue o acesso da ' || i.nome ||
           ' ao sistema do Metanoia Radical Serra.' || chr(10) || chr(10) ||
           'Site: https://metanoiaradicalserra.com.br/login' || chr(10) ||
           'Tipo de acesso: Parceiro' || chr(10) ||
           'Código: ' || i.codigo || chr(10) ||
           'Senha: ' || public._senha_primeiro_acesso(i.codigo) || chr(10) || chr(10) ||
           'No primeiro acesso o sistema vai pedir para você criar a SUA senha ' ||
           '(mínimo 8 caracteres, com letras e números). Guarde-a: ela passa a ser ' ||
           'a única que funciona.'
         end
    from public.igrejas_parceiras i
    left join public.solicitacoes_senha s
           on s.codigo = i.codigo and s.atendida_em is null
   where public.eh_organizador()
   order by lpad(i.codigo, 4, '0');
$$;

revoke all on function public.listar_contas_parceiros() from public;
grant execute on function public.listar_contas_parceiros() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Redefinicao: devolve tambem a mensagem pronta, para o texto ter uma fonte
-- so (aqui) em vez de ser remontado no site.
-- ---------------------------------------------------------------------------
create or replace function public.redefinir_senha_parceiro(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_senha  text;
  v_nome   text;
  v_quem   text;
begin
  if not public.eh_organizador() then
    return jsonb_build_object('ok', false, 'erro', 'Apenas organizadores podem fazer isso.');
  end if;

  v_senha := public._gerar_senha_legivel();
  v_quem  := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', 'organizador');

  update public.igrejas_parceiras
     set senha               = extensions.crypt(v_senha, extensions.gen_salt('bf', 12)),
         senha_definida      = false,
         acesso_liberado     = true,
         senha_atualizada_em = now()
   where codigo = trim(p_codigo)
  returning nome into v_nome;

  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Igreja não encontrada.');
  end if;

  update public.solicitacoes_senha
     set atendida_em = now(), atendida_por = v_quem
   where codigo = trim(p_codigo) and atendida_em is null;

  return jsonb_build_object(
    'ok', true,
    'senha', v_senha,
    'nome', v_nome,
    'mensagem',
      'Olá! Segue o novo acesso da ' || v_nome ||
      ' ao sistema do Metanoia Radical Serra.' || chr(10) || chr(10) ||
      'Site: https://metanoiaradicalserra.com.br/login' || chr(10) ||
      'Tipo de acesso: Parceiro' || chr(10) ||
      'Código: ' || trim(p_codigo) || chr(10) ||
      'Senha: ' || v_senha || chr(10) || chr(10) ||
      'Ao entrar, o sistema vai pedir para você criar a SUA senha ' ||
      '(mínimo 8 caracteres, com letras e números).'
  );
end;
$$;

revoke all on function public.redefinir_senha_parceiro(text) from public;
grant execute on function public.redefinir_senha_parceiro(text) to anon, authenticated;
