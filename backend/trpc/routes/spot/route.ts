import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";

/**
 * Spot Feed — Unified discovery feed for the Spot/Live tab.
 * Aggregates posts, bundles, and users into a feed of "spot cards"
 * representing live content, featured items, upcoming deals, and past broadcasts.
 */

// ── Types ──
export interface SpotCard {
  id: string;
  type: "live" | "featured" | "upcoming" | "past";
  title: string;
  streamerName: string;
  streamerAvatar: string;
  streamerId: string;
  thumbnail: string;
  viewers: number;
  category: string;
  tags: string[];
  isLive: boolean;
  scheduledFor?: string;
  duration?: string;
  description?: string;
  // Extended fields from real data
  sourceType: "post" | "bundle" | "user";
  sourceId: string;
  price?: number;
  likes?: number;
  commentsCount?: number;
  createdAt: string;
}

// ── Helpers ──
function defaultAvatar(): string {
  return "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100";
}

function defaultThumbnail(): string {
  return "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600";
}

function safeImage(url: string | null | undefined): string {
  if (!url) return defaultThumbnail();
  // Local file:// URLs won't render on web; use a fallback
  if (url.startsWith("file://")) return defaultThumbnail();
  return url;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const then = new Date(dateStr);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHrs / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

function formatViewers(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ── Query ──
export const getFeed = publicProcedure
  .input(
    z.object({
      limit: z.number().min(1).max(50).default(20),
    })
  )
  .query(async ({ ctx, input }) => {
    const cards: SpotCard[] = [];

    // ── 1. Fetch posts (for "live now" and "past broadcasts") ──
    const { data: posts, error: postsErr } = await ctx.supabase
      .from("posts")
      .select("*, user:user_id(id, name, username, avatar, is_verified)")
      .order("created_at", { ascending: false })
      .limit(input.limit);

    if (postsErr) {
      console.error("[spot/getFeed] Error fetching posts:", postsErr.message);
    }

    // ── 2. Fetch bundles (for "featured" and "upcoming") ──
    const { data: bundles, error: bundlesErr } = await ctx.supabase
      .from("bundles")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(input.limit);

    if (bundlesErr) {
      console.error("[spot/getFeed] Error fetching bundles:", bundlesErr.message);
    }

    // ── 3. Build feed ──

    // Featured: newest active bundle (or first post if no bundles)
    const featuredBundle = bundles?.[0];
    const featuredPost = posts?.[0];

    if (featuredBundle) {
      cards.push({
        id: `featured-${featuredBundle.id}`,
        type: "featured",
        title: featuredBundle.title,
        streamerName: featuredBundle.provider_name || "Bundle Deal",
        streamerAvatar: featuredBundle.provider_avatar || defaultAvatar(),
        streamerId: featuredBundle.user_id || "",
        thumbnail: safeImage(featuredBundle.image),
        viewers: (featuredBundle.views || 0) + (featuredBundle.grabs || 0) * 10,
        category: featuredBundle.category || "Lifestyle",
        tags: featuredBundle.items?.map((i: any) => i.title || "").filter(Boolean).slice(0, 3) || [featuredBundle.category || "deal"],
        isLive: true, // Featured items appear as "live"
        description: featuredBundle.description || undefined,
        sourceType: "bundle",
        sourceId: featuredBundle.id,
        price: featuredBundle.bundle_price || featuredBundle.price || undefined,
        createdAt: featuredBundle.created_at,
      });
    } else if (featuredPost) {
      const user = (featuredPost as any).user;
      cards.push({
        id: `featured-${featuredPost.id}`,
        type: "featured",
        title: featuredPost.content || "New Post",
        streamerName: user?.name || user?.username || "User",
        streamerAvatar: user?.avatar || defaultAvatar(),
        streamerId: featuredPost.user_id,
        thumbnail: safeImage(featuredPost.image_url),
        viewers: featuredPost.likes || 0,
        category: featuredPost.post_kind === "sell" ? "Marketplace" : "Creative",
        tags: featuredPost.post_kind ? [featuredPost.post_kind] : ["post"],
        isLive: true,
        description: featuredPost.content || undefined,
        sourceType: "post",
        sourceId: featuredPost.id,
        likes: featuredPost.likes || 0,
        commentsCount: featuredPost.comments || 0,
        createdAt: featuredPost.created_at,
      });
    }

    // Live Now: recent posts (skip the featured one)
    const livePosts = featuredPost
      ? (posts || []).filter((p) => p.id !== featuredPost.id).slice(0, 6)
      : (posts || []).slice(1, 7);

    for (const post of livePosts) {
      const user = (post as any).user;
      cards.push({
        id: `live-${post.id}`,
        type: "live",
        title: post.content || "Photo Update",
        streamerName: user?.name || user?.username || "User",
        streamerAvatar: user?.avatar || defaultAvatar(),
        streamerId: post.user_id,
        thumbnail: safeImage(post.image_url),
        viewers: post.likes || 0,
        category: post.post_kind === "sell" ? "Marketplace" : "Creative",
        tags: post.post_kind ? [post.post_kind] : ["post"],
        isLive: true,
        description: post.content || undefined,
        sourceType: "post",
        sourceId: post.id,
        likes: post.likes || 0,
        commentsCount: post.comments || 0,
        createdAt: post.created_at,
      });
    }

    // Upcoming: remaining bundles (skip the featured one)
    const upcomingBundles = featuredBundle
      ? (bundles || []).filter((b) => b.id !== featuredBundle.id).slice(0, 4)
      : (bundles || []).slice(1, 5);

    for (const bundle of upcomingBundles) {
      cards.push({
        id: `upcoming-${bundle.id}`,
        type: "upcoming",
        title: bundle.title,
        streamerName: bundle.provider_name || "Available Soon",
        streamerAvatar: bundle.provider_avatar || defaultAvatar(),
        streamerId: bundle.user_id || "",
        thumbnail: safeImage(bundle.image),
        viewers: 0,
        category: bundle.category || "Lifestyle",
        tags: bundle.items?.map((i: any) => i.title || "").filter(Boolean).slice(0, 2) || [],
        isLive: false,
        scheduledFor: "Available now",
        description: bundle.description || undefined,
        sourceType: "bundle",
        sourceId: bundle.id,
        price: bundle.bundle_price || bundle.price || undefined,
        createdAt: bundle.created_at,
      });
    }

    // Past Broadcasts: older posts beyond live/featured
    const pastStartIndex = (featuredPost ? 1 : 0) + livePosts.length;
    const pastPosts = (posts || []).slice(pastStartIndex, pastStartIndex + 8);

    for (const post of pastPosts) {
      const user = (post as any).user;
      const age = timeAgo(post.created_at);
      cards.push({
        id: `past-${post.id}`,
        type: "past",
        title: post.content || "Memory",
        streamerName: user?.name || user?.username || "User",
        streamerAvatar: user?.avatar || defaultAvatar(),
        streamerId: post.user_id,
        thumbnail: safeImage(post.image_url),
        viewers: post.likes || 0,
        category: post.post_kind === "sell" ? "Marketplace" : "Creative",
        tags: post.post_kind ? [post.post_kind] : ["memory"],
        isLive: false,
        duration: age, // Use relative time as "duration"
        sourceType: "post",
        sourceId: post.id,
        likes: post.likes || 0,
        commentsCount: post.comments || 0,
        createdAt: post.created_at,
      });
    }

    return {
      cards,
      summary: {
        total: cards.length,
        liveCount: cards.filter((c) => c.type === "live").length,
        featuredCount: cards.filter((c) => c.type === "featured").length,
        upcomingCount: cards.filter((c) => c.type === "upcoming").length,
        pastCount: cards.filter((c) => c.type === "past").length,
      },
    };
  });
