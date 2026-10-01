import type { Usuario } from '../repositories/users.ts';

declare module 'fastify' {
  interface FastifyRequest {
    /** Preenchido pelo middleware `exigirSessao`; nulo nas rotas públicas. */
    autenticado: { usuario: Usuario; sessionId: string } | null;
  }
}
