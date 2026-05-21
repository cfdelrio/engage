import React from 'react';

export function Table({ className = '', ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return <table className={`w-full border-collapse ${className}`} {...props} />;
}

export function TableHeader(
  props: React.HTMLAttributes<HTMLTableSectionElement>
) {
  return <thead {...props} />;
}

export function TableBody(
  props: React.HTMLAttributes<HTMLTableSectionElement>
) {
  return <tbody {...props} />;
}

export function TableRow({ className = '', ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={`border-b border-slate-200 hover:bg-slate-50 ${className}`} {...props} />
  );
}

export function TableHead({ className = '', ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={`px-4 py-3 text-left text-sm font-semibold text-slate-900 bg-slate-50 ${className}`}
      {...props}
    />
  );
}

export function TableCell({ className = '', ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={`px-4 py-3 text-sm ${className}`} {...props} />;
}
