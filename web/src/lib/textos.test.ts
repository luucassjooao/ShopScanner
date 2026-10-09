import { describe, expect, it } from 'vitest';
import { mensagemDoErro } from './textos';

// Códigos do contrato da raiz (CLAUDE.md): login pelo Google, conexão com o TikTok e sessão.
const CODIGOS_DO_CONTRATO = [
  'GOOGLE_RECUSADO',
  'GOOGLE_INDISPONIVEL',
  'EMAIL_NAO_VERIFICADO',
  'JA_VINCULADO',
  'SESSAO_EXPIRADA',
  'TIKTOK_RECUSADO',
  'TIKTOK_INDISPONIVEL',
  'TIKTOK_SHOP_INDISPONIVEL',
  'TIKTOK_INVALIDO',
];

describe('mensagemDoErro', () => {
  it.each(CODIGOS_DO_CONTRATO)('traduz %s para uma frase em português', (codigo) => {
    const texto = mensagemDoErro(codigo);
    expect(texto).not.toBe(codigo);
    expect(texto).not.toMatch(/[A-Z]{3,}_[A-Z_]+/);
    expect(texto.endsWith('.')).toBe(true);
  });

  it('nunca devolve o código cru, nem para código desconhecido', () => {
    expect(mensagemDoErro('ALGUM_CODIGO_NOVO')).not.toContain('ALGUM_CODIGO_NOVO');
  });

  it('cai no texto genérico quando o código não está no mapa', () => {
    expect(mensagemDoErro('ALGUM_CODIGO_NOVO')).toBe(
      'Não conseguimos concluir. Tente de novo em alguns instantes.',
    );
  });

  it('aponta o envio em arquivo quando o Shop ainda não está liberado', () => {
    expect(mensagemDoErro('TIKTOK_SHOP_INDISPONIVEL')).toContain('arquivo');
  });
});
