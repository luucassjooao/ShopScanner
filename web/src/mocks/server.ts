import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/** MSW para os testes (Node). No navegador, ./browser. */
export const server = setupServer(...handlers);
