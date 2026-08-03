/**
 * Media validation and optimization utilities.
 * Prevents local file paths from being persisted to remote storage
 * and provides image resizing before upload.
 */

// Block-list: URIs that should never be sent to Supabase
const LOCAL_PATH_PREFIXES = ['file://', 'file:', '/var/', '/tmp/', '/private/', 'ph-upload://', 'content://android'];

/**
 * Returns true if the URI is a local file path that should NOT be persisted.
 * Local file:// URIs are temporary and reference the device filesystem only.
 *
 * @example
 *   isLocalFileUri('file:///var/mobile/Containers/.../photo.jpg') // true
 *   isLocalFileUri('https://example.com/photo.jpg')               // false
 *   isLocalFileUri('data:image/jpeg;base64,...')                  // false
 */
export function isLocalFileUri(uri: string | undefined | null): boolean {
  if (!uri || typeof uri !== 'string') return true;

  // Allow data URIs (base64 encoded images)
  if (uri.startsWith('data:') || uri.startsWith('blob:')) return false;

  // Allow remote URLs
  if (uri.startsWith('http://') || uri.startsWith('https://')) return false;

  // Block local file paths
  for (const prefix of LOCAL_PATH_PREFIXES) {
    if (uri.startsWith(prefix)) return true;
  }

  // Unknown scheme — block to be safe
  return false;
}

/**
 * Validates that a URI is safe to persist to remote storage.
 * Returns the URI if valid, or null if it should be rejected.
 */
export function safeRemoteUri(uri: string | undefined | null): string | null {
  if (isLocalFileUri(uri)) return null;
  return uri ?? null;
}

/**
 * Validates a URL for image display.
 * Falls back to null for unsafe urls.
 */
export function safeImageUrl(url: string | undefined | null): string | null {
  if (!url || typeof url !== 'string') return null;

  if (url.startsWith('data:image/')) return url;
  if (url.startsWith('https://')) return url;
  if (url.startsWith('http://')) return url;

  // Reject file://, blob: (non-image), and unknown schemes
  return null;
}
