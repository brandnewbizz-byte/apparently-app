import { logger } from '@/lib/logger';

type Result = { error: { message?: string; code?: string } | null };

/**
 * Run an insert/update, and if the database doesn't have some of the newer
 * columns yet (PostgREST "Could not find the 'x' column"), retry once without
 * them. Lets the app ship before a migration is applied without losing posts.
 */
export async function writeWithFallback(
  label: string,
  run: (row: Record<string, unknown>) => PromiseLike<Result>,
  row: Record<string, unknown>,
  optionalColumns: string[],
): Promise<Result> {
  const first = await run(row);
  if (!first.error) return first;
  const msg = String(first.error.message || '');
  const missing = first.error.code === 'PGRST204' || /column/i.test(msg);
  if (!missing) {
    logger.error(label, 'write failed', { error: first.error });
    return first;
  }
  const slim: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) if (!optionalColumns.includes(k)) slim[k] = v;
  const second = await run(slim);
  if (second.error) logger.error(label, 'write failed (without new columns)', { error: second.error });
  else logger.warn(label, 'saved without newer columns; apply the latest migration', { dropped: optionalColumns });
  return second;
}
