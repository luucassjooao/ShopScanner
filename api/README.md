# ShopScanner — API

Backend do ShopScanner: Node 22, TypeScript, Fastify e PostgreSQL com SQL escrito à mão.
Contexto de produto e contrato no `CLAUDE.md` da raiz; decisões de backend em `api/CLAUDE.MD`.

## Subir com docker compose

```bash
cp .env.example .env   # opcional: o compose já traz valores de desenvolvimento
docker compose up
```

Sobe o Postgres 16 (volume `shopscanner-db`, healthcheck) e a API em modo de desenvolvimento,
que instala as dependências, aplica as migrações e fica em `--watch`.

- API: http://localhost:3333
- `GET /health` → `{"status":"ok","db":true}` quando o banco responde; 503 quando não.

Parar: `docker compose down`. Apagar o banco junto: `docker compose down -v`.

## Rodar sem docker

Precisa de Node >= 22.18 (roda TypeScript direto, sem transpilar) e de um Postgres acessível.

```bash
npm install
cp .env.example .env    # preencha os segredos
npm run db:migrate
npm run dev
```

## Scripts

| Comando              | O que faz                                                       |
| -------------------- | --------------------------------------------------------------- |
| `npm run dev`        | servidor em watch, lendo `.env`                                 |
| `npm run build`      | compila para `dist/`                                            |
| `npm start`          | roda o build                                                    |
| `npm run lint`       | ESLint                                                          |
| `npm test`           | Vitest                                                          |
| `npm run db:migrate` | aplica o que falta de `db/migrations/`, em ordem e em transação |
| `npm run db:seed`    | roda `db/seed.sql`                                              |

## Testes

Precisam de um Postgres de pé. A suíte cria o banco `shopscanner_test` sozinha, aplica as
migrações e trunca as tabelas entre os testes — o banco de desenvolvimento não é tocado.

```bash
docker compose up -d db
npm test
```

## Migrações

Arquivos `.sql` numerados em `db/migrations/`. O runner aplica em ordem, cada arquivo numa
transação, e registra o nome em `schema_migrations`. **Migração aplicada não se edita:**
a correção é sempre um arquivo novo.

## Variáveis de ambiente

Todas em `.env.example`, validadas por Zod em `src/config/env.ts`. Falta uma? O processo
morre no boot dizendo qual, sem imprimir valor de segredo.

## Camadas

`controller` valida com Zod e devolve HTTP · `service` decide · `repository` escreve o SQL.
Controller não toca no banco, service não conhece `request` nem `reply`, SQL é sempre
parametrizado e toda linha do banco passa por `one()`/`many()`, que validam com Zod.
