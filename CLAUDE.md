# [NOME DO APP] — contexto do projeto (front-end)

Plataforma de BI para **creators afiliados do TikTok Shop no Brasil**. A creator conecta a conta do TikTok e, quando a integração for liberada, a conta do TikTok Shop. O app mostra comissões, quais vídeos venderam, quais produtos rendem mais e ajuda a planejar os próximos vídeos.

**O front-end fica em `web/`.** O backend é próprio e fica fora de `web/`. O front nunca fala com o TikTok: quem guarda `app_secret`, faz a troca de token, assina as chamadas com HMAC e sincroniza os pedidos é o backend.

Público: creators de 20 a 40 anos, quase sempre no celular, sem familiaridade com dashboards corporativos. Interface inteira em português do Brasil, valores em `R$ 1.234,56`, datas em `dd/mm/aaaa`.

## Stack

- **Vite + React + TypeScript**
- **Tailwind CSS + shadcn/ui** (Radix)
- **React Router** para as rotas
- **TanStack Query** para estado de servidor, **Zod** para validar respostas
- **Recharts** para gráficos
- **react-hook-form** nos formulários
- **MSW** para simular a API enquanto o backend não existe
- **Vitest + Testing Library**, **ESLint + Prettier**

Sem framework de servidor, sem ORM, sem rota de API aqui dentro.

## Estrutura

```
CLAUDE.md, DEVLOG.md  contexto e histórico (raiz)
.githooks/pre-commit  bloqueia commit de código sem DEVLOG.md
web/                  front-end: package.json, configs, public/, src/
web/src/
  routes/public/      landing, /entrar, /criar-conta, /recuperar, /termos, /privacidade
  routes/app/         /inicio, /vendas, /videos, /produtos, /planejamento, /configuracoes
  components/ui/      shadcn
  components/charts/  wrappers do Recharts
  api/                cliente HTTP, tipos e schemas Zod do contrato com o backend
  mocks/              handlers do MSW + adaptador dos JSONs em /mocks
  lib/                formatadores, métricas derivadas, utilitários
mocks/                JSONs simulados no formato oficial da API do TikTok (não editar à mão)
docs/                 termos e política
```

Os prompts de construção ficam fora do repositório: são colados um a um no chat.

## Como os dados chegam hoje

O backend ainda não existe. O front consome o **contrato abaixo**, servido pelo MSW em desenvolvimento. Os handlers do MSW leem os JSONs de `mocks/` (que estão no formato cru da API do TikTok) e convertem para o contrato. Quando o backend ficar pronto, basta apontar `VITE_API_URL` para ele e desligar o MSW: nenhuma tela muda.

O adaptador `web/src/mocks/adapters/` é o único lugar que conhece o formato cru do TikTok.

## Contrato com o backend

Base: `VITE_API_URL`. Autenticação por cookie httpOnly de sessão (preferido) ou Bearer em memória. Nunca guardar token em `localStorage`.

Convenções: dinheiro como **texto decimal** (`"11378.50"`) com `currency` ao lado; datas em **ISO 8601 UTC**; taxas como **inteiro em centésimos de %** (`1500` = 15%), igual ao TikTok.

```
POST /auth/register            { name, email, password, acceptedTermsVersion }
POST /auth/login               { email, password }
POST /auth/logout
POST /auth/forgot-password     { email }
GET  /auth/session             -> { user, accounts[] }

GET  /accounts                 -> [{ id, username, avatarUrl, shopConnected, connectedAt }]
POST /connections/tiktok/start -> { authorizeUrl }
DELETE /connections/:id

GET  /summary?accountId&from&to
  -> { gmv, commissionEstimated, commissionToReceive, commissionSettled,
       unitsSold, ordersCount, avgTicket, goal,
       byDay: [{ date, gmv, commission }],
       byStatus: [{ status, gmv }],
       byChannel: [{ channel, gmv }],
       topProducts: [{ productId, name, shopName, gmv, commission, units }] }

GET  /orders?accountId&from&to&status&channel&productId&page&pageSize
  -> { items: [{ id, createdAt, deliveredAt, status, skus: [...] }], total, page }
GET  /orders/:id

GET  /videos?accountId&from&to&sort&hashtag&page
  -> { items: [{ id, title, description, postedAt, duration, coverUrl, shareUrl,
                 views, likes, comments, shares, gmv?, commission?, gpm? }], total }
GET  /videos/:id               -> vídeo + snapshots: [{ at, views, likes }]

GET  /products?accountId&from&to&sort&page
GET  /products/:id             -> produto + vídeos que o promoveram

GET  /plans  ·  POST /plans  ·  PATCH /plans/:id  ·  DELETE /plans/:id
GET  /goals  ·  PUT  /goals

GET  /me/export                -> arquivo JSON com todos os dados
DELETE /me                     -> exclusão de conta
```

