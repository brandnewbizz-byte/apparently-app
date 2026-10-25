/**
 * RFC 4122 v4 UUID. Database primary keys for bundles, skill_deals,
 * service_requests and virtual_room_objects are `uuid` columns — ids like
 * `bundle-123-abc` are rejected by Postgres, which silently kept those rows
 * from ever being saved.
 */
export function uuid(): string {
  const c = (globalThis as any).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
