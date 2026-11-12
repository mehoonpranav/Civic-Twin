import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { ArrowBigUp, MapPin, Repeat2 } from "lucide-react";
import type { Report } from "@/lib/constants";
import { categoryIcon, categoryLabel } from "@/lib/constants";
import { usePhotoUrl } from "@/lib/photos";
import { ImpactMeter, LevelBadge, SeverityBadge, StatusPill } from "./badges";

export function ReportCard({ report }: { report: Report }) {
  const photoUrl = usePhotoUrl(report.photo_url);
  const Icon = categoryIcon(report.category);

  return (
    <Link
      to="/report/$id"
      params={{ id: report.id }}
      className="report-card group block overflow-hidden"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={report.description ?? categoryLabel(report.category)}
            loading="lazy"
            width={1280}
            height={960}
            className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
          />
        ) : (
          <div className="size-full animate-pulse bg-muted" />
        )}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-foreground/50 to-transparent" />
        <div className="absolute left-3 top-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-card/90 px-2.5 py-1 text-[11px] font-semibold text-foreground backdrop-blur">
            <Icon className="size-3" />
            {categoryLabel(report.category)}
          </span>
          <SeverityBadge severity={report.severity} />
        </div>
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
          <span className="inline-flex min-w-0 items-center gap-1 text-xs font-medium text-primary-foreground">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">{report.location_name}</span>
          </span>
          {report.moderation && report.moderation !== "approved" ? (
            <span
              className={
                report.moderation === "rejected"
                  ? "rounded-full bg-destructive/90 px-2.5 py-1 text-[11px] font-semibold text-destructive-foreground"
                  : "rounded-full bg-status-open px-2.5 py-1 text-[11px] font-semibold text-white"
              }
            >
              {report.moderation === "rejected" ? "Rejected" : "Pending review"}
            </span>
          ) : (
            <StatusPill status={report.status} className="shrink-0 border-transparent" />
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <p className="line-clamp-2 text-sm leading-relaxed text-foreground/90">
          {report.ai_summary ?? report.description ?? "Citizen report"}
        </p>
        {report.issues?.title && (
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
            <Repeat2 className="size-3" />
            Linked to: {report.issues.title}
          </p>
        )}
        {report.profiles && (
          <div className="flex items-center gap-2">
            {report.profiles.avatar_url ? (
              <img
                src={report.profiles.avatar_url}
                alt=""
                className="size-6 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-secondary-foreground">
                {(report.profiles.full_name ?? "C").trim().slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="truncate text-xs font-medium text-foreground/80">
              {report.profiles.full_name ?? "Citizen"}
            </span>
            <LevelBadge points={report.profiles.points} className="ml-auto shrink-0" />
          </div>
        )}
        <div className="flex items-center justify-between border-t border-border pt-3">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 font-semibold text-foreground">
              <ArrowBigUp className="size-4 text-primary" />
              {report.confirmations}
            </span>
            <span>
              {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
            </span>
          </div>
          <ImpactMeter score={report.impact_score} />
        </div>
      </div>
    </Link>
  );
}
