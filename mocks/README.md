# mocks/

JSONs simulados no **formato cru da API do TikTok**. Não editar à mão.

Quem lê estes arquivos é `src/mocks/adapters/`, que converte para o contrato do backend
antes de os handlers do MSW responderem. Assim, quando o backend real existir, basta
apontar `VITE_API_URL` para ele e desligar o MSW — nenhuma tela muda.
