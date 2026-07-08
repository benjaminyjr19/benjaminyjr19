import { isDemoMode } from "@/lib/env";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const RESOURCE_BUCKET = "resources";

/**
 * Store the original upload in Supabase Storage.
 * Path convention: {centreId}/{resourceId}/{filename} — storage RLS policies
 * key off the first path segment.
 *
 * In preview mode there is no storage backend; the resource keeps its parsed
 * text and metadata, and "original file" affordances are hidden.
 */
export async function storeOriginalFile(input: {
  centreId: string;
  resourceId: string;
  filename: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<string | null> {
  if (isDemoMode()) return null;

  const admin = createAdminSupabase();
  if (!admin) return null;

  const safeName = input.filename.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "upload";
  const path = `${input.centreId}/${input.resourceId}/${safeName}`;

  const { error } = await admin.storage
    .from(RESOURCE_BUCKET)
    .upload(path, input.buffer, { contentType: input.mimeType, upsert: true });

  if (error) {
    // Storage failure should not block the upload flow — text is already extracted.
    console.error(`[atlas] storage upload failed: ${error.message}`);
    return null;
  }
  return path;
}

/** Signed URL for downloading an original file (1 hour). */
export async function getOriginalFileUrl(path: string): Promise<string | null> {
  if (isDemoMode()) return null;
  const admin = createAdminSupabase();
  if (!admin) return null;
  const { data, error } = await admin.storage
    .from(RESOURCE_BUCKET)
    .createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}
