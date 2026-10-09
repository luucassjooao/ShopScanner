import { describe, expect, it } from 'vitest';
import { avisoLimite, mensagemDoErro } from './textos';

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

  it('desvincular o único acesso diz o que fazer antes', () => {
    expect(mensagemDoErro('UNICO_ACESSO')).toBe(
      'Esse é o único jeito de entrar na sua conta. Defina uma senha antes de desvincular o Google.',
    );
  });

  it('troca de senha: senha atual incorreta tem texto próprio', () => {
    expect(mensagemDoErro('SENHA_ATUAL_INCORRETA')).toBe(
      'A senha atual não confere. Confira e tente de novo.',
    );
  });
});

describe('avisoLimite', () => {
  it('diz o tempo do Retry-After em segundos e em minutos, arredondando para cima', () => {
    expect(avisoLimite(30)).toBe('Muitas tentativas seguidas. Espere 30 segundos e tente de novo.');
    expect(avisoLimite(1)).toBe('Muitas tentativas seguidas. Espere 1 segundo e tente de novo.');
    expect(avisoLimite(120)).toBe('Muitas tentativas seguidas. Espere 2 minutos e tente de novo.');
    expect(avisoLimite(61)).toBe('Muitas tentativas seguidas. Espere 2 minutos e tente de novo.');
  });

  it('sem Retry-After, não inventa número', () => {
    expect(avisoLimite()).toBe('Muitas tentativas seguidas. Espere um pouco e tente de novo.');
  });
});
