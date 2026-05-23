import * as React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "default"
    | "secondary"
    | "outline"
    | "ghost"
    | "destructive"
    | "subtle";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className = "", variant = "default", size = "default", ...props },
    ref,
  ) => {
    const base =
      "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 shrink-0";

    const variants: Record<string, string> = {
      default:
        "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-[0.98]",
      secondary: "bg-accent text-accent-foreground hover:bg-accent/80",
      outline:
        "border border-border bg-card text-foreground hover:bg-accent hover:text-accent-foreground",
      ghost: "text-foreground hover:bg-accent hover:text-accent-foreground",
      destructive:
        "bg-destructive text-white shadow-sm hover:bg-destructive/90 active:scale-[0.98]",
      subtle: "bg-muted text-muted-foreground hover:bg-muted/70",
    };

    const sizes: Record<string, string> = {
      default: "px-4 py-2 text-sm h-9",
      sm: "px-3 py-1.5 text-xs h-7",
      lg: "px-6 py-2.5 text-sm h-11",
      icon: "h-9 w-9 p-0",
    };

    return (
      <button
        ref={ref}
        className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
export { Button };
