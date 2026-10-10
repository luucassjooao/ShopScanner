import { createHash } from 'node:crypto';
import { AppError } from '../lib/errors.ts';
import * as repo from '../repositories/avatars.ts';

/** SUPOSTO: o contrato não fixa tamanho de foto. 2 MB cobre qualquer selfie de celular comprimida. */
const LIMITE_AVATAR_BYTES = 2 * 1024 * 1024;

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Tipo pelos bytes, nunca pelo Content-Type que o cliente declara. */
function tipoDaImagem(b: Buffer): string | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b.subarray(0, 8).equals(PNG)) return 'image/png';
  if (
    b.length >= 12 &&
    b.subarray(0, 4).toString('ascii') === 'RIFF' &&
    b.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

/** Troca a foto. O hash entra na URL: trocar a imagem troca o `?v=`, e o navegador não mantém a antiga. */
export async function trocar(userId: string, conteudo: Buffer) {
  if (conteudo.length > LIMITE_AVATAR_BYTES) throw AppError.validacao('Imagem acima de 2 MB');
  const mime = tipoDaImagem(conteudo);
  if (!mime) throw AppError.validacao('Envie uma imagem JPEG, PNG ou WebP');
  const hash = createHash('sha256').update(conteudo).digest('hex').slice(0, 16);
  await repo.gravar(userId, { content: conteudo, mime, hash });
  return { avatarUrl: `/me/avatar?v=${hash}` };
}

export async function ler(userId: string) {
  const linha = await repo.ler(userId);
  if (!linha) throw AppError.naoEncontrado('Sem foto de perfil');
  return linha;
}
