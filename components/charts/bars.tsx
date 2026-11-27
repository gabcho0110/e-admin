import { cn } from "@/lib/utils";

export interface BarDatum {
  label: string;
  value: number;
  tone?: "navy" | "gold" | "success" | "danger" | "muted";
}

const TONES = {
  navy: "bg-navy-600",
  gold: "bg-gold",
  success: "bg-emerald-500",
  danger: "bg-red-500",
  muted: "bg-navy-300 dark:bg-navy-700",
};

export function Bars({ data, emptyLabel = "Няма данни" }: { data: BarDatum[]; emptyLabel?: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  if (!data.length || data.every((d) => d.value === 0)) {
    return <p className="py-6 text-center text-[12.5px] text-muted">{emptyLabel}</p>;
  }
  return (
    <ul className="space-y-3">
      {data.map((item) => (
        <li key={item.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[12px]">
            <span className="truncate text-content/85">{item.label}</span>
            <span className="shrink-0 font-medium tabular-nums">{item.value}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-panel2 ring-1 ring-inset ring-hairline">
            <div
              className={cn("h-full rounded-full transition-all duration-500", TONES[item.tone || "navy"])}
              style={{ width: `${Math.max(3, (item.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Donut({
  segments,
  total,
  caption,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  total: number;
  caption?: string;
}) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative h-[120px] w-[120px] shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--hairline)" strokeWidth="10" />
          {segments.map((segment) => {
            const fraction = total > 0 ? segment.value / total : 0;
            const dash = fraction * circumference;
            const element = (
              <circle
                key={segment.label}
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth="10"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += dash;
            return element;
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <div className="font-display text-[22px] font-semibold leading-none">{total}</div>
            <div className="text-[9.5px] uppercase tracking-[0.1em] text-muted">общо</div>
          </div>
        </div>
      </div>
      <ul className="space-y-1.5 text-[12px]">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-sm" style={{ background: segment.color }} />
            <span className="text-content/80">{segment.label}</span>
            <span className="ml-auto font-medium tabular-nums">{segment.value}</span>
          </li>
        ))}
      </ul>
      {caption ? <p className="w-full text-[11px] text-muted">{caption}</p> : null}
    </div>
  );
}
