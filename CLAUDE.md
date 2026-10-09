# ShopScanner — contexto geral do projeto

Plataforma de BI para **creators afiliados do TikTok Shop no Brasil**. A creator cria conta no app, conecta a conta do TikTok e — quando a integração for liberada — a conta do TikTok Shop. O app mostra comissões, quais vídeos venderam, quais produtos rendem mais e ajuda a planejar os próximos vídeos.

Público: creators de 20 a 40 anos, quase sempre no celular, sem familiaridade com dashboards corporativos. Interface inteira em português do Brasil, valores em `R$ 1.234,56`, datas em `dd/mm/aaaa`.

> **Este arquivo é o chão comum das duas pontas.** Produto, contrato, regras de domínio e números moram aqui. Detalhe de implementação mora em `web/CLAUDE.md` (front) e `api/CLAUDE.md` (backend). Se uma regra vale para os dois lados, ela vem para cá — e não é copiada para lá.

## Mapa do repositório

```
CLAUDE.md             este arquivo: produto, contrato, domínio, números
DEVLOG.md             histórico de decisões (uma entrada por tarefa)
.githooks/pre-commit  bloqueia commit de código sem DEVLOG.md
web/                  front-end (Vite + React).  Contexto: web/CLAUDE.md
api/                  backend (Fastify + Postgres). Contexto: api/CLAUDE.md
mocks/                JSONs no formato oficial da API do TikTok (não editar à mão)
docs/                 termos, política, especificação do parser, prompts
scripts/              utilitários do repositório (hook do devlog)
```

Os prompts de construção ficam em `docs/PROMPTS.md` (front) e `docs/PROMPTS-API.md` (backend) e são colados um a um no chat.

## Quem é dono do quê

- **A API é dona do contrato.** Se o contrato mudar, muda neste arquivo e na API no mesmo commit. O front se adapta; nunca o contrário.
- **O front nunca fala com o TikTok.** Quem guarda `app_secret`, troca código por token, assina as chamadas com HMAC-SHA256 e sincroniza pedidos é a API. Se uma tarefa de front pedir chamada ao TikTok, pare e avise.
- **O front não faz conta de negócio nova.** Corte, soma e definição de métrica vivem em "Definições dos números", abaixo, e a API entrega pronto. O front só formata e deriva o que está escrito aqui.
- **Nenhuma das pontas inventa campo.** Dado que não existe no contrato é proposta, não implementação: pare e pergunte.

## Estado da integração (importa para as duas pontas)

| Fonte                                                             | Situação em 01/10/2026                                                                                                                  |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| TikTok Shop — Affiliate Creator API (pedidos, comissões, vitrine) | **Não liberada para o Brasil.** Depende da aprovação da categoria "Creator collaborations". Ticket aberto.                              |
| Display API (vídeos da própria creator)                           | Disponível, depende da revisão do app em developers.tiktok.com.                                                                         |
| Métricas de e-commerce por vídeo (`analytics/202403`)             | Só para creators dos EUA.                                                                                                               |
| APIs de live room                                                 | Não confirmado se aceitam token de creator do Brasil.                                                                                   |
| Import do `affiliate_orders.xlsx`                                 | **É a espinha de dados do MVP** enquanto a API não libera. Especificação em `docs/parser-affiliate-orders.md` (seção 3 ainda pendente). |

Consequência para o front: toda tela de dados precisa de um estado em que só os dados de vídeo aparecem — **mas quem dispara esse estado é a ausência de dado de venda, nunca `shopConnected`.**

