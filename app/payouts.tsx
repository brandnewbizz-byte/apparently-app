import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, CheckCircle2, Banknote } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { getPayoutStatus, startPayoutSetup, openPayoutDashboard, PayoutStatus, PaymentsError, PLATFORM_FEE_PERCENT, isVerifying } from '@/lib/payments';

export default function PayoutsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [st, setSt] = useState<PayoutStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    try { setSt(await getPayoutStatus()); } catch (e) { setErr((e as PaymentsError).message); setSt({ connected: false, charges_enabled: false, payouts_enabled: false }); }
  }, []);
  useEffect(() => { Promise.resolve().then(load); }, [load]);

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); await load(); } catch (e) { setErr((e as PaymentsError).message); } finally { setBusy(false); }
  };

  const ready = !!st?.charges_enabled;
  return (
    <View style={[s.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={s.head}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile/settings' as never))} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ChevronLeft size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.headTitle, { color: colors.text }]}>Get paid</Text>
        <View style={{ width: 28 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <View style={[s.icon, { backgroundColor: colors.accentGlow }]}><Banknote size={34} color={colors.accent} /></View>
        <Text style={[s.title, { color: colors.text }]}>Get paid for your bundles and skill deals</Text>
        <Text style={[s.body, { color: colors.textSecondary }]}>
          When you agree on a price with someone, tap $ in your chat to send them a payment request. They pay by card in the app, and Stripe sends the money to your bank. Apparently keeps {PLATFORM_FEE_PERCENT}%, and Stripe’s card fee (2.9% + 30¢) comes out of each payment. You handle any refunds from your Stripe dashboard.
        </Text>
        {st === null ? <ActivityIndicator color={colors.accent} /> : ready ? (
          <>
            <View style={s.okRow}><CheckCircle2 size={20} color="#16A34A" /><Text style={s.okText}>Payouts are set up{st.payouts_enabled ? '' : ' · Stripe is still checking your bank'}</Text></View>
            <TouchableOpacity style={[s.btn, { backgroundColor: colors.accent, opacity: busy ? 0.6 : 1 }]} onPress={() => act(openPayoutDashboard)} disabled={busy}>
              {busy ? <ActivityIndicator color="#FFF" /> : <Text style={s.btnText}>See earnings and payouts</Text>}
            </TouchableOpacity>
          </>
        ) : isVerifying(st) ? (
          <>
            <View style={[s.wait, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              <ActivityIndicator color={colors.accent} />
              <Text style={[s.waitText, { color: colors.text }]}>
                You’re all signed up. Stripe is checking your details, which usually takes a few minutes and sometimes up to a day. Payments switch on by themselves when it’s done.
              </Text>
            </View>
            <TouchableOpacity style={[s.btn, { borderWidth: 1, borderColor: colors.border, opacity: busy ? 0.6 : 1 }]} onPress={() => act(async () => {})} disabled={busy}>
              {busy ? <ActivityIndicator color={colors.accent} /> : <Text style={[s.btnText, { color: colors.text }]}>Check again</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={[s.btn, { backgroundColor: colors.accent, opacity: busy ? 0.6 : 1 }]} onPress={() => act(() => startPayoutSetup('/payouts'))} disabled={busy} testID="payouts-setup">
            {busy ? <ActivityIndicator color="#FFF" /> : <Text style={s.btnText}>{st.connected ? 'Finish setting up payouts' : 'Set up payouts'}</Text>}
          </TouchableOpacity>
        )}
        {!!err && <Text style={{ color: '#DC2626', fontSize: 14 }}>{err}</Text>}
        <Text style={[s.fine, { color: colors.textTertiary }]}>Payouts are handled by Stripe. Apparently never sees your bank details.</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, height: 50 },
  headTitle: { fontSize: 17, fontWeight: '700' },
  icon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800' },
  body: { fontSize: 15, lineHeight: 22 },
  okRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  okText: { color: '#16A34A', fontWeight: '700', fontSize: 15, flexShrink: 1 },
  btn: { height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  fine: { fontSize: 12 },
  wait: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  waitText: { flex: 1, fontSize: 14, lineHeight: 20 },
});
