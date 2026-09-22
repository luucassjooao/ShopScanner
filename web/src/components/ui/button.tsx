import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * CLAUDE.md: primário é coral com texto escuro; secundário é contorno e texto em ação forte.
 * Nunca texto branco sobre coral ou pêssego.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-campo font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acao focus-visible:ring-offset-2 focus-visible:ring-offset-fundo disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-[1.125em] [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-coral text-texto hover:bg-coral-300',
        secondary: 'border-[1.5px] border-acao bg-superficie text-acao hover:bg-fundo',
        outline: 'border border-borda bg-superficie text-texto hover:bg-fundo',
        ghost: 'text-texto hover:bg-fundo',
        link: 'text-acao underline-offset-4 hover:underline',
        destructive:
          'border-[1.5px] border-status-reembolsado bg-superficie text-status-reembolsado hover:bg-status-reembolsado-suave',
      },
      size: {
        default: 'h-12 px-5 text-corpo',
        sm: 'h-10 px-4 text-corpo-sm',
        lg: 'h-[52px] px-6 text-corpo',
        icon: 'size-11',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...(asChild ? {} : { type: type ?? 'button' })}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
