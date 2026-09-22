import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * CLAUDE.md: status de comissão sempre com o rótulo escrito junto — a cor nunca carrega
 * o significado sozinha. Por isso não existe variante "só bolinha".
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold',
  {
    variants: {
      variant: {
        neutro: 'bg-fundo text-texto-secundario',
        marca: 'bg-pessego text-texto',
        liquidado: 'bg-status-liquidado-suave text-status-liquidado',
        'a-liquidar': 'bg-status-a-liquidar-suave text-status-a-liquidar',
        aguardando: 'bg-status-aguardando-suave text-status-aguardando',
        reembolsado: 'bg-status-reembolsado-suave text-status-reembolsado',
        retido: 'bg-status-retido-suave text-status-retido',
      },
    },
    defaultVariants: { variant: 'neutro' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