> **`shopConnected` não governa exibição de venda.** Ele descreve só a conexão viva com o TikTok Shop: serve ao cartão de Configurações, ao aviso de "em liberação no Brasil" e à sincronização automática. Nada mais.
>
> O motivo é aritmético. `POST /connections/tiktok/start` com `kind: "SHOP"` responde **503** enquanto a Affiliate Creator API não liberar o Brasil, então **nenhuma creator real consegue ter `shopConnected: true`**. Se as telas de venda dependessem dessa bandeira, Início, Vendas, Produtos e Planejamento diriam "conecte o TikTok Shop" para 100% dos usuários, para sempre — inclusive depois de um import de `.xlsx` bem-sucedido, que é justamente a espinha de dados do MVP. O dado entraria no banco e as telas se recusariam a mostrá-lo.
>
> Então: **tela de venda mostra venda quando existe venda**, não importa a procedência (`API` ou `FILE`). O estado "só vídeo" aparece quando não há venda nenhuma, e a saída que ele oferece é **enviar o relatório em arquivo** — o caminho que existe —, não conectar o Shop, que hoje é um caminho fechado.
>
> Vale também por item: `gmv`, `commission` e `gpm` de vídeo vêm nulos quando **não há venda ligada àquele vídeo**, não quando `shopConnected` é falso.
>
> Isso passou despercebido porque `db/seed.sql` insere a linha `SHOP` direto no banco, sem passar pela rota que recusa: a conta de demonstração nasce com `shopConnected: true` e esconde o estado real de todo usuário. Consequência para a API: o cliente do TikTok nasce pronto e **desligado por variável de ambiente**, com as rotas respondendo indisponibilidade clara.

## Contrato

Base: `VITE_API_URL` no front. Autenticação por **cookie httpOnly** de sessão. Nunca token em `localStorage`, nunca token em corpo de resposta.

Convenções: dinheiro como **texto decimal** (`"11378.50"`) com `currency` ao lado; datas em **ISO 8601 UTC**; taxas como **inteiro em centésimos de %** (`1500` = 15%), igual ao TikTok.

**Corpo de erro, em toda rota:** `{ code: string, message: string }`. O `code` é estável e é o que a interface traduz; o `message` é técnico, serve para log e suporte, e **nunca** vai para a tela. Campo extra só quando o contrato declarar (como `columnsFound` e `columnsMissing` do import). O nome do campo é `code`, não `error`: `ImportBatch.error.code` já usava `code`, e o front inteiro lê `code`.

Códigos transversais: `VALIDACAO` (400), `NAO_ENCONTRADO` (404), `MUITAS_REQUISICOES` (429, com `Retry-After` **em segundos** — data HTTP é ignorada pelo front), `INTERNO` (500).

