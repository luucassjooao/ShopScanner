# Devlog

Histórico de decisões e aprendizados do projeto. O git guarda o que mudou; aqui fica o porquê, o que funcionou e o que não funcionou.

Regras curtas: entrada nova sempre no topo, uma por tarefa concluída, no mesmo commit da mudança. Sem diff copiado, sem ruído de formatação. Decisão permanente também vai para o `CLAUDE.md`.

---

## Estado atual

_Atualize esta seção quando o estado mudar. Ela é a primeira coisa que se lê ao voltar ao projeto._

- **Fase:** 0 — fundação das duas pontas: front pronto, backend recém-nascido.
- **Rodando:** front em `web/` com o design do canvas aplicado: área logada completa, páginas legais e públicas; acesso por e-mail ou Google, TikTok só como conexão, e a entrada de pedidos por arquivo `.xlsx` (lint, typecheck, build e 108 testes passando).
- **Repositório:** git iniciado na raiz (branch `main`), hook do devlog ativo via `core.hooksPath`.
- **Dados:** JSONs simulados em `mocks/`, servidos pelo MSW. O backend em `api/` já sobe, mas ainda não serve nenhuma rota do contrato.
- **Backend:** `api/` com conta, sessão, login do Google e conexão com o TikTok (`/accounts`, conectar, desconectar, tokens cifrados). Falta a tabela de domínio: pedidos, vídeos, produtos, metas, pautas.
- **Integração TikTok:** Affiliate Creator API não liberada para o Brasil; ticket aberto com a TikTok. Display API disponível, app ainda não submetido.
- **Telas prontas:** /, /entrar, /criar-conta, /recuperar, /termos, /privacidade, /inicio-rapido, /inicio, /vendas, /videos, /videos/:id, /produtos, /planejamento, /configuracoes, /avisos, /reconciliacao.
- **Próximo passo:** tabelas e endpoints de domínio na API (`/summary`, `/orders`, `/videos`, `/products`) conferindo os totais de referência; no front, decidir as propostas de contrato da entrada de 23/09 e preencher `web/src/lib/textos.ts`.
- **Bloqueios:** aprovação da categoria "Creator collaborations" para o Brasil; confirmação de que o identificador de conteúdo do pedido é o mesmo id do vídeo.

---

## Entradas

### 2026-10-02 · [api] Fechar o contrato do import de arquivo

**Fiz:** decidi as duas dúvidas que vieram da sessão do front e escrevi no contrato: `accountId` do `POST /imports` vai na **query**, não como campo do multipart, e `GET /imports` passa a ser paginado (`{ items, total, page }`) com filtro por `kind` e `status`. `ImportBatch` ganhou `accountId`.
**Por quê:** o relatório do TikTok não diz de qual conta veio, então a conta precisa vir do front — e a lista de imports cresce para sempre se nascer sem corte.
**Funcionou:** nada de código ainda; é decisão de contrato. O front já manda `accountId`, só muda de lugar: uma linha.
**Não funcionou:** nada.
**Decidi:** `accountId` na query porque a validação acontece **antes** de ler o corpo — arquivo de 50 MB para conta de outra pessoa morre no começo, e não depende da ordem das partes do multipart, que um dia alguém inverte sem perceber. Paginação igual à de `/orders`, `pageSize` padrão 20 e teto 100, do mais recente para o mais antigo. Limites do upload declarados no contrato (só `.xlsx`, primeira aba, 50 MB, só `BRL`), cada recusa virando `error.code` do `ImportBatch` em vez de 500.
**Pendente:** nada de `/imports` está implementado na API — não há tabela, fila nem parser, e `docs/parser-affiliate-orders.md`, citado duas vezes no `CLAUDE.md` da raiz, **não existe no repositório**. Enquanto a seção 3 do parser não fechar (depende de um `affiliate_orders.xlsx` real), implementar seria chutar as colunas.
**Commit:** c823c11

### 2026-10-02 · [front] Implementar a entrada de dados por arquivo

