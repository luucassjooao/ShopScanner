/**
 * Erro que pode virar resposta HTTP. Tudo que não for AppError vira 500 genérico:
 * stack, mensagem do Postgres e nome de coluna nunca saem para o cliente.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
  }

  static naoEncontrado(message = 'Não encontrado') {
    return new AppError(404, 'NAO_ENCONTRADO', message);
  }

  static validacao(message = 'Dados inválidos') {
    return new AppError(400, 'VALIDACAO', message);
  }
}
