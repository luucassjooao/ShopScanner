import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { Check, CircleCheck, Link2, Store, Target } from 'lucide-react';
import { useGoals, useLogout, useSaveGoal, useStartTiktokConnection } from '@/api/queries';
import { useSessaoViva } from '@/auth/guarda';
import { PainelImport } from '@/components/import';
import { TopoPublico } from '@/components/publico';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDecimal, formatMoeda, parseMoeda } from '@/lib/format';
import { cn } from '@/lib/utils';
import { AceiteTermos } from '@/components/AceiteTermos';
import { hojeSP, useFiltros } from '@/lib/filtros';

const PASSOS = ['Conectar o TikTok', 'Conectar o TikTok Shop', 'Definir a meta do mês'];
const SUGESTOES = ['2000.00', '5000.00', '10000.00'];

/**
 * Passos deixados para depois, por conta e por aparelho. Nenhum passo é obrigatório, então
 * isso é conveniência de quem está aqui, não dado da conta: vive no `localStorage` e, se ele
 * falhar (aba privada), os passos voltam a aparecer como simplesmente opcionais.
 */
const chaveAdiados = (userId: string) => `shopscanner:inicio-rapido:${userId}`;

function lerAdiados(userId: string | undefined): number[] {
  if (!userId) return [];
  try {
    const bruto: unknown = JSON.parse(localStorage.getItem(chaveAdiados(userId)) ?? '[]');
    return Array.isArray(bruto) ? bruto.filter((n): n is number => typeof n === 'number') : [];
  } catch {
    return [];
  }
}

function gravarAdiados(userId: string, passos: number[]) {
  try {
    localStorage.setItem(chaveAdiados(userId), JSON.stringify(passos));
  } catch {
    // sem armazenamento: segue sem lembrar
  }
}

/**
 * Onboarding em três passos, todos opcionais: a conta já existe antes deles.
 * O passo fica na URL (`?passo=2`) para sobreviver à volta do TikTok.
 */
