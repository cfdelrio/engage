import React from 'react';

export interface SeparatorProps extends React.HTMLAttributes<HTMLHRElement> {}

export const Separator = React.forwardRef<HTMLHRElement, SeparatorProps>(
  (props, ref) => (
    <hr
      ref={ref}
      className="border-slate-200"
      {...props}
    />
  )
);

Separator.displayName = 'Separator';
