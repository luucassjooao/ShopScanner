import { z } from 'zod';

/**
 * Variáveis do Vite. Nada de segredo aqui: tudo que entra em `import.meta.env`
 * vai para o bundle do cliente (CLAUDE.md → "Regras para o agente").
 */
const schema = z.object({
  /** Base da API do backend. Em dev com MSW, um caminho relativo basta. */
  VITE_API_URL: z.string().min(1).default('/api'),
  /** Liga o MSW no navegador. Fora de `true`, o app fala com VITE_API_URL de verdade. */
  VITE_ENABLE_MSW: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

const parsed = schema.safeParse(import.meta.env);

if (!parsed.success) {
  const detalhes = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
  throw new Error(`Variáveis de ambiente inválidas — ${detalhes}. Veja .env.example.`);
}

export const env = {
  apiUrl: parsed.data.VITE_API_URL.replace(/\/$/, ''),
  mswEnabled: import.meta.env.DEV && parsed.data.VITE_ENABLE_MSW,
  isDev: import.meta.env.DEV,
} as const;
