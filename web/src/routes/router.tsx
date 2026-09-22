import { createBrowserRouter } from 'react-router-dom';
import { PublicLayout } from './public/PublicLayout';
import { AppLayout } from './app/AppLayout';

/**
 * Duas cascas, nenhuma página ainda.
 *
 * Públicas (dentro de PublicLayout):  /  /entrar  /criar-conta  /recuperar  /termos  /privacidade
 * Do app (dentro de AppLayout):       /inicio  /vendas  /videos  /produtos  /planejamento  /configuracoes
 */
export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [],
  },
  {
    element: <AppLayout />,
    children: [],
  },
  {
    path: '*',
    element: (
      <main className="flex min-h-dvh items-center justify-center bg-fundo p-6">
        <p className="text-corpo text-texto-secundario">Esta rota ainda não existe.</p>
      </main>
    ),
  },
]);
