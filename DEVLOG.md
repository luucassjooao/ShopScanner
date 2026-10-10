# Devlog

Histórico de decisões e aprendizados do projeto. O git guarda o que mudou; aqui fica o porquê, o que funcionou e o que não funcionou.

Regras curtas: entrada nova sempre no topo, uma por tarefa concluída, no mesmo commit da mudança. Sem diff copiado, sem ruído de formatação. Decisão permanente também vai para o `CLAUDE.md`.

---

## Estado atual

_Atualize esta seção quando o estado mudar. Ela é a primeira coisa que se lê ao voltar ao projeto._

- **Fase:** 2 — alinhar as duas pontas já ligadas. O front fala com a API de verdade desde `9baebee`; os totais de referência batem por HTTP. O que resta é varredura de tela e as rotas que faltam.
- **Rodando:** front em `web/` com a área logada completa, páginas legais e públicas, acesso por e-mail ou Google, TikTok só como conexão, e a entrada de pedidos por arquivo `.xlsx` (lint, typecheck e 186 testes passando). Estrutura: uma pasta por página em `src/pages/`, cascas em `src/layouts/`, `src/routes/router.tsx` só com rota e guarda, `src/auth/guarda.ts` com a guarda.
- **Números:** o topo do Início é o GMV elegível; os gráficos são brutos e dizem isso no título e na nota.
- **Repositório:** git na raiz (branch `main`), hook do devlog ativo via `core.hooksPath`. Três sessões trabalham no mesmo repositório em paralelo: front só em `web/`, API só em `api/`, e o `CLAUDE.md` da raiz só pela sessão líder. `DEVLOG.md` é compartilhado e cada sessão commita a entrada dela junto com a mudança.
- **Dados:** JSONs simulados em `mocks/`, servidos pelo MSW. O banco de desenvolvimento está semeado: a conta demo tem só `VIDEOS` e os pedidos entram como `FILE`.
- **Backend:** `api/` serve conta, sessão, Google, conexão com o TikTok, `PATCH /me`, e o contrato de dados (`/summary`, `/orders`, `/videos`, `/products`, `/plans`, `/goals`, `/me/notifications`, `/me/export`, `DELETE /me`) sobre o banco, e agora `/imports` (envio, listagem e lote) e o avatar (`POST` e `GET /me/avatar`), com 91 testes. Falta o parser do `.xlsx` (espera a planilha real), `/reconciliation` e a sincronização com o TikTok. `/payouts` saiu do contrato.
- **Gatilho de venda:** nenhuma tela ramifica em `shopConnected`. Venda aparece por `hasSales` (conta) e pelo total do período; `shopConnected` descreve só a conexão viva. Vale nas duas pontas, e o seed não mente mais sobre isso.
- **Guarda de rota (front):** `loader` do React Router 7, em `src/auth/guarda.ts`, um só para os dois sentidos — rota do app sem sessão vai para `/entrar?proxima=`, rota de entrada (`/`, `/entrar`, `/criar-conta`, `/recuperar`) com sessão vai para `/inicio`. `/termos` e `/privacidade` não têm guarda, de propósito. Quem decide é o backend, por `GET /auth/session`; nada em `localStorage`.
- **Item de pedido:** a chave é `orderId` mais `lineNo`, nunca o `id` do SKU, que repete em linhas diferentes do mesmo pedido (um pedido assim existe nos dados: `5750596296`, duas linhas do SKU `17321495`). `lineNo` vai cru, a partir de 0, e nunca aparece em tela. `/reconciliation` já nasce com o campo.
- **401 no front:** não significa mais "deslogado" de primeira. `request()` e `upload()` renovam por `POST /auth/refresh` uma vez, com promessa compartilhada, e repetem. Nenhuma tela deve tratar o primeiro 401 como sessão perdida.
- **Google:** app criado no Google Cloud e as três `GOOGLE_*` preenchidas no `api/.env`. `/auth/google/start` redireciona de verdade, com PKCE, `state` e `nonce`. Falta o único teste que prova o fluxo inteiro: entrar pelo navegador com conta Google real.
- **Erro:** corpo de erro é `{ code, message }` em toda rota, definido no contrato. O `code` é traduzido no front por `lib/textos.ts`; o `message` é técnico e nunca chega à tela.
- **Integração TikTok:** Affiliate Creator API não liberada para o Brasil; ticket aberto. Display API disponível, app ainda não submetido.
- **Telas prontas:** /, /entrar, /criar-conta, /recuperar, /termos, /privacidade, /inicio-rapido, /inicio, /vendas, /videos, /videos/:id, /produtos, /planejamento, /configuracoes, /avisos, /reconciliacao.
- **Próximo passo:** a varredura das 16 telas contra a API real — é a primeira vez que o front vê o estado real de um usuário (conta sem `SHOP`, pedidos `FILE`) e as rotas que faltavam de manhã (`/imports`, avatar) já existem. Fora isso, as duas pontas estão esperando coisas de fora: a API ficou sem tarefa não travada.
- **Ponto cego conhecido:** as duas suítes testam cada ponta contra si mesma — `fastify.inject` não aplica CORS e o MSW não é navegador —, então nenhuma enxerga a junta entre as duas origens. Três defeitos saíram de lá em dois dias: `Access-Control-Allow-Methods` sem `PATCH/PUT/DELETE` (matava nove mutações), `Cross-Origin-Resource-Policy` do helmet (bloqueava o avatar) e `Retry-After` não exposto (sumia o tempo de espera do 429). Dois dos três foram achados por leitura, não por teste. Rota ou header novo: pergunte o que só o navegador vê.
- **Erros de recusa:** três códigos nasceram hoje do mesmo princípio — `PARSER_UNAVAILABLE`, `IMAGEM_MUITO_GRANDE` e `IMAGEM_INVALIDA`. Código que agrupa situações com saídas diferentes obriga a tela a mentir ou a mandar a pessoa adivinhar. Antes de reusar um código existente, pergunte se as duas situações pedem a mesma ação.
- **Bloqueios:** (1) os dados legais de `web/src/lib/textos.ts` (CNPJ, razão social, endereço, e-mail de contato, comarca, encarregado) — `/termos` e `/privacidade` vão para a revisão do app no TikTok; (2) o `affiliate_orders.xlsx` real, que fecha a seção 3 de `docs/parser-affiliate-orders.md`; (3) aprovação da categoria "Creator collaborations" para o Brasil; (4) confirmação de que o `contentId` do pedido é o mesmo id do vídeo; (5) cadastrar `http://localhost:3333/auth/google/callback` como redirect URI no console do Google e, se o app estiver em "Testing", a conta de teste na lista de usuários — sem isso o login social recusa.
  Saíram: os segredos do `api/.env` (corrigidos pelo dono, e `32d8eb1` passou a tratar opcional vazia como ausente) e a aprovação de `@fastify/multipart` (aprovada em 09/10/2026).

---

## Entradas

### 2026-10-10 · [repo] Corrigir o dano que eu atribuí à chave repetida, e levar `lineNo` para a reconciliação

**Fiz:** duas coisas. (1) Registro aqui que eu afirmei um dano que não se confirmou: disse, ao dono e nas instruções das sessões, que a chave de React repetida fazia **a linha de dinheiro desaparecer da tela**. Não desaparece. (2) `GET /reconciliation` ganhou `lineNo` na linha de divergência, pelo mesmo motivo de `OrderSku`.
**Por quê:** a sessão do front tentou fazer o teste da lista falhar com a chave antiga e **não conseguiu** — React 19.3 no jsdom renderiza as duas linhas e nem emite aviso de chave duplicada, mesmo com re-render forçado por navegação. Ela relatou isso em vez de escrever um teste verde que não provava nada, e é o relato que vale: quem fez o experimento foi ela.
**Funcionou:** o defeito **real** é outro e foi reproduzido: `?item=` usava `sku.id`, que repete, então o painel de detalhe abria **sempre a linha 0**. Clicar na linha de 2 unidades (R$ 109,80) mostrava a de 1 unidade (R$ 54,90). Isso falha com a versão antiga por construção, e é um erro de leitura de dinheiro em tela — só não é o erro que eu descrevi. O pedido existe nos dados reais: `5750596296`, SKU `17321495` em duas linhas.
**Não funcionou:** a minha dedução. Chave duplicada em React é defeito de verdade — ele avisa por um motivo, e estado pode se colar na linha errada em reordenação —, mas eu pulei de "chave duplicada" para "linha some" sem verificar, e repeti isso como fato três vezes. A correção não muda: chavear por `lineNo` está certo pelos dois motivos. O que muda é o que eu podia afirmar.
**Decidi:** `lineNo` entra na linha de `/reconciliation` agora, antes de a rota existir, porque `orderId + skuId + field` tem exatamente a mesma ambiguidade — mesmo SKU repetido com divergência colide. A rota não está implementada, então custa uma linha hoje e custaria um defeito silencioso depois. Achado pela sessão do front.
**Commit:** a seguir
**Commit:** a registrar

### 2026-10-10 · [front] Chavear os itens de pedido por lineNo

**Fiz:** `OrderSku.lineNo` entra no schema. As chaves das duas listas de `/vendas` (tabela e cartões) passam a ser pedido mais `lineNo`, no lugar da posição no array. O detalhe da venda abre pelo `lineNo` (`?item=`), e não pelo id do SKU, que repete. O MSW passa a mandar `lineNo` a partir de 0, em `adaptSku`.
**Por quê:** o id do SKU no TikTok repete em linhas diferentes do mesmo pedido. O pedido `575059629618826862` tem o SKU `1732149525334652475` duas vezes, com R$ 54,90 e R$ 109,80. Chave e busca por id deixam de identificar a linha.
**Funcionou:** teste do MSW que confirma o pedido duplicado com `lineNo` 0 e 1; teste do detalhe que abre a linha 1 (2 unidades) e não a 0; teste da lista com as duas linhas e os dois valores. 186 testes, typecheck, lint e prettier limpos.
**Não funcionou:** tentei travar o defeito de chave com um teste que falhasse com a chave antiga, e não consegui. Com a chave `pedido + sku` e um re-render, o React 19.3 no jsdom continua mostrando as duas linhas, sem aviso de chave repetida. O defeito de "linha que some" não reproduziu neste ambiente; a troca fica pela correção de identidade (o detalhe, de fato, pegava a linha errada) e pelo contrato.
**Decidi:** `lineNo` é chave, não rótulo: não aparece em tela, e o valor é o cru a partir de 0 do contrato. As outras listas de item (CSV, avisos, métricas) não têm chave de React nem `Map` por item, então não precisaram de mudança.
**Pendente:** `/reconciliacao` monta a chave com `orderId + skuId + field`, e o contrato da reconciliação não traz `lineNo`. Se um pedido repetir o SKU com divergência, a chave pode colidir. Não mudei o contrato; o dono decide.
**Commit:** 7036b4c

### 2026-10-10 · [api] lineNo cru, a partir de 0, sem soma na consulta

**Fiz:** `lineNo` sai como `line_no` do banco, sem `+ 1`. O comentário sobre a base que avisava o import foi removido, porque deixou de haver tradução. O teste do pedido com duas linhas do mesmo SKU agora espera 0 e 1.
**Por quê:** o contrato (`59cf9e3`) passou a dizer que `lineNo` é chave e não rótulo, então ele vai cru. A soma de 1 era aritmética na borda que não compra nada e cria uma base que todo escritor futuro precisaria lembrar.
**Funcionou:** 91 de 91 testes. Typecheck, lint e prettier limpos. Os totais de referência não mudam, porque nenhum deles depende de `lineNo`.
**Não funcionou:** nada.
**Decidi:** campo que serve de chave vai cru do banco. Isso vale para qualquer rota nova.
**Pendente:** nada nesta tarefa.
**Commit:** 00ebc7b

### 2026-10-10 · [repo] Tirar o +1 do lineNo: o campo vai cru, a partir de 0

**Fiz:** desfiz uma decisão minha de um commit atrás. `OrderSku.lineNo` passa a ir **cru, a partir de 0**, igual ao banco, em vez de "a partir de 1" com a API somando na leitura. O contrato também passou a dizer que `lineNo` é chave e não rótulo: nunca aparece em tela.
**Por quê:** eu escrevi "a partir de 1" em `39b8f6a` sem saber que `order_skus.line_no` é gravado a partir de 0, pelo índice do array. A API cumpriu com `line_no + 1 as line_no` na consulta — correto para o que eu pedi, e a sessão fez certo em registrar a consequência: quando o import de arquivo gravar `line_no`, ele tem de usar base 0, senão a conta sai errada. Essa frase é uma mina. Ela mora no caminho de dados mais importante do MVP, num trabalho que ainda não começou, e cobra de todo escritor futuro lembrar que a base é outra do lado de fora.
**Funcionou:** a troca não custa nada. `lineNo` existe só para identificar a linha — nenhum número do produto depende de onde ela começa, e nenhuma tela mostra o valor. Conferi antes que a soma estava numa consulta só (`itensDosPedidos`, usada pela lista **e** pelo detalhe), então não havia divergência entre os dois endpoints; se houvesse, a chave do front mudaria entre a lista e o painel.
**Não funcionou:** a alternativa de normalizar o banco para base 1 foi descartada sem tentar: exigiria migração para mudar dado que não precisa mudar, e migração aplicada não se edita.
**Decidi:** a regra geral, que é o que sobra disso — **aritmética na borda só para o campo ficar bonito é defeito esperando a próxima pessoa.** Campo que serve de chave vai cru. Se um dia algum número do produto passar a depender da base, aí sim se escolhe uma e se escreve.
**Pendente:** a API tira o `+ 1` da consulta; o front chaveia por `lineNo` sem presumir base.
**Commit:** 59cf9e3

