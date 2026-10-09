import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Camera,
  CircleAlert,
  CircleCheck,
  Download,
  KeyRound,
  Link2,
  Plus,
  Store,
  Trash2,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import {
  useAccounts,
  useChangePassword,
  useDeleteAccount,
  useDisconnect,
  useExportData,
  useGoals,
  useNotifications,
  useSaveGoal,
  useSaveNotifications,
  useSession,
  entrarComGoogle,
  useStartTiktokConnection,
  useUnlinkIdentity,
  useUpdateProfile,
  useUploadAvatar,
} from '@/api/queries';
import type { Conta, NotificationSettings, Sessao } from '@/api/schemas';
import { CabecalhoPagina, PaginaApp } from '@/components/dados';
import { PainelImport } from '@/components/import';
import { LogoGoogle } from '@/components/publico';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import { formatData, formatDecimal, formatMoeda, haQuanto, parseMoeda } from '@/lib/format';
import { divRound, fromCents, toCents } from '@/lib/money';
import { avisoLimite, mensagemDoErro, PRAZO_EXCLUSAO, PRAZO_RESPOSTA } from '@/lib/textos';
import { cn } from '@/lib/utils';
import { conexaoExpirada, hojeSP, useConta, useFiltros } from './filtros';

export function Configuracoes() {
  const sessao = useSession();

  return (
    <PaginaApp className="max-w-[884px]">
      <CabecalhoPagina
        titulo="Configurações"
        descricao="Acesso à conta, conexões, meta e privacidade"
      />
      <VoltaDoTiktok />
      {sessao.data ? (
        <>
          <AcessoConta sessao={sessao.data} />
          <ContasConectadas />
          <MetaDoMes />
          <Avisos />
          <SeusDados />
        </>
      ) : (
        <Skeleton className="h-96 rounded-card" />
      )}
    </PaginaApp>
  );
}

