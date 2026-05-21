import React from "react";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className = "", ...props }, ref) => (
  <textarea
    ref={ref}
    className={`
      w-full px-3 py-2 border border-gray-300 rounded-lg
      bg-white text-gray-900 placeholder:text-gray-500
      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
      disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed
      ${className}
    `}
    {...props}
  />
));
Textarea.displayName = "Textarea";
