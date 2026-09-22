# ShopScanner — front-end (`web/`)

Plataforma de BI para creators afiliados do TikTok Shop no Brasil. **Este repositório é só o
front-end**: o backend é próprio e fica fora daqui, e o front nunca fala com a API do TikTok.

O contexto completo do produto, o contrato com o backend e as regras de design estão no
[`CLAUDE.md`](../CLAUDE.md).

## Requisitos

- Node 20 ou mais novo (`node -v`)
- npm 10 ou mais novo

## Como rodar

Todos os comandos abaixo rodam dentro de `web/`.

```bash
cd web
npm install
cp .env.example .env
npm run dev
```

O app sobe em <http://localhost:5173>. Com o `.env` de exemplo, o **MSW já vem ligado** e
responde no lugar do backend.

## Scripts

| Comando             | O que faz                                           |
| ------------------- | --------------------------------------------------- |
| `npm run dev`       | Servidor de desenvolvimento com HMR                 |
| `npm run build`     | Checa os tipos e gera o bundle em `dist/`           |
| `npm run preview`   | Serve o `dist/` para conferir o build               |
| `npm run typecheck` | Só o TypeScript                                     |
| `npm run lint`      | ESLint (use `lint:fix` para corrigir o que dá)      |
| `npm run format`    | Prettier (use `format:check` na CI)                 |
| `npm test`          | Vitest uma vez (`test:watch` para o modo contínuo)  |
| `npm run msw:init`  | Regera `public/mockServiceWorker.js` ao subir o MSW |

Antes de considerar uma tarefa pronta: `npm run lint` e `npm test`.

## Ligar e desligar o MSW

O MSW simula a API enquanto o backend não existe. Quem manda é o `.env`:

```dotenv
# .env — com mocks (padrão de desenvolvimento)
VITE_API_URL=/api
VITE_ENABLE_MSW=true
```

```dotenv
# .env — falando com o backend de verdade
VITE_API_URL=https://api.exemplo.com.br
VITE_ENABLE_MSW=false
```

Depois de mexer no `.env`, **reinicie o `npm run dev`** — o Vite só lê as variáveis na subida.

Detalhes que importam:

- `VITE_ENABLE_MSW` diferente de `true` (ou ausente) desliga os mocks. Não existe meio-termo.
- O MSW entra por `import()` dinâmico em `src/main.tsx`: desligado, ele não é baixado pelo
  navegador. Em build de produção, deixe `VITE_ENABLE_MSW=false`.
- Requisição sem handler passa direto para a rede (`onUnhandledRequest: 'bypass'`), então dá
  para migrar rota por rota para o backend real.
- Os handlers ficam em `src/mocks/handlers.ts` e respondem no **formato do contrato**.
  Os JSONs crus da API do TikTok ficam em `../mocks/` (raiz do repositório) e passam por `src/mocks/adapters/` —
  esse é o único lugar do front que conhece o formato cru.

Se o worker não iniciar (`Failed to register a ServiceWorker`), rode `npm run msw:init`.

## Estrutura

```
src/
  routes/public/      landing, /entrar, /criar-conta, /recuperar, /termos, /privacidade
  routes/app/         /inicio, /vendas, /videos, /produtos, /planejamento, /configuracoes
  components/ui/      shadcn/ui
  components/charts/  wrappers do Recharts
  api/                cliente HTTP, tipos e schemas Zod do contrato com o backend
  mocks/              handlers do MSW + adaptadores dos JSONs de /mocks
  lib/                formatadores, métricas derivadas, utilitários
../mocks/             JSONs simulados no formato cru da API do TikTok (não editar à mão)
../docs/              prompts, termos, política
```

As duas cascas de rota (`PublicLayout` e `AppLayout`) já existem e estão vazias de propósito.
`AppLayout` é protegido: consulta `GET /auth/session` e manda para `/entrar` quando o backend
responde 401.

## Convenções que o código cobra

**Dinheiro é texto decimal.** O backend manda `"11378.50"`, não `11378.5`. Os formatadores de
`src/lib/format.ts` recebem texto e entregam texto — `Intl.NumberFormat` formata a string sem
passar por ponto flutuante. Converter para `number` em qualquer ponto é bug, e o ESLint
bloqueia `parseFloat` por causa disso.

```ts
formatMoeda('11378.50'); // "R$ 11.378,50"
formatTaxa(1500); // "15%"   — taxa vem em centésimos de %, como no TikTok
formatData('2026-09-22T23:30:00Z'); // "22/09/2026" em America/Sao_Paulo
```

**Toda resposta passa pelo Zod.** `src/api/client.ts` valida o corpo contra o schema do
contrato; 2xx fora do formato vira `ApiError` com `code: 'resposta_invalida'`, não `any` solto
pelo app. Todo erro de rede, HTTP ou validação chega na interface como `ApiError` com um `code`
estável (`nao_autenticado`, `servidor`, `rede`…).

**Sessão por cookie httpOnly.** Nada de token em `localStorage`, nada de segredo no cliente.

**TikTok Shop pode não estar conectado.** `gmv`, `commission` e `gpm` de vídeo chegam `null`
nesse caso. A interface mostra "ainda não disponível" — nunca zero.

## Design system

Os tokens ficam em `src/index.css` (variáveis CSS) e ganham nome em `tailwind.config.ts`,
com os mesmos nomes do `CLAUDE.md`. Só tema claro no MVP.

| Classe Tailwind              | Token                                 |
| ---------------------------- | ------------------------------------- |
| `bg-fundo`                   | `#FFF8F5`                             |
| `bg-superficie`              | `#FFFFFF`                             |
| `border-borda`               | `#F1E4DF`                             |
| `text-texto`                 | `#2B1D1B`                             |
| `text-texto-secundario`      | `#6E5B57`                             |
| `text-acao` / `ring-acao`    | `#B6402B` — links, foco, item ativo   |
| `text-apoio`                 | `#9E5D2E`                             |
| `bg-coral` / `bg-pessego`    | `#F8ADA0` / `#F7CBAB` — só como fundo |
| `text-status-liquidado` …    | os cinco status, sempre com rótulo    |
| `text-grafico-1` … `-6`      | ordem categórica fixa dos gráficos    |
| `rounded-card` / `-campo`    | 12px / 8px                            |
| `shadow-suave`               | sombra padrão de card                 |
| `text-titulo-lg` … `legenda` | escala tipográfica                    |

Coral e pêssego **nunca** recebem texto branco em cima (contraste 1,8:1 e 1,5:1). O botão
primário é coral com texto `#2B1D1B`; o secundário é contorno e texto em `#B6402B`.

Os fundos suaves dos status (`bg-status-liquidado-suave`) são derivados da própria cor com
`color-mix` a 8%, o que mantém 4,5:1 de contraste com o texto do status.
