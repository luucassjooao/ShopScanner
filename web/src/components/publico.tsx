import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CircleCheck, Eye, EyeOff } from 'lucide-react';
import { entrarComGoogle } from '@/api/queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EMAIL_CONTATO } from '@/lib/textos';
import { cn } from '@/lib/utils';

/** Peças das páginas públicas: marca, topo simples e rodapé. */

export function Marca({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('text-xl font-extrabold tracking-tight no-underline', className)}>
      <span className="text-texto">Shop</span>
      <span className="text-acao">Scanner</span>
    </Link>
  );
}

export function TopoPublico({ children }: { children?: ReactNode }) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-borda bg-superficie px-4 lg:h-[72px] lg:px-12">
      <Marca />
      {children ? (
        <nav className="flex items-center gap-4 text-[15px] lg:gap-7">{children}</nav>
      ) : null}
    </header>
  );
}

export function RodapePublico({ completo = false }: { completo?: boolean }) {
  return (
    <footer className="border-t border-borda bg-superficie px-4 py-8 lg:px-12">
      <div className="mx-auto flex max-w-[1184px] flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        {completo ? (
          <div className="flex flex-col gap-2">
            <Marca />
            <p className="text-sm text-texto-secundario">
              BI de comissões para creators afiliadas do TikTok Shop no Brasil.
            </p>
          </div>
        ) : null}
        <div className="flex flex-col gap-3 lg:items-end">
          <nav aria-label="Rodapé" className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
            <Link to="/termos">Termos de Uso</Link>
            <Link to="/privacidade">Política de Privacidade</Link>
            <a href={`mailto:${EMAIL_CONTATO}`}>Contato</a>
          </nav>
          <p className="text-[13px] text-texto-secundario">
            Não temos vínculo com o TikTok. TikTok e TikTok Shop são marcas dos seus respectivos
            titulares.
          </p>
          <p className="text-[13px] text-texto-secundario">© 2026 ShopScanner</p>
        </div>
      </div>
    </footer>
  );
}

export interface SecaoLegal {
  id: string;
  titulo: string;
  conteudo: ReactNode;
}

