import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { useRegister } from '@/api/queries';
import { sessionQuery } from '@/api/session';
import {
  BotaoGoogle,
  CampoSenha,
  CartaoAcesso,
  LayoutAcesso,
  Separador,
} from '@/components/publico';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { forcaDaSenha, ROTULO_FORCA } from '@/lib/senha';
import { VERSAO_TERMOS } from '@/lib/textos';
import { cn } from '@/lib/utils';

const formulario = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Como podemos te chamar?')
    .min(2, 'O nome precisa ter pelo menos 2 letras.'),
  email: z.email('Informe um e-mail válido.'),
  password: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.'),
  aceite: z.literal(true, { error: 'Para criar a conta, aceite os Termos e a Política.' }),
});
type Formulario = z.input<typeof formulario>;

const erroTexto = 'text-[13px] text-status-reembolsado';
/** Cor de cada nível de força (0 a 4), nos tokens de status. */
const COR_FORCA = [
  'bg-status-reembolsado',
  'bg-status-reembolsado',
  'bg-status-a-liquidar',
  'bg-status-liquidado',
  'bg-status-liquidado',
];
const TEXTO_FORCA = [
  'text-status-reembolsado',
  'text-status-reembolsado',
  'text-status-a-liquidar',
  'text-status-liquidado',
  'text-status-liquidado',
];

const PASSOS = [
  'Crie a conta com o Google ou com e-mail',
  'Conecte o TikTok e autorize a leitura',
  'Veja o painel do mês atual',
];

export function CriarConta() {
  const sessao = useQuery(sessionQuery);
  const navigate = useNavigate();
  const criar = useRegister();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<Formulario>({ resolver: zodResolver(formulario) });
  const senha = watch('password') ?? '';
  const aceitou = watch('aceite') === true;
  const forca = forcaDaSenha(senha);

  if (sessao.data && !criar.isSuccess) return <Navigate to="/inicio" replace />;

  return (
    <LayoutAcesso
      lateral={
        <>
          <h1 className="text-[30px] font-extrabold leading-tight tracking-tight text-texto">
            Crie a sua conta em um minuto
          </h1>
          <p className="text-base leading-relaxed text-texto">
            Depois é só conectar o TikTok para o painel começar a carregar as suas comissões.
          </p>
          <ol className="flex flex-col gap-3.5">
            {PASSOS.map((p, i) => (
              <li key={p} className="flex items-center gap-3 text-[15px] text-texto">
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-superficie text-sm font-extrabold text-texto">
                  {i + 1}
                </span>
                {p}
              </li>
            ))}
          </ol>
        </>
      }
    >
      <CartaoAcesso>
        <div className="flex flex-col gap-1.5">
          <h2 className="text-2xl font-extrabold tracking-tight text-texto">Criar conta</h2>
          <p className="text-sm text-texto-secundario">
            Leva menos de um minuto. O TikTok você conecta depois, já dentro do app.
          </p>
        </div>
        {/* O aceite vale para os dois caminhos, por isso fica acima do Google e do formulário. */}
        <div
          className={cn(
            'flex flex-col gap-1.5 rounded-campo border p-3.5',
            aceitou ? 'border-borda' : 'border-acao',
          )}
        >
          <div className="flex items-start gap-2.5">
            <input
              id="aceite"
              type="checkbox"
              className="mt-0.5 size-5 shrink-0 accent-acao"
              aria-describedby="aceite-dica"
              {...register('aceite')}
            />
            <label htmlFor="aceite" className="text-sm leading-relaxed text-texto">
              Li e aceito os <Link to="/termos">Termos de Uso</Link> e a{' '}
              <Link to="/privacidade">Política de Privacidade</Link>.
            </label>
          </div>
          <span id="aceite-dica" className="pl-[30px] text-[13px] text-texto-secundario">
            {aceitou
              ? 'Vale para os dois caminhos: Google ou e-mail.'
              : 'Marque o aceite para liberar o Google e o formulário.'}
          </span>
        </div>
        <BotaoGoogle disabled={!aceitou} />
        <Separador />
        <form
          noValidate
          className="flex flex-col gap-[18px]"
          onSubmit={handleSubmit(({ name, email, password }) =>
            criar.mutate(
              { name, email, password, acceptedTermsVersion: VERSAO_TERMOS },
              { onSuccess: () => navigate('/inicio-rapido', { replace: true }) },
            ),
          )}
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="nome" className="text-sm font-semibold text-texto">
              Nome
            </label>
            <Input
              id="nome"
              autoComplete="name"
              placeholder="Como podemos te chamar"
              {...register('name')}
            />
            {errors.name ? <span className={erroTexto}>{errors.name.message}</span> : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-semibold text-texto">
              E-mail
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="voce@email.com.br"
              {...register('email')}
            />
            {errors.email ? <span className={erroTexto}>{errors.email.message}</span> : null}
          </div>
          <div className="flex flex-col gap-2">
            <CampoSenha
              id="senha"
              rotulo="Senha"
              autoComplete="new-password"
              placeholder="Crie uma senha"
              aria-describedby="forca-senha"
              {...register('password')}
            />
            <div className="flex gap-1.5" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={cn(
                    'h-1 flex-1 rounded-full',
                    senha && i < forca ? COR_FORCA[forca] : 'bg-borda',
                  )}
                />
              ))}
            </div>
            <span
              id="forca-senha"
              className={cn('text-[13px]', senha ? TEXTO_FORCA[forca] : 'text-texto-secundario')}
            >
              {senha
                ? `Força da senha: ${ROTULO_FORCA[forca]}`
                : 'Use ao menos 8 caracteres, com letra maiúscula, número e símbolo.'}
            </span>
            {errors.password ? <span className={erroTexto}>{errors.password.message}</span> : null}
          </div>
          {criar.error ? (
            <p role="alert" className="text-sm text-status-reembolsado">
              {criar.error.message}
            </p>
          ) : null}
          <Button type="submit" disabled={!aceitou || criar.isPending}>
            {criar.isPending ? 'Criando…' : 'Criar conta'}
          </Button>
        </form>
        <p className="text-center text-[15px] text-texto-secundario">
          Já tem conta?{' '}
          <Link to="/entrar" className="font-bold">
            Entrar
          </Link>
        </p>
      </CartaoAcesso>
    </LayoutAcesso>
  );
}
