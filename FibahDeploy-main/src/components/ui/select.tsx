import * as React from "react";

type SelectCtx = {
  value?: string;
  defaultValue?: string;
  onValueChange?: (v: string) => void;
  placeholder?: string;
  className?: string;
  children?: React.ReactNode;
};

export function Select({ value, defaultValue, onValueChange, children, className }: SelectCtx) {
  const items: { value: string; label: React.ReactNode }[] = [];
  let placeholder: string | undefined;

  function collect(node: React.ReactNode) {
    React.Children.forEach(node, (child) => {
      if (!React.isValidElement(child)) return;
      const t: any = child.type;

      if (t && t.__isSelectItem) {
        items.push({ value: child.props.value, label: child.props.children });
      } else if (t && t.__isSelectValue) {
        placeholder = child.props?.placeholder;
      }
      if ((child as any).props?.children) collect((child as any).props.children);
    });
  }
  collect(children);

  const controlled = value !== undefined;
  const [internal, setInternal] = React.useState<string>(defaultValue ?? "");
  const current = controlled ? (value as string) : internal;

  const handle = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    if (!controlled) setInternal(v);
    onValueChange?.(v);
  };

  return (
    <div className={className}>
      <select
        value={current}
        onChange={handle}
        className="w-full h-12 rounded-md border-2 border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
      >
        <option value="" disabled hidden>
          {placeholder ?? "Select an option"}
        </option>
        {items.map((it) => (
          <option key={it.value} value={it.value}>
            {typeof it.label === "string" ? it.label : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

export function SelectTrigger({ className = "", children }: { className?: string; children?: React.ReactNode }) {
  return <div className={className}>{children}</div>;
}
export function SelectValue({ placeholder }: { placeholder?: string }) {
  return null;
}
(SelectValue as any).__isSelectValue = true;

export function SelectContent({ className = "", children }: { className?: string; children?: React.ReactNode }) {
  return <div className={className}>{children}</div>;
}

export function SelectItem({ value, children }: { value: string; children: React.ReactNode }) {
  return null;
}
(SelectItem as any).__isSelectItem = true;

export default Select;
