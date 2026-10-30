/**
 * Supabase Storage upload utility.
 * Handles image uploads for posts, stories, and avatars.
 *
 * NOTE (SDK 57): expo-file-system removed the legacy `readAsStringAsync` /
 * `EncodingType` functions — they throw at runtime. We use the new `File`
 * class API (`new File(uri).bytes()` / `.base64()`) instead.
 */
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { isLocalFileUri, safeImageUrl } from './media';
import { ensureUploadSpace, StorageFullError } from './uploadQuota';

/** Maps a lowercase file extension to a video MIME type for Supabase uploads. */
const VIDEO_EXT_TO_MIME: Record<string, string> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  webm: 'video/webm',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
  hevc: 'video/mp4',
  '3gp': 'video/3gpp',
};

function fileExtension(uri: string): string {
  const m = uri.match(/\.([a-zA-Z0-9]+)(\?.*)?$/);
  return m ? m[1].toLowerCase() : '';
}

/**
 * On the web, a picked photo or video is a `blob:` (or `data:`) URL that only
 * lives in this browser tab. It has to be uploaded like a device file.
 */
export function isWebLocalUri(uri: string | null | undefined): boolean {
  return Platform.OS === 'web' && !!uri && (uri.startsWith('blob:') || uri.startsWith('data:'));
}

const EXT_FOR_MIME: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/heic': 'heic',
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'video/x-m4v': 'm4v',
};

/** Upload a browser blob:/data: URL to Storage; returns the public URL (throws on failure). */
async function uploadWebUri(uri: string, bucket: string, folder: string, kind: 'image' | 'video', retries = 3): Promise<string> {
  const blob = await (await fetch(uri)).blob();
  const type = blob.type || (kind === 'video' ? 'video/mp4' : 'image/jpeg');
  try { await ensureUploadSpace(blob.size || 0); } catch (e) { if (e instanceof StorageFullError) throw e; }
  const ext = EXT_FOR_MIME[type] || (kind === 'video' ? 'mp4' : 'jpg');
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { data, error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: type, upsert: true });
      if (error) throw error;
      return supabase.storage.from(bucket).getPublicUrl(data.path).data.publicUrl;
    } catch (e) {
      lastError = e;
      if (attempt < retries) await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 500));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Upload failed.');
}

/** Local file:// URIs that should be uploaded to Supabase Storage instead of stored directly */
export function shouldUploadToStorage(uri: string | null | undefined): boolean {
  if (!uri) return false;
  return isLocalFileUri(uri);
}

/**
 * Reads a local file as bytes via the expo-file-system `File` class, then
 * uploads to Supabase Storage. Returns the public URL on success, or falls
 * back to the original URI on failure.
 */
export async function uploadImageToStorage(
  localUri: string,
  bucket: string,
  folder: string,
  retries = 3,
  contentType: 'image/jpeg' | 'image/png' = 'image/jpeg',
): Promise<string> {
  if (isWebLocalUri(localUri)) {
    try { return await uploadWebUri(localUri, bucket, folder, 'image', retries); } catch (e) {
      if (e instanceof StorageFullError) throw e;
      console.warn('[storage] web upload failed:', e);
      return localUri;
    }
  }
  // Safety: never proceed with remote URIs
  if (!isLocalFileUri(localUri)) return localUri;

  // Dynamic import to avoid requiring expo-file-system at bundle evaluation
  const { File } = await import('expo-file-system');

  try { await ensureUploadSpace(new File(localUri).size || 0); } catch (e) { if (e instanceof StorageFullError) throw e; }

  let lastError: unknown = null;
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${contentType === 'image/png' ? 'png' : 'jpg'}`;
  const path = `${folder}/${fileName}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const file = new File(localUri);
      // Read raw bytes directly — no base64 round-trip needed.
      const bytes = await file.bytes();

      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, bytes, {
          contentType,
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

/**
 * Uploads a local video file to Supabase Storage with the correct content type
 * and extension, returning the public URL. Falls back to the original URI on
 * failure (caller should detect and retry/handle).
 */
export async function uploadVideoToStorage(
  localUri: string,
  bucket: string,
  folder: string,
  retries = 3,
): Promise<string> {
  if (isWebLocalUri(localUri)) {
    try { return await uploadWebUri(localUri, bucket, folder, 'video', retries); } catch (e) {
      if (e instanceof StorageFullError) throw e;
      console.warn('[storage] web video upload failed:', e);
      return localUri;
    }
  }
  if (!isLocalFileUri(localUri)) return localUri;

  const { File } = await import('expo-file-system');

  const ext = fileExtension(localUri);
  const safeExt = VIDEO_EXT_TO_MIME[ext] ? ext : 'mp4';
  const contentType = VIDEO_EXT_TO_MIME[ext] || 'video/mp4';
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safeExt}`;
  const path = `${folder}/${fileName}`;

  try { await ensureUploadSpace(new File(localUri).size || 0); } catch (e) { if (e instanceof StorageFullError) throw e; }

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const file = new File(localUri);
      const bytes = await file.bytes();

      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, bytes, { contentType, upsert: true });

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

  console.warn(`[storage] video upload failed after ${retries} retries:`, lastError);
  return localUri;
}

/**
 * Guarantees a local image becomes a refresh-safe, cross-device persistable
 * value. Tries Supabase Storage first (returns a hosted public URL). If storage
 * is unavailable, embeds the image as a base64 data URI so it still survives
 * feed refresh and app restarts instead of going blank.
 *
 * Never returns a transient device-local file:// path.
 */
export async function persistableImageUri(
  localUri: string | undefined | null,
  bucket: string,
  folder: string,
): Promise<string | undefined> {
  if (localUri && isWebLocalUri(localUri)) {
    try { return await uploadWebUri(localUri, bucket, folder, 'image'); } catch (e) {
      if (e instanceof StorageFullError) throw e;
      // A data: URL can still be stored as-is; a blob: URL dies with the tab.
      return localUri.startsWith('data:image/') ? localUri : undefined;
    }
  }
  if (!localUri || !isLocalFileUri(localUri)) {
    // Already remote/data URI — pass through safe.
    return safeImageUrl(localUri) ?? undefined;
  }

  try {
    const hosted = await uploadImageToStorage(localUri, bucket, folder);
    if (hosted && hosted !== localUri && !isLocalFileUri(hosted)) {
      return hosted;
    }
  } catch {
    // fall through to base64 embed
  }

  // Storage unavailable — read local file and embed as a data URI so the
  // image persists across refresh and shows on any device.
  try {
    const { File } = await import('expo-file-system');
    const base64 = await new File(localUri).base64();
    return `data:image/jpeg;base64,${base64}`;
  } catch {
    return undefined;
  }
}
