import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useMemo, useRef, useState } from "react";
import {
  AlertOctagon,
  BadgeCheck,
  CheckCircle2,
  Loader2,
  Repeat2,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Issue, Report, Status } from "@/lib/constants";
import { categoryLabel, STATUSES, stripMarkdown } from "@/lib/constants";
import { signStoragePhoto, uploadReportPhoto, usePhotoUrl } from "@/lib/photos";
import { generateIssueSummary, verifyResolutionPhotos } from "@/lib/ai.functions";
import { useProfile, useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";
import { ImpactMeter, SeverityBadge, StatusPill } from "@/components/badges";
import { CityMap } from "@/components/CityMap";
import { DEFAULT_CENTER } from "@/lib/constants";
import { coordsForPlace } from "@/lib/india-places";
import { ClientOnly } from "@/components/ClientOnly";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Officer dashboard — CivicTwin" },
      {
        name: "description",
        content:
          "Priority-ranked civic issues, a live hotspot map, status controls and AI-verified resolution photos for municipal officers.",
      },
      { property: "og:title", content: "Officer dashboard — CivicTwin" },
      {
        property: "og:description",
        content: "Issues ranked by impact, mapped hotspots, and AI-verified resolutions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user, loading } = useSession();
  const { data: profile } = useProfile(user?.id);
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);

  const { data: issues = [], isLoading } = useQuery({
    queryKey: ["issues"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("issues")
        .select("*")
        .order("impact_score", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Issue[];
    },
  });

  const visibleIssues = useMemo(() => {
    if (!profile?.city) return issues;
    const city = profile.city.toLowerCase();
    return issues.filter((i) => {
      const issueCity = (i.city ?? "").toLowerCase();
      return issueCity === city || i.location_name.toLowerCase().includes(city);
    });
  }, [issues, profile?.city]);

  const stats = useMemo(() => {
    const open = visibleIssues.filter((i) => i.status !== "resolved");
    return {
      open: open.length,
      critical: visibleIssues.filter((i) => i.severity === "critical" && i.status !== "resolved").length,
      recurring: visibleIssues.filter((i) => i.is_recurring).length,
      resolved: visibleIssues.filter((i) => i.status === "resolved").length,
    };
  }, [visibleIssues]);

  const markers = useMemo(
    () =>
      visibleIssues.map((i) => ({
        id: i.id,
        lat: i.lat,
        lng: i.lng,
        severity: i.severity,
        label: i.title,
      })),
    [visibleIssues],
  );

  return (
    <main className="min-h-screen bg-background pb-24 pt-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Issue command centre
            </h1>
            <p className="mt-1 text-muted-foreground">
              {profile?.city
                ? `Public issues in ${profile.city}, ranked by civic impact.`
                : "Clustered public issues ranked by civic impact — highest first."}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-8 grid gap-4 sm:grid-cols-4">
          {[
            { label: "Open issues", value: stats.open, icon: AlertOctagon },
            { label: "Critical", value: stats.critical, icon: AlertOctagon },
            { label: "Recurring", value: stats.recurring, icon: Repeat2 },
            { label: "Resolved", value: stats.resolved, icon: CheckCircle2 },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="shadow-card rounded-2xl border border-border bg-card p-5"
            >
              <s.icon className="size-4 text-muted-foreground" />
              <p className="font-display mt-3 text-3xl font-bold tabular-nums">{s.value}</p>
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                {s.label}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Hotspot map */}
        <div className="mt-6">
          <ClientOnly fallback={<div className="h-80 animate-pulse rounded-2xl bg-muted" />}>
            <CityMap
              className="h-80 w-full overflow-hidden rounded-2xl border border-border"
              markers={markers}
              center={coordsForPlace(profile?.city, profile?.state) ?? markers[0] ?? DEFAULT_CENTER}
              zoom={12}
              onMarkerClick={(id) => setSelected(id)}
            />
          </ClientOnly>
        </div>

        {/* Issue queue */}
        <div className="mt-10 flex flex-col gap-4">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />
              ))
            : visibleIssues.map((issue, i) => (
                <motion.div
                  key={issue.id}
                  initial={{ opacity: 0, y: 40, rotateX: 6 }}
                  whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.6, delay: (i % 4) * 0.07, ease: [0.22, 1, 0.36, 1] }}
                  style={{ perspective: 1000 }}
                >
                  <IssueRow
                    issue={issue}
                    rank={i + 1}
                    isOfficer={false}
                    expanded={selected === issue.id}
                    onToggle={() => setSelected(selected === issue.id ? null : issue.id)}
                  />
                </motion.div>
              ))}
        </div>
      </div>
    </main>
  );
}