Campos opcionais (`gmv`, `commission`, `gpm` em vídeos) vêm nulos quando a conta do TikTok Shop não está conectada. A interface precisa tratar isso como "ainda não disponível", nunca como zero.

### Tipos do contrato

```ts
type Money = string; // decimal em texto: "1234.56". Nunca number.
type Rate = number; // centésimos de %: 1500 = 15%
type Iso = string; // ISO 8601 em UTC

type OrderStatus =
  | "AWAITING_PAYMENT"
  | "TO_SETTLE"
  | "SETTLED"
  | "REFUNDED"
  | "FROZEN";
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
  skus: OrderSku[];
};

// GET /orders/:id
type OrderDetail = Order & {
  statusHistory: { status: OrderStatus; at: Iso }[];
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
  month: string;
  gmv: Money | null;
  commission: Money | null;
}; // month: "AAAA-MM"
```

Em `/summary`, `goal` é `{ gmv: Money | null; commission: Money | null } | null` referente ao mês corrente.

Status do TikTok convertidos pelo backend: `AWAITING PAYMENT` → `AWAITING_PAYMENT`, `To-SETTLE` → `TO_SETTLE`, o resto igual. O front traduz para o rótulo em português; a API sempre manda a chave.

### Definições dos números

- `commissionEstimated` do resumo: soma da comissão estimada de **todos** os pedidos do período, inclusive reembolsados. É o valor bruto.
- `commissionToReceive`: só pedidos `TO_SETTLE`. Pedido `AWAITING_PAYMENT` ainda não foi pago, então não entra.
- `commissionSettled`: comissão real dos pedidos `SETTLED`.
- Comissão perdida (KPI): comissão estimada de `REFUNDED` mais `FROZEN`.
- Venda por anúncio da loja: `rates.shopAds > 0`. É dedução, não campo oficial — concentre em uma função só.
- Taxa padrão vem pronta em `rates.standard`; o front não recalcula por subtração.

### Totais de referência (mocks, 30 dias, conta demo)

Use nos testes do adaptador:

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

### Camada de dados no front

- Schemas Zod de todo o contrato em `web/src/api/schemas.ts`; hooks do TanStack Query em `web/src/api/queries.ts`. Chave de cache de BI sempre `[recurso, accountId, from, to, filtros]`.
- Conta de dinheiro só com `web/src/lib/money.ts` (centavos em `bigint`). Métricas derivadas do contrato em `web/src/lib/metrics.ts`; `isShopAdsSale` é o único lugar que decide venda por anúncio.
- Rótulos em português de status, canal e status de plano em `web/src/lib/labels.ts`.
- Filtros das telas moram na URL (`?de=AAAA-MM-DD&ate=...&status=...&pagina=N`), via `useFiltros` em `web/src/routes/app/filtros.ts`; o item aberto no painel também (`?venda=`, `?produto=`, `?video=`). Datas da URL são dias de São Paulo, convertidas para ISO UTC só na chamada.
- Peças compartilhadas das telas de dados em `web/src/components/dados.tsx`; métrica de venda nula usa `<Indisponivel />`.
- MSW só com `import.meta.env.DEV` e `VITE_ENABLE_MSW=true`; o build de produção não inclui MSW nem os JSONs. Nos testes, `web/src/mocks/server.ts` com `VITE_API_URL=http://localhost/api`.

## Estado da integração (importa para as telas)

| Fonte                                                             | Situação em 22/09/2026                                                                      |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| TikTok Shop — Affiliate Creator API (pedidos, comissões, vitrine) | **Não liberada para o Brasil.** Depende da aprovação da categoria "Creator collaborations". |
| Display API (vídeos da própria creator)                           | Disponível, depende da revisão do app em developers.tiktok.com.                             |
| Métricas de e-commerce por vídeo (analytics/202403)               | Só para creators dos EUA.                                                                   |
| APIs de live room                                                 | Não confirmado se aceitam token de creator do Brasil.                                       |

Por isso toda tela precisa de um estado "TikTok Shop não conectado", em que só os dados de vídeo aparecem.

## Regras vindas da API do TikTok (o backend entrega assim)

- **GMV** = preço × quantidade do item (no TikTok, o campo é `estimated_commission_base`). Não existe campo "gmv" na origem.
- **Comissão**: estimada enquanto não liquida; o valor real só existe quando o status é `SETTLED`.
- **Taxas em centésimos de %**: `1500` = 15%. A taxa total já soma padrão, anúncio da loja, bônus e reward.
- **Status**: `AWAITING PAYMENT`, `To-SETTLE`, `SETTLED`, `REFUNDED`, `FROZEN` → Aguardando pagamento, A liquidar, Liquidado, Reembolsado, Retido. **Não existe "inelegível"**.
- **Canais**: `VIDEO`, `LIVE`, `PRE_LIVE`, `SHOP` (vitrine), `LINKSHARE` (link), `PROMOTION_PAGE`.
- **Venda por anúncio da loja**: dedução a partir da comissão de Shop Ads maior que zero. Não existe sinal oficial de GMV Max.
- **Reembolso**: a origem dá só a quantidade, não o valor. O valor é calculado.
- A origem **não tem** id da loja, data de liquidação nem valor reembolsado.
- Views de vídeo são um total acumulado; a série no tempo vem dos snapshots que o backend guarda.
- Ainda **não está confirmado** que o identificador de conteúdo do pedido é o mesmo id do vídeo. Toda análise por vídeo depende disso: tratar como suposição isolada.

