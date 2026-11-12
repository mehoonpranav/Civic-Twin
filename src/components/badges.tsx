import { Award, Crown, Gem, Medal, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Level, Severity, Status } from "@/lib/constants";
import { levelForPoints, statusLabel } from "@/lib/constants";

const severityStyles: Record<Severity, string> = {
  low: "bg-severity-low text-severity-low-foreground",
  moderate: "bg-severity-moderate text-severity-moderate-foreground",
  high: "bg-severity-high text-severity-high-foreground",
  critical: "bg-severity-critical text-severity-critical-foreground",
};

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
        severityStyles[severity],
        className,
      )}
    >
      {severity}
    </span>
  );
}

const statusDot: Record<Status, string> = {
  open: "bg-status-open",
  acknowledged: "bg-status-acknowledged",
  in_progress: "bg-status-in-progress",
  resolved: "bg-status-resolved",
};

export function StatusPill({ status, className }: { status: Status; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground",
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", statusDot[status])} />
      {statusLabel(status)}
    </span>
  );
}

export function ImpactMeter({ score, className }: { score: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1 w-14 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-display text-xs font-semibold tabular-nums text-foreground">
        {pct}
      </span>
    </div>
  );
}

const levelStyles: Record<Level, string> = {
  bronze: "bg-level-bronze text-level-bronze-foreground",
  gold: "bg-level-gold text-level-gold-foreground",
  platinum: "bg-level-platinum text-level-platinum-foreground",
  diamond: "bg-level-diamond text-level-diamond-foreground",
};

const levelIcons: Record<Level, LucideIcon> = {
  bronze: Medal,
  gold: Award,
  platinum: Crown,
  diamond: Gem,
};

export function LevelBadge({
  points,
  className,
}: {
  points: number;
  className?: string;
}) {
  const level = levelForPoints(points);
  const Icon = levelIcons[level.value];
  return (
    <span
      title={`${level.label} citizen — ${points} civic points`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        levelStyles[level.value],
        className,
      )}
    >
      <Icon className="size-3" />
      {level.label}
    </span>
  );
}
