# Owra: como os pedidos entram no produto

Varredura só de leitura em 24/09/2026, no app `minha.owra.com.br` (logado), no site público `owra.com.br` e no TikTok Shop Partner Center. Nada foi autorizado, sincronizado, importado nem editado. Nenhum número da conta foi reproduzido.

Onde a evidência vem dos arquivos JavaScript públicos que o próprio app carrega no navegador, está marcado **(script)**. São textos de interface embutidos no front, lidos sem executar nenhuma ação.

## Conclusão

**Os dois, com a API como caminho principal e o arquivo como complemento.** Pedidos entram por uma autorização própria do TikTok Shop ("Importar pedidos", sincronização automática e busca com backfill e reconferência por API). O import de `affiliate_orders.xlsx` existe para histórico e casos extras, e os pedidos importados por arquivo são depois reconferidos pela API.

---

## 1. Autorizações da conta TikTok

**FATO**
- Caminho: Configurações → Contas TikTok (`/configuracoes/integracoes-tiktok`).
- Texto da tela: "Cada conta precisa de duas autorizações da mesma conta do TikTok: vídeos e pedidos."
- As duas autorizações se chamam **"Importar vídeos"** e **"Importar pedidos"**. Cada uma tem os botões Sincronizar agora, Reconectar e Desconectar.
- Os botões **não têm `href`** no HTML: são `<button>`, e o destino é montado no clique.
- Nos scripts aparecem duas rotas internas de início de autorização **(script)**:
  - `/api/auth/tiktok/login`
  - `/api/auth/tiktok-shop/login`
- Frescor: "Sincronização automática ativa. Sincronizado há … (valor omitido)" em vídeos; "Pedidos entram sozinhos a cada 20 minutos." em pedidos.
- Aviso na tela: "O TikTok conecta a conta que está logada no navegador. Para autorizar outra conta, saia do TikTok antes, ou escaneie o QR com o celular certo."
- Nenhum "expira em" aparece para a autorização do TikTok. Os textos de expiração encontrados nos scripts são de convites de equipe e de ajustes de plano.

**INFERÊNCIA**
- `/api/auth/tiktok/login` é o login da conta TikTok (Login Kit/Display API), usado para vídeos.
- `/api/auth/tiktok-shop/login` é o OAuth do TikTok Shop Partner, usado para pedidos. Os dois nomes separados, somados a "duas autorizações da mesma conta", batem com dois apps diferentes no TikTok.
- O `app_key` só apareceria no redirecionamento feito por essas rotas (ver "Não verificável sem ação").

## 2. Entrada de pedidos

**FATO**
- Texto na integração: "Pedidos entram sozinhos a cada 20 minutos."
- FAQ público ("Preciso subir algum arquivo? Quanto tempo até ver meus números?"): "Não precisa. Você autoriza a Owra a ler seus vídeos e pedidos no TikTok e ela faz o resto sozinha. O histórico chega aos poucos, então pode levar algumas horas para aparecer tudo. Depois disso, cada venda nova chega em até 10 minutos."
- O destaque do site público diz o contrário: "Conecte a sua conta e suba o relatório de vendas."
- **Onde a interface separa API de arquivo:** no histórico de imports da integração. Os tipos que aparecem são "Sincronização automática", "Import por arquivo" e "Reconferência de status (api)". Há ainda uma seção "Sem conta identificada: imports por arquivo feitos antes de as contas serem identificadas."
- **Reconferência (script),** texto de uma tela de configuração:
  - "Pedido de afiliada nasce Pendente ou AwaitingPayment e só vira Liquidado ou Inelegível semanas depois. A busca automática olha uma janela de minutos, então nunca volta a ver o pedido antigo. A reconferência relê em duas faixas: a quente, completa e frequente, e a fria, mais rara e só nas horas que ainda têm pedido pendente. Pedido já Liquidado ou Inelegível nunca é buscado de novo."
  - "A cota da API é compartilhada com o backfill…", "…em resposta de rate limit a reconferência ainda recua sozinha…"
  - "O checkpoint anda por fatia inteira, nunca por página: a ordem de paginação da API não é documentada…"
  - Título do grupo: "Busca automática, backfill, reconferência de status e janela do sync manual num lugar só".

