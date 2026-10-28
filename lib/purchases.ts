/**
 * Thin, crash-proof wrapper around RevenueCat (react-native-purchases).
 *
 * The native module only exists in builds made after it was added, and never
 * on web. Everything here no-ops gracefully when it isn't there, so older app
 * builds and the web preview keep working (purchases just aren't offered).
 */
import { Platform } from 'react-native';
import { REVENUECAT_ANDROID_KEY, REVENUECAT_IOS_KEY } from '@/constants/app';

let RC: any = null;
try {
  if (Platform.OS !== 'web') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-purchases');
    RC = mod?.default ?? mod;
  }
} catch {
  RC = null;
}

let configuredFor: string | null = null;

const apiKey = () => (Platform.OS === 'ios' ? REVENUECAT_IOS_KEY : Platform.OS === 'android' ? REVENUECAT_ANDROID_KEY : '');

/** Can this build actually sell subscriptions? */
export const purchasesAvailable = () => !!RC && !!apiKey();

/** Configure once and tie purchases to the signed-in user's id. */
export async function initPurchases(userId: string | null | undefined) {
  if (!purchasesAvailable() || !userId) return;
  try {
    if (!configuredFor) {
      RC.configure({ apiKey: apiKey(), appUserID: userId });
      configuredFor = userId;
    } else if (configuredFor !== userId) {
      await RC.logIn(userId);
      configuredFor = userId;
    }
  } catch (e) {
    console.warn('[Purchases] configure failed', e);
  }
}

export async function resetPurchasesUser() {
  if (!RC || !configuredFor) return;
  try { await RC.logOut(); } catch {}
  configuredFor = null;
}

export interface StorePackage {
  productId: string;
  priceString: string;
  hasTrial: boolean;
  raw: any;
}

/** Monthly packages from the current RevenueCat offering, keyed by product id. */
export async function getPackages(): Promise<Record<string, StorePackage>> {
  if (!purchasesAvailable() || !configuredFor) return {};
  try {
    const offerings = await RC.getOfferings();
    const pkgs: any[] = offerings?.current?.availablePackages || [];
    const out: Record<string, StorePackage> = {};
    for (const p of pkgs) {
      const id: string = p?.product?.identifier || '';
      // Android ids look like "product:base-plan"; key by the product part.
      const key = id.split(':')[0];
      out[key] = { productId: key, priceString: p?.product?.priceString || '', hasTrial: !!p?.product?.introPrice, raw: p };
    }
    return out;
  } catch (e) {
    console.warn('[Purchases] offerings failed', e);
    return {};
  }
}

export type PurchaseOutcome = { ok: true } | { ok: false; cancelled?: boolean; message?: string };

export async function buy(pkg: StorePackage): Promise<PurchaseOutcome> {
  if (!purchasesAvailable()) return { ok: false, message: 'Purchases are not available in this version of the app.' };
  try {
    await RC.purchasePackage(pkg.raw);
    return { ok: true };
  } catch (e: any) {
    if (e?.userCancelled) return { ok: false, cancelled: true };
    return { ok: false, message: e?.message || 'The purchase did not go through.' };
  }
}

export async function restore(): Promise<PurchaseOutcome> {
  if (!purchasesAvailable()) return { ok: false, message: 'Purchases are not available in this version of the app.' };
  try {
    await RC.restorePurchases();
    return { ok: true };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'Could not restore purchases.' };
  }
}

/** Listen for subscription changes made outside the app (renewals, cancels). */
export function onCustomerInfoChange(fn: () => void): () => void {
  if (!RC?.addCustomerInfoUpdateListener) return () => {};
  const listener = () => fn();
  try { RC.addCustomerInfoUpdateListener(listener); } catch { return () => {}; }
  return () => { try { RC.removeCustomerInfoUpdateListener?.(listener); } catch {} };
}

/** Where people manage or cancel their subscription. */
export const manageSubscriptionsUrl = () =>
  Platform.OS === 'ios' ? 'https://apps.apple.com/account/subscriptions' : 'https://play.google.com/store/account/subscriptions';
