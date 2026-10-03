import type { ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { OrderStatus } from '@/api/schemas';
import { COR, COR_STATUS, paraGrafico } from './cores';
import { formatMoeda } from '@/lib/format';
import { STATUS_LABEL } from '@/lib/labels';

/**
 * Gráficos do Início (CLAUDE.md → Gráficos): série principal #C0442C, comparação em cinza
 * tracejado, rosca na paleta de status, texto sempre nos tokens de texto.
 * Os valores chegam em número só para desenhar; o texto mostrado vem do decimal em string.
 */
const eixo = { fill: COR.secundario, fontSize: 12 };
const tooltipEstilo = {
  borderRadius: 8,
  borderColor: COR.grade,
  color: COR.texto,
  fontSize: 13,
};

const compacto = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });

/** Tabela alternativa de todo gráfico. */
export function TabelaAlternativa({
  colunas,
  linhas,
}: {
  colunas: string[];
  linhas: ReactNode[][];
}) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-semibold text-acao">Ver em tabela</summary>
      <div className="mt-2 max-h-64 overflow-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-texto-secundario">
              {colunas.map((c, i) => (
                <th key={c} className={i ? 'py-1 text-right' : 'py-1'}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={i} className="border-t border-borda">
                {l.map((c, j) => (
                  <td key={j} className={j ? 'py-1.5 text-right tabular-nums' : 'py-1.5'}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export interface PontoDia {
  /** `22/09` */
  rotulo: string;
  valor: string;
}

export function BarrasPorDia({
  pontos,
  nome,
  formatar = formatMoeda,
}: {
  pontos: PontoDia[];
  nome: string;
  formatar?: (v: string) => string;
}) {
  const dados = pontos.map((p) => ({ ...p, n: paraGrafico(p.valor) }));
  return (
    <>
      <div className="h-[130px] lg:h-[190px]" role="img" aria-label={`${nome} por dia`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={dados}
            margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
            barCategoryGap={2}
          >
            <CartesianGrid vertical={false} stroke={COR.grade} />
            <XAxis
              dataKey="rotulo"
              tick={eixo}
              tickLine={false}
              axisLine={{ stroke: COR.grade }}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis hide />
            <Tooltip
              cursor={{ fill: COR.grade, opacity: 0.6 }}
              contentStyle={tooltipEstilo}
              formatter={(_v, _n, item) => [formatar((item.payload as PontoDia).valor), nome]}
            />
            <Bar
              dataKey="n"
              fill={COR.serie}
              radius={[3, 3, 0, 0]}
              maxBarSize={24}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <TabelaAlternativa
        colunas={['Dia', nome]}
        linhas={pontos.map((p) => [p.rotulo, formatar(p.valor)])}
      />
    </>
  );
}

export interface PontoAcumulado {
  rotulo: string;
  atual: string;
  anterior: string | null;
}

export function LinhaAcumulada({ pontos }: { pontos: PontoAcumulado[] }) {
  const dados = pontos.map((p) => ({
    ...p,
    a: paraGrafico(p.atual),
    b: p.anterior === null ? null : paraGrafico(p.anterior),
  }));
  return (
    <>
      <div className="flex gap-4 text-xs font-semibold text-texto-secundario">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded" style={{ background: COR.serie }} />
          Este período
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-0 w-4 border-t-2 border-dashed"
            style={{ borderColor: COR.comparacao }}
          />
          Período anterior
        </span>
      </div>
      <div
        className="h-[130px] lg:h-[150px]"
        role="img"
        aria-label="GMV acumulado, este período e o anterior"
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dados} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={COR.grade} />
            <XAxis
              dataKey="rotulo"
              tick={eixo}
              tickLine={false}
              axisLine={{ stroke: COR.grade }}
              interval="preserveStartEnd"
              minTickGap={28}
            />
            <YAxis
              tick={eixo}
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={(v: number) => compacto.format(v)}
            />
            <Tooltip
              contentStyle={tooltipEstilo}
              formatter={(_v, nome, item) => {
                const p = item.payload as PontoAcumulado;
                return nome === 'a'
                  ? [formatMoeda(p.atual), 'Este período']
                  : [p.anterior === null ? '—' : formatMoeda(p.anterior), 'Período anterior'];
              }}
            />
            <Line
              dataKey="b"
              stroke={COR.comparacao}
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
            <Line
              dataKey="a"
              stroke={COR.serie}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, stroke: '#FFFFFF', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <TabelaAlternativa
        colunas={['Dia', 'Este período', 'Anterior']}
        linhas={pontos.map((p) => [
          p.rotulo,
          formatMoeda(p.atual),
          p.anterior === null ? '—' : formatMoeda(p.anterior),
        ])}
      />
    </>
  );
}

export function RoscaStatus({ fatias }: { fatias: { status: OrderStatus; valor: string }[] }) {
  const dados = fatias
    .filter((f) => paraGrafico(f.valor) > 0)
    .map((f) => ({ ...f, n: paraGrafico(f.valor) }));
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div className="size-40 shrink-0" role="img" aria-label="GMV por status">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              contentStyle={tooltipEstilo}
              formatter={(_v, _n, item) => {
                const f = item.payload as (typeof dados)[number];
                return [formatMoeda(f.valor), STATUS_LABEL[f.status]];
              }}
            />
            <Pie
              data={dados}
              dataKey="n"
              innerRadius="62%"
              outerRadius="100%"
              stroke="#FFFFFF"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {dados.map((f) => (
                <Cell key={f.status} fill={COR_STATUS[f.status]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* A legenda é a tabela: cor, rótulo escrito e valor. */}
      <ul className="flex w-full flex-col gap-2.5">
        {fatias.map((f) => (
          <li key={f.status} className="flex items-center gap-2.5 text-sm">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: COR_STATUS[f.status] }}
            />
            <span className="flex-1 text-texto">{STATUS_LABEL[f.status]}</span>
            <span className="font-bold tabular-nums text-texto">{formatMoeda(f.valor)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Barras horizontais com rótulo e valor escritos: a própria lista é a tabela. */
export function BarrasHorizontais({ itens }: { itens: { rotulo: string; valor: string }[] }) {
  const max = Math.max(...itens.map((i) => paraGrafico(i.valor)), 0);
  return (
    <ul className="flex flex-col gap-3">
      {itens.map((i) => (
        <li key={i.rotulo} className="flex flex-col gap-1.5">
          <span className="flex justify-between gap-3 text-sm">
            <span className="text-texto">{i.rotulo}</span>
            <span className="font-bold tabular-nums text-texto">{formatMoeda(i.valor)}</span>
          </span>
          <span className="h-2 overflow-hidden rounded-full bg-borda" aria-hidden>
            <span
              className="block h-full rounded-full"
              style={{
                width: `${max ? (paraGrafico(i.valor) / max) * 100 : 0}%`,
                background: COR.serie,
              }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}