```
POST /auth/register            { name, email, password, acceptedTermsVersion }
POST /auth/login               { email, password }
POST /auth/refresh             -> renova a sessão; o cliente chama uma vez ao tomar 401
POST /auth/logout
POST /auth/logout-all
POST /auth/forgot-password     { email }
POST /auth/reset-password      { token, newPassword }
GET  /auth/session             -> { user: SessionUser, accounts[] }
GET  /auth/sessions            -> [{ id, userAgent, createdAt, lastUsedAt, current }]
DELETE /auth/sessions/:id

GET  /auth/google/start        -> redireciona para o Google (login social)
GET  /auth/google/callback     -> cria a sessão e volta para o app
                                  erro volta como /entrar?erro=CODIGO, sem detalhe técnico
GET  /auth/identities          -> [{ provider: "GOOGLE", email, linkedAt, canUnlink }]
DELETE /auth/identities/:provider  -> só quando canUnlink; 409 se for o único acesso

PATCH /me                      { name?, email?, acceptedTermsVersion?, currentPassword? }
                                 -> SessionUser
                                 acceptedTermsVersion é o aceite de quem criou a conta
                                 pelo Google, pedido no primeiro acesso
                                 currentPassword é exigido para trocar o email quando
                                 hasPassword é true: sem isso, uma sessão sequestrada
                                 troca o email, pede recuperação e fica com a conta.
                                 Trocar o email marca emailVerified: false e derruba
                                 todas as sessões; a aba que pediu a troca continua
                                 logada com a sessão nova, igual à troca de senha
PUT  /me/password              { currentPassword?, newPassword }
                                 currentPassword só é exigido quando hasPassword é true
POST /me/avatar                multipart -> { avatarUrl }

GET  /accounts                 -> [{ id, username, avatarUrl, shopConnected, hasSales,
                                     connectedAt, lastSyncedAt, expiresAt }]
                                 hasSales: existe pedido nesta conta, de qualquer fonte.
                                 É o que decide se a tela de venda mostra venda ou
                                 convida a enviar o relatório — nunca shopConnected
POST /connections/tiktok/start { kind?: "VIDEOS" | "SHOP" } -> { authorizeUrl }
                                 o front navega para authorizeUrl; "SHOP" responde 503
GET  /connections/tiktok/callback  cria a conexão e volta para /configuracoes
DELETE /connections/:id

GET  /summary?accountId&from&to
  -> { gmv, gmvEligible, gmvIneligible,
       commissionEstimated, commissionToReceive, commissionSettled,
       unitsSold, ordersCount, avgTicket, goal,
       byDay: [{ date, gmv, commission }],
       byStatus: [{ status, gmv }],
       byChannel: [{ channel, gmv }],
       topProducts: [{ productId, name, shopName, gmv, commission, units }] }

GET  /orders?accountId&from&to&status&channel&productId&shopName&q&page&pageSize&cursor
  -> { items: Order[], total, page, nextCursor }
     cursor é opcional e substitui page; nextCursor vem null na última página
GET  /orders/:id               -> OrderDetail

GET  /videos?accountId&from&to&sort&hashtag&page&pageSize
     sort: postedAt (padrão) | views | gmv | gpm
  -> { items: [{ id, title, description, postedAt, duration, coverUrl, shareUrl,
                 views, likes, comments, shares, gmv?, commission?, gpm? }], total }
GET  /videos/:id               -> vídeo + snapshots: [{ at, views, likes }]

GET  /products?accountId&from&to&sort&shopName&q&page&pageSize
     sort: gmv (padrão) | commission | units | refunds
  -> { items: ProductRow[], total, page }
GET  /products/:id             -> ProductDetail

GET  /plans  ·  POST /plans  ·  PATCH /plans/:id  ·  DELETE /plans/:id
GET  /goals  ·  PUT  /goals
GET  /me/notifications  ·  PUT /me/notifications

POST /imports?accountId        multipart, campo `file` com o .xlsx -> { importId }
                                 accountId vai na query, não no corpo do multipart
GET  /imports?accountId&kind&status&page&pageSize
                               -> { items: ImportBatch[], total, page }
GET  /imports/:id              -> ImportBatch, para acompanhar o processamento
GET  /reconciliation?accountId&from&to
  -> [{ orderId, skuId, field, fromFile, fromApi, resolvedWith, at }]

GET  /me/export                -> arquivo JSON com todos os dados
DELETE /me                     -> exclusão de conta
```

Campos opcionais (`gmv`, `commission`, `gpm` em vídeos) vêm nulos quando **não há venda ligada àquele vídeo** — e não quando `shopConnected` é falso. A API preenche a partir dos pedidos de **qualquer** procedência, `API` ou `FILE`: venda que entrou por arquivo e tem `contentId` conta igual. A interface trata o nulo como "ainda não disponível", **nunca como zero**, e nunca como "conecte o Shop".

### Identidade de acesso e conexões

Duas coisas diferentes, que nem a interface nem o banco misturam:

- **Identidade de acesso** — como a pessoa entra no app: e-mail e senha, ou **Google**. É o que aparece em `/entrar` e `/criar-conta`. Não existe botão de entrar com TikTok. No banco: `auth_identities`.
- **Conexões** — contas de terceiro que o app lê depois de a pessoa já ter conta. O TikTok entra aqui, em duas partes independentes: **vídeos** (Display API, disponível) e **pedidos** (TikTok Shop, em liberação no Brasil). Cada parte conecta, expira e desconecta por conta própria. No banco: `provider_connections`.

Por que o TikTok ficou fora do login: ele não devolve e-mail, então a conta ficaria sem canal de recuperação e de cobrança; e revogar a autorização no app do TikTok trancaria a creator fora da própria conta no ShopScanner. Como conexão, revogar só interrompe a importação.

Na tela de Configurações isso vira dois blocos separados: **Acesso à conta** (e-mail, trocar senha, Google vinculado ou não) e **Contas conectadas** (TikTok vídeos com status, última leitura e desconectar; TikTok Shop pedidos com o aviso "em liberação no Brasil" enquanto `shopConnected` for falso).

### Tipos do contrato

