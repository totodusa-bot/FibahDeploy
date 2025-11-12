import * as React from "react";

type Variant = "default" | "destructive";

export function Alert({
  className = "",
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: Variant }) {
  const base = "rounded-md border p-4";
  const styles =
    variant === "destructive"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-slate-200 bg-white text-slate-900";
  return <div role="alert" className={`${base} ${styles} ${className}`} {...props} />;
}

export function AlertDescription({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={`text-sm ${className}`} {...props} />;
}
