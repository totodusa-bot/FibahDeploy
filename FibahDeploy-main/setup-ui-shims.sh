#!/usr/bin/env bash
set -euo pipefail

mkdir -p src/components/ui

# button.tsx
cat > src/components/ui/button.tsx <<'TS'
import * as React from "react";
type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "icon";
};
export function Button({ className = "", variant = "default", size = "default", ...props }: Props) {
  const base = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none disabled:opacity-50 disabled:pointer-events-none";
  const variants = { default: "bg-emerald-700 text-white hover:bg-emerald-800", outline: "border border-slate-300 hover:bg-slate-50", ghost: "hover:bg-slate-100" } as const;
  const sizes = { default: "h-10 px-4 py-2", icon: "h-10 w-10" } as const;
  return <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props} />;
}
TS

# card.tsx
cat > src/components/ui/card.tsx <<'TS'
import * as React from "react";
export function Card({ className="", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-xl border bg-white ${className}`} {...props} />;
}
export function CardHeader({ className="", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-t-xl p-4 ${className}`} {...props} />;
}
export function CardContent({ className="", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`p-4 ${className}`} {...props} />;
}
export function CardTitle({ className="", ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={`text-lg font-semibold leading-none tracking-tight ${className}`} {...props} />;
}
TS

# textarea.tsx
cat > src/components/ui/textarea.tsx <<'TS'
import * as React from "react";
export function Textarea({ className="", ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`w-full rounded-md border border-slate-300 p-2 focus:outline-none focus:ring-2 focus:ring-emerald-600 ${className}`} {...props} />;
}
TS

# label.tsx
cat > src/components/ui/label.tsx <<'TS'
import * as React from "react";
export function Label({ className="", ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={`text-sm font-medium text-slate-800 ${className}`} {...props} />;
}
TS

# alert.tsx
cat > src/components/ui/alert.tsx <<'TS'
import * as React from "react";
export function Alert({ className="", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div role="alert" className={`rounded-md border p-4 ${className}`} {...props} />;
}
export function AlertDescription({ className="", ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={`text-sm ${className}`} {...props} />;
}
TS

# switch.tsx
cat > src/components/ui/switch.tsx <<'TS'
import * as React from "react";
type Props = { id?: string; checked: boolean; onCheckedChange: (v: boolean) => void; className?: string; };
export function Switch({ id, checked, onCheckedChange, className="" }: Props) {
  return (
    <button
      id={id}
      type="button"
      onClick={() => onCheckedChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${checked ? "bg-emerald-600" : "bg-slate-300"} ${className}`}
      aria-pressed={checked}
      aria-label="toggle"
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${checked ? "translate-x-5" : "translate-x-1"}`} />
    </button>
  );
}
TS
