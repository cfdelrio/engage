"use client";

import type { ReactNode } from "react";
import React from "react";
import { AlertTriangle } from "lucide-react";
import { Dialog, DialogContent } from "./dialog";

export function AlertDialog({
  open,
  onOpenChange,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children}
    </Dialog>
  );
}

export function AlertDialogTrigger({
  children,
  asChild,
  ...props
}: React.HTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  children?: ReactNode;
}) {
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement, props);
  }
  return <button {...props}>{children}</button>;
}

export function AlertDialogContent({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) {
  return (
    <DialogContent className={`max-w-sm ${className}`} {...props}>
      <div className="px-6 pt-6 pb-5 space-y-4">{children}</div>
    </DialogContent>
  );
}

export function AlertDialogHeader({
  children,
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}

export function AlertDialogTitle({
  children,
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-4 w-4 text-destructive" />
      </div>
      <h2 className={`text-base font-semibold text-foreground ${className}`}>
        {children}
      </h2>
    </div>
  );
}

export function AlertDialogDescription({
  children,
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <p className={`text-sm text-muted-foreground pl-12 ${className}`}>
      {children}
    </p>
  );
}

export function AlertDialogFooter({
  children,
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex justify-end gap-2 pt-4 border-t border-border ${className}`}
    >
      {children}
    </div>
  );
}

export function AlertDialogAction({
  children,
  onClick,
  disabled = false,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-destructive text-white hover:bg-destructive/90 disabled:opacity-50 disabled:pointer-events-none ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function AlertDialogCancel({
  children,
  onClick,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-input bg-background text-foreground hover:bg-accent disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
