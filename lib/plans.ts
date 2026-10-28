/**
 * Apparently plans. Must match public.tier_limits() in Supabase
 * (supabase/migrations/026_subscriptions.sql) and the products/entitlements
 * set up in App Store Connect, Google Play and RevenueCat.
 */
export type Tier = 'free' | 'basic' | 'plus' | 'pro';

export interface TierLimits {
  actions: number | null;   // grab/skip/save per 24h (null = unlimited)
  can_save: boolean;
  listings: number | null;  // live bundles + skills + requests + jobs
  spot_rooms: number | null;
  storage_gb: number;
}

export interface PlanInfo {
  tier: Tier;
  name: string;
  /** Shown until the store price loads. */
  fallbackPrice: string;
  tagline: string;
  perks: string[];
  limits: TierLimits;
  /** App Store / Play product id (monthly, 14-day free trial). */
  productId: string | null;
  /** RevenueCat entitlement id. */
  entitlement: Tier | null;
  accent: [string, string];
}

export const TRIAL_DAYS = 14;

export const PLANS: PlanInfo[] = [
  {
    tier: 'free', name: 'Free', fallbackPrice: '$0', tagline: 'Browse and grab',
    perks: ['7 grabs or skips a day', 'Grab bundles & skill deals', 'Take jobs & help requests', 'Post to the feed', '1 GB of space'],
    limits: { actions: 7, can_save: false, listings: 0, spot_rooms: 0, storage_gb: 1 },
    productId: null, entitlement: null, accent: ['#9CA3AF', '#6B7280'],
  },
  {
    tier: 'basic', name: 'Basic', fallbackPrice: '$4.99', tagline: 'Start selling',
    perks: ['30 grabs, skips or saves a day', 'Save cards for later', 'Post up to 3 bundles, skills or jobs', 'Spot: 1 room of your own', '10 GB of space'],
    limits: { actions: 30, can_save: true, listings: 3, spot_rooms: 1, storage_gb: 10 },
    productId: 'apparently_basic_monthly', entitlement: 'basic', accent: ['#38BDF8', '#2563EB'],
  },
  {
    tier: 'plus', name: 'Plus', fallbackPrice: '$9.99', tagline: 'Grow your business',
    perks: ['100 grabs, skips or saves a day', 'Post up to 15 bundles, skills or jobs', 'Spot: 5 rooms', '50 GB of space', 'Everything in Basic'],
    limits: { actions: 100, can_save: true, listings: 15, spot_rooms: 5, storage_gb: 50 },
    productId: 'apparently_plus_monthly', entitlement: 'plus', accent: ['#A855F7', '#EC4899'],
  },
  {
    tier: 'pro', name: 'Pro', fallbackPrice: '$19.99', tagline: 'No limits',
    perks: ['Unlimited grabs, skips & saves', 'Unlimited bundles, skills & jobs', 'Unlimited Spot rooms', '200 GB of space', 'Everything in Plus'],
    limits: { actions: null, can_save: true, listings: null, spot_rooms: null, storage_gb: 200 },
    productId: 'apparently_pro_monthly', entitlement: 'pro', accent: ['#F59E0B', '#EF4444'],
  },
];

export const planFor = (t: Tier | string | null | undefined): PlanInfo => PLANS.find((p) => p.tier === t) || PLANS[0];
export const TIER_RANK: Record<Tier, number> = { free: 0, basic: 1, plus: 2, pro: 3 };

/** Why the paywall opened — sets its headline. */
export type PaywallReason = 'actions' | 'save' | 'listing' | 'spot' | 'storage' | 'upgrade';

export const PAYWALL_COPY: Record<PaywallReason, { title: string; body: string; minTier: Tier }> = {
  actions: { title: "You're out of moves for now", body: 'Free accounts get 7 grabs or skips a day. Upgrade to keep going.', minTier: 'basic' },
  save: { title: 'Save cards with Basic', body: 'Keep bundles, skills and requests to come back to later.', minTier: 'basic' },
  listing: { title: 'Post with a plan', body: 'Posting bundles, skills, help requests and jobs is included with every plan.', minTier: 'basic' },
  spot: { title: 'Spot is for members', body: 'Make live rooms to hang out and plan with friends.', minTier: 'basic' },
  storage: { title: 'You need more space', body: 'Your photos and videos are using all the space on your plan.', minTier: 'basic' },
  upgrade: { title: 'Choose your plan', body: `Every plan starts with a ${TRIAL_DAYS}-day free trial.`, minTier: 'basic' },
};

export const formatGB = (bytes: number) => {
  const gb = bytes / 1024 ** 3;
  if (gb >= 10) return `${Math.round(gb)} GB`;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / 1024 ** 2;
  return mb >= 1 ? `${Math.round(mb)} MB` : `${Math.max(0, Math.round(bytes / 1024))} KB`;
};