**Fiz:** o caminho do `affiliate_orders.xlsx` de ponta a ponta no front: painel de import em Configurações → Contas (arrastar ou escolher, vários arquivos em sequência, barra de progresso, acompanhamento por `GET /imports/:id` e resultado em "N novas, N atualizadas, N sem mudança"), orientação própria para os sete códigos de erro do contrato, histórico com tipo, data, resultado e status, selo de procedência em venda, "Atualizado há X" no topo, lembrete no Início depois de 5 dias sem leitura, tela `/reconciliacao` e o app registrado como destino de compartilhamento no celular.
**Por quê:** a Affiliate Creator API não está liberada no Brasil. Sem o arquivo, o painel não tem número de venda nenhum — é a espinha de dados do MVP, não um extra.
**Funcionou:** 108 testes. Os novos cobrem envio com resultado, a orientação de `WRONG_CURRENCY` (conferindo que a mensagem técnica da API **não** vai para a tela), `UNKNOWN_COLUMNS` com as colunas que faltam e as que vieram, histórico separando arquivo de sincronização, e a reconciliação vazia. Lint, Prettier, typecheck e build limpos.
**Não funcionou:** o teste ponta a ponta do upload real. O jsdom não serializa `FormData` com arquivo no `XMLHttpRequest` (quebra em `_buffer`), então o teste troca o XHR por um que fala com o mesmo handler do MSW em JSON; da fila em diante tudo é real. É a mesma limitação que já tinha obrigado o teste do avatar a trocar o `fetch`. Também não consegui conferir no navegador: o Chrome não respondeu.
**Decidi:** o upload usa `XMLHttpRequest` (`upload()` em `api/client.ts`) porque `fetch` não informa progresso de envio; o resto da camada continua no `request()`. Vários arquivos vão **um depois do outro**, não em paralelo: a fila do backend é uma só e o resultado precisa ser lido arquivo a arquivo. A orientação de cada erro mora só em `lib/import.ts`, e a `message` técnica fica fora da tela. O selo de procedência é um componente só, `<Procedencia />`. A tela de import não virou rota própria: ela mora em Configurações, e Vendas e o estado "Shop não conectado" apontam para `?secao=import`. `/reconciliacao` é rota, mas fora da navegação. O service worker do compartilhamento só é registrado em produção, porque em desenvolvimento o escopo `/` é do worker do MSW. Aproveitei para mandar `X-Requested-With` nas rotas que mudam estado, como o `CLAUDE.md` já exigia e o cliente não fazia.
**Pendente:** `docs/parser-affiliate-orders.md` **não existe** — o `CLAUDE.md` da raiz o cita como a especificação do parser. Os nomes de coluna continuam sendo problema do backend, então nada disso travou o front. Propostas de contrato que a API precisa confirmar:
  - `accountId` junto do arquivo no `POST /imports`: o relatório do TikTok não diz de qual conta veio.
  - `GET /imports` sem filtro de `kind` nem paginação; com meses de uso a lista cresce sem limite.
  - `INELIGIBLE` ficou sem cor no design: está no cinza de texto secundário, com o rótulo escrito.

  Fora do escopo desta tarefa: `GET /payouts` (está no contrato, nenhuma tela usa) e cancelar um envio em andamento.
**Commit:** —

### 2026-10-02 · [api] Resolver a senha de quem veio do Google e as conexões com o TikTok

