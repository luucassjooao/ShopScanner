import { defineConfig } from 'vitest/config';
import { AMBIENTE_DE_TESTE } from './src/test/env.ts';

export default defineConfig({
  test: {
    globalSetup: './src/test/setup.ts',
    // Um banco só, compartilhado: as suítes truncam entre os testes.
    fileParallelism: false,
    env: AMBIENTE_DE_TESTE,
  },
});
