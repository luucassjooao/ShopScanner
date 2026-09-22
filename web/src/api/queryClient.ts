import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
      // Repetir um 401 ou um 404 só atrasa a tela de erro.
      retry: (falhas, erro) =>
        erro instanceof ApiError ? erro.isRetryable && falhas < 2 : falhas < 2,
    },
    mutations: { retry: false },
  },
});
