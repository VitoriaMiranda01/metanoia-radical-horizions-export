-- =============================================================================
-- Equipante que congrega precisa informar a igreja (03/10/2026)
--
-- 43 inscricoes chegaram com "Congrega em alguma igreja? SIM" e igreja vazia:
-- o seletor de igreja nao e um campo nativo (o navegador nao barra) e a
-- conferencia do formulario so cobrava o nome digitado quando a pessoa
-- escolhia OUTRA. Sem igreja, a ficha nao aparece para nenhum parceiro.
--
-- O formulario passou a cobrar; aqui fica a garantia do lado do servidor:
-- criar_inscricao recusa com IGREJA_OBRIGATORIA. Quem responde NAO continua
-- entrando com "NAO SE APLICA (NAO CONGREGA)", que a propria tela preenche.
--
-- Troca so um trecho da definicao atual (create or replace preserva as
-- permissoes).
-- =============================================================================

do $m$
declare
  d text;
  ancora constant text := '    v_cpf := nullif(regexp_replace(coalesce(p_dados ->> ''cpf''';
begin
  d := pg_get_functiondef('public.criar_inscricao(text,jsonb,text)'::regprocedure);
  if (length(d) - length(replace(d, ancora, ''))) / length(ancora) <> 1 then
    raise exception 'trecho nao encontrado (ou repetido) em criar_inscricao';
  end if;
  execute replace(d, ancora,
'    -- Quem diz que congrega precisa dizer onde (20261003c).
    if lower(coalesce(p_dados ->> ''esta_afastado'', '''')) in (''true'', ''t'', ''sim'')
       and nullif(btrim(coalesce(p_dados ->> ''igreja'', '''')), '''') is null then
      raise exception ''IGREJA_OBRIGATORIA'';
    end if;

' || ancora);
end;
$m$;
