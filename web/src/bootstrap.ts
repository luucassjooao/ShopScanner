import { env } from '@/env';

/** MSW só em desenvolvimento: `import.meta.env.DEV` é constante, então o build de produção nem gera o chunk. */
async function iniciarMocks(): Promise<void> {
  if (!import.meta.env.DEV || !env.mswEnabled) return;
  const { worker } = await import('./mocks/browser');
  await worker.start({ onUnhandledRequest: 'bypass' });
}

/**
 * Service worker do destino de compartilhamento (manifest → `share_target`).
 * Só em produção: em desenvolvimento o escopo `/` é do worker do MSW, e dois
 * workers no mesmo escopo brigam pelo controle da página.
 */
function registrarCompartilhamento(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch(() => {
    // Sem service worker o app funciona igual; só não aparece no menu de compartilhar.
  });
}

/**
 * Tudo o que precisa estar de pé **antes** do primeiro render, num módulo só, para o
 * `main.tsx` ficar apenas com a renderização.
 *
 * A ordem não é estilo. O worker do MSW só intercepta depois de `worker.start()` resolver:
 * renderizar antes disso deixa a primeira query escapar para a rede, e o resultado é um app
 * de desenvolvimento intermitente — às vezes funciona, às vezes a tela vem vazia, e nenhum
 * teste pega, porque em teste o MSW é o `server` do Node e não passa por aqui. Por isso o
 * `main` espera esta promessa antes de montar a árvore.
 */
export async function prepararAmbiente(): Promise<void> {
  await iniciarMocks();
  registrarCompartilhamento();
}