```ts
type Money = string; // decimal em texto: "1234.56". Nunca number.
type Rate = number; // centésimos de %: 1500 = 15%
type Iso = string; // ISO 8601 em UTC

type SessionUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  avatarUrl: string | null;
  hasPassword: boolean; // falso quando a conta nasceu pelo Google e nunca definiu senha
  identities: { provider: "GOOGLE"; email: string; linkedAt: Iso }[];
  acceptedTermsVersion: string | null;
};

type OrderStatus =
  | "AWAITING_PAYMENT"
  | "TO_SETTLE"
  | "SETTLED"
  | "REFUNDED"
  | "FROZEN"
  | "INELIGIBLE"; // só quando source = "FILE"; ver "Fontes do dado"

type Source = "API" | "FILE" | "ESTIMATED";
type Channel =
  | "VIDEO"
  | "LIVE"
  | "PRE_LIVE"
  | "SHOP"
  | "LINKSHARE"
  | "PROMOTION_PAGE";

type OrderSku = {
  id: string;
  productId: string;
  name: string;
  shopName: string;
  unitPrice: Money;
  quantity: number;
  returnedQuantity: number;
  refundedQuantity: number;
  gmv: Money; // unitPrice × quantity
  commissionBaseActual: Money | null; // base já sem devoluções; null fora de SETTLED
  commissionRate: Rate; // total
  rates: { standard: Rate; shopAds: Rate; bonus: Rate; reward: Rate };
  commissionEstimated: Money;
  commissionSettled: Money | null; // só em SETTLED
  shopAdsCommissionEstimated: Money;
  channel: Channel;
  contentId: string | null;
};

type Order = {
  id: string;
  createdAt: Iso;
  deliveredAt: Iso | null;
  status: OrderStatus;
  currency: string; // "BRL", no pedido, não no item
  source: Source; // de onde veio o registro
  sourceAt: Iso; // quando essa fonte leu o dado
  skus: OrderSku[];
};

type OrderDetail = Order & {
  statusHistory: { status: OrderStatus; at: Iso }[];
};

type ImportBatch = {
  id: string;
  accountId: string;
  kind: "FILE" | "SYNC" | "RECHECK"; // arquivo, sincronização automática, reconferência
  fileName: string | null;
  createdAt: Iso;
  status: "QUEUED" | "PROCESSING" | "DONE" | "FAILED";
  result: {
    created: number;
    updated: number;
    unchanged: number;
    skipped: number;
  } | null;
  error: {
    code:
      | "WRONG_EXTENSION"
      | "TOO_LARGE"
      | "NO_HEADER"
      | "UNKNOWN_COLUMNS"
      | "WRONG_CURRENCY"
      | "WRONG_FILE"
      | "FAILED";
    message: string;
    columnsFound?: string[];
    columnsMissing?: string[];
  } | null;
};

type ProductRow = {
  productId: string;
  name: string;
  shopName: string;
  imageUrl: string | null;
  gmv: Money;
  commission: Money;
  commissionRate: Rate;
  units: number;
  refundedUnits: number;
  ordersCount: number;
  topChannel: Channel | null;
};

type ProductDetail = ProductRow & {
  detailUrl: string | null;
  videos: {
    id: string;
    title: string;
    coverUrl: string | null;
    postedAt: Iso;
    views: number | null;
    gmv: Money | null;
    units: number | null;
  }[];
};

type PlanStatus = "IDEA" | "SCRIPT" | "RECORDED" | "EDITED" | "POSTED";

type Plan = {
  id: string;
  title: string;
  productId: string | null;
  scheduledFor: Iso | null;
  status: PlanStatus;
  videoId: string | null;
  script: {
    hook: string;
    scene1: string;
    scene2: string;
    cta: string;
    caption: string;
  } | null;
  notes: string | null;
  createdAt: Iso;
  updatedAt: Iso;
};

type Goal = {
  accountId: string;
  month: string; // "AAAA-MM"
  gmv: Money | null;
  commission: Money | null;
};

type NotificationSettings = {
  orderSettled: boolean; // comissão liquidada
  orderFrozen: boolean; // pedido retido
  orderRefunded: boolean; // pedido reembolsado
  goalReached: boolean; // meta do mês: dispara em 80% e em 100%
  paceDrop: boolean; // queda de ritmo de vendas contra o período anterior
  viewsDrop: boolean; // queda de views contra a média recente
  postReminder: boolean; // lembrete de postar, vindo do planejamento
  channels: { inApp: boolean; email: boolean }; // email fica false no MVP
};
```