function Secao({
  titulo,
  descricao,
  subordinada = false,
  children,
}: {
  titulo: string;
  descricao?: string;
  /** Contas conectadas ficam abaixo do acesso: fundo e recuo deixam claro que dependem dele. */
  subordinada?: boolean;
  children: ReactNode;
}) {
  const id = `secao-${titulo.toLowerCase().replace(/\W+/g, '-')}`;
  return (
    <section
      aria-labelledby={id}
      className={cn(
        'flex flex-col gap-4 rounded-card border border-borda p-[18px] lg:p-6',
        subordinada ? 'bg-fundo lg:ml-6' : 'bg-superficie shadow-[0_1px_2px_rgba(43,29,27,0.04)]',
      )}
    >
      <div className="flex flex-col gap-1">
        <h2 id={id} className={cn('font-bold text-texto', subordinada ? 'text-base' : 'text-lg')}>
          {titulo}
        </h2>
        {descricao ? (
          <p className="text-sm leading-relaxed text-texto-secundario">{descricao}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

const erroTexto = 'text-sm text-status-reembolsado';
const iniciais = (nome: string) =>
  nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

// --- acesso à conta ---

/** Linha de um meio de acesso: rótulo à esquerda, estado no meio, ação à direita. */
function LinhaAcesso({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-t border-borda pt-4 sm:flex-row sm:items-start sm:gap-4">
      <span className="w-24 shrink-0 text-sm font-semibold text-texto">{rotulo}</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-start gap-3">{children}</div>
    </div>
  );
}

function AcessoConta({ sessao }: { sessao: Sessao }) {
  const { user } = sessao;
  const desvincular = useUnlinkIdentity();
  const google = user.identities.find((i) => i.provider === 'GOOGLE');
  // A API é quem decide (409 quando é o único acesso); aqui só não oferecemos o que ela recusaria.
  const podeDesvincular = user.hasPassword;
  const salvar = useUpdateProfile();
  const foto = useUploadAvatar();
  const arquivo = useRef<HTMLInputElement>(null);
  const [senhaAberta, setSenhaAberta] = useState(false);
  const [erroNome, setErroNome] = useState<string | null>(null);

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    const name = String(dados.get('name') ?? '').trim();
    const email = String(dados.get('email') ?? '').trim();
    if (name.length < 2) return setErroNome('O nome precisa ter pelo menos 2 letras.');
    setErroNome(null);
    salvar.mutate(
      {
        ...(name !== user.name ? { name } : {}),
        ...(email !== user.email ? { email } : {}),
      },
      { onSuccess: () => toast({ title: 'Perfil atualizado' }) },
    );
  }

  return (
    <Secao
      titulo="Acesso à conta"
      descricao="Como você entra no ShopScanner. A conta é sua, com ou sem TikTok."
    >
      <div className="flex items-center gap-4">
        <span className="inline-flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-pessego text-xl font-extrabold text-texto">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="size-full object-cover" />
          ) : (
            iniciais(user.name)
          )}
        </span>
        <input
          ref={arquivo}
          type="file"
          accept="image/*"
          className="sr-only"
          aria-label="Escolher foto do perfil"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) foto.mutate(f, { onSuccess: () => toast({ title: 'Foto atualizada' }) });
            e.target.value = '';
          }}
        />
        <Button
          variant="secondary"
          size="sm"
          disabled={foto.isPending}
          onClick={() => arquivo.current?.click()}
        >
          <Camera aria-hidden /> {foto.isPending ? 'Enviando…' : 'Trocar foto'}
        </Button>
      </div>
      {foto.error ? (
        <p role="alert" className={erroTexto}>
          {foto.error.message}
        </p>
      ) : null}

      <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-texto">
            Nome
            <Input name="name" defaultValue={user.name} autoComplete="name" required />
            {erroNome ? <span className={erroTexto}>{erroNome}</span> : null}
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-texto">
            E-mail
            <Input
              name="email"
              type="email"
              defaultValue={user.email}
              autoComplete="email"
              required
            />
          </label>
        </div>
        {salvar.error ? (
          <p role="alert" className={erroTexto}>
            {salvar.error.message}
          </p>
        ) : null}
        <Button type="submit" className="self-start" disabled={salvar.isPending}>
          {salvar.isPending ? 'Salvando…' : 'Salvar alterações'}
        </Button>
      </form>

      <LinhaAcesso rotulo="Senha">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
          {user.hasPassword ? (
            <span className="text-texto">Definida</span>
          ) : (
            <>
              <span className="text-texto">Nenhuma senha definida</span>
              <span className="text-[13px] text-texto-secundario">
                Hoje você entra só pelo Google.
              </span>
            </>
          )}
        </span>
        <Button variant="secondary" size="sm" onClick={() => setSenhaAberta(true)}>
          <KeyRound aria-hidden /> {user.hasPassword ? 'Trocar senha' : 'Definir senha'}
        </Button>
      </LinhaAcesso>

      <LinhaAcesso rotulo="Google">
        {google ? null : (
          <>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
              <span className="text-texto">Não vinculado</span>
              <span className="text-[13px] text-texto-secundario">
                Vincule para entrar também com a sua conta do Google.
              </span>
            </span>
            <Button variant="outline" size="sm" onClick={() => entrarComGoogle()}>
              <LogoGoogle /> Vincular o Google
            </Button>
          </>
        )}
        {google ? (
          <>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
              <span className="flex flex-wrap items-center gap-2 text-texto">
                {google.email} <Badge variant="liquidado">Vinculado</Badge>
              </span>
              <span className="text-[13px] text-texto-secundario">
                {podeDesvincular
                  ? 'Você também pode entrar com e-mail e senha.'
                  : 'É o seu único acesso à conta.'}
              </span>
            </span>
            <span className="flex flex-col items-start gap-1 sm:items-end">
              <Button
                variant="destructive"
                size="sm"
                disabled={!podeDesvincular || desvincular.isPending}
                aria-describedby={podeDesvincular ? undefined : 'desvincular-dica'}
                onClick={() =>
                  desvincular.mutate('GOOGLE', {
                    onSuccess: () => toast({ title: 'Google desvinculado' }),
                  })
                }
              >
                Desvincular
              </Button>
              {podeDesvincular ? null : (
                <span id="desvincular-dica" className="text-[13px] text-texto-secundario">
                  Defina uma senha antes de desvincular.
                </span>
              )}
            </span>
          </>
        ) : null}
        {desvincular.error ? (
          <p role="alert" className={cn(erroTexto, 'w-full')}>
            {desvincular.error instanceof ApiError && desvincular.error.serverCode
              ? mensagemDoErro(desvincular.error.serverCode)
              : desvincular.error.message}
          </p>
        ) : null}
      </LinhaAcesso>

      <TrocarSenha
        aberto={senhaAberta}
        primeira={!user.hasPassword}
        onFechar={() => setSenhaAberta(false)}
      />
    </Secao>
  );
}

