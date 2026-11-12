import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  Crosshair,
  ImagePlus,
  Loader2,
  MapPin,
  RefreshCw,
  Sparkles,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Category, Severity } from "@/lib/constants";
import { CATEGORIES, categoryLabel, DEFAULT_CENTER, pointsForImpact, SEVERITIES } from "@/lib/constants";
import { coordsForPlace } from "@/lib/india-places";
import { signStoragePhoto, uploadReportPhoto } from "@/lib/photos";
import { analyzeCivicPhoto } from "@/lib/ai.functions";
import { useProfile, useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";
import { CityMap } from "@/components/CityMap";
import { ClientOnly } from "@/components/ClientOnly";
import { ImpactMeter, SeverityBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/report/new")({
  head: () => ({
    meta: [
      { title: "Report a problem — CivicTwin" },
      {
        name: "description",
        content:
          "Report a civic problem in under a minute: photo, location, and instant AI triage with category, severity, and impact scoring.",
      },
      { property: "og:title", content: "Report a problem — CivicTwin" },
      {
        property: "og:description",
        content: "Photo in, AI triage out. Publish a civic report in under a minute.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewReportPage,
});

const STEPS = ["Photo", "Location", "AI triage", "Review"] as const;

interface AnalysisResult {
  category: Category;
  severity: Severity;
  impact_score: number;
  title: string;
  summary: string;
}

function inspectImageFile(file: File): Promise<{ blank: boolean }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const w = 64;
        const h = Math.max(1, Math.round((img.height / img.width) * w));
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve({ blank: false });
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const { data } = ctx.getImageData(0, 0, w, h);
        let sum = 0;
        let sumSq = 0;
        const n = data.length / 4;
        for (let i = 0; i < data.length; i += 4) {
          const y = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
          sum += y;
          sumSq += y * y;
        }
        const mean = sum / n;
        const variance = sumSq / n - mean * mean;
        URL.revokeObjectURL(url);
        resolve({ blank: variance < 40 || mean > 248 || mean < 8 });
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image."));
    };
    img.src = url;
  });
}

