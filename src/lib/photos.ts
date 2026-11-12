import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { createCloudflareImageUpload } from "@/lib/photos.functions";

const BUCKET = "report-photos";
const AVATAR_BUCKET = "avatars";

/**
 * Photo sources:
 * - "/images/..." or "http..." → used directly (seeded assets or Cloudflare)
 * - "sb:<path>" → Supabase Storage object, resolved through a signed URL
 */
export function isStoragePath(src: string) {
  return src.startsWith("sb:");
}

export function isRemoteUrl(src: string) {
  return src.startsWith("http://") || src.startsWith("https://");
}

export async function uploadReportPhoto(file: File, userId: string): Promise<string> {
  const ticket = await createCloudflareImageUpload({
    data: {
      filename: file.name || "report.jpg",
      contentType: file.type || "image/jpeg",
    },
  });

  if (ticket.configured) {
    const form = new FormData();
    form.set("file", file);
    const upload = await fetch(ticket.uploadURL, { method: "POST", body: form });
    if (!upload.ok) {
      const body = await upload.text().catch(() => "");
      throw new Error(`Cloudflare upload failed (${upload.status}): ${body.slice(0, 180)}`);
    }
    return ticket.publicUrl;
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data?.publicUrl || `sb:${path}`;
}

export async function uploadAvatarPhoto(blob: Blob, userId: string): Promise<string> {
  const path = `${userId}/avatar.jpg`;
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, blob, {
    cacheControl: "3600",
    upsert: true,
    contentType: "image/jpeg",
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  const url = data?.publicUrl;
  if (!url) throw new Error("Could not build avatar URL");
  return `${url}?v=${Date.now()}`;
}

export async function signStoragePhoto(src: string): Promise<string> {
  if (!isStoragePath(src)) return src;
  const path = src.slice(3);
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? "Could not sign photo URL");
  return data.signedUrl;
}

export function usePhotoUrl(src: string | null | undefined) {
  return (
    useQuery({
      queryKey: ["photo-url", src],
      enabled: !!src && isStoragePath(src),
      staleTime: 50 * 60 * 1000,
      queryFn: () => signStoragePhoto(src!),
    }).data ?? (src && !isStoragePath(src) ? src : undefined)
  );
}
