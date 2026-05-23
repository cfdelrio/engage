import React from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className = "",
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?:
    | "default"
    | "outline"
    | "secondary"
    | "destructive"
    | "success"
    | "warning"
    | "info";
}) {
  const variantClasses: Record<string, string> = {
    default: "bg-primary/10 text-primary border border-primary/20",
    outline: "border border-border text-foreground bg-transparent",
    secondary: "bg-muted text-muted-foreground",
    destructive:
      "bg-destructive/10 text-destructive border border-destructive/20",
    success: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border border-amber-200",
    info: "bg-blue-50 text-blue-700 border border-blue-200",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
