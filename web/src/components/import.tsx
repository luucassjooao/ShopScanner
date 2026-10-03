import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { CircleAlert, CircleCheck, FileSpreadsheet, FileUp, Upload } from 'lucide-react';
import { ApiError } from '@/api/client';
import { buscarImport, useImports, useUploadImport } from '@/api/queries';
import type { ImportBatch, ImportErroCodigo } from '@/api/schemas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDataHora } from '@/lib/format';
import { emAndamento, orientacaoDoErro, recusaLocal, resumoDoResultado } from '@/lib/import';
import { IMPORT_KIND_LABEL, IMPORT_STATUS_LABEL } from '@/lib/labels';
import { cn } from '@/lib/utils';

/**
 * Entrada de dados por arquivo: a espinha do MVP enquanto a Affiliate Creator API
 * não é liberada no Brasil (CLAUDE.md → "Fontes do dado").
 *
 * O front não lê o .xlsx: manda para a API e acompanha o processamento, que é em fila.
 * Vários arquivos são enviados **um depois do outro**, para não disputar banda nem fila.
 */

const ACEITA = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const INTERVALO_MS = 1500;
/** Até onde a tela espera antes de dizer que o resto segue em segundo plano. */
const MAX_ESPERAS = 60;

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Onde o service worker deixa o arquivo que chegou pelo menu de compartilhar. */
const DEPOSITO = 'shopscanner-compartilhados';

async function pegarCompartilhado(chave: string): Promise<File | null> {
  if (typeof caches === 'undefined') return null;
  try {
    const deposito = await caches.open(DEPOSITO);
    const url = `/compartilhado/${encodeURIComponent(chave)}`;
    const guardado = await deposito.match(url);
    if (!guardado) return null;
    const nome = decodeURIComponent(guardado.headers.get('X-Nome-Arquivo') ?? 'relatorio.xlsx');
    const corpo = await guardado.blob();
    await deposito.delete(url);
    return new File([corpo], nome, { type: corpo.type });
  } catch {
    return null;
  }
}

interface Andamento {
  nome: string;
  indice: number;
  total: number;
  /** Fração enviada, de 0 a 1. Depois de 1, o arquivo está em processamento. */
  fracao: number;
  processando: boolean;
}

/** O que foi feito nesta visita: um item por arquivo enviado. */
type Resultado =
  | { nome: string; batch: ImportBatch }
  | { nome: string; recusa: ImportErroCodigo }
  | { nome: string; falha: string }
  | { nome: string; emFila: true };

