import { http, HttpResponse } from 'msw';
import { env } from '@/env';
import {
  forgotPasswordInput,
  goal,
  loginInput,
  perfilInput,
  senhaInput,
  notificationSettings,
  planInput,
  registerInput,
  type Conta,
  type Goal,
  type NotificationSettings,
  type ImportBatch,
  type Order,
  type Plan,
  type Sessao,
  type Video,
} from '@/api/schemas';
import { compareMoney, dayKey, productRows, summarize } from '@/lib/metrics';
import { VERSAO_TERMOS } from '@/lib/textos';
import {
  adaptVideo,
  orderDetail,
  orders,
  productDetail,
  profile,
  rawVideos,
  withCatalog,
} from './adapters/tiktok';

/**
 * Handlers do contrato do backend (CLAUDE.md → "Contrato com o backend").
 * Nenhum handler conhece o formato cru do TikTok: tudo passa por ./adapters.
 */

const url = (path: string) => `${env.apiUrl}${path}`;
/** E-mail que o mock trata como já cadastrado em outra conta. */
const EMAIL_EM_USO_NO_MOCK = 'ocupado@email.com.br';
const ACCOUNT_ID = 'acc_1';

const dia = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

/** Dois planos de exemplo para o quadro não nascer vazio no desenvolvimento. */
function planosDemo(): Plan[] {
  const agora = new Date().toISOString();
  const base = { productId: null, videoId: null, notes: null, createdAt: agora, updatedAt: agora };
  return [
    {
      ...base,
      id: 'plan_demo_1',
      title: 'Review honesta do protetor solar',
      status: 'IDEA',
      scheduledFor: dia(1),
      script: null,
    },
    {
      ...base,
      id: 'plan_demo_2',
      title: '3 achadinhos de cozinha abaixo de R$ 60',
      status: 'SCRIPT',
      scheduledFor: dia(3),
      script: {
        hook: 'Parei de passar raiva na cozinha com isso aqui',
        scene1: 'Mostrar a tábua de corte em uso',
        scene2: 'Comparar com a tábua antiga',
        cta: 'Link na vitrine',
        caption: 'Achadinhos de cozinha que valem cada centavo #achadinhos',
      },
    },
  ];
}

const avisosPadrao = (): NotificationSettings => ({
  orderSettled: true,
  orderFrozen: true,
  orderRefunded: true,
  goalReached: true,
  paceDrop: true,
  viewsDrop: true,
  postReminder: true,
  channels: { inApp: true, email: false },
});

const HORA = 3_600_000;

/**
 * Histórico que já existia antes desta visita. `FILE` é o import por arquivo;
 * `SYNC` e `RECHECK` só aparecem quando a API do TikTok estiver ligada.
 */
function importsDemo(): ImportBatch[] {
  return [
    {
      id: 'imp_demo_1',
      accountId: ACCOUNT_ID,
      kind: 'FILE',
      fileName: 'affiliate_orders.xlsx',
      createdAt: new Date(Date.now() - 2 * 24 * HORA).toISOString(),
      status: 'DONE',
      result: { created: 64, updated: 12, unchanged: 4, skipped: 0 },
      error: null,
    },
    {
      id: 'imp_demo_2',
      accountId: ACCOUNT_ID,
      kind: 'FILE',
      fileName: 'relatorio-agosto.xlsx',
      createdAt: new Date(Date.now() - 9 * 24 * HORA).toISOString(),
      status: 'FAILED',
      result: null,
      error: { code: 'NO_HEADER', message: 'header not found on first sheet' },
    },
    {
      id: 'imp_demo_3',
      accountId: ACCOUNT_ID,
      kind: 'FILE',
      fileName: 'relatorio-novo-formato.xlsx',
      createdAt: new Date(Date.now() - 1 * 24 * HORA).toISOString(),
      status: 'FAILED',
      result: null,
      error: { code: 'PARSER_UNAVAILABLE', message: 'parser not implemented yet' },
    },
  ];
}

/**
 * Nome e tamanho do que foi enviado.
 *
 * O caminho real é `multipart/form-data`. Em teste isso não existe: o jsdom não
 * serializa `FormData` com arquivo no XHR, então o teste manda nome e tamanho em JSON.
 * É leniência do backend simulado, não do contrato.
 */