/** Termos e Privacidade: índice lateral no desktop, recolhido no celular. */
export function PaginaLegal({
  titulo,
  atualizadoEm,
  intro,
  secoes,
  outra,
}: {
  titulo: string;
  atualizadoEm: string;
  intro: string;
  secoes: SecaoLegal[];
  outra: { para: string; rotulo: string };
}) {
  const indice = (
    <ol className="flex flex-col gap-3">
      {secoes.map((s) => (
        <li key={s.id}>
          <a
            href={`#${s.id}`}
            className="block border-l-[3px] border-borda pl-3 text-[15px] leading-snug text-texto no-underline hover:border-acao hover:text-acao"
          >
            {s.titulo}
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <div className="flex min-h-dvh flex-col bg-fundo">
      <TopoPublico>
        <Link to={outra.para} className="hidden font-medium text-texto no-underline sm:inline">
          {outra.rotulo}
        </Link>
        <Link to="/entrar" className="font-semibold no-underline">
          Entrar
        </Link>
      </TopoPublico>

      <div className="mx-auto flex w-full max-w-[1184px] flex-1 flex-col gap-8 px-4 pb-16 pt-8 lg:flex-row lg:items-start lg:gap-14 lg:px-12 lg:pt-14">
        <nav
          aria-label="Índice da página"
          className="hidden w-[268px] shrink-0 flex-col gap-3 rounded-card border border-borda bg-superficie p-[22px] lg:sticky lg:top-6 lg:flex"
        >
          <span className="text-[13px] font-bold uppercase tracking-wider text-texto-secundario">
            Nesta página
          </span>
          {indice}
        </nav>

        <main className="flex max-w-[760px] flex-1 flex-col gap-7">
          <div className="flex flex-col gap-3">
            <span className="inline-flex h-7 items-center self-start rounded-full bg-pessego px-3 text-[13px] font-semibold text-texto">
              {atualizadoEm}
            </span>
            <h1 className="text-[28px] font-extrabold tracking-tight text-texto lg:text-[32px]">
              {titulo}
            </h1>
            <p className="text-base leading-[1.7] text-texto-secundario">{intro}</p>
          </div>

          <details className="rounded-card border border-borda bg-superficie p-4 lg:hidden">
            <summary className="cursor-pointer text-[13px] font-bold uppercase tracking-wider text-texto-secundario">
              Nesta página
            </summary>
            <div className="pt-3">{indice}</div>
          </details>

          {secoes.map((s) => (
            <section key={s.id} id={s.id} className="flex scroll-mt-6 flex-col gap-2.5">
              <h2 className="text-xl font-bold text-texto lg:text-[22px]">{s.titulo}</h2>
              <div className="flex flex-col gap-2.5 text-base leading-[1.75] text-texto-secundario">
                {s.conteudo}
              </div>
            </section>
          ))}
        </main>
      </div>

      <RodapePublico />
    </div>
  );
}

/** Entrar e Criar conta: lateral pêssego no desktop, formulário centralizado. */
export function LayoutAcesso({ lateral, children }: { lateral: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-fundo lg:flex-row">
      <aside className="hidden w-[520px] shrink-0 flex-col gap-6 bg-pessego px-14 pb-12 pt-14 lg:flex">
        <Marca />
        {lateral}
        <p className="mt-auto text-sm leading-relaxed text-texto">
          Não temos vínculo com o TikTok.
        </p>
      </aside>
      <header className="flex h-16 items-center border-b border-borda bg-superficie px-4 lg:hidden">
        <Marca />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-8 lg:items-center lg:p-10">
        {children}
      </main>
    </div>
  );
}

export function ListaComChecks({ itens }: { itens: string[] }) {
  return (
    <ul className="flex flex-col gap-3.5">
      {itens.map((t) => (
        <li key={t} className="flex items-start gap-3 text-[15px] leading-normal text-texto">
          <CircleCheck className="mt-0.5 size-5 shrink-0 text-apoio" aria-hidden />
          {t}
        </li>
      ))}
    </ul>
  );
}

/** Campo de senha com o botão de mostrar e ocultar. */
export const CampoSenha = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { rotulo: string }
>(function CampoSenha({ rotulo, id, ...props }, ref) {
  const [visivel, setVisivel] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-texto">
        {rotulo}
      </label>
      <div className="relative">
        <Input
          ref={ref}
          id={id}
          type={visivel ? 'text' : 'password'}
          className="pr-[52px]"
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          aria-label="Mostrar ou ocultar a senha"
          aria-pressed={visivel}
          className="absolute right-0.5 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-campo text-texto-secundario hover:text-texto"
        >
          {visivel ? (
            <EyeOff className="size-5" aria-hidden />
          ) : (
            <Eye className="size-5" aria-hidden />
          )}
        </button>
      </div>
    </div>
  );
});

/** Cartão do formulário de acesso. */
export function CartaoAcesso({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full max-w-[420px] flex-col gap-[18px] rounded-card border border-borda bg-superficie p-6 shadow-suave lg:p-8">
      {children}
    </div>
  );
}

export function Separador() {
  return (
    <div className="flex items-center gap-3" aria-hidden>
      <span className="h-px flex-1 bg-borda" />
      <span className="text-[13px] font-semibold text-texto-secundario">ou</span>
      <span className="h-px flex-1 bg-borda" />
    </div>
  );
}

/** Logotipo do Google nas cores originais. */
export function LogoGoogle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className={className}>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

/** Botão neutro do Google: mesma altura e canto do primário, nunca coral. */
export function BotaoGoogle({ disabled }: { disabled?: boolean }) {
  return (
    <Button variant="outline" disabled={disabled} onClick={() => entrarComGoogle()}>
      <LogoGoogle /> Continuar com Google
    </Button>
  );
}
