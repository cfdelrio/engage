import React from 'react';

export const Separator = React.forwardRef<HTMLHRElement, React.HTMLAttributes<HTMLHRElement>>(
  (props, ref) => (
    <hr
      ref={ref}
      className="border-slate-200"
      {...props}
    />
  )
);

Separator.displayName = 'Separator';
