import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { departmentCredentialsOk, signDepartmentToken, verifyDepartmentToken } from "@/lib/department.server";
import { categoryLabel } from "@/lib/constants";

function requireDept(token: string) {
  if (!verifyDepartmentToken(token)) throw new Error("Department session expired. Sign in again.");
}

export const loginDepartment = createServerFn({ method: "POST" })
  .validator((data) => z.object({ id: z.string(), password: z.string() }).parse(data))
  .handler(async ({ data }) => {
    if (!departmentCredentialsOk(data.id.trim(), data.password)) {
      throw new Error("Invalid department ID or password.");
    }
    return { token: signDepartmentToken() };
  });

export const listDepartmentReports = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        token: z.string(),
        state: z.string().optional(),
        city: z.string().optional(),
        moderation: z.enum(["all", "pending", "approved", "rejected"]).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    requireDept(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("reports")
      .select("*, profiles(full_name, city, state, points, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.moderation && data.moderation !== "all") q = q.eq("moderation", data.moderation);
    if (data.state) q = q.eq("state", data.state);
    if (data.city) q = q.eq("city", data.city);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const decideDepartmentReport = createServerFn({ method: "POST" })
  .validator((data) =>
    z.object({ token: z.string(), reportId: z.string(), decision: z.enum(["approved", "rejected"]) }).parse(data),
  )
  .handler(async ({ data }) => {
    requireDept(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: report, error: loadError } = await supabaseAdmin
      .from("reports")
      .select("*")
      .eq("id", data.reportId)
      .single();
    if (loadError || !report) throw new Error(loadError?.message ?? "Report not found");

    if (data.decision === "rejected") {
      const { error } = await supabaseAdmin
        .from("reports")
        .update({ moderation: "rejected" })
        .eq("id", data.reportId);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    let issueId = report.issue_id as string | null;
    if (!issueId) {
      const { data: nearby } = await supabaseAdmin
        .from("issues")
        .select("id")
        .eq("category", report.category)
        .neq("status", "resolved")
        .gte("lat", report.lat - 0.002)
        .lte("lat", report.lat + 0.002)
        .gte("lng", report.lng - 0.002)
        .lte("lng", report.lng + 0.002)
        .limit(1);
      issueId = nearby?.[0]?.id ?? null;
    }
    if (!issueId) {
      const { data: issue, error: issueError } = await supabaseAdmin
        .from("issues")
        .insert({
          title: report.ai_summary
            ? String(report.ai_summary).slice(0, 80)
            : `${categoryLabel(report.category as "pothole")} at ${report.location_name}`,
          category: report.category,
          severity: report.severity,
          status: "open",
          lat: report.lat,
          lng: report.lng,
          location_name: report.location_name,
          city: report.city,
          state: report.state,
          impact_score: report.impact_score,
          summary: report.ai_summary,
          report_count: 1,
        })
        .select("id")
        .single();
      if (issueError) throw new Error(issueError.message);
      issueId = issue.id;
    }

    const { error } = await supabaseAdmin
      .from("reports")
      .update({ moderation: "approved", issue_id: issueId, status: "open" })
      .eq("id", data.reportId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateDepartmentReport = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        token: z.string(),
        reportId: z.string(),
        status: z.enum(["open", "acknowledged", "in_progress", "resolved"]).optional(),
        remove: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    requireDept(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.remove) {
      const { error } = await supabaseAdmin.from("reports").delete().eq("id", data.reportId);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    if (data.status) {
      const { data: report, error: loadError } = await supabaseAdmin
        .from("reports")
        .select("issue_id")
        .eq("id", data.reportId)
        .single();
      if (loadError) throw new Error(loadError.message);
      const { error } = await supabaseAdmin.from("reports").update({ status: data.status }).eq("id", data.reportId);
      if (error) throw new Error(error.message);
      if (report?.issue_id) {
        await supabaseAdmin.from("issues").update({ status: data.status }).eq("id", report.issue_id);
      }
    }
    return { ok: true };
  });
