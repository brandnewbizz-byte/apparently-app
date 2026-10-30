import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, ActivityIndicator, Alert, Platform, KeyboardAvoidingView } from 'react-native';
import { DollarSign, CheckCircle2, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import {
  usePaymentRequest, payPaymentRequest, cancelPaymentRequest, confirmPaymentRequest, createPaymentRequest,
  getPayoutStatus, startPayoutSetup, money, sellerGets, PaymentsError, PLATFORM_FEE_PERCENT, MIN_PAYMENT, MAX_PAYMENT, isVerifying,
} from '@/lib/payments';

const say = (title: string, msg: string) => {
  if (Platform.OS === 'web') { if (typeof window !== 'undefined') window.alert(`${title}\n\n${msg}`); }
  else Alert.alert(title, msg);
};
const errText = (e: unknown) => (e instanceof PaymentsError || e instanceof Error ? e.message : 'Something went wrong. Please try again.');

/** The card a payment request shows as in a chat. */
export function PaymentRequestCard({ data, isMe, returnPath }: { data: { id: string; amount_cents: number; title: string }; isMe: boolean; returnPath: string }) {
  const { colors } = useTheme();
  const { req, refresh } = usePaymentRequest(data.id);
  const [busy, setBusy] = useState(false);
  const status = req?.status || 'requested';
  const amount = req?.amount_cents ?? data.amount_cents;
  const iAmSeller = isMe;

  // Back from Stripe on the web with ?paid=<id>: check it with Stripe once.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).get('paid') === data.id) {
      confirmPaymentRequest(data.id).then(refresh).catch(() => {});
    }
  }, [data.id, refresh]);

  const pay = async () => {
    setBusy(true);
    try { await payPaymentRequest(data.id, returnPath); await refresh(); }
    catch (e) { if ((e as PaymentsError).code === 'already_paid') await refresh(); else say('Couldn’t start the payment', errText(e)); }
    finally { setBusy(false); }
  };
  const cancel = () => {
    const run = async () => {
      setBusy(true);
      try { await cancelPaymentRequest(data.id); await refresh(); } catch (e) { say('Couldn’t cancel', errText(e)); } finally { setBusy(false); }
    };
    if (Platform.OS === 'web') { if (window.confirm('Cancel this payment request?')) run(); }
    else Alert.alert('Cancel this payment request?', undefined, [{ text: 'Keep it', style: 'cancel' }, { text: 'Cancel request', style: 'destructive', onPress: run }]);
  };

  const paid = status === 'paid';
  const canceled = status === 'canceled';
  return (
    <View style={[s.card, { backgroundColor: colors.surface, borderColor: paid ? '#16A34A' : colors.border }]} testID="payment-request-card">
      <View style={s.tagRow}>
        <DollarSign size={13} color={colors.accent} />
        <Text style={[s.tag, { color: colors.accent }]}>{iAmSeller ? 'You requested' : 'Payment request'}</Text>
      </View>
      <Text style={[s.amount, { color: colors.text, textDecorationLine: canceled ? 'line-through' : 'none' }]}>{money(amount)}</Text>
      <Text style={[s.title, { color: colors.textSecondary }]} numberOfLines={2}>{req?.title || data.title}</Text>

      {paid ? (
        <View style={s.paidRow}><CheckCircle2 size={18} color="#16A34A" /><Text style={s.paidText}>Paid{iAmSeller ? ` · you get about ${money(sellerGets(amount))}` : ''}</Text></View>
      ) : canceled ? (
        <Text style={[s.note, { color: colors.textTertiary }]}>Canceled</Text>
      ) : iAmSeller ? (
        <View style={{ gap: 6, marginTop: 8 }}>
          <Text style={[s.note, { color: colors.textSecondary }]}>Waiting for payment · you’ll get about {money(sellerGets(amount))}</Text>
          <TouchableOpacity onPress={cancel} disabled={busy}><Text style={[s.link, { color: colors.textTertiary }]}>Cancel request</Text></TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={[s.payBtn, { backgroundColor: colors.accent, opacity: busy ? 0.6 : 1 }]} onPress={pay} disabled={busy} testID="pay-request">
          {busy ? <ActivityIndicator color="#FFF" /> : <Text style={s.payText}>Pay {money(amount)}</Text>}
        </TouchableOpacity>
      )}
      {!paid && !canceled && !iAmSeller && <Text style={[s.fine, { color: colors.textTertiary }]}>Secure checkout by Stripe</Text>}
    </View>
  );
}

/** Sheet the seller fills in to ask for the agreed amount. */
/** An order the request is for: fills in the agreed price and what it's for. */
export interface PaymentPrefill { amount?: number; title?: string; itemId?: string; itemType?: string }

