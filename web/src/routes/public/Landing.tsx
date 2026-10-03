import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  ShieldCheck,
  SquarePlay,
  Tag,
  type LucideIcon,
} from 'lucide-react';
import { StatusBadge } from '@/components/dados';
import { Marca, RodapePublico } from '@/components/publico';
import { Button } from '@/components/ui/button';
import type { OrderStatus } from '@/api/schemas';
import { EMAIL_CONTATO, PRAZO_EXCLUSAO, VALOR_PLANO } from '@/lib/textos';

const PASSOS = [
  {
    titulo: 'Crie a conta com Google ou e-mail',
    texto:
      'Leva menos de um minuto: entre com o Google ou com nome, e-mail e senha. A conta é sua.',
  },
  {
    titulo: 'Conecte o TikTok',
    texto:
      'Já dentro do app, você autoriza a leitura dos seus vídeos na tela do próprio TikTok. Não publicamos nada no seu perfil.',
  },
  {
    titulo: 'Veja o que vende',
    texto: 'Comissões, vídeos e produtos organizados em um painel feito para a tela do celular.',
  },
];

const RECURSOS: { icone: LucideIcon; titulo: string; texto: string }[] = [
  {
    icone: CircleDollarSign,
    titulo: 'Comissões em um lugar só',
    // A origem não traz data de liquidação: nada de "data de cada pagamento" (CLAUDE.md).
    texto: 'Tudo o que já entrou, o que está a liquidar e o que ficou retido, pedido por pedido.',
  },
  {
    icone: SquarePlay,
    titulo: 'Vídeos que venderam',
    texto: 'Veja qual publicação gerou pedido, quanto rendeu e quantos dias continuou vendendo.',
  },
  {
    icone: Tag,
    titulo: 'Produtos que mais rendem',
    texto:
      'Ranking por comissão, por número de pedidos e por taxa de devolução, do mês ou do período que escolher.',
  },
  {
    icone: CalendarDays,
    titulo: 'Planejamento de conteúdo',
    texto: 'Uma agenda simples para organizar as próximas gravações a partir do que já deu certo.',
  },
];

const PERGUNTAS = [
  {
    p: 'Preciso pagar para usar?',
    r: `Você começa sem custo e acompanha as comissões do mês atual. O plano pago libera o histórico completo e os relatórios por período, por ${VALOR_PLANO}.`,
  },
  {
    p: 'O ShopScanner publica alguma coisa no meu perfil?',
    r: 'Não. A autorização que você concede é somente de leitura. Não publicamos vídeos, não comentamos e não enviamos mensagens.',
  },
  {
    p: 'Por quanto tempo vocês guardam os meus dados?',
    r: `Enquanto a sua conta existir. Se você desconectar o TikTok ou apagar a conta, removemos os seus dados em até ${PRAZO_EXCLUSAO}.`,
  },
  {
    p: 'Funciona bem no celular?',
    r: 'Sim. O painel foi desenhado primeiro para a tela do celular, que é onde a maior parte das creators acompanha as vendas.',
  },
  {
    p: 'Vocês têm alguma relação com o TikTok?',
    r: 'Não. O ShopScanner é um produto independente e não tem vínculo, patrocínio nem aprovação do TikTok.',
  },
];

/** Ilustração do painel na primeira dobra: é um exemplo, e diz isso. */
const EXEMPLO: { titulo: string; valor: string; status: OrderStatus }[] = [
  { titulo: 'Resenha do kit de skincare', valor: 'R$ 1.248,50', status: 'SETTLED' },
  { titulo: 'Look completo por menos de R$ 200', valor: 'R$ 962,40', status: 'TO_SETTLE' },
  { titulo: 'Testei o secador que viralizou', valor: 'R$ 517,00', status: 'AWAITING_PAYMENT' },
];
const BARRAS = [32, 48, 39, 61, 45, 70, 55, 84, 62, 90, 72, 96];

const secao = 'mx-auto w-full max-w-[1184px] px-4 lg:px-12';

