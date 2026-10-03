import { useSyncExternalStore } from 'react';

/**
 * `true` quando a media query casa. Sem `matchMedia` (testes em jsdom), vale `padrao`.
 * Usado para escolher painel lateral (desktop) ou folha deslizante (celular).
 */
export function useMedia(query: string, padrao = true): boolean {
  return useSyncExternalStore(
    (avisar) => {
      if (typeof window.matchMedia !== 'function') return () => {};
      const m = window.matchMedia(query);
      m.addEventListener('change', avisar);
      return () => m.removeEventListener('change', avisar);
    },
    () => (typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : padrao),
    () => padrao,
  );
}

export const useDesktop = () => useMedia('(min-width: 1024px)');