Em `/summary`, `goal` é `{ gmv: Money | null; commission: Money | null } | null` referente ao mês corrente.

Decisões de contrato que valem para as duas pontas:

- Status do TikTok convertidos **pela API**: `AWAITING PAYMENT` → `AWAITING_PAYMENT`, `To-SETTLE` → `TO_SETTLE`, o resto igual. A API sempre manda a chave; o front traduz para o rótulo em português.
- `canUnlink` é derivado na API, não no front: desvincular o Google só é permitido quando `hasPassword` é verdadeiro.
- **Não existe endpoint de feed de notificação.** O sino do topo é derivado no front a partir de `/summary`, `/orders`, `/videos` e `/plans` já carregados. `/me/notifications` só liga e desliga cada tipo.
- No MVP só o canal no app funciona, então nenhuma tela escreve "por e-mail". Resumo semanal e novidades do produto ficam fora até a API enviar e-mail.
- O campo `title` da pauta continua obrigatório no contrato, mas o formulário não pede: o front deriva das primeiras palavras do gancho. Gancho vazio vira "Pauta sem nome".
- "Marcar para regravar" não é campo novo: cria uma pauta em `/plans` com `status: "IDEA"` e o `productId` do produto.
- **Detalhe de produto e de vídeo não tem período**: `GET /products/:id` e `GET /videos/:id` devolvem o total **desde o início**, enquanto a lista que levou até ele é do período filtrado. Os dois números aparecem na mesma tela e não batem, então o detalhe **diz em tela que é desde o início**. Não é o mesmo caso do GMV elegível: lá o número do topo estava errado para a creator, aqui os dois estão certos e medem coisas diferentes. Passa a aceitar período só se alguém pedir — e então muda nos dois endpoints de uma vez.
- **Erro do Google quando já existe sessão** volta para `/configuracoes?erro=CODIGO`, não para `/entrar`: quem está logado e vai vincular o Google seria redirecionado de `/entrar` para `/inicio` pela guarda de rota, e a mensagem se perderia. Sem sessão continua em `/entrar?erro=CODIGO`.
- **`/auth/forgot-password` responde sempre 204**, com e-mail existente ou não, com senha ou só com Google. Nenhum código de erro, nenhuma distinção: a resposta que varia conta ao atacante quais e-mails têm conta aqui e quais entram pelo Google. Não existe, e não pode existir, um `GOOGLE_ONLY` nessa rota. Quem só tem Google descobre isso ao tentar entrar, não ao pedir recuperação.
- **Erro que o usuário precisa entender tem `code` estável.** O front nunca mostra o `message` da API — ele é técnico, vai para log e suporte. Falha sem `code` cai no texto genérico, que é pior experiência: se a tela precisa explicar algo específico, a API manda `code`, e o front traduz em `lib/textos.ts`. Hoje: `SENHA_ATUAL_INCORRETA` (400) em `PUT /me/password` — o status não distingue nada para o front, que mapeia todo 4xx que não é 401/408/429 para a mesma categoria; é o `code` que decide o texto.
- **`GET /payouts` saiu do contrato** (09/10/2026). Nunca teve `expected`, `settled` e `pending` definidos em "Definições dos números", nunca foi servido pela API e nenhuma tela usou. `/summary` já entrega `commissionToReceive` e `commissionSettled`. Volta só com a definição escrita primeiro e uma tela que a use.

## Fontes do dado: API, arquivo e estimativa

O MVP funciona **antes** de a API ser liberada, com o relatório `affiliate_orders.xlsx` que a creator exporta do Centro de Afiliados do TikTok. Especificação em `docs/parser-affiliate-orders.md`.

