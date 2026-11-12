import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { MapPin, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { levelForPoints, type Profile } from "@/lib/constants";
import { LevelBadge } from "@/components/badges";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Citizen Leaderboard — CivicTwin" },
      {
        name: "description",
        content:
          "The citizens making their city better. Civic points for every published report — Bronze to Diamond.",
      },
      { property: "og:title", content: "Citizen Leaderboard — CivicTwin" },
      {
        property: "og:description",
        content:
          "The citizens making their city better. Civic points for every published report — Bronze to Diamond.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LeaderboardPage,
});

function useLeaders() {
  return useQuery({
    queryKey: ["leaderboard", "full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, city, points, avatar_url, created_at")
        .order("points", { ascending: false })
        .limit(50);
      if (error) throw error;
      return ((data ?? []) as unknown as Profile[]).filter((p) => p.points > 0);
    },
  });
}

function LeaderboardPage() {
  const { data: leaders = [], isLoading } = useLeaders();

  return (
    <main className="mx-auto max-w-4xl px-4 pb-24 pt-28 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="text-center"
      >
        <span className="chip mx-auto">
          <Trophy className="size-3.5 text-primary" />
          Citizen leaderboard
        </span>
        <h1 className="font-display mt-5 text-4xl font-bold tracking-tight sm:text-5xl">
          The city&rsquo;s sharpest eyes
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Civic points for every published report — higher-impact reports earn more.
          Climb from Bronze to Diamond.
        </p>
      </motion.div>

      {isLoading ? (
        <div className="mt-16 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-secondary" />
          ))}
        </div>
      ) : leaders.length === 0 ? (
        <div className="mt-16 rounded-3xl border border-dashed border-border p-14 text-center">
          <p className="font-display text-xl font-semibold">No ranked citizens yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Be the first — publish a report and earn civic points.
          </p>
          <Link
            to="/report/new"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Report a problem
          </Link>
        </div>
      ) : (
        <div className="mt-12 overflow-hidden rounded-2xl border border-border bg-card">
          {leaders.map((p, idx) => {
            const rank = idx + 1;
            const level = levelForPoints(p.points);
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(idx, 8) * 0.04 }}
                className="flex items-center gap-3 border-b border-border/60 px-4 py-3.5 last:border-0 sm:gap-4 sm:px-6"
              >
                <span className="w-8 shrink-0 font-display text-sm font-bold tabular-nums text-muted-foreground/70">
                  #{rank}
                </span>
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt="" className="size-10 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary font-display text-sm font-bold text-secondary-foreground">
                    {(p.full_name ?? "C").trim().slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium leading-tight">{p.full_name ?? "Citizen"}</p>
                  {p.city && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3" />
                      {p.city}
                    </p>
                  )}
                </div>
                <span className="hidden text-xs font-medium uppercase tracking-wider text-muted-foreground sm:block">
                  {level.label}
                </span>
                <LevelBadge points={p.points} />
                <span className="w-14 shrink-0 text-right font-display text-lg font-bold tabular-nums sm:w-16">
                  {p.points}
                  <span className="ml-1 text-[10px] font-medium text-muted-foreground">pts</span>
                </span>
              </motion.div>
            );
          })}
        </div>
      )}
    </main>
  );
}