### 2026-10-10 · [api] Expor lineNo no item do pedido

**Fiz:** `OrderSku` ganhou `lineNo` em `GET /orders` e `GET /orders/:id`, a posição da linha no pedido a partir de 1. Sem ele o front montava a chave com `pedido.id + sku.id`, que se repete, e o React descartava uma linha de dinheiro sem erro.
**Por quê:** `order_skus.id` repete em linhas diferentes do mesmo pedido, e o `line_no` já existia no banco, mas a consulta de itens só selecionava `id`.
**Funcionou:** 91 de 91 testes. O caso que gerou o defeito está travado em `data.test.ts`: o pedido com duas linhas do mesmo SKU devolve `lineNo` 1 e 2. Os totais de referência continuam batendo (90 linhas, 115 itens, R$ 11.378,50). Typecheck, lint e prettier limpos.
**Não funcionou:** nada.
**Decidi:** `line_no` é gravado a partir de 0 (seed e import, pelo índice do array), e o banco **não** mudou. A soma de 1 acontece em uma única consulta, `line_no + 1 as line_no` em `repositories/orders.ts`, para o contrato contar a partir de 1. Quando o import de arquivo gravar `line_no`, precisa seguir a mesma base 0; senão a soma fica duplicada ou a conta sai errada. Está comentado no repositório.
**Pendente:** o import real ainda não existe, então essa regra de base ainda não foi exercitada fora do seed.
**Commit:** fddf772

### 2026-10-10 · [repo] Expor `lineNo` no item do pedido, porque `id` não identifica linha

**Fiz:** `OrderSku` ganhou `lineNo` (posição da linha no pedido, a partir de 1) e o contrato passou a dizer, com estas palavras, que `id` **não** é único dentro do pedido. A chave de um item é pedido mais `lineNo`.
**Por quê:** o relatório do TikTok repete o mesmo id de SKU em linhas diferentes do mesmo pedido, e o `api/CLAUDE.MD` já registrava isso — a chave de `order_skus` carrega `line_no` justamente por causa disso. Mas o contrato expunha só `id`, então o front não tinha como montar chave única, usou `pedido.id + sku.id`, e o React descartou a linha repetida: uma linha de dinheiro desapareceu de `/vendas` sem erro, sem log, sem nada estourar. O número só ficou menor.
**Funcionou:** achado pelo agente do front durante a reestruturação, e confirmado por mim na origem: `api/src/repositories/orders.ts:220` seleciona `order_skus.id` como `id`, e `line_no` só aparece no `order by`. Não era defeito de mock — a API real devolve o duplicado igual.
**Não funcionou:** a correção de primeira hora foi a posição no array, que funciona e não mente, mas depende da ordem da resposta e não está escrita em lugar nenhum. Trocada por um campo do contrato, que é o que o banco já tinha.
**Decidi:** expor o campo em vez de só documentar a armadilha. Documentar deixaria todo consumidor futuro derivando chave por conta própria, e o dado existe no banco desde a migração — é uma coluna no `select`.
**Pendente:** a API devolve `lineNo` em `/orders` e `/orders/:id`; depois o front chaveia por ele, no schema e na tela, e o MSW passa a mandar.
**Commit:** 39b8f6a

### 2026-10-10 · [repo] Registrar os três riscos de segurança que a auditoria deixou de propósito

**Fiz:** anotei, para não evaporarem no relatório de um agente, os três pontos que a auditoria de autenticação identificou e decidiu não mexer. Nenhum é defeito hoje; todos viram defeito em produção.
**Por quê:** risco conhecido que só existe na memória de quem auditou é risco esquecido. Os três:
1. **`trustProxy: isProd` (`api/src/app.ts:25`)** confia na cadeia inteira de `X-Forwarded-For`. Em produção isso permite forjar o IP de origem e escapar do teto por IP e da trava de tentativas de login. O certo é `trustProxy: 1` ou o CIDR do proxy — e depende de saber qual é a hospedagem, que ainda não existe.
2. **`SameSite=Lax` só funciona enquanto front e API ficarem no mesmo domínio registrável.** Hoje são `localhost:5173` e `:3333`, e `app.dominio` com `api.dominio` continuaria valendo. Em domínios diferentes o navegador deixa de mandar o cookie em qualquer chamada da SPA e a sessão simplesmente não existe; aí o atributo vira `SameSite=None` e o anti-CSRF passa a depender só do `X-Requested-With` mais o CORS.
3. **O cookie do fluxo OAuth é assinado com o mesmo `JWT_SECRET` do access token** (`api/src/app.ts:38`). A auditoria procurou caminho explorável e não achou, mas é separação de chave que falta. Custa uma variável de ambiente nova.
**Funcionou:** os três saíram de uma auditoria em que sete dos oito pontos estavam corretos — o valor dela foi tanto o defeito que achou quanto estes riscos que soube não consertar agora.
**Não funcionou:** nada tentado. Consertar o 1 sem saber a hospedagem seria chutar o formato do proxy.
**Decidi:** nenhum dos três entra agora. O 1 e o 2 são condição de implantação e entram no mesmo trabalho em que a produção for definida; o 3 é decisão do dono, porque mexe em variável de ambiente dele.
**Pendente:** os três, nos termos acima.
**Commit:** 39b8f6a

### 2026-10-10 · [front] Renovar a sessão no 401 antes de mandar entrar de novo

**Fiz:** `request()` e `upload()`, em `src/api/client.ts`, passaram a chamar `POST /auth/refresh` **uma vez** ao tomar 401 e a repetir a requisição original. Só se a renovação falhar o `nao_autenticado` chega à tela. A renovação é uma promessa compartilhada (`renovarSessao`): a primeira chamada dispara, as outras esperam a mesma promessa. `/auth/refresh` e `/auth/login` ficam fora — 401 ali é credencial morta, não token vencido. O MSW ganhou o handler de `/auth/refresh` (204 com sessão, 401 sem).

**Por quê:** o front nunca chamava essa rota, apesar de o contrato da raiz e o `web/CLAUDE.MD` mandarem. O access token dura 15 minutos e o refresh 30 dias, então qualquer aba aberta por mais de 15 minutos — ou qualquer pessoa que voltasse ao app depois disso — era jogada em `/entrar` com a sessão perfeitamente válida no servidor. O front jogava no lixo uma sessão que o backend ainda considerava boa.

**Funcionou:** 183 testes em 19 arquivos (eram 178), lint, typecheck e prettier limpos. Cinco testes novos em `api/client.test.ts`: 401 renova e repete devolvendo o dado; cinco requisições vencendo juntas disparam **uma** renovação; 401 na própria renovação não vira laço; 401 no login não renova; renovação recusada deixa o `nao_autenticado` subir, com duas chamadas e nenhuma repetição inútil. Contra a API de pé em `localhost:3333`: `POST /auth/refresh` sem o cabeçalho responde 403 e com ele responde 401 sem cookie — ou seja, o `X-Requested-With` é obrigatório e está sendo mandado.

**Não funcionou:** a tentativa de exercitar o fluxo inteiro contra a API real parou no login: as credenciais do seed não são as que eu tinha. O comportamento da rota foi conferido por `curl` (403 sem cabeçalho, 401 sem cookie), e a lógica de renovação está coberta por teste; o fluxo com cookie de verdade continua sendo coisa de navegador.

**Decidi:** a renovação é compartilhada por desenho, não por acaso — uma tela faz de 8 a 10 consultas e todas tomam 401 no mesmo instante, e vários `POST /auth/refresh` em paralelo são exatamente o que o servidor lê como refresh token roubado (foi o defeito corrigido em `5d4eb34`). O front não provoca isso. E a correção foi no lugar compartilhado: `upload()` tem o mesmo buraco que `request()`, então as duas portas renovam, com a mesma promessa — quem ficou dez minutos na tela de import não perde o arquivo por um token vencido. A barra de progresso volta a zero na repetição, e isso está dito no código.

**Pendente:** nada nesta tarefa. Fica valendo a regra: 401 só significa "deslogado" depois de a renovação falhar — nenhuma tela deve tratar o primeiro 401 como sessão perdida.

**Commit:** db21d3c

### 2026-10-10 · [front] Uma pasta por página e a guarda de rota no loader

**Fiz:** `src/routes/` passou a ser só definição de rota. Cada tela virou `src/pages/<pagina>/index.tsx` (com as peças que só ela usa ao lado), as cascas foram para `src/layouts/`, e `filtros.ts`/`useAvisos.ts` desceram para `lib/`, que é onde quase toda tela os consome. `App.tsx` ficou com os providers, `bootstrap.ts` com o MSW e o service worker, e `main.tsx` só com a renderização. A guarda de autenticação virou um fabricante de `loader` em `src/auth/guarda.ts`, usado nos dois sentidos. Os imports migraram de `react-router-dom` para `react-router`, e o `-dom` saiu do `package.json`.

**Por quê:** a aplicação inteira morava em `routes/`, e a guarda morava dentro do `AppLayout` — ou seja, rodava durante o render, estava duplicada em `InicioRapido` e não existia do lado público. O furo que isso abria: logado, `/` mostrava a landing, e nenhuma rota de entrada expulsava quem já tinha sessão.

**Funcionou:** 178 testes em 19 arquivos (eram 172), lint, typecheck, prettier e `npm run build` limpos. `test/guarda.test.tsx` trava os dois casos que importam: logado, `/` vai para `/inicio`; logado, `/termos` e `/privacidade` continuam abrindo. Mais: sem sessão a rota do app vai para `/entrar` carregando `?proxima=` com a rota interrompida, e falha de rede na sessão mostra erro em vez de mandar entrar de novo. A pesquisa da v7 valeu em dois pontos que eu não teria adivinhado: `loader` + `redirect()` roda antes da renderização (é o mecanismo próprio da versão, não precisa de componente-sentinela), e `fetchQuery` do TanStack Query é o primitivo certo para um guarda — `ensureQueryData` devolve cache marcado como velho sem perguntar, então sair da conta deixaria a sessão antiga valendo e a guarda abriria o app para quem saiu.

**Não funcionou:** (1) a primeira versão não tinha `shouldRevalidate`, e o loader revalidava a cada troca de parâmetro na URL. Como os filtros moram na URL, clicar numa linha de venda re-renderizava a árvore no meio do clique e o painel de detalhe não abria — um teste verde há semanas ficou vermelho. A guarda só precisa correr quando o caminho muda. (2) Investigando isso apareceu um defeito de verdade: a chave React das linhas de venda era `pedido.id + sku.id`, e esse par **não é único** — os mocks do TikTok têm um pedido com duas linhas do mesmo `sku_id`. Chave repetida faz o React sumir com uma linha de dinheiro; passou a entrar a posição também. (3) Não copiei o padrão do repositório de referência (`jstack-edu/live019`): a guarda dele lê um booleano de `localStorage` com `accessToken` e `refreshToken` dentro. Peguei só a forma — um guarda só com `isPrivate`, rota protegida declarada no router. (4) Não dividi as suítes de teste por página: `telas.test.tsx` e as outras montam o app inteiro em várias rotas, então são testes de integração, não de página; foram para `src/test/`, ao lado do helper `abrir()`, sem perder nenhum caso. (5) Não anotei tipo de retorno em todo componente de página: `: ReactElement` em 16 arquivos é ruído. Anotei o que cruza fronteira de módulo — `lib/filtros.ts` ganhou `Intervalo` e `Filtros` nomeados, e os arquivos novos nasceram com props e retornos explícitos.

**Decidi:** peça que uma página só usa desce para a pasta daquela página; duas ou mais, sobe para `components/` ou `lib/`. A guarda é `loader`, nunca componente, e é uma só para os dois sentidos. `/termos` e `/privacidade` não têm guarda nenhuma e não consultam a sessão — elas vão para a revisão do app no TikTok. Quem lê a sessão é `useSession()` nos componentes e `lerSessao()` nos loaders; nenhuma tela chama `useQuery(sessionQuery)` por conta própria. `Intervalo` é `type`, e não `interface`, porque só o alias é aceito onde se espera `Record<string, string | null>`.

**Pendente:** `src/pages/configuracoes/index.tsx` tem 1.056 linhas e `vendas/index.tsx` 682: pedem as mesmas peças por fora que os vídeos ganharam, mas isso é outra tarefa. A primeira pintura agora espera o loader da sessão; com a API local a mais de 300 ms isso aparece como skeleton, e vale medir antes de aceitar.

**Commit:** b25d418

### 2026-10-10 · [api] Parar de derrubar a sessão quando duas abas giram o refresh juntas

**Fiz:** auditoria da autenticação do servidor (sessão, rotação, `credentials_version`, cookies, header de CSRF, logout, rate limit, recuperação de senha) e a correção do único defeito que ela achou. `POST /auth/refresh` que não consegue marcar o token como usado — porque outra requisição marcou primeiro, ou porque o token já estava usado há poucos segundos — passa a responder 204 com access token novo e **sem** refresh novo, em vez de 401 apagando os dois cookies. A janela em que um refresh já girado ainda conta como retentativa é `GRACA_REUSO_SEGUNDOS = 30`; fora dela, reuso continua queimando a família inteira e revogando a sessão.

