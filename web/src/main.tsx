import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { queryClient } from '@/api/queryClient';
import { Toaster } from '@/components/ui/toaster';
import { env } from '@/env';
import { router } from '@/routes/router';
import './index.css';

/** MSW só em desenvolvimento: `import.meta.env.DEV` é constante, então o build de produção nem gera o chunk. */
async function iniciarMocks() {
  if (!import.meta.env.DEV || !env.mswEnabled) return;
  const { worker } = await import('./mocks/browser');
  await worker.start({ onUnhandledRequest: 'bypass' });
}

void iniciarMocks().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster />
      </QueryClientProvider>
    </StrictMode>,
  );
});