- Todo pedido carrega `source` e `sourceAt`. A interface mostra isso como selo discreto: "da API, lido às 14h20", "do arquivo de 12/09", "estimado".
- `INELIGIBLE` só existe quando `source` é `FILE`: é o rótulo que a creator vê no app do TikTok. A API separa a mesma situação em `REFUNDED` e `FROZEN`. O mapeamento definitivo depende de ver a planilha real; até lá, a API guarda o status do arquivo como veio.
- Quando as duas fontes existirem para o mesmo pedido, **a API prevalece** e a divergência entra em `/reconciliation`. Nada é sobrescrito em silêncio.
- Reimportar o mesmo arquivo atualiza, não duplica. A chave é id do pedido mais id do SKU.
- Dado estimado (duração de live deduzida dos pedidos, por exemplo) sempre aparece rotulado como estimativa.

## Definições dos números

Esta seção é a fonte única. A API calcula assim; o front exibe assim; o teste confere assim.

- **GMV do topo do Início é o elegível**: só `TO_SETTLE` e `SETTLED`. O que está em `AWAITING_PAYMENT`, `INELIGIBLE`, `REFUNDED` ou `FROZEN` aparece numa linha à parte ("+ R$ X aguardando ou não elegível"). O motivo: é assim que a creator vê no app do TikTok, e número que não bate com a fonte destrói a confiança no resto. O bruto continua disponível em `gmv`.
- `commissionEstimated` do resumo: soma da comissão estimada de **todos** os pedidos do período, inclusive reembolsados. É o valor bruto.
- `commissionToReceive`: só pedidos `TO_SETTLE`. Pedido `AWAITING_PAYMENT` ainda não foi pago, então não entra.
- `commissionSettled`: comissão real dos pedidos `SETTLED`.
- Comissão perdida (KPI): comissão estimada de `REFUNDED` mais `FROZEN`.
- Venda por anúncio da loja: `rates.shopAds > 0`. É dedução, não campo oficial — concentrada em uma função só em cada ponta.
- Taxa padrão vem pronta em `rates.standard`; ninguém recalcula por subtração.

### Totais de referência (mocks, 30 dias, conta demo)

O front confere nos testes do adaptador; a API confere nos testes dos endpoints depois do seed. Se um lado divergir do outro, **o erro está no lado que divergiu destes números**.

| Métrica                           | Valor                                                                |
| --------------------------------- | -------------------------------------------------------------------- |
| GMV                               | R$ 11.378,50                                                         |
| Pedidos                           | 80 (90 linhas de SKU, 115 itens)                                     |
| Ticket médio                      | R$ 142,23                                                            |
| Comissão estimada (todos)         | R$ 1.424,55                                                          |
| A receber (`TO_SETTLE`)           | R$ 1.023,89                                                          |
| Liquidada (`SETTLED`, valor real) | R$ 181,22                                                            |
| Perdida (`REFUNDED` + `FROZEN`)   | R$ 181,67                                                            |
| Aguardando pagamento              | R$ 24,28                                                             |
| Pedidos por status                | 57 a liquidar, 13 liquidados, 7 reembolsados, 2 aguardando, 1 retido |
| SKUs com Shop Ads                 | 15, somando R$ 1.843,40 de GMV                                       |

## Regras vindas da API do TikTok

Valem para a API, que traduz, e para o front, que precisa saber de onde o número vem.

- **GMV** = preço × quantidade do item (no TikTok, o campo é `estimated_commission_base`). Não existe campo "gmv" na origem.
- **Comissão**: estimada enquanto não liquida; o valor real só existe quando o status é `SETTLED`.
- **Taxas em centésimos de %**: `1500` = 15%. A taxa total já soma padrão, anúncio da loja, bônus e reward.
- **Status**: `AWAITING PAYMENT`, `To-SETTLE`, `SETTLED`, `REFUNDED`, `FROZEN` → Aguardando pagamento, A liquidar, Liquidado, Reembolsado, Retido. **Não existe "inelegível" na API.**
- **Canais**: `VIDEO`, `LIVE`, `PRE_LIVE`, `SHOP` (vitrine), `LINKSHARE` (link), `PROMOTION_PAGE`.
- **Venda por anúncio da loja**: dedução a partir da comissão de Shop Ads maior que zero. Não existe sinal oficial de GMV Max.
- **Reembolso**: a origem dá só a quantidade, não o valor. O valor é calculado.
- A origem **não tem** id da loja, data de liquidação nem valor reembolsado.
- Views de vídeo são um total acumulado; a série no tempo vem dos snapshots que a API guarda.
- Ainda **não está confirmado** que o identificador de conteúdo do pedido (`contentId`) é o mesmo id do vídeo. Toda análise por vídeo depende disso: tratar como suposição isolada, em um lugar só, fácil de corrigir.

