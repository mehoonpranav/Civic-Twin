import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { motion } from "motion/react";
import { useRef, useState } from "react";
import { ArrowBigUp, ArrowLeft, MapPin, Repeat2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Issue, Report } from "@/lib/constants";
import { categoryIcon, categoryLabel } from "@/lib/constants";
import { usePhotoUrl } from "@/lib/photos";
import { ImpactMeter, LevelBadge, SeverityBadge, StatusPill } from "@/components/badges";
import { CityMap } from "@/components/CityMap";
import { ClientOnly } from "@/components/ClientOnly";
import { Button } from "@/components/ui/button";
import { ReportComments } from "@/components/ReportComments";

export const Route = createFileRoute("/report/$id")({
  loader: async ({ params }) => {
    const { data, error } = await supabase
      .from("reports")
      .select("*, issues(title), profiles(full_name, points, avatar_url)")
      .eq("id", params.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw notFound();
    return data as unknown as Report;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.location_name ?? "Report"} — CivicTwin` },
      {
        name: "description",
        content: loaderData?.ai_summary ?? loaderData?.description ?? "Citizen civic report on CivicTwin.",
      },
      { property: "og:title", content: `${categoryLabel(loaderData?.category ?? "other")} at ${loaderData?.location_name ?? "city"} — CivicTwin` },
      { property: "og:description", content: loaderData?.ai_summary ?? "Citizen civic report on CivicTwin." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportDetailPage,
});

function voterKey() {
  let key = localStorage.getItem("civictwin:voter");
  if (!key) {
    key = crypto.randomUUID();
    localStorage.setItem("civictwin:voter", key);
  }
  return key;
}

function ReportDetailPage() {
  const initial = Route.useLoaderData();
  const queryClient = useQueryClient();
  const [voted, setVoted] = useState(false);
  const photoRef = useRef<HTMLDivElement>(null);

  const { data: report } = useQuery({
    queryKey: ["report", initial.id],
    initialData: initial,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*, issues(title), profiles(full_name, points, avatar_url)")
        .eq("id", initial.id)
        .single();
      if (error) throw error;
      return data as unknown as Report;
    },
  });

  const { data: issue } = useQuery({
    queryKey: ["issue", report.issue_id],
    enabled: !!report.issue_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("issues")
        .select("*")
        .eq("id", report.issue_id!)
        .single();
      if (error) throw error;
      return data as unknown as Issue;
    },
  });

  const photoUrl = usePhotoUrl(report.photo_url);
  const resolvedPhotoUrl = usePhotoUrl(issue?.resolved_photo_url);

  const vote = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("report_votes")
        .insert({ report_id: report.id, voter_key: voterKey() });
      if (error) {
        if (error.code === "23505") throw new Error("You already confirmed this report.");
        throw error;
      }
    },
    onSuccess: () => {
      setVoted(true);
      toast.success("Confirmed — this boosts the report's priority.");
      void queryClient.invalidateQueries({ queryKey: ["report", report.id] });
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const Icon = categoryIcon(report.category);

  return (
    <main className="min-h-screen bg-background pb-24 pt-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to feed
        </Link>

        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <motion.div
            ref={photoRef}
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="overflow-hidden rounded-2xl border border-border shadow-card">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={report.description ?? "Report photo"}
                  className="aspect-[4/3] w-full object-cover"
                  width={1280}
                  height={960}
                />
              ) : (
                <div className="aspect-[4/3] w-full animate-pulse bg-muted" />
              )}
            </div>

            {resolvedPhotoUrl && (
              <div className="mt-4 overflow-hidden rounded-2xl border border-status-resolved/40 shadow-card">
                <div className="bg-status-resolved/10 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-status-resolved">
                  After — officer resolution
                </div>
                <img
                  src={resolvedPhotoUrl}
                  alt="Resolution photo"
                  className="aspect-[4/3] w-full object-cover"
                  loading="lazy"
                  width={1280}
                  height={960}
                />
                {issue?.ai_verdict && (
                  <p className="flex items-start gap-2 px-4 py-3 text-sm text-muted-foreground">
                    <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
                    AI verification: {issue.ai_verdict}
                  </p>
                )}
              </div>
            )}

            <ClientOnly fallback={<div className="mt-4 h-64 animate-pulse rounded-2xl bg-muted" />}>
              <CityMap
                className="mt-4 h-64 w-full overflow-hidden rounded-2xl border border-border"
                center={{ lat: report.lat, lng: report.lng }}
                zoom={15}
                markers={[
                  {
                    id: report.id,
                    lat: report.lat,
                    lng: report.lng,
                    severity: report.severity,
                    label: report.location_name,
                  },
                ]}
              />
            </ClientOnly>

            <ReportComments reportId={report.id} />
          </motion.div>

          <motion.aside
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-5"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
                <Icon className="size-3.5" />
                {categoryLabel(report.category)}
              </span>
              <SeverityBadge severity={report.severity} />
              <StatusPill status={report.status} />
            </div>

            <h1 className="font-display text-3xl font-bold leading-tight tracking-tight">
              {issue?.title ?? `${categoryLabel(report.category)} reported`}
            </h1>

            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-4 text-primary" />
              {report.location_name} · {report.lat.toFixed(4)}, {report.lng.toFixed(4)}
            </p>

            {report.profiles && (
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-card">
                {report.profiles.avatar_url ? (
                  <img
                    src={report.profiles.avatar_url}
                    alt=""
                    className="size-10 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary font-display text-sm font-bold text-secondary-foreground">
                    {(report.profiles.full_name ?? "C").trim().slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Reported by
                  </p>
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {report.profiles.full_name ?? "Citizen"}
                    <LevelBadge points={report.profiles.points} />
                  </p>
                </div>
              </div>
            )}

            {report.description && (
              <p className="leading-relaxed text-foreground/90">{report.description}</p>
            )}

            {report.ai_summary && (
              <div className="rounded-xl border border-primary/20 bg-accent/50 p-4">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-accent-foreground">
                  <Sparkles className="size-3.5" />
                  AI triage
                </p>
                <p className="text-sm leading-relaxed text-foreground/90">{report.ai_summary}</p>
              </div>
            )}

            <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-card">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Impact score
                </p>
                <ImpactMeter score={report.impact_score} className="mt-2" />
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
              </p>
            </div>

            <Button
              size="lg"
              variant={voted ? "secondary" : "default"}
              className="rounded-full"
              disabled={vote.isPending || voted}
              onClick={() => vote.mutate()}
            >
              <ArrowBigUp className="size-5" />
              {voted ? "Confirmed" : "This affects me too"} · {report.confirmations}
            </Button>

            {issue && (
              <div className="rounded-xl border border-border bg-card p-4 shadow-card">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  <Repeat2 className="size-3.5" />
                  Clustered issue
                </p>
                <p className="font-display font-semibold">{issue.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {issue.report_count} reports merged
                  {issue.is_recurring ? " · recurring at this location" : ""}
                </p>
                {issue.summary && (
                  <p className="mt-2 text-sm leading-relaxed text-foreground/80">{issue.summary}</p>
                )}
                {issue.resolution_note && (
                  <p className="mt-2 text-sm font-medium text-status-resolved">
                    Resolution: {issue.resolution_note}
                  </p>
                )}
              </div>
            )}
          </motion.aside>
        </div>
      </div>
    </main>
  );
}
