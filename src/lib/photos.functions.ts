import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createCloudflareImageUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        filename: z.string().min(1).max(200),
        contentType: z.string().min(1).max(100),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const accountId = process.env["CLOUDFLARE_ACCOUNT_ID"];
    const token = process.env["CLOUDFLARE_IMAGES_API_TOKEN"];
    const accountHash = process.env["CLOUDFLARE_IMAGES_ACCOUNT_HASH"];

    if (!accountId || !token || !accountHash) {
      return { configured: false as const };
    }

    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v2/direct_upload`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: (() => {
          const form = new FormData();
          form.set("requireSignedURLs", "false");
          form.set("metadata", JSON.stringify({ filename: data.filename, contentType: data.contentType }));
          return form;
        })(),
      },
    );

    const json = (await res.json()) as {
      success?: boolean;
      errors?: { message?: string }[];
      result?: { id?: string; uploadURL?: string };
    };

    if (!res.ok || !json.success || !json.result?.id || !json.result.uploadURL) {
      const detail = json.errors?.[0]?.message ?? `Cloudflare Images error (${res.status})`;
      throw new Error(detail);
    }

    return {
      configured: true as const,
      id: json.result.id,
      uploadURL: json.result.uploadURL,
      publicUrl: `https://imagedelivery.net/${accountHash}/${json.result.id}/public`,
    };
  });
