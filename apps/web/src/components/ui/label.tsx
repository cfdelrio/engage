import React from 'react';

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  (props, ref) => (
    <label
      ref={ref}
      className="block text-sm font-medium text-slate-900"
      {...props}
    />
  )
);

Label.displayName = 'Label';
