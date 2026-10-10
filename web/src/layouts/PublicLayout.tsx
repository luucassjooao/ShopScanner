import { Outlet } from 'react-router';

/**
 * Casca das rotas públicas: landing, /entrar, /criar-conta, /recuperar, /termos, /privacidade.
 * Ainda vazia de propósito — cabeçalho, rodapé e páginas entram depois.
 */
export function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-fundo">
      <Outlet />
    </div>
  );
}
