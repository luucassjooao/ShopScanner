import { queryOptions } from '@tanstack/react-query';
import { api } from './client';
import { sessao, type Sessao } from './schemas';

export const sessionQuery = queryOptions({
  queryKey: ['auth', 'session'] as const,
  queryFn: ({ signal }) => api.get<Sessao>('/auth/session', { schema: sessao, signal }),
  // A sessão é o guarda do layout protegido: não repete quando o 401 é a resposta certa.
  retry: false,
  staleTime: 5 * 60 * 1000,
});
