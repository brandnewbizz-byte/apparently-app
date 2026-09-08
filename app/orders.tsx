import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Platform,
  Alert,
  RefreshControl,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  ChevronLeft,
  BellRing,
  Package,
  Wrench,
  Check,
  CheckCheck,
  X,
  MessageCircle,
  Loader2,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useOrders, type GrabOrder } from '@/contexts/OrdersContext';

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
};

const KIND_COLOR: Record<string, { label: string; fg: string; bg: string }> = {
  bundle: { label: 'Bundle', fg: ACCENT.purple, bg: ACCENT.purpleDim },
  skill: { label: 'Skill', fg: ACCENT.blue, bg: 'rgba(59,130,246,0.14)' },
};

const STATUS_META: Record<string, { label: string; fg: string; bg: string }> = {
  requested: { label: 'New grab — waiting', fg: ACCENT.gold, bg: ACCENT.goldDim },
  accepted: { label: 'Accepted · in progress', fg: ACCENT.green, bg: ACCENT.greenDim },
  fulfilled: { label: 'Fulfilled', fg: ACCENT.blue, bg: 'rgba(59,130,246,0.14)' },
  declined: { label: 'Declined', fg: ACCENT.coral, bg: ACCENT.coralDim },
};

export default function OrdersScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { orders, pendingCount, loading, refresh, acceptOrder, fulfillOrder, declineOrder } = useOrders();

  const sorted = useMemo(
    () => [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [orders]
  );

  const goBack = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const confirmAction = (order: GrabOrder, verb: string, fn: () => Promise<void>) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      `${verb} this order?`,
      `Order from ${order.buyerName} for "${order.itemTitle}". ${verb === 'Accept' ? 'You can then message and deliver the service.' : verb === 'Decline' ? 'The item will be freed for other buyers.' : 'Mark this order as completed.'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: verb,
          style: verb === 'Decline' ? 'destructive' : 'default',
          onPress: async () => { await fn(); if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); },
        },
      ]
    );
  };

  const openChat = (order: GrabOrder) => {
    if (!order.buyerId) {
      Alert.alert('Message', 'Open your Inbox → Messages to continue this conversation.');
      router.push('/inbox' as any);
      return;
    }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/inbox/${order.buyerId}` as any);
  };

  const renderEmpty = () => (
    <View style={[styles.emptyWrap, { backgroundColor: colors.surface }]}>
      <View style={[styles.emptyIcon, { backgroundColor: ACCENT.purpleDim }]}>
        <BellRing size={30} color={ACCENT.purple} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No grabs yet</Text>
      <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
        When someone grabs one of your bundles or skills, it shows up here so you can accept it and start the order.
      </Text>
      <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: colors.border }]} onPress={refresh}>
        <Text style={{ color: colors.text, fontWeight: '600' }}>Refresh</Text>
      </TouchableOpacity>
    </View>
  );

  const renderCard = ({ item }: { item: GrabOrder }) => {
    const kind = KIND_COLOR[item.kind] || KIND_COLOR.bundle;
    const st = STATUS_META[item.status] || STATUS_META.requested;
    const isOpen = item.status === 'requested';
    const isActive = item.status === 'accepted';
    const avatar = item.buyerAvatar;
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {/* Buyer + kind header */}
        <View style={styles.rowTop}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.border }]}>
              <Text style={{ fontWeight: '700', color: colors.textSecondary }}>
                {(item.buyerName || '?').slice(0, 1).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[styles.buyerName, { color: colors.text }]} numberOfLines={1}>{item.buyerName}</Text>
            <Text style={[styles.when, { color: colors.textTertiary }]}>
              {new Date(item.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </Text>
          </View>
          <View style={[styles.kindPill, { backgroundColor: kind.bg }]}>
            <Text style={{ color: kind.fg, fontWeight: '700', fontSize: 12 }}>{kind.label}</Text>
          </View>
        </View>

        {/* Item */}
        <View style={styles.itemRow}>
          <View style={[styles.itemIcon, { backgroundColor: kind.bg }]}>
            {item.kind === 'bundle' ? <Package size={18} color={kind.fg} /> : <Wrench size={18} color={kind.fg} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={2}>{item.itemTitle}</Text>
            {typeof item.price === 'number' && item.price > 0 ? (
              <Text style={[styles.itemPrice, { color: kind.fg }]}>${item.price}</Text>
            ) : null}
          </View>
        </View>

        {/* Status */}
        <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
          <View style={[styles.statusDot, { backgroundColor: st.fg }]} />
          <Text style={{ color: st.fg, fontWeight: '600', fontSize: 12 }}>{st.label}</Text>
        </View>

        {/* Actions */}
        {isOpen || isActive ? (
          <View style={styles.actions}>
            {isOpen && (
              <TouchableOpacity style={[styles.btn, styles.btnPrimary, { backgroundColor: ACCENT.purple }]} onPress={() => confirmAction(item, 'Accept', () => acceptOrder(item))}>
                <Check size={16} color="#fff" />
                <Text style={styles.btnPrimaryText}>Accept & Start</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.btn, { backgroundColor: colors.border }]} onPress={() => openChat(item)}>
              <MessageCircle size={16} color={colors.text} />
              <Text style={{ color: colors.text, fontWeight: '600' }}>Message</Text>
            </TouchableOpacity>
            {isOpen && (
              <TouchableOpacity style={[styles.btn, { backgroundColor: ACCENT.coralDim }]} onPress={() => confirmAction(item, 'Decline', () => declineOrder(item))}>
                <X size={16} color={ACCENT.coral} />
                <Text style={{ color: ACCENT.coral, fontWeight: '600' }}>Decline</Text>
              </TouchableOpacity>
            )}
            {isActive && (
              <TouchableOpacity style={[styles.btn, { backgroundColor: ACCENT.greenDim }]} onPress={() => confirmAction(item, 'Fulfill', () => fulfillOrder(item))}>
                <CheckCheck size={16} color={ACCENT.green} />
                <Text style={{ color: ACCENT.green, fontWeight: '600' }}>Mark Fulfilled</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={[styles.headerBtn, { backgroundColor: colors.surface }]} onPress={goBack}>
          <ChevronLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Orders</Text>
          {pendingCount > 0 ? (
            <TouchableOpacity onPress={refresh}>
              <Text style={{ color: ACCENT.gold, fontSize: 12, fontWeight: '600', marginTop: 2 }}>
                ● {pendingCount} waiting on you
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 2 }}>Grabs on your bundles & skills</Text>
          )}
        </View>
        <View style={[styles.headerBtn, { backgroundColor: 'transparent' }]}>
          {loading ? <Loader2 size={18} color={colors.textTertiary} /> : <BellRing size={18} color={colors.textTertiary} />}
        </View>
      </View>

      <FlatList
        data={sorted}
        keyExtractor={(o) => o.id}
        renderItem={renderCard}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 40 }]}
        ListEmptyComponent={loading ? null : renderEmpty}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.textSecondary} />
        }
        ListHeaderComponent={
          sorted.length > 0 ? (
            <Text style={[styles.sectionNote, { color: colors.textSecondary }]}>
              {pendingCount > 0
                ? `${pendingCount} grab${pendingCount !== 1 ? 's' : ''} waiting for your approval.`
                : 'No grabs waiting. Check back when someone grabs one of your offers.'}
            </Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  list: { padding: 16 },
  sectionNote: { fontSize: 13, marginBottom: 12 },
  card: {
    borderRadius: 18,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
    gap: 14,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  buyerName: { fontSize: 15, fontWeight: '700' },
  when: { fontSize: 12, marginTop: 1 },
  kindPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  itemTitle: { fontSize: 15, fontWeight: '600' },
  itemPrice: { fontSize: 15, fontWeight: '800', marginTop: 3 },
  statusPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 11,
  },
  btnPrimary: { borderRadius: 11 },
  btnPrimaryText: { color: '#fff', fontWeight: '700' },
  emptyWrap: { borderRadius: 20, padding: 32, alignItems: 'center', marginTop: 8 },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  emptyBtn: { paddingHorizontal: 20, paddingVertical: 11, borderRadius: 12 },
});