**Fiz:** `PUT /me/password` com `currentPassword` opcional (só é exigido de quem já tem senha), e a tabela `provider_connections` com o fluxo de conexão: `GET /accounts`, `POST /connections/tiktok/start`, `GET /connections/tiktok/callback` e `DELETE /connections/:id`. Tokens do TikTok guardados com AES-256-GCM em `lib/cripto.ts`. `/auth/session` parou de devolver `accounts: []` fixo.
**Por quê:** eram as duas pendências abertas: quem entrou pelo Google não tinha como definir senha, e `accounts` era mentira no contrato.
**Funcionou:** 32 testes na API. Nos novos: senha atual exigida de quem tem senha e dispensada de quem não tem, troca de senha derruba as outras sessões e devolve cookie novo para a aba atual, conexão aparece em `/accounts` com `shopConnected: false`, o token no banco não contém o texto claro e volta pelo `decifrar`, state divergente dá 400, conectar os pedidos responde 503 `TIKTOK_SHOP_INDISPONIVEL`, e desconectar apaga a linha. Provedor TikTok falso por `fetch` trocado, como o do Google.
**Não funcionou:** uma execução isolada falhou 4 testes logo depois de eu mover o `truncate` de `provider_connections` para o helper; não reproduziu em cinco execuções seguintes, nem com a mesma sequência de comandos. Fica anotado.
**Decidi:** trocar a senha derruba todas as sessões, como manda o `api/CLAUDE.md`, mas abre uma nova na hora para o aparelho que pediu a troca — invalidar tudo e expulsar a pessoa da tela seria pior. `kind` (`VIDEOS` ou `SHOP`) separa as duas partes da mesma conta do TikTok; desligar os vídeos desliga os pedidos junto. Desconectar apaga a linha em vez de marcar revogada: a política promete não guardar dado de conta desconectada. As variáveis `TIKTOK_*` são opcionais e `TIKTOK_SHOP_ENABLED` nasce `false`, então a parte de pedidos responde indisponível sem nenhuma gambiarra de código.
**Pendente:** renovação automática do token antes de expirar (hoje `expiresAt` só é exibido), chamadas assinadas com HMAC e webhook de desautorização. Conta criada pelo Google ainda fica com `acceptedTermsVersion` nulo e não existe rota para registrar o aceite — proponho `PATCH /me { acceptedTermsVersion? }` junto com o resto de `/me`.
**Commit:** ffc69e5

### 2026-10-02 · [api] Implementar login com Google

**Fiz:** `GET /auth/google/start` e `/callback` com Authorization Code + PKCE, mais `GET /auth/identities` e `DELETE /auth/identities/:provider`. `state`, `nonce` e `code_verifier` viajam num cookie assinado de 10 minutos; o `id_token` é validado pela JWKS do Google antes de virar sessão.
**Por quê:** entrar por e-mail e senha é atrito para quem já tem conta Google, e a tela de Configurações precisa de vínculo e desvínculo.
**Funcionou:** 10 testes com provedor falso (par de chaves RSA gerado na hora, `fetch` trocado): fluxo feliz conferindo que o `code_verifier` enviado bate com o desafio publicado, state divergente e callback sem cookie dão 400 seco, nonce de outro fluxo dá 400, e-mail não verificado volta para `/entrar?erro=EMAIL_NAO_VERIFICADO`, recusa no Google volta com `GOOGLE_RECUSADO`, vínculo com conta de mesmo e-mail reaproveita o usuário, usuário logado vincula sem trocar de sessão, e desvincular responde 409 `UNICO_ACESSO` quando não há senha. Total de 23 testes na API.
**Não funcionou:** nada travou, mas o cookie assinado precisou voltar byte a byte no teste: reenviar o valor já decodificado quebra a assinatura, então o teste copia o `Set-Cookie` cru.
**Decidi:** OIDC sem biblioteca — `node:crypto` verifica RS256 e a JWKS fica em cache de 1 hora, com piso de um minuto entre recargas quando o `kid` é desconhecido. Vincular pela sessão, e não por endpoint novo: se há cookie de acesso válido no callback, a identidade entra naquele usuário e a sessão atual continua. Vincular por e-mail quando o Google confirma o endereço, marcando o e-mail como verificado — o Google já provou a posse. As variáveis `GOOGLE_*` são opcionais: sem elas o botão responde `GOOGLE_INDISPONIVEL` em vez de derrubar o boot.
**Pendente:** conta criada pelo Google fica com `acceptedTermsVersion` nulo — o front precisa pedir o aceite no primeiro acesso. Definir senha para quem entrou só pelo Google (o `PUT /me/password` de hoje exige a senha atual) continua em aberto.
**Commit:** 328a535

### 2026-10-01 · [api] Implementar conta e sessão

