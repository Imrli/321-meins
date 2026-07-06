import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { AuftragsArt } from "@/types/auftragsart";

type IconProps = { className?: string };

function IconPackage({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 22V12" />
      <path d="M12 12 2 7l10-5 10 5-10 5Z" />
      <path d="M7 9.5v5L12 18l5-3.5v-5" />
    </svg>
  );
}

function IconBroom({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M4 19h16" />
      <path d="m15 4 5 5" />
      <path d="M13 6 4 15a3 3 0 0 0 0 4.2l.8.8a3 3 0 0 0 4.2 0l9-9" />
    </svg>
  );
}

function IconPackageBroom({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M4 19h10" />
      <path d="m11 4 4 4" />
      <path d="M9 6 4 11a2.5 2.5 0 0 0 0 3.5l.7.7a2.5 2.5 0 0 0 3.5 0l5-5" />
      <path d="M14 14V8l4-2.5L20 8v6" />
      <path d="M16 14v4" />
    </svg>
  );
}

function IconTruck({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3 17V6a1 1 0 0 1 1-1h10v12" />
      <path d="M14 9h4l3 4v4h-2" />
      <circle cx="7.5" cy="17.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </svg>
  );
}

const OPTIONS: {
  art: AuftragsArt;
  label: AuftragsArt;
  icon: ReactNode;
}[] = [
  { art: "Umzug", label: "Umzug", icon: <IconPackage className="size-6" /> },
  {
    art: "Reinigung",
    label: "Reinigung",
    icon: <IconBroom className="size-6" />,
  },
  {
    art: "Umzug + Reinigung",
    label: "Umzug + Reinigung",
    icon: <IconPackageBroom className="size-6" />,
  },
  {
    art: "Transport",
    label: "Transport",
    icon: <IconTruck className="size-6" />,
  },
];

export function AuftragErfassenModal({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (art: AuftragsArt) => void;
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      role="presentation"
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auftrag-erfassen-title"
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="auftrag-erfassen-title"
              className="text-lg font-bold text-slate-900"
            >
              Auftrag erfassen
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Wähle die Art deines Auftrags – danach füllst du die Details aus.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-2xl leading-none text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            aria-label="Schliessen"
          >
            ×
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4">
          {OPTIONS.map((opt) => (
            <button
              key={opt.art}
              type="button"
              onClick={() => onSelect(opt.art)}
              className="group flex min-h-[8.5rem] flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:border-[var(--color-brand-300)] hover:bg-[var(--color-brand-50)] hover:shadow-md active:scale-[0.98] active:bg-[var(--color-brand-100)] sm:min-h-[9rem] sm:p-5 btn-action-shine"
            >
              <div className="grid size-12 place-items-center rounded-xl bg-[var(--color-brand-50)] text-[var(--color-brand-700)] ring-1 ring-[var(--color-brand-100)] transition-colors group-hover:bg-[var(--color-brand-100)]">
                {opt.icon}
              </div>
              <span className="text-center text-sm font-semibold leading-snug text-slate-900">
                {opt.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
