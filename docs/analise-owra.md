# Análise do Owra (minha.owra.com.br)

Varredura feita em 24/09/2026, navegando logada no app e no site público (owra.com.br). Só leitura: nenhuma configuração foi alterada, nenhuma análise de IA foi disparada.
Os números da conta usada não foram reproduzidos aqui; quando aparecem valores, são preços públicos ou limites de plano.

---

## 1. Resumo em uma frase

O Owra é um BI + estúdio de criação para creators de TikTok Shop no Brasil: liga cada venda ao vídeo que a gerou, usa IA para explicar **por que** o vídeo vendeu e transforma isso em ganchos, roteiros e agenda do próximo vídeo. A proposta é "o que aconteceu → a evidência → por que importa → o próximo passo", nunca número solto.

Onde o ShopScanner hoje é um **painel de comissões**, o Owra é um **ciclo completo**: analisar → planejar → criar.

---

## 2. Stack técnica observada

| Camada | O que vimos | Evidência |
| --- | --- | --- |
| Front | Next.js (App Router, prefetch de rotas) | `/_next/static/chunks`, prefetch de todas as rotas do menu |
| Hospedagem | Vercel | parâmetro `?dpl=dpl_…` nos assets |
| Autenticação / banco | Supabase | cookie `sb-<projeto>-auth-token` |
| Erros | Sentry | chamadas a `*.ingest.us.sentry.io` |
| Suporte | Chatwoot auto-hospedado no Fly.io | cookies `cw_*`, widget em `owra-suporte.fly.dev` |
| App instalável | PWA com service worker e manifest | faixa "Instale o aplicativo na tela de início"; `manifest.webmanifest` |
| Push | Notificações com o app fechado | Configurações → Notificações |
| Tipografia / tema | Manrope, tema escuro roxo (fundo ~`#131121`, destaque lilás) | CSS computado |
| Cobrança | Assinatura mensal com cartão, faturas, upgrade pró-rata, créditos avulsos | Configurações → Assinatura / Seus créditos |
| IA | Transcrição dos vídeos + classificação (gancho, formato, narrativa, CTA) + geração de roteiro | filtros de vídeo, Biblioteca, Gerar roteiro |
| Vídeo | Montagem de vídeos a partir de clipes (gancho × narrativa × CTA) | Estúdio |

---

## 3. Como os dados chegam (o ponto mais importante para nós)

- **Duas autorizações por conta do TikTok:** "Importar vídeos" e "Importar pedidos". A conta só fica pronta com as duas.
- **Vídeos:** sincronização automática (mostra "sincronizado há X minutos" e botão "Sincronizar agora").
- **Pedidos:** "entram sozinhos a cada 20 minutos". Existe também **import por arquivo** (o relatório de vendas exportado do TikTok), com histórico de cada import: vendas novas, atualizadas e sem mudança.
- **Reconferência de status via API:** imports por arquivo antigos são reconferidos automaticamente ("Reconferência de status (api)").
- **Autorização pelo navegador:** o TikTok conecta a conta que está logada no navegador; para outra conta, sair antes ou **escanear um QR com o celular certo**.
- **Status "Inelegível"** aparece em Vendas e no Painel ("% itens inelegíveis"). O nosso `CLAUDE.md` diz que esse status **não existe** na API; provavelmente vem do relatório por arquivo. Vale investigar antes de afirmar qualquer coisa ao usuário.
- **Lives:** sem API de métricas, o Owra **estima horário e duração pelos pedidos** e oferece "Importar dados de LIVE" (arquivo do painel de LIVE) para views, GPM e duração reais.

Leitura: o Owra resolveu o bloqueio de dados com um **modelo híbrido** (OAuth quando dá, arquivo quando não dá, e reconferência depois). É exatamente o nosso bloqueio atual ("Affiliate Creator API não liberada para o Brasil").

---

## 4. Navegação e padrões de interface

- Menu lateral em três grupos: **Acompanhar** (Feed, Painel, Vídeos, Vendas, Lives), **Organizar** (Produtos, Biblioteca, Mercado), **Criar** (Planejar, Gerar roteiro, Modelar, Referências, Estúdio). Selo "novo" em itens recentes.
- Filtro global no topo: **Vídeos · Lives · Tudo** (recorta todos os números pela origem da venda).
- Sino com contador (99+), avatar com menu: uso de IA do mês ("0 de 40, renova em …"), saldo de créditos com "Comprar", Assinatura, Perfil do creator, Configurações, Sugestões, Suporte, "Como a Owra funciona".
- Botão flutuante de chat de suporte em todas as telas.
- Detalhe em painel lateral (ex.: detalhe do vídeo).
- Toda tela explica o próprio número em uma linha ("média por dia corrido do mês", "liquidados + pendentes").
- Cada gráfico tem **Exportar**.

