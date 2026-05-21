"use client";

import type { ReactNode } from "react";
import React from "react";
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
    <DialogContent className={`bg-white ${className}`} {...props}>
      {children}
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
  return <div className={`mb-4 ${className}`}>{children}</div>;
}

export function AlertDialogTitle({
  children,
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return <h2 className={`text-lg font-bold ${className}`}>{children}</h2>;
}

export function AlertDialogDescription({
  children,
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <p className={`text-sm text-gray-600 mb-4 ${className}`}>{children}</p>
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
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 ${className}`}
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
      onClick={onClick}
      className={`px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
