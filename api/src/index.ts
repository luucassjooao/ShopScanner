import { env } from './config/env.ts';
import { buildApp } from './app.ts';

const app = await buildApp();

for (const sinal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(sinal, () => void app.close().then(() => process.exit(0)));
}

try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
} catch (erro) {
  app.log.error(erro);
  process.exit(1);
}