**Por quê:** duas abas tomando 401 juntas é o caso normal — o contrato manda o front chamar `/auth/refresh` uma vez ao tomar 401 —, e o servidor tratava isso como roubo de token. Com as duas chamadas quase simultâneas, a segunda caía na detecção de reuso: família queimada, sessão revogada, as **duas** abas no login e um alarme falso de "refresh token reutilizado" no log. Quando a segunda chegava dentro de milissegundos, caía no `UPDATE` condicional e tomava 401 — e a resposta do 401 vinha com `Set-Cookie` de remoção dos dois cookies, apagando no navegador a sessão que a requisição vencedora acabou de gravar. Nos dois caminhos a sessão estava viva no banco e a pessoa era expulsa dela.

**Funcionou:** 91 de 91 testes, lint, typecheck e prettier limpos. O teste `dois refresh com o mesmo cookie` agora exige 204 nos dois, um único refresh novo, nenhum cookie apagado e os dois access tokens autenticando em `/auth/session`; o teste de reuso envelhece `used_at` para além da janela e continua exigindo família queimada e sessão encerrada. Conferido também por `curl` contra a API de pé: dois refresh em paralelo com o mesmo cookie dão 204 e 204, o perdedor manda só `__Host-at`, e o mesmo token com `used_at` recuado 31s volta 401 com `REUSO_DE_REFRESH` na sessão e o aviso no log. O resto da auditoria bateu com o que o `CLAUDE.MD` promete: `__Host-at` com `Path=/` e `__Secure-rt` com `Path=/auth/refresh`, os dois `httpOnly; Secure; SameSite=Lax` e sem `Domain`, conferidos numa resposta real; as 21 rotas que mudam estado respondem 403 `CABECALHO_AUSENTE` sem o `X-Requested-With` e o preflight de `OPTIONS` passa; access token de antes do logout já não autentica, porque o middleware confere sessão revogada e `credentials_version` a cada requisição; `/auth/forgot-password` responde 204 com corpo vazio para e-mail que existe e para e-mail que não existe, em tempo igual; e-mail inexistente e senha errada levam o mesmo tempo (~48ms nos dois) e a mesma mensagem, porque `conferirSenha` gasta um argon2 descartável quando não há hash.

**Não funcionou:** a primeira versão da correção mexeu só no `UPDATE` condicional, e o teste mostrou na hora que o caso real não passa por ali: com `Promise.all`, a segunda requisição chega depois do commit da primeira e cai na **detecção de reuso**, não na corrida. A premissa do `CLAUDE.MD` de que o `UPDATE` condicional "fecha a corrida entre dois refreshes simultâneos" estava certa sobre consistência (nunca nascem duas famílias) e errada sobre sessão: o que o usuário sentia vinha do outro ramo. Foi o teste que corrigiu o diagnóstico.

**Decidi:** a janela de graça é a prática corrente para rotação com detecção de reuso (WorkOS usa 30s, Endurain 60s, Ory recomenda limitar a contagem de reuso dentro dela) e existe exatamente para não confundir retentativa com roubo. O preço está escolhido e escrito no `CLAUDE.MD` da API: token roubado apresentado dentro da janela ganha um access token de 15 minutos, **sem** refresh, e o roubo é detectado na rotação legítima seguinte. Sem cache de token em claro e sem devolver o par rotacionado ao retardatário, que é o que as implementações com grace fazem: aqui o retardatário sai só com access token, o que já o mantém dentro do app. O limite de 20 requisições por 5 minutos em `/auth/refresh` é o que limita a contagem de reuso dentro da janela. Nada disso toca o contrato: mesma rota, mesmo 204, mesmo corpo de erro.

**Pendente:** três coisas que a auditoria achou e **não** são minhas. (1) O front não chama `/auth/refresh` em lugar nenhum (`grep -rn "auth/refresh" web/src` não acha nada), então hoje toda aba com mais de 15 minutos simplesmente cai no login — a correção acima só vale quando o front passar a girar. (2) `trustProxy: isProd` em `src/app.ts:25` confia na cadeia inteira de `X-Forwarded-For`: em produção, atrás de um proxy, dá para forjar o IP e escapar do limite por IP e da trava de login por IP mais e-mail; o certo é o número de saltos (`trustProxy: 1`) ou o CIDR do proxy, e isso depende de uma hospedagem que ainda não foi escolhida. (3) `SameSite=Lax` só funciona enquanto front e API ficarem no mesmo domínio registrável (hoje `localhost:5173` e `localhost:3333`, amanhã `app.` e `api.` do mesmo domínio): em domínios diferentes o navegador não manda o cookie em nenhuma chamada da SPA e a sessão para de existir, e aí o atributo tem de virar `SameSite=None`, com o `X-Requested-With` e o CORS assumindo sozinhos o papel anti-CSRF.

**Commit:** 5d4eb34

### 2026-10-10 · [api] Expor Retry-After no CORS

**Fiz:** o registro do cors passa a declarar `exposedHeaders: ['Retry-After']`. Sem isso o navegador esconde o header da resposta entre origens, e `web/src/api/client.ts` lia `null` no 429.
**Por quê:** o contrato (`0ca5b0b`) exige que todo header de resposta que o front lê esteja exposto, ou não existe para ele.
**Funcionou:** 91 de 91 testes. Um teste novo em `cors.test.ts` confere `Access-Control-Expose-Headers` numa resposta real com `Origin`, não só no preflight. Typecheck, lint e prettier limpos.
**Não funcionou:** nada.
**Decidi:** conferi os outros headers que o front lê, para não expor o que não é preciso. `X-Nome-Arquivo` vem do cache do service worker, não da API. O front não lê `Content-Disposition` do `GET /me/export`: ele baixa o JSON e monta o nome do arquivo sozinho. Não há mais header de resposta da API que o front precise ler.
**Pendente:** nada nesta tarefa. A API segue parada: o restante depende de fatores de fora (parser, liberação do Brasil, reconciliação).
**Commit:** da5abf5

### 2026-10-10 · [repo] Exigir `Retry-After` exposto no CORS

**Fiz:** o contrato passou a exigir `Retry-After` em `Access-Control-Expose-Headers`.
**Por quê:** cross-origin, o JavaScript só lê headers de resposta safelisted, e `Retry-After` não é um deles. `web/src/api/client.ts:220` faz `response.headers.get('Retry-After')` e recebe `null` no navegador, então o aviso de 429 perde o tempo de espera — que este mesmo contrato manda mostrar, e que a API manda corretamente em segundos. O header chega na resposta e é o navegador que o esconde do front.
**Funcionou:** achado pela sessão da API **antes** de implementar, quando pedi que ela pensasse se havia mais algo que só o navegador vê. Era o terceiro defeito da mesma família, depois do `Access-Control-Allow-Methods` e do `Cross-Origin-Resource-Policy` do helmet.
**Não funcionou:** nada. Conferi que o front realmente lê o header antes de aprovar, em vez de aceitar o relato.
**Decidi:** a regra geral, que é o que vale daqui para a frente: **header de resposta que o front precisa ler entra em `Access-Control-Expose-Headers`, ou não existe para ele.** Isso vale para qualquer header futuro, não só `Retry-After`.
**Pendente:** a API expõe o header e cobre no mesmo arquivo de teste do preflight.
**Commit:** 0ca5b0b

### 2026-10-10 · [api] Declarar PATCH, PUT e DELETE no CORS e voltar do Google para dentro do app

**Fiz:** o `@fastify/cors` passa a receber `methods` explícito (`GET,HEAD,POST,PUT,PATCH,DELETE`). O callback do Google sem sessão anterior volta para `/inicio`, e quem só vinculou o Google volta para `/configuracoes`. A landing deixou de ser destino.
**Por quê:** o padrão do cors v11 é só `GET,HEAD,POST`. O navegador descartava a resposta de toda mutação que não fosse POST, e a pessoa via falha de rede. O dono reproduziu isso: nove rotas mortas, incluindo o `PATCH /me` do aceite de termos, o que trancava a conta do Google. O callback mandava para a landing, sem caminho para dentro.
**Funcionou:** 90 de 90 testes. `cors.test.ts` lê o preflight de `PATCH`, `PUT`, `DELETE`, `POST` e `GET`, e confere `Access-Control-Allow-Methods`, a origem e as credenciais. `google.test.ts` agora espera `/inicio` no login e `/configuracoes` no vínculo. Typecheck, lint e prettier limpos.
**Não funcionou:** nada. Uma primeira versão da lógica do callback deixava uma atribuição que o lint marcou como inútil; trocada por declaração sem valor inicial.
**Decidi:** o método é declarado por nome no registro, e não herdado do padrão da biblioteca. Quem muda o `@fastify/cors` numa major passa pelo teste de preflight, não pelo navegador do dono.
**Pendente:** o caso que só o navegador vê não está coberto por teste de servidor. Antes de dizer que o fluxo fechou, é preciso entrar pelo Google num navegador de verdade.
**Commit:** af00940

### 2026-10-10 · [repo] Escrever no contrato que o CORS libera PATCH, PUT e DELETE, e para onde o Google volta

**Fiz:** duas linhas de contrato, vindas de dois defeitos que o dono achou testando o app no navegador. (1) O CORS tem de declarar `PATCH`, `PUT` e `DELETE`; o padrão do `@fastify/cors` v11 é só `GET,HEAD,POST`. (2) O callback do Google volta para `/inicio` quando criou sessão e para `/configuracoes` quando só vinculou — a landing não é destino.
**Por quê:** com `Access-Control-Allow-Methods: GET,HEAD,POST`, o navegador descarta a resposta de toda rota que muda estado e o front vê falha de rede. São nove mutações mortas: aceitar termos, trocar nome, e-mail e senha, meta, notificações, pauta (editar e excluir), desconectar conexão, desvincular Google, excluir conta e revogar sessão. Para quem entrou pelo Google é total: a conta nasce com `acceptedTermsVersion: null`, o diálogo de aceite tranca a área logada, e o único botão dele é um `PATCH` — a pessoa não tem como usar o app.
**Funcionou:** reproduzi com `curl -X OPTIONS /me -H 'Access-Control-Request-Method: PATCH'` contra a API de pé: responde 204 com `access-control-allow-methods: GET,HEAD,POST`, sem `PATCH`. Testei os quatro métodos; só `POST` passa, e é por isso que entrar funcionava e aceitar os termos não.
**Não funcionou:** nada enxergou isso antes, e é o ponto que importa. `fastify.inject` não aplica CORS, o MSW não é navegador, e os dois lados somam 256 testes verdes. O defeito mora exatamente na junta que nenhuma das duas suítes cobre — a mesma junta do `Cross-Origin-Resource-Policy` do helmet, achado ontem por leitura e não por teste. A diferença é que agora existe teste possível: `inject` com `OPTIONS` passa pelos hooks do plugin e lê os headers.
**Decidi:** método que muda estado entra declarado, nunca por padrão de biblioteca — padrão de dependência muda em major e leva o app com ele. E o contrato passa a dizer o destino do callback, em vez de "volta para o app", que era vago o suficiente para `WEB_ORIGIN` parecer certo.
**Pendente:** a API corrige os dois e cobre o preflight com teste.
**Commit:** 83271b7

### 2026-10-09 · [front] Tratar os dois erros da foto e recusar antes do envio

**Fiz:** `IMAGEM_MUITO_GRANDE` e `IMAGEM_INVALIDA` têm textos separados em `lib/textos.ts`: grande demais pede cortar ou escolher outra foto, com o teto em número; inválida pede exportar em JPEG, PNG ou WebP e diz que um arquivo só renomeado não conta. A tela de foto passou a traduzir `serverCode` em vez de mostrar a mensagem técnica. `lib/avatar.ts` antecipa as duas recusas com o mesmo texto, sem tirar da API a palavra final. O teto `LIMITE_AVATAR_MB = 2` vive em `textos.ts`, de onde sai o texto.
**Por quê:** os dois códigos pedem ações opostas; um texto só para os dois deixaria a pessoa adivinhar qual problema tem. Antes do envio, a checagem é só conveniência: a API decide pelos bytes.
**Funcionou:** teste de `recusaLocalAvatar` (aceita os três formatos, 2 MB exatos passam e 1 byte a mais recusa, extensão fora é `IMAGEM_INVALIDA`); teste de textos (os dois são diferentes, o grande cita 2 MB, o inválido cita o renomear); teste da tela que mostra a recusa sem chamar `POST /me/avatar`. 172 testes, typecheck, lint e prettier limpos.
**Não funcionou:** a premissa de CSP não se confirmou. Não há CSP na página do front no repositório: nem `<meta>` em `index.html`, nem header em `vite.config.ts` ou `public/`. Subi o Vite de desenvolvimento e a resposta de `/` não traz `Content-Security-Policy`. A CSP do helmet que existe está na API, e vale só para as respostas dela. Não inventei uma CSP.
**Decidi:** nenhum `img-src` foi adicionado. Se a hospedagem de produção puser CSP por fora do repositório, quem tem essa configuração precisa liberar a origem da API; isso não está no repositório para eu alterar.
**Pendente:** confirmar a CSP da produção fora do repositório. A verificação no navegador de verdade ficou para depois, porque exige a API e o banco de pé.
**Commit:** 9420d1d

