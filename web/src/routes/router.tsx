import { createBrowserRouter, Link, type RouteObject } from 'react-router-dom';
import { PublicLayout } from './public/PublicLayout';
import { CriarConta } from './public/CriarConta';
import { Entrar } from './public/Entrar';
import { Landing } from './public/Landing';
import { Privacidade } from './public/Privacidade';
import { Recuperar } from './public/Recuperar';
import { Termos } from './public/Termos';
import { AppLayout } from './app/AppLayout';
import { Avisos } from './app/Avisos';
import { Configuracoes } from './app/Configuracoes';
import { Inicio } from './app/Inicio';
import { InicioRapido } from './app/InicioRapido';
import { Planejamento } from './app/Planejamento';
import { Produtos } from './app/Produtos';
import { Reconciliacao } from './app/Reconciliacao';
import { Vendas } from './app/Vendas';
import { VideoDetalhe, Videos } from './app/Videos';

/**
 * Públicas (PublicLayout): /  /entrar  /criar-conta  /recuperar  /termos  /privacidade
 * Onboarding (logado, sem a casca): /inicio-rapido
 * Do app (AppLayout): /inicio  /vendas  /videos  /videos/:id  /produtos  /planejamento
 *                     /configuracoes  /avisos  /reconciliacao
 */
export const rotas: RouteObject[] = [
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <Landing /> },
      { path: '/entrar', element: <Entrar /> },
      { path: '/criar-conta', element: <CriarConta /> },
      { path: '/recuperar', element: <Recuperar /> },
      { path: '/termos', element: <Termos /> },
      { path: '/privacidade', element: <Privacidade /> },
    ],
  },
  { path: '/inicio-rapido', element: <InicioRapido /> },
  {
    element: <AppLayout />,
    children: [
      { path: '/inicio', element: <Inicio /> },
      { path: '/vendas', element: <Vendas /> },
      { path: '/produtos', element: <Produtos /> },
      { path: '/videos', element: <Videos /> },
      { path: '/videos/:id', element: <VideoDetalhe /> },
      { path: '/avisos', element: <Avisos /> },
      { path: '/planejamento', element: <Planejamento /> },
      { path: '/configuracoes', element: <Configuracoes /> },
      { path: '/reconciliacao', element: <Reconciliacao /> },
    ],
  },
  {
    path: '*',
    element: (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-fundo p-6 text-center">
        <h1 className="text-[26px] font-extrabold tracking-tight text-texto">
          Esta página não existe
        </h1>
        <p className="text-texto-secundario">O endereço pode ter mudado ou estar incompleto.</p>
        <Link to="/" className="font-semibold">
          Voltar para o início
        </Link>
      </main>
    ),
  },
];

export const router = createBrowserRouter(rotas);
