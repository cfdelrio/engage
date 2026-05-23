import React from "react";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className = "", ...props }, ref) => (
  <input
    ref={ref}
    className={`w-full px-3.5 py-2 border border-input rounded-lg bg-card text-foreground placeholder:text-muted-foreground text-sm
        focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary/50 transition-colors
        disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed ${className}`}
    {...props}
  />
));
Input.displayName = "Input";