### 2026-10-09 · [api] Separar IMAGEM_MUITO_GRANDE de IMAGEM_INVALIDA no avatar

**Fiz:** a foto recusada por tamanho responde `IMAGEM_MUITO_GRANDE` (400) e a que não é JPEG, PNG ou WebP responde `IMAGEM_INVALIDA` (400), no lugar do `VALIDACAO` único. O teto de 2 MB, que era suposição, agora está no contrato (`eb42e6a`).
**Por quê:** as duas recusas pedem ações opostas (cortar ou trocar a imagem, contra exportar em outro formato). Mesmo motivo do `PARSER_UNAVAILABLE`.
**Funcionou:** 84 de 84 testes. Um teste novo trava a diferença entre os dois códigos. Typecheck, lint limpos.
**Não funcionou:** nada.
**Decidi:** os códigos de rota seguem em português, como `VALIDACAO`; só `ImportBatch.error.code` é em inglês, por ser enum próprio do arquivo.
**Pendente:** nada nesta tarefa. Próximas da API, todas travadas por fora: `/reconciliation` (precisa de dado real), sincronização com o TikTok (liberação do Brasil) e o parser (o `.xlsx` real).
**Commit:** 7f3b1c5

### 2026-10-09 · [repo] Escrever os limites do avatar e separar as duas recusas

**Fiz:** o contrato passou a dizer os limites de `POST /me/avatar` — JPEG, PNG ou WebP detectados pelos bytes, no máximo 2 MB — e ganhou dois códigos no lugar de um: `IMAGEM_MUITO_GRANDE` e `IMAGEM_INVALIDA`, ambos 400.
**Por quê:** a API implementou o avatar com um teto de 2 MB que era suposição dela, não do contrato, e com as duas recusas saindo como `VALIDACAO`. Número que a tela precisa dizer ("no máximo 2 MB") não pode morar só no código da API, senão o front escreve outro número e um dos dois mente. E as duas recusas pedem ações opostas: cortar ou trocar a imagem, contra exportar em outro formato. Com um código só, a tela diria "arquivo inválido" e deixaria a pessoa adivinhar qual dos dois problemas ela tem.
**Funcionou:** a mesma correção do `PARSER_UNAVAILABLE`, três horas depois e pelo mesmo motivo — código de erro que agrupa situações com saídas diferentes empurra a mentira para a tela. Vale registrar que foi a própria sessão da API que marcou o 2 MB como suposição em vez de deixar passar.
**Não funcionou:** nada tentado e descartado.
**Decidi:** 2 MB, porque é avatar e não relatório. Detecção por bytes, não por extensão: extensão é palpite do cliente. Os códigos são em português, como todo `code` de rota (`VALIDACAO`, `SENHA_ATUAL_INCORRETA`); os de `ImportBatch.error.code` são em inglês porque são um enum próprio do arquivo, e as duas convenções não se misturam.
**Pendente:** a API troca `VALIDACAO` pelos dois códigos; o front traduz os dois em `lib/textos.ts` e libera `img-src` da origem da API na CSP.
**Commit:** eb42e6a

### 2026-10-09 · [api] Receber e servir a foto de perfil

**Fiz:** `POST /me/avatar` (multipart, campo `file`) e `GET /me/avatar`, com a migração `0007_avatar`. A foto vai para `user_avatars` (bytes no banco, então apagar a conta leva a foto junto). A resposta é `{ avatarUrl: "/me/avatar?v=<hash>" }`, e `users.avatar_url` recebe a mesma URL.
**Por quê:** o contrato da raiz (`1138a93`) pede o upload próprio com URL relativa e cache-busting. Sem `?v=`, o navegador mantém a foto antiga depois da troca.
**Funcionou:** 83 de 83 testes (6 novos em `avatar.test.ts`): sem foto responde 404; PNG volta com o mesmo conteúdo e `content-type`; trocar a imagem muda o hash e `/auth/session` passa a apontar para a nova URL; texto disfarçado de `.png`, imagem acima de 2 MB e campo errado viram `VALIDACAO`. Typecheck, lint e prettier limpos. `npm run db:migrate` aplicado no banco de dev.
**Não funcionou:** nada.
**Decidi:** o tipo da imagem vem dos bytes (JPEG, PNG, WebP), nunca do `Content-Type` que o cliente manda. `GET /me/avatar` responde `Cross-Origin-Resource-Policy: same-site`, porque o helmet põe `same-origin` por padrão e o navegador bloquearia a imagem vinda da porta do front. O comentário no controller diz que o cookie só chega ao `<img>` enquanto a API e o front forem o mesmo site.
**Pendente:** (1) o contrato não fixa tamanho de foto; os 2 MB são **suposição** em `services/avatar.ts`. (2) Imagem grande demais e arquivo que não é imagem saem os dois como `VALIDACAO`, então a tela não consegue dizer qual dos dois aconteceu; se isso importar para o texto, é um código novo, e isso passa pelo contrato. (3) A CSP da página do front precisa permitir `img-src` para a origem da API.
**Commit:** 875af88

### 2026-10-09 · [front] Prefixar o avatar relativo com a API, e só ele

**Fiz:** `urlDeImagem` em `api/client.ts` prefixa com `VITE_API_URL` só caminho que começa com `/` (e não `//`). Os schemas do usuário da sessão e da conta aplicam esse transform no `avatarUrl`; as telas só leem o campo pronto.
**Por quê:** `avatarUrl` tem duas procedências. O upload próprio vem relativo (`/me/avatar?v=<hash>`) e a foto do TikTok vem absoluta. Prefixar tudo quebraria a foto da creator.
**Funcionou:** testes de `urlDeImagem` (relativo ganha domínio, absoluto do TikTok passa intacto, `//` e null), e de schemas com as duas procedências no usuário e na conta. 167 testes, typecheck, lint e prettier limpos.
**Não funcionou:** nada.
**Decidi:** o `?v=<hash>` vem da API e não recebe cache-busting do front. O MSW continua devolvendo um blob absoluto no upload, então não exercita o caminho relativo; isso fica para a varredura contra a API real.
**Pendente:** nada neste ponto.
**Commit:** f523864
**Commit:** a seguir
### 2026-10-09 · [repo] Escrever o avatar no contrato, com as duas procedências separadas

**Fiz:** `GET /me/avatar` entrou no contrato (imagem com o `Content-Type` dela, 404 sem avatar), e `avatarUrl` ganhou a regra das duas procedências: no `SessionUser` é upload próprio e vem relativo (`/me/avatar?v=<hash>`); em `GET /accounts` é a foto da creator no TikTok e vem absoluta.
**Por quê:** a sessão da API parou o `POST /me/avatar` porque a imagem vai ficar no Postgres, e byte no banco precisa de uma rota que sirva a imagem — rota que não estava no contrato.
**Funcionou:** a parada. Pedir o contrato antes de escrever a rota é exatamente o que o `CLAUDE.md` manda, e foi a segunda vez hoje que uma ponta travou sozinha em vez de inventar campo.
**Não funcionou:** a frase que me foi proposta para `avatarUrl` descrevia só o caminho relativo, e `avatarUrl` existe em dois lugares com procedências diferentes — o de `/accounts` vem do TikTok e é absoluto. Gravar só a metade relativa deixaria o mesmo nome de campo com duas convenções e nenhuma escrita, armadilha que só apareceria quando o avatar do TikTok sumisse da tela. Reescrevi cobrindo as duas: o front prefixa `VITE_API_URL` apenas no que começa com `/`, em um lugar só.
**Decidi:** 404 quando não há avatar, nunca imagem de espaço reservado — o front não saberia distinguir de foto de verdade. E o `?v=<hash>` é obrigatório: a URL não muda de nome quando a imagem muda, então sem ele o navegador mostra o avatar antigo depois da troca.
**Pendente:** a API implementa `POST /me/avatar` e `GET /me/avatar`; o front passa a prefixar o caminho relativo em um lugar só.
**Commit:** 1138a93

### 2026-10-09 · [front] Mostrar PARSER_UNAVAILABLE sem pedir reenvio

**Fiz:** o código novo do contrato entra no enum de `importErroCodigo` e ganha orientação própria em `lib/import.ts`: o arquivo chegou, o formato está sendo mapeado, não precisa reenviar. `FAILED` segue com "Tente enviar de novo".
**Por quê:** sem o código no enum, o Zod reprovava a resposta inteira de `GET /imports/:id` e o painel quebrava. Com o texto de `FAILED`, todo `.xlsx` válido mandaria a pessoa reenviar um arquivo que não está errado.
**Funcionou:** teste que trava a diferença entre os dois códigos (sem "tente" no ausente, com "Tente enviar de novo" na falha); teste do painel com o arquivo `relatorio-novo-formato.xlsx` no MSW; histórico mostra "Em mapeamento" ao lado de "Falhou" no lote de falha real; 162 testes, typecheck, lint e prettier limpos.
**Não funcionou:** nada.
**Decidi:** o status do lote continua `FAILED` (contrato); o rótulo vira "Em mapeamento" e o badge sai da cor de falha quando o código é `PARSER_UNAVAILABLE`. Função pequena em `labels.ts` por cima do `Record`, que não mudou. `FAILED` com outro código segue "Falhou".
**Pendente:** nada.
**Commit:** 948f967

### 2026-10-09 · [api] Emitir PARSER_UNAVAILABLE no lugar de FAILED para o arquivo que ainda não se lê

**Fiz:** quando o motivo é `ParserPendente` (a planilha real não chegou), o lote termina com `error.code: PARSER_UNAVAILABLE`. `FAILED` fica só para falha de processamento de verdade.
**Por quê:** `FAILED` diz "tente de novo", e tentar de novo não resolve enquanto a seção 3 da spec não fechar. Era a mesma tela mentindo em 100% dos envios. Contrato em `fead2c5`.
**Funcionou:** 77 de 77 testes. O `.xlsx` válido agora termina `PARSER_UNAVAILABLE`, e um teste novo trava a diferença: lote na fila sem o arquivo guardado continua `FAILED`. Typecheck, lint e prettier limpos.
**Não funcionou:** a primeira versão do teste novo era um placeholder sem asserção; foi substituído antes do commit.
**Decidi:** a regra fica no service, no ponto em que o erro é classificado, e não no lib: o lib só lança `ParserPendente`.
**Pendente:** `POST /me/avatar` ainda não existe. O contrato diz `avatarUrl` na resposta, mas não diz onde a imagem fica nem por qual URL ela é servida; isso precisa de decisão antes do código.
**Commit:** dbc3ef8

### 2026-10-09 · [repo] Separar "ainda não sei ler" de "falhou" no import

**Fiz:** `ImportBatch.error.code` ganhou `PARSER_UNAVAILABLE`, para o arquivo que a API aceitou e ainda não sabe ler enquanto a seção 3 de `docs/parser-affiliate-orders.md` depender do `affiliate_orders.xlsx` real.
**Por quê:** com o `/imports` no ar (`c04cbc6`), todo `.xlsx` válido termina `FAILED`, e a orientação de `FAILED` em `web/src/lib/import.ts:49` diz "Tente enviar de novo". Ou seja: o único caminho que funciona hoje termina num conselho falso, porque tentar de novo não cria o parser. `FAILED` significa falha de processamento, em que reenviar é honesto; juntar as duas situações no mesmo código obriga a tela a mentir em uma delas.
**Funcionou:** a sessão da API detectou e relatou isso por conta própria, em vez de entregar a rota e deixar o front descobrir na tela. O stub em `api/src/lib/affiliate-orders.ts` já isola tudo que depende da planilha real, com cada suposição marcada como SUPOSTO e o dicionário de colunas nascendo vazio — nenhuma coluna inventada para fechar a lacuna.
**Não funcionou:** nada tentado e descartado. Considerei deixar como está, apostando que o parser chegaria antes de alguém ver a tela, e descartei: o `.xlsx` real é bloqueio sem data, e quem envia o arquivo nesse meio tempo é o próprio dono.
**Decidi:** o código sai de circulação sozinho quando o parser existir, sem nenhuma das pontas remover nada — a API para de emitir e o texto fica órfão. É o oposto de `shopConnected`, que precisou de três commits para desfazer.
**Pendente:** a API emite `PARSER_UNAVAILABLE` no lugar de `FAILED` nesse caso; o front traduz em `lib/import.ts` sem oferecer nova tentativa.
**Commit:** fead2c5

### 2026-10-09 · [api] Receber o relatório e expor a fila de importações