export function InicioRapido() {
  const sessao = useSessaoViva();
  const f = useFiltros();
  const logout = useLogout();
  const navigate = useNavigate();
  const passo = Math.min(3, Math.max(1, Number(f.get('passo')) || 1));
  const ir = (n: number) => f.set({ passo: String(n) });
  const userId = sessao.data?.user.id;
  const [adiados, setAdiados] = useState<number[]>(() => lerAdiados(userId));
  // A sessão chega depois do primeiro render: relê quando o id aparece.
  const [lidoDe, setLidoDe] = useState(userId);
  if (userId !== lidoDe) {
    setLidoDe(userId);
    setAdiados(lerAdiados(userId));
  }
  const adiar = (n: number) => {
    const novos = adiados.includes(n) ? adiados : [...adiados, n];
    setAdiados(novos);
    if (userId) gravarAdiados(userId, novos);
    if (n < 3) ir(n + 1);
    else navigate('/inicio');
  };
  const conta = sessao.data?.accounts[0];
  const feitos = [!!conta, !!conta?.shopConnected, false];

  return (
    <div className="flex min-h-dvh flex-col bg-fundo">
      <AceiteTermos />
      <TopoPublico>
        <Link to="/inicio" className="font-semibold no-underline">
          Ir para o painel
        </Link>
        <button
          type="button"
          className="font-semibold text-acao"
          onClick={() => logout.mutate(undefined, { onSettled: () => navigate('/entrar') })}
        >
          Sair
        </button>
      </TopoPublico>
      <main className="mx-auto flex w-full max-w-[868px] flex-col gap-7 px-4 py-8 lg:gap-9 lg:px-6 lg:py-12">
        <div className="flex items-start gap-3 rounded-card border border-borda bg-status-liquidado-suave px-4 py-3.5">
          <CircleCheck className="mt-0.5 size-5 shrink-0 text-status-liquidado" aria-hidden />
          <p className="text-[15px] leading-relaxed text-texto">
            <strong>A sua conta está criada.</strong> Os passos abaixo deixam o painel completo, mas
            nenhum é obrigatório.
          </p>
        </div>
        <div className="flex flex-col gap-2.5">
          <h1 className="text-[28px] font-extrabold tracking-tight text-texto lg:text-[30px]">
            Início rápido
          </h1>
          <p className="text-base leading-relaxed text-texto-secundario">
            Faça agora, deixe para depois ou volte aqui quando quiser, em Configurações.
          </p>
        </div>

        <ol className="grid gap-3 sm:grid-cols-3">
          {PASSOS.map((rotulo, i) => {
            const n = i + 1;
            const atual = n === passo;
            const feito = feitos[i];
            const estado = feito
              ? 'Feito'
              : adiados.includes(n)
                ? 'Para depois'
                : atual
                  ? 'Agora · opcional'
                  : 'Opcional';
            return (
              <li key={rotulo}>
                <button
                  type="button"
                  aria-current={atual ? 'step' : undefined}
                  onClick={() => ir(n)}
                  className={cn(
                    'flex min-h-16 w-full items-center gap-3 rounded-card border-[1.5px] px-4 py-3 text-left',
                    atual ? 'border-acao bg-superficie' : 'border-borda bg-fundo',
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex size-[30px] shrink-0 items-center justify-center rounded-full text-sm font-extrabold',
                      feito
                        ? 'bg-status-liquidado text-white'
                        : atual
                          ? 'bg-acao text-white'
                          : 'bg-borda text-texto-secundario',
                    )}
                  >
                    {feito ? <Check className="size-4" aria-hidden /> : n}
                  </span>
                  <span className="flex flex-col">
                    <span
                      className={cn(
                        'text-[15px] font-bold leading-snug',
                        atual ? 'text-texto' : 'text-texto-secundario',
                      )}
                    >
                      {rotulo}
                    </span>
                    <span
                      className={cn(
                        'text-[13px] font-semibold',
                        feito
                          ? 'text-status-liquidado'
                          : atual
                            ? 'text-acao'
                            : 'text-texto-secundario',
                      )}
                    >
                      {estado}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <section className="flex flex-col gap-[22px] rounded-card border border-borda bg-superficie p-6 lg:px-10 lg:py-9">
          {!sessao.data ? (
            <Skeleton className="h-48" />
          ) : passo === 1 ? (
            <PassoTiktok conectado={feitos[0]} onProximo={() => ir(2)} onDepois={() => adiar(1)} />
          ) : passo === 2 ? (
            <PassoShop
              accountId={conta?.id}
              conectado={feitos[1]}
              onProximo={() => ir(3)}
              onDepois={() => adiar(2)}
              onVoltar={() => ir(1)}
            />
          ) : (
            <PassoMeta accountId={conta?.id} onDepois={() => adiar(3)} onVoltar={() => ir(2)} />
          )}
        </section>
      </main>
    </div>
  );
}

function Cabeca({
  icone: Icone,
  titulo,
  extra,
  texto,
}: {
  icone: typeof Link2;
  titulo: string;
  extra?: ReactNode;
  texto: string;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:gap-5">
      <span className="inline-flex size-[52px] shrink-0 items-center justify-center rounded-card bg-pessego">
        <Icone className="size-6 text-apoio" aria-hidden />
      </span>
      <div className="flex flex-col gap-2">
        <h2 className="flex flex-wrap items-center gap-3 text-2xl font-extrabold tracking-tight text-texto">
          {titulo}
          {extra}
        </h2>
        <p className="text-base leading-[1.7] text-texto-secundario">{texto}</p>
      </div>
    </div>
  );
}

const botoes = 'flex flex-wrap items-center gap-3 sm:gap-4';

function PassoTiktok({
  conectado,
  onProximo,
  onDepois,
}: {
  conectado: boolean;
  onProximo: () => void;
  onDepois: () => void;
}) {
  const conectar = useStartTiktokConnection();
  return (
    <>
      <Cabeca
        icone={Link2}
        titulo="Conecte o TikTok para ler os vídeos"
        extra={<Badge variant="liquidado">Disponível</Badge>}
        texto="Você autoriza na tela do próprio TikTok. Nunca pedimos a sua senha do TikTok, e a conexão pode ser desligada quando você quiser, sem apagar a sua conta."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-card border border-borda bg-fundo px-5 py-[18px]">
          <span className="text-sm font-bold text-texto">O que lemos</span>
          <span className="text-[15px] leading-relaxed text-texto-secundario">
            Perfil público e as suas publicações com views, curtidas, comentários e
            compartilhamentos.
          </span>
        </div>
        <div className="flex flex-col gap-2 rounded-card border border-borda bg-fundo px-5 py-[18px]">
          <span className="text-sm font-bold text-texto">O que nunca fazemos</span>
          <span className="text-[15px] leading-relaxed text-texto-secundario">
            Publicar, comentar, enviar mensagens ou alterar qualquer coisa no seu perfil.
          </span>
        </div>
      </div>
      <div className={botoes}>
        {conectado ? (
          <>
            <Badge variant="liquidado">TikTok conectado</Badge>
            <Button onClick={onProximo}>Continuar</Button>
          </>
        ) : (
          <>
            <Button
              disabled={conectar.isPending}
              onClick={() =>
                conectar.mutate('VIDEOS', {
                  onSuccess: ({ authorizeUrl }) => window.location.assign(authorizeUrl),
                })
              }
            >
              Conectar o TikTok
            </Button>
            <Button variant="link" onClick={onDepois}>
              Fazer depois
            </Button>
          </>
        )}
      </div>
    </>
  );
}

function PassoShop({
  accountId,
  conectado,
  onProximo,
  onDepois,
  onVoltar,
}: {
  accountId?: string;
  conectado: boolean;
  onProximo: () => void;
  onDepois: () => void;
  onVoltar: () => void;
}) {
  return (
    <>
      <Cabeca
        icone={Store}
        titulo="Conecte o TikTok Shop para ler os pedidos"
        extra={
          conectado ? (
            <Badge variant="liquidado">Conectado</Badge>
          ) : (
            <Badge variant="a-liquidar">Em liberação no Brasil</Badge>
          )
        }
        texto="Quando a conexão for liberada para a sua conta, pedidos e comissões entram sozinhos. Até lá, você não fica sem números."
      />
      {conectado ? null : (
        <div className="flex flex-col gap-3 rounded-card border border-borda bg-fundo px-5 py-[18px]">
          <span className="text-sm font-bold text-texto">
            Por enquanto: envie o relatório em arquivo
          </span>
          <span className="text-[15px] leading-relaxed text-texto-secundario">
            Baixe o <strong className="text-texto">affiliate_orders.xlsx</strong> no Centro de
            Afiliados do app do TikTok e envie aqui. Pode reenviar quando quiser: nada se duplica.
          </span>
          {accountId ? (
            <PainelImport accountId={accountId} comHistorico={false} />
          ) : (
            <p className="text-[13px] text-texto-secundario">
              O envio fica disponível assim que você conectar o TikTok, no passo anterior.
            </p>
          )}
        </div>
      )}
      <div className={botoes}>
        {conectado ? (
          <Button onClick={onProximo}>Continuar</Button>
        ) : (
          <>
            <Button disabled title="A conexão com o TikTok Shop ainda não foi liberada no Brasil">
              Conectar o TikTok Shop
            </Button>
            <Button variant="link" onClick={onDepois}>
              Fazer depois
            </Button>
          </>
        )}
        <Button variant="ghost" onClick={onVoltar} className="text-texto-secundario">
          Voltar
        </Button>
      </div>
    </>
  );
}

function PassoMeta({
  accountId,
  onDepois,
  onVoltar,
}: {
  accountId?: string;
  onDepois: () => void;
  onVoltar: () => void;
}) {
  const navigate = useNavigate();
  const mes = hojeSP().slice(0, 7);
  const goals = useGoals();
  const salvar = useSaveGoal();
  const atual = goals.data?.find((g) => g.accountId === accountId && g.month === mes);
  const [texto, setTexto] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const valor = texto ?? (atual?.commission ? formatDecimal(atual.commission) : '5.000,00');
  const meta = parseMoeda(valor);
  const nomeMes = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${mes}-01T00:00:00Z`));

  function concluir() {
    if (!accountId) return navigate('/inicio');
    if (valor.trim() && !meta) return setErro('Use valores como 5.000,00.');
    salvar.mutate(
      // Aqui a meta é de comissão; a de GMV, se existir, é mantida.
      { accountId, month: mes, commission: meta, gmv: atual?.gmv ?? null },
      { onSuccess: () => navigate('/inicio') },
    );
  }

  return (
    <>
      <Cabeca
        icone={Target}
        titulo="Defina a meta do mês"
        texto="O painel mostra o quanto falta para chegar lá. Dá para mudar a meta quando quiser."
      />
      {accountId ? (
        <>
          <label className="flex max-w-xs flex-col gap-2 text-sm font-semibold text-texto">
            Meta de comissão em {nomeMes}
            <span className="flex h-[52px] items-center gap-2 rounded-campo border border-borda bg-superficie px-3.5 focus-within:ring-2 focus-within:ring-acao">
              <span className="text-base font-bold text-texto-secundario">R$</span>
              <input
                inputMode="decimal"
                value={valor}
                onChange={(e) => setTexto(e.target.value)}
                className="h-full min-w-0 flex-1 bg-transparent text-lg font-bold text-texto outline-none"
              />
            </span>
          </label>
          <div className="flex flex-wrap gap-2.5" role="group" aria-label="Sugestões de meta">
            {SUGESTOES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={meta === s}
                onClick={() => setTexto(formatDecimal(s))}
                className={cn(
                  'h-11 rounded-full border-[1.5px] px-[18px] text-[15px] font-semibold text-texto',
                  meta === s ? 'border-acao bg-pessego' : 'border-borda bg-superficie',
                )}
              >
                {formatMoeda(s)}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-texto-secundario">
          A meta fica disponível depois que você conectar o TikTok. Dá para definir em
          Configurações.
        </p>
      )}
      {erro || salvar.error ? (
        <p role="alert" className="text-sm text-status-reembolsado">
          {erro ?? salvar.error?.message}
        </p>
      ) : null}
      <div className={botoes}>
        <Button onClick={concluir} disabled={salvar.isPending}>
          {accountId ? 'Salvar e abrir o painel' : 'Abrir o painel'}
        </Button>
        <Button variant="link" onClick={onDepois}>
          Fazer depois
        </Button>
        <Button variant="ghost" onClick={onVoltar} className="text-texto-secundario">
          Voltar
        </Button>
      </div>
    </>
  );
}
