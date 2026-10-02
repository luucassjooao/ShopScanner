# ShopScanner — backend

Leia primeiro o `CLAUDE.md` da raiz: produto, contrato, regras de domínio, definição dos números e totais de referência estão lá, e não são repetidos aqui. Este arquivo é só o backend.

**Escopo:** esta pasta serve o contrato que o front em `web/` consome, guarda os segredos do TikTok e, mais à frente, sincroniza e importa os pedidos. **A API é a dona do contrato**: se ele mudar, muda aqui e no `CLAUDE.md` da raiz no mesmo commit.

O front nunca fala com o TikTok. Quem guarda `app_secret`, troca código por token, assina as chamadas com HMAC-SHA256 e sincroniza pedidos é esta API.

## Stack

- **Node 22 + TypeScript**
- **Fastify** como servidor
- **PostgreSQL com SQL escrito à mão**, sem ORM. Driver: `postgres` (porsager), com template marcado — toda interpolação vira parâmetro, então injeção de SQL não acontece por descuido.
- **Migrações em arquivos `.sql` numerados**, aplicadas por um runner próprio que registra o que já rodou numa tabela `schema_migrations`.
- **Zod** para validar entrada, variáveis de ambiente e **as linhas que voltam do banco**.
- **argon2** para senha
- **pino** para log estruturado
- **Vitest** para teste, com `fastify.inject`
- **Docker Compose** para Postgres e para a própria API em desenvolvimento

Sem ORM, três disciplinas não são opcionais: parâmetro sempre (nunca concatenar string em SQL), `numeric` lido como **texto** (combina com o contrato, que trata dinheiro como texto decimal) e conversão explícita de `snake_case` do banco para `camelCase` do contrato, num mapper por tabela.

## Arquitetura

A referência é o padrão do `jstack-edu/live015`, com as camadas separadas e um ajuste: regra de negócio fica em `services`, não no controller.

```
api/
  src/
    index.ts                 bootstrap do Fastify
    app.ts                   registro de plugins, hooks e rotas
    config/env.ts            variáveis validadas por Zod, falha no boot se faltar
    config/constants.ts      tempos de expiração, nomes de cookie
    routes/index.ts          rotas públicas e privadas, separadas
    controllers/             entrada e saída HTTP, validação com Zod
    services/                regra de negócio
    repositories/            acesso ao banco: é aqui, e só aqui, que existe SQL
    middlewares/             autenticação, rate limit, correlação de request
    lib/                     db, cripto, tiktok, erros
    types/                   tipos compartilhados
  db/migrations/             0001_init.sql, 0002_auth.sql, ... aplicadas em ordem
  db/seed.sql                dados fixos de desenvolvimento
  scripts/seed-from-mocks.ts carrega os JSONs de mocks/ na raiz, idempotente
  docker-compose.yml
```

Convenções: controller valida e devolve, service decide, repository escreve o SQL. Controller nunca toca no banco. Service nunca conhece `request` ou `reply`.

Em `lib/db.ts`: a conexão, um helper de transação e dois helpers de consulta (`one` e `many`) que **validam a linha com Zod** antes de devolver. Linha que não bate com o schema é erro, não é `any` solto circulando pelo sistema.

Erro nunca vaza stack, mensagem de banco nem nome de coluna para o cliente. Uma classe `AppError` e um handler central.

## Autenticação

Modelo: **access token curto em JWT + refresh token opaco rotativo com detecção de reuso**, os dois em cookie `httpOnly`.

