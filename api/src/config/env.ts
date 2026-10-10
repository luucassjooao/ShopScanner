import { isIP } from 'node:net';
import { z } from 'zod';

const base64de32Bytes = z
  .string()
  .refine((v) => Buffer.from(v, 'base64').length === 32, 'precisa ser 32 bytes em base64');

/**
 * Segredos que estão escritos no repositório: os padrões do `docker-compose.yml`,
 * que existem para o ambiente de desenvolvimento subir sem configuração. Passam na
 * validação de tamanho, então sem esta lista um deploy feito com o compose subiria
 * com eles — e quem lê o repositório forjaria o JWT e abriria os tokens do TikTok.
 */
const SEGREDOS_PUBLICOS = new Set([
  'desenvolvimento-troque-isto-com-32-chars',
  'desenvolvimento-troque-isto-32-chars',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
]);

/** Nomes que o `@fastify/proxy-addr` entende como faixas prontas. */
const FAIXAS_COM_NOME = new Set(['loopback', 'linklocal', 'uniquelocal']);

function ipOuFaixa(valor: string): boolean {
  if (FAIXAS_COM_NOME.has(valor)) return true;
  const [ip, mascara, ...sobra] = valor.split('/');
  if (sobra.length > 0 || !ip) return false;
  const versao = isIP(ip);
  if (versao === 0) return false;
  if (mascara === undefined) return true;
  return /^\d+$/.test(mascara) && Number(mascara) <= (versao === 4 ? 32 : 128);
}

/**
 * Em quem confiar no `X-Forwarded-For`. É o que decide `request.ip`, e o IP é a
 * chave do rate limit e o que a sessão grava. `true` confia em qualquer valor do
 * header: o IP passa a ser o que o cliente escrever, e o rate limit cai trocando o
 * header a cada tentativa. Por isso `true` não é aceito.
 *
 * - `false` (ou ausente fora de produção): ignora o header. App exposta direto.
 * - lista de IPs, faixas CIDR ou `loopback`/`linklocal`/`uniquelocal`, separados por
 *   vírgula: os proxies conhecidos. O header só vale quando quem conecta é um deles.
 *
 * Número de saltos (`1`) não é aceito: o Fastify 5.12 trata número como "não confiar
 * em nada" — conta de saltos não confere quem conectou, e quem acessa a origem
 * direto forjaria o IP mandando saltos suficientes. Aceitar aqui viraria `false` em
 * silêncio no deploy.
 *
 * Ausente vira `undefined`, e não `false`, para a produção poder exigir a escolha.
 */
const confiancaNoProxy = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (v === undefined) return undefined;
    if (v === 'false') return false as const;
    const lista = v.split(',').map((s) => s.trim());
    if (v !== 'true' && lista.every(ipOuFaixa)) return lista;
    ctx.addIssue({
      code: 'custom',
      message:
        v === 'true'
          ? '"true" aceita qualquer X-Forwarded-For e o IP vira o que o cliente quiser. Liste os IPs ou faixas dos proxies'
          : 'use false, ou IPs, faixas CIDR e loopback/linklocal/uniquelocal separados por vírgula',
    });
    return z.NEVER;
  });

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3333),
    // Fora de contêiner, só a própria máquina alcança a API. O docker-compose põe
    // 0.0.0.0, que é o que faz a porta publicada funcionar dentro do contêiner.
    HOST: z.string().min(1).default('127.0.0.1'),
    TRUST_PROXY: confiancaNoProxy,
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
  })
  .superRefine((e, ctx) => {
    if (e.NODE_ENV !== 'production') return;
    for (const nome of ['JWT_SECRET', 'REFRESH_TOKEN_PEPPER', 'ENCRYPTION_KEY'] as const) {
      if (SEGREDOS_PUBLICOS.has(e[nome])) {
        ctx.addIssue({
          code: 'custom',
          path: [nome],
          message:
            'é o valor de desenvolvimento, público no repositório. Gere com: openssl rand -base64 32',
        });
      }
    }
    if (e.TRUST_PROXY === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['TRUST_PROXY'],
        message:
          'obrigatória em produção: false se a API recebe direto, ou os IPs/faixas dos proxies na frente',
      });
    }
  });

/**
 * Opcionais que, vazias, valem como ausentes: quem copia o `.env.example` e
 * ainda não criou o app no Google deixa a linha vazia. Lista explícita, de
 * propósito: um segredo obrigatório vazio (JWT_SECRET, ENCRYPTION_KEY,
 * DATABASE_URL) tem de continuar derrubando o boot, e nunca virar "ausente".
 */
const OPCIONAIS_VAZIAS_SAO_AUSENTES = [
  'TRUST_PROXY',
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
