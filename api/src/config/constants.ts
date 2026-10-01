/** Nomes de cookie e prazos. Mudar aqui muda em todo lugar. */

export const COOKIE_ACESSO = '__Host-at';

/**
 * O prefixo __Host- exige Path=/, e o refresh precisa de Path=/auth/refresh
 * para não viajar em toda requisição — as duas coisas não cabem no mesmo
 * cookie. Fica __Secure-, que garante HTTPS, com o caminho restrito.
 */
export const COOKIE_REFRESH = '__Secure-rt';
export const CAMINHO_REFRESH = '/auth/refresh';

export const ACESSO_SEGUNDOS = 15 * 60;
export const REFRESH_SEGUNDOS = 30 * 24 * 60 * 60;
export const RESET_SENHA_SEGUNDOS = 30 * 60;

export const HEADER_CSRF = 'x-requested-with';
export const VALOR_CSRF = 'shopscanner';

/** Motivos de revogação, gravados em sessions.revoked_reason. */
export const MOTIVO = {
  logout: 'LOGOUT',
  logoutAll: 'LOGOUT_ALL',
  revogadaPeloUsuario: 'REVOGADA_PELO_USUARIO',
  trocaDeSenha: 'TROCA_DE_SENHA',
  reusoDeRefresh: 'REUSO_DE_REFRESH',
} as const;
