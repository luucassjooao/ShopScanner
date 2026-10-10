import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { prepararAmbiente } from './bootstrap';

// O `then` é a única coisa aqui que não é renderização, e é de propósito: o MSW tem de
// interceptar antes do primeiro render. Ver `bootstrap.ts`.
void prepararAmbiente().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
