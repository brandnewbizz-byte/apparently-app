import {
  Eye, MousePointerClick, SkipForward, TrendingUp, Edit3, Trash2, Power,
  Package, Wrench, ChevronLeft, Clock, DollarSign, BarChart3,
} from 'lucide-react-native';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import * as localApi from '@/lib/api';

interface Deal {
  id: string;
  title: string;
  description: string;
  price: number;
  image_url?: string;
  items?: string[];
  icon?: string;
  category?: string;
  status: string;
  grab_count: number;
  view_count: number;
  skip_count: number;
  creator_name?: string;
  creator_avatar?: string;
  created_at: string;
}

export default function ManageDealsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();

  const [tab, setTab] = useState<'skills' | 'bundles'>('skills');
  const [skills, setSkills] = useState<Deal[]>([]);
  const [bundles, setBundles] = useState<Deal[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [editModal, setEditModal] = useState(false);
  const [editDeal, setEditDeal] = useState<Deal | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPrice, setEditPrice] = useState('');

  const creatorId = user?.id || 'u-dev';

  const fetchDeals = useCallback(async () => {
    try {
      const [s, b] = await Promise.all([
        localApi.getSkillDeals(creatorId),
        localApi.getBundles(creatorId),
      ]);
      setSkills(s || []);
      setBundles(b || []);
    } catch {
      // mock fallback
    } finally {
      setLoading(false);
    }
  }, [creatorId]);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDeals();
    setRefreshing(false);
  }, [fetchDeals]);

  const deals = tab === 'skills' ? skills : bundles;

  const totalGrabs = deals.reduce((sum, d) => sum + (d.grab_count || 0), 0);
  const totalViews = deals.reduce((sum, d) => sum + (d.view_count || 0), 0);
  const totalSkips = deals.reduce((sum, d) => sum + (d.skip_count || 0), 0);
  const totalRevenue = deals.reduce((sum, d) => sum + (d.grab_count || 0) * d.price, 0);

  const conversionRate = totalViews > 0 ? ((totalGrabs / totalViews) * 100).toFixed(1) : '0';

  const getItemRate = (grabs: number, views: number) => {
    if (!views) return '—';
    return `${((grabs / views) * 100).toFixed(0)}%`;
  };

  const toggleStatus = async (d: Deal) => {
    const newStatus = d.status === 'active' ? 'paused' : 'active';
    try {
      await localApi.updateDeal(tab === 'skills' ? 'skill' : 'bundle', d.id, { status: newStatus });
      if (tab === 'skills') {
        setSkills(prev => prev.map(s => s.id === d.id ? { ...s, status: newStatus } : s));
      } else {
        setBundles(prev => prev.map(b => b.id === d.id ? { ...b, status: newStatus } : b));
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  };

  const openEdit = (d: Deal) => {
    setEditDeal(d);
    setEditTitle(d.title);
    setEditDesc(d.description || '');
    setEditPrice(String(d.price));
    setEditModal(true);
  };

  const saveEdit = async () => {
    if (!editDeal || !editTitle.trim()) return;
    const price = parseFloat(editPrice) || 0;
    try {
      await localApi.updateDeal(tab === 'skills' ? 'skill' : 'bundle', editDeal.id, {
        title: editTitle.trim(), description: editDesc.trim(), price,
      });
      const updater = (prev: Deal[]) => prev.map(d =>
        d.id === editDeal.id ? { ...d, title: editTitle.trim(), description: editDesc.trim(), price } : d
      );
      if (tab === 'skills') setSkills(updater);
      else setBundles(updater);
      setEditModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.surface }]}>
            <ChevronLeft size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Manage Deals</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Summary cards */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <BarChart3 size={14} color={colors.accent} />
            <Text style={[styles.statVal, { color: colors.text }]}>{totalViews}</Text>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Views</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MousePointerClick size={14} color="#10B981" />
            <Text style={[styles.statVal, { color: colors.text }]}>{totalGrabs}</Text>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Grabs</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <SkipForward size={14} color="#F59E0B" />
            <Text style={[styles.statVal, { color: colors.text }]}>{totalSkips}</Text>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Skips</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <DollarSign size={14} color="#EC4899" />
            <Text style={[styles.statVal, { color: colors.text }]}>${totalRevenue}</Text>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Potential</Text>
          </View>
        </View>

        {/* Conversion */}
        <View style={[styles.convBar, { backgroundColor: colors.accentGlow, borderColor: colors.accent + '30' }]}>
          <TrendingUp size={16} color={colors.accent} />
          <Text style={[styles.convText, { color: colors.accent }]}>
            {conversionRate}% grab rate ({totalGrabs} of {totalViews} views)
          </Text>
        </View>
      </View>

      {/* Tab toggle */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'skills' && styles.tabBtnActive, { borderColor: tab === 'skills' ? colors.accent : colors.border, backgroundColor: colors.surface }]}
          onPress={() => setTab('skills')}
        >
          <Wrench size={15} color={tab === 'skills' ? colors.accent : colors.textSecondary} />
          <Text style={[styles.tabBtnText, { color: tab === 'skills' ? colors.accent : colors.textSecondary }]}>Skills ({skills.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'bundles' && styles.tabBtnActive, { borderColor: tab === 'bundles' ? colors.accent : colors.border, backgroundColor: colors.surface }]}
          onPress={() => setTab('bundles')}
        >
          <Package size={15} color={tab === 'bundles' ? colors.accent : colors.textSecondary} />
          <Text style={[styles.tabBtnText, { color: tab === 'bundles' ? colors.accent : colors.textSecondary }]}>Bundles ({bundles.length})</Text>
        </TouchableOpacity>
      </View>

      {/* Deal List */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollInner}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {loading ? (
          <Text style={[styles.empty, { color: colors.textTertiary }]}>Loading deals...</Text>
        ) : deals.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Package size={40} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No {tab === 'skills' ? 'skill deals' : 'bundles'} yet</Text>
            <Text style={[styles.emptySub, { color: colors.textTertiary }]}>Create one from the Home screen</Text>
          </View>
        ) : (
          deals.map((d) => (
            <View key={d.id} style={[styles.dealCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity: d.status === 'paused' ? 0.5 : 1 }]}>
              <Image
                source={{ uri: d.image_url || 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=200' }}
                style={[styles.dealImg, { backgroundColor: colors.backgroundTertiary }]}
              />
              <View style={styles.dealBody}>
                <View style={styles.dealHeader}>
                  <Text style={[styles.dealTitle, { color: colors.text }]} numberOfLines={1}>{d.title}</Text>
                  <Text style={[styles.dealPrice, { color: colors.accent }]}>${d.price}</Text>
                </View>
                {d.description ? (
                  <Text style={[styles.dealDesc, { color: colors.textSecondary }]} numberOfLines={2}>{d.description}</Text>
                ) : null}
                {d.items && d.items.length > 0 && (
                  <Text style={[styles.dealItems, { color: colors.textTertiary }]} numberOfLines={1}>
                    {d.items.join(' · ')}
                  </Text>
                )}
                <View style={styles.dealStats}>
                  <View style={styles.dealStatItem}>
                    <Eye size={12} color={colors.textTertiary} />
                    <Text style={[styles.dealStatVal, { color: colors.textSecondary }]}>{d.view_count || 0}</Text>
                  </View>
                  <View style={styles.dealStatItem}>
                    <MousePointerClick size={12} color="#10B981" />
                    <Text style={[styles.dealStatVal, { color: colors.textSecondary }]}>{d.grab_count || 0}</Text>
                  </View>
                  <View style={styles.dealStatItem}>
                    <SkipForward size={12} color="#F59E0B" />
                    <Text style={[styles.dealStatVal, { color: colors.textSecondary }]}>{d.skip_count || 0}</Text>
                  </View>
                  <Text style={[styles.dealRate, { color: colors.textTertiary }]}>
                    {getItemRate(d.grab_count || 0, d.view_count || 0)}
                  </Text>
                </View>
              </View>
              <View style={styles.dealActions}>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.backgroundTertiary }]} onPress={() => openEdit(d)}>
                  <Edit3 size={14} color={colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: d.status === 'active' ? '#F59E0B20' : '#10B98120' }]}
                  onPress={() => toggleStatus(d)}
                >
                  <Power size={14} color={d.status === 'active' ? '#F59E0B' : '#10B981'} />
                </TouchableOpacity>
              </View>
              {d.status === 'paused' && (
                <View style={styles.pausedBadge}>
                  <Text style={styles.pausedText}>PAUSED</Text>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={editModal} animationType="fade" transparent statusBarTranslucent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Edit {tab === 'skills' ? 'Skill' : 'Bundle'}</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              value={editTitle} onChangeText={setEditTitle} placeholder="Title"
              placeholderTextColor={colors.textTertiary}
            />
            <TextInput
              style={[styles.modalInput, styles.modalArea, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              value={editDesc} onChangeText={setEditDesc} placeholder="Description" multiline
              placeholderTextColor={colors.textTertiary}
            />
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              value={editPrice} onChangeText={setEditPrice} placeholder="Price" keyboardType="decimal-pad"
              placeholderTextColor={colors.textTertiary}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.surface }]} onPress={() => setEditModal(false)}>
                <Text style={[styles.modalBtnText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.accent }]} onPress={saveEdit}>
                <Text style={[styles.modalBtnText, { color: '#FFF' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  backBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1, gap: 2 },
  statVal: { fontSize: 16, fontWeight: '700' },
  statLabel: { fontSize: 10, fontWeight: '500', textTransform: 'uppercase' },
  convBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1 },
  convText: { fontSize: 13, fontWeight: '600' },
  tabRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  tabBtnActive: { borderWidth: 2 },
  tabBtnText: { fontSize: 13, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollInner: { padding: 16, paddingBottom: 80 },
  emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '600' },
  emptySub: { fontSize: 14 },
  empty: { textAlign: 'center', paddingVertical: 40 },
  dealCard: {
    flexDirection: 'row', padding: 12, borderRadius: 14, borderWidth: 1, marginBottom: 10,
    alignItems: 'flex-start',
  },
  dealImg: { width: 64, height: 64, borderRadius: 10, marginRight: 12 },
  dealBody: { flex: 1 },
  dealHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  dealTitle: { fontSize: 15, fontWeight: '600', flex: 1, marginRight: 8 },
  dealPrice: { fontSize: 15, fontWeight: '700' },
  dealDesc: { fontSize: 12, lineHeight: 16, marginBottom: 4 },
  dealItems: { fontSize: 11, marginBottom: 6 },
  dealStats: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dealStatItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  dealStatVal: { fontSize: 12, fontWeight: '600' },
  dealRate: { fontSize: 11, fontWeight: '600', marginLeft: 'auto' },
  dealActions: { gap: 8, marginLeft: 8 },
  actionBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  pausedBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: '#F59E0B', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  pausedText: { fontSize: 8, fontWeight: '800', color: '#000' },
  modalBackdrop: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 24 },
  modalSheet: { borderRadius: 20, padding: 20, paddingBottom: 30 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  modalInput: { borderRadius: 12, borderWidth: 1, padding: 14, fontSize: 15, marginBottom: 10 },
  modalArea: { height: 70, textAlignVertical: 'top' },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 10 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  modalBtnText: { fontSize: 15, fontWeight: '600' },
});