**Fiz:** `0002_auth.sql` (users, sessions, refresh_tokens, auth_identities) e as rotas de `/auth`: registrar, entrar, refresh rotativo, logout, logout-all, sessões, esqueci e redefinir senha. Senha em argon2id, access token JWT de 15 min em `__Host-at` e refresh opaco em `__Secure-rt`, só o hash SHA-256 com pepper no banco.
**Por quê:** é a base de tudo: sem sessão não há conta, e sem conta não há conexão com o TikTok nem dado de pedido.
**Funcionou:** 13 testes com `fastify.inject` contra um Postgres de teste de verdade (criado e migrado pela própria suíte): registra e entra, atributos dos cookies, refresh gira, reuso derruba a família e encerra a sessão, dois refresh simultâneos só giram um, sessão revogada não autentica, logout-all derruba tudo, redefinir senha mata a sessão antiga e o próprio link, e-mail inexistente responde igual a senha errada, 429 no 11º login e 403 sem o `X-Requested-With`. Conferi no ar pelo docker: `Set-Cookie` sai com `HttpOnly; Secure; SameSite=Lax` e o refresh com `Path=/auth/refresh`.
**Não funcionou:** a queima da família estava dentro da transação da rotação — e como a rotação termina lançando 401, o rollback desfazia a própria queima; o token "bom" continuava válido. Passou a ser transação própria. Os tipos do driver também não deixam `TransactionSql` passar por `Sql`, então `Executor` virou união dos dois.
**Decidi:** `__Secure-rt` no lugar de `__Host-rt` (o prefixo `__Host-` exige `Path=/`, e o caminho restrito vale mais que o prefixo). Redefinição de senha sem tabela: JWT de 30 min carregando `credentials_version`, que o próprio reset incrementa — então o link é de uso único de graça. JWT HS256 escrito com `node:crypto`, sem biblioteca. `users` ganhou `avatar_url` e `accepted_terms_version`, que o contrato pede em `SessionUser` e no registro. O índice avulso em `users(email)` e em `refresh_tokens(token_hash)` não foi criado: o `unique` das duas colunas já é esse índice.
**Pendente:** `/auth/session` devolve `accounts: []` porque `provider_connections` ainda não existe. Não há envio de e-mail: o token de redefinição só aparece no log fora de produção. Login com Google (PKCE, JWKS) é a próxima tarefa, e `COOKIE_DOMAIN` segue sem uso enquanto os cookies usarem prefixo.
**Commit:** c0090c9

### 2026-10-01 · [front] Separar acesso à conta de conexão com o TikTok

