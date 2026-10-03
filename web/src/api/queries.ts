import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, upload } from './client';
import { env } from '@/env';
import {
  avatarResposta,
  conexaoTiktok,
  contas,
  exportData,
  goal,
  goals,
  importBatch,
  importResposta,
  importsPage,
  reconciliacao,
  notificationSettings,
  orderDetail,
  ordersPage,
  plan,
  plans,
  productDetail,
  productsPage,
  summary,
  videoDetail,
  usuario,
  videosPage,
  type Channel,
  type ForgotPasswordInput,
  type Goal,
  type ImportBatch,
  type NotificationSettings,
  type LoginInput,
  type OrderStatus,
  type PerfilInput,
  type SenhaInput,
  type Plan,
  type PlanInput,
  type RegisterInput,
} from './schemas';
import { baixarArquivo } from '@/lib/csv';
import { sessionQuery } from './session';

/**
 * Todo dado de BI é de uma conta num período; a chave de cache carrega os dois.
 * `accountId` vazio desliga a consulta (sem conta, ou sem TikTok Shop onde ele é exigido).
 */
export interface Periodo {
  accountId: string;
  /** ISO 8601 UTC */
  from: string;
  /** ISO 8601 UTC */
  to: string;
}

export interface OrdersFiltro {
  status?: OrderStatus;
  channel?: Channel;
  productId?: string;
  shopName?: string;
  /** Busca por produto ou loja. */
  q?: string;
  page?: number;
  pageSize?: number;
}
export interface VideosFiltro {
  sort?: 'postedAt' | 'views' | 'gmv' | 'gpm';
  hashtag?: string;
  page?: number;
  pageSize?: number;
}
export interface ProductsFiltro {
  sort?: 'gmv' | 'commission' | 'units' | 'refunds';
  shopName?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

/** Teto de `pageSize` em toda lista do contrato. Varrer tudo pede o maior lote possível. */
export const MAX_PAGE_SIZE = 100;

export const queryKeys = {
  session: sessionQuery.queryKey,
  accounts: ['accounts'] as const,
  summary: (p: Periodo) => ['summary', p.accountId, p.from, p.to] as const,
  orders: (p: Periodo, f: OrdersFiltro = {}) => ['orders', p.accountId, p.from, p.to, f] as const,
  order: (id: string) => ['order', id] as const,
  videos: (p: Periodo, f: VideosFiltro = {}) => ['videos', p.accountId, p.from, p.to, f] as const,
  video: (id: string) => ['video', id] as const,
  products: (p: Periodo, f: ProductsFiltro = {}) =>
    ['products', p.accountId, p.from, p.to, f] as const,
  product: (id: string) => ['product', id] as const,
  plans: ['plans'] as const,
  goals: ['goals'] as const,
  notifications: ['me', 'notifications'] as const,
  imports: (accountId: string, kind?: string) => ['imports', accountId, kind ?? 'todos'] as const,
  reconciliation: (p: Periodo) => ['reconciliation', p.accountId, p.from, p.to] as const,
};

// --- sessão e contas ---

export const useSession = () => useQuery(sessionQuery);

export const useAccounts = () =>
  useQuery({
    queryKey: queryKeys.accounts,
    queryFn: ({ signal }) => api.get('/accounts', { schema: contas, signal }),
  });

/** Após entrar, sair ou criar conta, a sessão é relida do backend (cookie httpOnly). */
function useAuthMutation<T>(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: T) => api.post(path, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.session }),
  });
}

export const useLogin = () => useAuthMutation<LoginInput>('/auth/login');
export const useRegister = () => useAuthMutation<RegisterInput>('/auth/register');

export const useForgotPassword = () =>
  useMutation({
    mutationFn: (body: ForgotPasswordInput) => api.post('/auth/forgot-password', body),
  });

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/auth/logout'),
    // Nada da conta anterior fica no cache depois de sair.
    onSuccess: () => qc.clear(),
  });
}

/**
 * Começa uma conexão com o TikTok. São duas, independentes: `VIDEOS` (Display API) e
 * `SHOP` (pedidos). O backend devolve o endereço de autorização e a página navega para lá;
 * a volta é em `/configuracoes?conectado=1` ou `?erro=CODIGO`.
 */
export const useStartTiktokConnection = () =>
  useMutation({
    mutationFn: (kind: 'VIDEOS' | 'SHOP' = 'VIDEOS') =>
      api.post('/connections/tiktok/start', { kind }, { schema: conexaoTiktok }),
  });