/** Texto da falha ao trocar senha: a API manda código para senha atual errada e limite de tentativas. */
function textoDeFalhaSenha(error: Error | null): string | null {
  if (!(error instanceof ApiError)) return null;
  if (error.code === 'limitado') return avisoLimite(error.retryAfterSegundos);
  return error.serverCode ? mensagemDoErro(error.serverCode) : error.message;
}

function TrocarSenha({
  aberto,
  primeira,
  onFechar,
}: {
  aberto: boolean;
  /** Conta nascida pelo Google: não há senha atual para pedir. */
  primeira: boolean;
  onFechar: () => void;
}) {
  const trocar = useChangePassword();
  const [erro, setErro] = useState<string | null>(null);

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    const currentPassword = primeira ? undefined : String(dados.get('atual') ?? '');
    const newPassword = String(dados.get('nova') ?? '');
    if (newPassword.length < 8) return setErro('A senha nova precisa ter pelo menos 8 caracteres.');
    if (newPassword !== String(dados.get('confirmacao') ?? ''))
      return setErro('A confirmação não é igual à senha nova.');
    setErro(null);
    trocar.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          toast({ title: primeira ? 'Senha definida' : 'Senha trocada' });
          onFechar();
        },
      },
    );
  }

  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        if (!v) {
          setErro(null);
          trocar.reset();
          onFechar();
        }
      }}
    >
      <DialogContent>
        <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{primeira ? 'Definir senha' : 'Trocar senha'}</DialogTitle>
            <DialogDescription>A senha nova precisa ter pelo menos 8 caracteres.</DialogDescription>
          </DialogHeader>
          {(
            [
              ['atual', 'Senha atual', 'current-password'],
              ['nova', 'Senha nova', 'new-password'],
              ['confirmacao', 'Repita a senha nova', 'new-password'],
            ] as const
          )
            .filter(([nome]) => !(primeira && nome === 'atual'))
            .map(([nome, rotulo, auto]) => (
              <label key={nome} className="flex flex-col gap-1.5 text-sm font-semibold text-texto">
                {rotulo}
                <Input name={nome} type="password" autoComplete={auto} required />
              </label>
            ))}
          {erro || trocar.error ? (
            <p role="alert" className={erroTexto}>
              {erro ?? textoDeFalhaSenha(trocar.error)}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={trocar.isPending}>
              {trocar.isPending ? 'Salvando…' : primeira ? 'Definir senha' : 'Trocar senha'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * A volta da autorização do TikTok: `/configuracoes?conectado=1` ou `?erro=CODIGO`.
 * Sessão vencida no meio volta em `/entrar?erro=SESSAO_EXPIRADA`, tratada lá.
 */
function VoltaDoTiktok() {
  const qc = useQueryClient();
  const f = useFiltros();
  const conectado = f.get('conectado');
  const erro = f.get('erro');

  useEffect(() => {
    if (!conectado && !erro) return;
    // A conexão nova muda contas e dados: relê tudo e limpa a URL.
    if (conectado) void qc.invalidateQueries();
    f.set({ conectado: null, erro: null });
    // `f` é refeito a cada render; o que importa é a volta ter acontecido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conectado, erro]);

  const [aviso] = useState(() =>
    conectado ? { ok: true as const } : erro ? { ok: false as const, erro } : null,
  );
  if (!aviso) return null;

  return aviso.ok ? (
    <p
      role="status"
      className="flex items-center gap-2.5 rounded-card border border-borda bg-status-liquidado-suave px-4 py-3 text-[15px] text-texto"
    >
      <CircleCheck className="size-5 shrink-0 text-status-liquidado" aria-hidden />
      Conta conectada. Os seus dados começam a entrar nas próximas horas.
    </p>
  ) : (
    <p
      role="alert"
      className="flex items-center gap-2.5 rounded-card border border-borda bg-status-reembolsado-suave px-4 py-3 text-[15px] text-texto"
    >
      <CircleAlert className="size-5 shrink-0 text-status-reembolsado" aria-hidden />
      {mensagemDoErro(aviso.erro)}
    </p>
  );
}

// --- contas conectadas ---

function ContasConectadas() {
  const contas = useAccounts();
  const conta = useConta();
  const conectar = useStartTiktokConnection();
  const desconectar = useDisconnect();
  const [confirmar, setConfirmar] = useState<Conta | null>(null);
  // A autorização acontece no TikTok; o backend monta o link e nos recebe de volta
  // em /configuracoes?conectado=1 ou ?erro=CODIGO.
  const irParaTiktok = (kind: 'VIDEOS' | 'SHOP' = 'VIDEOS') =>
    conectar.mutate(kind, {
      onSuccess: ({ authorizeUrl }) => window.location.assign(authorizeUrl),
    });
  // A recusa vem com código de negócio (503 em pedidos): traduz igual à volta do callback.
  const falhaAoConectar =
    conectar.error instanceof ApiError
      ? conectar.error.serverCode
        ? mensagemDoErro(conectar.error.serverCode)
        : conectar.error.message
      : null;

  const linha =
    'flex flex-wrap items-center gap-3 rounded-card border border-borda bg-superficie p-4';
  const icone =
    'inline-flex size-11 shrink-0 items-center justify-center rounded-campo bg-pessego text-apoio';
  // Uma linha por conexão. O TikTok Shop ainda não conecta no Brasil, então aparece uma vez só.
  const shopConectado = contas.data?.some((c) => c.shopConnected) ?? false;

  return (
    <Secao
      titulo="Contas conectadas"
      subordinada
      descricao="De onde vêm os seus dados. Desconectar só para de importar: a sua conta e o acesso acima continuam."
    >
      {contas.isPending ? <Skeleton className="h-20" /> : null}
      {contas.data?.length === 0 ? (
        <div className={linha}>
          <span className={icone}>
            <Link2 className="size-5" aria-hidden />
          </span>
          <span className="flex min-w-48 flex-1 flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-2 font-bold text-texto">
              TikTok · vídeos <Badge variant="aguardando">Não conectado</Badge>
            </span>
            <span className="text-[13px] text-texto-secundario">
              Lê as suas publicações com views, curtidas e comentários.
            </span>
          </span>
          <Button size="sm" disabled={conectar.isPending} onClick={() => irParaTiktok()}>
            Conectar o TikTok
          </Button>
        </div>
      ) : null}
      {contas.data?.map((c) => (
        <div key={c.id} className={linha}>
          <span className={icone}>
            <Link2 className="size-5" aria-hidden />
          </span>
          <span className="flex min-w-48 flex-1 flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-2 font-bold text-texto">
              TikTok · vídeos
              {conexaoExpirada(c) ? (
                <Badge variant="reembolsado">Expirada</Badge>
              ) : (
                <Badge variant="liquidado">Conectado</Badge>
              )}
            </span>
            <span className="text-[13px] text-texto-secundario">
              {c.username} · conectado em {formatData(c.connectedAt)}
              {c.lastSyncedAt
                ? ` · última leitura ${haQuanto(c.lastSyncedAt)}`
                : ' · primeira leitura em andamento'}
            </span>
          </span>
          {conexaoExpirada(c) ? (
            <Button size="sm" disabled={conectar.isPending} onClick={() => irParaTiktok()}>
              Reconectar
            </Button>
          ) : null}
          <Button variant="destructive" size="sm" onClick={() => setConfirmar(c)}>
            Desconectar
          </Button>
        </div>
      ))}
      {contas.data ? (
        <div className={linha}>
          <span className={icone}>
            <Store className="size-5" aria-hidden />
          </span>
          <span className="flex min-w-48 flex-1 flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-2 font-bold text-texto">
              TikTok Shop · pedidos
              {shopConectado ? (
                <Badge variant="liquidado">Conectado</Badge>
              ) : (
                <Badge variant="a-liquidar">Em liberação no Brasil</Badge>
              )}
            </span>
            <span className="text-[13px] text-texto-secundario">
              {shopConectado
                ? 'Pedidos e comissões entram sozinhos.'
                : 'Pedidos e comissões entram sozinhos quando a conexão for liberada para a sua conta. Por enquanto, envie o relatório em arquivo.'}
            </span>
          </span>
          {shopConectado ? null : (
            <Button
              variant="secondary"
              size="sm"
              disabled={conectar.isPending}
              onClick={() => irParaTiktok('SHOP')}
            >
              Tentar conectar
            </Button>
          )}
        </div>
      ) : null}
      {contas.data?.length ? (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          disabled={conectar.isPending}
          onClick={() => irParaTiktok()}
        >
          <Plus aria-hidden /> Conectar outra conta do TikTok
        </Button>
      ) : null}

      {falhaAoConectar ? (
        <p role="alert" className={erroTexto}>
          {falhaAoConectar}
        </p>
      ) : null}

      {conta ? <PedidosPorArquivo accountId={conta.id} shopConectado={shopConectado} /> : null}

      <Dialog open={!!confirmar} onOpenChange={(v) => !v && setConfirmar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desconectar o TikTok?</DialogTitle>
            <DialogDescription>
              {confirmar?.username}: a conexão de vídeos deixa de ser lida.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 text-sm leading-relaxed">
            <div className="flex flex-col gap-1 rounded-campo bg-status-reembolsado-suave p-3.5">
              <span className="font-bold text-texto">O que para de funcionar</span>
              <span className="text-texto-secundario">
                A leitura desta conta inteira: vídeos e, quando houver, pedidos. Views, curtidas,
                vídeos novos e vendas deixam de atualizar a partir de agora.
              </span>
            </div>
            <div className="flex flex-col gap-1 rounded-campo bg-status-reembolsado-suave p-3.5">
              <span className="font-bold text-texto">O que é apagado agora</span>
              <span className="text-texto-secundario">
                Tudo que já foi lido desta conta sai do painel na hora: vendas, vídeos, produtos e a
                meta do mês. Não dá para desfazer. Se quiser guardar, exporte os seus dados antes,
                em Seus dados.
              </span>
            </div>
            <div className="flex flex-col gap-1 rounded-campo bg-status-liquidado-suave p-3.5">
              <span className="font-bold text-texto">O que continua</span>
              <span className="text-texto-secundario">
                A sua conta, o e-mail, o acesso pelo Google e o seu planejamento não mudam.
                Conectando de novo, os dados são lidos outra vez a partir do TikTok.
              </span>
            </div>
          </div>
          {desconectar.error ? (
            <p role="alert" className={erroTexto}>
              {desconectar.error.message}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmar(null)}>
              Manter conectado
            </Button>
            <Button
              variant="destructive"
              disabled={desconectar.isPending}
              onClick={() =>
                confirmar &&
                desconectar.mutate(confirmar.id, { onSuccess: () => setConfirmar(null) })
              }
            >
              Desconectar o TikTok
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Secao>
  );
}

/**
 * Import do `affiliate_orders.xlsx`. Fica junto das conexões porque é a outra forma de
 * trazer pedidos: enquanto a Affiliate Creator API não libera no Brasil, é a única.
 */
function PedidosPorArquivo({
  accountId,
  shopConectado,
}: {
  accountId: string;
  shopConectado: boolean;
}) {
  const alvo = useRef<HTMLDivElement>(null);
  const f = useFiltros();
  const pedido = f.get('secao') === 'import';

  // Atalho de Vendas: /configuracoes?secao=import abre a tela já aqui embaixo.
  useEffect(() => {
    // `scrollIntoView` não existe no jsdom nem em navegador muito antigo.
    if (pedido) alvo.current?.scrollIntoView?.({ block: 'start' });
  }, [pedido]);

  return (
    <div
      ref={alvo}
      id="import"
      className="flex scroll-mt-24 flex-col gap-3 rounded-card border border-borda bg-superficie p-4 lg:p-5"
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-bold text-texto">Pedidos por arquivo</h3>
        <p className="text-sm leading-relaxed text-texto-secundario">
          {shopConectado
            ? 'A conexão já traz os pedidos sozinha. O arquivo serve para completar períodos antigos, anteriores à conexão.'
            : 'Enquanto a conexão de pedidos não é liberada, é assim que as suas vendas entram no painel.'}
        </p>
      </div>
      <PainelImport accountId={accountId} />
      <Link to="/reconciliacao" className="text-sm font-semibold">
        Ver divergências entre o arquivo e a API
      </Link>
    </div>
  );
}

// --- meta do mês ---

const SUGESTOES = ['10000.00', '15000.00', '20000.00'];

function MetaDoMes() {
  const conta = useConta();
  const mes = hojeSP().slice(0, 7);
  const goals = useGoals();
  const salvar = useSaveGoal();
  const prefs = useNotifications();
  const salvarPrefs = useSaveNotifications();
  const atual = goals.data?.find((g) => g.accountId === conta?.id && g.month === mes);
  const [valor, setValor] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const texto = valor ?? (atual?.gmv ? formatDecimal(atual.gmv) : '');
  const meta = parseMoeda(texto);
  const nomeMes = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${mes}-01T00:00:00Z`));

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (!conta) return;
    if (texto.trim() && !meta) return setErro('Use valores como 15.000,00.');
    setErro(null);
    salvar.mutate(
      // A tela só edita a meta de GMV; a de comissão, se existir, é mantida.
      { accountId: conta.id, month: mes, gmv: meta, commission: atual?.commission ?? null },
      { onSuccess: () => toast({ title: 'Meta salva' }) },
    );
  }

  return (
    <Secao
      titulo="Meta do mês"
      descricao="A meta aparece na barra de progresso do Início. Dá para mudar quando quiser."
    >
      {!conta ? (
        <p className="text-sm text-texto-secundario">
          Conecte uma conta do TikTok para definir metas.
        </p>
      ) : goals.isPending ? (
        <Skeleton className="h-24" />
      ) : (
        <form onSubmit={enviar} className="flex flex-col gap-3.5" noValidate>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-texto">
            Meta de GMV em {nomeMes}
            <span className="relative block max-w-xs">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-semibold text-texto-secundario">
                R$
              </span>
              <Input
                inputMode="decimal"
                placeholder="15.000,00"
                value={texto}
                onChange={(e) => setValor(e.target.value)}
                className="pl-11"
              />
            </span>
          </label>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Sugestões de meta">
            {SUGESTOES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={meta === s}
                onClick={() => setValor(formatDecimal(s))}
                className={cn(
                  'h-9 rounded-full border border-borda px-3.5 text-sm font-semibold text-texto',
                  meta === s && 'border-[1.5px] border-acao bg-pessego',
                )}
              >
                {formatMoeda(s)}
              </button>
            ))}
          </div>
          {prefs.data ? (
            <label className="flex items-start gap-2.5 text-sm text-texto">
              <input
                type="checkbox"
                checked={prefs.data.goalReached}
                onChange={(e) =>
                  salvarPrefs.mutate({ ...prefs.data!, goalReached: e.target.checked })
                }
                className="mt-0.5 size-5 accent-acao"
              />
              <span className="flex flex-col gap-0.5">
                <span className="font-semibold">
                  Avisar quando eu chegar a 80% e a 100% da meta
                </span>
                {meta ? (
                  <span className="text-[13px] text-texto-secundario">
                    O aviso aparece no sino assim que o GMV do mês passar de{' '}
                    {formatMoeda(fromCents(divRound(toCents(meta) * 80n, 100n)))}.
                  </span>
                ) : null}
              </span>
            </label>
          ) : null}
          {erro || salvar.error ? (
            <p role="alert" className={erroTexto}>
              {erro ?? salvar.error?.message}
            </p>
          ) : null}
          <Button type="submit" className="self-start" disabled={salvar.isPending}>
            Salvar meta
          </Button>
        </form>
      )}
    </Secao>
  );
}

// --- avisos ---

/** Estado das integrações (CLAUDE.md → "Estado da integração"). Só leitura, sem endpoint. */
const INTEGRACOES = [
  {
    nome: 'TikTok Shop (vendas e comissões)',
    estado: 'Ainda não liberado para o Brasil. Assim que o TikTok liberar, você conecta aqui.',
  },
  {
    nome: 'Vídeos do TikTok',
    estado: 'Disponível, dependendo da revisão do app pelo TikTok.',
  },
];

type Chave = Exclude<keyof NotificationSettings, 'channels'>;
const TIPOS: { chaves: Chave[]; titulo: string; texto: string }[] = [
  {
    chaves: ['orderSettled'],
    titulo: 'Comissão liquidada',
    texto: 'Quando um pedido sai do prazo de devolução e a comissão é confirmada.',
  },
  {
    chaves: ['orderFrozen', 'orderRefunded'],
    titulo: 'Pedido retido ou reembolsado',
    texto: 'Quando um pedido muda para retido ou reembolsado e o valor previsto cai.',
  },
  {
    chaves: ['paceDrop'],
    titulo: 'Queda no ritmo de vendas',
    texto: 'Quando o GMV dos últimos 7 dias fica bem abaixo dos 7 dias anteriores.',
  },
  {
    chaves: ['viewsDrop'],
    titulo: 'Queda forte de views',
    texto: 'Quando as views de um vídeo caem bem abaixo da média recente.',
  },
  {
    chaves: ['postReminder'],
    titulo: 'Lembrete de postar',
    texto: 'Quando uma pauta do planejamento está marcada para as próximas 24 horas.',
  },
];

function Avisos() {
  const prefs = useNotifications();
  const salvar = useSaveNotifications();
  const atual = salvar.isPending ? salvar.variables : prefs.data;
  const alternar = (mudanca: Partial<NotificationSettings>) =>
    atual && salvar.mutate({ ...atual, ...mudanca });

  return (
    <Secao titulo="Avisos" descricao="Escolha o que quer acompanhar no sino, aqui no app.">
      <section className="flex flex-col gap-2" aria-label="Estado das integrações">
        <h3 className="text-sm font-bold text-texto">Estado das integrações</h3>
        <ul className="grid gap-2 sm:grid-cols-2">
          {INTEGRACOES.map((i) => (
            <li key={i.nome} className="rounded-campo bg-fundo p-3">
              <p className="text-sm font-semibold text-texto">{i.nome}</p>
              <p className="text-[13px] text-texto-secundario">{i.estado}</p>
            </li>
          ))}
        </ul>
      </section>

      {!atual ? (
        <Skeleton className="h-48" />
      ) : (
        <ul className="flex flex-col divide-y divide-borda" aria-label="Tipos de aviso">
          {TIPOS.map(({ chaves, titulo, texto }) => (
            <li key={titulo}>
              <Interruptor
                titulo={titulo}
                texto={texto}
                ligado={chaves.every((k) => atual[k])}
                onChange={(v) => alternar(Object.fromEntries(chaves.map((k) => [k, v])))}
              />
            </li>
          ))}
          <li>
            {/* E-mail existe no contrato, mas não aparece: no MVP não há envio (CLAUDE.md). */}
            <Interruptor
              titulo="Mostrar avisos no sino"
              texto="Desligado, o sino fica quieto mesmo com os tipos acima ligados."
              ligado={atual.channels.inApp}
              onChange={(v) => alternar({ channels: { ...atual.channels, inApp: v } })}
            />
          </li>
        </ul>
      )}
      {salvar.error ? (
        <p role="alert" className={erroTexto}>
          {salvar.error.message}
        </p>
      ) : null}
    </Secao>
  );
}

function Interruptor({
  titulo,
  texto,
  ligado,
  onChange,
}: {
  titulo: string;
  texto: string;
  ligado: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex min-h-14 cursor-pointer items-center justify-between gap-4 py-3">
      <span className="flex flex-col gap-0.5">
        <span className="text-[15px] font-semibold text-texto">{titulo}</span>
        <span className="text-[13px] leading-relaxed text-texto-secundario">{texto}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        aria-label={titulo}
        checked={ligado}
        onChange={(e) => onChange(e.target.checked)}
        className="size-5 shrink-0 accent-acao"
      />
    </label>
  );
}

// --- seus dados ---

const PALAVRA = 'EXCLUIR';

function SeusDados() {
  const exportar = useExportData();
  const excluir = useDeleteAccount();
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const [digitado, setDigitado] = useState('');
  const linha = 'flex flex-wrap items-center gap-3 rounded-card border border-borda p-4';

  return (
    <Secao
      titulo="Seus dados"
      descricao={`Você controla o que fica guardado. Os dois pedidos abaixo são atendidos em até ${PRAZO_RESPOSTA}.`}
    >
      <div className={linha}>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-bold text-texto">Baixar meus dados</span>
          <span className="text-[13px] text-texto-secundario">
            Um arquivo com o seu perfil, as comissões e os vídeos lidos até aqui.
          </span>
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={exportar.isPending}
          onClick={() => exportar.mutate()}
        >
          <Download aria-hidden /> {exportar.isPending ? 'Preparando…' : 'Exportar meus dados'}
        </Button>
      </div>
      {exportar.error ? (
        <p role="alert" className={erroTexto}>
          {exportar.error.message}
        </p>
      ) : null}
      <div className={linha}>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-bold text-texto">Excluir conta</span>
          <span className="text-[13px] text-texto-secundario">
            Desconecta as contas, apaga o seu perfil e remove os dados lidos em até {PRAZO_EXCLUSAO}
            . Não dá para desfazer.
          </span>
        </span>
        <Button variant="destructive" size="sm" onClick={() => setAberto(true)}>
          <Trash2 aria-hidden /> Excluir minha conta
        </Button>
      </div>

      <Dialog
        open={aberto}
        onOpenChange={(v) => {
          setAberto(v);
          setDigitado('');
        }}
      >
        <DialogContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (digitado !== PALAVRA) return;
              excluir.mutate(undefined, { onSuccess: () => navigate('/', { replace: true }) });
            }}
          >
            <DialogHeader>
              <DialogTitle>Excluir a sua conta?</DialogTitle>
              <DialogDescription>
                Apagamos seu perfil, as contas conectadas, o planejamento e as metas. Isso não tem
                volta. Se quiser guardar uma cópia, exporte seus dados antes.
              </DialogDescription>
            </DialogHeader>
            <label className="flex flex-col gap-1 text-sm font-semibold text-texto">
              Digite {PALAVRA} para confirmar
              <Input
                value={digitado}
                onChange={(e) => setDigitado(e.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
              />
            </label>
            {excluir.error ? (
              <p role="alert" className={erroTexto}>
                {excluir.error.message}
              </p>
            ) : null}
            <DialogFooter>
              <Button variant="outline" onClick={() => setAberto(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={digitado !== PALAVRA || excluir.isPending}
              >
                Excluir definitivamente
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Secao>
  );
}
