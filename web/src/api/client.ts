import type { ZodType } from 'zod';
import { env } from '@/env';
import { AVISO_LIMITE } from '@/lib/textos';

/** Categorias de erro que a interface precisa distinguir. */
export type ApiErrorCode =
  | 'rede' // não chegou no servidor
  | 'timeout' // passou do tempo limite
  | 'cancelado' // abortado por quem chamou
  | 'nao_autenticado' // 401 — sessão expirada
  | 'sem_permissao' // 403
  | 'nao_encontrado' // 404
  | 'limitado' // 429 — tentativas demais; não repete sozinho
  | 'invalido' // 4xx de validação
  | 'servidor' // 5xx
  | 'resposta_invalida' // veio 2xx, mas fora do contrato (Zod reprovou)
  | 'desconhecido';

const MENSAGEM: Record<ApiErrorCode, string> = {
  rede: 'Não foi possível falar com o servidor. Verifique a conexão e tente de novo.',
  timeout: 'O servidor demorou demais para responder. Tente de novo em alguns instantes.',
  cancelado: 'A requisição foi cancelada.',
  nao_autenticado: 'A sua sessão expirou. Entre de novo para continuar.',
  sem_permissao: 'Você não tem acesso a este recurso.',
  nao_encontrado: 'Não encontramos o que você procura.',
  invalido: 'Algum dado enviado não foi aceito. Revise e tente de novo.',
  servidor: 'Tivemos um problema do nosso lado. Tente de novo em alguns instantes.',
  limitado: AVISO_LIMITE,
  resposta_invalida: 'O servidor respondeu em um formato que não reconhecemos.',
  desconhecido: 'Algo deu errado. Tente de novo.',
};

/** Erro único de toda a camada de API — a interface só precisa tratar este. */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  /** Código de negócio devolvido pelo backend, quando houver. */
  readonly serverCode?: string;
  /**
   * Mensagem técnica do backend. Serve para log e suporte: `message` é sempre o texto
   * em português da categoria, e é ele que a interface mostra.
   */
  readonly serverMessage?: string;
  /** Segundos do `Retry-After`, quando o servidor manda (429 e 503). */
  readonly retryAfterSegundos?: number;
  readonly details?: unknown;

  constructor(
    code: ApiErrorCode,
    {
      status = 0,
      serverCode,
      serverMessage,
      retryAfterSegundos,
      details,
      cause,
    }: ApiErrorOptions = {},
  ) {
    super(MENSAGEM[code], { cause });
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.serverCode = serverCode;
    this.serverMessage = serverMessage;
    this.retryAfterSegundos = retryAfterSegundos;
    this.details = details;
  }

  /** 4xx que não adianta repetir sozinho. */
  get isRetryable(): boolean {
    return this.code === 'rede' || this.code === 'timeout' || this.code === 'servidor';
  }
}

interface ApiErrorOptions {
  status?: number;
  serverCode?: string;
  serverMessage?: string;
  retryAfterSegundos?: number;
  details?: unknown;
  cause?: unknown;
}

/** `Retry-After` em segundos. Data HTTP não é aceita: o backend manda segundos. */
function retryAfter(valor: string | null): number | undefined {
  if (!valor) return undefined;
  const segundos = Number(valor);
  return Number.isInteger(segundos) && segundos >= 0 ? segundos : undefined;
}

function codeFromStatus(status: number): ApiErrorCode {
  if (status === 401) return 'nao_autenticado';
  if (status === 403) return 'sem_permissao';
  if (status === 404) return 'nao_encontrado';
  if (status === 408 || status === 504) return 'timeout';
  if (status === 429) return 'limitado';
  if (status >= 500) return 'servidor';
  if (status >= 400) return 'invalido';
  return 'desconhecido';
}

export type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions<T> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Vira querystring; `null` e `undefined` são descartados. */
  query?: Record<string, QueryValue>;
  /** Serializado como JSON. Use `FormData` para upload. */
  body?: unknown;
  /** Contrato da resposta. Sem schema, o corpo é descartado e o retorno é `void`. */
  schema?: ZodType<T>;
  signal?: AbortSignal;
  headers?: HeadersInit;
  timeoutMs?: number;
}

const TIMEOUT_PADRAO_MS = 20_000;
/** Vai em `X-Requested-With` nas rotas que mudam estado (CLAUDE.md → CSRF). */
const CLIENTE = 'shopscanner';