---

## 5. Tela por tela

### Feed
Linha do tempo de eventos agrupados por janela de horário ("5 vendas confirmadas, R$ X de GMV e R$ Y de comissão entre 12:55 e 13:11"), com o produto, a loja e **o vídeo que gerou cada venda**. Filtros: Tudo, Vendas, Produtos, Amostras, Criar, Conta, Novidades. Coluna lateral com período, **"Precisa de você"** (ex.: GMV Max ativo em produtos seus) e resumo dos últimos 7 dias.

### Painel
- Alternância **Mês a mês / Acumulado** e seletor de mês.
- GMV do mês com variação contra o mês anterior e barra liquidado × pendente.
- **Meta do mês sugerida** pela própria ferramenta, com "faltam R$ X", "R$ Y/dia em N dias" e **projeção** ("≈ R$ 210 mil, R$ 2 mil abaixo da meta").
- KPIs com variação: comissão (efetiva % e projeção), comissão média por item, itens vendidos, GMV por dia, ticket médio, **% de itens inelegíveis**.
- GMV acumulado com **projeção**, mês anterior e linha de meta.
- Ritmo diário (GMV e comissão por dia, com média tracejada).
- **Ritmo diário por produto** (tendência 7d, "acima da média", projeção do mês por produto).
- Composição do GMV por status (valor, %, itens).
- **Concentração 80/20 (Pareto)** por comissão ou quantidade.
- Tabela de todos os produtos com % acumulado.
- **Apostas:** produtos fora do top 80% que estão acelerando ("Novo", "Acelerando 2,1×"), com janela de 7, 14 ou 30 dias e projeção.

### Vídeos
- KPIs: visualizações, **GPM**, "vídeos que venderam X de Y".
- Grade com capa, views, comentários e o selo "produto · sem venda ainda".
- **Filtros por IA:** transcrição, formato, gancho, narrativa, CTA, **como vendeu** (orgânico × anúncio da loja/GMV Max), produto.
- Detalhe: métricas, **"Por que funcionou"** (análise de IA que consome 1 uso), transcrição, "Como cresceu" (curva de views), produtos do vídeo, legenda.

### Vendas
Tabela de todas as vendas: data, produto, loja, GMV, unidades, comissão (% e R$), status, **canal** e **origem**. KPIs: GMV, comissão liquidada e pendente. Busca, filtros, período e "Sincronizar vendas".

### Lives
GMV em lives, número de lives, média por live, lista com duração estimada e "sua melhor live do período", aba **Produtos em live**, import do arquivo do painel de LIVE.

### Produtos
- Abas: Todos, **Vitrine**, **Amostras**, **Para gravar**.
- Cartões de alerta: "produto do seu 80/20 está acabando (até 7 dias de estoque)", "produtos que vendem não estão na vitrine", "itens da vitrine indisponíveis".
- Tabela: sinais do produto (ícones), categoria, GMV, vendidos e reembolsados, comissão acumulada e %, alerta ("GMV Max ativo", "Em promoção · R$ X").
- **Mesclar** produtos duplicados, **Adicionar produto** manual.

### Biblioteca (ganchos e CTAs)
Ganchos extraídos das **transcrições**, cada um com a prova de venda: tipo ("afirmação categórica", "história de compra com expectativa", "chamada ao público-alvo"), "top 5% dos seus vídeos em vendas", "converte 3,6× a sua média", venda por view e pedidos. A creator aceita ou descarta cada sugestão.

### Mercado
Inteligência de mercado: ranking de **lojas que escalam com anúncio da loja (GMV Max)**, categoria forte, produtos promovidos, escala, "acelerando/esfriando", comissão mediana. Destaques ("+665% nesta semana", "subiu 76 posições"). Abas Lojas, Produtos e Descobrir. O acesso ao ranking é **limitado pelo plano** (60, 300 ou todas as lojas).

### Planejar
Semana, dia ou quadro. Coluna "A planejar" com **roteiros disponíveis** e **produtos para gravar**, contadores (planejado, gravado, editado, dias livres), "parado há 7 dias", organizar por produto, Postagens e Descartados.

### Gerar roteiro, Modelar, Referências
- **Gerar roteiro por IA** a partir de um produto da base, de um link novo ou escrito à mão.
- **Modelar:** colar o link de um vídeo que funcionou (seu ou de outra pessoa) e a IA transforma em roteiro para o seu produto, com cenas, duração e tipo ("review/opinião direta · 4 cenas · ~45s").
- **Referências:** coleção de vídeos que inspiram, analisados e comparados com o que já funciona para você.

