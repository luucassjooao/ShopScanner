# Devlog

Histórico de decisões e aprendizados do projeto. O git guarda o que mudou; aqui fica o porquê, o que funcionou e o que não funcionou.

Regras curtas: entrada nova sempre no topo, uma por tarefa concluída, no mesmo commit da mudança. Sem diff copiado, sem ruído de formatação. Decisão permanente também vai para o `CLAUDE.md`.

---

## Estado atual

_Atualize esta seção quando o estado mudar. Ela é a primeira coisa que se lê ao voltar ao projeto._

- **Fase:** 0 — fundação do front-end.
- **Rodando:** front em `web/` com a camada de dados sobre o MSW e três telas (lint, typecheck, build e 41 testes passando).
- **Repositório:** git iniciado na raiz (branch `main`), hook do devlog ativo via `core.hooksPath`.
- **Dados:** JSONs simulados em `mocks/`, servidos pelo MSW. Backend próprio ainda não existe.
- **Integração TikTok:** Affiliate Creator API não liberada para o Brasil; ticket aberto com a TikTok. Display API disponível, app ainda não submetido.
- **Telas prontas:** /vendas, /produtos, /videos. Ainda sem navegação entre elas (só pela URL).
- **Próximo passo:** navegação do app e /inicio.
- **Bloqueios:** aprovação da categoria "Creator collaborations" para o Brasil; confirmação de que o identificador de conteúdo do pedido é o mesmo id do vídeo.

---

## Entradas

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
