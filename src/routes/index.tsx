import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion, useScroll, useTransform } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowRight, Camera, Layers, MapPin, Search, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSession } from "@/hooks/use-session";
import type { Category, Profile, Report, Severity } from "@/lib/constants";
import { CATEGORIES, SEVERITIES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ReportCard } from "@/components/ReportCard";
import { LevelBadge } from "@/components/badges";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import heroAerial from "@/assets/hero-aerial.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CivicTwin — Live civic reports from your city" },
      {
        name: "description",
        content:
          "Browse a live, Reddit-style feed of citizen-reported civic problems — potholes, waterlogging, garbage, broken streetlights — triaged by AI and tracked to resolution.",
      },
      { property: "og:title", content: "CivicTwin — Live civic reports from your city" },
      {
        property: "og:description",
        content:
          "Citizens report, AI triages, officers resolve — in public view.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

/**
 * Three top-down cars driving the hero aerial's actual roads.
 * The SVG viewBox matches the photo's 1920×1280 intrinsic size and uses
 * preserveAspectRatio="slice", which crops exactly like the <img>'s
 * object-cover — so paths stay glued to the asphalt at any viewport.
 * Traffic circulates clockwise (left-hand traffic, like Kolkata).
 */
function HeroCars() {
  const cars = [
    {
      // Kolkata-yellow taxi westbound on the avenue's lower lane, swinging
      // around the island's south half (left-hand traffic)
      color: "#e6b93a",
      path: "M 1980 700 L 1330 700 C 1210 700 1141 841 955 841 C 769 841 700 700 580 700 L -80 700",
      dur: "30s",
      begin: "-6s",
      scale: 0.95,
    },
    {
      // White sedan eastbound on the avenue's upper lane, sweeping around the island's north half
      color: "#efeee8",
      path: "M -80 610 L 640 610 C 760 610 830 469 955 469 C 1080 469 1150 610 1270 610 L 1980 610",
      dur: "34s",
      begin: "-22s",
      scale: 1,
    },
    {
      // Red hatchback southbound on the vertical road's east lane, curving around the island
      color: "#c2402f",
      path: "M 995 -380 L 995 340 C 995 470 1141 540 1141 655 C 1141 770 995 840 995 970 L 995 1680",
      dur: "38s",
      begin: "-14s",
      scale: 0.95,
    },
  ];

  return (
    <svg
      className="hero-cars absolute inset-0 size-full"
      viewBox="0 0 1920 1280"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        {/* Top-down car sprite, 46×20, nose pointing +x, centered on origin */}
        <g id="hero-car-body">
          <rect x="-21.5" y="-8" width="46" height="20" rx="7" fill="rgba(8,12,18,0.4)" />
          <rect x="-23" y="-10" width="46" height="20" rx="7" fill="currentColor" />
          <rect x="-23" y="-10" width="46" height="20" rx="7" fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth="1" />
          <rect x="-9" y="-6.8" width="15" height="13.6" rx="3.2" fill="rgba(0,0,0,0.16)" />
          <rect x="5" y="-6.4" width="4.6" height="12.8" rx="2" fill="rgba(16,24,32,0.92)" />
          <rect x="-13.6" y="-6" width="3.8" height="12" rx="1.8" fill="rgba(16,24,32,0.92)" />
          <rect x="20.8" y="-7.2" width="2.2" height="3.8" rx="1.1" fill="#fff6c8" />
          <rect x="20.8" y="3.4" width="2.2" height="3.8" rx="1.1" fill="#fff6c8" />
          <rect x="-23.2" y="-7" width="1.8" height="3.4" rx="0.9" fill="#c2372b" />
          <rect x="-23.2" y="3.6" width="1.8" height="3.4" rx="0.9" fill="#c2372b" />
        </g>
      </defs>
      {cars.map((c) => (
        <g key={c.color} style={{ color: c.color }}>
          <animateMotion
            dur={c.dur}
            begin={c.begin}
            repeatCount="indefinite"
            rotate="auto"
            path={c.path}
          />
          <use href="#hero-car-body" transform={`scale(${c.scale})`} />
        </g>
      ))}
    </svg>
  );
}

const PAGE_SIZE = 6; // two rows of the 3-column feed grid

function useReports() {
  return useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*, issues(title), profiles(full_name, points, avatar_url)")
        .eq("moderation", "approved")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Report[];
    },
  });
}

function useLeaderboard() {
  return useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, city, points, avatar_url, created_at")
        .order("points", { ascending: false })
        .limit(5);
      if (error) throw error;
      return ((data ?? []) as unknown as Profile[]).filter((p) => p.points > 0);
    },
  });
}

