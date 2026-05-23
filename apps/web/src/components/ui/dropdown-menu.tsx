"use client";

import type { ReactNode } from "react";
import React, { useState, useRef, useEffect, useContext } from "react";
import { createPortal } from "react-dom";

interface DropdownContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRect: DOMRect | null;
  setTriggerRect: (rect: DOMRect | null) => void;
}

const DropdownContext = React.createContext<DropdownContextType | undefined>(
  undefined,
);

export function DropdownMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);

  return (
    <DropdownContext.Provider value={{ open, setOpen, triggerRect, setTriggerRect }}>
      <div className="relative inline-block">{children}</div>
    </DropdownContext.Provider>
  );
}

export function DropdownMenuTrigger({
  children,
  asChild,
}: {
  asChild?: boolean;
  children?: ReactNode;
}) {
  const context = useContext(DropdownContext);
  if (!context) throw new Error("DropdownMenuTrigger must be used within DropdownMenu");

  const { setOpen, open, setTriggerRect } = context;

  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    if (!open) {
      setTriggerRect(e.currentTarget.getBoundingClientRect());
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  if (asChild && React.isValidElement(children)) {
    return (
      <span onClick={handleClick} className="inline-flex">
        {children}
      </span>
    );
  }

  return (
    <button type="button" onClick={handleClick}>
      {children}
    </button>
  );
}

export function DropdownMenuContent({
  children,
  align = "start",
  className = "",
}: {
  children: ReactNode;
  align?: "start" | "center" | "end";
  className?: string;
}) {
  const context = useContext(DropdownContext);
  if (!context)
    throw new Error("DropdownMenuContent must be used within DropdownMenu");

  const { open, setOpen, triggerRect } = context;
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("click", handleOutside);
    return () => document.removeEventListener("click", handleOutside);
  }, [open, setOpen]);

  if (!open || !triggerRect) return null;

  const menuWidth = 192; // w-48
  const top = triggerRect.bottom + 4;
  const left =
    align === "end" ? triggerRect.right - menuWidth : triggerRect.left;

  return createPortal(
    <div
      ref={menuRef}
      style={{ top, left }}
      className={`fixed w-48 bg-card border border-border rounded-lg shadow-lg z-[100] py-1 ${className}`}
    >
      {children}
    </div>,
    document.body,
  );
}

export function DropdownMenuItem({
  children,
  onClick,
  className = "",
  asChild,
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  asChild?: boolean;
  onClick?: () => void;
  children?: ReactNode;
}) {
  const context = useContext(DropdownContext);

  const handleClick = () => {
    onClick?.();
    context?.setOpen(false);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(
      children as React.ReactElement<{
        className?: string;
        onClick?: () => void;
      }>,
      {
        ...props,
        onClick: handleClick,
        className: `flex items-center w-full text-left px-3 py-2 text-sm hover:bg-accent text-foreground rounded-sm cursor-pointer ${className}`,
      },
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex items-center w-full text-left px-3 py-2 text-sm hover:bg-accent text-foreground rounded-sm ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