**Fiz:** `POST /imports?accountId` (multipart, campo `file`), `GET /imports` e `GET /imports/:id`, com a migração `0006_imports` (lote e bytes do arquivo em tabelas separadas). O envio responde `201 { importId }`; a recusa que não precisa ler a planilha (extensão, tamanho) vira lote `FAILED` com `error.code`, nunca 500. A fila roda em segundo plano dentro do processo.
**Por quê:** `/imports` é a espinha de dados do MVP enquanto a Affiliate Creator API não libera o Brasil. O dono aprovou `@fastify/multipart` (9.x, compatível com o Fastify 5), e a fila ficou em memória de propósito, sem infraestrutura nova.
**Funcionou:** 76 de 76 testes (11 novos em `imports.test.ts`): conta alheia responde 404 antes de ler o corpo; campo errado, `.csv` e arquivo acima de 50 MB viram `VALIDACAO`, `WRONG_EXTENSION` e `TOO_LARGE`; `.xlsx` entra na fila e termina `FAILED` com code `FAILED`; a listagem é paginada, filtra por status e recusa `pageSize` acima de 100. Typecheck, lint e prettier limpos.
**Não funcionou:** nada. Uma primeira versão do teste de `FAILED` esperava o status na hora do envio e era intermitente, porque o processamento roda em segundo plano; o teste agora espera o lote sair da fila.
**Decidi:** o mapeamento de colunas e o de status ficam em `src/lib/affiliate-orders.ts`, em uma função só. A suposição é explícita: o dicionário de colunas nasce **vazio** (nenhuma coluna confirmada), e os rótulos de status são os da tabela da spec, não de um arquivo real. Nada foi inventado para fechar a seção 3.
**Pendente:** (1) o parser de verdade, que espera o `affiliate_orders.xlsx` real: cabeçalho, moeda, `WRONG_FILE`, dedup por id do pedido + id do SKU + `line_no`; hoje todo `.xlsx` válido termina `FAILED` com a mensagem "parser pendente", e isso precisa de tela própria, porque o front lê `FAILED` como "pedir nova tentativa" e nova tentativa não resolve; (2) lote preso em `PROCESSING` se a API cair no meio (ponytail na fila, com o teto descrito lá); (3) `/reconciliation`, que só vale com dado real para reconciliar.
**Commit:** c04cbc6

### 2026-10-09 · [front] Trocar o gatilho de venda de shopConnected para hasSales

**Fiz:** Início, Vendas, Produtos, Planejamento, Vídeos, Avisos e a página do vídeo decidem o estado de venda por `hasSales` (conta) e pelo número do período. `shopConnected` ficou só no cartão de Configurações, no aviso de "em liberação" e no checklist do Início rápido. O estado de conta sem venda agora diz "Ainda não há vendas nesta conta" e oferece enviar o relatório; o nulo de métrica de vídeo diz "Ainda não disponível", sem citar o Shop.
**Por quê:** `shopConnected` nunca fica verdadeiro sem a Affiliate Creator API, então as telas de venda diriam "conecte o TikTok Shop" para todo mundo, inclusive depois de um import bem-sucedido. Ver `befe909`.
**Funcionou:** 160 testes passando, typecheck e lint limpos. Regressões travadas: conta sem venda (início, vendas, produtos, seletor de produto do Planejamento, vídeo); venda por arquivo com Shop desconectado mostra GMV e procedência FILE; vídeo com GMV nulo sem cadeado.
**Não funcionou:** o MSW tinha a inversão: `comProcedencia` e `videos()` olhavam `shopConnected`, então a venda sumia com o Shop desconectado. Corrigido para `vendasNaConta`; a procedência segue usando `shopConnected` (API se conectado, FILE se não), porque ela descreve de onde veio o número, não se ele aparece.
**Decidi:** testes que falam de conexão (Configurações, Início rápido, aviso de liberação, import) mantêm `shopConnected = false`; os que falam de venda passam a usar `db.vendasNaConta`.
**Pendente:** varredura das telas contra a API real com o seed novo (conta demo sem `SHOP`, pedidos `FILE`), que é a primeira vez que o front vê o estado real de um usuário.
**Commit:** 36ab324

### 2026-10-09 · [api] Tirar a linha SHOP do seed e tratar a venda da demo como arquivo

**Fiz:** `db/seed.sql` deixou de inserir a conexão `SHOP` da conta demo, e o seed de mocks passou a gravar os pedidos com `source: 'FILE'`. A conta demo fica só com `VIDEOS`.
**Por quê:** a linha `SHOP` era inserida direto no banco, driblando `POST /connections/tiktok/start` (que responde 503 enquanto o Brasil não for liberado). A demo nascia com `shopConnected: true`, estado que nenhuma creator real terá, e isso escondeu o defeito de `bi.ts` por duas sessões. Fixture que não pode existir em produção é máscara.
**Funcionou:** suíte 65 de 65, lint limpo. Os testes de dados deixaram de revogar a linha `SHOP` (ela não existe mais): `shopConnected` sai `false` e `hasSales` sai `true` na conta demo; os totais de referência continuam batendo; `INELIGIBLE` segue só com `source = 'FILE'` (a constraint do `0004_domain.sql` não recusou nada). Banco de dev: `delete from provider_connections where kind = 'SHOP'` (1 linha), depois `db:seed` e `db:seed:mocks` — 80 pedidos agora com `source = FILE`.
**Não funcionou:** nada. Antes da mudança o `npm test` não subiu porque o Postgres de dev estava parado; `docker compose up -d db` resolveu.
**Decidi:** `source_at` continua a data fixa do relatório (2026-10-01), a mesma do front, não `now()`. Os mocks só têm status do TikTok, então o seed nunca produz `INELIGIBLE`. Isso é correto: o rótulo só existe no relatório em arquivo. Quem passa a exercitar esse caminho é o import do `affiliate_orders.xlsx` real, quando a seção 3 do parser fechar (pendência do parser, não do seed).
**Pendente:** seção 3 de `docs/parser-affiliate-orders.md` (mapeamento de `INELIGIBLE` com o arquivo real). A linha `SHOP` no banco de dev foi limpeza de desenvolvimento, **não** migração: ela nunca esteve em produção, e migração aplicada não se edita.
**Commit:** 2160451

### 2026-10-09 · [api] Conferir o fluxo do Google com as credenciais preenchidas

**Fiz:** nada no código. Verificação com as três variáveis `GOOGLE_*` preenchidas no `api/.env`, sem chamada ao Google.
**Por quê:** o dono criou o app no Google Cloud; era o bloqueio que deixava `GOOGLE_INDISPONIVEL` como único caminho.
**Funcionou:** a API sobe com as variáveis preenchidas (a lista de opcionais vazias do `config/env.ts` segue valendo). `GET /auth/google/start` responde 302 para `https://accounts.google.com/o/oauth2/v2/auth` com `client_id`, `redirect_uri` idêntico ao do `.env`, `scope=openid email profile`, `state`, `nonce`, `code_challenge` e `code_challenge_method=S256`, e grava `__Secure-goog` com `Path=/auth/google; HttpOnly; Secure; SameSite=Lax; Max-Age=600`.
**Não funcionou:** não consegui confirmar que o cookie volta no callback. `curl` não reproduz o envio de cookie `Secure` sobre `http://localhost`, e sem o código do Google o callback responde 400 igual com ou sem cookie. Isso só se confirma num navegador com conta real.
**Decidi:** nada muda. `Path=/auth/google` cobre `/auth/google/callback`; `Secure` em `localhost` é aceito pelos navegadores como contexto seguro.
**Pendente:** teste no navegador com conta Google real, feito pelo dono. No console do Google: cadastrar como redirect URI autorizado exatamente `http://localhost:3333/auth/google/callback` (tipo "Aplicativo da Web"). Origem JavaScript autorizada **não** é necessária, porque o fluxo é servidor a servidor com redirecionamento. Se o app estiver em modo "Testing", a conta de teste precisa estar na lista de usuários de teste, senão o Google recusa com `access_denied` e a API responde `GOOGLE_RECUSADO`.
**Commit:** 1d9513e

### 2026-10-09 · [api] Expor hasSales em /accounts

**Fiz:** `GET /accounts` ganhou `hasSales`, que é `true` quando existe pedido nesta conta, de qualquer fonte. É um `exists` na mesma consulta que já deriva `shopConnected`.
**Por quê:** o front precisa saber se a conta tem venda para refazer o estado de cinco telas, e `/accounts` já é consultado uma vez no seletor de conta. Assim não cria hook, cache nem data mágica para medir pedidos.
**Funcionou:** teste de conta com pedido de arquivo e Shop desconectado devolve `hasSales: true` (trava a regressão de depender de `shopConnected`); conta sem pedido devolve `false`; o teste de conexão passou a esperar o campo. Suíte 65 de 65, typecheck, lint e prettier limpos.
**Não funcionou:** nada.
**Decidi:** `hasSales` ignora `shopConnected` e a procedência do pedido, como o contrato commitado em `18f103f` define.
**Pendente:** o seed (conta só com `VIDEOS` e pedidos `FILE`) segue aguardando a decisão do líder, com o delete manual da linha `SHOP` no banco de dev.
**Commit:** 50f980a

### 2026-10-09 · [api] Mostrar venda do vídeo pelo que existe, não pela loja conectada

**Fiz:** `gmv`, `commission` e `gpm` de vídeo (lista e detalhe) saem nulos só quando não há venda ligada àquele vídeo. Antes, o detalhe e a lista zeravam o dado quando a parte de pedidos não estava conectada, mesmo com venda do arquivo. `shopConnected` não entra mais nessa conta. Também saiu do repositório o flag `comShop` e a coluna `shop_connected` de `buscarPorId`, que só existiam para isso.
**Por quê:** a loja não conecta para creator nenhuma enquanto o Brasil não for liberado, então o dado de venda chega pelo arquivo com `shopConnected` falso. Gatear por essa bandeira escondia venda real.
**Funcionou:** a suíte passa com 63 de 63. O teste que fixava o comportamento antigo foi reescrito: com a loja desconectada, a venda ligada ao vídeo aparece igual na lista e no detalhe, e vídeo sem venda sai nulo, nunca zero. Typecheck, lint e prettier limpos.
**Não funcionou:** nada. A primeira versão do teste ainda afirmava nulo para tudo sem loja, e o teste falhou como esperado.
**Decidi:** o critério de nulo é "não há linha de pedido com esse `content_id`". Não há campo novo, e a lista já funcionava assim pela junção.
**Pendente:** o seed ainda liga a linha `SHOP` da demonstração e marca os pedidos como `API`. Isso espera decisão do líder antes de mexer.
**Commit:** c9e9d3f

### 2026-10-09 · [repo] Tirar de `shopConnected` o poder de esconder venda

**Fiz:** escrevi no contrato que `shopConnected` descreve só a conexão viva com o TikTok Shop — cartão de Configurações, aviso de "em liberação", sincronização automática — e **nunca** governa a exibição de venda. Tela de venda mostra venda quando existe venda, com procedência `API` ou `FILE`. O estado "só vídeo" dispara na ausência de dado de venda, e oferece como saída o envio do arquivo.
**Por quê:** a varredura do front contra a API real levou a uma pergunta sobre como testar o estado "Shop não conectado", e a resposta expôs que o produto não mostra venda nenhuma para nenhum usuário real. `POST /connections/tiktok/start` com `kind: "SHOP"` responde 503 enquanto a Affiliate Creator API não liberar o Brasil, então `shopConnected: true` é **impossível** para uma creator de verdade — não improvável. E o front fechava as telas inteiras nessa bandeira: `Vendas.tsx:87`, `Produtos.tsx:64`, `Inicio.tsx:61`, `Planejamento.tsx:46` e as ordenações de `Videos.tsx:56`. A creator enviaria o `affiliate_orders.xlsx`, o import funcionaria, os pedidos entrariam no banco — e quatro telas diriam "conecte o TikTok Shop", que é um botão que responde 503. O import é a espinha de dados do MVP e o MVP se recusava a exibi-lo.
**Funcionou:** a investigação. `0004_domain.sql:21` confirma que `orders.account_id` referencia a linha `VIDEOS`, não a `SHOP` — então os endpoints de dados **não** gatearem por `shopConnected` estava certo desde sempre, e `/summary`, `/orders` e `/products` não precisam de mudança. Venda com `source: "FILE"` e `shopConnected: false` é o estado normal de todo usuário real, não uma anomalia.
**Não funcionou:** o seed esconde o defeito, e é por isso que ele sobreviveu a duas sessões e a uma varredura tela por tela. `db/seed.sql:28` insere a linha `SHOP` direto no banco, driblando a rota que recusa: a conta de demonstração nasce com `shopConnected: true`, que é o único estado em que o app funciona e o único que usuário real nunca terá. Fixture que não pode existir em produção não é fixture, é máscara.
**Decidi:** o gatilho do estado vazio é "tem dado de venda?", e vazio de período ("nenhuma venda neste período, amplie o filtro") é tela diferente de conta sem venda alguma ("envie seu relatório"). Vale também por item: `gmv`, `commission` e `gpm` de vídeo vêm nulos quando não há venda ligada àquele vídeo, não quando `shopConnected` é falso — `bi.ts:201` tem a mesma inversão em escala menor. O seed passa a representar a forma real do produto: conta só com `VIDEOS` e pedidos com `source: "FILE"`.
**Pendente:** o front troca o gatilho nas cinco telas (plano pedido antes do código, porque mexe no estado de quatro telas principais e muda carregamento síncrono em assíncrono); a API corrige `bi.ts` e o seed. Se a mudança de procedência do seed conflitar com os testes de dados, os **totais de referência** mandam.
**Commit:** befe909

### 2026-10-09 · [front] Tirar código cru da tela de erro e corrigir copy que afirmava o que não existe

