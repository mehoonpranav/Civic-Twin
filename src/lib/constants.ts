import {
  AlertTriangle,
  Construction,
  Droplets,
  Lamp,
  Lightbulb,
  Trash2,
  Waves,
  type LucideIcon,
} from "lucide-react";

export type Category =
  | "pothole"
  | "waterlogging"
  | "garbage"
  | "streetlight"
  | "road_damage"
  | "drainage"
  | "other";

export type Severity = "low" | "moderate" | "high" | "critical";
export type Status = "open" | "acknowledged" | "in_progress" | "resolved";
export type Moderation = "pending" | "approved" | "rejected";

export interface Issue {
  id: string;
  title: string;
  category: Category;
  severity: Severity;
  status: Status;
  summary: string | null;
  location_name: string;
  city?: string | null;
  state?: string | null;
  lat: number;
  lng: number;
  impact_score: number;
  report_count: number;
  is_recurring: boolean;
  resolved_photo_url: string | null;
  resolution_note: string | null;
  ai_verdict: string | null;
  created_at: string;
  updated_at: string;
}

export interface Report {
  id: string;
  issue_id: string | null;
  author_id: string | null;
  photo_url: string;
  category: Category;
  severity: Severity;
  status: Status;
  description: string | null;
  location_name: string;
  city: string | null;
  state: string | null;
  lat: number;
  lng: number;
  impact_score: number;
  confirmations: number;
  ai_summary: string | null;
  moderation: Moderation;
  created_at: string;
  updated_at: string;
  issues?: { title: string } | null;
  profiles?: { full_name: string | null; points: number; avatar_url: string | null } | null;
}

export interface Profile {
  id: string;
  full_name: string | null;
  city: string | null;
  state: string | null;
  points: number;
  avatar_url: string | null;
  created_at: string;
}

/* ── Citizen ranking ─────────────────────────────────────────── */

export type Level = "bronze" | "gold" | "platinum" | "diamond";

export interface LevelInfo {
  value: Level;
  label: string;
  min: number;
}

export const LEVELS: LevelInfo[] = [
  { value: "bronze", label: "Bronze", min: 0 },
  { value: "gold", label: "Gold", min: 50 },
  { value: "platinum", label: "Platinum", min: 150 },
  { value: "diamond", label: "Diamond", min: 400 },
];

export const levelForPoints = (points: number): LevelInfo => {
  let current = LEVELS[0]!;
  for (const l of LEVELS) if (points >= l.min) current = l;
  return current;
};

export const levelProgress = (points: number) => {
  const current = levelForPoints(points);
  const next = LEVELS[LEVELS.indexOf(current) + 1] ?? null;
  const progress = next ? (points - current.min) / (next.min - current.min) : 1;
  return {
    current,
    next,
    progress: Math.min(1, Math.max(0, progress)),
    remaining: next ? Math.max(0, next.min - points) : 0,
  };
};

/** Mirrors the award_report_points DB trigger: 10 base + up to 10 by AI impact. */
export const pointsForImpact = (impactScore: number) =>
  10 + Math.round(impactScore / 10);

export const CATEGORIES: { value: Category; label: string; icon: LucideIcon }[] = [
  { value: "pothole", label: "Pothole", icon: AlertTriangle },
  { value: "waterlogging", label: "Waterlogging", icon: Waves },
  { value: "garbage", label: "Garbage", icon: Trash2 },
  { value: "streetlight", label: "Streetlight", icon: Lightbulb },
  { value: "road_damage", label: "Road damage", icon: Construction },
  { value: "drainage", label: "Drainage", icon: Droplets },
  { value: "other", label: "Other", icon: Lamp },
];

export const categoryLabel = (c: Category) =>
  CATEGORIES.find((x) => x.value === c)?.label ?? c;

export const categoryIcon = (c: Category): LucideIcon =>
  CATEGORIES.find((x) => x.value === c)?.icon ?? Lamp;

export const SEVERITIES: { value: Severity; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "moderate", label: "Moderate" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export const STATUSES: { value: Status; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
];

export const statusLabel = (s: Status) =>
  STATUSES.find((x) => x.value === s)?.label ?? s;

/** Strips markdown emphasis/headings from AI-generated text for plain rendering. */
export const stripMarkdown = (s: string) =>
  s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^[-*]\s+/gm, "• ");

export const DEFAULT_CENTER = { lat: 22.5355, lng: 88.3655 }; // Kolkata
