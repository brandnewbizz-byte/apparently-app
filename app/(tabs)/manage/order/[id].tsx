import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Platform,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  ChevronLeft,
  Package,
  Wrench,
  Check,
  CheckCheck,
  X,
  MessageCircle,
  Clock,
  DollarSign,
  CircleCheck,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useOrders } from '@/contexts/OrdersContext';
import { useAuth } from '@/contexts/AuthContext';
import { useMessaging } from '@/contexts/MessagingContext';
import { RequestPaymentSheet } from '@/components/PaymentRequest';
import { useMyPaymentRequests, paymentForOrder, money, sellerGets } from '@/lib/payments';

const ACCENT = {
  purple: '#8B5CF6',
  purpleDim: 'rgba(139, 92, 246, 0.14)',
  gold: '#F59E0B',
  goldDim: 'rgba(245, 158, 11, 0.14)',
  green: '#10B981',
  greenDim: 'rgba(16, 185, 129, 0.14)',
  coral: '#FF6B6B',
  coralDim: 'rgba(255, 107, 107, 0.14)',
  blue: '#3B82F6',
  blueDim: 'rgba(59, 130, 246, 0.14)',
};

const KIND_COLOR: Record<string, { label: string; fg: string; bg: string }> = {
  bundle: { label: 'Bundle', fg: ACCENT.purple, bg: ACCENT.purpleDim },
  skill: { label: 'Skill', fg: ACCENT.blue, bg: ACCENT.blueDim },
  service: { label: 'Grab', fg: ACCENT.gold, bg: ACCENT.goldDim },
};

const STATUS_STEP: Record<string, { label: string; fg: string; bg: string }> = {
  requested: { label: 'Requested', fg: ACCENT.gold, bg: ACCENT.goldDim },
  accepted: { label: 'Accepted', fg: ACCENT.green, bg: ACCENT.greenDim },
  fulfilled: { label: 'Fulfilled', fg: ACCENT.blue, bg: ACCENT.blueDim },
  declined: { label: 'Declined', fg: ACCENT.coral, bg: ACCENT.coralDim },
  pay_requested: { label: 'Payment requested', fg: ACCENT.gold, bg: ACCENT.goldDim },
  paid: { label: 'Paid in the app', fg: ACCENT.green, bg: ACCENT.greenDim },
};

