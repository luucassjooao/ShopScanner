# Devlog

Histórico de decisões e aprendizados do projeto. O git guarda o que mudou; aqui fica o porquê, o que funcionou e o que não funcionou.

Regras curtas: entrada nova sempre no topo, uma por tarefa concluída, no mesmo commit da mudança. Sem diff copiado, sem ruído de formatação. Decisão permanente também vai para o `CLAUDE.md`.

---

## Estado atual

_Atualize esta seção quando o estado mudar. Ela é a primeira coisa que se lê ao voltar ao projeto._

- **Fase:** 0 — fundação das duas pontas: front pronto, backend recém-nascido.
- **Rodando:** front em `web/` com o design do canvas aplicado: área logada completa, páginas legais e públicas (lint, typecheck, build e 93 testes passando).
- **Repositório:** git iniciado na raiz (branch `main`), hook do devlog ativo via `core.hooksPath`.
- **Dados:** JSONs simulados em `mocks/`, servidos pelo MSW. O backend em `api/` já sobe, mas ainda não serve nenhuma rota do contrato.
- **Backend:** esqueleto em `api/` (Fastify + Postgres 16 por docker compose, migrações próprias, `GET /health`). Sem tabela de domínio, sem autenticação.
- **Integração TikTok:** Affiliate Creator API não liberada para o Brasil; ticket aberto com a TikTok. Display API disponível, app ainda não submetido.
- **Telas prontas:** /, /entrar, /criar-conta, /recuperar, /termos, /privacidade, /inicio-rapido, /inicio, /vendas, /videos, /videos/:id, /produtos, /planejamento, /configuracoes, /avisos.
- **Próximo passo:** autenticação na API (tabelas, argon2, sessão em cookie); no front, decidir as propostas de contrato da entrada de 23/09 e preencher `web/src/lib/textos.ts`.
- **Bloqueios:** aprovação da categoria "Creator collaborations" para o Brasil; confirmação de que o identificador de conteúdo do pedido é o mesmo id do vídeo.

---

## Entradas

### 2026-10-01 · [api] Criar o esqueleto do backend

**Fiz:** `api/` nasceu com Fastify, Postgres 16 por docker compose, `config/env.ts` validado por Zod, `lib/db.ts` com `one()`/`many()`/transação, handler central de erro com `AppError`, runner de migração próprio e `GET /health`.
**Por quê:** o front já está pronto contra o MSW; sem uma base de API não dá para começar autenticação nem ingestão de pedidos.
**Funcionou:** `docker compose up` sobe banco e API, aplica `0001_init.sql` e responde `{"status":"ok","db":true}` em `localhost:3333/health`; rodar `db:migrate` de novo não reaplica nada; `npm run build` + `npm start` sobe o build compilado; lint, typecheck e 2 testes de fumaça passando.
**Não funcionou:** `node --watch --env-file-if-exists=.env` **quebra** quando o `.env` não existe (o watcher tenta observar o arquivo e estoura ENOENT), então no container o comando roda sem `--env-file` e as variáveis vêm do compose. O teste de CORS que esperava header ausente para origem estranha estava errado: com origem fixa, o `@fastify/cors` sempre anuncia `WEB_ORIGIN` e quem barra é o navegador.
**Decidi:** sem `tsx` nem `ts-node` — o Node 22 roda TypeScript direto, e o `tsc` só serve para o build de produção (`rewriteRelativeImportExtensions`, por isso os imports relativos levam `.ts`). Sem Dockerfile em desenvolvimento: `node:22-bookworm-slim` com o código em volume (bookworm, não alpine, porque o argon2 tem binário pronto para glibc). `pino` não entrou como dependência direta: é o logger do próprio Fastify. `one()` devolve 404 quando não acha linha; linha fora do schema é erro 500, nunca `any` solto. O cookie assinado usa `JWT_SECRET` enquanto não existir um segredo próprio.
**Pendente:** `db/seed.sql` está vazio (não há tabela de domínio ainda) e `scripts/seed-from-mocks.ts` não existe. `controllers/`, `services/`, `repositories/`, `middlewares/` e `types/` estão com `.gitkeep`, esperando a autenticação.
**Commit:** —

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