export function PainelImport({
  accountId,
  comHistorico = true,
}: {
  accountId: string;
  comHistorico?: boolean;
}) {
  const qc = useQueryClient();
  const enviar = useUploadImport();
  const campo = useRef<HTMLInputElement>(null);
  const vivo = useRef(true);
  const [arrastando, setArrastando] = useState(false);
  const [andamento, setAndamento] = useState<Andamento | null>(null);
  const [resultados, setResultados] = useState<Resultado[]>([]);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  // Chegou pelo menu de compartilhar do celular: envia sozinho e limpa a URL.
  const [params, setParams] = useSearchParams();
  const chave = params.get('compartilhado');
  useEffect(() => {
    if (!chave) return;
    const limpar = () => {
      const p = new URLSearchParams(params);
      p.delete('compartilhado');
      setParams(p, { replace: true });
    };
    if (chave === 'erro') {
      setResultados([
        {
          nome: 'Arquivo compartilhado',
          falha:
            'Não conseguimos ler o arquivo que veio do compartilhamento. Tente escolher o arquivo aqui.',
        },
      ]);
      limpar();
      return;
    }
    void pegarCompartilhado(chave).then((arquivo) => {
      limpar();
      if (arquivo) void processar([arquivo]);
    });
    // Só reage à chave: `processar` muda a cada render e reenviaria o arquivo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  /** Pergunta o estado do import até ele sair da fila. */
  async function acompanhar(importId: string) {
    for (let i = 0; i < MAX_ESPERAS; i++) {
      await espera(INTERVALO_MS);
      if (!vivo.current) return null;
      const batch = await buscarImport(importId);
      if (!emAndamento(batch)) return batch;
    }
    return null;
  }

  async function processar(arquivos: File[]) {
    if (!arquivos.length || andamento) return;
    setResultados([]);
    for (const [i, arquivo] of arquivos.entries()) {
      const base = { nome: arquivo.name, indice: i + 1, total: arquivos.length };
      // O que dá para recusar aqui não gasta o envio nem a fila do servidor.
      const recusa = recusaLocal(arquivo);
      if (recusa) {
        setResultados((r) => [...r, { nome: arquivo.name, recusa }]);
        continue;
      }
      setAndamento({ ...base, fracao: 0, processando: false });
      try {
        const { importId } = await enviar.mutateAsync({
          arquivo,
          accountId,
          onProgress: (fracao) =>
            setAndamento((a) => (a && a.nome === arquivo.name ? { ...a, fracao } : a)),
        });
        if (!vivo.current) return;
        setAndamento({ ...base, fracao: 1, processando: true });
        const batch = await acompanhar(importId);
        if (!vivo.current) return;
        setResultados((r) => [
          ...r,
          batch ? { nome: arquivo.name, batch } : { nome: arquivo.name, emFila: true },
        ]);
      } catch (erro) {
        if (!vivo.current) return;
        setResultados((r) => [
          ...r,
          {
            nome: arquivo.name,
            falha: erro instanceof ApiError ? erro.message : 'Não conseguimos enviar o arquivo.',
          },
        ]);
      }
    }
    setAndamento(null);
    // Pedidos, resumo e histórico mudaram: recarrega tudo que depende deles.
    await qc.invalidateQueries();
  }

  const ocupado = !!andamento;

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastando(false);
          void processar([...e.dataTransfer.files].filter((f) => !f.type.startsWith('image/')));
        }}
        className={cn(
          'flex flex-col items-center gap-3 rounded-card border-[1.5px] border-dashed px-5 py-7 text-center transition-colors',
          arrastando ? 'border-acao bg-pessego/30' : 'border-borda bg-fundo',
        )}
      >
        <span className="inline-flex size-12 items-center justify-center rounded-card bg-pessego text-apoio">
          <Upload className="size-6" aria-hidden />
        </span>
        <div className="flex flex-col gap-1">
          <p className="text-[15px] font-bold text-texto">
            Arraste o relatório aqui ou escolha no aparelho
          </p>
          <p className="max-w-[460px] text-[13px] leading-relaxed text-texto-secundario">
            O arquivo é o <strong className="font-semibold">affiliate_orders.xlsx</strong>,
            exportado do Centro de Afiliados dentro do app do TikTok. Dá para escolher vários de uma
            vez: eles entram um depois do outro. Reenviar o mesmo arquivo atualiza os pedidos, não
            duplica.
          </p>
        </div>
        <input
          ref={campo}
          type="file"
          accept={ACEITA}
          multiple
          className="sr-only"
          aria-label="Escolher arquivos .xlsx"
          onChange={(e) => {
            const arquivos = [...(e.target.files ?? [])];
            e.target.value = '';
            void processar(arquivos);
          }}
        />
        <Button size="sm" disabled={ocupado} onClick={() => campo.current?.click()}>
          <FileUp aria-hidden /> Escolher arquivos .xlsx
        </Button>
      </div>

      {andamento ? <Progresso andamento={andamento} /> : null}

      {resultados.map((r, i) => (
        <ResultadoDoArquivo key={`${r.nome}-${i}`} resultado={r} />
      ))}

      {comHistorico ? <Historico accountId={accountId} /> : null}
    </div>
  );
}