**Fiz:** seis correções da varredura contra a API real, em um commit. (1) `EstadoErro` deixou de mostrar `Código do erro: nao_encontrado` — ele é compartilhado por todas as telas de dados, não só a Reconciliação. (2) O estado do TikTok Shop em Avisos vem de `shopConnected`: conectado mostra "Conectado. Pedidos e comissões entram sozinhos.", e o texto de "ainda não liberado" só aparece quando a conta não está conectada. (3) "primeira leitura em andamento" virou "ainda sem leitura": nada no sistema sustenta uma leitura rodando. (4) Detalhe de produto e de vídeo dizem "desde o início da conta"; o contrato não tem período nesses endpoints, e o número é correto para o que mede. (5) A dica da senha diz só "Use ao menos 8 caracteres", que é o que a API exige. (6) Conta sem leitura reusa o lembrete de 5 dias do Início, com copy "Ainda sem leitura nesta conta" e o atalho para o import.
**Por quê:** código interno na tela contraria o `web/CLAUDE.MD`, e a contradição de Shop na mesma tela era um texto fixo esperando virar bug. Os outros quatro eram afirmações que o sistema não sustenta.
**Funcionou:** lint, typecheck e prettier limpos; 153 testes (eram 143). Cobertos: `EstadoErro` sem código para 404 e para erro genérico; Shop conectado e desconectado; conta sem leitura no Configurações e no Início; rótulos de desde o início no vídeo e no produto; dica da senha; e a volta do Google com `?erro=GOOGLE_INDISPONIVEL` traduzida em `/configuracoes`.
**Não funcionou:** nada travou. Não corrigi "primeira sincronização" e "o painel se preenche sozinho quando a primeira leitura terminar" no `PrimeiroAcesso` do Início: são frases futuras, para quem ainda não conectou; ficam para a próxima revisão de copy.
**Decidi:** erro sem código na tela fica no texto da categoria, sem número nem código. O rastro para suporte, se for preciso, vai em `console.error`, nunca na tela — não implementei agora. A mensagem de Google indisponível, que diz "use e-mail e senha", também aparece logado em Configurações; é copy e fica para depois.
**Pendente:** página 2 de Vendas e layout no celular, depois destas correções. Estado "Shop não conectado" exercitado sem destruir o seed, a combinar com a API.
**Commit:** 4059472

### 2026-10-09 · [api] Subir o teto por IP para 300 e devolver erro do Google à tela certa

**Fiz:** o teto global por IP passou de 100 para 300 req/min, com um `ponytail:` dizendo que é por IP, que NAT de operadora é o limite conhecido e qual é o upgrade. Erro do fluxo Google (recusa, e-mail não verificado, conflito de vínculo e Google indisponível no início) volta para `/configuracoes?erro=CODIGO` quando há sessão, e para `/entrar?erro=CODIGO` quando não há.
**Por quê:** a varredura do front estourou o teto só navegando, porque cada tela faz 8 a 10 consultas. E quem já estava logado e tentava vincular o Google era jogado de volta ao Início sem explicação, porque a guarda de rota tirava a mensagem de `/entrar`.
**Funcionou:** `google.test.ts` com 4 testes novos cobrindo recusa e Google indisponível, cada um com e sem sessão. Os limites de `/auth` não foram tocados. Suíte 63 de 63, typecheck, lint e prettier limpos.
**Não funcionou:** nada. Na primeira versão do helper sobrou uma função antiga sem uso; foi removida antes do commit.
**Decidi:** o teto continua por IP e não ganhou limite por usuário, porque ainda não há usuário real que justifique. A linha de contrato em `CLAUDE.md` foi escrita pelo líder e entra neste commit. Não entra a linha de "Detalhe de produto e de vídeo", que não foi pedida aqui.
**Pendente:** pergunta do líder sobre como o front exercita o estado "TikTok Shop não conectado" sem desconectar em cascata. Respondida sem implementar; aguarda decisão.
**Commit:** 8b712e5

### 2026-10-09 · [api] Tratar opcional vazia como ausente, sem afrouxar segredo

**Fiz:** `config/env.ts` troca string vazia por ausente em sete variáveis opcionais, por lista explícita: as quatro do Google e do TikTok mais os dois redirects e `TIKTOK_SHOP_ENABLED` (que vazio vira `false`, o default). Segredo ou banco obrigatório continua fora da lista.
**Por quê:** `.env.example` deixa essas linhas vazias, e quem ainda não criou o app no Google derrubava o boot com `Too small`. O `api/CLAUDE.MD` promete que elas são opcionais.
**Funcionou:** `env.test.ts` (2 testes) sobe um filho com as opcionais vazias e confere que o boot passa, e que `JWT_SECRET`, `ENCRYPTION_KEY` e `DATABASE_URL` vazios derrubam o boot com o nome da variável na mensagem. Suíte 59 de 59, typecheck, lint e prettier limpos. O boot real com o `.env` do dono sai com código 0.
**Não funcionou:** nada. A primeira versão da ideia era um filtro genérico sobre o `process.env` inteiro; foi descartada porque um segredo vazio viraria ausente e o default entraria no lugar.
**Decidi:** a lista é explícita de propósito, e o teste de segredo vazio é o que impede alguém de trocá-la por um filtro genérico no futuro.
**Pendente:** nada desta tarefa. `POST /me/avatar` e o import seguem esperando `@fastify/multipart`, aprovação do dono.
**Commit:** 32d8eb1

### 2026-10-09 · [repo] Ligar o front à API de verdade

**Fiz:** subi o ambiente de desenvolvimento de ponta a ponta pela primeira vez — segredos do `api/.env`, migrações (0003, 0004, 0005), os dois seeds, a API no ar em `:3333` — conferi os totais de referência por HTTP e virei o front para a API real (`VITE_API_URL=http://localhost:3333`, `VITE_ENABLE_MSW=false`).
**Por quê:** as duas pontas existiam há semanas e nunca tinham se falado. Todo teste das duas era contra si mesmo: o front contra o MSW, a API contra `fastify.inject`. Nada provava que o contrato era o mesmo dos dois lados.
**Funcionou:** os totais de referência batem nos endpoints, por HTTP e com sessão de verdade: GMV R$ 11.378,50, comissão estimada R$ 1.424,55, a receber R$ 1.023,89, liquidada R$ 181,22, ticket médio R$ 142,23, 80 pedidos, 115 itens, e a quebra por status exata em 57 a liquidar, 13 liquidados, 7 reembolsados, 2 aguardando e 1 retido. A identidade `gmvEligible + gmvIneligible = gmv` fecha (9.625,10 + 1.753,40). O envelope de erro novo chega como `code` no ar (`NAO_AUTENTICADO` em 401, `NAO_ENCONTRADO` em 404 para conta alheia). Os cookies saem **sem** `Domain`, então o prefixo `__Host-` é aceito pelo navegador, e o CORS libera `localhost:5173` com credenciais.
**Não funcionou:** duas coisas que só aparecem fora do teste. (1) O `DATABASE_URL` do `.env.example` aponta para `usuario:senha@localhost`, que não é o banco que o `docker-compose.yml` cria (`shopscanner:shopscanner`) — quem segue o README toma `password authentication failed` no primeiro comando. (2) As variáveis opcionais `GOOGLE_*` e `TIKTOK_*` derrubam o boot quando estão **presentes e vazias**, em vez de ausentes; o `api/CLAUDE.MD` promete que são opcionais, mas isso só vale se a linha não existir, e vazio é o estado natural de quem copiou o exemplo. Contornei comentando as quatro linhas; a correção no Zod ficou para a sessão da API.
**Decidi:** `localhost:5173` e `localhost:3333` são origens diferentes do **mesmo site**, então `SameSite=Lax` não atrapalha e o desenvolvimento não precisa de HTTPS nem de proxy. A varredura das 16 telas contra a API real vai em sessão separada, e a ordem é **anotar tudo antes de corrigir**: medir o tamanho do desalinhamento vale mais que consertar a primeira tela que aparecer.
**Pendente:** a varredura em si. `POST /me/avatar`, `/imports` e `/reconciliation` ainda não existem, então o painel de import, a reconciliação e o avatar vão falhar — é esperado, e o que importa é *como* falham. Login com Google segue inoperante de propósito: o app no Google ainda não foi criado, então o caminho `GOOGLE_INDISPONIVEL` vai ser exercitado de verdade pela primeira vez. `lastSyncedAt` vem nulo do seed, o que testa o "Atualizado há X" e o lembrete de 5 dias.
**Commit:** 9baebee

### 2026-10-09 · [api] Corrigir o DATABASE_URL do .env.example

**Fiz:** o `.env.example` trazia `usuario:senha`, que não é o banco que o `docker-compose.yml` sobe. Agora traz `shopscanner:shopscanner`, o mesmo do compose. O `api/README.md` não repetia o valor errado.
**Por quê:** quem copia o exemplo e segue o README leva `password authentication failed` no primeiro comando. Aconteceu com a sessão do líder ao subir o ambiente.
**Funcionou:** o valor do exemplo é o do compose (conferido por leitura dos dois arquivos). A subida do ambiente foi feita pelo dono, com `.env` corrigido, migrate 0003 a 0005 e os dois seeds; os totais de referência bateram por HTTP, número por número.
**Não funcionou:** o `.env` real estava com `JWT_SECRET` e `REFRESH_TOKEN_PEPPER` abaixo de 32 caracteres e chaves do Google e do TikTok vazias, o que recusava o boot. Corrigido pelo dono, não por código.
**Decidi:** o `.env.example` usa as credenciais de desenvolvimento do compose, que já estão versionadas; não é segredo.
**Pendente:** tratar string vazia como ausente em `config/env.ts` para as variáveis opcionais do Google e do TikTok. Aguarda a confirmação do líder antes de implementar.
**Commit:** d5ccbf4

### 2026-10-09 · [front] Traduzir EMAIL_EM_USO no cadastro e na troca de e-mail

**Fiz:** `EMAIL_EM_USO` (409) ganhou um texto só em `textos.ts`, que serve ao cadastro e à troca de e-mail. As duas telas traduzem pelo código, e não pelo texto da API. O MSW manda o código nos dois caminhos, para o e-mail `ocupado@email.com.br`.
**Por quê:** a API passou a responder `code` (envelope corrigido), então o código chega de verdade à tela. Sem tradução, cairia no texto genérico.
**Funcionou:** lint, typecheck e prettier limpos; 143 testes (eram 140). Cobertos: texto de `EMAIL_EM_USO`, cadastro com e-mail já usado (fica em `/criar-conta`), e troca de e-mail para um já usado (a conta não muda).
**Não funcionou:** nada travou.
**Decidi:** um texto só para os dois caminhos. Ele diz o que fazer em seguida ("use outro"), que vale para os dois.
**Pendente:** nada desta tarefa. O restante está travado pelos segredos do `api/.env`, pela aprovação do `@fastify/multipart` e pelos dados legais de `textos.ts`; a varredura das 16 telas espera o banco semeado.
**Commit:** a0f9b1d

### 2026-10-09 · [front] Alinhar o nome do cadastro a 2 letras e traduzir UNICO_ACESSO

**Fiz:** `registerInput` e o formulário de criar conta exigem 2 letras, como o perfil e a API. `UNICO_ACESSO` (409 ao desvincular o único acesso) ganhou texto em `textos.ts`, e a tela de desvincular passou a traduzir pelo código, não pelo texto da API. O MSW manda `code: 'UNICO_ACESSO'` no 409.
**Por quê:** a API exige 2 letras no cadastro, então o front deixava passar um nome que o servidor recusava. E com o envelope de erro agora em `code`, `UNICO_ACESSO` chega de verdade à tela; a tela esconder o botão não cobre a corrida entre duas abas.
**Funcionou:** lint, typecheck e prettier limpos; 140 testes (eram 136). Cobertos: cadastro com 1 letra para no formulário sem ir à API, `registerInput` recusa 1 letra e aceita 2, e o texto de `UNICO_ACESSO`.
**Não funcionou:** nada travou.
**Decidi:** o cliente (`client.ts`) não mudou: lê `code`, que é o contrato. O texto genérico continua sendo o último recurso.
**Pendente:** `EMAIL_EM_USO` (409 ao trocar e-mail na API) ainda não tem texto em `textos.ts`; cai no texto genérico. Não adicionei porque o pedido foi outro; é uma linha com teste quando a API confirmar o código.
**Commit:** d380e09

### 2026-10-09 · [api] Responder erro com `code`, não `error`

**Fiz:** todo erro sai como `{ code, message }`, nas quatro respostas do handler central (`AppError`, validação, 429 e 500). Oito asserções de teste passaram a conferir o `code`, e a de corpo inteiro em `google.test.ts` também. O teste de 429 agora confere que `Retry-After` é número de segundos.
**Por quê:** a API mandava `error` com o código, e o front lê `code`. Contra a API real, nenhum código de erro chegaria à tela; o MSW mascarava isso, mandando `code`. O contrato não tinha definido o corpo de erro, e as duas pontas inventaram um cada. A decisão de nome está no `CLAUDE.md`, logo depois das convenções.
**Funcionou:** `npm test` com 57 de 57, typecheck, lint e prettier limpos. O `Retry-After` já era em segundos, porque `@fastify/rate-limit` grava `ttlInSeconds`; o teste só trava isso.
**Não funcionou:** nada. Só não tinha reparado antes que `google.test.ts` comparava o corpo inteiro, e a busca por `.error` não pegou essa forma.
**Decidi:** conferir `code` nos testes e não `message`, porque `message` é técnico e pode mudar.
**Pendente:** nada desta tarefa. Continua pendente o que já estava no devlog: `.env` do dono, totais de referência e `POST /me/avatar`.
**Commit:** 09b68dc