function IssueRow({
  issue,
  rank,
  isOfficer,
  expanded,
  onToggle,
}: {
  issue: Issue;
  rank: number;
  isOfficer: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const resolvedUrl = usePhotoUrl(issue.resolved_photo_url);

  const { data: reports = [] } = useQuery({
    queryKey: ["issue-reports", issue.id],
    enabled: expanded,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .eq("issue_id", issue.id)
        .eq("moderation", "approved")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Report[];
    },
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["issues"] });
    void queryClient.invalidateQueries({ queryKey: ["issue-reports", issue.id] });
  };

  const setStatus = async (status: Status) => {
    setBusy(true);
    const { error } = await supabase.from("issues").update({ status }).eq("id", issue.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Status set to ${status.replace("_", " ")}.`);
    refresh();
  };

  const brief = async () => {
    setBusy(true);
    try {
      const { summary } = await generateIssueSummary({
        data: {
          title: issue.title,
          category: issue.category,
          locationName: issue.location_name,
          reports: reports.map((r) => ({
            description: r.description,
            severity: r.severity,
            created_at: r.created_at,
          })),
        },
      });
      const { error } = await supabase.from("issues").update({ summary }).eq("id", issue.id);
      if (error) throw error;
      toast.success("Officer brief generated.");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate brief");
    } finally {
      setBusy(false);
    }
  };

  const uploadResolution = async (file: File) => {
    if (!user) return;
    setBusy(true);
    try {
      const path = await uploadReportPhoto(file, user.id);
      const afterUrl = await signStoragePhoto(path);

      const before = reports[0];
      let verdictText: string | null = null;
      let resolved = true;

      if (before) {
        const beforeUrl = before.photo_url.startsWith("sb:")
          ? await signStoragePhoto(before.photo_url)
          : new URL(before.photo_url, window.location.origin).toString();
        try {
          const verdict = await verifyResolutionPhotos({
            data: { beforeUrl, afterUrl, category: issue.category },
          });
          verdictText = `${verdict.verdict} (confidence ${verdict.confidence}%)`;
          resolved = verdict.resolved;
        } catch (e) {
          verdictText = `AI verification unavailable: ${
            e instanceof Error ? e.message : "unknown error"
          }`;
        }
      }

      const { error } = await supabase
        .from("issues")
        .update({
          resolved_photo_url: path,
          ai_verdict: verdictText,
          status: resolved ? "resolved" : "in_progress",
        })
        .eq("id", issue.id);
      if (error) throw error;

      if (resolved) {
        await supabase.from("reports").update({ status: "resolved" }).eq("issue_id", issue.id);
        toast.success("AI verified the fix — issue closed.");
      } else {
        toast.warning("AI could not confirm the fix. Issue kept in progress.");
      }
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="shadow-card overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-panel">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-4 p-5 text-left transition-colors hover:bg-secondary/50"
      >
        <span className="font-display w-8 shrink-0 text-2xl font-bold text-muted-foreground/40 tabular-nums">
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={issue.severity} />
            <StatusPill status={issue.status} />
            <span className="chip">{categoryLabel(issue.category)}</span>
            {issue.is_recurring && (
              <span className="inline-flex items-center gap-1 rounded-full bg-severity-high/15 px-2.5 py-1 text-[11px] font-semibold text-severity-high-foreground">
                <Repeat2 className="size-3" />
                Recurring
              </span>
            )}
          </div>
          <p className="font-display mt-2 truncate text-lg font-semibold">{issue.title}</p>
          <p className="truncate text-sm text-muted-foreground">
            {issue.location_name} · {issue.report_count} citizen reports
          </p>
        </div>
        <ImpactMeter score={issue.impact_score} className="hidden shrink-0 sm:flex" />
      </button>

      {expanded && (
        <div className="border-t border-border p-5">
          {issue.summary && (
            <div className="mb-4 rounded-xl border border-primary/20 bg-accent/50 p-4">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-accent-foreground">
                <Sparkles className="size-3.5" />
                Officer brief
              </p>
              <p className="text-sm leading-relaxed">{stripMarkdown(issue.summary)}</p>
            </div>
          )}

          {resolvedUrl && (
            <div className="mb-4 overflow-hidden rounded-xl border border-status-resolved/40">
              <img
                src={resolvedUrl}
                alt="Resolution"
                className="aspect-[16/9] w-full object-cover"
                loading="lazy"
              />
              {issue.ai_verdict && (
                <p className="p-3 text-sm text-muted-foreground">{issue.ai_verdict}</p>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void brief()}>
              <Sparkles className="size-3.5" />
              AI brief
            </Button>
          </div>

          {reports.length > 0 && (
            <div className="mt-5 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Linked reports
              </p>
              {reports.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <span className="truncate text-foreground/90">
                    {r.ai_summary ?? r.description ?? "Citizen report"}
                  </span>
                  <SeverityBadge severity={r.severity} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
