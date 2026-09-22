# Adaptadores

Único lugar do front que conhece o **formato cru da API do TikTok** (`tiktok.ts`).

Lê os JSONs de `/mocks` (na raiz do repositório, fora de `web/`) e devolve o contrato do `CLAUDE.md`,
fazendo o que o backend fará lá:

- `AWAITING PAYMENT` → `AWAITING_PAYMENT`, `To-SETTLE` → `TO_SETTLE`; status ou canal desconhecido lança erro.
- `gmv` = preço × quantidade, em centavos inteiros (não existe campo "gmv" na origem).
- `actual_*` só em `SETTLED`; fora dele `commissionSettled` e `commissionBaseActual` são `null`, não zero.
- Taxas passam como inteiro em centésimos de %. `rates.standard` sai por subtração **aqui**, porque a
  origem não o traz separado; o front nunca refaz essa conta.
- Unix → ISO 8601 UTC; `delivery_time = 0` e `content_id = ""` → `null`.
- `skusDoVideo` isola a suposição não confirmada `content_id` = id do vídeo da Display API.