async function arquivoEnviado(request: Request) {
  if (request.headers.get('Content-Type')?.includes('application/json')) {
    const corpo = (await request.json()) as { fileName?: string; fileSize?: number };
    return corpo.fileName ? { nome: corpo.fileName, tamanho: corpo.fileSize ?? 0 } : null;
  }
  const arquivo = (await request.formData()).get('file');
  return arquivo instanceof File ? { nome: arquivo.name, tamanho: arquivo.size } : null;
}

/**
 * Qual erro simular, deduzido do nome do arquivo — é o jeito de exercitar cada
 * orientação em desenvolvimento sem um backend de verdade.
 */
function erroSimulado(nome: string, tamanho: number): ImportBatch['error'] {
  const n = nome.toLowerCase();
  if (!n.endsWith('.xlsx')) {
    return { code: 'WRONG_EXTENSION', message: `unsupported extension: ${nome}` };
  }
  if (tamanho > 50 * 1024 * 1024) return { code: 'TOO_LARGE', message: 'file above 50MB' };
  if (n.includes('live')) return { code: 'WRONG_FILE', message: 'live performance export' };
  if (n.includes('vazio')) return { code: 'NO_HEADER', message: 'header not found' };
  if (n.includes('usd')) return { code: 'WRONG_CURRENCY', message: 'currency USD' };
  if (n.includes('colunas')) {
    return {
      code: 'UNKNOWN_COLUMNS',
      message: 'unmapped columns',
      columnsFound: ['Order ID', 'SKU', 'Estimated commission'],
      columnsMissing: ['status do pedido', 'data de criação'],
    };
  }
  if (n.includes('falha')) return { code: 'FAILED', message: 'parser crashed' };
  if (n.includes('formato')) {
    return { code: 'PARSER_UNAVAILABLE', message: 'parser not implemented yet' };
  }
  return null;
}

function estadoInicial() {
  return {
    loggedIn: true,
    tiktokConnected: true,
    shopConnected: true,
    /** A conta tem pedido? Falso simula a creator que ainda não enviou nada. */
    vendasNaConta: true,
    user: {
      id: 'u_1',
      name: 'Carolina Dias',
      email: 'voce@email.com.br',
      emailVerified: true,
      avatarUrl: null as string | null,
      /** Null simula a conta criada pelo Google, que ainda não aceitou os termos. */
      acceptedTermsVersion: VERSAO_TERMOS as string | null,
    },
    /** null: a conta nasceu pelo Google e nunca definiu senha. */
    password: 'senha-demo-123' as string | null,
    google: { email: 'carolina.dias@gmail.com', linkedAt: '2026-08-02T12:00:00.000Z' } as {
      email: string;
      linkedAt: string;
    } | null,
    lastSyncedAt: new Date(Date.now() - 2 * HORA).toISOString() as string | null,
    expiresAt: new Date(Date.now() + 60 * 24 * HORA).toISOString() as string | null,
    imports: importsDemo(),
    plans: planosDemo(),
    goals: [] as Goal[],
    notifications: avisosPadrao(),
  };
}

/** Estado em memória do backend simulado. `resetDb()` volta ao início (usado nos testes). */
export const db = estadoInicial();
export function resetDb() {
  Object.assign(db, estadoInicial());
}

const conta = (): Conta => ({
  id: ACCOUNT_ID,
  ...profile,
  shopConnected: db.shopConnected,
  hasSales: db.vendasNaConta,
  connectedAt: '2026-08-02T12:00:00.000Z',
  lastSyncedAt: db.lastSyncedAt,
  expiresAt: db.expiresAt,
});

const usuario = (): Sessao['user'] => ({
  ...db.user,
  hasPassword: db.password !== null,
  identities: db.google ? [{ provider: 'GOOGLE', ...db.google }] : [],
});
const contas = () => (db.tiktokConnected ? [conta()] : []);

const erro = (status: number, message: string) => HttpResponse.json({ message }, { status });
const semSessao = () => (db.loggedIn ? null : erro(401, 'Sessão expirada.'));

