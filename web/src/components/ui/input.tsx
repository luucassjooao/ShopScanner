import * as React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-12 w-full rounded-campo border border-borda bg-superficie px-3.5 text-corpo text-texto',
        'placeholder:text-texto-secundario/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acao focus-visible:ring-offset-2 focus-visible:ring-offset-fundo',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'file:border-0 file:bg-transparent file:text-corpo-sm file:font-semibold',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
