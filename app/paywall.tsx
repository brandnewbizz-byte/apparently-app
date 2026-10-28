import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Check, Crown, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { PAYWALL_COPY, PLANS, TIER_RANK, TRIAL_DAYS, planFor, type PaywallReason, type Tier } from '@/lib/plans';
import { buy, getPackages, purchasesAvailable, restore, type StorePackage } from '@/lib/purchases';
import { PRIVACY_POLICY_URL, TERMS_URL } from '@/constants/app';

const PAID = PLANS.filter((p) => p.tier !== 'free');

export default function PaywallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { plan, syncWithStore } = useSubscription();
  const { reason: rawReason } = useLocalSearchParams<{ reason?: string }>();
  const reason = (rawReason && rawReason in PAYWALL_COPY ? rawReason : 'upgrade') as PaywallReason;
  const copy = PAYWALL_COPY[reason];

  // Default to the cheapest plan above what you have (Plus for brand-new people).
  const firstChoice: Tier = plan.tier === 'free' ? 'plus' : plan.tier === 'basic' ? 'plus' : 'pro';
  const [selected, setSelected] = useState<Tier>(firstChoice);
  const [packages, setPackages] = useState<Record<string, StorePackage>>({});
  const [loadingPrices, setLoadingPrices] = useState(true);
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  const canSell = purchasesAvailable();
  const storeName = Platform.OS === 'ios' ? 'App Store' : 'Google Play';

  useEffect(() => {
    let alive = true;
    getPackages().then((p) => { if (alive) setPackages(p); }).finally(() => { if (alive) setLoadingPrices(false); });
    return () => { alive = false; };
  }, []);

  const chosen = planFor(selected);
  const pkg = chosen.productId ? packages[chosen.productId] : undefined;
  const price = pkg?.priceString || chosen.fallbackPrice;
  const isCurrent = plan.tier === selected;
  const isDowngrade = TIER_RANK[selected] < TIER_RANK[plan.tier];
  const trialText = plan.tier === 'free' ? `Start ${TRIAL_DAYS}-day free trial` : isDowngrade ? `Switch to ${chosen.name}` : `Upgrade to ${chosen.name}`;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/(home)' as any));

  const subscribe = async () => {
    if (isCurrent) { close(); return; }
    if (!canSell) {
      Alert.alert('Subscriptions are coming', 'Plans will be available in the next app update.');
      return;
    }
    if (!pkg) {
      Alert.alert('Not available yet', `${chosen.name} isn't available in the ${storeName} yet. Please try again later.`);
      return;
    }
    setBusy('buy');
    const res = await buy(pkg);
    if (res.ok) {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await syncWithStore();
      setBusy(null);
      Alert.alert(plan.tier === 'free' ? 'Your free trial has started 🎉' : `You're on ${chosen.name}`, plan.tier === 'free' ? `Enjoy ${chosen.name} free for ${TRIAL_DAYS} days.` : 'Your new plan is active.');
      close();
      return;
    }
    setBusy(null);
    if (!res.cancelled) Alert.alert('Purchase not completed', res.message || 'Please try again.');
  };

  const doRestore = async () => {
    setBusy('restore');
    const res = await restore();
    if (res.ok) await syncWithStore();
    setBusy(null);
    Alert.alert(res.ok ? 'Purchases restored' : 'Nothing restored', res.ok ? 'Your plan is up to date.' : res.message || 'No previous purchases were found.');
  };

  const finePrint = useMemo(() => {
    const base = plan.tier === 'free'
      ? `Free for ${TRIAL_DAYS} days, then ${price}/month. A payment method is required to start the trial. `
      : `${price}/month. `;
    return `${base}Your subscription renews automatically each month until you cancel. Cancel anytime in your ${storeName} account settings at least 24 hours before the ${plan.tier === 'free' ? 'trial ends' : 'end of the period'} to avoid being charged. Payment is charged to your ${storeName} account.`;
  }, [plan.tier, price, storeName]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 180 }} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#1E1B4B', '#6D28D9', '#DB2777']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={close} style={styles.close} accessibilityLabel="Close">
            <X size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.crown}><Crown size={28} color="#FDE68A" /></View>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.body}>{copy.body}</Text>
          {plan.tier === 'free' ? (
            <View style={styles.trialPill}><Text style={styles.trialText}>{TRIAL_DAYS} days free on every plan</Text></View>
          ) : (
            <View style={styles.trialPill}><Text style={styles.trialText}>You're on {planFor(plan.tier).name}{plan.isTrial ? ' (free trial)' : ''}</Text></View>
          )}
        </LinearGradient>

        <View style={{ paddingHorizontal: 16, marginTop: -26, gap: 12 }}>
          {PAID.map((p) => {
            const on = selected === p.tier;
            const storePrice = p.productId ? packages[p.productId]?.priceString : undefined;
            const current = plan.tier === p.tier;
            return (
              <TouchableOpacity
                key={p.tier}
                activeOpacity={0.9}
                onPress={() => { if (Platform.OS !== 'web') Haptics.selectionAsync(); setSelected(p.tier); }}
                style={[styles.card, { backgroundColor: colors.surface, borderColor: on ? p.accent[0] : colors.border }, on && styles.cardOn]}
                accessibilityLabel={`${p.name} plan`}
                accessibilityState={{ selected: on }}
              >
                <View style={styles.cardHead}>
                  <LinearGradient colors={p.accent} style={styles.badge}><Text style={styles.badgeText}>{p.name}</Text></LinearGradient>
                  {p.tier === 'plus' ? <Text style={[styles.tag, { color: p.accent[0] }]}>MOST POPULAR</Text> : null}
                  {current ? <Text style={[styles.tag, { color: '#16A34A' }]}>YOUR PLAN</Text> : null}
                  <View style={{ flex: 1 }} />
                  <Text style={[styles.price, { color: colors.text }]}>
                    {loadingPrices && !storePrice ? '…' : storePrice || p.fallbackPrice}
                    <Text style={[styles.per, { color: colors.textSecondary }]}>/mo</Text>
                  </Text>
                </View>
                <Text style={[styles.tagline, { color: colors.textSecondary }]}>{p.tagline}</Text>
                <View style={{ gap: 6, marginTop: 8 }}>
                  {p.perks.map((perk) => (
                    <View key={perk} style={styles.perkRow}>
                      <Check size={15} color={p.accent[0]} strokeWidth={3} />
                      <Text style={[styles.perk, { color: colors.text }]}>{perk}</Text>
                    </View>
                  ))}
                </View>
                <View style={[styles.radio, { borderColor: on ? p.accent[0] : colors.border }]}>
                  {on ? <View style={[styles.radioDot, { backgroundColor: p.accent[0] }]} /> : null}
                </View>
              </TouchableOpacity>
            );
          })}

          <View style={[styles.freeRow, { borderColor: colors.border }]}>
            <Text style={[styles.freeTitle, { color: colors.text }]}>Free</Text>
            <Text style={[styles.freeBody, { color: colors.textSecondary }]}>{planFor('free').perks.join(' · ')}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Sticky buy bar */}
      <View style={[styles.bar, { paddingBottom: insets.bottom + 12, backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <TouchableOpacity onPress={subscribe} disabled={!!busy} activeOpacity={0.9} accessibilityLabel={isCurrent ? 'Keep my plan' : trialText}>
          <LinearGradient colors={chosen.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.cta, busy && { opacity: 0.7 }]}>
            {busy === 'buy' ? <ActivityIndicator color="#FFF" /> : <Text style={styles.ctaText}>{isCurrent ? 'Keep my plan' : trialText}</Text>}
          </LinearGradient>
        </TouchableOpacity>
        <Text style={[styles.fine, { color: colors.textTertiary }]}>{finePrint}</Text>
        <View style={styles.links}>
          <TouchableOpacity onPress={doRestore} disabled={!!busy}><Text style={[styles.link, { color: colors.textSecondary }]}>{busy === 'restore' ? 'Restoring…' : 'Restore purchases'}</Text></TouchableOpacity>
          {TERMS_URL ? <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)}><Text style={[styles.link, { color: colors.textSecondary }]}>Terms</Text></TouchableOpacity> : null}
          {PRIVACY_POLICY_URL ? <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}><Text style={[styles.link, { color: colors.textSecondary }]}>Privacy</Text></TouchableOpacity> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: { paddingHorizontal: 20, paddingBottom: 46, alignItems: 'center' },
  close: { alignSelf: 'flex-end', width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  crown: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  title: { color: '#FFF', fontSize: 25, fontWeight: '800', textAlign: 'center', marginTop: 12 },
  body: { color: 'rgba(255,255,255,0.85)', fontSize: 15, textAlign: 'center', marginTop: 6, lineHeight: 21, maxWidth: 340 },
  trialPill: { marginTop: 14, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6 },
  trialText: { color: '#FFF', fontWeight: '800', fontSize: 13 },
  card: { borderRadius: 18, borderWidth: 1.5, padding: 16, paddingRight: 44 },
  cardOn: { borderWidth: 2.5, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: '#FFF', fontWeight: '800', fontSize: 13 },
  tag: { fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  price: { fontSize: 20, fontWeight: '800' },
  per: { fontSize: 13, fontWeight: '600' },
  tagline: { marginTop: 6, fontSize: 13, fontWeight: '600' },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  perk: { fontSize: 14, flexShrink: 1 },
  radio: { position: 'absolute', right: 14, top: 18, width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 11, height: 11, borderRadius: 6 },
  freeRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, marginTop: 4 },
  freeTitle: { fontWeight: '800', fontSize: 14 },
  freeBody: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  cta: { height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#FFF', fontWeight: '800', fontSize: 17 },
  fine: { fontSize: 11, lineHeight: 15, marginTop: 8, textAlign: 'center' },
  links: { flexDirection: 'row', justifyContent: 'center', gap: 18, marginTop: 8 },
  link: { fontSize: 13, fontWeight: '700' },
});
