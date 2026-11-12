import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, LogOut, Shield, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PlaceSelect } from "@/components/PlaceSelect";
import { SeverityBadge, StatusPill } from "@/components/badges";
import { usePhotoUrl } from "@/lib/photos";
import {
  decideDepartmentReport,
  listDepartmentReports,
  updateDepartmentReport,
} from "@/lib/department.functions";
import { clearDepartmentToken, getDepartmentToken } from "@/lib/department";
import { citiesForState, STATE_NAMES } from "@/lib/india-places";
import { STATUSES, categoryLabel, type Moderation, type Report, type Status } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/department/desk")({
  head: () => ({
    meta: [{ title: "Department desk — CivicTwin" }],
  }),
  component: DepartmentDesk,
});

export function DepartmentDesk() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [rows, setRows] = useState<Report[]>([]);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [moderation, setModeration] = useState<"all" | Moderation>("pending");

  const load = async (session = token) => {
    if (!session) return;
    setBusy(true);
    try {
      const data = await listDepartmentReports({
        data: {
          token: session,
          state: state || undefined,
          city: city || undefined,
          moderation,
        },
      });
      setRows(data as unknown as Report[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load reports");
      if (e instanceof Error && e.message.includes("expired")) {
        clearDepartmentToken();
        window.location.assign("/department");
      }
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const session = getDepartmentToken();
    if (!session) {
      window.location.assign("/department");
      return;
    }
    setToken(session);
    void load(session);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pendingCount = useMemo(() => rows.filter((r) => r.moderation === "pending").length, [rows]);

  return (
    <main className="min-h-screen bg-background pb-24 pt-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="chip w-fit">
              <Shield className="size-3.5" />
              Department desk
            </p>
            <h1 className="font-display mt-3 text-3xl font-bold tracking-tight">Review queue</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Approve reports before they appear on the public feed. {pendingCount} waiting.
            </p>
          </div>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => {
              clearDepartmentToken();
              window.location.assign("/department");
            }}
          >
            <LogOut className="size-4" />
            Sign out
          </Button>
        </div>

        <div className="mt-6 grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-4">
          <PlaceSelect
            label="State"
            value={state}
            options={STATE_NAMES}
            placeholder="All states"
            onChange={(value) => {
              setState(value);
              setCity("");
            }}
          />
          <PlaceSelect
            label="City"
            value={city}
            options={citiesForState(state)}
            placeholder={state ? "All cities" : "Choose state"}
            disabled={!state}
            onChange={setCity}
          />
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Status</p>
            <div className="flex flex-wrap gap-1.5">
              {(["pending", "approved", "rejected", "all"] as const).map((m) => (
                <button
                  key={m}
                  className={cn("chip", moderation === m && "chip-active")}
                  onClick={() => setModeration(m)}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-end">
            <Button className="w-full rounded-full" disabled={busy || !token} onClick={() => void load()}>
              Apply filters
            </Button>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {rows.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
              No reports in this filter.
            </p>
          )}
          {rows.map((report) => (
            <DeskRow
              key={report.id}
              report={report}
              token={token}
              onChanged={() => void load()}
            />
          ))}
        </div>
      </div>
    </main>
  );
}

function DeskRow({
  report,
  token,
  onChanged,
}: {
  report: Report;
  token: string;
  onChanged: () => void;
}) {
  const photo = usePhotoUrl(report.photo_url);
  const [busy, setBusy] = useState(false);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="shadow-card overflow-hidden rounded-2xl border border-border bg-card">
      <div className="grid gap-4 p-4 sm:grid-cols-[180px_1fr]">
        <div className="overflow-hidden rounded-xl bg-muted">
          {photo ? <img src={photo} alt="" className="aspect-[4/3] w-full object-cover" /> : <div className="aspect-[4/3]" />}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip">{categoryLabel(report.category)}</span>
            <SeverityBadge severity={report.severity} />
            <StatusPill status={report.status} />
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider",
                report.moderation === "approved" && "bg-status-resolved/15 text-status-resolved",
                report.moderation === "rejected" && "bg-destructive/10 text-destructive",
                report.moderation === "pending" && "bg-status-open/15 text-status-open",
              )}
            >
              {report.moderation ?? "pending"}
            </span>
          </div>
          <p className="mt-2 text-sm font-medium">{report.location_name}</p>
          <p className="text-xs text-muted-foreground">
            {[report.city, report.state].filter(Boolean).join(", ") || "No city tagged"}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-foreground/90">
            {report.ai_summary ?? report.description ?? "No description"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {report.moderation !== "approved" && (
              <Button
                size="sm"
                className="rounded-full"
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    await decideDepartmentReport({ data: { token, reportId: report.id, decision: "approved" } });
                    toast.success("Report approved and published.");
                  })
                }
              >
                <Check className="size-3.5" />
                Approve
              </Button>
            )}
            {report.moderation !== "rejected" && (
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    await decideDepartmentReport({ data: { token, reportId: report.id, decision: "rejected" } });
                    toast.success("Report rejected.");
                  })
                }
              >
                <X className="size-3.5" />
                Reject
              </Button>
            )}
            {STATUSES.map((s) => (
              <button
                key={s.value}
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    await updateDepartmentReport({
                      data: { token, reportId: report.id, status: s.value as Status },
                    });
                    toast.success(`Status: ${s.label}`);
                  })
                }
                className={cn("chip", report.status === s.value && "chip-active")}
              >
                {s.label}
              </button>
            ))}
            <Button
              size="sm"
              variant="ghost"
              className="rounded-full text-destructive"
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  await updateDepartmentReport({ data: { token, reportId: report.id, remove: true } });
                  toast.success("Report deleted.");
                })
              }
            >
              <Trash2 className="size-3.5" />
              Delete
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
