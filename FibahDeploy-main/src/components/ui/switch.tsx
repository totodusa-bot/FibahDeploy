import * as React from "react";
type Props = { id?: string; checked: boolean; onCheckedChange: (v: boolean) => void; className?: string; };
export function Switch({ id, checked, onCheckedChange, className="" }: Props) {
  return (
    <button id={id} type="button" onClick={() => onCheckedChange(!checked)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${checked ? "bg-emerald-600" : "bg-slate-300"} ${className}`} aria-pressed={checked} aria-label="toggle">
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${checked ? "translate-x-5" : "translate-x-1"}`} />
    </button>
  );
}
