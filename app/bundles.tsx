import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, Plus, Package, X, DollarSign, Trash2 } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useBundles, type UserBundle } from '@/contexts/BundleContext';

const ACCENT_COLORS = {
  purple: '#8B5CF6',
  purpleDim: 'rgba(139, 92, 246, 0.12)',
  neonGreen: '#10B981',
  coral: '#FF6B6B',
  coralDim: 'rgba(255, 107, 107, 0.12)',
};

export default function BundlesManagerScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { myBundles, deleteBundle } = useBundles();
  const [justDeleted, setJustDeleted] = useState<string | null>(null);

  const confirmDelete = (bundle: UserBundle) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Delete Bundle?',
      `Are you sure you want to delete "${bundle.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteBundle(bundle.id);
            setJustDeleted(bundle.id);
            setTimeout(() => setJustDeleted(null), 1200);
            if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const goToBuilder = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/bundle-builder' as any);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.headerBtn, { backgroundColor: colors.surface }]}
          onPress={() => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
        >
          <ChevronLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>My Bundles</Text>
        <View style={styles.headerBtnSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* New Bundle button — always on top */}
        <TouchableOpacity
          style={[styles.newBundleBtn, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}
          activeOpacity={0.85}
          onPress={goToBuilder}
        >
          <View style={[styles.newBundleIcon, { backgroundColor: ACCENT_COLORS.purpleDim }]}>
            <Plus size={20} color={ACCENT_COLORS.purple} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.newBundleTitle, { color: colors.text }]}>Create New Bundle</Text>
            <Text style={[styles.newBundleSubtitle, { color: colors.textSecondary }]}>
              Offer multiple services together as one package
            </Text>
          </View>
          <Plus size={18} color={colors.textTertiary} />
        </TouchableOpacity>

        {/* My bundles list */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
          {myBundles.length} bundle{myBundles.length !== 1 ? 's' : ''}
        </Text>

        {myBundles.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.emptyIconWrap, { backgroundColor: ACCENT_COLORS.purpleDim }]}>
              <Package size={32} color={ACCENT_COLORS.purple} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No bundles yet</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Create your first bundle to offer multiple services in one place
            </Text>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: ACCENT_COLORS.purpleDim }]}
              onPress={goToBuilder}
            >
              <Text style={[styles.emptyBtnText, { color: ACCENT_COLORS.purple }]}>Create Bundle</Text>
            </TouchableOpacity>
          </View>
        ) : (
          myBundles.map((bundle) => (
            <View
              key={bundle.id}
              style={[
                styles.bundleCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                justDeleted === bundle.id && { opacity: 0.4 },
              ]}
            >
              {bundle.imageUrl ? (
                <Image source={{ uri: bundle.imageUrl }} style={styles.bundleThumb} />
              ) : (
                <View style={[styles.bundleThumbIcon, { backgroundColor: ACCENT_COLORS.purpleDim }]}>
                  <Package size={20} color={ACCENT_COLORS.purple} />
                </View>
              )}
              <View style={styles.bundleInfo}>
                <Text style={[styles.bundleTitle, { color: colors.text }]} numberOfLines={1}>{bundle.title}</Text>
                <Text style={[styles.bundleMeta, { color: colors.textTertiary }]} numberOfLines={1}>
                  {bundle.grabCount} grab{bundle.grabCount !== 1 ? 's' : ''}
                  {bundle.category ? ` · ${bundle.category}` : ''}
                </Text>
                <Text style={[styles.bundlePrice, { color: ACCENT_COLORS.neonGreen }]}>${bundle.price}</Text>
              </View>
              <TouchableOpacity
                style={[styles.deleteBtn, { backgroundColor: ACCENT_COLORS.coralDim }]}
                onPress={() => confirmDelete(bundle)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Trash2 size={17} color={ACCENT_COLORS.coral} />
              </TouchableOpacity>
            </View>
          ))
        )}

        <Text style={[styles.hintText, { color: colors.textTertiary }]}>
          Bundles you create here show up in your feed and in the marketplace so others can grab them.
        </Text>
      </ScrollView>
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
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnSpacer: { width: 40 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  content: { padding: 16 },
  newBundleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
  },
  newBundleIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newBundleTitle: { fontSize: 15, fontWeight: '700' },
  newBundleSubtitle: { fontSize: 12, marginTop: 2 },
  sectionLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 22, marginBottom: 10 },
  emptyCard: {
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', marginBottom: 20 },
  emptyBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  emptyBtnText: { fontSize: 14, fontWeight: '700' },
  bundleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  bundleThumb: { width: 48, height: 48, borderRadius: 12, marginRight: 12 },
  bundleThumbIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  bundleInfo: { flex: 1 },
  bundleTitle: { fontSize: 15, fontWeight: '600' },
  bundleMeta: { fontSize: 12, marginTop: 4 },
  bundlePrice: { fontSize: 16, fontWeight: '700', marginTop: 4 },
  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  hintText: { fontSize: 12, textAlign: 'center', marginTop: 24, lineHeight: 18 },
});
