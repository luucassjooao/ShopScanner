import { createBrowserRouter, type RouteObject, type ShouldRevalidateFunction } from 'react-router';
import type { QueryClient } from '@tanstack/react-query';
import { queryClient } from '@/api/queryClient';
import { guarda } from '@/auth/guarda';
import { AppLayout } from '@/layouts/AppLayout';
import { CarregandoApp } from '@/layouts/CarregandoApp';
import { PublicLayout } from '@/layouts/PublicLayout';
import { Avisos } from '@/pages/avisos';
import { Configuracoes } from '@/pages/configuracoes';
import { CriarConta } from '@/pages/criar-conta';
import { Entrar } from '@/pages/entrar';
import { Inicio } from '@/pages/inicio';
import { InicioRapido } from '@/pages/inicio-rapido';
import { Landing } from '@/pages/landing';
import { NaoEncontrada } from '@/pages/nao-encontrada';
import { Planejamento } from '@/pages/planejamento';
import { Privacidade } from '@/pages/privacidade';
import { Produtos } from '@/pages/produtos';
import { Reconciliacao } from '@/pages/reconciliacao';
import { Recuperar } from '@/pages/recuperar';
import { Termos } from '@/pages/termos';
import { Vendas } from '@/pages/vendas';
import { Videos } from '@/pages/videos';
import { VideoDetalhe } from '@/pages/videos/VideoDetalhe';

/**
 * A guarda só precisa correr quando o caminho muda. Os filtros das telas moram na URL
 * (`?pagina=`, `?venda=`, `?de=`), e sem isto cada troca de filtro voltaria ao backend
 * perguntando pela sessão e re-renderizaria a árvore inteira no meio do clique — o que
 * chegou a derrubar o painel de detalhe da venda. Sessão que vence sem navegação nenhuma
 * é caso de `useSessaoViva`, não do loader.
 */
const soAoTrocarDePagina: ShouldRevalidateFunction = ({ currentUrl, nextUrl }) =>
  currentUrl.pathname !== nextUrl.pathname;

/**
 * Só a definição das rotas e a guarda. Tela nenhuma mora aqui: cada página está em
 * `src/pages/<pagina>/`, as cascas em `src/layouts/` e a decisão de sessão em `src/auth/`.
 *
 * O `queryClient` entra por parâmetro porque o loader e os componentes precisam ser o
 * **mesmo** cliente: é isso que faz a sessão ser buscada uma vez por navegação em vez de
 * duas, e é o que deixa cada teste montar o app com um cache limpo.
 */
export function criarRotas(queryClient: QueryClient): RouteObject[] {
  const privada = guarda(queryClient, { privada: true });
  const deEntrada = guarda(queryClient, { privada: false });

  return [
    {
      // Única rota em que `HydrateFallback` vale: a raiz.
      HydrateFallback: CarregandoApp,
      children: [
        {
          Component: PublicLayout,
          children: [
            {
              // Rotas de entrada: quem já tem sessão vai para o app em vez de ver a landing
              // ou o formulário de login outra vez.
              loader: deEntrada,
              shouldRevalidate: soAoTrocarDePagina,
              children: [
                { path: '/', Component: Landing },
                { path: '/entrar', Component: Entrar },
                { path: '/criar-conta', Component: CriarConta },
                { path: '/recuperar', Component: Recuperar },
              ],
            },
            // Exceção deliberada: /termos e /privacidade abrem para qualquer um, com ou sem
            // sessão, e sem nenhuma leitura de sessão. As duas URLs vão para a revisão do
            // app no TikTok — expulsar quem está logado quebraria essa exigência.
            { path: '/termos', Component: Termos },
            { path: '/privacidade', Component: Privacidade },
          ],
        },
        {
          path: '/inicio-rapido',
          loader: privada,
          shouldRevalidate: soAoTrocarDePagina,
          Component: InicioRapido,
        },
        {
          loader: privada,
          shouldRevalidate: soAoTrocarDePagina,
          Component: AppLayout,
          children: [
            { path: '/inicio', Component: Inicio },
            { path: '/vendas', Component: Vendas },
            { path: '/produtos', Component: Produtos },
            { path: '/videos', Component: Videos },
            { path: '/videos/:id', Component: VideoDetalhe },
            { path: '/avisos', Component: Avisos },
            { path: '/planejamento', Component: Planejamento },
            { path: '/configuracoes', Component: Configuracoes },
            { path: '/reconciliacao', Component: Reconciliacao },
          ],
        },
        { path: '*', Component: NaoEncontrada },
      ],
    },
  ];
}

export const router = createBrowserRouter(criarRotas(queryClient));
