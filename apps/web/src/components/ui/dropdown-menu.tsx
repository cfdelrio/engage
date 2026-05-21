import type { ReactNode } from "react";
import React from "react";

export function DropdownMenu({ children }: { children: ReactNode }) {
  return <div className="relative inline-block">{children}</div>;
}

export function DropdownMenuTrigger({
  children,
  asChild,
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  asChild?: boolean;
  children?: ReactNode;
}) {
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement, props);
  }
  return <div {...props}>{children}</div>;
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
  const alignClass = align === "end" ? "right-0" : "left-0";
  return (
    <div
      className={`absolute ${alignClass} mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50 ${className}`}
    >
      {children}
    </div>
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
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(
      children as React.ReactElement<{
        className?: string;
        onClick?: () => void;
      }>,
      {
        ...props,
        onClick,
        className: `block w-full text-left px-4 py-2 hover:bg-gray-100 ${className}`,
      },
    );
  }
  return (
    <button
      onClick={onClick}
      className={`block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
