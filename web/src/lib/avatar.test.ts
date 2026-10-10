import { describe, expect, it } from 'vitest';
import { recusaLocalAvatar } from './avatar';

const arquivo = (nome: string, tamanho = 1024) =>
  new File([new Uint8Array(tamanho)], nome, { type: 'image/png' });

describe('recusaLocalAvatar', () => {
  it('aceita JPEG, PNG e WebP dentro do teto', () => {
    expect(recusaLocalAvatar(arquivo('foto.jpg'))).toBeNull();
    expect(recusaLocalAvatar(arquivo('foto.JPEG'))).toBeNull();
    expect(recusaLocalAvatar(arquivo('foto.png'))).toBeNull();
    expect(recusaLocalAvatar(arquivo('foto.webp'))).toBeNull();
  });

  it('acima de 2 MB é IMAGEM_MUITO_GRANDE, e o teto é o do contrato', () => {
    expect(recusaLocalAvatar(arquivo('foto.png', 2 * 1024 * 1024))).toBeNull();
    expect(recusaLocalAvatar(arquivo('foto.png', 2 * 1024 * 1024 + 1))).toBe('IMAGEM_MUITO_GRANDE');
  });

  it('extensão fora dos formatos é IMAGEM_INVALIDA, sem gastar o envio', () => {
    expect(recusaLocalAvatar(arquivo('foto.gif'))).toBe('IMAGEM_INVALIDA');
    expect(recusaLocalAvatar(arquivo('foto.heic'))).toBe('IMAGEM_INVALIDA');
    expect(recusaLocalAvatar(arquivo('foto'))).toBe('IMAGEM_INVALIDA');
  });
});