### 2026-10-09 · [front] Tirar GOOGLE_ONLY, traduzir senha errada pelo código, avisar 429 com o tempo

**Fiz:** GOOGLE_ONLY saiu de `Recuperar.tsx` e do MSW, que agora responde 204 sempre, como a API. A recuperação mostra a mesma confirmação para qualquer e-mail ("se existir uma conta com o e-mail…"). A troca de senha traduz `SENHA_ATUAL_INCORRETA` (400) por `textos.ts`. O cliente ganhou a categoria `limitado` para 429, com `Retry-After` em segundos; `Entrar`, a recuperação e a troca de senha mostram o tempo de espera e nunca "não conferem" para um 429. `perfilInput` aceita nome de 2 letras no mínimo, e o formulário de perfil avisa antes de enviar.
**Por quê:** resposta que varia em `/auth/forgot-password` entrega quais e-mails têm conta; 429 mostrado como senha errada mente para quem acertou.
**Funcionou:** lint, typecheck e prettier limpos; 136 testes (eram 128). Cobertos: 204 igual para conta só com Google, 429 no login com `Retry-After` de 120 s, `Retry-After` que não é número ignorado, `SENHA_ATUAL_INCORRETA` com texto próprio, nome de 1 caractere recusado.
**Não funcionou:** nada travou. O código desta tarefa entrou no commit `2504b70`, junto com a mudança de contrato do repo; os testes e esta entrada ficaram no commit seguinte.
**Decidi:** `limitado` não repete sozinho (não é `isRetryable`). Sem `Retry-After`, o aviso não tem número. E-mail só troca pela API, que vai exigir senha atual.
**Pendente:** `registerInput` e o formulário de criar conta ainda aceitam nome de 1 caractere; não mudei porque o pedido foi só para `perfilInput`. Desvincular o Google responde 409 sem `code` no MSW, então cai no texto genérico (a tela já esconde o botão quando não cabe). A tela de perfil não mostra `emailVerified`, então não afirma e-mail verificado depois da troca; quando a troca de e-mail chegar, o formulário ganha `currentPassword`, só depois do aviso da raiz.
**Commit:** 2504b70 (código) e o commit seguinte (testes e devlog)

### 2026-10-09 · [api] Exigir senha atual para trocar e-mail e tornar e-mail obrigatório

**Fiz:** `PATCH /me` aceita `currentPassword`, exigido quando a conta tem senha e o e-mail muda; errado ou ausente responde 400 `SENHA_ATUAL_INCORRETA` (o mesmo código da troca de senha). Migração `0005` põe `NOT NULL` em `users.email` e `auth_identities.email`.
**Por quê:** com sessão sequestrada, trocar o e-mail e pedir recuperação entregava a conta de forma permanente. A coluna era nullable por prevenção a login por TikTok, que o contrato descartou; nenhum caminho de criação produz e-mail nulo.
**Funcionou:** `npm test` com 57 de 57 (2 novos: troca de e-mail em conta com senha exige a senha certa; nome e aceite de termos seguem sem senha). Typecheck, lint e prettier limpos. A 0005 roda como parte do setup do banco de teste.
**Não funcionou:** nada rodado no banco de dev. `db:migrate` segue bloqueado pelo `.env`. Conferido por consulta: o banco de dev tem 1 usuário e nenhuma identidade, todos com e-mail, então a 0005 não encontra linha nula.
**Decidi:** a troca de e-mail sem senha continua permitida só quando a conta não tem senha (quem só tem Google). Nome e aceite não pedem senha. A linha de contrato em `CLAUDE.md` foi escrita pelo líder do projeto no mesmo commit.
**Pendente:** `/imports`, multipart e `POST /me/avatar` seguem sem dependência aprovada pela pessoa dona do projeto. Totais de referência não conferidos (ambiente de dev bloqueado).
**Commit:** 333e8bb

### 2026-10-09 · [repo] Tirar `/payouts` do contrato e fechar a regra de código de erro

**Fiz:** removi `GET /payouts` do contrato e escrevi três decisões em "Decisões de contrato": a recuperação de senha responde sempre 204, erro que o usuário precisa entender tem `code` estável, e `/payouts` só volta com definição e tela.
**Por quê:** três sessões de devlog seguidas registraram `/payouts` como pendente. Ele nunca teve `expected`, `settled` e `pending` definidos em "Definições dos números", nunca foi servido pela API e nenhuma tela chegou a usar — `grep` por `payout` em `web/src`, `mocks/` e `api/src` não acha nada. Rota que ninguém implementou e ninguém consumiu não é pendência, é linha de contrato errada: ela obriga toda sessão futura a reabrir a mesma discussão.
**Funcionou:** a remoção é uma linha e não toca em código nenhum, nas duas pontas. Por isso não exigiu commit conjunto com a API, como manda a regra de mudança de contrato.
**Não funcionou:** nada. Mas recusei uma proposta que veio da sessão do front e já estava implementada: o código `GOOGLE_ONLY` em `/auth/forgot-password`, para quem tem conta só pelo Google. Conferi a API antes de decidir — `controllers/auth.ts` responde 204 em todo caso, com ou sem usuário, e está certa. Responder diferente para "só Google" entrega ao atacante duas informações de graça: que aquele e-mail tem conta aqui, e por onde ele entra. É enumeração de conta, e vai contra o `api/CLAUDE.MD`, que já exige resposta igual para e-mail inexistente e senha errada. O front e o MSW implementaram antes de a rota existir no contrato — o código saiu, e a regra entrou no contrato para ninguém reinventar.
**Decidi:** `SENHA_ATUAL_INCORRETA` (400) em `PUT /me/password` entra no contrato, essa sim: a pessoa já está autenticada, então não há nada a enumerar, e sem código a tela cai no genérico "algum dado não foi aceito" para uma falha que tem explicação exata. A regra geral ficou escrita: erro que a tela precisa explicar tem `code`; o `message` da API é técnico e nunca chega à tela.
**Pendente:** a API tem de emitir `SENHA_ATUAL_INCORRETA`, e é esse commit que carrega a linha do contrato. Aviso de histórico: o commit `2504b70`, que corrige uma frase do contrato, carrega também nove arquivos de `web/` — commitei com `git commit -am` com a sessão do front editando o mesmo repositório, e o `-a` varreu o working tree dela. Não reescrevi o histórico: duas sessões tinham working tree vivo aqui, e um rebase quebraria as duas. A entrada `[front]` de `a23f774` explica aquelas mudanças. O status ficou **400** e não 422: a sessão da API apontou que ela já responde 400, e o front mapeia todo 4xx que não é 401/408/429 para a mesma categoria — o status não distingue nada para a tela, só o `code`. Contrato corrigido para descrever o que a API faz, em vez de pedir uma mudança que não muda nada. Os placeholders legais de `textos.ts` (CNPJ, razão social, endereço, e-mail de contato, comarca, encarregado) seguem esperando os dados do dono.
**Commit:** 5052402

### 2026-10-09 · [api] Criar PATCH /me, e trocar o e-mail derruba as outras sessões

**Fiz:** `PATCH /me` com `name`, `email` e `acceptedTermsVersion`, devolvendo o `SessionUser`. Trocar o e-mail desverifica o endereço novo, sobe `credentials_version`, derruba as outras sessões e emite sessão nova para esta aba.
**Por quê:** quem cria conta pelo Google nasce com aceite dos termos nulo, e o front só libera a área logada depois de gravar esse aceite por esta rota. Sem ela, a pessoa ficava presa no diálogo.
**Funcionou:** `npm test` com 55 de 55 (4 novos em `routes/me.test.ts`: aceite sem cookie novo; troca de e-mail derrubando sessão antiga e mantendo a nova; e-mail de outra conta responde 409; e-mail malformado e nome curto respondem 400). `typecheck`, `lint` e `prettier --check` limpos.
**Não funcionou:** o ambiente de desenvolvimento não subiu. `db:migrate` e os seeds recusam o `api/.env` na validação: `JWT_SECRET` e `REFRESH_TOKEN_PEPPER` têm menos de 32 caracteres, e as chaves opcionais do Google e do TikTok estão presentes e vazias (o `min(1)` recusa). A troca desses valores foi bloqueada na tentativa de escrita, e a decisão ficou com a pessoa dona do `.env`. Os testes não dependem dele: usam `src/test/env.ts`.
**Decidi:**
- A troca de e-mail não pede senha atual, porque o contrato não tem o campo. Proposta para o `CLAUDE.md` da raiz: `currentPassword` opcional, exigido quando `hasPassword` for verdadeiro.
- Trocar o e-mail põe `emailVerified` em falso. Ainda não existe fluxo de verificação, então ele fica falso até existir.
- Aceite dos termos grava a versão mais recente (sobrescreve).
- Entre a checagem de e-mail em uso e o `update` pode haver corrida; um empate perdido cai em 500 genérico, não em 409. Aceito por ora.
**Pendente:**
- `POST /me/avatar`: precisa de `@fastify/multipart` (dependência nova, aguardando aprovação) e de uma decisão de armazenamento (disco local ou outro).
- Ambiente: corrigir os segredos curtos do `.env` e tirar as chaves vazias. O `.env.example` traz as mesmas linhas vazias, então copiá-lo quebra o boot; o `env.ts` deveria tratar string vazia como ausente.
- Divergências com o front (não corrigidas): `perfilInput` aceita nome de 1 caractere, e a API exige 2 (o cadastro já exigia 2). O `usuario` do front declara `email` como texto obrigatório, e a API devolve nulo quando a conta não tem e-mail.
**Commit:** 02470c2

### 2026-10-09 · [front] Tirar o texto técnico da API da tela e testar o mapa de erros

**Fiz:** `ApiError.message` passou a ser sempre o texto em português da categoria; a mensagem que vem no corpo do erro foi para `serverMessage`, só para log e suporte. Antes, ~15 telas mostravam `error.message` direto, então qualquer `message` da API ia para a tela. Também criei `lib/textos.test.ts`, cobrindo os nove códigos do contrato (Google, TikTok e `SESSAO_EXPIRADA`) e o fallback.
**Por quê:** o contrato diz que a mensagem técnica da API não aparece em tela, e a checagem estava só na prosa, não no código.
**Funcionou:** 128 testes (eram 115), lint, typecheck e prettier limpos. O mapa de `textos.ts` já tinha os nove códigos e o fallback; o que faltava era teste e o caminho do `message`.
**Não funcionou:** a troca de senha com senha atual errada passou a mostrar o texto genérico "Algum dado enviado não foi aceito…" em vez de "A senha atual não confere.". O contrato não tem código para isso (o MSW manda só `message`), e não inventei um. O teste foi ajustado e a proposta de código fica pendente.
**Decidi:** a tela trata erro pelo código (`serverCode`) e pela categoria (`code`); texto livre da API não entra em tela. `GOOGLE_ONLY` (409 em `/auth/forgot-password`, em `Recuperar.tsx`) não está no contrato e continua sem entrada em `textos.ts`; a decisão é da raiz.
**Pendente:** (1) os placeholders de `textos.ts` (`[CNPJ]`, `[E-MAIL DE CONTATO]`, prazos, comarca, provedores, encarregado) precisam dos dados reais do dono — não são código e não invento; (2) código para senha atual errada e para `GOOGLE_ONLY` na raiz; (3) `/payouts` segue sem tela e sem definição de `expected`, `settled` e `pending` no contrato.
**Commit:** 87853dc

### 2026-10-02 · [front] Dizer nos gráficos que o GMV é bruto, e usar o contrato novo das listas

**Fiz:** os quatro gráficos do Início passaram a se chamar "GMV bruto" e ganharam uma nota dizendo o que entra na conta e que o topo mostra só o elegível. Junto, apliquei o contrato que a API fechou: `pageSize` nas varreduras de vídeos e produtos, e o `goal` tratado como o do mês corrente em São Paulo.
**Por quê:** o topo virou elegível na tarefa anterior e os gráficos continuaram brutos. Dois números diferentes com o mesmo nome na mesma tela é a forma mais rápida de perder a confiança da creator — ela confere com o app do TikTok e acha que erramos.
**Funcionou:** 115 testes, com o da tela cobrando o título novo e a nota. Lint, Prettier, typecheck e build limpos.
**Não funcionou:** nada travou, mas achei dois defeitos de arrasto. `useAllVideos` e `buscarTodosProdutos` deduziam o tamanho da página pelo que vinha na primeira resposta — bastava a última página vir curta para a conta de páginas sair errada; agora pedem `pageSize: 100` e contam a partir de `total`. E o aviso de meta no sino comparava o GMV **bruto** do mês com a meta, enquanto a barra do Início já media o elegível: o sino podia dizer "meta batida" com a barra em 80%.
**Decidi:** `MAX_PAGE_SIZE` (100) em `api/queries.ts` é o teto do contrato, usado por toda varredura. Não adotei `cursor` em `/orders`: `page` continua valendo, mora na URL e deixa as varreduras buscarem páginas em paralelo; cursor entra se aparecer inconsistência entre páginas. No MSW, o mês do `goal` passou a ser calculado em São Paulo com `dayKey` — era UTC, e nas três últimas horas de cada mês apontava para o mês seguinte.
**Pendente:** nada desta tarefa. `/payouts` segue no contrato sem tela que o use.
**Commit:** 9784352

