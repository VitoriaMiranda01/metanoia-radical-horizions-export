# Validação dos dados das inscrições

Regra do projeto (Patrick, 06/10/2026): **a pessoa só consegue se inscrever com dados válidos**, e dado
inválido não entra por nenhum caminho — nem pelo formulário, nem pela edição do organizador, nem por chamada
direta à API. O que já existia com erro aparece nos avisos de Gerenciar Inscrições (acampantes) e na janela
"Complete o seu cadastro" (equipantes).

## As quatro camadas

| Camada | Onde | Para quê |
|---|---|---|
| 1. Campo | `Dados Pessoais`, `Endereco`, `InfoEclesiasticas`, `QuemIndicou`... | Nem deixa digitar o que não cabe (número em nome, máscara de CEP e telefone) |
| 2. Envio | `conferirInscricao` (`src/utils/validacoesInscricao.js`) + checagens de nome/CPF em `AcampantePage` e `EquipantePage` | Mensagem clara e foco no campo errado antes de enviar |
| 3. `criar_inscricao` | `_dados_inscricao_validos` (campos obrigatórios e formato), nome, CPF, telefones, camisa, contato | O servidor recusa mesmo que alguém burle a tela |
| 4. Gatilho `validar_ficha` | `_validar_ficha()` em `acampantes` e `equipantes` | Vale para QUALQUER gravação (edição do organizador, API direta). Só confere o campo que **mudou**: ficha antiga com dado estranho não trava outras edições |

Telefones têm o gatilho próprio `trg_*_telefones` (`_padronizar_telefones`, migration 20261003d).

## Regras por campo

| Campo | Regra |
|---|---|
| Nome da pessoa | só letras (e espaço, `'`, `’`, `-`, `.`), nome **e** sobrenome (`_nome_pessoa_valido`) |
| Nomes de outras pessoas (pastor, familiar, quem indicou, conhecido) | só letras, ao menos 2 (`_nome_simples_valido`) |
| Contato de emergência | só letras; **não pode ser a própria pessoa** nem o próprio WhatsApp |
| CPF | dígitos verificadores (`_cpf_valido`); sem CPF só estrangeiro, com nacionalidade |
| Data de nascimento | obrigatória; entre 10 e 100 anos |
| Sexo | obrigatório: `Masculino` ou `Feminino` |
| E-mail | formato válido, quando preenchido |
| CEP / Estado | 8 números / UF da lista (27) — **estrangeiro fica livre** |
| Cidade, profissão | sem números |
| Camisa | PP, P, M, G, GG, XG, XXG (acampante: obrigatória) |
| Equipante, obrigatórios | igreja (ou "Não se aplica"; "OUTRA" pede o nome), conhecido/familiar acampante (e o nome dele), 3 áreas de trabalho |

## Códigos de erro

O banco levanta o código (`NOME_INVALIDO`, `CPF_INVALIDO`, `CEP_INVALIDO`...). A tela traduz em
`src/utils/errosDeDados.js`. **Regra nova no banco = código novo em `errosDeDados.js` e a mesma regra em
`validacoesInscricao.js`**, para a pessoa corrigir antes de enviar.

## Onde está cada migration

- `20261006m` nome e CPF · `20261006n` demais campos + aviso dos acampantes · `20261006o` estrangeiro
- `20261006q` contato de emergência ≠ a pessoa · `20261006r` obrigatórios + gatilho `validar_ficha`

## Reinscrição

Quem se inscreveu e não vai nesta edição corrige as pendências **na hora de se inscrever na edição seguinte**:
a ficha antiga volta para o formulário e o servidor confere tudo de novo antes de gravar.

## Toda migration vale para os dois bancos

Oficial e teste (`database/ambiente-teste/README.md`).
