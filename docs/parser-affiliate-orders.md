# Parser do `affiliate_orders.xlsx`

Especificação do import do relatório de pedidos de afiliado que a creator exporta do Centro de Afiliados do TikTok. É a fonte de dados do MVP enquanto a Affiliate Creator API não for liberada para o Brasil.

Status: **incompleta**. Falta uma única coisa — os nomes das colunas. Tudo que depende disso está na seção 3, isolado de propósito: quando a planilha real chegar, só essa seção muda.

Última atualização: 25/09/2026.

## 1. O que já está definido

| Item            | Regra                                                                                          |
| --------------- | ---------------------------------------------------------------------------------------------- |
| Arquivo         | `affiliate_orders.xlsx`, exportado do Centro de Afiliados dentro do app do TikTok              |
| Extensão        | só `.xlsx`. CSV é recusado, com mensagem orientando salvar como `.xlsx`                        |
| Tamanho         | até 50 MB por arquivo; acima disso, orientar a exportar um mês por vez                         |
| Aba             | a primeira                                                                                     |
| Cabeçalho       | primeira linha com dados, sem linha em branco antes                                            |
| Moeda           | só `BRL` no MVP; outra moeda é recusada com mensagem clara                                     |
| Vários arquivos | permitido, processados em sequência, um resultado por arquivo                                  |
| Reenvio         | idempotente: atualiza o que mudou, não duplica                                                 |
| Chave           | id do pedido + id do SKU                                                                       |
| Processamento   | no servidor, depois do upload; o front acompanha por `GET /imports/:id`                        |
| Procedência     | tudo que entra por aqui nasce com `source: "FILE"` e `sourceAt` = data e hora do processamento |
| Precedência     | quando a API trouxer o mesmo pedido, a API prevalece e a diferença vai para `/reconciliation`  |

## 2. Erros que a interface precisa saber tratar

| Código            | Quando acontece                                        | O que a tela diz                                |
| ----------------- | ------------------------------------------------------ | ----------------------------------------------- |
| `WRONG_EXTENSION` | arquivo não é `.xlsx`                                  | como converter no Excel ou no Google Sheets     |
| `TOO_LARGE`       | acima do limite                                        | exportar um período menor                       |
| `NO_HEADER`       | primeira aba vazia ou cabeçalho fora da primeira linha | conferir a aba e a linha do cabeçalho           |
| `UNKNOWN_COLUMNS` | colunas não reconhecidas                               | listar as encontradas e as que faltam           |
| `WRONG_CURRENCY`  | moeda diferente de BRL                                 | aviso de que só BRL entra por enquanto          |
| `WRONG_FILE`      | é o arquivo do painel de LIVE, não o de vendas         | apontar a tela certa                            |
| `FAILED`          | upload ok, processamento falhou                        | pedir nova tentativa e registrar para o suporte |

## 3. A confirmar: colunas do arquivo

**Pendente:** exportar um `affiliate_orders.xlsx` real e copiar aqui a linha de cabeçalho. Enquanto isso não acontece, o parser não é escrito — mas o front inteiro pode ser, porque as telas dependem só dos códigos de erro e do resultado do import, não das colunas.

Se possível, exportar em português e em inglês: o Owra valida colunas por nome e menciona mapeamento por idioma, então o nosso parser deve nascer com os dois dicionários.

### Mapeamento coluna → contrato

Preencher a coluna da esquerda quando a planilha chegar. Os destinos já estão definidos pelo contrato do `CLAUDE.md`.

| Coluna da planilha | Campo do contrato                     | Observação                                                       |
| ------------------ | ------------------------------------- | ---------------------------------------------------------------- |
| _a preencher_      | `Order.id`                            | chave, junto com o SKU                                           |
| _a preencher_      | `OrderSku.id`                         | se não existir, gerar de produto + linha                         |
| _a preencher_      | `Order.createdAt`                     | data de criação do pedido, converter para ISO UTC                |
| _a preencher_      | `Order.deliveredAt`                   | pode não existir no arquivo                                      |
| _a preencher_      | `Order.status`                        | ver tabela de status abaixo                                      |
| _a preencher_      | `OrderSku.productId`                  |                                                                  |
| _a preencher_      | `OrderSku.name`                       | nome do produto                                                  |
| _a preencher_      | `OrderSku.shopName`                   | a origem não traz id de loja                                     |
| _a preencher_      | `OrderSku.unitPrice`                  | texto decimal, cuidado com vírgula decimal                       |
| _a preencher_      | `OrderSku.quantity`                   |                                                                  |
| _a preencher_      | `OrderSku.refundedQuantity`           |                                                                  |
| _a preencher_      | `OrderSku.returnedQuantity`           | pode não existir no arquivo                                      |
| _a preencher_      | `OrderSku.commissionRate`             | converter para centésimos de %: 15% vira 1500                    |
| _a preencher_      | `OrderSku.commissionEstimated`        |                                                                  |
| _a preencher_      | `OrderSku.commissionSettled`          | só quando liquidado                                              |
| _a preencher_      | `OrderSku.channel`                    | ver tabela de canais abaixo                                      |
| _a preencher_      | `OrderSku.contentId`                  | id do vídeo ou da live, se o arquivo trouxer                     |
| _a preencher_      | `OrderSku.shopAdsCommissionEstimated` | se não existir, assumir zero e **não** deduzir venda por anúncio |

Campos do contrato que o arquivo provavelmente **não** traz, e que ficam nulos com `source: "FILE"`: `rates` separado por tipo, `commissionBaseActual` e `statusHistory` anterior ao primeiro import.

### Status

| Rótulo na planilha   | `OrderStatus`      | Observação                                                                                                      |
| -------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------- |
| Pendente             | `TO_SETTLE`        |                                                                                                                 |
| Aguardando pagamento | `AWAITING_PAYMENT` |                                                                                                                 |
| Liquidado            | `SETTLED`          |                                                                                                                 |
| Inelegível           | `INELIGIBLE`       | a API separa a mesma situação em `REFUNDED` e `FROZEN`; manter o rótulo do arquivo até a reconferência pela API |
| _a confirmar_        | `REFUNDED`         | conferir se a planilha distingue cancelado e devolvido                                                          |

### Canais

| Rótulo na planilha | `Channel`                    |
| ------------------ | ---------------------------- |
| Vídeo              | `VIDEO`                      |
| LIVE               | `LIVE`                       |
| Vitrine            | `SHOP`                       |
| Link               | `LINKSHARE`                  |
| _a confirmar_      | `PRE_LIVE`, `PROMOTION_PAGE` |

## 4. Depois que a planilha chegar

1. Preencher as três tabelas da seção 3.
2. Escrever o parser no backend, com teste em cima de um arquivo real reduzido (sem dados pessoais de comprador).
3. Gerar um `mocks/import_affiliate_orders_result.json` com um resultado de import para o MSW.
4. Registrar no `DEVLOG.md` e marcar esta especificação como completa.