Valores monetários são texto: converter com decimal, nunca com float.

## O que cada ponta precisa saber da outra

Esta seção existe porque as duas pontas são construídas em sessões separadas. É o mínimo para não quebrar a outra sem perceber.

**O front precisa saber da API:**

- Sessão é cookie `httpOnly`. O cliente HTTP manda `credentials: "include"` e `X-Requested-With: shopscanner` em toda rota que muda estado.
- `Continuar com Google` é **navegação do navegador** para `GET /auth/google/start`, não `fetch`. A sessão volta por cookie no callback. Erro volta em `/entrar?erro=CODIGO`, com um destes códigos: `GOOGLE_INDISPONIVEL` (login social desligado), `GOOGLE_RECUSADO` (a pessoa cancelou no Google), `EMAIL_NAO_VERIFICADO` (o Google não confirma o e-mail) e `JA_VINCULADO` (aquela conta do Google já pertence a outro cadastro). O front traduz; a API nunca manda detalhe técnico na query.
- **Conectar o TikTok** é diferente do login social: `POST /connections/tiktok/start` devolve `authorizeUrl` e o front navega para lá. A volta cai em `/configuracoes?conectado=1`, ou `/configuracoes?erro=CODIGO` com `TIKTOK_RECUSADO`, `TIKTOK_INDISPONIVEL`, `TIKTOK_SHOP_INDISPONIVEL` ou `TIKTOK_INVALIDO`. Sessão vencida no meio do caminho volta em `/entrar?erro=SESSAO_EXPIRADA`.
- **Desconectar apaga**: `DELETE /connections/:id` remove a conexão e o token guardado, e desligar os vídeos desliga junto a parte de pedidos da mesma conta.
- **Definir a primeira senha**: quem entrou pelo Google chama `PUT /me/password` só com `newPassword`. A resposta traz cookies novos — trocar a senha derruba todas as sessões, e a aba que pediu a troca continua logada com a sessão nova.
- Se a pessoa já está logada quando volta do Google, o callback só **vincula** a identidade e mantém a sessão atual — não emite cookie novo. É assim que a tela de Configurações vincula o Google.
- Conta criada pelo Google nasce sem senha (`hasPassword: false`) e com `acceptedTermsVersion: null`: o front pede o aceite dos termos depois do primeiro acesso e grava por `PATCH /me { acceptedTermsVersion }`. Enquanto estiver nulo, a área logada fica atrás de um diálogo que só sai com o aceite.
- Ao tomar 401, o cliente chama `POST /auth/refresh` **uma vez** e repete a requisição; se falhar de novo, vai para `/entrar`.
- O access token dura 15 minutos. Aba aberta por muito tempo vai tomar 401 — isso é normal, não é erro de tela.
- Listas grandes aceitam **cursor**: `/orders` devolve `nextCursor` e aceita `cursor` no lugar de `page`. O `total` vem sempre, contado à parte. Página sem cursor continua funcionando; `pageSize` tem teto de 100 em todas as listas.
- O `goal` de `/summary` é o do **mês corrente em São Paulo**, não o do período filtrado.
- Import de arquivo é assíncrono: `POST /imports` devolve `importId` e o processamento acontece em fila. O front acompanha por `GET /imports/:id`, não espera na resposta do upload.
- **`accountId` do import vai na query, não como campo do multipart.** O relatório do TikTok não diz de qual conta veio, então a API precisa da conta — mas precisa dela **antes** de ler o arquivo, para recusar conta de outra pessoa sem engolir 50 MB. Em campo de multipart isso só funcionaria se o campo viesse antes do arquivo, e essa é uma regra que um dia alguém quebra sem perceber. Conta que não é da sessão responde 404.
- Limites do upload, conferidos antes de enfileirar: só `.xlsx`, só a primeira aba, no máximo 50 MB, só `BRL`. Cada recusa vira um `error.code` do `ImportBatch` (`WRONG_EXTENSION`, `TOO_LARGE`, `WRONG_CURRENCY`, ...), nunca um 500 seco.
- `GET /imports` é paginado como `/orders` (`{ items, total, page }`), ordenado do mais recente para o mais antigo, com `pageSize` padrão de 20 e teto de 100. Filtra por `kind` (`FILE`, `SYNC`, `RECHECK`) e por `status` — a tela de histórico mostra só os de arquivo sem precisar baixar as sincronizações automáticas, que são muitas.
- Nenhum endpoint devolve token. Nada para guardar.