function NewReportPage() {
  const navigate = useNavigate();
  const { user, loading } = useSession();
  const { data: profile } = useProfile(user?.id);

  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [photoSignedUrl, setPhotoSignedUrl] = useState<string | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locationName, setLocationName] = useState("");
  const [description, setDescription] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [category, setCategory] = useState<Category>("other");
  const [severity, setSeverity] = useState<Severity>("moderate");
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiFailed, setAiFailed] = useState(false);
  const [photoWarning, setPhotoWarning] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) {
      void navigate({ to: "/auth", search: { next: "/report/new" } });
    }
  }, [user, loading, navigate]);

  const onFile = useCallback(async (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    try {
      const { blank } = await inspectImageFile(f);
      if (blank) {
        setPhotoWarning("This photo looks blank or empty. Take a clear picture of the actual problem.");
        toast.error("Blank or empty photos are not allowed.");
        return;
      }
    } catch {
      toast.error("Could not read that image. Try another file.");
      return;
    }
    setPhotoWarning(null);
    setFile(f);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(f);
    });
  }, []);

  const uploadStep = async () => {
    if (!file || !user) return;
    setBusy(true);
    try {
      const path = await uploadReportPhoto(file, user.id);
      setPhotoPath(path);
      const signed = await signStoragePhoto(path);
      setPhotoSignedUrl(signed);
      setStep(1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const useGps = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not available on this device.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        if (!locationName) {
          setLocationName(
            `Pinned location (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`,
          );
        }
        toast.success("GPS location captured.");
      },
      () => toast.error("Couldn't get GPS position — drop a pin on the map instead."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const runAnalysis = useCallback(async () => {
    if (!photoSignedUrl) return;
    setAiBusy(true);
    setAiFailed(false);
    try {
      const result = await analyzeCivicPhoto({
        data: {
          imageUrl: photoSignedUrl,
          description: description || undefined,
          locationName: locationName || undefined,
        },
      });
      if (result.accepted === false) {
        const warning =
          result.warning ||
          "We can't create a report from this photo. Use a clear photo of a real city problem.";
        setPhotoWarning(warning);
        setAnalysis(null);
        setAiFailed(false);
        setFile(null);
        setPreview((old) => {
          if (old) URL.revokeObjectURL(old);
          return null;
        });
        setPhotoPath(null);
        setPhotoSignedUrl(null);
        setStep(0);
        toast.error(warning);
        return;
      }
      const validCategory = CATEGORIES.some((c) => c.value === result.category)
        ? (result.category as Category)
        : "other";
      const validSeverity = SEVERITIES.some((s) => s.value === result.severity)
        ? (result.severity as Severity)
        : "moderate";
      const normalized: AnalysisResult = {
        category: validCategory,
        severity: validSeverity,
        impact_score: result.impact_score,
        title: result.title,
        summary: result.summary,
      };
      setAnalysis(normalized);
      setCategory(validCategory);
      setSeverity(validSeverity);
      toast.success(`AI triage complete — ${categoryLabel(validCategory)} · ${validSeverity} severity.`);
    } catch (e) {
      setAiFailed(true);
      toast.error(e instanceof Error ? e.message : "AI analysis failed");
    } finally {
      setAiBusy(false);
    }
  }, [photoSignedUrl, description, locationName]);

  useEffect(() => {
    if (step === 2 && !analysis && !aiBusy && !aiFailed) void runAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const publish = async () => {
    if (!user || !photoPath || lat == null || lng == null) return;
    setBusy(true);
    try {
      const { data: report, error } = await supabase
        .from("reports")
        .insert({
          issue_id: null,
          author_id: user.id,
          photo_url: photoPath,
          category,
          severity,
          status: "open",
          moderation: "pending",
          description: description || null,
          location_name: locationName,
          city: profile?.city ?? null,
          state: profile?.state ?? null,
          lat,
          lng,
          impact_score: analysis?.impact_score ?? 50,
          ai_summary: analysis?.summary ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;

      toast.success("Submitted for department review. You'll see it on your profile while it waits.");
      void navigate({ to: "/profile" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Publishing failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background pb-24 pt-24">
      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">Report a problem</h1>
        <p className="mt-1 text-muted-foreground">Photo in, AI triage out. Under a minute.</p>

        {/* Stepper */}
        <ol className="mt-8 flex items-center gap-2">
          {STEPS.map((label, i) => (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
                  i < step
                    ? "bg-status-resolved text-white"
                    : i === step
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {i < step ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span
                className={cn(
                  "hidden text-xs font-medium sm:block",
                  i === step ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
              {i < STEPS.length - 1 && <span className="h-px flex-1 bg-border" />}
            </li>
          ))}
        </ol>

        <div className="shadow-card mt-8 overflow-hidden rounded-2xl border border-border bg-card">
          <AnimatePresence mode="wait">
            {/* STEP 1 — PHOTO */}
            {step === 0 && (
              <motion.div
                key="photo"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="p-6"
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInput.current?.click()}
                  onKeyDown={(e) => e.key === "Enter" && fileInput.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    onFile(e.dataTransfer.files?.[0] ?? null);
                  }}
                  className={cn(
                    "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors",
                    preview
                      ? "border-transparent p-0"
                      : "border-border bg-muted/40 px-6 py-16 hover:border-primary/50 hover:bg-accent/40",
                  )}
                >
                  {preview ? (
                    <img
                      src={preview}
                      alt="Selected problem"
                      className="max-h-80 w-full rounded-xl object-cover"
                    />
                  ) : (
                    <>
                      <span className="flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                        <ImagePlus className="size-6" />
                      </span>
                      <p className="mt-4 font-medium">Drag & drop a photo, or click to browse</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        A clear shot of the road, drain, flood, garbage, or streetlight. No blank or inappropriate photos.
                      </p>
                    </>
                  )}
                </div>
                {photoWarning && (
                  <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {photoWarning}
                  </div>
                )}
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                />
                <div className="mt-6 flex justify-end">
                  <Button
                    className="rounded-full px-6"
                    disabled={!file || busy}
                    onClick={uploadStep}
                  >
                    {busy ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Upload className="size-4" />
                    )}
                    Upload & continue
                  </Button>
                </div>
              </motion.div>
            )}

            {/* STEP 2 — LOCATION */}
            {step === 1 && (
              <motion.div
                key="location"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="p-6"
              >
                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" className="rounded-full" onClick={useGps}>
                    <Crosshair className="size-4" />
                    Use my GPS
                  </Button>
                  <p className="self-center text-sm text-muted-foreground">
                    or click anywhere on the map to drop a pin
                  </p>
                </div>

                <ClientOnly
                  fallback={<div className="mt-4 h-72 animate-pulse rounded-xl bg-muted" />}
                >
                  <CityMap
                    className="mt-4 h-72 w-full overflow-hidden rounded-xl border border-border"
                    picked={lat != null && lng != null ? { lat, lng } : null}
                    onPickLocation={(la, ln) => {
                      setLat(la);
                      setLng(ln);
                      if (!locationName) {
                        setLocationName(`Pinned location (${la.toFixed(4)}, ${ln.toFixed(4)})`);
                      }
                    }}
                    center={
                      lat != null && lng != null
                        ? { lat, lng }
                        : coordsForPlace(profile?.city, profile?.state) ?? DEFAULT_CENTER
                    }
                    zoom={lat != null ? 15 : 12}
                  />
                </ClientOnly>

                <div className="mt-4">
                  <label className="mb-1.5 block text-sm font-medium">Location name</label>
                  <Input
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    placeholder="e.g. Park Street crossing, near metro gate 2"
                  />
                </div>

                <div className="mt-6 flex justify-between">
                  <Button variant="ghost" onClick={() => setStep(0)}>
                    Back
                  </Button>
                  <Button
                    className="rounded-full px-6"
                    disabled={lat == null || lng == null || !locationName.trim()}
                    onClick={() => setStep(2)}
                  >
                    <MapPin className="size-4" />
                    Continue to AI triage
                  </Button>
                </div>
              </motion.div>
            )}

            {/* STEP 3 — AI TRIAGE */}
            {step === 2 && (
              <motion.div
                key="analysis"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="p-6"
              >
                {aiBusy ? (
                  <div className="flex flex-col items-center gap-4 py-14 text-center">
                    <span className="relative flex size-16 items-center justify-center">
                      <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
                      <Sparkles className="size-7 text-primary" />
                    </span>
                    <div>
                      <p className="font-display font-semibold">AI is studying your photo…</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Detecting problem type, severity and civic impact.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {aiFailed && (
                      <div className="mb-4 rounded-xl border border-severity-high/40 bg-severity-high/10 p-4 text-sm">
                        <p className="font-medium">AI analysis didn't complete.</p>
                        <p className="mt-1 text-muted-foreground">
                          The AI service returned an error — you can retry or fill the details manually.
                        </p>
                        <div className="mt-3 flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => void runAnalysis()}>
                            <RefreshCw className="size-3.5" />
                            Retry
                          </Button>
                        </div>
                      </div>
                    )}

                    {analysis && (
                      <div className="mb-5 rounded-xl border border-primary/20 bg-accent/50 p-4">
                        <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-accent-foreground">
                          <Sparkles className="size-3.5" />
                          AI triage result
                        </p>
                        <p className="text-sm leading-relaxed">{analysis.summary}</p>
                        <div className="mt-3 flex items-center justify-between">
                          <ImpactMeter score={analysis.impact_score} />
                          <span className="text-xs text-muted-foreground">impact score</span>
                        </div>
                      </div>
                    )}

                    <div className="space-y-5">
                      <div>
                        <label className="mb-2 block text-sm font-medium">Problem type</label>
                        <div className="flex flex-wrap gap-2">
                          {CATEGORIES.map((c) => (
                            <button
                              key={c.value}
                              className={cn("chip", category === c.value && "chip-active")}
                              onClick={() => setCategory(c.value)}
                            >
                              <c.icon className="size-3.5" />
                              {c.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium">Severity</label>
                        <div className="flex flex-wrap gap-2">
                          {SEVERITIES.map((s) => (
                            <button
                              key={s.value}
                              onClick={() => setSeverity(s.value)}
                              className={cn(
                                "transition-transform",
                                severity === s.value && "scale-105",
                              )}
                            >
                              <SeverityBadge severity={s.value} />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium">
                          Short description <span className="text-muted-foreground">(optional)</span>
                        </label>
                        <Textarea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Anything else officers should know…"
                          rows={3}
                        />
                      </div>
                    </div>

                    <div className="mt-6 flex justify-between">
                      <Button variant="ghost" onClick={() => setStep(1)}>
                        Back
                      </Button>
                      <Button className="rounded-full px-6" onClick={() => setStep(3)}>
                        Review report
                      </Button>
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {/* STEP 4 — REVIEW */}
            {step === 3 && (
              <motion.div
                key="review"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="p-6"
              >
                <div className="overflow-hidden rounded-xl border border-border">
                  {preview && (
                    <img
                      src={preview}
                      alt="Report preview"
                      className="aspect-[16/9] w-full object-cover"
                    />
                  )}
                  <div className="space-y-3 p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityBadge severity={severity} />
                      <span className="chip">{categoryLabel(category)}</span>
                      {analysis && <ImpactMeter score={analysis.impact_score} />}
                    </div>
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="size-4 text-primary" />
                      {locationName}
                    </p>
                    {description && (
                      <p className="text-sm leading-relaxed text-foreground/90">{description}</p>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex justify-between">
                  <Button variant="ghost" onClick={() => setStep(2)}>
                    Back
                  </Button>
                  <Button
                    size="lg"
                    className="rounded-full px-8"
                    disabled={busy}
                    onClick={() => void publish()}
                  >
                    {busy ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Camera className="size-4" />
                    )}
                    Publish report
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}
