import { useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Link2, Trash2, UserRound } from 'lucide-react';
import {
  useAccounts,
  useDeleteAccount,
  useDisconnect,
  useExportData,
  useGoals,
  useNotifications,
  useSaveGoal,
  useSaveNotifications,
  useSession,
  useStartTiktokConnection,
} from '@/api/queries';
import type { Conta, NotificationSettings } from '@/api/schemas';
import { CabecalhoPagina, EstadoConsulta } from '@/components/dados';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { formatData, formatDecimal, parseMoeda } from '@/lib/format';
import { dayKey } from '@/lib/metrics';

export function Configuracoes() {
  const sessao = useSession();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-4 md:p-6">
      <CabecalhoPagina titulo="Configurações" descricao="Sua conta, suas conexões e seus dados." />
      {sessao.data ? (
        <>
          <Secao titulo="Perfil">
            <div className="flex items-center gap-3">
              <span className="flex size-12 items-center justify-center rounded-full bg-pessego text-texto">
                <UserRound aria-hidden />
              </span>
              <div className="flex flex-col">
                <span className="font-semibold text-texto">{sessao.data.user.name}</span>
                <span className="text-corpo-sm text-texto-secundario">
                  {sessao.data.user.email}
                </span>
              </div>
            </div>
          </Secao>
          <ContasConectadas />
          <MetaDoMes conta={sessao.data.accounts[0]} />
          <Avisos />
          <SeusDados />
        </>
      ) : null}
    </main>
  );
}

function Secao({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao?: string;
  children: ReactNode;
}) {
  const id = `secao-${titulo.toLowerCase().replace(/\W+/g, '-')}`;
  return (
    <Card className="flex flex-col gap-4 p-5" aria-labelledby={id} role="region">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="text-lg font-bold text-texto">
          {titulo}
        </h2>
        {descricao ? <p className="text-corpo-sm text-texto-secundario">{descricao}</p> : null}
      </div>
      {children}
    </Card>
  );
}

// --- contas conectadas ---

