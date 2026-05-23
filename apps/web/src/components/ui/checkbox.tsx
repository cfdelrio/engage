"use client";

import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxProps {
  id?: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ id, checked = false, onCheckedChange, disabled = false, className }, ref) => (
    <button
      ref={ref}
      id={id}
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onCheckedChange?.(!checked)}
      className={cn(
        "h-4 w-4 shrink-0 rounded border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        checked
          ? "bg-primary border-primary"
          : "bg-card border-input hover:border-primary/60",
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
    >
      {checked && (
        <Check className="h-3 w-3 text-primary-foreground mx-auto stroke-[3]" />
      )}
    </button>
  ),
);
Checkbox.displayName = "Checkbox";
