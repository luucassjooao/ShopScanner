/** Força da senha, como no design: um ponto por critério atendido (0 a 4). */
export function forcaDaSenha(senha: string): number {
  let pontos = 0;
  if (senha.length >= 8) pontos++;
  if (/[a-z]/.test(senha) && /[A-Z]/.test(senha)) pontos++;
  if (/\d/.test(senha)) pontos++;
  if (/[^A-Za-z0-9]/.test(senha)) pontos++;
  return pontos;
}

export const ROTULO_FORCA = ['Muito fraca', 'Fraca', 'Média', 'Boa', 'Forte'];