### 2026-10-02 · [front] Fechar o que a especificação do parser define

**Fiz:** com `docs/parser-affiliate-orders.md` em mãos, fechei o que eu tinha deixado em aberto. O GMV do topo do Início passou a ser o **elegível** (`TO_SETTLE` + `SETTLED`), com o resto numa linha à parte, e a barra da meta mede o mesmo número. `INELIGIBLE` entrou no cálculo de comissão, de onde estava faltando. O envio agora recusa na hora o que a especificação já descarta: extensão fora de `.xlsx` e arquivo acima de 50 MB.
**Por quê:** `INELIGIBLE` só existe em dado vindo de arquivo, então o corte elegível só virou real agora. E o limite de 50 MB eu não tinha de fonte confiável — estava deduzido da análise do Owra, não de uma regra nossa.
**Funcionou:** 115 testes. O do MSW cobra a identidade `gmvEligible + gmvIneligible = gmv` contra os mocks de referência e confere o elegível contra `byStatus`, em vez de fixar um número novo que ninguém validou. O da recusa local cobre extensão, limite e o caso de maiúsculas. Lint, Prettier, typecheck e build limpos.
**Não funcionou:** o teste da recusa não passa pelo seletor de arquivo: o `accept` do campo filtra o `.csv` antes do handler, então ele usa `applyAccept: false`, que é o caminho do arrastar. Também achei um buraco antigo: `STATUSES` em `lib/metrics.ts` não tinha `INELIGIBLE`, então a comissão desses itens sumia da soma sem ninguém notar.
**Decidi:** a recusa local é conveniência, não autoridade — a API confere de novo, e o motivo mostrado é o mesmo texto nos dois caminhos. O limite mora em `LIMITE_MB`, em `lib/import.ts`, apontando para a especificação.
**Pendente:** a seção 3 da especificação continua em aberto (nomes de coluna), e isso **não bloqueia o front** — as telas dependem só dos códigos de erro e do resultado, como o próprio documento diz. Falta resolver uma incoerência que isso expôs: o topo do Início mostra o GMV elegível, mas "GMV por dia" e "GMV acumulado" usam `byDay`, que é bruto. Os dois números aparecem na mesma tela e não batem. Ou `byDay` ganha o corte elegível no contrato, ou os gráficos passam a dizer que são brutos — é decisão de contrato, não do front.
**Commit:** 9784352

### 2026-10-02 · [api] Servir o contrato de dados a partir do banco

**Fiz:** migração `0004_domain.sql` (pedidos, itens, histórico de status, vídeos, snapshots, catálogo de produtos, pautas, metas e preferências de aviso) e os endpoints de dados do contrato: `/summary`, `/orders`, `/orders/:id`, `/videos`, `/videos/:id`, `/products`, `/products/:id`, `/plans`, `/goals`, `/me/notifications`, `/me/export` e `DELETE /me`. Seed em duas partes: `db/seed.sql` com a creator e a conta de demonstração, e `scripts/seed-from-mocks.ts` carregando os JSONs de `mocks/` com o mesmo mapeamento do adaptador do front.
**Por quê:** o front inteiro já existe contra o MSW; faltava o outro lado do contrato para desligar o mock.
**Funcionou:** 51 testes na API. Os de dados conferem os **totais de referência** direto nos endpoints: GMV R$ 11.378,50, 80 pedidos, 115 itens, comissão estimada R$ 1.424,55, a receber R$ 1.023,89, liquidada R$ 181,22, ticket médio R$ 142,23, e a quebra 57/13/7/2/1 por status. Também: cursor percorre os 80 pedidos sem repetir, conta de outra pessoa dá 404, vídeo sem Shop conectado devolve `gmv`/`commission`/`gpm` nulos (nunca zero), meta do mês aparece no resumo, e-mail de aviso continua desligado mesmo quando pedido, exportação não vaza hash de senha e excluir a conta leva tudo junto. Seed rodado duas vezes não duplica.
**Não funcionou:** duas descobertas quebraram premissas. (1) O relatório do TikTok **repete o mesmo id de SKU em linhas diferentes do mesmo pedido** — o mock tem o pedido 575059629618826862 com duas linhas do mesmo SKU, quantidades 1 e 2. A chave `(conta, pedido, sku)` perdia uma venda; passou a carregar `line_no`. (2) `z.uuid()` do Zod 4 valida bits de versão RFC e recusava os ids fixos do seed, que o Postgres aceita sem reclamar: virou `z.guid()` em todo lugar.
**Decidi:** toda soma acontece no SQL, com `filter (where ...)` para os cortes — o service só formata. GPM sai do Postgres em `numeric`: dinheiro não encosta em float em lugar nenhum. Linha de produto é agregação dos pedidos, com imagem e link vindos do catálogo; nome, loja e taxa são os do pedido mais recente. Cursor convive com `page` em vez de substituí-lo, para não quebrar o front que já está pronto. `0004` foi editada em vez de ganhar uma `0005`: ela ainda não tinha sido commitada nem aplicada fora do meu banco de teste.
**Pendente:** `/videos/:id` tem só um snapshot por vídeo (a origem dá um total acumulado, e a leitura que temos é uma só) — a série cresce quando a sincronização existir. `/reconciliation` e `/payouts` continuam fora. Retenção de registro de acesso por 6 meses (Marco Civil) não existe: `DELETE /me` apaga sessões junto, e não há tabela de log separada.
**Commit:** 910b3e7

### 2026-10-02 · [front] Alinhar o front ao contrato fechado de conexão e sessão

**Fiz:** apliquei o que a API confirmou. `PUT /me/password` sem `currentPassword` quando não há senha; `POST /connections/tiktok/start` com `{ kind }`; a volta do TikTok em `/configuracoes?conectado=1` ou `?erro=CODIGO`, com os quatro códigos traduzidos; `SESSAO_EXPIRADA` tratado em `/entrar`. De quebra, as divergências que achei ao reler o `CLAUDE.md`: `accountId` do import foi para a query, `GET /imports` virou paginado e filtrado por `kind`, `SessionUser` ganhou `emailVerified` e `acceptedTermsVersion`, `ImportBatch` ganhou `accountId`, e os códigos do Google viraram os reais.
**Por quê:** o contrato é da API. O que eu tinha era proposta minha, e três pontos estavam errados: eu mandava `accountId` no multipart, esperava um array em `/imports` e inventara `cancelado`/`expirado` como códigos do Google.
**Funcionou:** 112 testes. Os novos cobrem a volta do TikTok (sucesso e recusa, sem código cru), a recusa 503 de pedidos caindo na mensagem certa em vez da genérica de servidor, `SESSAO_EXPIRADA` em `/entrar` e o aceite dos termos de quem entra pelo Google. Lint, Prettier, typecheck e build limpos.
**Não funcionou:** eu tinha escrito o aviso de desconectar a partir do `CLAUDE.md`, sem abrir a API, e saiu errado em dois pontos: prometia prazo para um apagamento que é imediato, e dizia que as metas continuavam, quando `goals` cai junto. Texto sobre o que o sistema faz precisa ser lido no sistema. O botão de pedidos também chegou a navegar para um `authorizeUrl` falso antes de eu ler que `SHOP` responde **503**. Agora não navega: mostra o motivo e fica no lugar, e no dia em que a liberação sair nada muda no front. Também troquei duas vezes de ideia sobre oferecer ou não esse botão; ficou oferecido, porque a recusa explica melhor que um botão morto.
**Decidi:** todo código de erro — da URL ou do `serverCode` de um corpo de erro — passa por `mensagemDoErro`, em `lib/textos.ts`. Um mapa só. O aceite dos termos de conta criada pelo Google trava a área logada num diálogo sem X, e grava por `PATCH /me { acceptedTermsVersion }` (decidido com você; o contrato não tinha rota para isso). O histórico de imports pede `kind=FILE`: as sincronizações automáticas são muitas e não são daquela tela.
**Conferi na API:** li `api/` antes de escrever o aviso de desconectar, e o que estava escrito não batia. `repositories/connections.ts` apaga a linha e, quando o `kind` é `VIDEOS`, apaga todas as conexões do mesmo `provider_user_id` — então a conta inteira cai. E `0004_domain.sql` liga `orders`, `order_skus`, `order_status_history`, `videos`, `video_snapshots`, `products` e **`goals`** a `provider_connections` com `on delete cascade`: o dado some **na hora**, não "em até" prazo nenhum. `plans` e `notification_settings` pendem de `users`, então sobrevivem. O aviso agora diz isso, no código e no canvas, e um teste cobra que a palavra "em até" não apareça ali. `DELETE /me` ainda não existe na API, então o texto de excluir conta não tinha o que conferir.
**Pendente:** `docs/parser-affiliate-orders.md` continua sem existir — confirmado que o documento não foi escrito, e ficou de lado a pedido.
**Commit:** 9784352

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
**Commit:** 9784352

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
**Commit:** 9784352

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
**Commit:** 9784352

### 2026-09-24 · Analisar o Owra como referência

**Fiz:** varredura do app minha.owra.com.br (13 telas, configurações, integrações, planos) e do site público, registrada em `docs/analise-owra.md`, com ideias e necessidades técnicas.
**Por quê:** o Owra é a principal referência de produto; precisávamos saber o que fazem, como os dados chegam e o que falta para o ShopScanner.
**Funcionou:** a análise mostrou que eles resolvem a falta de API com ingestão híbrida (OAuth de vídeos e pedidos a cada 20 min, import de relatório por arquivo e reconferência de status), estimam lives pelos pedidos e cobram por cota de IA.
**Não funcionou:** nada; nenhuma análise de IA foi disparada na conta, para não gastar a cota.
**Decidi:** nada ainda; as ideias ficam como proposta no documento.
**Pendente:** decidir quais ideias entram (projeção do mês, Pareto, apostas e PWA cabem no front atual; ingestão por arquivo e push pedem backend); investigar a origem do status "inelegível" que o Owra mostra.
**Commit:** 9784352

### 2026-09-23 · Construir o design do canvas no front

**Fiz:** as 45 pranchetas do canvas viraram telas. Casca da área logada (menu lateral, barra inferior com "Mais", topo com conta, período e sino), Início com KPIs, gráficos e os estados sem Shop, primeiro acesso e conexão vencida, novo visual de Vendas, Vídeos (com página própria por vídeo), Produtos, Planejamento e Configurações, a página de Avisos, /termos, /privacidade, a landing, entrar, criar conta, recuperar senha e o início rápido. Entrou o contrato aprovado: `PATCH /me`, `PUT /me/password`, `POST /me/avatar`, `POST /auth/tiktok/start`, `lastSyncedAt`/`expiresAt` em contas, `q` e `shopName` em pedidos e produtos, e os tipos novos de `NotificationSettings`.
**Por quê:** o design define o produto inteiro; as telas anteriores eram funcionais, mas sem a navegação e o visual finais.
**Funcionou:** 93 testes (casca, KPIs com os totais dos mocks, estados do Início, filtros e chips de Vendas, CSV, filtro por loja e "marcar para regravar", vídeos sem Shop sem nenhum R$ 0,00, avisos derivados e lidos, nome da pauta derivado do gancho e renomeável, perfil, senha, foto, meta, entrar, criar conta com força da senha e aceite, recuperar senha e início rápido). Conferi as telas no Chrome, desktop e 390px, sem rolagem horizontal.
**Não funcionou:** o texto oculto da última coluna das tabelas, com posição absoluta, vazava para a largura da página; resolvido com `relative` no contêiner. A mensagem de erro dentro do `<label>` voltou a aparecer no modal novo e saiu do rótulo de novo. O `FormData` do jsdom com arquivo não passa pelo `Request` do Node, então o teste da foto confere o envio antes do MSW.
**Decidi:** números do design são ilustrativos; as telas usam os dados do contrato. Cortados de vez: frete e descontos, prazo de devolução, liquidação prevista, produtos marcados no vídeo, aviso por e-mail do Shop e toda frase "por e-mail" das telas. "Comissões em um lugar só" da landing perdeu "com a data de cada pagamento". A ilustração da landing ganhou o selo "Exemplo". Arrastar no quadro continua com a alternativa por menu, que o design não mostrava. A meta do início rápido é de comissão e a de Configurações é de GMV, como no design; cada tela preserva a outra.
**Pendente:** propostas de contrato, para aprovar: (1) `units` por vídeo em /videos e /videos/:id; (2) `q` e `pageSize` em /videos, hoje a busca é no front com todos os vídeos do período; (3) `pageSize` e os valores de `sort` de /products no contrato (`gmv`, `commission`, `units`, `refunds`); (4) `imageUrl` em `topProducts` e nos SKUs de pedido, para as miniaturas; (5) `user.avatarUrl` e `user.createdAt` na sessão; (6) um endpoint para iniciar a conexão do TikTok Shop, hoje o botão fica desativado; (7) a série de views disponível em /videos, para derivar o aviso `viewsDrop` sem abrir vídeo por vídeo; (8) total de itens em /orders, porque o design conta itens e o contrato pagina pedidos; (9) filtro "todas as contas" para quem tem mais de uma. Também falta preencher `web/src/lib/textos.ts`.
**Commit:** 9784352

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