function HomePage() {
  const { user } = useSession();
  const { data: profile } = useProfile(user?.id);
  const { data: reports = [], isLoading } = useReports();
  const navigate = useNavigate();
  const [category, setCategory] = useState<Category | "all">("all");
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [search, setSearch] = useState("");
  const [shown, setShown] = useState(PAGE_SIZE);
  const { data: leaders = [] } = useLeaderboard();

  useEffect(() => setShown(PAGE_SIZE), [category, severity, search]);

  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "28%"]);
  const imageScale = useTransform(scrollYProgress, [0, 1], [1, 1.18]);
  const textY = useTransform(scrollYProgress, [0, 1], ["0%", "-60%"]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const panelY = useTransform(scrollYProgress, [0, 1], ["0%", "-140%"]);
  const panelRotate = useTransform(scrollYProgress, [0, 1], [0, -4]);

  const filtered = useMemo(
    () =>
      reports.filter((r) => {
        if (category !== "all" && r.category !== category) return false;
        if (severity !== "all" && r.severity !== severity) return false;
        if (search && !r.location_name.toLowerCase().includes(search.toLowerCase()))
          return false;
        if (profile?.city) {
          const city = profile.city.toLowerCase();
          const reportCity = (r.city ?? "").toLowerCase();
          const inName = r.location_name.toLowerCase().includes(city);
          if (reportCity && reportCity !== city && !inName) return false;
          if (!reportCity && !inName) return false;
        }
        return true;
      }),
    [reports, category, severity, search, profile?.city],
  );

  const stats = useMemo(() => {
    const resolved = reports.filter((r) => r.status === "resolved").length;
    const confirmations = reports.reduce((acc, r) => acc + r.confirmations, 0);
    return { total: reports.length, resolved, confirmations };
  }, [reports]);

  return (
    <main className="bg-background">
      {/* ── Parallax hero ─────────────────────────────────────────── */}
      <section ref={heroRef} className="relative flex min-h-[100svh] items-center overflow-hidden">
        <motion.div style={{ y: imageY, scale: imageScale }} className="absolute inset-0">
          <img
            src={heroAerial}
            alt="Aerial view of a city intersection"
            className="size-full object-cover"
            width={1920}
            height={1280}
          />
          <HeroCars />
          <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/40 to-background" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/60 via-background/25 to-transparent" />
        </motion.div>

        <motion.div
          style={{ y: textY, opacity: textOpacity }}
          className="relative z-10 mx-auto w-full max-w-6xl px-4 pt-24 sm:px-6"
        >
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-3xl"
          >
            <span className="chip mb-6">
              <Sparkles className="size-3.5 text-primary" />
              AI-triaged civic reporting
            </span>
            <h1 className="font-display text-5xl font-bold leading-[1.02] tracking-tight text-foreground sm:text-7xl">
              Your city has eyes now.
            </h1>
            <p className="mt-6 max-w-xl text-lg font-medium leading-relaxed text-foreground/90">
              Snap a photo of a pothole, a flooded underpass, a dead streetlight.
              CivicTwin's AI triages it, clusters it with neighbours' reports, and puts it
              on the officer's desk — in public view.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                className="rounded-full px-6"
                onClick={() => navigate({ to: "/report/new" })}
              >
                <Camera className="size-4" />
                Report a problem
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-full px-6"
                onClick={() =>
                  document.getElementById("feed")?.scrollIntoView({ behavior: "smooth" })
                }
              >
                Browse live reports
                <ArrowDown className="size-4" />
              </Button>
            </div>
          </motion.div>
        </motion.div>

        {/* Floating stats panel — counter-parallax layer */}
        <motion.div
          style={{ y: panelY, rotate: panelRotate }}
          className="absolute bottom-24 right-6 z-10 hidden lg:block"
        >
          <motion.div
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="shadow-panel w-72 rounded-2xl border border-border bg-card/90 p-5 backdrop-blur-xl"
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              City pulse
            </p>
            <div className="mt-4 space-y-3">
              {[
                { label: "Live reports", value: stats.total },
                { label: "Resolved", value: stats.resolved },
                { label: "Citizen confirmations", value: stats.confirmations },
              ].map((s) => (
                <div key={s.label} className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">{s.label}</span>
                  <span className="font-display text-2xl font-bold tabular-nums">{s.value}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ── How it works ──────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: Camera,
              step: "01",
              title: "Snap & drop a pin",
              body: "Photo, GPS location, an optional note. Thirty seconds, no forms.",
            },
            {
              icon: Sparkles,
              step: "02",
              title: "AI triages instantly",
              body: "Claude classifies the problem, scores its impact, and clusters it with nearby reports into a single Issue.",
            },
            {
              icon: ShieldCheck,
              step: "03",
              title: "Officers resolve in public",
              body: "Issues rank by impact on the officer dashboard. Resolution photos are AI-verified before closure.",
            },
          ].map((f, i) => (
            <motion.div
              key={f.step}
              initial={{ opacity: 0, y: 48, rotateX: 8 }}
              whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
              className="report-card p-6"
            >
              <div className="flex items-center justify-between">
                <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <f.icon className="size-5" />
                </span>
                <span className="font-display text-sm font-bold text-muted-foreground/50">
                  {f.step}
                </span>
              </div>
              <h3 className="font-display mt-5 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Citizen leaderboard ───────────────────────────────────── */}
      {leaders.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                  Top citizens
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Civic points for every published report — higher-impact reports earn more.
                </p>
              </div>
              <Link to="/leaderboard" className="chip transition-colors hover:bg-secondary">
                <Trophy className="size-3.5 text-primary" />
                Full leaderboard
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {leaders.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 32 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                  className="report-card flex flex-col items-center gap-1.5 p-5 text-center"
                >
                  <span className="font-display text-sm font-bold text-muted-foreground/50">
                    #{i + 1}
                  </span>
                  <UserAvatar
                    name={p.full_name}
                    src={p.avatar_url}
                    className="size-12 rounded-full text-lg"
                  />
                  <p className="mt-1 font-medium leading-tight">{p.full_name ?? "Citizen"}</p>
                  {p.city && <p className="text-xs text-muted-foreground">{p.city}</p>}
                  <LevelBadge points={p.points} className="mt-1" />
                  <p className="mt-1 font-display text-xl font-bold tabular-nums">
                    {p.points}
                    <span className="ml-1 text-xs font-medium text-muted-foreground">pts</span>
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>
      )}

      {/* ── Live feed ─────────────────────────────────────────────── */}
      <section id="feed" className="mx-auto max-w-6xl scroll-mt-24 px-4 pb-28 sm:px-6">
        <div className="mb-8 flex flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Live citizen feed
              </h2>
              <p className="mt-2 text-muted-foreground">
                Every published report, ranked by the community. Confirm the ones affecting you.
              </p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by location…"
                className="h-10 w-64 rounded-full border border-border bg-card pl-9 pr-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              className={cn("chip", category === "all" && "chip-active")}
              onClick={() => setCategory("all")}
            >
              <Layers className="size-3.5" />
              All
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                className={cn("chip", category === c.value && "chip-active")}
                onClick={() => setCategory(category === c.value ? "all" : c.value)}
              >
                <c.icon className="size-3.5" />
                {c.label}
              </button>
            ))}
            <span className="mx-2 h-5 w-px bg-border" />
            {SEVERITIES.map((s) => (
              <button
                key={s.value}
                className={cn("chip", severity === s.value && "chip-active")}
                onClick={() => setSeverity(severity === s.value ? "all" : s.value)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-20 text-center">
            <MapPin className="size-8 text-muted-foreground" />
            <p className="text-muted-foreground">No reports match these filters.</p>
            <Button variant="outline" className="rounded-full" onClick={() => navigate({ to: "/report/new" })}>
              Be the first to report
              <ArrowRight className="size-4" />
            </Button>
          </div>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" style={{ perspective: 1200 }}>
              {filtered.slice(0, shown).map((report, i) => (
                <motion.div
                  key={report.id}
                  initial={{ opacity: 0, y: 64, rotateX: 10, scale: 0.96 }}
                  whileInView={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{
                    duration: 0.75,
                    delay: (i % 3) * 0.1,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <ReportCard report={report} />
                </motion.div>
              ))}
            </div>
            {shown < filtered.length && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="mt-10 flex justify-center"
              >
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-full px-8"
                  onClick={() => setShown((s) => s + PAGE_SIZE)}
                >
                  Load more
                  <span className="text-muted-foreground">
                    · {filtered.length - shown} more {filtered.length - shown === 1 ? "report" : "reports"}
                  </span>
                </Button>
              </motion.div>
            )}
          </>
        )}
      </section>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-10 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <div className="text-center sm:text-left">
            <p className="font-display font-semibold text-foreground">CivicTwin</p>
            <Link to="/department" className="mt-1 inline-block text-xs font-medium text-primary hover:underline">
              Department login
            </Link>
          </div>
          <p>A digital twin of your city's problems — and its promises.</p>
        </div>
      </footer>
    </main>
  );
}
