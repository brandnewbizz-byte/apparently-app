import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, ScrollView, TouchableOpacity, Image, Platform, Alert, RefreshControl, Modal, Pressable,
} from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  BellRing, Package, Zap, Check, CheckCheck, X, MessageCircle, Plus, Trash2, CalendarDays, Pause, Play, Pencil,
  Activity, ChevronRight, TrendingUp, Inbox, Sparkles, MapPin, Car, MoreHorizontal, Crown,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { isVideoUrl } from '@/lib/media';
import { useOrders, type GrabOrder } from '@/contexts/OrdersContext';
import { useSkills, type UserSkill } from '@/contexts/SkillContext';
import { useBundles, type UserBundle } from '@/contexts/BundleContext';
import { usePlanner, type Plan } from '@/contexts/PlannerContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { categoryMeta, formatMoney } from '@/lib/listingCategories';

const C = {
  purple: '#8B5CF6', purpleDim: 'rgba(139,92,246,0.14)',
  blue: '#3B82F6', blueDim: 'rgba(59,130,246,0.14)',
  gold: '#F59E0B', goldDim: 'rgba(245,158,11,0.16)',
  green: '#10B981', greenDim: 'rgba(16,185,129,0.14)',
  coral: '#F43F5E', coralDim: 'rgba(244,63,94,0.12)',
  gray: '#94A3B8', grayDim: 'rgba(148,163,184,0.16)',
};

type Tab = 'orders' | 'listings' | 'plans' | 'insights';
type OrderFilter = 'waiting' | 'active' | 'done' | 'declined' | 'all';
type ListingFilter = 'all' | 'bundle' | 'skill' | 'paused';

const ORDER_STATUS: Record<string, { label: string; fg: string; bg: string }> = {
  requested: { label: 'Needs your reply', fg: C.gold, bg: C.goldDim },
  accepted: { label: 'In progress', fg: C.blue, bg: C.blueDim },
  fulfilled: { label: 'Done', fg: C.green, bg: C.greenDim },
  declined: { label: 'Declined', fg: C.coral, bg: C.coralDim },
};

/** "5m ago", "3h ago", "Oct 2" */
function ago(iso: string) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const haptic = (k: 'light' | 'medium' | 'success' = 'light') => {
  if (Platform.OS === 'web') return;
  if (k === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else Haptics.impactAsync(k === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
};

/** Confirm that also works on web (Alert buttons are ignored there). */
function confirm(title: string, message: string, action: string, onYes: () => void, destructive = false) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) onYes();
    return;
  }
  Alert.alert(title, message, [{ text: 'Cancel', style: 'cancel' }, { text: action, style: destructive ? 'destructive' : 'default', onPress: onYes }]);
}

interface Listing {
  kind: 'bundle' | 'skill';
  id: string;
  title: string;
  price: number;
  image: string;
  isVideo: boolean;
  icon: string;
  category: string;
  grabs: number;
  spots: number;
  status: 'live' | 'paused' | 'full' | 'ended';
  rawStatus: string;
  createdAt: string;
  endsAt?: string | null;
}

function toListing(b: UserBundle): Listing;
function toListing(s: UserSkill): Listing;
function toListing(x: UserBundle | UserSkill): Listing {
  const isBundle = 'items' in x;
  const spots = Math.max(x.availableCount || 1, 1);
  const ended = !isBundle && (x as UserSkill).expiresAt ? Date.parse((x as UserSkill).expiresAt as string) <= Date.now() : false;
  const status: Listing['status'] = x.status === 'grabbed' || (x.grabCount || 0) >= spots ? 'full'
    : x.status === 'draft' ? 'paused' : ended ? 'ended' : 'live';
  const media = isBundle ? ((x as UserBundle).videoUrl || x.imageUrl) : x.imageUrl;
  return {
    kind: isBundle ? 'bundle' : 'skill',
    id: x.id,
    title: x.title,
    price: Number(x.price) || 0,
    image: media || '',
    isVideo: isBundle ? !!(x as UserBundle).videoUrl || isVideoUrl(media) : false,
    icon: isBundle ? categoryMeta(x.category).icon : (x as UserSkill).icon || '🛠️',
    category: x.category,
    grabs: x.grabCount || 0,
    spots,
    status,
    rawStatus: x.status,
    createdAt: x.createdAt,
    endsAt: isBundle ? null : (x as UserSkill).expiresAt,
  };
}

const LISTING_STATUS: Record<Listing['status'], { label: string; fg: string; bg: string }> = {
  live: { label: 'Live', fg: C.green, bg: C.greenDim },
  paused: { label: 'Paused', fg: C.gray, bg: C.grayDim },
  full: { label: 'Full', fg: C.gold, bg: C.goldDim },
  ended: { label: 'Ended', fg: C.gray, bg: C.grayDim },
};

