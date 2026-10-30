import { createTRPCReact } from "@trpc/react-query";
import { httpLink } from "@trpc/client";
import type { AppRouter } from "@/backend/trpc/app-router";
import superjson from "superjson";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_RORK_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  }
  // In dev the phone connects to Dave's Mac mini (192.168.1.x); localhost won't
  // work on the phone. Never in released builds: there's no such server for real
  // users, and iOS blocks plain http anyway.
  if (__DEV__) return 'http://192.168.1.167:3000';
  return '';
};

/** The optional API server, or '' when there isn't one (then the app reads Supabase directly). */
export const getApiUrl = () => getBaseUrl();

// Fast fetch with short timeout — falls back to Supabase quickly if backend unreachable
export async function fastFetch(url: string, timeoutMs = 3000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: `${getBaseUrl() || ''}/api/trpc`,
      transformer: superjson,
    }),
  ],
});
