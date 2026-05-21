import React from 'react';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  (props, ref) => (
    <label
      ref={ref}
      className="block text-sm font-medium text-slate-900"
      {...props}
    />
  )
);

Label.displayName = 'Label';