export default function ManageScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { orders, pendingCount, loading, refresh, acceptOrder, fulfillOrder, declineOrder } = useOrders();
  const { mySkills, deleteSkill, updateSkill, reload: reloadSkills } = useSkills();
  const { myBundles, deleteBundle, updateBundle, reload: reloadBundles } = useBundles();
  const { plans, deletePlan, refetch: refetchPlans } = usePlanner();
  const { plan: sub, openPaywall } = useSubscription();

  // Fresh orders, listings and plans every time Manage opens.
  const reloadAll = React.useRef(() => {});
  React.useEffect(() => { reloadAll.current = () => { refresh(); reloadSkills(); reloadBundles(); refetchPlans(); }; });
  useFocusEffect(useCallback(() => { reloadAll.current(); }, []));

  const [tab, setTab] = useState<Tab>('orders');
  const [orderFilter, setOrderFilter] = useState<OrderFilter | null>(null);
  const [listingFilter, setListingFilter] = useState<ListingFilter>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<Listing | null>(null);
  const [busyOrder, setBusyOrder] = useState<string | null>(null);

  // ── Orders ────────────────────────────────────────────────────────────────
  const counts = useMemo(() => ({
    waiting: orders.filter((o) => o.status === 'requested').length,
    active: orders.filter((o) => o.status === 'accepted').length,
    done: orders.filter((o) => o.status === 'fulfilled').length,
    declined: orders.filter((o) => o.status === 'declined').length,
    all: orders.length,
  }), [orders]);
  const earned = useMemo(() => orders.filter((o) => o.status === 'fulfilled').reduce((s, o) => s + (typeof o.price === 'number' ? o.price : 0), 0), [orders]);
  // Default to whatever needs attention first.
  const effectiveOrderFilter: OrderFilter = orderFilter ?? (counts.waiting ? 'waiting' : counts.active ? 'active' : 'all');
  const shownOrders = useMemo(() => {
    const want: Record<OrderFilter, (o: GrabOrder) => boolean> = {
      waiting: (o) => o.status === 'requested', active: (o) => o.status === 'accepted', done: (o) => o.status === 'fulfilled',
      declined: (o) => o.status === 'declined', all: () => true,
    };
    return orders.filter(want[effectiveOrderFilter]).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [orders, effectiveOrderFilter]);

  const runOrder = async (order: GrabOrder, fn: () => Promise<void>) => {
    setBusyOrder(order.id);
    try { await fn(); haptic('success'); } finally { setBusyOrder(null); }
  };
  const accept = (o: GrabOrder) => { haptic('medium'); runOrder(o, () => acceptOrder(o)); };
  const decline = (o: GrabOrder) => confirm('Decline this grab?', `${o.buyerName} will be told, and the spot opens up for someone else.`, 'Decline', () => runOrder(o, async () => { await declineOrder(o); reloadBundles(); reloadSkills(); }), true);
  const fulfill = (o: GrabOrder) => confirm('Mark as done?', `Confirms you delivered "${o.itemTitle}" to ${o.buyerName}.`, 'Mark done', () => runOrder(o, () => fulfillOrder(o)));
  const message = (o: GrabOrder) => { haptic(); router.push((o.buyerId ? `/inbox/conversation/${o.buyerId}` : '/inbox') as never); };

  // ── Listings ──────────────────────────────────────────────────────────────
  const listings = useMemo(() => [...myBundles.map((b) => toListing(b)), ...mySkills.map((s) => toListing(s))]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)), [myBundles, mySkills]);
  const liveCount = listings.filter((l) => l.status === 'live').length;
  const shownListings = listings.filter((l) =>
    listingFilter === 'all' ? true : listingFilter === 'paused' ? l.status !== 'live' : l.kind === listingFilter);
  const cap = sub.enforced && !sub.isAdmin ? sub.limits.listings : null;

  const togglePause = (l: Listing) => {
    haptic();
    const next = l.status === 'paused' ? 'available' : 'draft';
    if (l.kind === 'bundle') updateBundle(l.id, { status: next as UserBundle['status'] });
    else updateSkill(l.id, { status: next as UserSkill['status'] });
  };
  const edit = (l: Listing) => { haptic(); router.push(`/${l.kind === 'bundle' ? 'bundle' : 'skill'}-builder?id=${l.id}` as never); };
  const remove = (l: Listing) => confirm(
    `Delete this ${l.kind === 'bundle' ? 'bundle' : 'skill deal'}?`,
    `"${l.title}" will be removed from Home. Orders already made stay in your Orders.`,
    'Delete',
    () => { if (l.kind === 'bundle') deleteBundle(l.id); else deleteSkill(l.id); haptic('success'); },
    true,
  );

  const create = (kind: 'bundle' | 'skill' | 'plan') => {
    setCreateOpen(false);
    haptic();
    router.push((kind === 'bundle' ? '/bundle-builder' : kind === 'skill' ? '/skill-builder' : '/planner/plan-day') as never);
  };

  // ── Plans ─────────────────────────────────────────────────────────────────
  const sortedPlans = useMemo(() => [...plans].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)), [plans]);

  // ── Insights ──────────────────────────────────────────────────────────────
  const insights = useMemo(() => {
    const byListing = new Map<string, { title: string; kind: string; grabs: number; gross: number }>();
    for (const o of orders) {
      if (o.status === 'declined') continue;
      const cur = byListing.get(o.itemId) || { title: o.itemTitle, kind: o.kind, grabs: 0, gross: 0 };
      cur.grabs += 1;
      cur.gross += typeof o.price === 'number' ? o.price : 0;
      byListing.set(o.itemId, cur);
    }
    const top = [...byListing.values()].sort((a, b) => b.grabs - a.grabs || b.gross - a.gross).slice(0, 3);
    const resolved = counts.active + counts.done;
    const replied = counts.all - counts.waiting;
    return {
      gross: [...byListing.values()].reduce((s, x) => s + x.gross, 0),
      acceptRate: replied > 0 ? Math.round((resolved / replied) * 100) : 0,
      top,
    };
  }, [orders, counts]);

  const activity = useMemo(() => {
    const ev: { id: string; text: string; at: string; tone: string }[] = [];
    for (const o of orders) {
      ev.push({ id: `o-${o.id}`, text: `${o.buyerName} grabbed “${o.itemTitle}”`, at: o.createdAt, tone: C.gold });
      for (const [i, h] of (o.statusHistory || []).slice(1).entries()) {
        ev.push({
          id: `o-${o.id}-${i}`,
          text: h.status === 'accepted' ? `You accepted “${o.itemTitle}”` : h.status === 'fulfilled' ? `You finished “${o.itemTitle}”` : `You declined “${o.itemTitle}”`,
          at: h.at,
          tone: h.status === 'accepted' ? C.blue : h.status === 'fulfilled' ? C.green : C.coral,
        });
      }
    }
    for (const l of listings) ev.push({ id: `l-${l.id}`, text: `You posted “${l.title}”`, at: l.createdAt, tone: l.kind === 'bundle' ? C.purple : C.blue });
    return ev.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 25);
  }, [orders, listings]);

  // ── Pieces ────────────────────────────────────────────────────────────────
  const renderChips = <K extends string>(items: { key: K; label: string; n?: number }[], value: K, onChange: (k: K) => void) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {items.map((it) => {
        const on = it.key === value;
        return (
          <TouchableOpacity key={it.key} onPress={() => { onChange(it.key); haptic(); }} activeOpacity={0.8}
            style={[styles.chip, { backgroundColor: on ? colors.text : colors.surface, borderColor: on ? colors.text : colors.border }]}>
            <Text style={[styles.chipText, { color: on ? colors.background : colors.textSecondary }]}>{it.label}</Text>
            {typeof it.n === 'number' && it.n > 0 ? (
              <View style={[styles.chipCount, { backgroundColor: on ? colors.background : colors.surfaceHighlight }]}>
                <Text style={[styles.chipCountText, { color: on ? colors.text : colors.textSecondary }]}>{it.n}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  const renderEmpty = (icon: React.ReactNode, title: string, sub: string, action?: { label: string; onPress: () => void }) => (
    <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceHighlight }]}>{icon}</View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.emptySub, { color: colors.textSecondary }]}>{sub}</Text>
      {action ? (
        <TouchableOpacity onPress={action.onPress} style={[styles.emptyBtn, { backgroundColor: colors.text }]}>
          <Text style={{ color: colors.background, fontWeight: '700' }}>{action.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  const renderOrder = ({ item: o }: { item: GrabOrder }) => {
    const st = ORDER_STATUS[o.status] || ORDER_STATUS.requested;
    const isBundle = o.kind === 'bundle';
    const busy = busyOrder === o.id;
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={() => router.push(`/manage/order/${o.id}` as never)}
        style={[styles.orderCard, { backgroundColor: colors.surface, borderColor: o.status === 'requested' ? `${C.gold}66` : colors.border }]}>
        <View style={styles.orderTop}>
          {o.buyerAvatar ? <Image source={{ uri: o.buyerAvatar }} style={styles.avatar} /> : (
            <View style={[styles.avatar, styles.center, { backgroundColor: colors.surfaceHighlight }]}>
              <Text style={{ fontWeight: '800', color: colors.textSecondary }}>{(o.buyerName || '?').slice(0, 1).toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.buyer, { color: colors.text }]} numberOfLines={1}>{o.buyerName}</Text>
            <Text style={[styles.muted, { color: colors.textTertiary }]}>grabbed {ago(o.createdAt)}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: st.fg }]} />
            <Text style={[styles.statusText, { color: st.fg }]}>{st.label}</Text>
          </View>
        </View>
        <View style={[styles.orderItem, { backgroundColor: colors.backgroundSecondary }]}>
          <View style={[styles.kindIcon, { backgroundColor: isBundle ? C.purpleDim : C.blueDim }]}>
            {isBundle ? <Package size={16} color={C.purple} /> : <Zap size={16} color={C.blue} />}
          </View>
          <Text style={[styles.orderTitle, { color: colors.text }]} numberOfLines={1}>{o.itemTitle}</Text>
          {typeof o.price === 'number' && o.price > 0 ? <Text style={[styles.orderPrice, { color: colors.text }]}>{formatMoney(o.price)}</Text> : null}
          <ChevronRight size={16} color={colors.textTertiary} />
        </View>
        {o.status === 'requested' || o.status === 'accepted' ? (
          <View style={styles.orderActions}>
            {o.status === 'requested' ? (
              <>
                <TouchableOpacity disabled={busy} onPress={() => accept(o)} style={[styles.actBtn, styles.actPrimary, { backgroundColor: C.green }]} testID="order-accept">
                  <Check size={16} color="#FFF" /><Text style={styles.actPrimaryText}>{busy ? 'Working…' : 'Accept'}</Text>
                </TouchableOpacity>
                <TouchableOpacity disabled={busy} onPress={() => decline(o)} style={[styles.actBtn, { backgroundColor: C.coralDim }]}>
                  <X size={16} color={C.coral} /><Text style={[styles.actText, { color: C.coral }]}>Decline</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity disabled={busy} onPress={() => fulfill(o)} style={[styles.actBtn, styles.actPrimary, { backgroundColor: C.blue }]}>
                <CheckCheck size={16} color="#FFF" /><Text style={styles.actPrimaryText}>{busy ? 'Working…' : 'Mark done'}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => message(o)} style={[styles.actIcon, { backgroundColor: colors.surfaceHighlight }]} accessibilityLabel="Message">
              <MessageCircle size={18} color={colors.text} />
            </TouchableOpacity>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  const renderListing = (l: Listing) => {
    const st = LISTING_STATUS[l.status];
    const pct = Math.min(1, l.grabs / l.spots);
    const accent = l.kind === 'bundle' ? C.purple : C.blue;
    return (
      <View key={`${l.kind}-${l.id}`} style={[styles.listingCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity activeOpacity={0.85} onPress={() => edit(l)} style={styles.listingMain}>
          {l.image && !l.isVideo ? <Image source={{ uri: l.image }} style={styles.thumb} /> : (
            <LinearGradient colors={[accent, `${accent}AA`]} style={[styles.thumb, styles.center]}>
              {l.isVideo ? <Play size={20} color="#FFF" fill="#FFF" /> : <Text style={{ fontSize: 26 }}>{l.icon}</Text>}
            </LinearGradient>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.rowBetween}>
              <Text style={[styles.kicker, { color: accent }]}>{l.kind === 'bundle' ? 'BUNDLE' : 'SKILL DEAL'}</Text>
              <View style={[styles.miniPill, { backgroundColor: st.bg }]}><Text style={[styles.miniPillText, { color: st.fg }]}>{st.label}</Text></View>
            </View>
            <Text style={[styles.listingTitle, { color: colors.text }]} numberOfLines={1}>{l.title}</Text>
            <Text style={[styles.listingPrice, { color: colors.text }]}>{formatMoney(l.price)}</Text>
            <View style={[styles.bar, { backgroundColor: colors.surfaceHighlight }]}>
              <View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: accent }]} />
            </View>
            <Text style={[styles.muted, { color: colors.textTertiary }]}>
              {l.grabs} of {l.spots} grabbed
              {l.endsAt && l.status === 'live' ? ` · ends ${new Date(l.endsAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}
            </Text>
          </View>
        </TouchableOpacity>
        <View style={[styles.listingActions, { borderTopColor: colors.border }]}>
          {l.status === 'live' || l.status === 'paused' ? (
            <TouchableOpacity onPress={() => togglePause(l)} style={styles.listingAct} testID={`listing-toggle-${l.id}`}>
              {l.status === 'paused' ? <Play size={15} color={C.green} /> : <Pause size={15} color={colors.textSecondary} />}
              <Text style={[styles.listingActText, { color: l.status === 'paused' ? C.green : colors.textSecondary }]}>{l.status === 'paused' ? 'Resume' : 'Pause'}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => edit(l)} style={styles.listingAct}>
              <Plus size={15} color={accent} />
              <Text style={[styles.listingActText, { color: accent }]}>{l.status === 'full' ? 'Add spots' : 'Extend'}</Text>
            </TouchableOpacity>
          )}
          <View style={[styles.vsep, { backgroundColor: colors.border }]} />
          <TouchableOpacity onPress={() => edit(l)} style={styles.listingAct} testID={`listing-edit-${l.id}`}>
            <Pencil size={15} color={colors.textSecondary} /><Text style={[styles.listingActText, { color: colors.textSecondary }]}>Edit</Text>
          </TouchableOpacity>
          <View style={[styles.vsep, { backgroundColor: colors.border }]} />
          <TouchableOpacity onPress={() => setMenuFor(l)} style={styles.listingAct} accessibilityLabel="More">
            <MoreHorizontal size={17} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderPlan = (p: Plan) => {
    const d = new Date(`${p.date}T12:00:00`);
    const valid = Number.isFinite(d.getTime());
    const tone = p.status === 'completed' ? C.green : p.status === 'active' ? C.blue : p.status === 'cancelled' ? C.gray : C.gold;
    return (
      <TouchableOpacity key={p.id} activeOpacity={0.85} onPress={() => router.push(`/planner/${p.id}` as never)}
        style={[styles.planCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.dateBlock, { backgroundColor: colors.backgroundSecondary }]}>
          <Text style={[styles.dateMonth, { color: tone }]}>{valid ? d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase() : '—'}</Text>
          <Text style={[styles.dateDay, { color: colors.text }]}>{valid ? d.getDate() : '?'}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.listingTitle, { color: colors.text }]} numberOfLines={1}>{p.date_label || 'Day plan'}</Text>
          <View style={styles.planMeta}>
            {p.location_type ? <><MapPin size={12} color={colors.textTertiary} /><Text style={[styles.muted, { color: colors.textTertiary }]}>{p.custom_location || p.location_type}</Text></> : null}
            {p.transport && p.transport !== 'none' ? <><Car size={12} color={colors.textTertiary} /><Text style={[styles.muted, { color: colors.textTertiary }]}>{p.transport}</Text></> : null}
          </View>
          <View style={[styles.miniPill, { backgroundColor: `${tone}22`, alignSelf: 'flex-start', marginTop: 6 }]}>
            <Text style={[styles.miniPillText, { color: tone }]}>{p.status.charAt(0).toUpperCase() + p.status.slice(1)}</Text>
          </View>
        </View>
        <TouchableOpacity hitSlop={10} onPress={() => confirm('Delete this plan?', `"${p.date_label || p.date}" will be removed.`, 'Delete', () => { deletePlan(p.id); haptic('success'); }, true)}>
          <Trash2 size={17} color={colors.textTertiary} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const TABS: { key: Tab; label: string; badge?: number }[] = [
    { key: 'orders', label: 'Orders', badge: pendingCount || undefined },
    { key: 'listings', label: 'Listings' },
    { key: 'plans', label: 'Plans' },
    { key: 'insights', label: 'Insights' },
  ];

  const pad = { paddingBottom: insets.bottom + 120 };

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: colors.background }]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.h1, { color: colors.text }]}>Manage</Text>
            <Text style={[styles.muted, { color: colors.textTertiary }]}>Your listings, orders and plans</Text>
          </View>
          <TouchableOpacity onPress={() => { haptic(); setCreateOpen(true); }} style={[styles.newBtn, { backgroundColor: colors.text }]} testID="manage-new">
            <Plus size={16} color={colors.background} strokeWidth={3} />
            <Text style={[styles.newText, { color: colors.background }]}>New</Text>
          </TouchableOpacity>
        </View>

        <LinearGradient colors={['#7C3AED', '#DB2777']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.summary}>
          <View style={{ flex: 1.2 }}>
            <Text style={styles.sumLabel}>Earned</Text>
            <Text style={styles.sumBig}>{formatMoney(earned)}</Text>
            <Text style={styles.sumHint}>from {counts.done} finished order{counts.done === 1 ? '' : 's'}</Text>
          </View>
          <View style={styles.sumStats}>
            <TouchableOpacity style={styles.sumStat} onPress={() => { setTab('orders'); setOrderFilter('waiting'); }}>
              <Text style={styles.sumStatNum}>{counts.waiting}</Text><Text style={styles.sumStatLabel}>Waiting</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sumStat} onPress={() => { setTab('orders'); setOrderFilter('active'); }}>
              <Text style={styles.sumStatNum}>{counts.active}</Text><Text style={styles.sumStatLabel}>In progress</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sumStat} onPress={() => setTab('listings')}>
              <Text style={styles.sumStatNum}>{liveCount}{cap != null ? <Text style={styles.sumStatOf}>/{cap}</Text> : null}</Text><Text style={styles.sumStatLabel}>Live</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={[styles.tabs, { backgroundColor: colors.surfaceHighlight }]}>
          {TABS.map((t) => {
            const on = tab === t.key;
            return (
              <TouchableOpacity key={t.key} onPress={() => { setTab(t.key); haptic(); }} style={[styles.tab, on && { backgroundColor: colors.background }]} testID={`manage-tab-${t.key}`}>
                <Text style={[styles.tabText, { color: on ? colors.text : colors.textSecondary }]}>{t.label}</Text>
                {t.badge ? <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{t.badge}</Text></View> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {tab === 'orders' && (
        <FlatList
          data={shownOrders}
          keyExtractor={(o) => o.id}
          renderItem={renderOrder}
          contentContainerStyle={[styles.body, pad]}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.textSecondary} />}
          ListHeaderComponent={
            renderChips<OrderFilter>([
              { key: 'waiting', label: 'Needs reply', n: counts.waiting },
              { key: 'active', label: 'In progress', n: counts.active },
              { key: 'done', label: 'Done', n: counts.done },
              { key: 'declined', label: 'Declined' },
              { key: 'all', label: 'All' },
            ], effectiveOrderFilter, setOrderFilter)
          }
          ListEmptyComponent={loading ? undefined : (
            counts.all === 0
              ? renderEmpty(<BellRing size={28} color={C.purple} />, 'No orders yet',
                'When someone grabs one of your bundles or skill deals, it shows up here so you can accept it and get started.',
                { label: listings.length ? 'See your listings' : 'Post your first listing', onPress: () => (listings.length ? setTab('listings') : setCreateOpen(true)) })
              : renderEmpty(<Inbox size={28} color={colors.textSecondary} />, 'Nothing here',
                effectiveOrderFilter === 'waiting' ? 'You’ve replied to every grab. Nice.' : 'No orders with this status.')
          )}
        />
      )}

      {tab === 'listings' && (
        <ScrollView contentContainerStyle={[styles.body, pad]} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => { reloadBundles(); reloadSkills(); }} tintColor={colors.textSecondary} />}>
          <View style={styles.createRow}>
            <TouchableOpacity onPress={() => create('bundle')} style={[styles.createTile, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="create-bundle">
              <View style={[styles.createIcon, { backgroundColor: C.purpleDim }]}><Package size={20} color={C.purple} /></View>
              <Text style={[styles.createTitle, { color: colors.text }]}>New bundle</Text>
              <Text style={[styles.muted, { color: colors.textTertiary }]}>Several services, one price</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => create('skill')} style={[styles.createTile, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="create-skill">
              <View style={[styles.createIcon, { backgroundColor: C.blueDim }]}><Zap size={20} color={C.blue} /></View>
              <Text style={[styles.createTitle, { color: colors.text }]}>New skill deal</Text>
              <Text style={[styles.muted, { color: colors.textTertiary }]}>One service, deal price</Text>
            </TouchableOpacity>
          </View>

          {cap != null ? (
            <TouchableOpacity onPress={() => openPaywall('listing')} activeOpacity={0.85} style={[styles.usage, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.usageText, { color: colors.text }]}>{sub.listingsActive} of {cap} live listings used</Text>
                <View style={[styles.bar, { backgroundColor: colors.surfaceHighlight, marginTop: 6 }]}>
                  <View style={[styles.barFill, { width: `${Math.min(100, (sub.listingsActive / Math.max(cap, 1)) * 100)}%`, backgroundColor: sub.listingsActive >= cap ? C.coral : C.purple }]} />
                </View>
              </View>
              <View style={styles.upgrade}><Crown size={14} color={C.gold} /><Text style={{ color: C.gold, fontWeight: '800', fontSize: 13 }}>{sub.tier === 'free' ? 'Get a plan' : 'More'}</Text></View>
            </TouchableOpacity>
          ) : null}

          {listings.length > 0 ? (
            renderChips<ListingFilter>([
              { key: 'all', label: 'All', n: listings.length },
              { key: 'bundle', label: 'Bundles', n: myBundles.length },
              { key: 'skill', label: 'Skill deals', n: mySkills.length },
              { key: 'paused', label: 'Not live', n: listings.length - liveCount },
            ], listingFilter, setListingFilter)
          ) : null}

          {listings.length === 0 ? (
            renderEmpty(<Sparkles size={28} color={C.purple} />, 'Nothing posted yet', 'Post a bundle or a skill deal. It shows up on Home for people to grab.')
          ) : shownListings.length === 0 ? (
            renderEmpty(<Inbox size={28} color={colors.textSecondary} />, 'Nothing here', 'No listings match this filter.')
          ) : shownListings.map((l) => renderListing(l))}
        </ScrollView>
      )}

      {tab === 'plans' && (
        <ScrollView contentContainerStyle={[styles.body, pad]} showsVerticalScrollIndicator={false}>
          <TouchableOpacity onPress={() => create('plan')} style={[styles.planCreate, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.createIcon, { backgroundColor: C.greenDim }]}><CalendarDays size={20} color={C.green} /></View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.createTitle, { color: colors.text }]}>Plan a day</Text>
              <Text style={[styles.muted, { color: colors.textTertiary }]}>Schedule a day, a ride or help you need</Text>
            </View>
            <ChevronRight size={18} color={colors.textTertiary} />
          </TouchableOpacity>
          {sortedPlans.length === 0 ? (
            renderEmpty(<CalendarDays size={28} color={C.green} />, 'No plans yet', 'Plan a day to keep everything in one place.')
          ) : sortedPlans.map((p) => renderPlan(p))}
        </ScrollView>
      )}

      {tab === 'insights' && (
        <ScrollView contentContainerStyle={[styles.body, pad]} showsVerticalScrollIndicator={false}>
          <View style={styles.heroRow}>
            <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TrendingUp size={18} color={C.green} />
              <Text style={[styles.heroNum, { color: colors.text }]}>{formatMoney(insights.gross)}</Text>
              <Text style={[styles.muted, { color: colors.textTertiary }]}>Value of all grabs</Text>
            </View>
            <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Activity size={18} color={C.blue} />
              <Text style={[styles.heroNum, { color: colors.text }]}>{insights.acceptRate}%</Text>
              <Text style={[styles.muted, { color: colors.textTertiary }]}>Grabs you accepted</Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Most grabbed</Text>
          {insights.top.length === 0 ? (
            <Text style={[styles.muted, { color: colors.textTertiary, marginBottom: 16 }]}>Your top listings appear here after your first grabs.</Text>
          ) : insights.top.map((t, i) => (
            <View key={t.title + i} style={[styles.topRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.rank, { color: i === 0 ? C.gold : colors.textTertiary }]}>{i + 1}</Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.listingTitle, { color: colors.text }]} numberOfLines={1}>{t.title}</Text>
                <Text style={[styles.muted, { color: colors.textTertiary }]}>{t.grabs} grab{t.grabs === 1 ? '' : 's'} · {formatMoney(t.gross)}</Text>
              </View>
              {t.kind === 'bundle' ? <Package size={16} color={C.purple} /> : <Zap size={16} color={C.blue} />}
            </View>
          ))}

          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Recent activity</Text>
          {activity.length === 0 ? (
            <Text style={[styles.muted, { color: colors.textTertiary }]}>Orders and new listings show up here.</Text>
          ) : (
            <View style={[styles.activityBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {activity.map((e, i) => (
                <View key={e.id} style={[styles.activityRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                  <View style={[styles.activityDot, { backgroundColor: e.tone }]} />
                  <Text style={[styles.activityText, { color: colors.text }]} numberOfLines={2}>{e.text}</Text>
                  <Text style={[styles.muted, { color: colors.textTertiary }]}>{ago(e.at)}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Create sheet */}
      <Modal visible={createOpen} transparent animationType="fade" onRequestClose={() => setCreateOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setCreateOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]} onPress={() => undefined}>
            <View style={[styles.grabber, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>What do you want to post?</Text>
            {[
              { k: 'bundle' as const, icon: <Package size={22} color={C.purple} />, bg: C.purpleDim, t: 'Bundle', s: 'Package several services at one price, like a spa day or a move-in package.' },
              { k: 'skill' as const, icon: <Zap size={22} color={C.blue} />, bg: C.blueDim, t: 'Skill deal', s: 'One service at a deal price for a limited time.' },
              { k: 'plan' as const, icon: <CalendarDays size={22} color={C.green} />, bg: C.greenDim, t: 'Day plan', s: 'Plan your day and ask for help with it.' },
            ].map((o) => (
              <TouchableOpacity key={o.k} onPress={() => create(o.k)} style={[styles.sheetRow, { borderColor: colors.border }]} testID={`sheet-${o.k}`}>
                <View style={[styles.createIcon, { backgroundColor: o.bg }]}>{o.icon}</View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.createTitle, { color: colors.text }]}>{o.t}</Text>
                  <Text style={[styles.muted, { color: colors.textTertiary }]}>{o.s}</Text>
                </View>
                <ChevronRight size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Listing "more" sheet */}
      <Modal visible={!!menuFor} transparent animationType="fade" onRequestClose={() => setMenuFor(null)}>
        <Pressable style={styles.overlay} onPress={() => setMenuFor(null)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]} onPress={() => undefined}>
            <View style={[styles.grabber, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]} numberOfLines={1}>{menuFor?.title}</Text>
            {menuFor ? (
              <>
                <TouchableOpacity style={[styles.menuRow, { borderColor: colors.border }]} onPress={() => { const l = menuFor; setMenuFor(null); edit(l); }}>
                  <Pencil size={18} color={colors.text} /><Text style={[styles.menuText, { color: colors.text }]}>Edit everything</Text>
                </TouchableOpacity>
                {menuFor.status === 'live' || menuFor.status === 'paused' ? (
                  <TouchableOpacity style={[styles.menuRow, { borderColor: colors.border }]} onPress={() => { const l = menuFor; setMenuFor(null); togglePause(l); }}>
                    {menuFor.status === 'paused' ? <Play size={18} color={C.green} /> : <Pause size={18} color={colors.text} />}
                    <Text style={[styles.menuText, { color: colors.text }]}>{menuFor.status === 'paused' ? 'Put back on Home' : 'Pause (hide from Home)'}</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={[styles.menuRow, { borderColor: colors.border }]} onPress={() => { const l = menuFor; setMenuFor(null); remove(l); }} testID="listing-delete">
                  <Trash2 size={18} color={C.coral} /><Text style={[styles.menuText, { color: C.coral }]}>Delete</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 16, paddingBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  h1: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  muted: { fontSize: 12, lineHeight: 17 },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 },
  newText: { fontSize: 14, fontWeight: '800' },
  summary: { borderRadius: 22, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  sumLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  sumBig: { color: '#FFF', fontSize: 30, fontWeight: '800', marginTop: 2 },
  sumHint: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  sumStats: { flex: 2, flexDirection: 'row', gap: 6 },
  sumStat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 14, paddingVertical: 10, alignItems: 'center' },
  sumStatNum: { color: '#FFF', fontSize: 20, fontWeight: '800' },
  sumStatOf: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '700' },
  sumStatLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600', marginTop: 1 },
  tabs: { flexDirection: 'row', borderRadius: 14, padding: 4 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 11 },
  tabText: { fontSize: 13, fontWeight: '700' },
  tabBadge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: C.gold },
  tabBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  body: { padding: 16, maxWidth: 720, width: '100%', alignSelf: 'center' },
  chips: { gap: 8, paddingBottom: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  chipText: { fontSize: 13, fontWeight: '700' },
  chipCount: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  chipCountText: { fontSize: 11, fontWeight: '800' },
  orderCard: { borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 12, gap: 12 },
  orderTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  buyer: { fontSize: 15, fontWeight: '700' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '800' },
  orderItem: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 10 },
  kindIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  orderTitle: { flex: 1, fontSize: 14, fontWeight: '600' },
  orderPrice: { fontSize: 14, fontWeight: '800' },
  orderActions: { flexDirection: 'row', gap: 8 },
  actBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12 },
  actPrimary: { flex: 1 },
  actPrimaryText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  actText: { fontWeight: '700', fontSize: 14 },
  actIcon: { width: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  empty: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 28, alignItems: 'center', marginTop: 4 },
  emptyIcon: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { fontSize: 17, fontWeight: '800', marginBottom: 6 },
  emptySub: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 4 },
  emptyBtn: { marginTop: 14, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 999 },
  createRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  createTile: { flex: 1, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 4 },
  createIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  createTitle: { fontSize: 15, fontWeight: '800' },
  usage: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 12, marginBottom: 12 },
  usageText: { fontSize: 13, fontWeight: '700' },
  upgrade: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.goldDim, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999 },
  listingCard: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, marginBottom: 12, overflow: 'hidden' },
  listingMain: { flexDirection: 'row', gap: 12, padding: 12 },
  thumb: { width: 76, height: 76, borderRadius: 14 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  miniPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  miniPillText: { fontSize: 11, fontWeight: '800' },
  listingTitle: { fontSize: 15, fontWeight: '700', marginTop: 2 },
  listingPrice: { fontSize: 14, fontWeight: '800', marginTop: 2 },
  bar: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 8, marginBottom: 4 },
  barFill: { height: '100%', borderRadius: 3 },
  listingActions: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  listingAct: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11 },
  listingActText: { fontSize: 13, fontWeight: '700' },
  vsep: { width: StyleSheet.hairlineWidth },
  planCreate: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 14, marginBottom: 12 },
  planCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 12, marginBottom: 10 },
  dateBlock: { width: 54, height: 58, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dateMonth: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  dateDay: { fontSize: 22, fontWeight: '800' },
  planMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3, flexWrap: 'wrap' },
  heroRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  hero: { flex: 1, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 4 },
  heroNum: { fontSize: 24, fontWeight: '800' },
  sectionTitle: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, marginTop: 4 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 12, marginBottom: 8 },
  rank: { fontSize: 18, fontWeight: '800', width: 18, textAlign: 'center' },
  activityBox: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, marginBottom: 12 },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  activityDot: { width: 8, height: 8, borderRadius: 4 },
  activityText: { flex: 1, fontSize: 14 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 10, maxWidth: 640, width: '100%', alignSelf: 'center' },
  grabber: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 14 },
  sheetTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15, borderTopWidth: StyleSheet.hairlineWidth },
  menuText: { fontSize: 16, fontWeight: '600' },
});

