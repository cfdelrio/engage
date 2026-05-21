import React from 'react';

export function Badge({ className = '', ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${className}`}
      {...props}
    />
  );
}