- **Access token:** JWT assinado (HS256), 15 minutos, cookie `__Host-at`, `httpOnly`, `Secure`, `SameSite=Lax`, `Path=/`. Payload mínimo: `sub` (id do usuário), `sid` (id da sessão) e `ver` (versão das credenciais).
- **Refresh token:** 32 bytes aleatórios em base64url, **nunca** é id de linha. Cookie `__Secure-rt`, `httpOnly`, `Secure`, `SameSite=Lax`, `Path=/auth/refresh`. (Era `__Host-rt` no plano, mas o prefixo `__Host-` exige `Path=/`: não cabe junto com o caminho restrito, e o caminho vale mais.) No banco guarda-se só o **hash SHA-256** com pepper.
- **Rotação:** todo uso do refresh emite um novo e marca o antigo como usado, na mesma transação. O `UPDATE` que marca como usado é condicional (`used_at IS NULL`) e a rotação só segue se afetou uma linha — é isso que fecha a corrida entre dois refreshes simultâneos.
- **Detecção de reuso:** refresh já marcado como usado chegando de novo revoga a **família inteira** de tokens daquela sessão e registra o incidente. É o que protege contra token roubado.
- **Sessão:** tabela própria com user agent, IP, criada em, último uso e revogada em. Dá a tela de dispositivos conectados e permite revogar uma sessão sem derrubar as outras.
- **Logout:** apaga os dois cookies e revoga a sessão. `logout all` revoga todas.
- **Redefinição de senha:** sem tabela. O link é um JWT de 30 minutos com `sub`, `ver` e `pur: 'reset'`; como redefinir incrementa `credentials_version`, o link vale uma vez só. Enquanto não existe envio de e-mail, o token sai no log fora de produção.
- **Senha:** argon2id. Mensagem de erro igual para e-mail inexistente e senha errada. Troca de senha ou reset incrementa `credentials_version` e invalida todas as sessões; o middleware recusa JWT com `ver` diferente.
- **Rate limit:** global por IP e específico em `/auth/*`, com contagem por e-mail mais IP no login.
- **CSRF:** `SameSite=Lax` cobre o caso comum; além disso, toda rota que muda estado exige o header `X-Requested-With: shopscanner` e rejeita requisição sem ele.
- **Nada de token em resposta JSON.** O front não guarda token; a sessão vive nos cookies.

### Login social: só Google

Entrar no app é por e-mail e senha ou pelo **Google**. O TikTok **não é meio de login** — a razão está no `CLAUDE.md` da raiz, em "Identidade de acesso e conexões", e não se reabre sem mudar os dois arquivos.

- Authorization Code com **PKCE**; `code_verifier`, `state` e `nonce` em cookie efêmero assinado (`__Secure-goog`, `Path=/auth/google`), 10 minutos de vida, validados no callback. State ausente ou inválido responde 400 sem detalhe.
- OIDC sem biblioteca: `lib/google.ts` faz as duas chamadas HTTP e a verificação RS256 com `node:crypto`. A JWKS fica em cache de 1 hora, e `kid` desconhecido recarrega no máximo uma vez por minuto. Nos testes, o provedor falso é um par de chaves RSA gerado na hora com `fetch` trocado — o caminho de validação exercitado é o de verdade.
- Google é OIDC: validar o `id_token` (assinatura pela JWKS do Google com cache, `aud`, `iss`, `exp`, `nonce`) e só usar o e-mail quando `email_verified` for verdadeiro.
- Vínculo: identidade já existente para aquele `provider_user_id` entra; usuário com o mesmo e-mail verificado recebe a identidade vinculada; senão, cria usuário novo já com e-mail verificado.
- Tabela `auth_identities` com `provider`, `provider_user_id` e `email`, única em `(provider, provider_user_id)`. Um usuário pode ter senha e Google ao mesmo tempo.
- `GET /auth/session` devolve `hasPassword` e a lista de `identities`: é o backend que decide se dá para desvincular, não o front. `DELETE /auth/identities/:provider` responde 409 quando é o único acesso.
- No fim do callback: cria sessão, emite os mesmos cookies do login normal e redireciona para `WEB_ORIGIN`. Erro do provedor redireciona para a tela de login com um código curto na query, nunca com detalhe técnico.

### Conexões com terceiros

**Conexões com o TikTok** (vídeos pela Display API e pedidos pelo TikTok Shop) vivem na tabela `provider_connections`, separadas da identidade de login: expiram e são revogadas de formas diferentes.

`access_token` e `refresh_token` do TikTok são guardados **criptografados** com AES-256-GCM (`lib/cripto.ts`, formato `iv(12) || tag(16) || texto`), chave em `ENCRYPTION_KEY` (ou KMS em produção), com `key_version` na linha para permitir rotação. Nunca saem em resposta de API, nunca em log, nunca em erro.

A tabela guarda uma linha por parte: `kind` é `VIDEOS` (Display API) ou `SHOP` (pedidos). Uma "conta" do contrato é a linha de vídeos, e `shopConnected` é a existência da linha de pedidos com o mesmo `provider_user_id`. Desconectar **apaga** a linha, e apagar os vídeos apaga os pedidos daquela conta junto.