/**
 * `avatarUrl` tem duas procedências: o upload próprio vem relativo (`/me/avatar?v=…`) e a foto
 * do TikTok vem absoluta. Só o relativo ganha o domínio da API; o resto passa intacto.
 * Fica aqui, e não nas telas, para não haver um prefixo diferente em cada `<img>`.
 */
export function urlDeImagem(url: string | null): string | null {
  if (url === null || !url.startsWith('/') || url.startsWith('//')) return url;
  return `${env.apiUrl}${url}`;
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const base = `${env.apiUrl}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return base;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === '') continue;
    params.append(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

async function readErrorBody(response: Response) {
  try {
    const data: unknown = await response.json();
    if (data && typeof data === 'object') {
      const obj = data as { code?: unknown; message?: unknown; details?: unknown };
      return {
        serverCode: typeof obj.code === 'string' ? obj.code : undefined,
        serverMessage: typeof obj.message === 'string' ? obj.message : undefined,
        details: obj.details,
      };
    }
  } catch {
    // corpo vazio ou não-JSON: fica só o status
  }
  return {};
}

/** Renova a sessão. 401 nela, ou no login, é credencial morta: renovar não ajudaria. */
export const ROTA_REFRESH = '/auth/refresh';
const SEM_RENOVACAO: readonly string[] = [ROTA_REFRESH, '/auth/login'];

/**
 * Uma renovação por vez, compartilhada.
 *
 * O access token dura 15 minutos e cada tela faz de 8 a 10 consultas: quando ele vence,
 * todas tomam 401 praticamente juntas. Se cada uma chamasse `POST /auth/refresh`, o
 * servidor veria várias rotações do mesmo refresh token em paralelo e leria isso como
 * token roubado — derrubando a sessão inteira, que é o oposto do que queremos aqui. Então
 * a primeira dispara, as outras esperam **a mesma promessa**, e todas repetem depois.
 */
let renovacaoEmCurso: Promise<boolean> | null = null;

function renovarSessao(): Promise<boolean> {
  renovacaoEmCurso ??= fetch(buildUrl(ROTA_REFRESH), {
    method: 'POST',
    credentials: 'include',
    // Muda estado, então vai com o cabeçalho de cliente; sem ele a API responde 403.
    headers: { Accept: 'application/json', 'X-Requested-With': CLIENTE },
  })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      renovacaoEmCurso = null;
    });
  return renovacaoEmCurso;
}

/**
 * Uma porta de entrada para toda chamada HTTP.
 *
 * - Sessão por cookie httpOnly (`credentials: 'include'`); nenhum token em `localStorage`.
 * - Erro sempre vira `ApiError`, com `code` estável para a interface decidir o que mostrar.
 * - Resposta 2xx passa pelo Zod: fora do contrato é erro, não `any` solto pelo app.
 * - 401 não é "deslogado" de primeira: renova a sessão **uma vez** e repete a requisição.
 *   Só se a renovação falhar o `nao_autenticado` chega à tela, e daí a guarda vai para
 *   `/entrar`. Sem isto, qualquer aba aberta por mais de 15 minutos perderia uma sessão
 *   que o servidor ainda considera boa por 30 dias.
 */
export async function request<T = void>(path: string, opcoes: RequestOptions<T> = {}): Promise<T> {
  try {
    return await enviar<T>(path, opcoes);
  } catch (erro) {
    const renovavel =
      erro instanceof ApiError && erro.code === 'nao_autenticado' && !SEM_RENOVACAO.includes(path);
    if (!renovavel) throw erro;
    if (!(await renovarSessao())) throw erro;
    // Uma repetição, e só uma: se vier 401 de novo, este `enviar` o propaga sem renovar.
    return await enviar<T>(path, opcoes);
  }
}

async function enviar<T = void>(
  path: string,
  {
    method = 'GET',
    query,
    body,
    schema,
    signal,
    headers,
    timeoutMs = TIMEOUT_PADRAO_MS,
  }: RequestOptions<T> = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new DOMException('timeout', 'TimeoutError')),
    timeoutMs,
  );
  const onAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', onAbort, { once: true });

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      credentials: 'include',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(method === 'GET' ? {} : { 'X-Requested-With': CLIENTE }),
        ...(body !== undefined && !isFormData ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : isFormData ? (body as FormData) : JSON.stringify(body),
    });
  } catch (cause) {
    if (signal?.aborted) throw new ApiError('cancelado', { cause });
    if (cause instanceof DOMException && cause.name === 'TimeoutError') {
      throw new ApiError('timeout', { cause });
    }
    throw new ApiError('rede', { cause });
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
  }

  if (!response.ok) {
    const { serverCode, serverMessage, details } = await readErrorBody(response);
    throw new ApiError(codeFromStatus(response.status), {
      status: response.status,
      serverCode,
      serverMessage,
      retryAfterSegundos: retryAfter(response.headers.get('Retry-After')),
      details,
    });
  }

  if (!schema) return undefined as T;

  if (response.status === 204) {
    throw new ApiError('resposta_invalida', { status: 204 });
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch (cause) {
    throw new ApiError('resposta_invalida', { status: response.status, cause });
  }

  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new ApiError('resposta_invalida', {
      status: response.status,
      details: parsed.error.issues,
    });
  }
  return parsed.data;
}

/**
 * Upload com barra de progresso. É `XMLHttpRequest` porque `fetch` não informa
 * quanto do corpo já subiu, e um arquivo de dezenas de MB precisa disso em tela.
 * O processamento acontece depois, em fila: aqui só acompanhamos o envio.
 */
export async function upload<T>(
  path: string,
  body: FormData,
  opcoes: UploadOptions<T>,
): Promise<T> {
  try {
    return await enviarUpload(path, body, opcoes);
  } catch (erro) {
    // Mesma regra do `request`: 401 renova uma vez e repete, com a mesma renovação
    // compartilhada. Quem ficou dez minutos na tela de import antes de soltar o arquivo
    // não pode perder o arquivo por causa de um access token vencido.
    if (!(erro instanceof ApiError) || erro.code !== 'nao_autenticado') throw erro;
    if (!(await renovarSessao())) throw erro;
    // A barra volta a zero: o corpo sobe de novo, não há como reaproveitar o que já subiu.
    return await enviarUpload(path, body, opcoes);
  }
}

function enviarUpload<T>(
  path: string,
  body: FormData,
  { schema, onProgress, signal }: UploadOptions<T>,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', buildUrl(path));
    xhr.withCredentials = true;
    xhr.responseType = 'text';
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('X-Requested-With', CLIENTE);

    const cancelar = () => xhr.abort();
    signal?.addEventListener('abort', cancelar, { once: true });
    const encerrar = () => signal?.removeEventListener('abort', cancelar);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onerror = () => {
      encerrar();
      reject(new ApiError('rede'));
    };
    xhr.ontimeout = () => {
      encerrar();
      reject(new ApiError('timeout'));
    };
    xhr.onabort = () => {
      encerrar();
      reject(new ApiError('cancelado'));
    };
    xhr.onload = () => {
      encerrar();
      let corpo: unknown;
      try {
        corpo = JSON.parse(xhr.responseText) as unknown;
      } catch {
        corpo = undefined;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        const obj = (corpo ?? {}) as { code?: unknown; message?: unknown; details?: unknown };
        return reject(
          new ApiError(codeFromStatus(xhr.status), {
            status: xhr.status,
            serverCode: typeof obj.code === 'string' ? obj.code : undefined,
            serverMessage: typeof obj.message === 'string' ? obj.message : undefined,
            retryAfterSegundos: retryAfter(xhr.getResponseHeader('Retry-After')),
            details: obj.details,
          }),
        );
      }
      // O envio terminou: o que resta é o servidor processar.
      onProgress?.(1);
      const parsed = schema.safeParse(corpo);
      if (!parsed.success) {
        return reject(
          new ApiError('resposta_invalida', { status: xhr.status, details: parsed.error.issues }),
        );
      }
      resolve(parsed.data);
    };
    xhr.send(body);
  });
}

export interface UploadOptions<T> {
  schema: ZodType<T>;
  /** Fração enviada, de 0 a 1. */
  onProgress?: (fracao: number) => void;
  signal?: AbortSignal;
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions<T>, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T = void>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions<T>, 'method' | 'body'>,
  ) => request<T>(path, { ...options, method: 'POST', body }),
  put: <T = void>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions<T>, 'method' | 'body'>,
  ) => request<T>(path, { ...options, method: 'PUT', body }),
  patch: <T = void>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions<T>, 'method' | 'body'>,
  ) => request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T = void>(path: string, options?: Omit<RequestOptions<T>, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};
