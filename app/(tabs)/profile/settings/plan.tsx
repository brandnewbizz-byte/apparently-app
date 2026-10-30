/** Plan & usage: current plan, what's used, manage or restore the subscription. */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Crown, CreditCard, RotateCcw } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { formatGB, planFor } from '@/lib/plans';
import { manageSubscriptionsUrl, restore as restorePurchases } from '@/lib/purchases';
import { notify } from '@/lib/dialog';
import { SettingsPage, Group, Item } from '@/components/settings/SettingsUI';

const W = '#FFFFFF';

export default function PlanSettings() {
  const { colors } = useTheme();
  const { plan: sub, syncWithStore, openPaywall } = useSubscription();
  const [restoring, setRestoring] = useState(false);

  const info = planFor(sub.tier);
  const lim = sub.limits;
  const storageCap = lim.storage_gb * 1024 ** 3;
  const storagePct = Math.min(1, sub.storageUsed / Math.max(storageCap, 1));
  const until = sub.periodEnd ? new Date(sub.periodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;
  const status = sub.tier === 'free' ? 'Free plan'
    : sub.store === 'admin' ? (until ? `Given by Apparently · until ${until}` : 'Given by Apparently')
    : sub.isTrial ? `Free trial · ends ${until ?? 'soon'}`
    : sub.willRenew === false ? `Ends ${until ?? 'soon'}, won’t renew`
    : until ? `Renews ${until}` : 'Active';

  const usage = [
    { label: 'Moves today', value: lim.actions == null ? `${sub.actionsUsed} · unlimited` : `${sub.actionsUsed} of ${lim.actions}` },
    { label: 'Live listings', value: lim.listings == null ? `${sub.listingsActive} · unlimited` : `${sub.listingsActive} of ${lim.listings}` },
    { label: 'Spot rooms', value: lim.spot_rooms == null ? `${sub.roomsOwned} · unlimited` : `${sub.roomsOwned} of ${lim.spot_rooms}` },
  ];

  const restore = async () => {
    if (restoring) return;
    setRestoring(true);
    const r = await restorePurchases();
    if (r.ok) await syncWithStore();
    setRestoring(false);
    notify(r.ok ? 'Purchases restored' : 'Nothing to restore', r.ok ? 'Your plan is up to date.' : r.message || 'No previous purchases were found.');
  };

  return (
    <SettingsPage title="Plan & usage">
      <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.crown, { backgroundColor: info.accent[0] }]}><Crown size={22} color={W} /></View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.planName, { color: colors.text }]}>{info.name}</Text>
          <Text style={[styles.planStatus, { color: colors.textSecondary }]}>{status}</Text>
        </View>
        <TouchableOpacity onPress={() => openPaywall('upgrade')} style={[styles.cta, { backgroundColor: colors.accent }]} accessibilityLabel={sub.tier === 'free' ? 'See plans' : 'Change plan'}>
          <Text style={styles.ctaText}>{sub.tier === 'free' ? 'See plans' : 'Change'}</Text>
        </TouchableOpacity>
      </View>

      <Group title="This period">
        {usage.map((u) => <Item key={u.label} label={u.label} value={u.value} />)}
        <View style={styles.space}>
          <View style={styles.spaceTop}>
            <Text style={[styles.spaceLabel, { color: colors.text }]}>Space</Text>
            <Text style={[styles.spaceValue, { color: colors.textTertiary }]}>{formatGB(sub.storageUsed)} of {lim.storage_gb} GB</Text>
          </View>
          <View style={[styles.bar, { backgroundColor: colors.border }]}>
            <View style={[styles.barFill, { width: `${Math.max(2, storagePct * 100)}%`, backgroundColor: storagePct > 0.9 ? '#EF4444' : info.accent[0] }]} />
          </View>
        </View>
      </Group>

      <Group title="Billing">
        {sub.tier !== 'free' && sub.store !== 'admin' ? (
          <Item icon={<CreditCard size={18} color={W} />} iconBg="#0EA5E9" label="Manage or cancel" value={sub.store === 'play_store' ? 'Google Play' : 'App Store'} onPress={() => Linking.openURL(manageSubscriptionsUrl()).catch(() => notify('Could not open link'))} />
        ) : null}
        <Item icon={<RotateCcw size={18} color={W} />} iconBg="#64748B" label={restoring ? 'Restoring…' : 'Restore purchases'} onPress={restore} />
      </Group>
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginTop: 18, padding: 14, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  crown: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  planName: { fontSize: 18, fontWeight: '800' },
  planStatus: { fontSize: 13, marginTop: 2 },
  cta: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18 },
  ctaText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  space: { paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  spaceTop: { flexDirection: 'row', justifyContent: 'space-between' },
  spaceLabel: { fontSize: 16, fontWeight: '500' },
  spaceValue: { fontSize: 15 },
  bar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
});