/** Render only while open (or give it a new `key`) so a new prefill takes effect. */
export function RequestPaymentSheet({ visible, onClose, buyerId, buyerName, onSent, prefill }: {
  visible: boolean; onClose: () => void; buyerId: string; buyerName: string;
  onSent: (req: { id: string; amount_cents: number; title: string; item_id?: string | null; item_type?: string | null }) => void;
  prefill?: PaymentPrefill | null;
}) {
  const { colors } = useTheme();
  const [amount, setAmount] = useState(prefill?.amount ? String(Math.round(prefill.amount * 100) / 100) : '');
  const [title, setTitle] = useState(prefill?.title?.slice(0, 120) || '');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState<boolean | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!visible) return;
    getPayoutStatus().then((st) => { setVerifying(isVerifying(st)); setReady(st.charges_enabled); }).catch((e) => { setReady(false); if ((e as PaymentsError).code === 'payments_not_configured') say('Payments are coming soon', errText(e)); });
  }, [visible]);

  const value = Number(amount.replace(/[^0-9.]/g, ''));
  const valid = value >= MIN_PAYMENT && value <= MAX_PAYMENT && title.trim().length > 0;
  const cents = Math.round((value || 0) * 100);

  const setup = async () => {
    setBusy(true);
    try { await startPayoutSetup('/payouts'); const st = await getPayoutStatus(); setVerifying(isVerifying(st)); setReady(st.charges_enabled); }
    catch (e) { say('Couldn’t open payout setup', errText(e)); }
    finally { setBusy(false); }
  };
  const send = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      const r = await createPaymentRequest(buyerId, title, value, prefill?.itemId ? { itemId: prefill.itemId, itemType: prefill.itemType } : undefined);
      onSent({ id: r.id, amount_cents: r.amount_cents, title: r.title, item_id: r.item_id, item_type: r.item_type });
      setAmount(''); setTitle(''); setReady(null); onClose();
    } catch (e) { say('Couldn’t send the request', errText(e)); }
    finally { setBusy(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.backdrop}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={[s.sheet, { backgroundColor: colors.background }]}>
          <View style={s.sheetHead}>
            <Text style={[s.sheetTitle, { color: colors.text }]}>Request payment</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><X size={22} color={colors.text} /></TouchableOpacity>
          </View>
          {ready === null ? (
            <ActivityIndicator style={{ marginVertical: 30 }} color={colors.accent} />
          ) : !ready && verifying ? (
            <Text style={[s.body, { color: colors.textSecondary }]}>
              You’re signed up. Stripe is still checking your details (usually a few minutes). You can send payment requests as soon as it’s done.
            </Text>
          ) : !ready ? (
            <View style={{ gap: 12 }}>
              <Text style={[s.body, { color: colors.textSecondary }]}>
                To get paid in the app, set up payouts once. Stripe asks for your name, date of birth and a bank account, and sends what you earn straight to your bank.
              </Text>
              <TouchableOpacity style={[s.payBtn, { backgroundColor: colors.accent, opacity: busy ? 0.6 : 1 }]} onPress={setup} disabled={busy}>
                {busy ? <ActivityIndicator color="#FFF" /> : <Text style={s.payText}>Set up payouts</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <Text style={[s.body, { color: colors.textSecondary }]}>{prefill?.itemId
                  ? `Filled in from ${buyerName}’s order. Change the amount if you agreed on a different price. They’ll see it in your chat and can pay with a card.`
                  : `Ask ${buyerName} for the price you agreed. They’ll see it in your chat and can pay with a card.`}</Text>
              <View style={[s.amountBox, { borderColor: colors.border }]}>
                <Text style={[s.dollar, { color: colors.text }]}>$</Text>
                <TextInput
                  style={[s.amountInput, { color: colors.text }]} value={amount} onChangeText={setAmount}
                  keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.textTertiary} autoFocus testID="request-amount"
                />
              </View>
              <TextInput
                style={[s.input, { color: colors.text, borderColor: colors.border }]} value={title} onChangeText={setTitle}
                placeholder="What it’s for (e.g. Date night bundle)" placeholderTextColor={colors.textTertiary} maxLength={120} testID="request-title"
              />
              {value > 0 && (
                <Text style={[s.note, { color: colors.textSecondary }]}>
                  You’ll get about {money(sellerGets(cents))} after Apparently’s {PLATFORM_FEE_PERCENT}% fee and Stripe’s card fee.
                </Text>
              )}
              <TouchableOpacity style={[s.payBtn, { backgroundColor: colors.accent, opacity: valid && !busy ? 1 : 0.5 }]} onPress={send} disabled={!valid || busy} testID="send-request">
                {busy ? <ActivityIndicator color="#FFF" /> : <Text style={s.payText}>Send request{value > 0 ? ` · ${money(cents)}` : ''}</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  card: { width: 240, borderRadius: 18, borderWidth: 1.5, padding: 14 },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tag: { fontSize: 12, fontWeight: '700' },
  amount: { fontSize: 30, fontWeight: '800', marginTop: 4 },
  title: { fontSize: 14, marginTop: 2 },
  paidRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  paidText: { color: '#16A34A', fontWeight: '700', fontSize: 15 },
  note: { fontSize: 13 },
  link: { fontSize: 13, fontWeight: '600' },
  payBtn: { height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  payText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  fine: { fontSize: 11, textAlign: 'center', marginTop: 6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 36 },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sheetTitle: { fontSize: 19, fontWeight: '800' },
  body: { fontSize: 14, lineHeight: 20 },
  amountBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, height: 64 },
  dollar: { fontSize: 30, fontWeight: '700', marginRight: 4 },
  amountInput: { flex: 1, fontSize: 30, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 48, fontSize: 15 },
});