export function Landing() {
  return (
    <div className="flex min-h-dvh flex-col bg-fundo">
      <header className="flex h-16 items-center justify-between border-b border-borda bg-superficie px-4 lg:h-[72px] lg:px-12">
        <Marca />
        <nav className="flex items-center gap-4 text-[15px] lg:gap-7">
          <a href="#recursos" className="hidden font-medium text-texto no-underline md:inline">
            Recursos
          </a>
          <a href="#como-funciona" className="hidden font-medium text-texto no-underline md:inline">
            Como funciona
          </a>
          <Link to="/entrar" className="font-semibold no-underline">
            Entrar
          </Link>
          <Button asChild size="sm" className="h-11">
            <Link to="/criar-conta" className="no-underline">
              Criar conta
            </Link>
          </Button>
        </nav>
      </header>

      <main>
        <section
          className={`${secao} grid items-center gap-10 py-12 lg:grid-cols-[544px_1fr] lg:gap-12 lg:pb-20 lg:pt-[76px]`}
        >
          <div className="flex flex-col gap-5">
            <span className="inline-flex h-[30px] items-center self-start rounded-full bg-pessego px-3.5 text-[13px] font-semibold text-texto">
              Para creators afiliadas do TikTok Shop
            </span>
            <h1 className="text-[30px] font-extrabold leading-tight tracking-tight text-texto lg:text-[32px]">
              Descubra quanto você realmente ganhou com as suas vendas
            </h1>
            <p className="text-base leading-relaxed text-texto-secundario">
              O ShopScanner reúne as suas comissões, os vídeos que geraram pedido e os produtos que
              mais rendem em um painel só. Você conecta a sua conta e acompanha tudo pelo celular.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Button asChild>
                <Link to="/criar-conta" className="no-underline">
                  Criar conta
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link to="/entrar" className="no-underline">
                  Já tenho conta
                </Link>
              </Button>
            </div>
            <p className="text-sm leading-normal text-texto-secundario">
              Lemos os seus dados só depois da sua autorização. Você desconecta e apaga tudo quando
              quiser.
            </p>
          </div>

          <figure
            aria-label="Exemplo do painel de comissões"
            className="flex flex-col gap-5 rounded-card border border-borda bg-superficie p-6 shadow-suave-lg"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-[15px] font-bold text-texto">Painel de comissões</span>
              <span className="inline-flex h-7 items-center rounded-full bg-fundo px-3 text-[13px] font-semibold text-texto-secundario">
                Exemplo
              </span>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-[13px] font-semibold text-texto-secundario">
                  Comissão do mês
                </span>
                <span className="text-[32px] font-extrabold tracking-tight text-texto">
                  R$ 4.318,90
                </span>
              </div>
              <span className="text-sm font-semibold text-status-liquidado">
                +18% sobre o mês anterior
              </span>
            </div>
            <div className="flex h-[104px] items-end gap-2 border-b border-borda pb-2" aria-hidden>
              {BARRAS.map((h, i) => (
                <span
                  key={i}
                  className={`flex-1 rounded-t ${i % 2 ? 'bg-coral' : 'bg-pessego'}`}
                  style={{ height: h }}
                />
              ))}
            </div>
            <div className="flex flex-col gap-2.5">
              <span className="text-[13px] font-bold text-texto-secundario">
                Vídeos que venderam
              </span>
              {EXEMPLO.map((e) => (
                <div key={e.titulo} className="flex flex-wrap items-center gap-3">
                  <span className="size-10 shrink-0 rounded-campo bg-pessego" aria-hidden />
                  <span className="min-w-0 flex-1 text-sm font-semibold text-texto">
                    {e.titulo}
                  </span>
                  <span className="text-sm font-bold text-texto">{e.valor}</span>
                  <StatusBadge status={e.status} />
                </div>
              ))}
            </div>
          </figure>
        </section>

        <section
          id="como-funciona"
          className={`${secao} flex scroll-mt-4 flex-col gap-9 py-14 lg:py-[72px]`}
        >
          <div className="flex max-w-[620px] flex-col gap-2.5">
            <h2 className="text-[26px] font-extrabold tracking-tight text-texto lg:text-[28px]">
              Como funciona
            </h2>
            <p className="text-base leading-relaxed text-texto-secundario">
              Três passos para ver o seu primeiro relatório. Nenhum deles mexe no seu perfil.
            </p>
          </div>
          <ol className="grid gap-6 md:grid-cols-3">
            {PASSOS.map((p, i) => (
              <li
                key={p.titulo}
                className="flex flex-col gap-3 rounded-card border border-borda bg-superficie p-7"
              >
                <span className="inline-flex size-10 items-center justify-center rounded-full bg-pessego text-base font-extrabold text-texto">
                  {i + 1}
                </span>
                <h3 className="text-lg font-bold text-texto">{p.titulo}</h3>
                <p className="text-[15px] leading-relaxed text-texto-secundario">{p.texto}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="recursos" className="scroll-mt-4 bg-superficie py-14 lg:py-[72px]">
          <div className={`${secao} flex flex-col gap-9`}>
            <div className="flex max-w-[620px] flex-col gap-2.5">
              <h2 className="text-[26px] font-extrabold tracking-tight text-texto lg:text-[28px]">
                Recursos
              </h2>
              <p className="text-base leading-relaxed text-texto-secundario">
                O básico bem feito: o dinheiro, o conteúdo e o produto, cada um no seu lugar.
              </p>
            </div>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {RECURSOS.map(({ icone: Icone, titulo, texto }) => (
                <li key={titulo} className="flex flex-col gap-3 rounded-card bg-fundo p-6">
                  <Icone className="size-7 text-acao" aria-hidden />
                  <h3 className="text-[17px] font-bold text-texto">{titulo}</h3>
                  <p className="text-[15px] leading-relaxed text-texto-secundario">{texto}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={`${secao} py-14 lg:py-[72px]`}>
          <div className="flex flex-col gap-6 rounded-card border border-borda bg-superficie px-6 py-8 lg:flex-row lg:gap-8 lg:px-10 lg:py-9">
            <span className="inline-flex size-14 shrink-0 items-center justify-center rounded-card bg-pessego">
              <ShieldCheck className="size-7 text-apoio" aria-hidden />
            </span>
            <div className="flex flex-col gap-3.5">
              <h2 className="text-2xl font-extrabold tracking-tight text-texto">
                Os seus dados ficam sob o seu controle
              </h2>
              <div className="grid gap-4 text-[15px] leading-relaxed text-texto-secundario md:grid-cols-2 md:gap-x-7">
                <p>
                  Só lemos as suas informações depois que você autoriza o acesso na sua própria
                  conta do TikTok.
                </p>
                <p>
                  Nunca publicamos, comentamos nem enviamos mensagens em seu nome. A autorização é
                  apenas de leitura.
                </p>
                <p>
                  Nunca pedimos a sua senha do TikTok. A conexão é autorizada no próprio TikTok e
                  pode ser desligada a qualquer momento, sem apagar a sua conta.
                </p>
                <p>
                  Você pode apagar a sua conta e todos os seus dados a qualquer momento, direto nas
                  configurações.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-superficie py-14 lg:py-[72px]">
          <div className={`${secao} flex flex-col gap-8 lg:flex-row lg:gap-16`}>
            <div className="flex flex-col gap-2.5 lg:w-80 lg:shrink-0">
              <h2 className="text-[26px] font-extrabold tracking-tight text-texto lg:text-[28px]">
                Perguntas frequentes
              </h2>
              <p className="text-base leading-relaxed text-texto-secundario">
                Ficou alguma dúvida? Escreva para{' '}
                <a href={`mailto:${EMAIL_CONTATO}`} className="font-semibold">
                  {EMAIL_CONTATO}
                </a>
                .
              </p>
            </div>
            <div className="flex flex-1 flex-col gap-3">
              {PERGUNTAS.map((q, i) => (
                <details
                  key={q.p}
                  open={i === 0}
                  className="group rounded-card bg-fundo px-[22px] py-[18px]"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-bold text-texto [&::-webkit-details-marker]:hidden">
                    {q.p}
                    <ChevronDown
                      className="size-5 shrink-0 transition-transform group-open:rotate-180"
                      aria-hidden
                    />
                  </summary>
                  <p className="pt-3 text-[15px] leading-relaxed text-texto-secundario">{q.r}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-pessego py-12 lg:py-16">
          <div className={secao}>
            <div className="flex flex-col items-start gap-6 rounded-card bg-superficie px-6 py-9 lg:flex-row lg:items-center lg:gap-10 lg:px-12 lg:py-10">
              <div className="flex flex-1 flex-col gap-2.5">
                <h2 className="text-2xl font-extrabold tracking-tight text-texto lg:text-[28px]">
                  Comece a acompanhar as suas comissões hoje
                </h2>
                <p className="text-base leading-relaxed text-texto-secundario">
                  Criar a conta é grátis e você já vê o mês atual assim que conectar o TikTok.
                </p>
              </div>
              <Button asChild size="lg" className="shrink-0">
                <Link to="/criar-conta" className="no-underline">
                  Criar conta <ArrowRight aria-hidden />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <RodapePublico completo />
    </div>
  );
}
