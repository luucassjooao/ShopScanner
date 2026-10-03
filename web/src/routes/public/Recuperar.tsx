import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { LockKeyhole, MailCheck } from 'lucide-react';
import { ApiError } from '@/api/client';
import { useForgotPassword } from '@/api/queries';
import { BotaoGoogle, LogoGoogle, TopoPublico } from '@/components/publico';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatData, formatHora } from '@/lib/format';
import { VALIDADE_LINK } from '@/lib/textos';

export function Recuperar() {
  const enviar = useForgotPassword();
  const [email, setEmail] = useState('');
  const [enviadoEm, setEnviadoEm] = useState<Date | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  function pedir(e?: FormEvent) {
    e?.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErro('Informe um e-mail válido.');
    setErro(null);
    enviar.mutate({ email: email.trim() }, { onSuccess: () => setEnviadoEm(new Date()) });
  }

  // Proposta de contrato: 409 `GOOGLE_ONLY` quando a conta só entra pelo Google.
  const soGoogle = enviar.error instanceof ApiError && enviar.error.serverCode === 'GOOGLE_ONLY';

  return (
    <div className="flex min-h-dvh flex-col bg-fundo">
      <TopoPublico>
        <Link to="/entrar" className="font-semibold no-underline">
          Entrar
        </Link>
      </TopoPublico>
      <main className="flex flex-1 items-start justify-center px-4 py-10 lg:items-center">
        <div className="flex w-full max-w-[460px] flex-col gap-[18px] rounded-card border border-borda bg-superficie p-6 shadow-suave lg:p-9">
          <span
            className={
              soGoogle
                ? 'inline-flex size-[52px] items-center justify-center rounded-card border border-borda bg-superficie'
                : 'inline-flex size-[52px] items-center justify-center rounded-card bg-pessego'
            }
          >
            {soGoogle ? (
              <LogoGoogle className="size-[26px]" />
            ) : enviadoEm ? (
              <MailCheck className="size-[26px] text-apoio" aria-hidden />
            ) : (
              <LockKeyhole className="size-[26px] text-apoio" aria-hidden />
            )}
          </span>

          {soGoogle ? (
            <>
              <div className="flex flex-col gap-2">
                <h1 className="text-[26px] font-extrabold tracking-tight text-texto">
                  Esse e-mail entra pelo Google
                </h1>
                <p className="text-base leading-relaxed text-texto-secundario">
                  A conta de <strong className="text-texto">{email.trim()}</strong> foi criada com o
                  Google, então não existe senha para recuperar.
                </p>
              </div>
              <BotaoGoogle />
              <p className="rounded-campo bg-fundo p-4 text-sm leading-relaxed text-texto-secundario">
                Quer entrar também com e-mail e senha? Depois de entrar, defina uma senha em
                Configurações.
              </p>
              <Button
                variant="link"
                className="h-auto self-start px-0"
                onClick={() => enviar.reset()}
              >
                Usar outro e-mail
              </Button>
            </>
          ) : enviadoEm ? (
            <>
              <div className="flex flex-col gap-2">
                <h1 className="text-[26px] font-extrabold tracking-tight text-texto">
                  Confira o seu e-mail
                </h1>
                <p className="text-base leading-relaxed text-texto-secundario">
                  Enviamos um link de recuperação para{' '}
                  <strong className="text-texto">{email.trim()}</strong>. Abra o link para criar uma
                  senha nova.
                </p>
              </div>
              <div className="flex flex-col gap-1 rounded-campo bg-fundo p-4 text-sm text-texto-secundario">
                <span className="font-semibold text-texto">
                  Enviado em {formatData(enviadoEm)}, às {formatHora(enviadoEm)}
                </span>
                <span>
                  O link vale por {VALIDADE_LINK}. Se não encontrar a mensagem, verifique a caixa de
                  spam.
                </span>
              </div>
              <Button variant="secondary" disabled={enviar.isPending} onClick={() => pedir()}>
                {enviar.isPending ? 'Reenviando…' : 'Reenviar o link'}
              </Button>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <h1 className="text-[26px] font-extrabold tracking-tight text-texto">
                  Recuperar a senha
                </h1>
                <p className="text-base leading-relaxed text-texto-secundario">
                  Informe o e-mail da sua conta. Enviamos um link para você criar uma senha nova.
                </p>
              </div>
              <form noValidate onSubmit={pedir} className="flex flex-col gap-[18px]">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="email" className="text-sm font-semibold text-texto">
                    E-mail
                  </label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="voce@email.com.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                {erro || enviar.error ? (
                  <p role="alert" className="text-sm text-status-reembolsado">
                    {erro ?? enviar.error?.message}
                  </p>
                ) : null}
                <Button type="submit" disabled={enviar.isPending}>
                  {enviar.isPending ? 'Enviando…' : 'Enviar link de recuperação'}
                </Button>
              </form>
            </>
          )}

          <Link to="/entrar" className="self-center text-[15px] font-semibold">
            Voltar para entrar
          </Link>
        </div>
      </main>
    </div>
  );
}