export function useDisconnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/connections/${encodeURIComponent(id)}`),
    onSuccess: () => qc.invalidateQueries(),
  });
}

// --- BI ---

export const useSummary = (p: Periodo) =>
  useQuery({
    queryKey: queryKeys.summary(p),
    enabled: !!p.accountId,
    queryFn: ({ signal }) => api.get('/summary', { schema: summary, query: { ...p }, signal }),
  });

export const useOrders = (p: Periodo, f: OrdersFiltro = {}) =>
  useQuery({
    queryKey: queryKeys.orders(p, f),
    enabled: !!p.accountId,
    queryFn: ({ signal }) =>
      api.get('/orders', { schema: ordersPage, query: { ...p, ...f }, signal }),
    placeholderData: keepPreviousData,
  });

/** Todos os pedidos com os filtros, página a página (para exportar). */
export async function buscarTodosPedidos(p: Periodo, f: Omit<OrdersFiltro, 'page' | 'pageSize'>) {
  const pageSize = MAX_PAGE_SIZE;
  const pagina = (page: number) =>
    api.get('/orders', { schema: ordersPage, query: { ...p, ...f, page, pageSize } });
  const primeira = await pagina(1);
  const resto = await Promise.all(
    Array.from({ length: Math.ceil(primeira.total / pageSize) - 1 }, (_, i) => pagina(i + 2)),
  );
  return [primeira, ...resto].flatMap((r) => r.items);
}

export const useOrder = (id: string) =>
  useQuery({
    queryKey: queryKeys.order(id),
    enabled: !!id,
    queryFn: ({ signal }) =>
      api.get(`/orders/${encodeURIComponent(id)}`, { schema: orderDetail, signal }),
  });

export const useVideos = (p: Periodo, f: VideosFiltro = {}) =>
  useQuery({
    queryKey: queryKeys.videos(p, f),
    enabled: !!p.accountId,
    queryFn: ({ signal }) =>
      api.get('/videos', { schema: videosPage, query: { ...p, ...f }, signal }),
    placeholderData: keepPreviousData,
  });

/**
 * Todos os vídeos do período, para somar views e curtidas. O contrato de /videos pagina
 * sem `pageSize`; aqui a primeira página diz o total e as outras vêm em paralelo.
 */
export const useAllVideos = (p: Periodo, f: Omit<VideosFiltro, 'page' | 'pageSize'> = {}) =>
  useQuery({
    queryKey: [...queryKeys.videos(p, f), 'todos'] as const,
    enabled: !!p.accountId,
    queryFn: async ({ signal }) => {
      const pagina = (page: number) =>
        api.get('/videos', {
          schema: videosPage,
          query: { ...p, ...f, page, pageSize: MAX_PAGE_SIZE },
          signal,
        });
      const primeira = await pagina(1);
      const resto = await Promise.all(
        Array.from({ length: Math.ceil(primeira.total / MAX_PAGE_SIZE) - 1 }, (_, i) =>
          pagina(i + 2),
        ),
      );
      return [primeira, ...resto].flatMap((r) => r.items);
    },
  });

export const useVideo = (id: string) =>
  useQuery({
    queryKey: queryKeys.video(id),
    enabled: !!id,
    queryFn: ({ signal }) =>
      api.get(`/videos/${encodeURIComponent(id)}`, { schema: videoDetail, signal }),
  });

export const useProducts = (p: Periodo, f: ProductsFiltro = {}) =>
  useQuery({
    queryKey: queryKeys.products(p, f),
    enabled: !!p.accountId,
    queryFn: ({ signal }) =>
      api.get('/products', { schema: productsPage, query: { ...p, ...f }, signal }),
    placeholderData: keepPreviousData,
  });

/** Todos os produtos com os filtros, página a página (para exportar). */
export async function buscarTodosProdutos(
  p: Periodo,
  f: Omit<ProductsFiltro, 'page' | 'pageSize'>,
) {
  const pagina = (page: number) =>
    api.get('/products', {
      schema: productsPage,
      query: { ...p, ...f, page, pageSize: MAX_PAGE_SIZE },
    });
  const primeira = await pagina(1);
  const resto = await Promise.all(
    Array.from({ length: Math.ceil(primeira.total / MAX_PAGE_SIZE) - 1 }, (_, i) => pagina(i + 2)),
  );
  return [primeira, ...resto].flatMap((r) => r.items);
}

export const useProduct = (id: string) =>
  useQuery({
    queryKey: queryKeys.product(id),
    enabled: !!id,
    queryFn: ({ signal }) =>
      api.get(`/products/${encodeURIComponent(id)}`, { schema: productDetail, signal }),
  });

// --- planejamento e metas ---

export const usePlans = () =>
  useQuery({
    queryKey: queryKeys.plans,
    queryFn: ({ signal }) => api.get('/plans', { schema: plans, signal }),
  });

function usePlanMutation<V>(fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.plans }),
  });
}

export const useCreatePlan = () =>
  usePlanMutation((body: PlanInput) => api.post('/plans', body, { schema: plan }));

/** Otimista: o card muda de coluna na hora; se o servidor recusar, a lista é relida. */
export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<PlanInput> & { id: string }) =>
      api.patch(`/plans/${encodeURIComponent(id)}`, body, { schema: plan }),
    onMutate: async ({ id, ...body }) => {
      await qc.cancelQueries({ queryKey: queryKeys.plans });
      qc.setQueryData<Plan[]>(queryKeys.plans, (lista) =>
        lista?.map((p) => (p.id === id ? { ...p, ...body } : p)),
      );
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.plans }),
  });
}

export const useDeletePlan = () =>
  usePlanMutation((id: string) => api.delete(`/plans/${encodeURIComponent(id)}`));

export const useGoals = () =>
  useQuery({
    queryKey: queryKeys.goals,
    queryFn: ({ signal }) => api.get('/goals', { schema: goals, signal }),
  });

export function useSaveGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Goal) => api.put('/goals', body, { schema: goal }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.goals });
      // A meta do mês aparece dentro do /summary.
      void qc.invalidateQueries({ queryKey: ['summary'] });
    },
  });
}

// --- preferências e dados da conta ---

export const useNotifications = () =>
  useQuery({
    queryKey: queryKeys.notifications,
    queryFn: ({ signal }) => api.get('/me/notifications', { schema: notificationSettings, signal }),
  });

export function useSaveNotifications() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: NotificationSettings) =>
      api.put('/me/notifications', body, { schema: notificationSettings }),
    onSuccess: (salvo) => qc.setQueryData(queryKeys.notifications, salvo),
  });
}

/** Baixa o JSON de GET /me/export como arquivo. */
export const useExportData = () =>
  useMutation({
    mutationFn: async () => {
      const dados = await api.get('/me/export', { schema: exportData });
      baixarArquivo(
        JSON.stringify(dados, null, 2),
        `shopscanner-dados-${new Date().toISOString().slice(0, 10)}.json`,
        'application/json',
      );
    },
  });

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete('/me'),
    // Conta apagada: nada dela fica no cache.
    onSuccess: () => qc.clear(),
  });
}

// --- perfil ---

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PerfilInput) => api.patch('/me', body, { schema: usuario }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.session }),
  });
}

export function useChangePassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SenhaInput) => api.put('/me/password', body),
    // A primeira senha muda `hasPassword`, que é o que libera desvincular o Google.
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.session }),
  });
}

export function useUploadAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (arquivo: File) => {
      const dados = new FormData();
      dados.append('file', arquivo);
      return api.post('/me/avatar', dados, { schema: avatarResposta });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.session }),
  });
}

/**
 * Entrar ou criar conta com o Google: navegação do navegador, não `fetch`.
 * A sessão volta por cookie no callback; erro volta em `/entrar?erro=CODIGO`.
 *
 * Conta criada aqui nasce com `acceptedTermsVersion: null`: o aceite é pedido
 * depois do primeiro acesso, não nesta ida.
 */
export function entrarComGoogle() {
  window.location.assign(`${env.apiUrl}/auth/google/start`);
}

export function useUnlinkIdentity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (provider: 'GOOGLE') => api.delete(`/auth/identities/${provider}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.session }),
  });
}