**Fiz:** canvas e código das telas afetadas pela regra nova. /entrar e /criar-conta com "Continuar com Google" neutro no topo e sem TikTok; o aceite fica acima dos dois caminhos e trava os dois. /recuperar ganhou o estado "esse e-mail entra pelo Google". /inicio-rapido tem três passos opcionais com "Fazer depois" e envio do .xlsx no passo do Shop. /configuracoes separa "Acesso à conta" (senha, Google vinculado, desvincular travado sem senha) de "Contas conectadas" (uma linha por conexão, diálogo de desconectar). Landing com os passos e a confiança novos.
**Por quê:** o TikTok saiu do login (não devolve e-mail e revogar trancaria a creator fora da conta). A interface precisa dizer que a conta é dela e sobrevive ao TikTok desligado.
**Funcionou:** 99 testes, incluindo Google antes do formulário e navegando para `/auth/google/start`, mapa de `?erro=` sem código cru, aceite travando os dois botões, conta só-Google em /recuperar, primeira senha liberando o desvincular, desconectar sem mexer no acesso, e passo adiado que sobrevive à volta à tela. Lint, Prettier, typecheck e build limpos. Conferido no navegador em 390px e no desktop. Varri `web/src` atrás de TikTok como login: o que resta é conexão, marca registrada e FAQ.
**Não funcionou:** o primeiro desenho do diálogo de desconectar dizia que os dados importados ficavam. Isso contradiz Termos, Privacidade, FAQ e a regra da API (apagar em até `PRAZO_EXCLUSAO`). O diálogo segue o texto legal, no canvas e no código. As linhas de conexão espremiam o texto no celular; resolvido com largura mínima no texto, para o botão quebrar a linha.
**Decidi:** "Continuar com Google" é `window.location.assign` para a API, nunca `fetch`. O mapa de erros do Google mora em `lib/textos.ts`. `EnviarRelatorio` (em `components/dados.tsx`) é o atalho único do .xlsx. O bloco de acesso lê `hasPassword` e `identities` de `GET /auth/session`, sem uma segunda chamada: `GET /auth/identities` não é usado pelo front, e o hook e o schema que eu tinha criado para ele saíram. Quem decide o desvínculo continua sendo a API, que responde 409 quando é o único acesso; a tela só não oferece o que seria recusado. "Para depois" no onboarding fica no `localStorage` por usuário, como os avisos lidos: nenhum passo é obrigatório, então isso é conveniência do aparelho, não dado da conta.
**Pendente:** propostas de contrato que a API precisa confirmar:
  - `409 { code: "GOOGLE_ONLY" }` em `/auth/forgot-password` (revela que o e-mail existe; avaliar contra a enumeração).
  - `?acceptedTermsVersion=` em `/auth/google/start` para registrar o aceite de quem cria conta pelo Google.
  - `currentPassword` opcional em `PUT /me/password` quando `hasPassword` é falso.
  - Vincular o Google com sessão aberta passando por `/auth/google/start`.
  - `canUnlink` só existe em `GET /auth/identities`, que o front não usa. Enquanto a regra for "pode desvincular quando `hasPassword`", a sessão basta; se a API passar a ter outro critério, o front precisa do campo em `/auth/session`.
  - Códigos de erro do Google (`cancelado`, `email_nao_verificado`, `expirado`).

  Fora do escopo:
  - "Último arquivo enviado" (`GET /imports`) e o acompanhamento por `GET /imports/:id`.
  - Atalho do .xlsx no `ShopDesconectado` das telas de dados.

  Em dev, o botão do Google cai fora do MSW, porque a navegação não é interceptada.
**Commit:** —

### 2026-10-01 · [api] Criar o esqueleto do backend

**Fiz:** `api/` nasceu com Fastify, Postgres 16 por docker compose, `config/env.ts` validado por Zod, `lib/db.ts` com `one()`/`many()`/transação, handler central de erro com `AppError`, runner de migração próprio e `GET /health`.
**Por quê:** o front já está pronto contra o MSW; sem uma base de API não dá para começar autenticação nem ingestão de pedidos.
**Funcionou:** `docker compose up` sobe banco e API, aplica `0001_init.sql` e responde `{"status":"ok","db":true}` em `localhost:3333/health`; rodar `db:migrate` de novo não reaplica nada; `npm run build` + `npm start` sobe o build compilado; lint, typecheck e 2 testes de fumaça passando.
**Não funcionou:** `node --watch --env-file-if-exists=.env` **quebra** quando o `.env` não existe (o watcher tenta observar o arquivo e estoura ENOENT), então no container o comando roda sem `--env-file` e as variáveis vêm do compose. O teste de CORS que esperava header ausente para origem estranha estava errado: com origem fixa, o `@fastify/cors` sempre anuncia `WEB_ORIGIN` e quem barra é o navegador.
**Decidi:** sem `tsx` nem `ts-node` — o Node 22 roda TypeScript direto, e o `tsc` só serve para o build de produção (`rewriteRelativeImportExtensions`, por isso os imports relativos levam `.ts`). Sem Dockerfile em desenvolvimento: `node:22-bookworm-slim` com o código em volume (bookworm, não alpine, porque o argon2 tem binário pronto para glibc). `pino` não entrou como dependência direta: é o logger do próprio Fastify. `one()` devolve 404 quando não acha linha; linha fora do schema é erro 500, nunca `any` solto. O cookie assinado usa `JWT_SECRET` enquanto não existir um segredo próprio.
**Pendente:** `db/seed.sql` está vazio (não há tabela de domínio ainda) e `scripts/seed-from-mocks.ts` não existe. `controllers/`, `services/`, `repositories/`, `middlewares/` e `types/` estão com `.gitkeep`, esperando a autenticação.
**Commit:** c26148e

