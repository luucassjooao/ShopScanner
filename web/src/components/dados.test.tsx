import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ApiError } from '@/api/client';
import { EstadoErro } from './dados';

describe('EstadoErro', () => {
  it('não mostra o código interno da categoria, nem a data do erro', () => {
    render(
      <EstadoErro
        titulo="Não conseguimos carregar as divergências"
        error={new ApiError('nao_encontrado', { status: 404 })}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText('Não encontramos o que você procura.')).toBeInTheDocument();
    expect(screen.queryByText(/Código do erro/)).not.toBeInTheDocument();
    expect(screen.queryByText(/nao_encontrado/)).not.toBeInTheDocument();
  });

  it('erro que não é da API também não mostra código', () => {
    render(<EstadoErro titulo="Algo quebrou" error={new Error('boom')} onRetry={vi.fn()} />);
    expect(screen.getByText(/Algo deu errado/)).toBeInTheDocument();
    expect(screen.queryByText(/desconhecido|Código/)).not.toBeInTheDocument();
  });
});
