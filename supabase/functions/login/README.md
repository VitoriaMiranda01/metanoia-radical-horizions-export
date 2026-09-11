# Edge Function `login` — guia de publicação

Esta função move a conferência de senha do **navegador** para o **servidor**.
Antes dela, o site baixava o hash de senha para o navegador; qualquer visitante
conseguia coletar os hashes de todos os administradores e igrejas.

## Ordem de publicação (importante)

A ordem importa. Se inverter, o login para de funcionar.

1. **Publicar a função** `login` no projeto Supabase.
2. **Cadastrar o segredo** `APP_JWT_SECRET`.
3. **Publicar o site** (frontend) com o novo `authService.js`.
4. **Só então** rodar o SQL
   `database/migrations/schema-update-20260911-login-servidor-revoga-anon.sql`,
   que revoga a leitura anônima das tabelas de credencial.

## 1. Publicar a função

Pelo painel: **Edge Functions → Deploy a new function**, nome `login`, colando
o conteúdo de `index.ts`. Manter **`verify_jwt` ligado** (o site chama a função
com a chave anônima, que é um JWT válido — então continua funcionando, e
chamadas sem chave nenhuma são barradas).

Pela CLI:

```bash
supabase functions deploy login --project-ref <REF_DO_PROJETO>
```

## 2. Cadastrar o segredo `APP_JWT_SECRET`

**Project Settings → Edge Functions → Secrets → Add new secret**

- **Name:** `APP_JWT_SECRET`
- **Value:** o **JWT Secret do projeto** (Project Settings → API → JWT Settings).

Usar o JWT Secret do próprio projeto é o que fará o token ser aceito pelo banco
no **Passo 2** (quando as tabelas forem trancadas por RLS). No Passo 1 o token
ainda não é usado para ler dados — ele só é gerado e guardado.

As outras variáveis (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) já são
injetadas automaticamente pelo Supabase; não precisa cadastrar.

## 3. Conferir se funcionou

Substitua `<REF>` e `<ANON_KEY>`:

```bash
curl -s -X POST "https://<REF>.supabase.co/functions/v1/login" \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"tipo":"organizador","identifier":"<NOME>","senha":"<SENHA>"}'
```

Esperado:
- Senha correta → `{"success":true,"token":"...","user":{...}}` **sem** o campo `senha`.
- Senha errada → HTTP 401 `{"success":false,"error":"Usuário ou senha inválidos"}`.
- Usuário inexistente → **a mesma** resposta do item anterior (evita descobrir
  quais usuários existem).

## 4. Depois de revogar o acesso anônimo

Confirme que o ataque está bloqueado:

```bash
curl -s -w "\n%{http_code}\n" \
  "https://<REF>.supabase.co/rest/v1/organizadores_auth?select=*" \
  -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>"
```

Esperado: **HTTP 401** com `permission denied for table organizadores_auth`.

## Validação já realizada

Todo este fluxo foi testado ponta a ponta num projeto Supabase descartável
(`metanoia-teste-login`, região sa-east-1), com hashes bcrypt reais de custo 06
(igual à produção) e custo 10. Resultados:

| Teste | Resultado |
|---|---|
| Login correto (organizador, hash custo 06) | HTTP 200, token emitido |
| Login correto (igreja, hash custo 10) | HTTP 200, token com `igreja_codigo` |
| Campo `senha` na resposta | **ausente** nos dois casos |
| Assinatura do JWT (HS256) | **válida** |
| Senha errada | HTTP 401, mensagem genérica |
| Usuário inexistente | HTTP 401, **mensagem idêntica** à anterior |
| Leitura anônima das tabelas de credencial | **HTTP 401 permission denied** |

## Notas de segurança

- A função responde com **mensagem única** para "usuário não existe" e "senha
  errada", e gasta o mesmo tempo de CPU nos dois casos (compara contra um hash
  descartável quando o usuário não existe), para não permitir descobrir contas
  por tempo de resposta.
- O hash de senha **nunca** é devolvido ao navegador.
- O token expira em **8 horas**.
- Vale considerar, depois, um limite de tentativas (rate limiting) por IP para
  dificultar ataques de força bruta — não incluído neste passo.