### Estúdio
"Grave uma vez, publique dezenas": sobe clipes de gancho, narrativa e CTA, e o Estúdio **combina e devolve vídeos prontos**. Uso limitado por plano.

### Configurações
Assinatura, créditos, **Contas TikTok** (integrações), **histórico de imports**, **categorias personalizadas** para a taxonomia da IA, perfil do creator, **Equipe** (membros e perfis de acesso), **Notificações push**.

---

## 6. Modelo de negócio (público)

| Plano | Preço | Usos de IA/mês | Vídeos analisados/mês | Histórico na entrada | Contas TikTok | Mercado | Equipe |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Essential | R$ 127 | 40 | ≥ 200 | 150 | 1 | 60 lojas e 60 produtos | — |
| Creator | R$ 197 | 70 | 450 | 400 | 2 | 300 lojas e produtos | 1 pessoa |
| Top Creator | R$ 297 | 120 | 900 | 900 | 3 | completo | 3 pessoas |

Extras por plano: produtos "enriquecidos" com avaliações e dores dos compradores (90 e 180 por mês), notificações avançadas (vendas, GMV Max, **mudança de comissão**), usos grátis do Estúdio, **controle de amostras** (pedido, chegada, prazo do conteúdo). **Créditos avulsos** liberam vídeos antigos fora do limite. Upgrade na hora com cobrança pró-rata, downgrade na próxima cobrança; reembolso e cancelamento pelo próprio app.

O site público usa prova social agregada ("517 mil vídeos monitorados", "R$ 207 mi em vendas acompanhadas") e o argumento "o trabalho difícil não é gravar, é saber o que gravar".

---

## 7. Diferenciais deles

1. **Venda ligada ao vídeo, em tempo quase real** (Feed a cada ~20 min).
2. **IA que explica e recomenda**, sempre com evidência e próximo passo.
3. **Projeções:** meta sugerida, ritmo diário, projeção do mês e por produto.
4. **Pareto 80/20 e Apostas** (produtos acelerando fora do topo).
5. **Alertas acionáveis:** estoque acabando no 80/20, vende mas não está na vitrine, item indisponível, GMV Max ativo, promoção, queda de comissão.
6. **Biblioteca de ganchos com prova de venda**, criada a partir das transcrições.
7. **Modelar vídeo de terceiros** para o próprio produto.
8. **Mercado:** ranking de lojas com GMV Max (dado agregado entre os clientes deles).
9. **Estúdio** de combinação de clipes.
10. **Ingestão híbrida** (OAuth, arquivo e reconferência) e **Lives estimadas pelos pedidos**.
11. **Operação:** PWA com push, equipe com perfis, suporte por chat, cobrança autosserviço.

---

## 8. Onde estamos em relação a isso

| Tema | ShopScanner hoje | Owra |
| --- | --- | --- |
| KPIs de comissão, status, canal | ✅ | ✅ |
| GMV acumulado vs. período anterior | ✅ | ✅ + projeção e meta |
| Meta do mês | ✅ manual | ✅ sugerida + ritmo necessário |
| Vendas por item com detalhe da taxa | ✅ (mais detalhado que eles) | tabela simples |
| Vídeos com GMV/GPM | ✅ | ✅ + classificação por IA |
| Produtos | ✅ tabela e detalhe | ✅ + vitrine, estoque, promoção, mesclar |
| Planejamento e roteiro | ✅ quadro + calendário + roteiro manual | ✅ + roteiro por IA, modelagem, biblioteca |
| Avisos | ✅ derivados no front | ✅ + push com o app fechado |
| Estado "sem TikTok Shop" | ✅ (eles não mostram) | — |
| Lives, Mercado, amostras, ganchos por IA, benchmark | ❌ (fora do MVP pelo `CLAUDE.md`) | ✅ |
| Dados reais | ❌ bloqueado pela API | ✅ híbrido |

O nosso ponto a favor hoje: detalhe da comissão (base, composição da taxa, reembolsos) e o cuidado de nunca mostrar zero onde o dado não existe. Tema claro e acessível, contra o tema escuro deles.

---

## 9. Ideias para o ShopScanner

### A. Cabem no front agora, com o contrato atual
1. **Projeção do mês** no Início: ritmo diário × dias restantes, com "faltam R$ X, R$ Y/dia". Usa `/summary` e a meta.
2. **Meta sugerida:** média dos últimos meses + crescimento; a creator aceita ou edita.
3. **Pareto 80/20** em Produtos (dá para calcular a partir de `/products`).
4. **Apostas:** produtos fora do 80% que aceleraram entre duas janelas (duas chamadas de `/products`).
5. **Explicação curta embaixo de cada número**, como eles fazem ("liquidados + pendentes").
6. **Exportar em todo gráfico**, não só nas tabelas.
7. **Mesclar produtos duplicados** e filtro global por origem (Vídeo, Live, Tudo) no topo.
8. **Selo "produto sem venda ainda"** no card de vídeo.
9. **PWA instalável** (manifest + service worker) com a faixa "Instalar aplicativo".

