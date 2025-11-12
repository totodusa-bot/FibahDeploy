import * as React from "react";
type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default"|"outline"|"ghost"; size?: "default"|"icon"; };
export function Button({ className = "", variant = "default", size = "default", ...props }: Props) {
  const base = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none disabled:opacity-50 disabled:pointer-events-none";
  const variants = { default: "bg-emerald-700 text-white hover:bg-emerald-800", outline: "border border-slate-300 hover:bg-slate-50", ghost: "hover:bg-slate-100" } as const;
  const sizes = { default: "h-10 px-4 py-2", icon: "h-10 w-10" } as const;
  return <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props} />;
}
