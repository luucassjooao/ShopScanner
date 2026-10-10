# ShopScanner — front-end

Leia primeiro o `CLAUDE.md` da raiz: produto, contrato, regras de domínio e definição dos números estão lá, e não são repetidos aqui. Este arquivo é só o front.

**Escopo:** esta pasta é um SPA. Sem framework de servidor, sem ORM, sem rota de API aqui dentro. O front **nunca** chama a API do TikTok — quem faz isso é a API em `api/`.

## Stack

- **Vite + React + TypeScript**
- **Tailwind CSS + shadcn/ui** (Radix)
- **React Router** para as rotas
- **TanStack Query** para estado de servidor, **Zod** para validar respostas
- **Recharts** para gráficos
- **react-hook-form** nos formulários
- **MSW** para simular a API enquanto o backend não está pronto
- **Vitest + Testing Library**, **ESLint + Prettier**

## Estrutura

```
web/
  package.json, vite.config.ts, tailwind.config.ts, tsconfig.json
  public/               manifest do PWA (Web Share Target do import)
  src/
    routes/public/      landing, /entrar, /criar-conta, /recuperar, /termos, /privacidade
    routes/app/         /inicio, /vendas, /videos, /produtos, /planejamento, /configuracoes
    routes/app/filtros.ts  useFiltros: filtros que moram na URL
    components/ui/      shadcn
    components/charts/  wrappers do Recharts
    components/dados.tsx   peças compartilhadas das telas de dados
    api/                cliente HTTP, tipos e schemas Zod do contrato
    mocks/              handlers do MSW + adaptador dos JSONs em /mocks
    lib/                money, metrics, labels, formatadores
```

Alias `@mocks` aponta para `../mocks` e `server.fs.allow` libera a raiz, para o Vite enxergar os JSONs.

## Como os dados chegam hoje

A API ainda não está no ar. O front consome o contrato da raiz, servido pelo **MSW** em desenvolvimento. Os handlers leem os JSONs de `mocks/` (formato cru da API do TikTok) e convertem para o contrato. Quando a API ficar pronta, aponta-se `VITE_API_URL` para ela e desliga-se o MSW: **nenhuma tela muda**.

`web/src/mocks/adapters/` é o único lugar do front que conhece o formato cru do TikTok. Fora dele, o front só conhece o contrato.

MSW roda só com `import.meta.env.DEV` e `VITE_ENABLE_MSW=true`; o build de produção não inclui MSW nem os JSONs. Nos testes, `web/src/mocks/server.ts` com `VITE_API_URL=http://localhost/api`.

## Camada de dados

- Schemas Zod de todo o contrato em `src/api/schemas.ts`; hooks do TanStack Query em `src/api/queries.ts`. Chave de cache de BI sempre `[recurso, accountId, from, to, filtros]`.
- Varrer uma lista inteira (exportar CSV, `useAllVideos`) pede `pageSize: MAX_PAGE_SIZE` (100, o teto do contrato) e calcula as páginas a partir de `total`. Nunca deduzir o tamanho da página pelo que veio na primeira resposta.
- `/orders` aceita `cursor` com `nextCursor` na resposta. O front continua em `page`, que segue valendo: a paginação mora na URL e as varreduras buscam as páginas em paralelo. Trocar para cursor só vale se aparecer inconsistência entre páginas.
- O `goal` de `/summary` é sempre o do **mês corrente em São Paulo**, independente do período filtrado. Barra de meta e aviso de meta medem o GMV **elegível** do mês, nunca o bruto.
- Conta de dinheiro só com `src/lib/money.ts` (centavos em `bigint`). Nunca `float`, nunca `Number()` em `Money`.
- Métricas derivadas em `src/lib/metrics.ts`, seguindo "Definições dos números" da raiz. `isShopAdsSale` é o único lugar que decide venda por anúncio.
- Rótulos em português de status, canal e status de plano em `src/lib/labels.ts`. A API manda a chave; a tradução é aqui.
- Filtros das telas moram na URL (`?de=AAAA-MM-DD&ate=...&status=...&pagina=N`), via `useFiltros`. O item aberto no painel também (`?venda=`, `?produto=`, `?video=`). Datas da URL são **dias de São Paulo**, convertidas para ISO UTC só na chamada.
- Métrica de venda nula usa `<Indisponivel />`, nunca zero.

