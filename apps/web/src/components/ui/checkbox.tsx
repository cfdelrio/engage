import React from 'react';

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  (props, ref) => (
    <input
      ref={ref}
      type="checkbox"
      className="w-4 h-4 border-slate-300 rounded cursor-pointer"
      {...props}
    />
  )
);

Checkbox.displayName = 'Checkbox';
