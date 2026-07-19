export function isAbortError(err: unknown): boolean {
  const anyErr = err as { name?: string; message?: string; code?: string } | null;
  return anyErr?.name === 'AbortError' || anyErr?.code === 'AbortError' || (anyErr?.message ?? '').toLowerCase().includes('aborted');
}

export function logAbort(tag: string) {
  console.log(`${tag} Query aborted — normal on navigation`);
}

export function withAbortSignal<T>(query: T, signal?: AbortSignal): T {
  const qAny = query as any;
  if (!signal) return query;
  if (typeof qAny?.abortSignal === 'function') return qAny.abortSignal(signal) as T;
  return query;
}
