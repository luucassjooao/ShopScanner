import { http, HttpResponse } from 'msw';
import { env } from '@/env';
import {
  forgotPasswordInput,
  goal,
  loginInput,
  notificationSettings,
  planInput,
  registerInput,
  type Conta,
  type Goal,
  type NotificationSettings,
  type Order,
  type Plan,
  type Sessao,
  type Video,
} from '@/api/schemas';
import { compareMoney, productRows, summarize } from '@/lib/metrics';
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
  orderFrozen: true,
  orderRefunded: true,
  goalReached: true,
  paceDrop: true,
  postReminder: true,
  channels: { inApp: true, email: false },
});

/** Estado em memória do backend simulado. `resetDb()` volta ao início (usado nos testes). */
export const db = {
  loggedIn: true,
  tiktokConnected: true,
  shopConnected: true,
  plans: planosDemo(),
  goals: [] as Goal[],
  notifications: avisosPadrao(),
};
export function resetDb() {
  Object.assign(db, {
    loggedIn: true,
    tiktokConnected: true,
    shopConnected: true,
    plans: planosDemo(),
    goals: [],
    notifications: avisosPadrao(),
  });
}

const conta = (): Conta => ({
  id: ACCOUNT_ID,
  ...profile,
  shopConnected: db.shopConnected,
  connectedAt: '2026-08-02T12:00:00.000Z',
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

const pedidosDoPeriodo = (q: URLSearchParams) => orders.filter((o) => noPeriodo(o.createdAt, q));

const paginar = <T>(items: T[], page: number, pageSize: number) => ({
  items: items.slice((page - 1) * pageSize, page * pageSize),
  total: items.length,
  page,
});

const videos = (): Video[] =>
  rawVideos.map((v) => adaptVideo(v, db.shopConnected ? orders : null));

const mesAtual = () => new Date().toISOString().slice(0, 7);

export const handlers = [
  // --- auth ---
  http.post(url('/auth/register'), async ({ request }) => {
    if (!registerInput.safeParse(await request.json()).success) return erro(422, 'Dados inválidos.');
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
    if (!forgotPasswordInput.safeParse(await request.json()).success) {
      return erro(422, 'E-mail inválido.');
    }
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(url('/auth/session'), () => {
    const sessao: Sessao = {
      user: { id: 'u_1', name: 'Carolina Dias', email: 'voce@email.com.br' },
      accounts: contas(),
    };
    return semSessao() ?? HttpResponse.json(sessao);
  }),

  // --- contas ---
  http.get(url('/accounts'), () => semSessao() ?? HttpResponse.json(contas())),
  http.post(
    url('/connections/tiktok/start'),
    () => semSessao() ?? HttpResponse.json({ authorizeUrl: '/configuracoes?conexao=simulada' }),
  ),
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
    const lista = pedidosDoPeriodo(q)
      .filter(
        (o: Order) =>
          (!status || o.status === status) &&
          (!channel || o.skus.some((s) => s.channel === channel)) &&
          (!productId || o.skus.some((s) => s.productId === productId)),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return guarda(q) ?? HttpResponse.json(paginar(lista, page, pageSize));
  }),
  http.get(url('/orders/:id'), ({ params: p }) => {
    const o = orders.find((x) => x.id === p.id);
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
    const lista = productRows(pedidosDoPeriodo(q))
      .map(withCatalog)
      .sort((a, b) =>
        sort === 'units'
          ? b.units - a.units
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
];
