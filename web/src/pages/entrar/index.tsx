import { Link, useNavigate, useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ApiError } from '@/api/client';
import { useLogin } from '@/api/queries';
import { destinoInterno, PARAM_DESTINO, ROTA_LOGADO } from '@/auth/guarda';
import {
  BotaoGoogle,
  CampoSenha,
  CartaoAcesso,
  LayoutAcesso,
  ListaComChecks,
  Separador,
} from '@/components/publico';
import { avisoLimite, mensagemDoErro } from '@/lib/textos';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const formulario = z.object({
  email: z.email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe a sua senha.'),
});
type Formulario = z.infer<typeof formulario>;

const erroTexto = 'text-[13px] text-status-reembolsado';

export function Entrar() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const login = useLogin();
  // Para onde voltar depois de entrar: a página que o guarda interrompeu. Vem da URL, e não
  // do estado da navegação, porque o `redirect()` do loader não carrega estado — e porque
  // assim sobrevive a um recarregar. Só caminho interno: ver `destinoInterno`.
  const destino = destinoInterno(params.get(PARAM_DESTINO)) ?? ROTA_LOGADO;
  // Vem do callback do Google ou de a sessão vencer no meio de uma conexão.
  const erroDaUrl = params.get('erro');
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Formulario>({ resolver: zodResolver(formulario) });

  // 429 não é senha errada: dizer "não conferem" para quem acertou mentiria para a pessoa.
  const falha =
    login.error instanceof ApiError && login.error.code === 'limitado'
      ? avisoLimite(login.error.retryAfterSegundos)
      : login.error instanceof ApiError &&
          (login.error.code === 'nao_autenticado' || login.error.code === 'invalido')
        ? 'E-mail ou senha não conferem.'
        : (login.error?.message ?? (erroDaUrl ? mensagemDoErro(erroDaUrl) : undefined));

  return (
    <LayoutAcesso
      lateral={
        <>
          <h1 className="text-[30px] font-extrabold leading-tight tracking-tight text-texto">
            Bem-vinda de volta
          </h1>
          <p className="text-base leading-relaxed text-texto">
            Entre para ver as comissões do mês, os vídeos que venderam e os produtos que mais
            renderam.
          </p>
          <ListaComChecks
            itens={[
              'A conta é sua: entre com e-mail e senha ou com o Google',
              'O TikTok você conecta depois, lá dentro, só para leitura',
              'Desconectar o TikTok não apaga a sua conta',
            ]}
          />
        </>
      }
    >
      <CartaoAcesso>
        <div className="flex flex-col gap-1.5">
          <h2 className="text-2xl font-extrabold tracking-tight text-texto">Entrar</h2>
          <p className="text-sm text-texto-secundario lg:hidden">
            Entre para ver as comissões do mês e os vídeos que venderam.
          </p>
        </div>
        <BotaoGoogle />
        <Separador />
        <form
          noValidate
          className="flex flex-col gap-[18px]"
          onSubmit={handleSubmit((v) =>
            login.mutate(v, { onSuccess: () => navigate(destino, { replace: true }) }),
          )}
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-semibold text-texto">
              E-mail
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="voce@email.com.br"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-erro' : undefined}
              {...register('email')}
            />
            {errors.email ? (
              <span id="email-erro" className={erroTexto}>
                {errors.email.message}
              </span>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <CampoSenha
              id="senha"
              rotulo="Senha"
              autoComplete="current-password"
              placeholder="Sua senha"
              aria-invalid={!!errors.password}
              {...register('password')}
            />
            {errors.password ? <span className={erroTexto}>{errors.password.message}</span> : null}
            <Link to="/recuperar" className="self-start text-sm font-semibold">
              Esqueci a minha senha
            </Link>
          </div>
          {falha ? (
            <p role="alert" className="text-sm text-status-reembolsado">
              {falha}
            </p>
          ) : null}
          <Button type="submit" disabled={login.isPending}>
            {login.isPending ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>
        <p className="text-center text-[15px] text-texto-secundario">
          Ainda não tem conta?{' '}
          <Link to="/criar-conta" className="font-bold">
            Criar conta
          </Link>
        </p>
      </CartaoAcesso>
    </LayoutAcesso>
  );
}