**A API precisa saber do front:**

- O front é SPA em outra origem. CORS restrito a `WEB_ORIGIN` com `credentials: true`, e o callback do Google redireciona para `WEB_ORIGIN`.
- O front filtra por **dia de São Paulo** na URL e converte para ISO UTC na chamada. A API recebe e devolve sempre UTC.
- Todo pedido precisa de `source` e `sourceAt`: tem selo de procedência em tela para cada número de venda.
- `GET /accounts` precisa de `lastSyncedAt`: o front mostra "atualizado há X" no topo e um lembrete no Início quando o último import passou de 5 dias.
- O front não tem feed de notificação: não crie endpoint para isso.
- Depois do seed, os endpoints têm que reproduzir os **totais de referência** acima — é como o front detecta que a API quebrou alguma conta.

## Fora do MVP

Lives, produtos em alta do mercado, ranking de hooks, amostras, classificação de gancho por IA e benchmark entre creators. Não colocar na navegação agora.

## Devlog (obrigatório, nas duas pontas)

Toda mudança entra no `DEVLOG.md` da raiz, **no mesmo commit da mudança**. Tarefa sem entrada no devlog não está concluída. O hook `.githooks/pre-commit` cobra isso (instalar uma vez com `git config core.hooksPath .githooks`).

Como escrever:

- Uma entrada por tarefa concluída, sempre no topo do arquivo, da mais recente para a mais antiga.
- Marque a ponta no título: `[front]`, `[api]` ou `[repo]`. Em sessões separadas, é isso que faz a outra ponta entender o que mudou sem ler o diff.
- Não repita o diff. O git já guarda o que mudou; o devlog guarda **por que**, o que funcionou e o que não funcionou.
- Não registre formatação, lint, bump de dependência nem renomeação trivial.
- Atualize a seção "Estado atual", no topo do `DEVLOG.md`, sempre que o estado do projeto mudar.
- Ao começar uma sessão, leia **só** o "Estado atual" e as duas últimas entradas. Nunca leia o arquivo inteiro.
- Decisão permanente não fica só no devlog: contrato, domínio e número vão para este arquivo; padrão de código e token de design vão para o `CLAUDE.md` da ponta. O devlog registra que a decisão foi tomada e por quê.

Formato da entrada:

```markdown
### AAAA-MM-DD · [front|api|repo] título curto no imperativo

**Fiz:** o que foi entregue, em uma ou duas frases.
**Por quê:** o problema que isso resolve.
**Funcionou:** o que passou a funcionar, com evidência (teste, tela, comando).
**Não funcionou:** tentativas descartadas e o motivo. "Nada" também é resposta.
**Decidi:** escolhas que valem daqui para a frente.
**Pendente:** o que ficou faltando.
**Commit:** hash curto
```

## Regras para o agente (valem nas duas pontas)

- Leia este arquivo e o `CLAUDE.md` da pasta em que vai trabalhar antes de começar. Só esses dois.
- Nenhuma tarefa está pronta sem a entrada no `DEVLOG.md` no mesmo commit.
- Se um dado não existe no contrato, **não invente**: proponha o campo e pergunte.
- Mudança no contrato toca este arquivo e a API no mesmo commit, e vira entrada no devlog com `[repo]`.
- Mexeu em algo que afeta a outra ponta (contrato, formato de dado, cookie, código de erro)? Diga isso em voz alta no fim da tarefa, com a frase exata que precisa ser levada para a outra sessão.
- Nada de segredo em código, em log ou em commit.
- Dinheiro é decimal em texto. Nunca `float`, em nenhuma das pontas.
- Perguntar antes de adicionar dependência nova.
- Commits pequenos, em português, no imperativo.
