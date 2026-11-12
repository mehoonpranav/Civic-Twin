import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Grants the caller the officer role, but only while the platform has zero
 * officers — a one-time bootstrap so the first administrator can get in.
 * Afterwards, roles are granted by existing admins in the database.
 */
export const bootstrapOfficer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error: countError } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "officer");
    if (countError) throw new Error(countError.message);
    if ((count ?? 0) > 0) {
      throw new Error("Officer access is managed by your administrator.");
    }
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "officer" });
    if (error) throw new Error(error.message);
    return { granted: true };
  });