**INFERÊNCIA**
- Os pedidos vêm de uma API paginada, com cota, *rate limit* e janela de tempo: é o comportamento da busca de pedidos de afiliado (`orders/search`) do TikTok Shop. Isso indica que o Owra tem acesso à Affiliate Creator API para contas brasileiras, justamente o que o nosso `CLAUDE.md` registra como "não liberada para o Brasil".
- A reconferência fica numa tela de configuração que parece ser de administração interna, embutida no mesmo pacote do app.
- As três versões sobre o tempo (10 min, 20 min, "suba o relatório") sugerem que o produto migrou do arquivo para a API e o site ainda não foi todo atualizado.

## 3. Import por arquivo

**FATO (script, textos do diálogo de import)**
- Arquivo pedido: "Envie o arquivo `affiliate_orders.xlsx` exportado do Centro de Afiliados do TikTok (dentro do app)."
- Vários arquivos de uma vez: "Você pode selecionar vários arquivos de uma vez, e eles são importados um depois do outro."
- Reenvio sem duplicar: "Pode reenviar o mesmo arquivo quantas vezes quiser: pedidos já importados são atualizados, não duplicados."
- Botões: "Selecionar arquivos .xlsx", "Importar arquivo (.xlsx)".
- Extensão: "Só conseguimos ler arquivos .xlsx. Se o seu está em .csv, abra no Excel ou no Google Sheets e salve como .xlsx."
- Tamanho: "O arquivo tem mais de 50 MB. Exporte um período menor, por exemplo um mês de cada vez." Há também um limite configurável por arquivo, com orientação de falar com o suporte.
- Estrutura: "Não encontramos o cabeçalho na primeira aba do arquivo. Confira se o arquivo não está vazio, se os dados estão na primeira aba e se não há linha em branco antes do cabeçalho."
- Colunas: "Não reconhecemos as colunas deste arquivo. Colunas encontradas: {colunas}. Faltam as colunas de {ausentes}. Se o arquivo veio de uma conta em outro idioma, entre em contato com o suporte para que possamos mapear as colunas."
- Moeda: "Este arquivo está em {moeda} e por enquanto só conseguimos importar pedidos em reais."
- Troca de arquivo: "Este parece ser o arquivo do painel de LIVE, não o de vendas. Importe este arquivo na tela Lives…"
- Processamento: "Enviando o arquivo ao armazenamento ({pct}%)…" e "O arquivo foi enviado, mas o processamento falhou." O parser roda no servidor, depois do upload.
- Progresso: "Importando o arquivo {indice} de {total} ({nome}). Isso pode levar alguns minutos." e "Deixe esta tela aberta até o fim".

**FATO (histórico de imports, na interface)**
- Cada linha tem tipo, data e hora, resultado ("N vendas novas, N atualizadas · N sem mudança", valores omitidos) e o status "Concluído".
- Tipos vistos: Sincronização automática, Import por arquivo, Reconferência de status (api).

**INFERÊNCIA**
- A lista de colunas esperadas fica no servidor. O front só recebe "encontradas" e "faltam" na resposta de erro.
- A validação é por **nome** de coluna e depende do idioma da conta ("mapear as colunas").

## 4. Limites por plano

**FATO**
- Os planos prometem histórico em **vídeos**: "25/150/400/900 vídeos do histórico analisados na entrada", conforme o plano (site público).
- Nenhuma tela ou texto encontrado limita o histórico de **pedidos** por plano, nem diz se um limite vem da API ou do arquivo.
- O FAQ público diz: "O histórico chega aos poucos, então pode levar algumas horas".

**INFERÊNCIA**
- O histórico de pedidos vem do backfill por API, limitado pela cota da API e não pelo plano. O arquivo serve para ir além do que a API devolve ou para períodos anteriores à conexão.

## 5. Lives

**FATO (tela Lives e scripts)**
- Na tela: "Horários e duração são estimados pelos pedidos de cada live."
- Banner: "Importe o arquivo do painel de LIVE para ver views, GPM e duração real."
- Arquivo pedido **(script)**: o export **Creator Live Performance** do **LIVE Center**, com as instruções "No app do TikTok, abra o LIVE Center da sua conta.", "Entre no painel de desempenho das lives (Creator Live Performance) e escolha o período." e "Toque em exportar dados para baixar o arquivo."
- O que ele preenche **(script)**: "O arquivo do painel de LIVE do TikTok completa o resto: views, GPM, duração real e o título de cada live."
- Conta de origem **(script)**: "O arquivo do TikTok não diz de qual conta ele veio, então as lives entram na conta escolhida aqui."
- Lives só do arquivo **(script)**: "As lives novas vieram só do arquivo, ainda sem pedidos. Elas aparecem na lista com o GMV informado pelo TikTok."

