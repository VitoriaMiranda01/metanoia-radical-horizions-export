-- Lider sempre volta ao acompanhamento (19/10/2026, Patrick): quem conduz
-- equipe (lider, responsavel pela reuniao ou lider de area extra) precisa
-- da relacao mesmo depois de pagar e ter a presenca confirmada. Antes caia na
-- tela "Inscrição Confirmada!" e nao via mais quem esta na area (caso da Vera,
-- Saude). Agora verificar_inscricao so da 'concluido' para quem NAO conduz
-- equipe; o lider recebe id e nome e entra no acompanhamento (que mostra a
-- faixa verde de inscricao concluida e a relacao).
do $$
declare
  v_def text := pg_get_functiondef('public.verificar_inscricao(text,text,text)'::regprocedure);
  v_novo text;
begin
  if v_def like '%lideres_area_extra%' then return; end if;
  v_novo := replace(v_def,
    $a$if v_pago and (p_tipo <> 'equipante' or public._presenca_equipante(v_id) = 'presente') then$a$,
    $a$if v_pago and (p_tipo <> 'equipante'
                  or (public._presenca_equipante(v_id) = 'presente'
                      and not exists (select 1 from public._equipes_do(v_id))
                      and not exists (select 1 from public.lideres_area_extra x where x.equipante_id = v_id))) then$a$);
  if v_novo = v_def then
    raise exception 'trecho não encontrado em verificar_inscricao';
  end if;
  execute v_novo;
end $$;