function params(request: Request) {
  const q = new URL(request.url).searchParams;
  const page = Math.max(1, Number(q.get('page') ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(q.get('pageSize') ?? 20) || 20));
  return { q, page, pageSize };
}

/** 401 sem sessão, 404 para conta que não é da usuária. */
function guarda(q: URLSearchParams) {
  return semSessao() ?? (db.tiktokConnected && q.get('accountId') === ACCOUNT_ID ? null : erro(404, 'Conta não encontrada.'));
}

function noPeriodo(iso: string, q: URLSearchParams) {
  const t = Date.parse(iso);
  const from = q.get('from');
  const to = q.get('to');
  return (!from || t >= Date.parse(from)) && (!to || t <= Date.parse(to));
}

/**
 * Procedência de cada pedido. Com o TikTok Shop conectado, os números vêm da API;
 * sem ele, vieram do último arquivo importado. Quem decide se a venda aparece é
 * `vendasNaConta`, não esta conexão: sem Shop e com venda, a procedência é FILE.
 */
function comProcedencia(lista: Order[]): Order[] {
  if (db.shopConnected) return lista;
  const ultimo = db.imports.find((b) => b.kind === 'FILE' && b.status === 'DONE');
  const sourceAt = ultimo?.createdAt ?? db.imports[0]?.createdAt ?? new Date().toISOString();
  return lista.map((o) => ({ ...o, source: 'FILE' as const, sourceAt }));
}

const pedidosDoPeriodo = (q: URLSearchParams) =>
  db.vendasNaConta ? comProcedencia(orders.filter((o) => noPeriodo(o.createdAt, q))) : [];

const paginar = <T>(items: T[], page: number, pageSize: number) => ({
  items: items.slice((page - 1) * pageSize, page * pageSize),
  total: items.length,
  page,
});

const videos = (): Video[] =>
  rawVideos.map((v) => adaptVideo(v, db.vendasNaConta ? orders : null));

/** Busca sem diferença de maiúscula nem acento. */
const normalizar = (t: string) =>
  t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

/** Mês corrente em São Paulo: é a referência do `goal`, não o período filtrado. */
const mesAtual = () => dayKey(new Date().toISOString()).slice(0, 7);

