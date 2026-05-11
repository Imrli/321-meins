import { useCountdown } from "@/hooks/useCountdown";

type Props = {
  endIso: string;
  /** Eindeutig pro Auktion, damit Vibration nur einmal pro Lauf */
  vibrateId?: string;
  size?: "lg" | "xl";
  className?: string;
};

/**
 * Grosse, zentrierte Auktions-Uhr: grün, unter 10s rot, Monospace.
 */
export function CountdownTimer({ endIso, vibrateId, size = "lg", className = "" }: Props) {
  const { remainingLabel, expired, under10s } = useCountdown(endIso, vibrateId);
  const textSize = size === "xl" ? "text-4xl sm:text-5xl" : "text-2xl sm:text-3xl";
  return (
    <div
      className={`inline-flex min-w-[7ch] flex-col items-center justify-center rounded-[12px] border-2 px-4 py-3 font-mono font-bold tabular-nums ${
        expired
          ? "border-slate-200 bg-slate-100 text-slate-400 line-through"
          : under10s
            ? "border-[#DC2626] bg-red-50 text-[#DC2626]"
            : "border-[#10B981] bg-emerald-50 text-[#10B981]"
      } ${textSize} ${className}`}
    >
      {remainingLabel}
    </div>
  );
}
