import * as React from "react";
export function Textarea({ className="", ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`w-full rounded-md border border-slate-300 p-2 focus:outline-none focus:ring-2 focus:ring-emerald-600 ${className}`} {...props} />;
}
