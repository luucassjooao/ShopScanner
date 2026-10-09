import { z } from 'zod';

const base64de32Bytes = z
  .string()
  .refine((v) => Buffer.from(v, 'base64').length === 32, 'precisa ser 32 bytes em base64');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3333),
  DATABASE_URL: z.string().startsWith('postgres'),
  JWT_SECRET: z.string().min(32),
  REFRESH_TOKEN_PEPPER: z.string().min(32),
  ENCRYPTION_KEY: base64de32Bytes,
  COOKIE_DOMAIN: z.string().min(1),
  WEB_ORIGIN: z.url(),

  // Login com Google. Faltando qualquer uma, o botão responde indisponível em
  // vez de derrubar o boot: o resto da API não depende dele.
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_REDIRECT_URI: z.url().optional(),

  // Conexão com o TikTok. Nasce pronta e desligada: sem as credenciais, as
  // rotas respondem indisponível em vez de quebrar.
  TIKTOK_CLIENT_KEY: z.string().min(1).optional(),
  TIKTOK_CLIENT_SECRET: z.string().min(1).optional(),
  TIKTOK_REDIRECT_URI: z.url().optional(),
  // A Affiliate Creator API não está liberada para o Brasil: enquanto for
  // falso, conectar a parte de pedidos responde indisponível.
  TIKTOK_SHOP_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

/**
 * Opcionais que, vazias, valem como ausentes: quem copia o `.env.example` e
 * ainda não criou o app no Google deixa a linha vazia. Lista explícita, de
 * propósito: um segredo obrigatório vazio (JWT_SECRET, ENCRYPTION_KEY,
 * DATABASE_URL) tem de continuar derrubando o boot, e nunca virar "ausente".
 */
const OPCIONAIS_VAZIAS_SAO_AUSENTES = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI',
  'TIKTOK_CLIENT_KEY',
  'TIKTOK_CLIENT_SECRET',
  'TIKTOK_REDIRECT_URI',
  'TIKTOK_SHOP_ENABLED',
] as const;

const ambiente: NodeJS.ProcessEnv = { ...process.env };
for (const nome of OPCIONAIS_VAZIAS_SAO_AUSENTES) {
  if (ambiente[nome]?.trim() === '') delete ambiente[nome];
}

const parsed = schema.safeParse(ambiente);

if (!parsed.success) {
  // Só o nome da variável e o motivo. Valor de segredo nunca vai para o log.
  const problemas = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
  console.error(`Variáveis de ambiente inválidas:\n${problemas.join('\n')}`);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