## Como o front fala com a API

- Cliente HTTP em `src/api/client.ts`, lendo `VITE_API_URL`, com `credentials: "include"` e `X-Requested-With: shopscanner` em toda rota que muda estado.
- `avatarUrl` tem duas procedências (raiz → "Avatar"): `urlDeImagem` em `src/api/client.ts` prefixa `VITE_API_URL` só no que começa com `/`, e o transform mora nos schemas — nenhum `<img>` resolve URL por conta própria. **Hoje o projeto não tem CSP** (nem `<meta>` no `index.html` nem header no Vite); quando a hospedagem puser uma, ela precisa de `img-src` para a origem da API, senão o avatar some sem erro visível.
- Toda resposta passa por Zod. Campo que não bate é erro — corrija o schema e avise quais telas foram afetadas, nunca silencie.
- **Nada em `localStorage`**: sem token, sem sessão, sem dado de usuário. A sessão vive em cookie `httpOnly` que o front não lê.
- `Continuar com Google` é navegação do navegador para `${VITE_API_URL}/auth/google/start`. Não é `fetch`, não é `window.open`, não é iframe.
- Código de erro vindo da URL (`/entrar?erro=`, `/configuracoes?erro=`) ou de um corpo de erro (`serverCode`) passa por `mensagemDoErro`, em `src/lib/textos.ts`: um mapa só, com fallback genérico. **Nunca mostrar o código cru**, nem a `message` técnica da API.
- Conexão com o TikTok: `POST /connections/tiktok/start` com `{ kind: 'VIDEOS' | 'SHOP' }`. Hoje `SHOP` responde 503 com `code: 'TIKTOK_SHOP_INDISPONIVEL'` — a tela mostra o motivo traduzido e não navega. Quando a liberação sair, nada muda no front.
- Conta criada pelo Google chega sem aceite: `<AceiteTermos />` (em `routes/app/`) trava a área logada até gravar por `PATCH /me { acceptedTermsVersion }`.
- 401: chamar `POST /auth/refresh` **uma vez** e repetir a requisição. Falhando de novo, ir para `/entrar`. Access token dura 15 minutos, então 401 em aba velha é esperado.
- 429: aviso amigável com o tempo de espera, sem repetir automaticamente.
- Import de arquivo é assíncrono: `POST /imports` devolve `importId`; o acompanhamento é por `GET /imports/:id`.
- O envio do arquivo usa `upload()` de `src/api/client.ts`, com `XMLHttpRequest`: é o único jeito de ter barra de progresso, porque `fetch` não informa quanto do corpo subiu. Todo o resto continua no `request()`.

## Entrada de dados por arquivo

Enquanto a Affiliate Creator API não libera no Brasil, o `affiliate_orders.xlsx` é a espinha de dados (raiz → "Fontes do dado"). O front **não lê o .xlsx**: manda para a API e acompanha a fila.

- `src/components/import.tsx` é a tela de import inteira: arrastar ou escolher, vários arquivos em sequência, barra de progresso, acompanhamento e histórico. Fica dentro de Configurações → Contas conectadas; Vendas e o estado "conta sem venda" apontam para lá com `/configuracoes?secao=import`.
- A orientação de cada código de erro mora só em `src/lib/import.ts`. Erro novo no contrato entra lá, com saída escrita. **Nunca mensagem genérica**, e a `message` técnica da API não vai para a tela.
- Procedência: `<Procedencia />` de `src/components/dados.tsx` é o único selo de `source` e `sourceAt`. Toda tela que mostra venda usa esse, não um texto próprio.
- Frescor: `lastSyncedAt` vira "Atualizado há X" no topo do app e, passados 5 dias, o lembrete do Início.
- O que a especificação já descarta (extensão fora de `.xlsx`, acima de `LIMITE_MB`) é recusado **antes** do envio, com o mesmo texto do erro vindo da API. É conveniência: quem decide continua sendo a API.
- `INELIGIBLE` só chega por arquivo. Entra em `STATUSES` de `lib/metrics.ts` como qualquer outro status, e fica **fora** do GMV elegível.
- PWA: `public/manifest.webmanifest` registra o app como destino de compartilhamento e `public/sw.js` atende o POST, guarda o arquivo no Cache Storage e manda a pessoa para o painel. O service worker só é registrado em produção — em desenvolvimento o escopo `/` é do worker do MSW.

