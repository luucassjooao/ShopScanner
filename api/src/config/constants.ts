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

/** Cookie efêmero do fluxo OAuth: state, nonce e code_verifier, assinado. */
export const COOKIE_OAUTH = '__Secure-goog';
export const CAMINHO_OAUTH = '/auth/google';
export const OAUTH_SEGUNDOS = 10 * 60;

/** Cookie efêmero do fluxo de conexão com o TikTok. */
export const COOKIE_CONEXAO = '__Secure-conn';
export const CAMINHO_CONEXAO = '/connections';

export const HEADER_CSRF = 'x-requested-with';
export const VALOR_CSRF = 'shopscanner';

/** Motivos de revogação, gravados em sessions.revoked_reason. */
export const MOTIVO = {
  logout: 'LOGOUT',
  logoutAll: 'LOGOUT_ALL',
  revogadaPeloUsuario: 'REVOGADA_PELO_USUARIO',
  trocaDeSenha: 'TROCA_DE_SENHA',
  trocaDeEmail: 'TROCA_DE_EMAIL',
  reusoDeRefresh: 'REUSO_DE_REFRESH',
} as const;
