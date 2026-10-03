/**
 * Textos que o design deixou entre colchetes para o time preencher.
 * Ficam num lugar só: trocar aqui troca em todas as telas.
 */
export const EMAIL_CONTATO = '[E-MAIL DE CONTATO]';
export const PRAZO_SINCRONIZACAO = '[PRAZO DE SINCRONIZAÇÃO]';
export const PRAZO_RESPOSTA = '[PRAZO DE RESPOSTA]';
export const PRAZO_EXCLUSAO = '[PRAZO DE EXCLUSÃO]';
export const VALIDADE_LINK = '[VALIDADE DO LINK]';
export const VALOR_PLANO = '[VALOR DO PLANO]';
export const PRAZO_AVISO = '[PRAZO DE AVISO]';
export const RAZAO_SOCIAL = '[RAZÃO SOCIAL]';
export const CNPJ = '[CNPJ]';
export const ENDERECO = '[ENDEREÇO COMPLETO]';
export const COMARCA = '[COMARCA]';
export const PROCESSADOR_PAGAMENTO = '[PROCESSADOR DE PAGAMENTO]';
export const PROVEDOR_NUVEM = '[PROVEDOR DE NUVEM]';
export const PROVEDOR_EMAIL = '[PROVEDOR DE E-MAIL]';
export const ENCARREGADO = '[NOME DO ENCARREGADO]';

/** Versão dos Termos e da Política aceita no cadastro (`acceptedTermsVersion`). */
export const VERSAO_TERMOS = '2026-09-22';

/**
 * Códigos de erro que o backend devolve na URL: `/entrar?erro=CODIGO` depois do
 * login social ou de a sessão vencer, e `/configuracoes?erro=CODIGO` depois de
 * uma conexão com o TikTok. O código cru **nunca** aparece em tela.
 */
const ERROS: Record<string, string> = {
  // Login pelo Google
  GOOGLE_RECUSADO: 'O acesso pelo Google foi cancelado. Tente de novo quando quiser.',
  GOOGLE_INDISPONIVEL:
    'Entrar pelo Google está fora do ar agora. Use e-mail e senha, ou tente de novo em alguns minutos.',
  EMAIL_NAO_VERIFICADO:
    'Esse e-mail ainda não foi confirmado no Google. Confirme lá e tente de novo.',
  JA_VINCULADO:
    'Essa conta do Google já está ligada a outro cadastro. Entre com e-mail e senha, ou use outra conta do Google.',
  SESSAO_EXPIRADA: 'A sua sessão venceu no meio do caminho. Entre de novo para continuar.',
  // Conexão com o TikTok
  TIKTOK_RECUSADO:
    'A autorização foi recusada no TikTok. Para trazer os seus dados, é preciso aceitar o acesso de leitura.',
  TIKTOK_INDISPONIVEL:
    'O TikTok não respondeu agora. Tente de novo em alguns minutos — não é nada com a sua conta.',
  TIKTOK_SHOP_INDISPONIVEL:
    'A conexão de pedidos ainda não foi liberada para a sua conta no Brasil. Enquanto isso, envie o relatório em arquivo.',
  TIKTOK_INVALIDO:
    'A autorização voltou do TikTok sem bater com a sua conta. Tente conectar de novo, conferindo qual conta está aberta no TikTok.',
};

/** Mensagem em português de um código de erro vindo da URL. */
export const mensagemDoErro = (codigo: string) =>
  ERROS[codigo] ?? 'Não conseguimos concluir. Tente de novo em alguns instantes.';