export default function OrderDetailScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { orders, acceptOrder, fulfillOrder, declineOrder } = useOrders();

  const order = orders.find((o) => o.id === id);
  const { user } = useAuth();
  const { sendMessage } = useMessaging();
  const payments = useMyPaymentRequests(user?.id);
  const [paySheet, setPaySheet] = React.useState(false);
  const payment = order ? paymentForOrder(payments.byOrder, user?.id, order) : undefined;

  const goBack = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const confirmAction = (verb: string, fn: () => Promise<void>) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const why = verb === 'Accept'
      ? 'You can then message and deliver the service.'
      : verb === 'Decline'
      ? 'The item will be freed for other buyers.'
      : 'Mark this order as completed.';
    // Alert buttons do nothing on the web, so use the browser's confirm there.
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`${verb} this order?\n\n${why}`)) fn();
      return;
    }
    Alert.alert(
      `${verb} this order?`,
      why,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: verb,
          style: verb === 'Decline' ? 'destructive' : 'default',
          onPress: async () => {
            await fn();
            if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const openChat = () => {
    if (!order) return;
    if (!order.buyerId) {
      Alert.alert('Message', 'Open your Inbox → Messages to continue this conversation.');
      router.push('/inbox' as any);
      return;
    }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/inbox/conversation/${order.buyerId}` as any);
  };

  if (!order) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}>
          <TouchableOpacity style={[styles.headerBtn, { backgroundColor: colors.surface }]} onPress={goBack}>
            <ChevronLeft size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Order</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.notFound}>
          <Text style={[styles.notFoundText, { color: colors.textSecondary }]}>
            Order not found. It may have been refreshed.
          </Text>
        </View>
      </View>
    );
  }

  // Order steps plus payment steps, in time order.
  const timeline: { status: string; at: string }[] = [
    ...(order.statusHistory && order.statusHistory.length > 0 ? order.statusHistory : [{ status: 'requested' as const, at: order.createdAt }]),
    ...(payment && payment.status !== 'canceled' ? [{ status: 'pay_requested', at: payment.created_at }] : []),
    ...(payment?.status === 'paid' && payment.paid_at ? [{ status: 'paid', at: payment.paid_at }] : []),
  ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  const kind = KIND_COLOR[order.kind] || KIND_COLOR.bundle;
  const st = STATUS_STEP[order.status] || STATUS_STEP.requested;
  const isOpen = order.status === 'requested';
  const isActive = order.status === 'accepted';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={[styles.headerBtn, { backgroundColor: colors.surface }]} onPress={goBack}>
          <ChevronLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Order</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 140 }]} showsVerticalScrollIndicator={false}>
        {/* Status banner */}
        <View style={[styles.statusBanner, { backgroundColor: st.bg }]}>
          <View style={[styles.statusDot, { backgroundColor: st.fg }]} />
          <Text style={[styles.statusBannerText, { color: st.fg }]}>{st.label}</Text>
        </View>

        {/* Buyer card */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.buyerRow}>
            {order.buyerAvatar ? (
              <Image source={{ uri: order.buyerAvatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.border }]}>
                <Text style={{ fontWeight: '700', color: colors.textSecondary }}>
                  {(order.buyerName || '?').slice(0, 1).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[styles.buyerName, { color: colors.text }]}>{order.buyerName}</Text>
              <Text style={[styles.buyerSub, { color: colors.textTertiary }]}>Buyer</Text>
            </View>
            <TouchableOpacity style={[styles.chatBtn, { backgroundColor: kind.bg }]} onPress={openChat}>
              <MessageCircle size={16} color={kind.fg} />
              <Text style={{ color: kind.fg, fontWeight: '700', fontSize: 13 }}>Message</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Item card */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.itemRow}>
            <View style={[styles.itemIcon, { backgroundColor: kind.bg }]}>
              {order.kind === 'bundle' ? <Package size={20} color={kind.fg} /> : <Wrench size={20} color={kind.fg} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemLabel, { color: colors.textTertiary }]}>{kind.label}</Text>
              <Text style={[styles.itemTitle, { color: colors.text }]}>{order.itemTitle}</Text>
            </View>
            {typeof order.price === 'number' && order.price > 0 ? (
              <Text style={[styles.itemPrice, { color: kind.fg }]}>${order.price}</Text>
            ) : null}
          </View>
        </View>

        {/* Payment */}
        {order.status !== 'declined' && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Payment</Text>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="order-payment">
              {payment && payment.status === 'paid' ? (
                <View style={styles.payLine}>
                  <CircleCheck size={20} color={ACCENT.green} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.payTitle, { color: ACCENT.green }]}>Paid {money(payment.amount_cents)} in the app</Text>
                    <Text style={[styles.paySub, { color: colors.textTertiary }]}>
                      {payment.paid_at ? new Date(payment.paid_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}
                      {order.kind !== 'service' ? ` · you get about ${money(sellerGets(payment.amount_cents))} after fees` : ''}
                    </Text>
                  </View>
                </View>
              ) : payment && payment.status === 'requested' ? (
                <View style={styles.payLine}>
                  <DollarSign size={20} color={ACCENT.gold} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.payTitle, { color: colors.text }]}>
                      {order.kind === 'service' ? `${order.buyerName} requested ${money(payment.amount_cents)}` : `Requested ${money(payment.amount_cents)}`}
                    </Text>
                    <Text style={[styles.paySub, { color: colors.textTertiary }]}>
                      {order.kind === 'service' ? 'Open the chat to pay with a card.' : `Waiting for ${order.buyerName} to pay in your chat.`}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={openChat} style={[styles.payBtn, { backgroundColor: ACCENT.goldDim }]}>
                    <Text style={{ color: ACCENT.gold, fontWeight: '800' }}>{order.kind === 'service' ? 'Pay' : 'View'}</Text>
                  </TouchableOpacity>
                </View>
              ) : order.kind === 'service' ? (
                <Text style={[styles.paySub, { color: colors.textTertiary }]}>When the helper sends a payment request, you can pay it in your chat.</Text>
              ) : (
                <View style={styles.payLine}>
                  <DollarSign size={20} color={colors.textTertiary} />
                  <Text style={[styles.paySub, { flex: 1, color: colors.textSecondary }]}>
                    {isActive ? 'Once you’ve agreed on the price, ask for payment. It shows up in your chat with a Pay button.' : 'Accept the order first, then you can ask for payment.'}
                  </Text>
                  {isActive ? (
                    <TouchableOpacity onPress={() => setPaySheet(true)} style={[styles.payBtn, { backgroundColor: ACCENT.green }]} testID="order-detail-request-payment">
                      <Text style={{ color: '#FFF', fontWeight: '800' }}>Request</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}
            </View>
          </>
        )}

        {/* Timeline */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Status Timeline</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {timeline.map(
            (ev, i) => {
              const step = STATUS_STEP[ev.status] || STATUS_STEP.requested;
              const isLast = i === timeline.length - 1;
              return (
                <View key={`${ev.status}-${ev.at}-${i}`} style={styles.timelineRow}>
                  <View style={styles.timelineRail}>
                    <View style={[styles.timelineDot, { backgroundColor: step.fg }]} />
                    {!isLast && <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />}
                  </View>
                  <View style={[styles.timelineBody, { paddingBottom: isLast ? 0 : 20 }]}>
                    <Text style={[styles.timelineStatus, { color: step.fg }]}>{step.label}</Text>
                    <Text style={[styles.timelineTime, { color: colors.textTertiary }]}>
                      {new Date(ev.at).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                </View>
              );
            }
          )}
        </View>

        {/* Order info */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Details</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.detailRow}>
            <Clock size={16} color={colors.textTertiary} />
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Placed</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {new Date(order.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Package size={16} color={colors.textTertiary} />
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Type</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{kind.label}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom actions */}
      {(isOpen || isActive) && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12, backgroundColor: colors.background, borderTopColor: colors.border }]}>
          {isOpen && (
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: ACCENT.purple }]} onPress={() => confirmAction('Accept', () => acceptOrder(order))}>
              <Check size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Accept & Start</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.border }]} onPress={openChat}>
            <MessageCircle size={18} color={colors.text} />
            <Text style={[styles.actionBtnDark, { color: colors.text }]}>Message</Text>
          </TouchableOpacity>
          {isOpen && (
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: ACCENT.coralDim }]} onPress={() => confirmAction('Decline', () => declineOrder(order))}>
              <X size={18} color={ACCENT.coral} />
              <Text style={[styles.actionBtnColor, { color: ACCENT.coral }]}>Decline</Text>
            </TouchableOpacity>
          )}
          {isActive && (
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: ACCENT.greenDim }]} onPress={() => confirmAction('Fulfill', () => fulfillOrder(order))}>
              <CheckCheck size={18} color={ACCENT.green} />
              <Text style={[styles.actionBtnColor, { color: ACCENT.green }]}>Mark Fulfilled</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {paySheet ? (
        <RequestPaymentSheet
          visible
          onClose={() => setPaySheet(false)}
          buyerId={order.buyerId}
          buyerName={order.buyerName}
          prefill={{ amount: order.price, title: order.itemTitle, itemId: order.itemId, itemType: order.kind }}
          onSent={(r) => {
            sendMessage(order.buyerId, `Payment request: ${money(r.amount_cents)} for ${r.title}`, { name: order.buyerName, avatar: order.buyerAvatar }, { payment_request: r });
            payments.refresh();
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  payLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  payTitle: { fontSize: 15, fontWeight: '800' },
  paySub: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  payBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12 },
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800' },
  content: { padding: 16 },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  notFoundText: { fontSize: 15, textAlign: 'center' },

  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, marginBottom: 12 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusBannerText: { fontSize: 15, fontWeight: '800' },

  card: { borderRadius: 18, padding: 16, borderWidth: StyleSheet.hairlineWidth, marginBottom: 12 },
  buyerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  buyerName: { fontSize: 16, fontWeight: '700' },
  buyerSub: { fontSize: 12, marginTop: 2 },
  chatBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },

  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  itemLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '700' },
  itemTitle: { fontSize: 17, fontWeight: '700', marginTop: 2 },
  itemPrice: { fontSize: 18, fontWeight: '800' },

  sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },

  timelineRow: { flexDirection: 'row' },
  timelineRail: { width: 20, alignItems: 'center' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 3 },
  timelineLine: { width: 2, flex: 1, marginTop: 2 },
  timelineBody: { flex: 1, paddingLeft: 10 },
  timelineStatus: { fontSize: 15, fontWeight: '700' },
  timelineTime: { fontSize: 12, marginTop: 2 },

  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  detailLabel: { flex: 1, fontSize: 14 },
  detailValue: { fontSize: 14, fontWeight: '600' },

  bottomBar: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, position: 'absolute', bottom: 0, left: 0, right: 0 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderRadius: 14 },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  actionBtnDark: { fontWeight: '700', fontSize: 14 },
  actionBtnColor: { fontWeight: '700', fontSize: 14 },
});
