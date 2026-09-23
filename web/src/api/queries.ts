import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import {
  conexaoTiktok,
  contas,
  goal,
  goals,
  orderDetail,
  ordersPage,
  plan,
  plans,
  productDetail,
  productsPage,
  summary,
  videoDetail,
  videosPage,
  type Channel,
  type ForgotPasswordInput,
  type Goal,
  type LoginInput,
  type OrderStatus,
  type PlanInput,
  type RegisterInput,
} from './schemas';
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
  page?: number;
  pageSize?: number;
}
export interface VideosFiltro {
  sort?: 'postedAt' | 'views' | 'gmv' | 'gpm';
  hashtag?: string;
  page?: number;
}
export interface ProductsFiltro {
  sort?: 'gmv' | 'commission' | 'units';
  page?: number;
}

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

export const useStartTiktokConnection = () =>
  useMutation({
    mutationFn: () => api.post('/connections/tiktok/start', undefined, { schema: conexaoTiktok }),
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

export const useOrder = (id: string) =>
  useQuery({
    queryKey: queryKeys.order(id),
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

export const useVideo = (id: string) =>
  useQuery({
    queryKey: queryKeys.video(id),
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

export const useProduct = (id: string) =>
  useQuery({
    queryKey: queryKeys.product(id),
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

export const useUpdatePlan = () =>
  usePlanMutation(({ id, ...body }: Partial<PlanInput> & { id: string }) =>
    api.patch(`/plans/${encodeURIComponent(id)}`, body, { schema: plan }),
  );

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
