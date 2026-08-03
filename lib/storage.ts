/**
 * Supabase Storage upload utility.
 * Handles image uploads for posts, stories, and avatars.
 */
import { supabase } from './supabase';
import { isLocalFileUri } from './media';

/** Local file:// URIs that should be uploaded to Supabase Storage instead of stored directly */
export function shouldUploadToStorage(uri: string | null | undefined): boolean {
  if (!uri) return false;
  return isLocalFileUri(uri);
}

/**
 * Reads a local file as base64 via expo-file-system, then uploads to Supabase Storage.
 * Returns the public URL on success, or falls back to the original URI on failure.
 */
export async function uploadImageToStorage(
  localUri: string,
  bucket: string,
  folder: string,
  retries = 3,
): Promise<string> {
  // Safety: never proceed with remote URIs
  if (!isLocalFileUri(localUri)) return localUri;

  // Dynamic import to avoid requiring expo-file-system at bundle evaluation
  const { readAsStringAsync, EncodingType } = await import('expo-file-system');

  let lastError: unknown = null;
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
  const path = `${folder}/${fileName}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const base64 = await readAsStringAsync(localUri, { encoding: EncodingType.Base64 });
      const byteChars = atob(base64);
      const byteNums = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
      const byteArr = new Uint8Array(byteNums);

      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, byteArr, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      return urlData.publicUrl;
    } catch (e) {
      lastError = e;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 500));
      }
    }
  }

  console.warn(`[storage] upload failed after ${retries} retries:`, lastError);
  // Fall back to local URI — the caller should handle this gracefully
  return localUri;
}
