import React from 'react';

export function Dialog({ children, open }: { children: React.ReactNode; open?: boolean }) {
  return <div>{children}</div>;
}

export function DialogTrigger({ children, ...props }: React.HTMLAttributes<HTMLButtonElement>) {
  return <button {...props}>{children}</button>;
}

export function DialogContent({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`fixed inset-0 z-50 bg-black/50 flex items-center justify-center ${className}`}
      {...props}
    />
  );
}

export function DialogHeader({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`border-b px-6 py-4 ${className}`} {...props} />;
}

export function DialogTitle({ className = '', ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={`text-lg font-semibold text-slate-900 ${className}`} {...props} />;
}
