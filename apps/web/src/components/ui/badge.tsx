import React from 'react';
import { cn } from '@/lib/utils';

export function Badge({
  className = '',
  variant = 'default',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: 'default' | 'outline' | 'secondary' | 'destructive';
}) {
  const variantClasses = {
    default: 'bg-slate-900 text-white',
    outline: 'border border-slate-300 text-slate-900 bg-white',
    secondary: 'bg-slate-100 text-slate-900',
    destructive: 'bg-red-600 text-white',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-sm font-medium',
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