### 2026-09-24 · Mapear como o Owra recebe pedidos

**Fiz:** varredura só de leitura focada na entrada de pedidos, registrada em `docs/owra-ingestao-pedidos.md`, separando fato de inferência.
**Por quê:** decidir se o nosso caminho enquanto a API não é liberada passa por import de arquivo, e com qual especificação.
**Funcionou:** o Owra usa os dois: OAuth próprio do TikTok Shop para pedidos (busca a cada 20 min, backfill e reconferência de status por API) e import de `affiliate_orders.xlsx` (só .xlsx, 50 MB, primeira aba, cabeçalho na 1ª linha, colunas validadas por nome e idioma, só BRL, reenvio sem duplicar). Lives usam o export Creator Live Performance.
**Não funcionou:** `app_key`, scopes e a lista exata de colunas não saem sem iniciar o fluxo de autorização ou subir um arquivo; ficaram como não verificáveis.
**Decidi:** nada ainda.
**Pendente:** exportar um `affiliate_orders.xlsx` real para fechar as colunas do nosso parser e confirmar de onde vem o status "Inelegível", que diverge do `CLAUDE.md`.
**Commit:** —

### 2026-09-24 · Analisar o Owra como referência

**Fiz:** varredura do app minha.owra.com.br (13 telas, configurações, integrações, planos) e do site público, registrada em `docs/analise-owra.md`, com ideias e necessidades técnicas.
**Por quê:** o Owra é a principal referência de produto; precisávamos saber o que fazem, como os dados chegam e o que falta para o ShopScanner.
**Funcionou:** a análise mostrou que eles resolvem a falta de API com ingestão híbrida (OAuth de vídeos e pedidos a cada 20 min, import de relatório por arquivo e reconferência de status), estimam lives pelos pedidos e cobram por cota de IA.
**Não funcionou:** nada; nenhuma análise de IA foi disparada na conta, para não gastar a cota.
**Decidi:** nada ainda; as ideias ficam como proposta no documento.
**Pendente:** decidir quais ideias entram (projeção do mês, Pareto, apostas e PWA cabem no front atual; ingestão por arquivo e push pedem backend); investigar a origem do status "inelegível" que o Owra mostra.
**Commit:** —

### 2026-09-23 · Construir o design do canvas no front

