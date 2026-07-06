import type { ReactNode } from "react";
import type { Auction } from "@/types/auction";
import {
  auftragsartFromDienstleistungTyp,
  dienstleistungTypFromAuction,
  type DienstleistungTyp,
} from "@/types/dienstleistungTyp";

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

const STYLES: Record<
  DienstleistungTyp,
  { badge: string; iconWrap: string; icon: string }
> = {
  umzug: {
    badge: "bg-orange-100 text-orange-900 ring-orange-200/80",
    iconWrap: "bg-orange-100 text-orange-700 ring-orange-200/80",
    icon: "text-orange-700",
  },
  reinigung: {
    badge: "bg-emerald-100 text-emerald-900 ring-emerald-200/80",
    iconWrap: "bg-emerald-100 text-emerald-700 ring-emerald-200/80",
    icon: "text-emerald-700",
  },
  umzug_reinigung: {
    badge: "bg-blue-100 text-blue-900 ring-blue-200/80",
    iconWrap: "bg-blue-100 text-blue-700 ring-blue-200/80",
    icon: "text-blue-700",
  },
  transport: {
    badge: "bg-slate-100 text-slate-700 ring-slate-200/80",
    iconWrap: "bg-slate-100 text-slate-600 ring-slate-200/80",
    icon: "text-slate-600",
  },
};

export function dienstleistungTypIcon(
  typ: DienstleistungTyp,
  className?: string,
): ReactNode {
  const cls = className ?? "size-3.5";
  switch (typ) {
    case "umzug":
      return <IconPackage className={cls} />;
    case "reinigung":
      return <IconBroom className={cls} />;
    case "umzug_reinigung":
      return <IconPackageBroom className={cls} />;
    default:
      return <IconTruck className={cls} />;
  }
}

export function DienstleistungTypIconBox({
  auction,
  size = "md",
}: {
  auction: Pick<Auction, "dienstleistungTyp" | "umzugDetails" | "reinigungDetails">;
  size?: "sm" | "md";
}) {
  const typ = dienstleistungTypFromAuction(auction);
  const styles = STYLES[typ];
  const box = size === "sm" ? "size-6 rounded-md" : "size-8 rounded-lg";
  const icon = size === "sm" ? "size-3.5" : "size-4";
  return (
    <span
      className={`grid shrink-0 place-items-center ring-1 ${box} ${styles.iconWrap}`}
    >
      {dienstleistungTypIcon(typ, icon)}
    </span>
  );
}

export function DienstleistungTypBadge({
  auction,
  size = "sm",
}: {
  auction: Pick<Auction, "dienstleistungTyp" | "umzugDetails" | "reinigungDetails">;
  size?: "sm" | "md";
}) {
  const typ = dienstleistungTypFromAuction(auction);
  const label = auftragsartFromDienstleistungTyp(typ);
  const styles = STYLES[typ];
  const pad = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";
  const icon = size === "sm" ? "size-3" : "size-3.5";

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-full font-semibold ring-1 ${pad} ${styles.badge}`}
    >
      {dienstleistungTypIcon(typ, icon)}
      <span className="truncate">{label}</span>
    </span>
  );
}
