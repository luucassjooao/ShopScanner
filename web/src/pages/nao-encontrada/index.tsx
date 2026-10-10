import { Link } from 'react-router';

/** Rota que não existe. Fora das cascas: não há menu nem sessão para mostrar aqui. */
export function NaoEncontrada() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-fundo p-6 text-center">
      <h1 className="text-[26px] font-extrabold tracking-tight text-texto">
        Esta página não existe
      </h1>
      <p className="text-texto-secundario">O endereço pode ter mudado ou estar incompleto.</p>
      <Link to="/" className="font-semibold">
        Voltar para o início
      </Link>
    </main>
  );
}