- Renovação de token agendada antes de expirar, com recuo progressivo em caso de falha.
- `lib/tiktok` com assinatura HMAC-SHA256 em toda chamada, paginação por `page_token`, tratamento de 429 com recuo, e um cliente falso para os testes.
- **Nenhuma chamada real ao TikTok em teste.**
- A Affiliate Creator API ainda não está liberada para o Brasil: o cliente nasce pronto e **desligado por variável de ambiente**, com as rotas respondendo erro claro de indisponibilidade.
- Webhook de desautorização do creator encerra a conexão e apaga os dados daquela conta, registrando no log.

## Obrigações da API no domínio

As definições estão na raiz. O que a API tem de garantir:

- Dinheiro em `numeric(18,2)` no banco, **lido como texto** e serializado como texto decimal com `currency` ao lado. Nunca `float`, nunca `parseFloat`.
- Taxas em `integer`, centésimos de %. Datas sempre ISO UTC na borda.
- Status e canal como enum do Postgres ou check constraint, com os valores exatos do contrato. `INELIGIBLE` só é aceito quando `source = 'FILE'`.
- Todo pedido grava `source` e `source_at`. Quando as duas fontes existem, a **API prevalece** e a diferença vira linha de reconciliação — nunca sobrescrita em silêncio.
- Os cortes de `/summary` (`gmvEligible`, `commissionToReceive`, etc.) são calculados no SQL conforme "Definições dos números" da raiz, e conferidos em teste contra os **totais de referência**. Se a API divergir desses números, a API está errada.
- Paginação por cursor nas listas grandes, com `total` separado.
- Import de arquivo é assíncrono: o upload vai para armazenamento e o parser roda em fila, não no request.
- `accountId` do import vem na **query** de `POST /imports`, nunca como campo do multipart: a conta é validada contra a sessão antes de o corpo ser lido, então arquivo de 50 MB para conta alheia morre no começo. Em campo de multipart a validação dependeria da ordem das partes.
- `GET /imports` é paginado (`{ items, total, page }`, `pageSize` padrão 20 e teto 100) e filtra por `kind` e `status`. Lista de import cresce para sempre: nenhuma rota de histórico nasce sem corte.
- CORS restrito a `WEB_ORIGIN` com `credentials: true`.

## LGPD

- `DELETE /me` apaga de verdade: usuário, sessões, identidades, conexões, pedidos, vídeos e arquivos importados. Registros de acesso ficam 6 meses (Marco Civil) e documentos fiscais pelo prazo legal.
- `GET /me/export` devolve tudo em JSON.
- Webhook de desautorização do creator apaga os dados daquela conta.
- IP e user agent são guardados por motivo de segurança, com prazo de retenção definido, não indefinido.
- O que a política de privacidade promete (`docs/politica-de-privacidade.md`) é contrato: apagar em 7 dias ao desconectar, 30 dias ao excluir a conta. Se o código não cumpre o prazo, o texto é que está errado — resolva os dois juntos.

## Regras para o agente (backend)

- Nenhuma tarefa está pronta sem entrada no `DEVLOG.md` da raiz, com `[api]` no título, no mesmo commit.
- Segredo nunca entra em log, em resposta ou em commit. `.env` fora do git, `.env.example` sempre atualizado.
- Não chame a API do TikTok em teste: use o cliente falso e os JSONs de `mocks/` na raiz.
- Toda rota nova nasce com validação Zod, teste e entrada no contrato da raiz. Rota que não está no contrato não existe.
- SQL sempre parametrizado, nunca concatenado. Linha do banco sempre validada por Zod antes de virar objeto do domínio.
- Migração sempre por arquivo `.sql` numerado em `db/migrations/`, nunca alterando o banco à mão. **Migração aplicada não se edita: cria-se outra.**
- Mudou o contrato? Atualize o `CLAUDE.md` da raiz no mesmo commit e diga, no fim da tarefa, a frase exata que precisa ser levada para a sessão do front.
- Perguntar antes de adicionar dependência nova.
- Rodar `npm run lint` e `npm test` antes de considerar a tarefa pronta.
