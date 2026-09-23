import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDataHora, formatDiaMes, formatInteiro } from '@/lib/format';

/** CLAUDE.md → Gráficos: série única em #C0442C; texto nos tokens de texto; grade recessiva. */
const SERIE = '#C0442C';
const TEXTO_SECUNDARIO = '#6E5B57';
const GRADE = '#F1E4DF';

export interface PontoViews {
  at: string;
  views: number;
  likes: number;
}

/**
 * Views acumuladas ao longo do tempo, a partir dos snapshots que o backend guarda.
 * Sempre acompanhada da tabela com os mesmos pontos.
 */
export function CurvaViews({ pontos }: { pontos: PontoViews[] }) {
  const dados = [...pontos]
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((p) => ({ ...p, t: Date.parse(p.at) }));

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="text-corpo-sm font-bold text-texto">Views acumuladas</figcaption>

      {dados.length < 2 ? (
        <p className="text-corpo-sm text-texto-secundario">
          A curva aparece a partir da segunda leitura. Guardamos as views deste vídeo com
          frequência, então ela vai se formando nos próximos dias.
        </p>
      ) : (
        <div className="h-56 w-full" role="img" aria-label="Gráfico de views acumuladas por data">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dados} margin={{ top: 8, right: 24, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={GRADE} strokeWidth={1} />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(t: number) => formatDiaMes(new Date(t))}
                tick={{ fill: TEXTO_SECUNDARIO, fontSize: 12 }}
                axisLine={{ stroke: GRADE }}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v: number) => formatInteiro(v)}
                tick={{ fill: TEXTO_SECUNDARIO, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={64}
              />
              <Tooltip
                cursor={{ stroke: TEXTO_SECUNDARIO, strokeWidth: 1 }}
                labelFormatter={(t) => formatDataHora(new Date(Number(t)))}
                formatter={(v) => [formatInteiro(Number(v)), 'Views']}
                contentStyle={{
                  borderRadius: 8,
                  borderColor: GRADE,
                  color: '#2B1D1B',
                  fontSize: 13,
                }}
              />
              <Line
                type="monotone"
                dataKey="views"
                stroke={SERIE}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={false}
                activeDot={{ r: 5, fill: SERIE, stroke: '#FFFFFF', strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <details className="text-corpo-sm" open={dados.length < 2}>
        <summary className="cursor-pointer font-semibold text-acao">Ver em tabela</summary>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Leitura</TableHead>
              <TableHead className="text-right">Views</TableHead>
              <TableHead className="text-right">Curtidas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dados.map((p) => (
              <TableRow key={p.at}>
                <TableCell>{formatDataHora(p.at)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatInteiro(p.views)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatInteiro(p.likes)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </details>
    </figure>
  );
}