## 6. Status "Inelegível"

**FATO**
- Aparece no Painel (KPI "% itens inelegíveis", com a nota "inclui aguardando pagamento") e na tabela de Vendas (selo "Inelegível" com "não pago").
- Explicação **(script)**: "O que é item inelegível" → "Itens cujo status é Inelegível ou AwaitingPayment não contam como venda nem geram comissão. Só entram os itens com status Pendente ou Liquidado."
- Outro texto **(script)**: "% do GMV que não liquida (cancelado, devolvido, inelegível)", ou seja, eles tratam inelegível como algo diferente de cancelado e devolvido.
- A interface **não diz de qual fonte** o status vem.

**INFERÊNCIA**
- O vocabulário mistura inglês de API ("AwaitingPayment") com rótulos em português (Pendente, Liquidado, Inelegível). É provável que "Inelegível" venha do status do `affiliate_orders.xlsx` em português ou de um mapeamento próprio de status da API. Isso diverge do nosso `CLAUDE.md` ("Não existe inelegível"). Para fechar a questão, basta exportar um `affiliate_orders.xlsx` de uma conta real e ver a coluna de status.

## 7. Público: Partner Center

**FATO**
- `partner.tiktokshop.com` lista mercados de serviços por país (Reino Unido, Indonésia, Malásia, Vietnã, Tailândia, Filipinas, Singapura, EUA, Cross-border). **O Brasil não aparece.**
- `seller-br.tiktok.com/services/market` redireciona para o login de vendedor. A listagem não é pública.
- Não foi possível confirmar um app do Owra listado publicamente.

---

## Especificação do arquivo (o que dá para afirmar hoje)

| Item | Valor | Fonte |
| --- | --- | --- |
| Nome do arquivo | `affiliate_orders.xlsx` | script |
| Onde baixar | Centro de Afiliados do TikTok, dentro do app (o caminho exato de menu não aparece) | script |
| Extensão | só `.xlsx` (CSV recusado, com orientação para converter) | script |
| Tamanho máximo | 50 MB por arquivo (mais um limite configurável) | script |
| Aba | a primeira | script |
| Cabeçalho | na primeira linha, sem linha em branco antes | script |
| Colunas | validadas por nome; o erro lista encontradas e faltantes; mapeamento por idioma da conta | script |
| Moeda | só BRL | script |
| Período | livre; orientação de exportar um mês por vez quando o arquivo é grande | script |
| Vários arquivos | sim, processados em sequência | script |
| Reenvio | idempotente: atualiza, não duplica (chave provável: id do pedido + SKU) | script + inferência |
| Pós-import | pedidos reconferidos pela API até virarem Liquidado ou Inelegível | interface + script |
| Status vistos | Pendente, AwaitingPayment, Liquidado, Inelegível (e cancelado/devolvido tratados à parte) | script |
| Arquivo de LIVE | Creator Live Performance (LIVE Center → exportar dados); não traz a conta de origem | script |

**Para fechar a especificação do nosso parser:** exportar um `affiliate_orders.xlsx` real (em português e em inglês, se possível) e registrar os nomes das colunas. É a única fonte das colunas, que o Owra valida no servidor.

## Não verificável sem ação

- **`app_key` e host/caminho da tela de autorização do TikTok:** só aparecem ao abrir `/api/auth/tiktok/login` ou `/api/auth/tiktok-shop/login`, o que inicia o fluxo e pode reconectar sozinho se já houver consentimento.
- **Lista de permissões (scopes) pedidas:** só na tela de consentimento do TikTok.
- **Nomes exatos das colunas esperadas:** validados no servidor; apareceriam só num erro depois de um upload.
- **Onde fica o botão de import de pedidos:** "Sincronizar vendas" (tela Vendas) é um botão comum, sem `aria-haspopup`. Não dá para saber, sem clicar, se ele abre o diálogo de import ou dispara a sincronização.
- **Histórico de imports completo:** "Ver tudo" não expandiu a lista na leitura.
- **Diálogo de import de LIVE:** o botão "Importar" é proibido pelas regras; os textos vieram dos scripts.
- **App do Owra no mercado de serviços do Brasil:** exige login de vendedor.