### B. Pedem backend (propor no contrato)
1. **Ingestão híbrida:** upload do relatório de vendas (CSV/XLSX), histórico de imports e reconferência depois. É o caminho para funcionar **antes** da liberação da API no Brasil.
2. **Feed de eventos** ("5 vendas confirmadas entre 12:55 e 13:11") com vídeo de origem.
3. **Push notifications** (Web Push) para vendas, retido e reembolsado, e mudança de comissão.
4. **Vitrine e estoque** (`/showcases/products` já existe no mock): alertas de indisponível, "vende mas não está na vitrine" e estoque acabando.
5. **Alerta de mudança de comissão** (comparar a taxa entre sincronizações).
6. **Lives estimadas pelos pedidos** (agrupar pedidos de canal LIVE por janela de tempo) e import do arquivo do painel de LIVE.
7. **Equipe:** membros com perfil de acesso (agência ou assistente).
8. **Controle de amostras** (o mock `search_creator_sample_applications` já existe).

### C. Pedem IA (fase posterior)
1. **Transcrição** dos vídeos (speech-to-text) e **classificação** de gancho, formato, narrativa e CTA.
2. **"Por que funcionou"** por vídeo, com evidência e próximo passo.
3. **Biblioteca de ganchos** com prova de venda, aceitar ou descartar.
4. **Roteiro por IA** a partir do produto (preenche o modal que já temos: gancho, cena 1, cena 2, CTA, legenda).
5. **Modelar** um vídeo de referência para o próprio produto.

### D. Para ficar de fora por enquanto
Mercado (depende de dado agregado entre muitos clientes), Estúdio (processamento de vídeo) e benchmark entre creators. Já estão fora do MVP no `CLAUDE.md`.

---

## 10. O que vamos precisar tecnicamente

**Backend e dados**
- Serviço de sincronização com **agendador** (a cada 15–20 min) e fila de jobs, com histórico de cada sincronização (novas, atualizadas, sem mudança).
- **Parser de relatório** CSV/XLSX do TikTok Shop, com deduplicação por id de pedido e SKU e reconferência posterior.
- **Snapshots** periódicos de vídeo (views e curtidas) para a curva de crescimento e o aviso de queda de views.
- Banco relacional (Postgres) com multi-conta e **workspace/equipe** (papéis e permissões).
- Armazenamento de arquivos (imports, avatares e, no futuro, clipes).

**Produto e operação**
- **Cobrança recorrente** em reais (cartão e Pix), com pró-rata, faturas, reembolso e **cotas por plano** (contas, vídeos analisados, usos de IA) mais créditos avulsos.
- **Web Push** + service worker (PWA).
- **Observabilidade:** Sentry ou equivalente no front e no back.
- **Suporte:** widget de chat (Chatwoot é open source e pode ser auto-hospedado).
- **Analytics de produto** respeitando a LGPD (eles só usam cookies essenciais e avisam no banner).

**IA (quando chegar a hora)**
- Transcrição (Whisper ou API equivalente), LLM para classificação e roteiros, controle de custo por **cota mensal por usuário**, cache das análises e botão "forçar nova análise".

**Front (o que muda no nosso código)**
- Contrato novo para imports (`POST /imports`, `GET /imports`), feed (`GET /feed`), vitrine (`GET /showcase`), push (`POST /me/push-subscriptions`), equipe (`/team`), cotas e uso (`GET /me/usage`) e plano (`/billing`).
- Tela de upload com progresso e resultado do import; badge "atualizado há X min" no topo.

---

## 11. Pontos de atenção

- **"Inelegível":** o Owra mostra esse status; o nosso `CLAUDE.md` diz que ele não existe na API. Antes de adicionar, confirmar a fonte (provavelmente o relatório por arquivo) e decidir se entra no contrato.
- **Fora do MVP:** Lives, Mercado, amostras e ganchos por IA estão fora do MVP no `CLAUDE.md`. Qualquer ideia das seções B, C e D que toque nisso precisa de decisão explícita.
- **Identidade própria:** usar o Owra como referência de fluxo e funcionalidade, não de marca, textos ou visual. O nosso design system (tema claro coral e pêssego) já é bem diferente.
- **Promessas de dado:** o Owra afirma coisas que dependem de dados que talvez a nossa fonte não tenha (estoque, promoção, GMV Max). Seguir a regra do `CLAUDE.md`: se o dado não existe no contrato, não mostrar.
