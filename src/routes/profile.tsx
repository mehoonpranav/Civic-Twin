import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { ArrowBigUp, ArrowRight, Camera, LogOut, MapPin, Pencil, Trophy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSession } from "@/hooks/use-session";
import type { Report } from "@/lib/constants";
import { LEVELS, levelProgress } from "@/lib/constants";
import { LevelBadge } from "@/components/badges";
import { ReportCard } from "@/components/ReportCard";
import { AvatarCropDialog } from "@/components/AvatarCropDialog";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { uploadAvatarPhoto } from "@/lib/photos";
import { PlaceSelect } from "@/components/PlaceSelect";
import { citiesForState, STATE_NAMES } from "@/lib/india-places";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My reports & civic rank — CivicTwin" },
      {
        name: "description",
        content:
          "Track your civic points, citizen level, and every report you've published on CivicTwin.",
      },
      { property: "og:title", content: "My reports & civic rank — CivicTwin" },
      {
        property: "og:description",
        content:
          "Track your civic points, citizen level, and every report you've published on CivicTwin.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile(user?.id);
  const fileInput = useRef<HTMLInputElement>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [stateName, setStateName] = useState("");
  const [cityName, setCityName] = useState("");
  const [savingPlace, setSavingPlace] = useState(false);

  useEffect(() => {
    setStateName(profile?.state ?? "");
    setCityName(profile?.city ?? "");
  }, [profile?.state, profile?.city]);

  const { data: myReports = [] } = useQuery({
    queryKey: ["my-reports", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*, issues(title)")
        .eq("author_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Report[];
    },
  });

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <span className="size-8 animate-pulse rounded-full bg-muted" />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 pt-16">
        <div className="report-card flex max-w-md flex-col items-center gap-4 p-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Trophy className="size-6" />
          </span>
          <h1 className="font-display text-2xl font-bold">Your civic rank awaits</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to earn civic points for every report you publish and climb from
            Bronze to Diamond.
          </p>
          <Button
            className="rounded-full"
            onClick={() => navigate({ to: "/auth", search: { next: "/profile" } })}
          >
            Sign in
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </main>
    );
  }

  const points = profile?.points ?? 0;
  const { current, next, progress, remaining } = levelProgress(points);
  const confirmations = myReports.reduce((acc, r) => acc + r.confirmations, 0);

  return (
    <main className="min-h-screen bg-background pb-24 pt-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* ── Rank header ─────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="report-card p-6 sm:p-8"
        >
          <div className="flex flex-col gap-8 sm:flex-row sm:items-center">
            <div className="relative size-20 shrink-0">
              <UserAvatar
                name={profile?.full_name}
                src={profile?.avatar_url}
                className="size-20 text-3xl"
              />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-card transition-colors hover:bg-secondary"
                aria-label="Change profile photo"
              >
                <Pencil className="size-3.5" />
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  if (!file.type.startsWith("image/")) {
                    toast.error("Please choose an image file.");
                    return;
                  }
                  setCropFile(file);
                  setCropOpen(true);
                }}
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-display text-3xl font-bold tracking-tight">
                  {profile?.full_name ?? "Citizen"}
                </h1>
                <LevelBadge points={points} className="px-3 py-1 text-xs" />
              </div>
              {(cityName || profile?.city) && (
                <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="size-3.5 text-primary" />
                  {[cityName || profile?.city, stateName || profile?.state].filter(Boolean).join(", ")}
                </p>
              )}
              <div className="mt-4 grid max-w-md gap-3 sm:grid-cols-2">
                <PlaceSelect
                  label="State"
                  value={stateName}
                  options={STATE_NAMES}
                  placeholder="Search state"
                  onChange={(value) => {
                    setStateName(value);
                    setCityName("");
                  }}
                />
                <PlaceSelect
                  label="City"
                  value={cityName}
                  options={citiesForState(stateName)}
                  placeholder={stateName ? "Search city" : "Choose a state first"}
                  disabled={!stateName}
                  onChange={setCityName}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={savingPlace || !stateName || !cityName || (stateName === profile?.state && cityName === profile?.city)}
                onClick={async () => {
                  if (!user) return;
                  setSavingPlace(true);
                  const { error } = await supabase
                    .from("profiles")
                    .update({ state: stateName, city: cityName })
                    .eq("id", user.id);
                  setSavingPlace(false);
                  if (error) {
                    toast.error(error.message);
                    return;
                  }
                  await queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
                  await queryClient.invalidateQueries({ queryKey: ["reports"] });
                  toast.success(`Location set to ${cityName}, ${stateName}.`);
                }}
              >
                Save location
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full text-muted-foreground"
                onClick={async () => {
                  await supabase.auth.signOut();
                  toast.success("Signed out.");
                  void navigate({ to: "/" });
                }}
              >
                <LogOut className="size-4" />
                Sign out
              </Button>
              </div>

              <div className="mt-5 max-w-md">
                <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                  <span className="uppercase tracking-widest">{current.label}</span>
                  <span>
                    {next ? `${remaining} pts to ${next.label}` : "Highest level reached"}
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress * 100}%` }}
                    transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="h-full rounded-full bg-primary"
                  />
                </div>
              </div>
            </div>

            <div className="shrink-0 text-center sm:text-right">
              <p className="font-display text-5xl font-bold tabular-nums">{points}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Civic points
              </p>
              <p className="mx-auto mt-2 max-w-56 text-center text-xs text-muted-foreground sm:mr-0 sm:ml-auto sm:text-right">
                +10 per published report, up to +10 bonus from AI impact
              </p>
            </div>
          </div>

          {/* Level ladder */}
          <div className="mt-8 grid grid-cols-2 gap-2 border-t border-border pt-6 sm:grid-cols-4">
            {LEVELS.map((l) => {
              const reached = points >= l.min;
              return (
                <div
                  key={l.value}
                  className={cn(
                    "flex items-center justify-between rounded-xl border px-3 py-2",
                    reached
                      ? "border-primary/30 bg-accent/60"
                      : "border-border bg-muted/40 opacity-60",
                  )}
                >
                  <span className="text-xs font-semibold">{l.label}</span>
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {l.min}+ pts
                  </span>
                </div>
              );
            })}
          </div>
        </motion.section>

        {/* ── Stats ───────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="mt-4 grid gap-4 sm:grid-cols-3"
        >
          {[
            { icon: Camera, label: "Reports published", value: myReports.length },
            { icon: ArrowBigUp, label: "Confirmations received", value: confirmations },
            { icon: Trophy, label: "Current level", value: current.label },
          ].map((s) => (
            <div key={s.label} className="report-card flex items-center gap-4 p-5">
              <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <s.icon className="size-5" />
              </span>
              <div>
                <p className="font-display text-2xl font-bold tabular-nums">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </motion.section>

        {/* ── My reports ──────────────────────────────────────────── */}
        <section className="mt-12">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-display text-2xl font-bold tracking-tight">My reports</h2>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => navigate({ to: "/report/new" })}
            >
              <Camera className="size-4" />
              New report
            </Button>
          </div>

          {myReports.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
              <Camera className="size-8 text-muted-foreground" />
              <p className="text-muted-foreground">
                No reports yet — your first one earns you civic points.
              </p>
              <Button className="rounded-full" onClick={() => navigate({ to: "/report/new" })}>
                Report a problem
                <ArrowRight className="size-4" />
              </Button>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {myReports.map((report, i) => (
                <motion.div
                  key={report.id}
                  initial={{ opacity: 0, y: 48 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.6, delay: (i % 3) * 0.1, ease: [0.22, 1, 0.36, 1] }}
                >
                  <ReportCard report={report} />
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </div>
      <AvatarCropDialog
        file={cropFile}
        open={cropOpen}
        onOpenChange={setCropOpen}
        onCropped={async (blob) => {
          if (!user) return;
          try {
            const url = await uploadAvatarPhoto(blob, user.id);
            const { error } = await supabase
              .from("profiles")
              .update({ avatar_url: url })
              .eq("id", user.id);
            if (error) throw new Error(error.message);
            await queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
            toast.success("Profile photo updated.");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not save photo");
            throw e;
          }
        }}
      />
    </main>
  );
}
