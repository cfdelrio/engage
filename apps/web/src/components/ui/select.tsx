import React from 'react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}
export interface SelectContentProps extends React.HTMLAttributes<HTMLDivElement> {}
export interface SelectItemProps extends React.OptionHTMLAttributes<HTMLOptionElement> {}
export interface SelectTriggerProps extends React.HTMLAttributes<HTMLDivElement> {}
export interface SelectValueProps extends React.HTMLAttributes<HTMLSpanElement> {}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (props, ref) => (
    <select
      ref={ref}
      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      {...props}
    />
  )
);

Select.displayName = 'Select';

export const SelectContent = React.forwardRef<HTMLDivElement, SelectContentProps>(
  (props, ref) => <div ref={ref} {...props} />
);
SelectContent.displayName = 'SelectContent';

export const SelectItem = React.forwardRef<HTMLOptionElement, SelectItemProps>(
  (props, ref) => <option ref={ref} {...props} />
);
SelectItem.displayName = 'SelectItem';

export const SelectTrigger = React.forwardRef<HTMLDivElement, SelectTriggerProps>(
  (props, ref) => <div ref={ref} {...props} />
);
SelectTrigger.displayName = 'SelectTrigger';

export const SelectValue = React.forwardRef<HTMLSpanElement, SelectValueProps>(
  (props, ref) => <span ref={ref} {...props} />
);
SelectValue.displayName = 'SelectValue';