function ContasConectadas() {
  const contas = useAccounts();
  const conectar = useStartTiktokConnection();
  const desconectar = useDisconnect();
  const [confirmar, setConfirmar] = useState<Conta | null>(null);

  return (
    <Secao titulo="Contas conectadas">
      <EstadoConsulta
        isPending={contas.isPending}
        error={contas.error}
        vazio={false}
        mensagemVazio=""
        onRetry={() => void contas.refetch()}
      />
      {contas.data?.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-corpo-sm text-texto-secundario">
            Nenhuma conta do TikTok conectada. Conecte para ver seus vídeos e, quando liberado, suas
            vendas.
          </p>
          <Button
            disabled={conectar.isPending}
            onClick={() =>
              conectar.mutate(undefined, {
                // A autorização acontece no TikTok; o backend monta o link.
                onSuccess: ({ authorizeUrl }) => window.location.assign(authorizeUrl),
              })
            }
          >
            <Link2 aria-hidden /> Conectar TikTok
          </Button>
        </div>
      ) : null}
      <ul className="flex flex-col gap-3">
        {contas.data?.map((c) => (
          <li
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-campo border border-borda p-3"
          >
            <div className="flex items-center gap-3">
              {c.avatarUrl ? (
                <img
                  src={c.avatarUrl}
                  alt=""
                  className="size-10 rounded-full bg-fundo object-cover"
                  onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
                />
              ) : null}
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-texto">{c.username}</span>
                <span className="text-legenda text-texto-secundario">
                  TikTok conectado em {formatData(c.connectedAt)}
                </span>
                {c.shopConnected ? (
                  <Badge variant="liquidado" className="self-start">
                    TikTok Shop conectado
                  </Badge>
                ) : (
                  <Badge variant="aguardando" className="self-start">
                    TikTok Shop não conectado
                  </Badge>
                )}
              </div>
            </div>
            <Button variant="destructive" size="sm" onClick={() => setConfirmar(c)}>
              Desconectar
            </Button>
          </li>
        ))}
      </ul>

      <Dialog open={!!confirmar} onOpenChange={(v) => !v && setConfirmar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desconectar {confirmar?.username}?</DialogTitle>
            <DialogDescription>
              Paramos de sincronizar vídeos e vendas desta conta. Você pode conectar de novo quando
              quiser.
            </DialogDescription>
          </DialogHeader>
          {desconectar.error ? (
            <p role="alert" className="text-corpo-sm text-status-reembolsado">
              {desconectar.error.message}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmar(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={desconectar.isPending}
              onClick={() =>
                confirmar &&
                desconectar.mutate(confirmar.id, { onSuccess: () => setConfirmar(null) })
              }
            >
              Desconectar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Secao>
  );
}

// --- meta do mês ---

function MetaDoMes({ conta }: { conta: Conta | undefined }) {
  const mes = dayKey(new Date().toISOString()).slice(0, 7);
  const goals = useGoals();
  const salvar = useSaveGoal();
  const atual = goals.data?.find((g) => g.accountId === conta?.id && g.month === mes);
  const [erro, setErro] = useState<string | null>(null);
  const nomeMes = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' }).format(
    new Date(`${mes}-01T00:00:00Z`),
  );

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!conta) return;
    const dados = new FormData(e.currentTarget);
    const ler = (k: string) => {
      const t = String(dados.get(k) ?? '').trim();
      return t ? parseMoeda(t) : null;
    };
    const gmv = ler('gmv');
    const commission = ler('commission');
    const invalido = (k: string, v: string | null) => !!String(dados.get(k) ?? '').trim() && !v;
    if (invalido('gmv', gmv) || invalido('commission', commission)) {
      setErro('Use valores como 15.000,00.');
      return;
    }
    setErro(null);
    salvar.mutate(
      { accountId: conta.id, month: mes, gmv, commission },
      { onSuccess: () => toast({ title: 'Meta salva' }) },
    );
  }

  return (
    <Secao
      titulo="Meta do mês"
      descricao={`Quanto você quer vender e ganhar em ${nomeMes}. Deixe em branco o que não quiser acompanhar.`}
    >
      {!conta ? (
        <p className="text-corpo-sm text-texto-secundario">
          Conecte uma conta do TikTok para definir metas.
        </p>
      ) : goals.isPending ? null : (
        <form
          key={`${atual?.gmv}-${atual?.commission}`}
          onSubmit={enviar}
          className="flex flex-col gap-3"
          noValidate
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-corpo-sm font-semibold text-texto">
              Meta de GMV (R$)
              <Input
                name="gmv"
                inputMode="decimal"
                placeholder="15.000,00"
                defaultValue={atual?.gmv ? formatDecimal(atual.gmv) : ''}
              />
            </label>
            <label className="flex flex-col gap-1 text-corpo-sm font-semibold text-texto">
              Meta de comissão (R$)
              <Input
                name="commission"
                inputMode="decimal"
                placeholder="1.500,00"
                defaultValue={atual?.commission ? formatDecimal(atual.commission) : ''}
              />
            </label>
          </div>
          {erro || salvar.error ? (
            <p role="alert" className="text-corpo-sm text-status-reembolsado">
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

type TipoAviso = Exclude<keyof NotificationSettings, 'channels'>;
const TIPOS_AVISO: { chave: TipoAviso; rotulo: string }[] = [
  { chave: 'orderFrozen', rotulo: 'Uma venda ficou retida' },
  { chave: 'orderRefunded', rotulo: 'Uma venda foi reembolsada' },
  { chave: 'goalReached', rotulo: 'Você bateu a meta do mês' },
  { chave: 'paceDrop', rotulo: 'Suas vendas caíram em relação ao período anterior' },
  { chave: 'postReminder', rotulo: 'Lembrete de postar o que está planejado' },
];

function Avisos() {
  const prefs = useNotifications();
  const salvar = useSaveNotifications();
  const atual = salvar.isPending ? salvar.variables : prefs.data;

  const alternar = (mudanca: Partial<NotificationSettings>) =>
    atual && salvar.mutate({ ...atual, ...mudanca });

  return (
    <Secao titulo="Avisos">
      <section className="flex flex-col gap-2" aria-label="Estado das integrações">
        <h3 className="text-corpo-sm font-bold text-texto">Estado das integrações</h3>
        <ul className="flex flex-col gap-2">
          {INTEGRACOES.map((i) => (
            <li key={i.nome} className="rounded-campo bg-fundo p-3">
              <p className="text-corpo-sm font-semibold text-texto">{i.nome}</p>
              <p className="text-legenda text-texto-secundario">{i.estado}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2" aria-label="Me avise quando">
        <h3 className="text-corpo-sm font-bold text-texto">Me avise quando</h3>
        <EstadoConsulta
          isPending={prefs.isPending}
          error={prefs.error}
          vazio={false}
          mensagemVazio=""
          onRetry={() => void prefs.refetch()}
        />
        {atual ? (
          <ul className="flex flex-col divide-y divide-borda">
            {TIPOS_AVISO.map(({ chave, rotulo }) => (
              <li key={chave}>
                <Interruptor
                  rotulo={rotulo}
                  ligado={atual[chave]}
                  onChange={(v) => alternar({ [chave]: v })}
                />
              </li>
            ))}
            <li>
              {/* E-mail existe no contrato, mas não aparece: no MVP não há envio. */}
              <Interruptor
                rotulo="Mostrar os avisos aqui no app"
                ligado={atual.channels.inApp}
                onChange={(v) => alternar({ channels: { ...atual.channels, inApp: v } })}
              />
            </li>
          </ul>
        ) : null}
        {salvar.error ? (
          <p role="alert" className="text-corpo-sm text-status-reembolsado">
            {salvar.error.message}
          </p>
        ) : null}
      </section>
    </Secao>
  );
}

function Interruptor({
  rotulo,
  ligado,
  onChange,
}: {
  rotulo: string;
  ligado: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 py-2 text-corpo-sm text-texto">
      {rotulo}
      <input
        type="checkbox"
        role="switch"
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

  return (
    <Secao
      titulo="Seus dados"
      descricao="Baixe uma cópia de tudo o que guardamos sobre você ou apague a sua conta."
    >
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" disabled={exportar.isPending} onClick={() => exportar.mutate()}>
          <Download aria-hidden /> {exportar.isPending ? 'Preparando…' : 'Exportar meus dados'}
        </Button>
        <Button variant="destructive" onClick={() => setAberto(true)}>
          <Trash2 aria-hidden /> Excluir minha conta
        </Button>
      </div>
      {exportar.error ? (
        <p role="alert" className="text-corpo-sm text-status-reembolsado">
          {exportar.error.message}
        </p>
      ) : null}

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
            <label className="flex flex-col gap-1 text-corpo-sm font-semibold text-texto">
              Digite {PALAVRA} para confirmar
              <Input
                value={digitado}
                onChange={(e) => setDigitado(e.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
              />
            </label>
            {excluir.error ? (
              <p role="alert" className="text-corpo-sm text-status-reembolsado">
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
