import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
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
  BellRing,
  Package,
  Wrench,
  Check,
  CheckCheck,
  X,
  MessageCircle,
  Zap,
  Plus,
  Trash2,
  CalendarDays,
  Loader2,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useOrders, type GrabOrder } from '@/contexts/OrdersContext';
import { useSkills } from '@/contexts/SkillContext';
import { useBundles } from '@/contexts/BundleContext';
import { usePlanner } from '@/contexts/PlannerContext';

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

const STATUS_META: Record<string, { label: string; fg: string; bg: string }> = {
  requested: { label: 'New grab — waiting', fg: ACCENT.gold, bg: ACCENT.goldDim },
  accepted: { label: 'Accepted · in progress', fg: ACCENT.green, bg: ACCENT.greenDim },
  fulfilled: { label: 'Fulfilled', fg: ACCENT.blue, bg: ACCENT.blueDim },
  declined: { label: 'Declined', fg: ACCENT.coral, bg: ACCENT.coralDim },
};

type Segment = 'orders' | 'skills' | 'bundles' | 'plans';

export default function ManageScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const { orders, pendingCount, loading, refresh, acceptOrder, fulfillOrder, declineOrder } = useOrders();
  const { mySkills, deleteSkill } = useSkills();
  const { myBundles, deleteBundle } = useBundles();
  const { plans, deletePlan } = usePlanner();

  const [segment, setSegment] = useState<Segment>('orders');

  const sortedOrders = useMemo(
    () => [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [orders]
  );

  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [plans]
  );

  // ── Segment tabs ────────────────────────────────────────────────
  const SEGMENTS: { key: Segment; label: string; badge?: number }[] = [
    { key: 'orders', label: 'Orders', badge: pendingCount || undefined },
    { key: 'skills', label: 'Skills' },
    { key: 'bundles', label: 'Bundles' },
    { key: 'plans', label: 'Plans' },
  ];

  // ── Actions ─────────────────────────────────────────────────────
  const confirmAction = (order: GrabOrder, verb: string, fn: () => Promise<void>) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      `${verb} this order?`,
      `Order from ${order.buyerName} for "${order.itemTitle}". ${verb === 'Accept' ? 'You can then message and deliver the service.' : verb === 'Decline' ? 'The item will be freed for other buyers.' : 'Mark this order as completed.'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: verb, style: verb === 'Decline' ? 'destructive' : 'default', onPress: async () => { await fn(); if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } },
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
    router.push(`/inbox/conversation/${order.buyerId}` as any);
  };

  const confirmDeleteSkill = (id: string, title: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Delete Skill?', `Delete "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteSkill(id) },
    ]);
  };

  const confirmDeleteBundle = (id: string, title: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Delete Bundle?', `Delete "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteBundle(id) },
    ]);
  };

  const confirmDeletePlan = async (id: string, label: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Delete Plan?', `Delete "${label || 'this plan'}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deletePlan(id); } },
    ]);
  };

  // ── Orders ──────────────────────────────────────────────────────
  const renderOrder = ({ item }: { item: GrabOrder }) => {
    const kind = KIND_COLOR[item.kind] || KIND_COLOR.bundle;
    const st = STATUS_META[item.status] || STATUS_META.requested;
    const isOpen = item.status === 'requested';
    const isActive = item.status === 'accepted';
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.rowTop}>
          {item.buyerAvatar ? (
            <Image source={{ uri: item.buyerAvatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.border }]}>
              <Text style={{ fontWeight: '700', color: colors.textSecondary }}>{(item.buyerName || '?').slice(0, 1).toUpperCase()}</Text>
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

        <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
          <View style={[styles.statusDot, { backgroundColor: st.fg }]} />
          <Text style={{ color: st.fg, fontWeight: '600', fontSize: 12 }}>{st.label}</Text>
        </View>

        {isOpen || isActive ? (
          <View style={styles.actions}>
            {isOpen && (
              <TouchableOpacity style={[styles.btn, { backgroundColor: ACCENT.purple }]} onPress={() => confirmAction(item, 'Accept', () => acceptOrder(item))}>
                <Check size={16} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700' }}>Accept & Start</Text>
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

  const renderOrdersEmpty = () => (
    <View style={[styles.emptyWrap, { backgroundColor: colors.surface }]}>
      <View style={[styles.emptyIcon, { backgroundColor: ACCENT.purpleDim }]}>
        <BellRing size={30} color={ACCENT.purple} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No orders yet</Text>
      <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
        When someone grabs one of your bundles, skills, or service requests, it shows up here so you can accept it and start the order.
      </Text>
      <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: colors.border }]} onPress={refresh}>
        <Text style={{ color: colors.text, fontWeight: '600' }}>Refresh</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Skills ──────────────────────────────────────────────────────
  const renderSkills = () => (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <TouchableOpacity style={[styles.createBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} activeOpacity={0.85} onPress={() => router.push('/skill-builder' as any)}>
        <View style={[styles.createIcon, { backgroundColor: ACCENT.blueDim }]}>
          <Zap size={20} color={ACCENT.blue} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.createTitle, { color: colors.text }]}>Create New Skill</Text>
          <Text style={[styles.createSub, { color: colors.textSecondary }]}>Offer a service on the marketplace</Text>
        </View>
        <Plus size={18} color={colors.textTertiary} />
      </TouchableOpacity>

      {mySkills.length === 0 ? (
        <EmptyState icon={<Zap size={32} color={ACCENT.blue} />} iconBg={ACCENT.blueDim} title="No skills posted" sub="Post a skill to offer your services." onPress={() => router.push('/skill-builder' as any)} btnLabel="Post a Skill" btnColor={ACCENT.blue} btnBg={ACCENT.blueDim} colors={colors} />
      ) : (
        mySkills.map((skill) => (
          <View key={skill.id} style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.listIcon, { backgroundColor: ACCENT.blueDim }]}>
              {skill.imageUrl ? <Image source={{ uri: skill.imageUrl }} style={{ width: 40, height: 40, borderRadius: 8 }} /> : <Text style={{ fontSize: 20 }}>{skill.icon}</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.listTitle, { color: colors.text }]} numberOfLines={1}>{skill.title}</Text>
              <Text style={[styles.listMeta, { color: colors.textTertiary }]} numberOfLines={1}>
                {skill.grabCount} grab{skill.grabCount !== 1 ? 's' : ''}{skill.category ? ` · ${skill.category}` : ''}
              </Text>
              <Text style={[styles.listPrice, { color: ACCENT.blue }]}>${skill.price}</Text>
            </View>
            <TouchableOpacity style={[styles.deleteBtn, { backgroundColor: ACCENT.coralDim }]} onPress={() => confirmDeleteSkill(skill.id, skill.title)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Trash2 size={17} color={ACCENT.coral} />
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );

  // ── Bundles ─────────────────────────────────────────────────────
  const renderBundles = () => (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <TouchableOpacity style={[styles.createBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} activeOpacity={0.85} onPress={() => router.push('/bundle-builder' as any)}>
        <View style={[styles.createIcon, { backgroundColor: ACCENT.purpleDim }]}>
          <Package size={20} color={ACCENT.purple} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.createTitle, { color: colors.text }]}>Create New Bundle</Text>
          <Text style={[styles.createSub, { color: colors.textSecondary }]}>Offer multiple services as one package</Text>
        </View>
        <Plus size={18} color={colors.textTertiary} />
      </TouchableOpacity>

      {myBundles.length === 0 ? (
        <EmptyState icon={<Package size={32} color={ACCENT.purple} />} iconBg={ACCENT.purpleDim} title="No bundles yet" sub="Create a bundle to offer multiple services together." onPress={() => router.push('/bundle-builder' as any)} btnLabel="Create Bundle" btnColor={ACCENT.purple} btnBg={ACCENT.purpleDim} colors={colors} />
      ) : (
        myBundles.map((bundle) => (
          <View key={bundle.id} style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {bundle.imageUrl ? (
              <Image source={{ uri: bundle.imageUrl }} style={{ width: 44, height: 44, borderRadius: 10 }} />
            ) : (
              <View style={[styles.listIcon, { backgroundColor: ACCENT.purpleDim }]}>
                <Package size={20} color={ACCENT.purple} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[styles.listTitle, { color: colors.text }]} numberOfLines={1}>{bundle.title}</Text>
              <Text style={[styles.listMeta, { color: colors.textTertiary }]} numberOfLines={1}>
                {bundle.grabCount} grab{bundle.grabCount !== 1 ? 's' : ''}{bundle.category ? ` · ${bundle.category}` : ''}
              </Text>
              <Text style={[styles.listPrice, { color: ACCENT.purple }]}>${bundle.price}</Text>
            </View>
            <TouchableOpacity style={[styles.deleteBtn, { backgroundColor: ACCENT.coralDim }]} onPress={() => confirmDeleteBundle(bundle.id, bundle.title)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Trash2 size={17} color={ACCENT.coral} />
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );

  // ── Plans ───────────────────────────────────────────────────────
  const renderPlans = () => (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <TouchableOpacity style={[styles.createBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} activeOpacity={0.85} onPress={() => router.push('/planner/plan-day' as any)}>
        <View style={[styles.createIcon, { backgroundColor: ACCENT.greenDim }]}>
          <CalendarDays size={20} color={ACCENT.green} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.createTitle, { color: colors.text }]}>Plan a Day</Text>
          <Text style={[styles.createSub, { color: colors.textSecondary }]}>Schedule a day, transport, or job</Text>
        </View>
        <Plus size={18} color={colors.textTertiary} />
      </TouchableOpacity>

      {sortedPlans.length === 0 ? (
        <EmptyState icon={<CalendarDays size={32} color={ACCENT.green} />} iconBg={ACCENT.greenDim} title="No plans yet" sub="Plan a day to stay organized." onPress={() => router.push('/planner/plan-day' as any)} btnLabel="Plan a Day" btnColor={ACCENT.green} btnBg={ACCENT.greenDim} colors={colors} />
      ) : (
        sortedPlans.map((plan) => {
          const statusColor = plan.status === 'completed' ? ACCENT.blue : plan.status === 'active' ? ACCENT.green : plan.status === 'cancelled' ? ACCENT.coral : ACCENT.gold;
          return (
            <TouchableOpacity key={plan.id} style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]} activeOpacity={0.7} onPress={() => router.push(`/planner/${plan.id}` as any)}>
              <View style={[styles.listIcon, { backgroundColor: 'transparent' }]}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: statusColor }} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.listTitle, { color: colors.text }]} numberOfLines={1}>{plan.date_label || `Plan for ${plan.date}`}</Text>
                <Text style={[styles.listMeta, { color: colors.textTertiary }]} numberOfLines={1}>
                  {plan.location_type ? plan.location_type.charAt(0).toUpperCase() + plan.location_type.slice(1) : 'Plan'}{plan.transport && plan.transport !== 'none' ? ` · ${plan.transport}` : ''}
                </Text>
                <Text style={[styles.listPrice, { color: statusColor }]}>{plan.status}</Text>
              </View>
              <TouchableOpacity style={[styles.deleteBtn, { backgroundColor: ACCENT.coralDim }]} onPress={() => confirmDeletePlan(plan.id, plan.date_label || plan.date)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Trash2 size={17} color={ACCENT.coral} />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );

  // ── Render ──────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Manage</Text>
        <Text style={[styles.headerSub, { color: colors.textTertiary }]}>Your offers & incoming orders</Text>
      </View>

      {/* Segmented switcher */}
      <View style={[styles.segWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {SEGMENTS.map((seg) => {
          const active = segment === seg.key;
          return (
            <TouchableOpacity
              key={seg.key}
              style={[styles.segBtn, active && { backgroundColor: colors.accent }]}
              onPress={() => { setSegment(seg.key); if (Platform.OS !== 'web') Haptics.selectionAsync(); }}
              activeOpacity={0.8}
            >
              <Text style={[styles.segText, { color: active ? '#FFFFFF' : colors.textSecondary }]}>{seg.label}</Text>
              {seg.badge ? (
                <View style={[styles.segBadge, { backgroundColor: ACCENT.gold }]}>
                  <Text style={styles.segBadgeText}>{seg.badge}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      {segment === 'orders' && (
        <FlatList
          data={sortedOrders}
          keyExtractor={(o) => o.id}
          renderItem={renderOrder}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 120 }]}
          ListEmptyComponent={loading ? null : renderOrdersEmpty}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.textSecondary} />}
          ListHeaderComponent={
            sortedOrders.length > 0 ? (
              <Text style={[styles.sectionNote, { color: colors.textSecondary }]}>
                {pendingCount > 0 ? `${pendingCount} grab${pendingCount !== 1 ? 's' : ''} waiting for your approval.` : 'No grabs waiting. Check back when someone grabs one of your offers.'}
              </Text>
            ) : null
          }
        />
      )}

      {segment === 'skills' && renderSkills()}
      {segment === 'bundles' && renderBundles()}
      {segment === 'plans' && renderPlans()}
    </View>
  );
}

function EmptyState({ icon, iconBg, title, sub, onPress, btnLabel, btnColor, btnBg, colors }: any) {
  return (
    <View style={[styles.emptyWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.emptyIcon, { backgroundColor: iconBg }]}>{icon}</View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.emptySub, { color: colors.textSecondary }]}>{sub}</Text>
      <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: btnBg }]} onPress={onPress}>
        <Text style={{ color: btnColor, fontWeight: '600' }}>{btnLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 26, fontWeight: '800' },
  headerSub: { fontSize: 13, marginTop: 2 },

  segWrap: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 4,
    borderRadius: 14,
    padding: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  segBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
  },
  segText: { fontSize: 13, fontWeight: '600' },
  segBadge: { minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  segBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  list: { padding: 16 },
  scrollContent: { padding: 16, paddingBottom: 120 },
  sectionNote: { fontSize: 13, marginBottom: 12 },

  card: { borderRadius: 18, padding: 16, borderWidth: StyleSheet.hairlineWidth, marginBottom: 12, gap: 14 },
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
  statusPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 11 },

  createBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, marginBottom: 16 },
  createIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  createTitle: { fontSize: 15, fontWeight: '700' },
  createSub: { fontSize: 12, marginTop: 2 },

  listCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, marginBottom: 10 },
  listIcon: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  listTitle: { fontSize: 15, fontWeight: '600' },
  listMeta: { fontSize: 12, marginTop: 2 },
  listPrice: { fontSize: 14, fontWeight: '800', marginTop: 3 },
  deleteBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  emptyWrap: { borderRadius: 20, padding: 32, alignItems: 'center', marginTop: 8, borderWidth: StyleSheet.hairlineWidth },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  emptyBtn: { paddingHorizontal: 20, paddingVertical: 11, borderRadius: 12 },
});