## Telas

Públicas: landing (`/`), `/entrar`, `/criar-conta`, `/recuperar`, `/termos`, `/privacidade`. Termos e privacidade abrem **sem login e sem JavaScript pesado** — essas duas URLs vão para a revisão do TikTok.

Logadas: `/inicio`, `/vendas`, `/videos`, `/produtos`, `/planejamento`, `/configuracoes`, `/avisos`, `/reconciliacao`, mais `/inicio-rapido` (onboarding). `/reconciliacao` não entra na navegação: chega-se a ela pelo painel de import.

Navegação: sidebar no desktop, barra inferior no celular. Topo com seletor de conta, seletor de período (7 dias, 30 dias, este mês, personalizado), sino de avisos e avatar. Detalhe de item abre em painel lateral no desktop e folha deslizante no celular.

Estados que **toda** tela de dados precisa ter: carregando (skeleton), vazio, erro, e "conta sem venda" — conta com `hasSales` falso, em que a única saída oferecida é enviar o relatório em arquivo. Vazio de período (conta com venda, filtro sem resultado) é outra tela: "nenhuma venda neste período", com ampliar ou limpar filtros.

Nenhuma tela ramifica em `shopConnected`. Venda se mostra por `hasSales` (conta) e pelo `total` do período que a tela já consulta. `shopConnected` descreve só a conexão viva: cartão de Configurações, aviso de "em liberação" e o checklist do Início rápido. Falha de consulta é erro, nunca "envie o relatório".

Guarda de rota: sem sessão vai para `/entrar`; com sessão, abrir `/entrar` manda para `/inicio`.

## Design system

- Marca: coral `#F8ADA0` e pêssego `#F7CBAB`. São claras: servem de fundo, preenchimento e destaque, **nunca com texto branco em cima** (contraste 1,8:1 e 1,5:1).
- Tokens: fundo `#FFF8F5`, superfície `#FFFFFF`, borda `#F1E4DF`, texto `#2B1D1B`, texto secundário `#6E5B57`, ação forte `#B6402B` (links, foco, item ativo), apoio `#9E5D2E`.
- Botão primário: fundo `#F8ADA0` com texto `#2B1D1B`. Secundário: contorno e texto `#B6402B`.
- Botão do Google: neutro — fundo `#FFFFFF`, borda `#F1E4DF`, texto `#2B1D1B`, logotipo do Google em cores originais. Nunca dentro de um botão coral.
- Status: liquidado `#2F7D5B`, a liquidar `#9A6200`, aguardando pagamento `#5F5A58`, reembolsado `#B42318`, retido `#6B4FA0`. Sempre com o rótulo escrito junto, nunca só a cor.
- Contraste mínimo de 4,5:1 em texto e 3:1 em ícones e traços de gráfico.
- Uma família tipográfica (Inter ou Plus Jakarta Sans), cantos de 12px em cards e 8px em campos, sombra suave, ícones lucide-react.
- Só tema claro no MVP. Sem gradiente chamativo, sem ilustração 3D, sem emoji.
- Não copiar a identidade visual do TikTok, e nenhum logotipo do TikTok em botão de login.

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
- **Gráfico diz de que número é feito.** `byDay`, `byStatus` e `byChannel` vêm brutos do contrato, enquanto o topo do Início é o GMV elegível. Os dois convivem na mesma tela, então o título do gráfico leva "bruto" e a nota embaixo explica o que entra. Número sem procedência em tela é bug de leitura.

## Regras para o agente (front)

- O front não chama a API do TikTok. Se uma tarefa pedir isso, pare e avise.
- Nada de token em `localStorage`, nada de segredo no código do cliente.
- Dado que não existe no contrato da raiz: proponha o campo e pergunte, não invente nem derive por conta própria.
- Conta de negócio nova não nasce no front. Se faltar um corte, ele vai para "Definições dos números" na raiz e para a API.
- Cada tela de dados nasce com os quatro estados (carregando, vazio, erro, conta sem venda). Tela sem estado não está pronta.
- Perguntar antes de adicionar dependência nova.
- Rodar `npm run lint` e `npm test` dentro de `web/` antes de considerar a tarefa pronta.
- Entrada no `DEVLOG.md` da raiz, com `[front]` no título, no mesmo commit.
