/*
 * Service worker de um propósito só: receber o relatório do TikTok quando a creator
 * usa "Compartilhar" no celular (Web Share Target do manifest).
 *
 * O destino de compartilhamento é um POST, e só um service worker consegue atendê-lo
 * sem servidor. O arquivo fica guardado no Cache Storage e a página o pega em seguida.
 * Nada de cache de navegação aqui: o app continua indo à rede normalmente.
 */
const DEPOSITO = 'shopscanner-compartilhados';
const ROTA = '/compartilhar';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'POST' || url.pathname !== ROTA) return;

  event.respondWith(
    (async () => {
      try {
        const dados = await event.request.formData();
        const arquivo = dados.get('file');
        if (!arquivo) return Response.redirect('/configuracoes?secao=import', 303);

        const chave = `${Date.now()}-${arquivo.name}`;
        const deposito = await caches.open(DEPOSITO);
        await deposito.put(
          new Request(`/compartilhado/${encodeURIComponent(chave)}`),
          new Response(arquivo, {
            headers: {
              'Content-Type': arquivo.type || 'application/octet-stream',
              'X-Nome-Arquivo': encodeURIComponent(arquivo.name),
            },
          }),
        );
        return Response.redirect(
          `/configuracoes?secao=import&compartilhado=${encodeURIComponent(chave)}`,
          303,
        );
      } catch {
        return Response.redirect('/configuracoes?secao=import&compartilhado=erro', 303);
      }
    })(),
  );
});