/**
 * Envia o `affiliate_orders.xlsx`. O processamento é em fila: a resposta só traz o
 * `importId`, e quem acompanha o resto é `useImport`.
 */
export const useUploadImport = () =>
  useMutation({
    mutationFn: ({
      arquivo,
      accountId,
      onProgress,
    }: {
      arquivo: File;
      accountId: string;
      onProgress?: (fracao: number) => void;
    }) => {
      const dados = new FormData();
      dados.append('file', arquivo);
      // `accountId` vai na query: a API precisa recusar conta de outra pessoa antes de
      // ler o arquivo, e campo de multipart só chegaria depois dele.
      return upload(`/imports?accountId=${encodeURIComponent(accountId)}`, dados, {
        schema: importResposta,
        onProgress,
      });
    },
  });

/**
 * Histórico de imports da conta. Sem filtro vêm também as sincronizações automáticas,
 * que são muitas: quem chama diz de que tipo precisa.
 */
export const useImports = (accountId: string, kind?: ImportBatch['kind']) =>
  useQuery({
    queryKey: queryKeys.imports(accountId, kind),
    enabled: !!accountId,
    queryFn: ({ signal }) =>
      api.get('/imports', { query: { accountId, kind }, schema: importsPage, signal }),
  });

/** Estado de um import. A tela repergunta até sair de QUEUED/PROCESSING. */
export const buscarImport = (id: string) =>
  api.get(`/imports/${encodeURIComponent(id)}`, { schema: importBatch });

/** Divergências entre o arquivo e a API. Fica vazia enquanto a API não estiver ligada. */
export const useReconciliation = (p: Periodo) =>
  useQuery({
    queryKey: queryKeys.reconciliation(p),
    enabled: !!p.accountId,
    queryFn: ({ signal }) =>
      api.get('/reconciliation', {
        query: { accountId: p.accountId, from: p.from, to: p.to },
        schema: reconciliacao,
        signal,
      }),
  });