**Fiz:** as 45 pranchetas do canvas viraram telas. Casca da área logada (menu lateral, barra inferior com "Mais", topo com conta, período e sino), Início com KPIs, gráficos e os estados sem Shop, primeiro acesso e conexão vencida, novo visual de Vendas, Vídeos (com página própria por vídeo), Produtos, Planejamento e Configurações, a página de Avisos, /termos, /privacidade, a landing, entrar, criar conta, recuperar senha e o início rápido. Entrou o contrato aprovado: `PATCH /me`, `PUT /me/password`, `POST /me/avatar`, `POST /auth/tiktok/start`, `lastSyncedAt`/`expiresAt` em contas, `q` e `shopName` em pedidos e produtos, e os tipos novos de `NotificationSettings`.
**Por quê:** o design define o produto inteiro; as telas anteriores eram funcionais, mas sem a navegação e o visual finais.
**Funcionou:** 93 testes (casca, KPIs com os totais dos mocks, estados do Início, filtros e chips de Vendas, CSV, filtro por loja e "marcar para regravar", vídeos sem Shop sem nenhum R$ 0,00, avisos derivados e lidos, nome da pauta derivado do gancho e renomeável, perfil, senha, foto, meta, entrar, criar conta com força da senha e aceite, recuperar senha e início rápido). Conferi as telas no Chrome, desktop e 390px, sem rolagem horizontal.
**Não funcionou:** o texto oculto da última coluna das tabelas, com posição absoluta, vazava para a largura da página; resolvido com `relative` no contêiner. A mensagem de erro dentro do `<label>` voltou a aparecer no modal novo e saiu do rótulo de novo. O `FormData` do jsdom com arquivo não passa pelo `Request` do Node, então o teste da foto confere o envio antes do MSW.
**Decidi:** números do design são ilustrativos; as telas usam os dados do contrato. Cortados de vez: frete e descontos, prazo de devolução, liquidação prevista, produtos marcados no vídeo, aviso por e-mail do Shop e toda frase "por e-mail" das telas. "Comissões em um lugar só" da landing perdeu "com a data de cada pagamento". A ilustração da landing ganhou o selo "Exemplo". Arrastar no quadro continua com a alternativa por menu, que o design não mostrava. A meta do início rápido é de comissão e a de Configurações é de GMV, como no design; cada tela preserva a outra.
**Pendente:** propostas de contrato, para aprovar: (1) `units` por vídeo em /videos e /videos/:id; (2) `q` e `pageSize` em /videos, hoje a busca é no front com todos os vídeos do período; (3) `pageSize` e os valores de `sort` de /products no contrato (`gmv`, `commission`, `units`, `refunds`); (4) `imageUrl` em `topProducts` e nos SKUs de pedido, para as miniaturas; (5) `user.avatarUrl` e `user.createdAt` na sessão; (6) um endpoint para iniciar a conexão do TikTok Shop, hoje o botão fica desativado; (7) a série de views disponível em /videos, para derivar o aviso `viewsDrop` sem abrir vídeo por vídeo; (8) total de itens em /orders, porque o design conta itens e o contrato pagina pedidos; (9) filtro "todas as contas" para quem tem mais de uma. Também falta preencher `web/src/lib/textos.ts`.
**Commit:** —

### 2026-09-22 · Implementar planejamento e configurações

**Fiz:** /planejamento com quadro de cinco etapas (arrastar e select "mover para"), calendário semanal e modal de roteiro; /configuracoes com perfil, contas conectadas e desconexão, meta do mês, avisos (estado das integrações e preferências) e "Seus dados" com exportar e excluir conta por digitação. Contrato novo `GET/PUT /me/notifications` no MSW, junto com `/me/export` e `DELETE /me`.
**Por quê:** fecha o ciclo "planejar o próximo vídeo" e dá à creator controle sobre conta, metas e dados.
**Funcionou:** 11 testes de tela (mover por select e por arrastar, criar ideia com roteiro e produto, validação do nome, calendário, desconectar, meta em texto decimal e recusa de formato errado, alternar aviso sem e-mail na tela, exportar arquivo, excluir só depois de digitar EXCLUIR) e 2 do `parseMoeda`. Conferi as telas no Chrome.
**Não funcionou:** a mensagem de erro dentro do `<label>` entrava no nome acessível do campo; saiu do rótulo e passou a ser ligada por `aria-describedby`.
**Decidi:** arrastar nativo mais select, sem biblioteca nova (arrastar nativo não funciona no toque); mudança de etapa otimista; produto do roteiro escolhido entre os vendidos nos últimos 90 dias; e-mail de aviso fica no contrato, mas fora da tela; excluir conta leva para `/`. Regras permanentes no `CLAUDE.md`.
**Pendente:** o sino com os avisos derivados de /summary, /orders e /plans; `/` ainda não tem página, então quem exclui a conta cai no "rota não existe"; o perfil é só leitura porque o contrato não tem edição.
**Commit:** bcc175e

### 2026-09-22 · Implementar as telas de vendas, produtos e vídeos

