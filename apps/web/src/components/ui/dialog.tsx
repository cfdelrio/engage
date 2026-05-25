import React from "react";
import { X } from "lucide-react";

export function Dialog({
  children,
  open,
  onOpenChange,
}: {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 pl-56"
      onClick={() => onOpenChange?.(false)}
    >
      {children}
    </div>
  );
}

export function DialogTrigger({
  children,
  asChild,
  ...props
}: React.HTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  children?: React.ReactNode;
}) {
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement, props);
  }
  return <button {...props}>{children}</button>;
}

export function DialogContent({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`relative bg-card rounded-xl shadow-2xl border border-border w-full max-w-lg mx-4 ${className}`}
      onClick={(e) => e.stopPropagation()}
      {...props}
    >
      {children}
    </div>
  );
}

export function DialogClose({ onClose }: { onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      className="absolute top-4 right-4 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      aria-label="Close"
    >
      <X className="h-4 w-4" />
    </button>
  );
}

export function DialogHeader({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`px-6 pt-6 pb-4 ${className}`} {...props} />;
}

export function DialogTitle({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={`text-base font-semibold text-foreground ${className}`}
      {...props}
    />
  );
}

export function DialogDescription({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={`text-sm text-muted-foreground mt-1 ${className}`}
      {...props}
    />
  );
}