function Progresso({ andamento }: { andamento: Andamento }) {
  const pct = Math.round(andamento.fracao * 100);
  return (
    <div className="flex flex-col gap-2 rounded-card border border-borda bg-superficie p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-bold text-texto">
          {andamento.processando ? 'Processando' : 'Enviando'} {andamento.nome}
        </span>
        <span className="text-[13px] text-texto-secundario">
          {andamento.total > 1 ? `Arquivo ${andamento.indice} de ${andamento.total} · ` : ''}
          {andamento.processando ? 'quase lá' : `${pct}%`}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`Enviando ${andamento.nome}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={andamento.processando ? undefined : pct}
        className="h-2 overflow-hidden rounded-full bg-borda"
      >
        <span
          className={cn(
            'block h-full rounded-full bg-acao transition-[width] duration-200',
            andamento.processando && 'animate-pulse',
          )}
          style={{ width: `${andamento.processando ? 100 : pct}%` }}
        />
      </div>
      <p className="text-[13px] text-texto-secundario">
        {andamento.processando
          ? 'O arquivo chegou e está sendo lido. Deixe esta tela aberta até terminar.'
          : 'Não feche esta tela enquanto o arquivo sobe.'}
      </p>
    </div>
  );
}

function ResultadoDoArquivo({ resultado }: { resultado: Resultado }) {
  const caixa = 'flex gap-3 rounded-card border p-4';

  if ('recusa' in resultado) {
    const { titulo, comoResolver } = orientacaoDoErro(resultado.recusa);
    return (
      <div role="alert" className={cn(caixa, 'border-borda bg-status-reembolsado-suave')}>
        <CircleAlert className="mt-0.5 size-5 shrink-0 text-status-reembolsado" aria-hidden />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-bold text-texto">
            {resultado.nome}: {titulo}
          </span>
          <span className="text-[13px] leading-relaxed text-texto-secundario">{comoResolver}</span>
        </div>
      </div>
    );
  }

  if ('falha' in resultado) {
    return (
      <div role="alert" className={cn(caixa, 'border-borda bg-status-reembolsado-suave')}>
        <CircleAlert className="mt-0.5 size-5 shrink-0 text-status-reembolsado" aria-hidden />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-bold text-texto">{resultado.nome}</span>
          <span className="text-[13px] leading-relaxed text-texto-secundario">
            {resultado.falha}
          </span>
        </div>
      </div>
    );
  }

  if ('emFila' in resultado) {
    return (
      <div className={cn(caixa, 'border-borda bg-fundo')}>
        <FileSpreadsheet className="mt-0.5 size-5 shrink-0 text-apoio" aria-hidden />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-bold text-texto">{resultado.nome}</span>
          <span className="text-[13px] leading-relaxed text-texto-secundario">
            O arquivo está demorando mais que o normal. Pode fechar esta tela: o processamento
            continua, e o resultado aparece no histórico abaixo.
          </span>
        </div>
      </div>
    );
  }

  const { batch } = resultado;

  if (batch.error) {
    const { titulo, comoResolver } = orientacaoDoErro(batch.error.code);
    return (
      <div role="alert" className={cn(caixa, 'border-borda bg-status-reembolsado-suave')}>
        <CircleAlert className="mt-0.5 size-5 shrink-0 text-status-reembolsado" aria-hidden />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-bold text-texto">
            {resultado.nome}: {titulo}
          </span>
          <span className="text-[13px] leading-relaxed text-texto-secundario">{comoResolver}</span>
          {batch.error.columnsMissing?.length ? (
            <span className="text-[13px] leading-relaxed text-texto-secundario">
              Faltam as colunas: {batch.error.columnsMissing.join(', ')}.
            </span>
          ) : null}
          {batch.error.columnsFound?.length ? (
            <details className="text-[13px] text-texto-secundario">
              <summary className="cursor-pointer font-semibold text-acao">
                Ver as colunas encontradas
              </summary>
              <span className="leading-relaxed">{batch.error.columnsFound.join(', ')}</span>
            </details>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div role="status" className={cn(caixa, 'border-borda bg-status-liquidado-suave')}>
      <CircleCheck className="mt-0.5 size-5 shrink-0 text-status-liquidado" aria-hidden />
      <div className="flex flex-col gap-1">
        <span className="text-sm font-bold text-texto">{resultado.nome}</span>
        <span className="text-[13px] leading-relaxed text-texto-secundario">
          {batch.result ? `${resumoDoResultado(batch.result)}.` : 'Arquivo lido.'}
        </span>
      </div>
    </div>
  );
}

function Historico({ accountId }: { accountId: string }) {
  // Só os de arquivo: as sincronizações automáticas são muitas e não são desta tela.
  const imports = useImports(accountId, 'FILE');

  return (
    <section aria-labelledby="historico-imports" className="flex flex-col gap-2.5">
      <h3 id="historico-imports" className="text-sm font-bold text-texto">
        Histórico
      </h3>
      {imports.isPending ? <Skeleton className="h-16" /> : null}
      {imports.data?.items.length === 0 ? (
        <p className="text-[13px] text-texto-secundario">
          Nenhuma leitura ainda. O primeiro arquivo enviado aparece aqui.
        </p>
      ) : null}
      {imports.data?.items.map((b) => (
        <LinhaHistorico key={b.id} batch={b} />
      ))}
      {imports.error ? (
        <p role="alert" className="text-[13px] text-status-reembolsado">
          Não conseguimos carregar o histórico. {imports.error.message}
        </p>
      ) : null}
    </section>
  );
}

function LinhaHistorico({ batch }: { batch: ImportBatch }) {
  const descricao = batch.error
    ? orientacaoDoErro(batch.error.code).titulo
    : batch.result
      ? resumoDoResultado(batch.result)
      : 'Em andamento.';

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-card border border-borda bg-superficie px-4 py-3">
      <Badge variant={batch.status === 'FAILED' ? 'reembolsado' : 'neutro'}>
        {IMPORT_KIND_LABEL[batch.kind]}
      </Badge>
      <span className="flex min-w-48 flex-1 flex-col gap-0.5">
        <span className="text-sm font-semibold text-texto">
          {batch.fileName ?? IMPORT_KIND_LABEL[batch.kind]}
        </span>
        <span className="text-[13px] text-texto-secundario">
          {formatDataHora(batch.createdAt)} · {descricao}
        </span>
      </span>
      <span
        className={cn(
          'text-[13px] font-semibold',
          batch.status === 'DONE'
            ? 'text-status-liquidado'
            : batch.status === 'FAILED'
              ? 'text-status-reembolsado'
              : 'text-status-a-liquidar',
        )}
      >
        {IMPORT_STATUS_LABEL[batch.status]}
      </span>
    </div>
  );
}
