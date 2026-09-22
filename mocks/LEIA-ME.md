# Dados simulados: APIs de creator do TikTok Shop

Respostas simuladas das rotas que a plataforma vai usar. Foram geradas a partir da especificação OpenAPI oficial do TikTok Shop, que vem dentro do pacote `@tts-open-toolkit/cli` 0.1.7 (publicado em 16/09/2026). Todos os campos e tipos foram conferidos contra essa especificação, com 0 erros. Cada arquivo tem o formato exato da resposta da rota, então para trocar pela API real basta mudar a fonte dos dados.

## Arquivos

| Arquivo | Rota | Situação |
|---|---|---|
| `search_creator_affiliate_orders_202410.json` | `POST /affiliate_creator/202410/orders/search` | Base de quase todo o BI. Depende de aprovação para o Brasil |
| `creator_select_affiliate_product_202501.json` | `POST /affiliate_creator/202501/selection/products/search` | Produtos mais vendidos do marketplace de afiliados (ordenação BEST_SELLERS) |
| `creator_search_open_collaboration_product_202405.json` | `POST /affiliate_creator/202405/open_collaborations/products/search` | Produtos com colaboração aberta. `units_sold` só vem se a creator liberou o compartilhamento de dados |
| `get_creator_profile_202508.json` | `GET /affiliate_creator/202508/profiles` | Perfil básico, sem seguidores nem GMV |
| `get_showcase_products_202405.json` | `GET /affiliate_creator/202405/showcases/products` | Vitrine, sem vendas |
| `search_creator_sample_applications_202412.json` | `POST /affiliate_creator/202412/sample_applications/search` | Pedidos de amostra grátis |
| `get_live_room_info_202309_legacy.json` | `GET /affiliate/202309/live_rooms` | Última live. Rota legada: confira se entra no desligamento de 12/10/2026 |
| `live_room_core_stats_202309/<id>.json` | `GET /analytics/202309/live_rooms/{live_room_id}/core_stats` | Um arquivo por live. Token aceito e disponibilidade no Brasil não confirmados |
| `display_api_video_list_v2.json` | `POST /v2/video/list/` (developers.tiktok.com) | Display API, fora do TikTok Shop. Campos do Video Object oficial |

## O conjunto

Creator fictícia `@creator.demo.br`, com 80 pedidos entre 22/08 e 21/09/2026, 14 vídeos, 3 lives, 10 produtos promovidos, 10 produtos de marketplace e 6 pedidos de amostra. Aparecem todos os status (`AWAITING PAYMENT`, `To-SETTLE`, `SETTLED`, `REFUNDED`, `FROZEN`) e todos os canais (`VIDEO`, `LIVE`, `PRE_LIVE`, `SHOP`, `LINKSHARE`, `PROMOTION_PAGE`). Lojas, produtos e marcas são inventados. Imagens e links usam example.com.

Totais: GMV estimado de R$ 11.378,50 e comissão estimada de R$ 1.424,55, com 15 itens vendidos com comissão de Shop Ads.

## Como os valores foram calculados

- Base da comissão = preço × quantidade.
- Comissão = base × taxa ÷ 10.000. As taxas vêm em centésimos de %: 1500 = 15%.
- `commission_rate` = taxa padrão + Shop Ads + bônus + reward.
- Os campos `actual_*` só têm valor em pedidos `SETTLED`. Nos outros status só existe a comissão estimada, como diz a especificação.
- Em `REFUNDED`, `refunded_quantity` = `quantity` e não há comissão.
- Datas em Unix (segundos, UTC). Valores em dinheiro vêm como texto.
- Na Display API, o total de views é acumulado. Para ter views por período você precisa salvar a contagem com frequência.

## Suposições a confirmar com um retorno real

1. O `content_id` dos pedidos de `VIDEO` é o mesmo `id` da Display API. É isso que permite calcular vendas e GPM por vídeo.
2. O `content_id` vem vazio para `SHOP`, `LINKSHARE` e `PROMOTION_PAGE`.
3. `delivery_time` = 0 quando o pedido ainda não foi entregue.
4. `commission_model` = `"FIXED"`. A especificação não lista os valores possíveis.
5. `seller_type` vem vazio quando a creator não é vendedora.
6. Em `creator_select_affiliate_product`, `commission.amount` segue a regra literal da especificação (preço mínimo × taxa × 1000), e `total_count` = 0 quando não há palavra-chave, também como ela descreve.
7. A página da documentação mostra campos que a especificação empacotada não tem: `last_update_time`, `is_carousel`, `trace_info`, os campos de comissão "standard" e os de impostos. Eles ficaram de fora e podem aparecer na resposta real.
