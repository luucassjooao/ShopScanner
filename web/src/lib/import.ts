import type { ImportBatch, ImportErroCodigo } from '@/api/schemas';
import { EMAIL_CONTATO } from './textos';

/**
 * O que mostrar para cada erro de import. A API manda o código; a orientação mora aqui.
 *
 * Toda falha tem saída: o texto diz o que aconteceu e o que fazer em seguida. A mensagem
 * técnica que vier em `error.message` não vai para a tela — ela serve para o suporte.
 */
/** Teto por arquivo, conforme `docs/parser-affiliate-orders.md`. */
export const LIMITE_MB = 50;
const LIMITE_BYTES = LIMITE_MB * 1024 * 1024;

export interface OrientacaoErro {
  titulo: string;
  comoResolver: string;
}

const ORIENTACOES: Record<ImportErroCodigo, OrientacaoErro> = {
  WRONG_EXTENSION: {
    titulo: 'Só conseguimos ler arquivos .xlsx',
    comoResolver:
      'Se o seu arquivo é .csv ou .xls, abra no Excel ou no Google Planilhas e salve de novo como .xlsx.',
  },
  TOO_LARGE: {
    titulo: `O arquivo passa de ${LIMITE_MB} MB`,
    comoResolver:
      'Exporte um período menor no Centro de Afiliados, por exemplo um mês de cada vez, e envie um arquivo por vez.',
  },
  NO_HEADER: {
    titulo: 'Não achamos o cabeçalho das colunas',
    comoResolver:
      'Confira se o arquivo não está vazio, se os dados estão na primeira aba e se não há linha em branco antes do cabeçalho. Reexportar do TikTok costuma resolver.',
  },
  UNKNOWN_COLUMNS: {
    titulo: 'Não reconhecemos as colunas deste arquivo',
    comoResolver: `Isso costuma acontecer quando a conta do TikTok está em outro idioma. Fale com a gente em ${EMAIL_CONTATO} e mandamos o arquivo para mapear.`,
  },
  WRONG_CURRENCY: {
    titulo: 'Este arquivo não está em reais',
    comoResolver:
      'Por enquanto só importamos pedidos em real. Exporte o relatório da conta do Brasil.',
  },
  WRONG_FILE: {
    titulo: 'Este não parece ser o relatório de pedidos',
    comoResolver:
      'O arquivo certo é o affiliate_orders.xlsx, exportado do Centro de Afiliados dentro do app do TikTok.',
  },
  FAILED: {
    titulo: 'O arquivo chegou, mas o processamento falhou',
    comoResolver: `Tente enviar de novo. Se acontecer outra vez, fale com a gente em ${EMAIL_CONTATO} contando a data do relatório.`,
  },
};

export const orientacaoDoErro = (codigo: ImportErroCodigo) => ORIENTACOES[codigo];

/**
 * Recusa que dá para ver antes de enviar. A API confere de novo — ela é a autoridade —
 * mas mandar 50 MB para ouvir "não" é cruel com quem está no celular, usando dados.
 */
export function recusaLocal(arquivo: File): ImportErroCodigo | null {
  if (!arquivo.name.toLowerCase().endsWith('.xlsx')) return 'WRONG_EXTENSION';
  if (arquivo.size > LIMITE_BYTES) return 'TOO_LARGE';
  return null;
}

/** "12 novas, 3 atualizadas, 48 sem mudança" — o resultado em uma frase. */
export function resumoDoResultado(result: NonNullable<ImportBatch['result']>) {
  const partes = [
    `${result.created} ${result.created === 1 ? 'nova' : 'novas'}`,
    `${result.updated} ${result.updated === 1 ? 'atualizada' : 'atualizadas'}`,
    `${result.unchanged} sem mudança`,
  ];
  if (result.skipped > 0)
    partes.push(`${result.skipped} ignorada${result.skipped === 1 ? '' : 's'}`);
  return partes.join(', ');
}

/** Um import ainda em andamento: a tela continua perguntando ao backend. */
export const emAndamento = (b: Pick<ImportBatch, 'status'>) =>
  b.status === 'QUEUED' || b.status === 'PROCESSING';
