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
  Modal,
  TextInput,
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
  TrendingUp,
  Pause,
  Play,
  Pencil,
  Activity,
  DollarSign,
  ChevronRight,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useOrders, type GrabOrder } from '@/contexts/OrdersContext';
import { useSkills, type UserSkill } from '@/contexts/SkillContext';
import { useBundles, type UserBundle } from '@/contexts/BundleContext';
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

type Segment = 'orders' | 'skills' | 'bundles' | 'plans' | 'insights' | 'activity';

type EditTarget = { kind: 'skill' | 'bundle'; id: string; title: string; price: string; status: string };

interface ActivityEvent {
  id: string;
  icon: 'order' | 'accepted' | 'fulfilled' | 'declined' | 'skill' | 'bundle' | 'plan';
  title: string;
  subtitle?: string;
  at: string;
  unread: boolean;
}

export default function ManageScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const { orders, pendingCount, loading, refresh, acceptOrder, fulfillOrder, declineOrder } = useOrders();
  const { mySkills, deleteSkill, updateSkill } = useSkills();
  const { myBundles, deleteBundle, updateBundle } = useBundles();
  const { plans, deletePlan } = usePlanner();

  const [segment, setSegment] = useState<Segment>('orders');
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editPaused, setEditPaused] = useState(false);

  const sortedOrders = useMemo(
    () => [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [orders]
  );

  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [plans]
  );

  // ── Earnings / insights derivations ─────────────────────────────
  const earnings = useMemo(() => {
    const fulfilled = orders.filter((o) => o.status === 'fulfilled');
    const earned = fulfilled.reduce((sum, o) => sum + (typeof o.price === 'number' ? o.price : 0), 0);
    const active = orders.filter((o) => o.status === 'accepted').length;
    return { earned, active, waiting: pendingCount };
  }, [orders, pendingCount]);

  const insights = useMemo(() => {
    const topSkill = [...mySkills].sort((a, b) => b.grabCount - a.grabCount)[0];
    const topBundle = [...myBundles].sort((a, b) => b.grabCount - a.grabCount)[0];
    const skillRevenue = mySkills.reduce((sum, s) => sum + (Number(s.price) || 0) * (s.grabCount || 0), 0);
    const bundleRevenue = myBundles.reduce((sum, b) => sum + (Number(b.price) || 0) * (b.grabCount || 0), 0);
    const totalGrabs = orders.length;
    const resolved = orders.filter((o) => o.status === 'accepted' || o.status === 'fulfilled').length;
    const conversion = totalGrabs > 0 ? Math.round((resolved / totalGrabs) * 100) : 0;
    return { topSkill, topBundle, skillRevenue, bundleRevenue, totalGrabs, conversion };
  }, [mySkills, myBundles, orders]);

  const activity = useMemo<ActivityEvent[]>(() => {
    const events: ActivityEvent[] = [];

    orders.forEach((o) => {
      events.push({
        id: `order-${o.id}`,
        icon: 'order',
        title: `${o.buyerName} grabbed "${o.itemTitle}"`,
        subtitle: typeof o.price === 'number' && o.price > 0 ? `$${o.price}` : undefined,
        at: o.createdAt,
        unread: o.status === 'requested',
      });
      // status transitions beyond the initial grab
      (o.statusHistory || []).slice(1).forEach((h, i) => {
        const map: Record<string, ActivityEvent['icon']> = {
          accepted: 'accepted',
          fulfilled: 'fulfilled',
          declined: 'declined',
        };
        events.push({
          id: `order-${o.id}-${i}`,
          icon: map[h.status] || 'accepted',
          title:
            h.status === 'accepted'
              ? `You accepted "${o.itemTitle}"`
              : h.status === 'fulfilled'
              ? `You fulfilled "${o.itemTitle}"`
              : `You declined "${o.itemTitle}"`,
          at: h.at,
          unread: false,
        });
      });
    });

    mySkills.forEach((s) => {
      events.push({ id: `skill-${s.id}`, icon: 'skill', title: `You posted skill "${s.title}"`, at: s.createdAt, unread: false });
    });
    myBundles.forEach((b) => {
      events.push({ id: `bundle-${b.id}`, icon: 'bundle', title: `You created bundle "${b.title}"`, at: b.createdAt, unread: false });
    });
    plans.forEach((p) => {
      events.push({ id: `plan-${p.id}`, icon: 'plan', title: `You planned a day${p.date_label ? ` — ${p.date_label}` : ''}`, at: p.created_at, unread: false });
    });

    return events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [orders, mySkills, myBundles, plans]);

  const unreadActivity = activity.filter((e) => e.unread).length;

  const SEGMENTS: { key: Segment; label: string; badge?: number }[] = [
    { key: 'orders', label: 'Orders', badge: pendingCount || undefined },
    { key: 'skills', label: 'Skills' },
    { key: 'bundles', label: 'Bundles' },
    { key: 'plans', label: 'Plans' },
    { key: 'insights', label: 'Insights' },
    { key: 'activity', label: 'Activity', badge: unreadActivity || undefined },
  ];

  // ── Order actions ───────────────────────────────────────────────
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

  const openOrderDetail = (order: GrabOrder) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/manage/order/${order.id}` as any);
  };

  // ── Edit / availability ─────────────────────────────────────────
  const isLiveStatus = (s: string) => s === 'available' || s === 'published' || s === 'active';

  const openEdit = (target: EditTarget) => {
    setEditTarget(target);
    setEditTitle(target.title);
    setEditPrice(target.price);
    setEditPaused(target.status === 'draft');
  };

  const saveEdit = () => {
    if (!editTarget) return;
    const priceNum = parseFloat(editPrice) || 0;
    const status = editPaused ? 'draft' : 'available';
    if (editTarget.kind === 'skill') {
      updateSkill(editTarget.id, { title: editTitle.trim() || undefined, price: priceNum, status: status as UserSkill['status'] });
    } else {
      updateBundle(editTarget.id, { title: editTitle.trim() || undefined, price: priceNum, status: status as UserBundle['status'] });
    }
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setEditTarget(null);
  };

  const toggleAvailability = (kind: 'skill' | 'bundle', id: string, status: string) => {
    const next = isLiveStatus(status) ? 'draft' : 'available';
    if (kind === 'skill') updateSkill(id, { status: next as UserSkill['status'] });
    else updateBundle(id, { status: next as UserBundle['status'] });
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        activeOpacity={0.7}
        onPress={() => openOrderDetail(item)}
      >
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
          <ChevronRight size={18} color={colors.textTertiary} />
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
      </TouchableOpacity>
    );
  };

  const renderOrdersEmpty = () => (
    <View style={[styles.emptyWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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

  // ── Earnings strip ──────────────────────────────────────────────
  const renderEarningsStrip = () => (
    <View style={styles.earningsRow}>
      <View style={[styles.earningCell, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <DollarSign size={16} color={ACCENT.green} />
        <Text style={[styles.earningValue, { color: colors.text }]}>${earnings.earned}</Text>
        <Text style={[styles.earningLabel, { color: colors.textTertiary }]}>Earned</Text>
      </View>
      <View style={[styles.earningCell, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Activity size={16} color={ACCENT.blue} />
        <Text style={[styles.earningValue, { color: colors.text }]}>{earnings.active}</Text>
        <Text style={[styles.earningLabel, { color: colors.textTertiary }]}>Active</Text>
      </View>
      <View style={[styles.earningCell, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <BellRing size={16} color={ACCENT.gold} />
        <Text style={[styles.earningValue, { color: colors.text }]}>{earnings.waiting}</Text>
        <Text style={[styles.earningLabel, { color: colors.textTertiary }]}>Waiting</Text>
      </View>
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
        mySkills.map((skill) => {
          const paused = skill.status === 'draft';
          return (
            <View key={skill.id} style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.listIcon, { backgroundColor: ACCENT.blueDim }]}>
                {skill.imageUrl ? <Image source={{ uri: skill.imageUrl }} style={{ width: 40, height: 40, borderRadius: 8 }} /> : <Text style={{ fontSize: 20 }}>{skill.icon}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.listTitle, { color: colors.text }]} numberOfLines={1}>{skill.title}</Text>
                <Text style={[styles.listMeta, { color: colors.textTertiary }]} numberOfLines={1}>
                  {skill.grabCount} grab{skill.grabCount !== 1 ? 's' : ''}{skill.category ? ` · ${skill.category}` : ''}
                </Text>
                <View style={styles.listPriceRow}>
                  <Text style={[styles.listPrice, { color: ACCENT.blue }]}>${skill.price}</Text>
                  {paused && <Text style={[styles.pausedTag, { color: ACCENT.coral }]}>Paused</Text>}
                </View>
              </View>
              <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.border }]} onPress={() => toggleAvailability('skill', skill.id, skill.status)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                {paused ? <Play size={16} color={ACCENT.green} /> : <Pause size={16} color={colors.textSecondary} />}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.border }]} onPress={() => openEdit({ kind: 'skill', id: skill.id, title: skill.title, price: String(skill.price || ''), status: skill.status })} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Pencil size={16} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.deleteBtn, { backgroundColor: ACCENT.coralDim }]} onPress={() => confirmDeleteSkill(skill.id, skill.title)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Trash2 size={17} color={ACCENT.coral} />
              </TouchableOpacity>
            </View>
          );
        })
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
        myBundles.map((bundle) => {
          const paused = bundle.status === 'draft';
          return (
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
                <View style={styles.listPriceRow}>
                  <Text style={[styles.listPrice, { color: ACCENT.purple }]}>${bundle.price}</Text>
                  {paused && <Text style={[styles.pausedTag, { color: ACCENT.coral }]}>Paused</Text>}
                </View>
              </View>
              <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.border }]} onPress={() => toggleAvailability('bundle', bundle.id, bundle.status)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                {paused ? <Play size={16} color={ACCENT.green} /> : <Pause size={16} color={colors.textSecondary} />}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.border }]} onPress={() => openEdit({ kind: 'bundle', id: bundle.id, title: bundle.title, price: String(bundle.price || ''), status: bundle.status })} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Pencil size={16} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.deleteBtn, { backgroundColor: ACCENT.coralDim }]} onPress={() => confirmDeleteBundle(bundle.id, bundle.title)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Trash2 size={17} color={ACCENT.coral} />
              </TouchableOpacity>
            </View>
          );
        })
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

  // ── Insights ────────────────────────────────────────────────────
  const renderInsights = () => {
    const { topSkill, topBundle, skillRevenue, bundleRevenue, totalGrabs, conversion } = insights;
    return (
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.insightHeroRow}>
          <View style={[styles.insightHero, { backgroundColor: ACCENT.greenDim, borderColor: 'rgba(16,185,129,0.25)' }]}>
            <TrendingUp size={20} color={ACCENT.green} />
            <Text style={[styles.insightHeroValue, { color: ACCENT.green }]}>${skillRevenue + bundleRevenue}</Text>
            <Text style={[styles.insightHeroLabel, { color: colors.textSecondary }]}>Gross from grabs</Text>
          </View>
          <View style={[styles.insightHero, { backgroundColor: ACCENT.blueDim, borderColor: 'rgba(59,130,246,0.25)' }]}>
            <Activity size={20} color={ACCENT.blue} />
            <Text style={[styles.insightHeroValue, { color: ACCENT.blue }]}>{conversion}%</Text>
            <Text style={[styles.insightHeroLabel, { color: colors.textSecondary }]}>Conversion ({resolvedLabel()})</Text>
          </View>
        </View>

        <Text style={[styles.insightSection, { color: colors.textSecondary }]}>Top performers</Text>
        {topSkill ? (
          <View style={[styles.insightCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.listIcon, { backgroundColor: ACCENT.blueDim }]}>
              <Zap size={20} color={ACCENT.blue} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.listTitle, { color: colors.text }]} numberOfLines={1}>{topSkill.title}</Text>
              <Text style={[styles.listMeta, { color: colors.textTertiary }]}>{topSkill.grabCount} grabs · ${(Number(topSkill.price) || 0) * (topSkill.grabCount || 0)} gross</Text>
            </View>
            <View style={[styles.topTag, { backgroundColor: ACCENT.goldDim }]}>
              <Text style={{ color: ACCENT.gold, fontWeight: '800', fontSize: 12 }}>Top Skill</Text>
            </View>
          </View>
        ) : (
          <Text style={[styles.insightEmpty, { color: colors.textTertiary }]}>No skills yet — post one to see performance.</Text>
        )}

        {topBundle ? (
          <View style={[styles.insightCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.listIcon, { backgroundColor: ACCENT.purpleDim }]}>
              <Package size={20} color={ACCENT.purple} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.listTitle, { color: colors.text }]} numberOfLines={1}>{topBundle.title}</Text>
              <Text style={[styles.listMeta, { color: colors.textTertiary }]}>{topBundle.grabCount} grabs · ${(Number(topBundle.price) || 0) * (topBundle.grabCount || 0)} gross</Text>
            </View>
            <View style={[styles.topTag, { backgroundColor: ACCENT.goldDim }]}>
              <Text style={{ color: ACCENT.gold, fontWeight: '800', fontSize: 12 }}>Top Bundle</Text>
            </View>
          </View>
        ) : (
          <Text style={[styles.insightEmpty, { color: colors.textTertiary }]}>No bundles yet — create one to see performance.</Text>
        )}

        <Text style={[styles.insightSection, { color: colors.textSecondary }]}>Breakdown</Text>
        <View style={[styles.insightCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.breakdownRow}>
            <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Skills gross</Text>
            <Text style={[styles.breakdownValue, { color: ACCENT.blue }]}>${skillRevenue}</Text>
          </View>
          <View style={[styles.breakdownRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Bundles gross</Text>
            <Text style={[styles.breakdownValue, { color: ACCENT.purple }]}>${bundleRevenue}</Text>
          </View>
          <View style={[styles.breakdownRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Total grabs</Text>
            <Text style={[styles.breakdownValue, { color: colors.text }]}>{totalGrabs}</Text>
          </View>
        </View>
      </ScrollView>
    );

    function resolvedLabel() {
      return `${orders.filter((o) => o.status === 'accepted' || o.status === 'fulfilled').length}/${orders.length}`;
    }
  };

  // ── Activity ────────────────────────────────────────────────────
  const renderActivity = () => {
    if (activity.length === 0) {
      return (
        <EmptyState icon={<Activity size={32} color={ACCENT.blue} />} iconBg={ACCENT.blueDim} title="No activity yet" sub="Orders, offers, and plan changes will appear here." onPress={() => setSegment('orders')} btnLabel="View Orders" btnColor={ACCENT.blue} btnBg={ACCENT.blueDim} colors={colors} />
      );
    }
    const ACT_ICON: Record<ActivityEvent['icon'], { fg: string; bg: string }> = {
      order: { fg: ACCENT.gold, bg: ACCENT.goldDim },
      accepted: { fg: ACCENT.green, bg: ACCENT.greenDim },
      fulfilled: { fg: ACCENT.blue, bg: ACCENT.blueDim },
      declined: { fg: ACCENT.coral, bg: ACCENT.coralDim },
      skill: { fg: ACCENT.blue, bg: ACCENT.blueDim },
      bundle: { fg: ACCENT.purple, bg: ACCENT.purpleDim },
      plan: { fg: ACCENT.green, bg: ACCENT.greenDim },
    };
    return (
      <FlatList
        data={activity}
        keyExtractor={(e) => e.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 120 }]}
        renderItem={({ item }) => {
          const c = ACT_ICON[item.icon];
          return (
            <View style={styles.activityRow}>
              <View style={[styles.activityIcon, { backgroundColor: c.bg }]}>
                {item.unread && <View style={[styles.unreadDot, { backgroundColor: ACCENT.gold }]} />}
                <Activity size={16} color={c.fg} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.activityTitle, { color: colors.text }]} numberOfLines={2}>{item.title}</Text>
                <Text style={[styles.activityTime, { color: colors.textTertiary }]}>
                  {new Date(item.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </Text>
              </View>
              {item.subtitle ? <Text style={[styles.activitySubtitle, { color: colors.textSecondary }]}>{item.subtitle}</Text> : null}
            </View>
          );
        }}
      />
    );
  };

  // ── Render ──────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Manage</Text>
        <Text style={[styles.headerSub, { color: colors.textTertiary }]}>Your offers & incoming orders</Text>
      </View>

      {/* Earnings strip — always visible */}
      {renderEarningsStrip()}

      {/* Segmented switcher */}
      <View style={[styles.segWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.segScroll}>
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
        </ScrollView>
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
                {pendingCount > 0 ? `${pendingCount} grab${pendingCount !== 1 ? 's' : ''} waiting for your approval. Tap an order for details.` : 'No grabs waiting. Tap an order for details.'}
              </Text>
            ) : null
          }
        />
      )}

      {segment === 'skills' && renderSkills()}
      {segment === 'bundles' && renderBundles()}
      {segment === 'plans' && renderPlans()}
      {segment === 'insights' && renderInsights()}
      {segment === 'activity' && renderActivity()}

      {/* Edit modal */}
      <Modal visible={!!editTarget} transparent animationType="fade" onRequestClose={() => setEditTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Edit {editTarget?.kind === 'bundle' ? 'Bundle' : 'Skill'}</Text>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Title</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Title"
              placeholderTextColor={colors.textTertiary}
            />
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Price ($)</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              value={editPrice}
              onChangeText={setEditPrice}
              placeholder="0"
              placeholderTextColor={colors.textTertiary}
              keyboardType="decimal-pad"
            />
            <TouchableOpacity style={[styles.pauseRow, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={() => setEditPaused(!editPaused)} activeOpacity={0.7}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.pauseTitle, { color: colors.text }]}>{editPaused ? 'Paused (off-market)' : 'Live (on-market)'}</Text>
                <Text style={[styles.pauseSub, { color: colors.textTertiary }]}>Toggle to hide or show this offer</Text>
              </View>
              <View style={[styles.pauseSwitch, { backgroundColor: editPaused ? ACCENT.coralDim : ACCENT.greenDim }]}>
                {editPaused ? <Pause size={16} color={ACCENT.coral} /> : <Play size={16} color={ACCENT.green} />}
              </View>
            </TouchableOpacity>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.border }]} onPress={() => setEditTarget(null)}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.accent }]} onPress={saveEdit}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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

  earningsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  earningCell: { flex: 1, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 12, alignItems: 'flex-start', gap: 4 },
  earningValue: { fontSize: 20, fontWeight: '800' },
  earningLabel: { fontSize: 12 },

  segWrap: { marginHorizontal: 16, marginBottom: 4, borderRadius: 14, padding: 4, borderWidth: StyleSheet.hairlineWidth },
  segScroll: { gap: 4 },
  segBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 10 },
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

  listCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, marginBottom: 10 },
  listIcon: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  listTitle: { fontSize: 15, fontWeight: '600' },
  listMeta: { fontSize: 12, marginTop: 2 },
  listPrice: { fontSize: 14, fontWeight: '800', marginTop: 3 },
  listPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pausedTag: { fontSize: 11, fontWeight: '700' },
  iconBtn: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  deleteBtn: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },

  insightHeroRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  insightHero: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 14, gap: 4 },
  insightHeroValue: { fontSize: 22, fontWeight: '800' },
  insightHeroLabel: { fontSize: 12 },
  insightSection: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },
  insightCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, marginBottom: 10 },
  insightEmpty: { fontSize: 13, marginBottom: 12 },
  topTag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  breakdownLabel: { fontSize: 14 },
  breakdownValue: { fontSize: 15, fontWeight: '800' },

  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  activityIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  unreadDot: { position: 'absolute', top: -2, right: -2, width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#fff' },
  activityTitle: { fontSize: 14, fontWeight: '600' },
  activityTime: { fontSize: 12, marginTop: 2 },
  activitySubtitle: { fontSize: 13, fontWeight: '700' },

  emptyWrap: { borderRadius: 20, padding: 32, alignItems: 'center', marginTop: 8, borderWidth: StyleSheet.hairlineWidth },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  emptyBtn: { paddingHorizontal: 20, paddingVertical: 11, borderRadius: 12 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalCard: { borderRadius: 20, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 4 },
  modalInput: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 12 },
  pauseRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 12, marginTop: 4, marginBottom: 16 },
  pauseTitle: { fontSize: 14, fontWeight: '700' },
  pauseSub: { fontSize: 12, marginTop: 2 },
  pauseSwitch: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalBtn: { flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: 12 },
});