export const handlers = [
  // --- auth ---
  http.post(url('/auth/register'), async ({ request }) => {
    const corpo = registerInput.safeParse(await request.json());
    if (!corpo.success) return erro(422, 'Dados inválidos.');
    // E-mail que já tem conta (o da conta demo, por exemplo) volta com código, como a API.
    if (corpo.data.email === EMAIL_EM_USO_NO_MOCK) {
      return HttpResponse.json(
        { code: 'EMAIL_EM_USO', message: 'E-mail já cadastrado.' },
        { status: 409 },
      );
    }
    db.loggedIn = true;
    return new HttpResponse(null, { status: 204 });
  }),
  http.post(url('/auth/login'), async ({ request }) => {
    if (!loginInput.safeParse(await request.json()).success) return erro(422, 'Dados inválidos.');
    db.loggedIn = true;
    return new HttpResponse(null, { status: 204 });
  }),
  http.post(url('/auth/logout'), () => {
    db.loggedIn = false;
    return new HttpResponse(null, { status: 204 });
  }),
  http.post(url('/auth/forgot-password'), async ({ request }) => {
    const corpo = forgotPasswordInput.safeParse(await request.json());
    if (!corpo.success) return erro(422, 'E-mail inválido.');
    // Como a API: 204 sempre, com ou sem conta, com senha ou só com Google.
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(url('/auth/session'), () => {
    const sessao: Sessao = {
      user: usuario(),
      accounts: contas(),
    };
    return semSessao() ?? HttpResponse.json(sessao);
  }),

  http.delete(url('/auth/identities/:provider'), () => {
    const negado = semSessao();
    if (negado) return negado;
    if (!db.google) return erro(404, 'O Google não está vinculado.');
    if (db.password === null) {
      return HttpResponse.json(
        { code: 'UNICO_ACESSO', message: 'Defina uma senha antes de desvincular o Google.' },
        { status: 409 },
      );
    }
    db.google = null;
    return new HttpResponse(null, { status: 204 });
  }),

  // --- contas ---
  http.get(url('/accounts'), () => semSessao() ?? HttpResponse.json(contas())),
  /**
   * O backend monta o endereço de autorização do TikTok e recebe a volta em
   * `/connections/tiktok/callback`. Aqui pulamos o TikTok e devolvemos direto o
   * destino final: `?conectado=1` para vídeos, e a indisponibilidade para pedidos,
   * que é o estado real no Brasil.
   */
  http.post(url('/connections/tiktok/start'), async ({ request }) => {
    const negado = semSessao();
    if (negado) return negado;
    const { kind = 'VIDEOS' } = (await request.json()) as { kind?: 'VIDEOS' | 'SHOP' };
    // A Affiliate Creator API não está liberada no Brasil: a rota existe e recusa.
    if (kind === 'SHOP') {
      return HttpResponse.json(
        { code: 'TIKTOK_SHOP_INDISPONIVEL', message: 'shop connection disabled' },
        { status: 503 },
      );
    }
    db.tiktokConnected = true;
    return HttpResponse.json({ authorizeUrl: '/configuracoes?conectado=1' });
  }),
  http.delete(url('/connections/:id'), ({ params: p }) => {
    const negado = semSessao();
    if (negado) return negado;
    if (p.id !== ACCOUNT_ID || !db.tiktokConnected) return erro(404, 'Conexão não encontrada.');
    db.tiktokConnected = false;
    return new HttpResponse(null, { status: 204 });
  }),

  // --- resumo ---
  http.get(url('/summary'), ({ request }) => {
    const { q } = params(request);
    const g = db.goals.find((x) => x.accountId === ACCOUNT_ID && x.month === mesAtual());
    return (
      guarda(q) ??
      HttpResponse.json({
        ...summarize(pedidosDoPeriodo(q)),
        goal: g ? { gmv: g.gmv, commission: g.commission } : null,
      })
    );
  }),

  // --- pedidos ---
  http.get(url('/orders'), ({ request }) => {
    const { q, page, pageSize } = params(request);
    const status = q.get('status');
    const channel = q.get('channel');
    const productId = q.get('productId');
    const shopName = q.get('shopName');
    const busca = normalizar(q.get('q') ?? '');
    const lista = pedidosDoPeriodo(q)
      .filter(
        (o: Order) =>
          (!status || o.status === status) &&
          (!channel || o.skus.some((s) => s.channel === channel)) &&
          (!productId || o.skus.some((s) => s.productId === productId)) &&
          (!shopName || o.skus.some((s) => s.shopName === shopName)) &&
          (!busca || o.skus.some((s) => normalizar(`${s.name} ${s.shopName}`).includes(busca))),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return guarda(q) ?? HttpResponse.json(paginar(lista, page, pageSize));
  }),
  http.get(url('/orders/:id'), ({ params: p }) => {
    const o = comProcedencia(orders).find((x) => x.id === p.id);
    return semSessao() ?? (o ? HttpResponse.json(orderDetail(o)) : erro(404, 'Venda não encontrada.'));
  }),

  // --- vídeos ---
  http.get(url('/videos'), ({ request }) => {
    const { q, page, pageSize } = params(request);
    const hashtag = q.get('hashtag')?.replace(/^#/, '').toLowerCase();
    const sort = q.get('sort') ?? 'postedAt';
    // Mais recente / maior primeiro; vídeo sem métrica de venda vai para o fim.
    const ordem = (a: Video, b: Video) => {
      if (sort === 'views') return b.views - a.views;
      if (sort === 'gmv' || sort === 'gpm') {
        const [x, y] = [a[sort], b[sort]];
        if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
        return compareMoney(y, x);
      }
      return b.postedAt.localeCompare(a.postedAt);
    };
    const lista = videos()
      .filter((v) => noPeriodo(v.postedAt, q))
      .filter((v) => !hashtag || v.description.toLowerCase().includes(`#${hashtag}`))
      .sort(ordem);
    const { items, total } = paginar(lista, page, pageSize);
    return guarda(q) ?? HttpResponse.json({ items, total });
  }),
  http.get(url('/videos/:id'), ({ params: p }) => {
    const v = videos().find((x) => x.id === p.id);
    if (!v) return semSessao() ?? erro(404, 'Vídeo não encontrado.');
    // A origem só tem o total acumulado; a série vem dos snapshots que o backend guardar.
    const snapshots = [{ at: new Date().toISOString(), views: v.views, likes: v.likes }];
    return semSessao() ?? HttpResponse.json({ ...v, snapshots });
  }),

  // --- produtos ---
  http.get(url('/products'), ({ request }) => {
    const { q, page, pageSize } = params(request);
    const sort = q.get('sort') ?? 'gmv';
    const shopName = q.get('shopName');
    const busca = normalizar(q.get('q') ?? '');
    const lista = productRows(pedidosDoPeriodo(q))
      .map(withCatalog)
      .filter(
        (p) =>
          (!shopName || p.shopName === shopName) &&
          (!busca || normalizar(`${p.name} ${p.shopName}`).includes(busca)),
      )
      .sort((a, b) =>
        sort === 'units'
          ? b.units - a.units
          : sort === 'refunds'
            ? b.refundedUnits - a.refundedUnits
            : sort === 'commission'
              ? compareMoney(b.commission, a.commission)
              : compareMoney(b.gmv, a.gmv),
      );
    return guarda(q) ?? HttpResponse.json(paginar(lista, page, pageSize));
  }),
  http.get(url('/products/:id'), ({ params: p }) => {
    const d = productDetail(String(p.id), orders, videos());
    return semSessao() ?? (d ? HttpResponse.json(d) : erro(404, 'Produto não encontrado.'));
  }),

  // --- planejamento ---
  http.get(url('/plans'), () => semSessao() ?? HttpResponse.json(db.plans)),
  http.post(url('/plans'), async ({ request }) => {
    const negado = semSessao();
    if (negado) return negado;
    const body = planInput.safeParse(await request.json());
    if (!body.success) return erro(422, 'Dados inválidos.');
    const agora = new Date().toISOString();
    const novo: Plan = { ...body.data, id: crypto.randomUUID(), createdAt: agora, updatedAt: agora };
    db.plans.push(novo);
    return HttpResponse.json(novo, { status: 201 });
  }),
  http.patch(url('/plans/:id'), async ({ params: p, request }) => {
    const negado = semSessao();
    if (negado) return negado;
    const body = planInput.partial().safeParse(await request.json());
    const i = db.plans.findIndex((x) => x.id === p.id);
    if (i < 0) return erro(404, 'Plano não encontrado.');
    if (!body.success) return erro(422, 'Dados inválidos.');
    db.plans[i] = { ...db.plans[i], ...body.data, updatedAt: new Date().toISOString() };
    return HttpResponse.json(db.plans[i]);
  }),
  http.delete(url('/plans/:id'), ({ params: p }) => {
    const negado = semSessao();
    if (negado) return negado;
    db.plans = db.plans.filter((x) => x.id !== p.id);
    return new HttpResponse(null, { status: 204 });
  }),

  // --- metas ---
  http.get(url('/goals'), () => semSessao() ?? HttpResponse.json(db.goals)),
  http.put(url('/goals'), async ({ request }) => {
    const negado = semSessao();
    if (negado) return negado;
    const body = goal.safeParse(await request.json());
    if (!body.success) return erro(422, 'Dados inválidos.');
    const g = body.data;
    db.goals = [...db.goals.filter((x) => !(x.accountId === g.accountId && x.month === g.month)), g];
    return HttpResponse.json(g);
  }),

  // --- preferências e dados da conta ---
  http.get(url('/me/notifications'), () => semSessao() ?? HttpResponse.json(db.notifications)),
  http.put(url('/me/notifications'), async ({ request }) => {
    const negado = semSessao();
    if (negado) return negado;
    const body = notificationSettings.safeParse(await request.json());
    if (!body.success) return erro(422, 'Dados inválidos.');
    db.notifications = body.data;
    return HttpResponse.json(db.notifications);
  }),
  http.get(url('/me/export'), () => {
    const negado = semSessao();
    if (negado) return negado;
    return HttpResponse.json({
      exportedAt: new Date().toISOString(),
      accounts: contas(),
      plans: db.plans,
      goals: db.goals,
      notifications: db.notifications,
    });
  }),
  http.delete(url('/me'), () => {
    const negado = semSessao();
    if (negado) return negado;
    Object.assign(db, { loggedIn: false, tiktokConnected: false, plans: [], goals: [] });
    return new HttpResponse(null, { status: 204 });
  }),

  // --- perfil ---
  http.patch(url('/me'), async ({ request }) => {
    const negado = semSessao();
    if (negado) return negado;
    const body = perfilInput.safeParse(await request.json());
    if (!body.success) return erro(422, 'Dados inválidos.');
    if (body.data.email === EMAIL_EM_USO_NO_MOCK) {
      return HttpResponse.json(
        { code: 'EMAIL_EM_USO', message: 'E-mail já cadastrado.' },
        { status: 409 },
      );
    }
    Object.assign(db.user, body.data);
    return HttpResponse.json(usuario());
  }),
  http.put(url('/me/password'), async ({ request }) => {
    const negado = semSessao();
    if (negado) return negado;
    const body = senhaInput.safeParse(await request.json());
    if (!body.success) return erro(422, 'A senha nova precisa ter pelo menos 8 caracteres.');
    if (db.password !== null && body.data.currentPassword !== db.password) {
      return HttpResponse.json(
        { code: 'SENHA_ATUAL_INCORRETA', message: 'Senha atual não confere.' },
        { status: 400 },
      );
    }
    db.password = body.data.newPassword;
    return new HttpResponse(null, { status: 204 });
  }),
  // O arquivo é aceito e entra na fila; o que deu errado aparece no acompanhamento.
  http.post(url('/imports'), async ({ request }) => {
    const negado = guarda(new URL(request.url).searchParams);
    if (negado) return negado;
    const enviado = await arquivoEnviado(request);
    if (!enviado) return erro(422, 'Nenhum arquivo foi enviado.');
    const id = `imp_${Date.now()}`;
    db.imports.unshift({
      id,
      accountId: ACCOUNT_ID,
      kind: 'FILE',
      fileName: enviado.nome,
      createdAt: new Date().toISOString(),
      status: 'QUEUED',
      result: null,
      error: erroSimulado(enviado.nome, enviado.tamanho),
    });
    return HttpResponse.json({ importId: id }, { status: 202 });
  }),
  http.get(url('/imports'), ({ request }) => {
    const { q, page, pageSize } = params(request);
    const kind = q.get('kind');
    const status = q.get('status');
    const lista = db.imports.filter(
      (b) => (!kind || b.kind === kind) && (!status || b.status === status),
    );
    return guarda(q) ?? HttpResponse.json(paginar(lista, page, pageSize));
  }),
  http.get(url('/imports/:id'), ({ params: p }) => {
    const negado = semSessao();
    if (negado) return negado;
    const batch = db.imports.find((b) => b.id === p.id);
    if (!batch) return erro(404, 'Import não encontrado.');
    // A fila anda com o relógio: na primeira consulta o processamento já terminou.
    if (batch.status === 'QUEUED' || batch.status === 'PROCESSING') {
      const passou = Date.now() - Date.parse(batch.createdAt);
      batch.status = passou < 50 ? 'PROCESSING' : batch.error ? 'FAILED' : 'DONE';
      if (batch.status === 'DONE') {
        batch.result = { created: 12, updated: 3, unchanged: 65, skipped: 0 };
      }
    }
    return HttpResponse.json(batch);
  }),
  // Vazia enquanto a API do TikTok não estiver ligada: só o arquivo alimenta os pedidos.
  http.get(url('/reconciliation'), ({ request }) => guarda(params(request).q) ?? HttpResponse.json([])),
  http.post(url('/me/avatar'), async ({ request }) => {
    const negado = semSessao();
    if (negado) return negado;
    const arquivo = (await request.formData()).get('file');
    if (!(arquivo instanceof File)) return erro(422, 'Envie uma imagem.');
    // No navegador a prévia é a própria imagem; nos testes (Node) basta um endereço fixo.
    db.user.avatarUrl =
      typeof URL.createObjectURL === 'function'
        ? URL.createObjectURL(arquivo)
        : 'https://example.com/avatars/u_1.jpg';
    return HttpResponse.json({ avatarUrl: db.user.avatarUrl });
  }),
];
