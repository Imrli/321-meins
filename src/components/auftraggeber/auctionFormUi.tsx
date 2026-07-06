import type { ReactNode } from "react";

export function FormSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
      <div className="mt-3 space-y-5">{children}</div>
    </div>
  );
}

export function FormPartDivider({ title }: { title: string }) {
  return (
    <div className="relative py-2">
      <div className="absolute inset-0 flex items-center" aria-hidden>
        <div className="w-full border-t border-slate-200" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-white px-4 text-sm font-bold tracking-tight text-[var(--color-brand-700)]">
          {title}
        </span>
      </div>
    </div>
  );
}

export function DateTimeField({
  label,
  name,
  value,
  onChange,
  required,
  error,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
  required?: boolean;
  error?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700">
        {label}
        {required && (
          <span className="text-[var(--color-accent-600)]"> *</span>
        )}
      </span>
      <input
        type="datetime-local"
        name={name}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        className={
          error
            ? "mt-1.5 block w-full rounded-xl border border-red-500 bg-white px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-200"
            : "mt-1.5 block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 transition-colors focus:border-[var(--color-brand-400)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-200)]"
        }
      />
    </label>
  );
}

const inputBase =
  "mt-1.5 block w-full rounded-xl border px-4 py-3 text-sm text-slate-900 transition-colors focus:outline-none focus:ring-2";
const inputNormal = `${inputBase} border-slate-200 bg-white placeholder:text-slate-400 focus:border-[var(--color-brand-400)] focus:ring-[var(--color-brand-200)]`;
const inputError = `${inputBase} border-red-500 bg-white focus:border-red-500 focus:ring-red-200`;

type FieldProps = {
  label: string;
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
  error?: boolean;
  required?: boolean;
  readOnly?: boolean;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
};

export function AuctionField({
  label,
  name,
  value,
  onChange,
  error,
  required,
  readOnly,
  type = "text",
  placeholder,
  autoComplete,
  inputMode,
}: FieldProps) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700">
        {label}
        {required && (
          <span className="text-[var(--color-accent-600)]"> *</span>
        )}
      </span>
      <input
        type={type}
        name={name}
        value={value}
        readOnly={readOnly}
        onChange={(e) => {
          if (readOnly) return;
          onChange(name, e.target.value);
        }}
        autoComplete={autoComplete}
        inputMode={inputMode}
        placeholder={placeholder}
        className={
          readOnly
            ? `${inputBase} cursor-default border-slate-200 bg-slate-50 text-slate-800 focus:border-slate-200 focus:ring-slate-100`
            : error
              ? inputError
              : inputNormal
        }
      />
    </label>
  );
}

type SelectProps = {
  label: string;
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
  options: { value: string; label: string }[];
  error?: boolean;
  required?: boolean;
  optional?: boolean;
};

export function AuctionSelect({
  label,
  name,
  value,
  onChange,
  options,
  error,
  required,
  optional,
}: SelectProps) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700">
        {label}
        {required && (
          <span className="text-[var(--color-accent-600)]"> *</span>
        )}
        {optional && (
          <span className="font-normal text-slate-400"> (optional)</span>
        )}
      </span>
      <select
        name={name}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        className={`${error ? inputError : inputNormal} cursor-pointer shadow-sm`}
      >
        {(required || (!required && !optional)) && (
          <option value="">Bitte wählen</option>
        )}
        {optional && <option value="">Keine Angabe</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function AuctionCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-3 transition-colors hover:bg-slate-50">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 shrink-0 cursor-pointer rounded border-slate-300 accent-[var(--color-accent-500)]"
      />
      <span className="text-sm text-slate-700">{label}</span>
    </label>
  );
}

export function AuctionTextarea({
  label,
  name,
  value,
  onChange,
  optional,
  placeholder,
  rows = 4,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
  optional?: boolean;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-slate-800">
        {label}
        {optional && (
          <span className="font-normal text-slate-400"> (optional)</span>
        )}
      </span>
      <textarea
        name={name}
        rows={rows}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        placeholder={placeholder}
        className={`${inputNormal} mt-1.5 resize-y shadow-sm`}
      />
    </label>
  );
}
