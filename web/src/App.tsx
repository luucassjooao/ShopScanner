import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import { queryClient } from '@/api/queryClient';
import { Toaster } from '@/components/ui/toaster';
import { router } from '@/routes/router';
import './index.css';

/** Os providers do app: cache de servidor, rotas e a fila de avisos curtos. */
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>
  );
}