**Fiz:** /vendas (filtros na URL, tabela paginada pelo servidor, painel com divisão da comissão, origem e reembolsos), /produtos (tabela e painel com os vídeos que promoveram) e /videos (grade, ordenação, hashtag e painel com métricas e curva de views com tabela alternativa).
**Por quê:** são as três telas que respondem "o que vendeu, de onde veio e quanto rendeu".
**Funcionou:** 5 testes de tela contra o MSW (filtro de status via URL com 57 pedidos em 3 páginas, painel de venda, estado desconectado, vídeos sem Shop mostrando "disponível quando você conectar" nas 14 linhas e nenhum R$ 0,00, filtro de hashtag). Conferi no Chrome: tabela, painel, grade e tooltip da curva (com leituras simuladas só para a verificação).
**Não funcionou:** o app apareceu escuro no Chrome; era a extensão Dark Reader, não o CSS. Tentei `color-scheme: only light` e desfiz, porque não resolve extensão e o app já é só claro.
**Decidi:** filtros e item aberto na URL; /vendas e /produtos mostram o estado "TikTok Shop não conectado" e nem disparam a consulta; /videos oferece ordenar por GMV e GPM só com o Shop conectado; imagem que falha some e deixa o fundo.
**Pendente:** o contrato não define `pageSize` em /videos e /products; o front assume 20, igual ao MSW. A curva só aparece a partir da segunda leitura, então com os mocks atuais ela não aparece. Falta a navegação entre as telas.
**Commit:** a47da1a

### 2026-09-22 · Implementar a camada de dados sobre o MSW

**Fiz:** schemas Zod de todo o contrato (auth, contas, resumo, pedidos, vídeos, produtos, planos, metas), o adaptador `web/src/mocks/adapters/tiktok.ts` do formato cru para o contrato, handlers do MSW para todos esses endpoints, hooks do TanStack Query com chave por conta e período, e as métricas derivadas em `lib/metrics.ts` com aritmética em centavos (`lib/money.ts`).
**Por quê:** as telas precisam de dados no formato final antes de o backend existir, e as regras do TikTok (status, `actual_*` só em SETTLED, taxas em centésimos) precisam morar num lugar só.
**Funcionou:** os testes do adaptador batem os totais de referência (GMV 11378.50, 80 pedidos, 90 SKUs, 115 itens, estimada 1424.55, a receber 1023.89, liquidada 181.22, perdida 181.67, aguardando 24.28, 15 SKUs de Shop Ads somando 1843.40); um teste passa cada resposta do MSW pelo mesmo Zod do backend real. `npm run build` sai sem MSW nem JSON no bundle.
**Não funcionou:** `mswEnabled` derivado só do objeto `env` deixava o chunk do MSW no build (o bundler não elimina a condição em tempo de execução); a guarda passou a ser `import.meta.env.DEV` direto no `main.tsx`.
**Decidi:** o resumo e a lista de produtos são montados por `lib/metrics.ts` a partir de `Order[]`, então o MSW e a tela usam a mesma regra; `rates.standard` sai por subtração só no adaptador, porque a origem não o traz; demo com `shopConnected: true` e `db.shopConnected` para testar o estado desconectado; nesse estado, `/summary`, `/orders` e `/products` do MSW continuam devolvendo os dados (combinado assim por enquanto). Detalhes permanentes foram para o `CLAUDE.md` ("Camada de dados no front").
**Pendente:** `statusHistory` e `snapshots` do MSW são aproximados, porque a origem não tem datas de transição nem série de views; `byDay` só traz dias com venda.
**Commit:** d3d5a59

### 2026-09-22 · Preparar o repositório

**Fiz:** criei o `CLAUDE.md` com o contexto do produto, o contrato com o backend, as regras da API do TikTok e o design system; adicionei os rascunhos de termos e política em `docs/` e os dados simulados em `mocks/`. Os prompts de construção ficam fora do repositório, colados um a um.
**Por quê:** o Claude Code começa cada sessão sem memória, e as regras da API do TikTok são fáceis de esquecer e caras de errar.
**Funcionou:** os JSONs de `mocks/` foram validados contra a especificação oficial da API, sem nenhum erro de campo ou tipo.
**Não funcionou:** nada a registrar.
**Decidi:** front separado do backend, Vite com React em vez de Next, e todo dado passando por um contrato próprio em vez do formato cru do TikTok.
**Pendente:** rodar o prompt B0 e subir o esqueleto do projeto.
**Commit:** —