Valores monetários são texto: converter com decimal, nunca com float.

## Design system

- Marca: coral `#F8ADA0` e pêssego `#F7CBAB`. São claras: servem de fundo, preenchimento e destaque, **nunca com texto branco em cima** (contraste 1,8:1 e 1,5:1).
- Tokens: fundo `#FFF8F5`, superfície `#FFFFFF`, borda `#F1E4DF`, texto `#2B1D1B`, texto secundário `#6E5B57`, ação forte `#B6402B` (links, foco, item ativo), apoio `#9E5D2E`.
- Botão primário: fundo `#F8ADA0` com texto `#2B1D1B`. Secundário: contorno e texto `#B6402B`.
- Status: liquidado `#2F7D5B`, a liquidar `#9A6200`, aguardando pagamento `#5F5A58`, reembolsado `#B42318`, retido `#6B4FA0`. Sempre com o rótulo escrito junto.
- Contraste mínimo de 4,5:1 em texto e 3:1 em ícones e traços de gráfico.
- Uma família tipográfica (Inter ou Plus Jakarta Sans), cantos de 12px em cards e 8px em campos, sombra suave, ícones lucide-react.
- Só tema claro no MVP.

### Gráficos

Ordem categórica fixa, validada para daltonismo e contraste, usada nesta ordem e nunca reciclada:

`#C0442C` · `#2F5FC0` · `#1E8E64` · `#7A4CC0` · `#B07400` · `#B03A78`

- Série única (GMV por dia, acumulado): `#C0442C`; comparação com o período anterior em cinza médio.
- Rampa sequencial de coral: `#FBD9D2`, `#F8ADA0`, `#EC8071`, `#D65B49`, `#B6402B`.
- Coral e pêssego da marca só em área e preenchimento, nunca em traço fino.
- Nunca dois eixos y no mesmo gráfico.
- Legenda sempre que houver 2 ou mais séries; rótulo direto em no máximo 4; nunca número em cima de todo ponto.
- Tooltip no hover em todo gráfico; filtros em uma linha acima dos gráficos.
- Texto de valores, eixos e legenda nos tokens de texto, nunca na cor da série.
- Todo gráfico tem alternativa em tabela.

## Fora do MVP

Lives, produtos em alta do mercado, ranking de hooks, amostras, classificação de gancho por IA e benchmark entre creators. Não colocar na navegação agora.

## Devlog (obrigatório)

Toda mudança entra no `DEVLOG.md`, **no mesmo commit da mudança**. Tarefa sem entrada no devlog não está concluída. O hook `.githooks/pre-commit` cobra isso (instalar uma vez com `git config core.hooksPath .githooks`).

Como escrever:

- Uma entrada por tarefa concluída, sempre no topo do arquivo, da mais recente para a mais antiga.
- Não repita o diff. O git já guarda o que mudou; o devlog guarda **por que**, o que funcionou e o que não funcionou.
- Não registre formatação, lint, bump de dependência nem renomeação trivial.
- Atualize a seção "Estado atual", no topo do `DEVLOG.md`, sempre que o estado do projeto mudar.
- Ao começar uma sessão, leia **só** o "Estado atual" e as duas últimas entradas. Nunca leia o arquivo inteiro.
- Decisão permanente (padrão de código, contrato com o backend, token de design) não fica só no devlog: ela vai para o `CLAUDE.md`. O devlog registra que a decisão foi tomada e por quê.

Formato da entrada:

```markdown
### AAAA-MM-DD · título curto no imperativo

**Fiz:** o que foi entregue, em uma ou duas frases.
**Por quê:** o problema que isso resolve.
**Funcionou:** o que passou a funcionar, com evidência (teste, tela, comando).
**Não funcionou:** tentativas descartadas e o motivo. "Nada" também é resposta.
**Decidi:** escolhas que valem daqui para a frente.
**Pendente:** o que ficou faltando.
**Commit:** hash curto
```

## Regras para o agente

- Nenhuma tarefa está pronta sem a entrada no `DEVLOG.md` no mesmo commit.
- O front não chama a API do TikTok. Se uma tarefa pedir isso, pare e avise.
- Nada de token em `localStorage`, nada de segredo no código do cliente.
- Se um dado não existe no contrato, não invente: proponha o campo e pergunte.
- Perguntar antes de adicionar dependência nova.
- Commits pequenos, em português, no imperativo.
- Rodar `npm run lint` e `npm test` (dentro de `web/`) antes de considerar uma tarefa pronta.
