import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import {
  ChevronLeft,
  Package,
  Plus,
  X,
  DollarSign,
  Camera,
  Tag,
  MapPin,
  Calendar,
  Trash2,
  Star,
  Play,
} from 'lucide-react-native';

import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useBundles, type BundleItem } from '@/contexts/BundleContext';
import { uploadVideoToStorage, persistableImageUri } from '@/lib/storage';

// ── Categories ───────────────────────────────────────────────────────

const BUNDLE_CATEGORIES = [
  { key: 'home', label: 'Home', icon: '🏠' },
  { key: 'cleaning', label: 'Cleaning', icon: '🧹' },
  { key: 'dining', label: 'Dining', icon: '🍽️' },
  { key: 'pets', label: 'Pets', icon: '🐾' },
  { key: 'fitness', label: 'Fitness', icon: '💪' },
  { key: 'creative', label: 'Creative', icon: '🎨' },
  { key: 'tech', label: 'Tech', icon: '💻' },
  { key: 'education', label: 'Education', icon: '📚' },
  { key: 'wellness', label: 'Wellness', icon: '🧘' },
  { key: 'outdoor', label: 'Outdoor', icon: '🌲' },
  { key: 'events', label: 'Events', icon: '🎉' },
  { key: 'transport', label: 'Transport', icon: '🚗' },
  { key: 'beauty', label: 'Beauty', icon: '💄' },
  { key: 'repair', label: 'Repair', icon: '🔧' },
  { key: 'other', label: 'Other', icon: '🛠️' },
];

interface ServiceDraft {
  id: string;
  name: string;
  description: string;
  price: number;
}

const newServiceId = () => `svc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export default function BundleBuilderScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { createBundle } = useBundles();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [bundlePrice, setBundlePrice] = useState('');
  const [services, setServices] = useState<ServiceDraft[]>([
    { id: newServiceId(), name: '', description: '', price: 0 },
  ]);
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [dateRange, setDateRange] = useState('');
  // How many people can grab this bundle (one spot by default).
  const [availableCount, setAvailableCount] = useState('1');
  const [plannerNotes, setPlannerNotes] = useState('');
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [coverMediaType, setCoverMediaType] = useState<'image' | 'video'>('image');
  const [publishing, setPublishing] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  const itemsTotal = services.reduce((sum, s) => sum + (s.price || 0), 0);
  const finalPrice = bundlePrice ? parseFloat(bundlePrice) : itemsTotal;
  const hasNamedService = services.some((s) => s.name.trim().length > 0);

  const addService = useCallback(() => {
    setServices((prev) => [...prev, { id: newServiceId(), name: '', description: '', price: 0 }]);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const updateService = useCallback((id: string, field: keyof ServiceDraft, value: string) => {
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: field === 'price' ? parseFloat(value) || 0 : value } : s))
    );
  }, []);

  const removeService = useCallback((id: string) => {
    setServices((prev) => (prev.length <= 1 ? prev : prev.filter((s) => s.id !== id)));
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const pickImage = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
      allowsEditing: true,
      aspect: [16, 9],
      videoMaxDuration: 60,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      if (asset.type === 'video' && asset.duration && asset.duration > 60000) {
        Alert.alert('Video too long', 'Please select a video under 60 seconds.');
        return;
      }
      setCoverImage(asset.uri);
      setCoverMediaType(asset.type === 'video' ? 'video' : 'image');
    }
  }, []);

  const addTag = useCallback(() => {
    const t = tagInput.trim().replace(/^#/, '');
    if (t && !tags.includes(t) && tags.length < 5) {
      setTags((prev) => [...prev, t]);
      setTagInput('');
    }
  }, [tagInput, tags]);

  const removeTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  const canPublish = title.trim().length > 0 && finalPrice > 0;

  const handlePublish = async () => {
    if (!canPublish || publishing) {
      if (!canPublish) Alert.alert('Missing Info', 'Add a title and price to publish your bundle.');
      return;
    }
    setPublishing(true);

    let imageUrl = '';
    let videoUrl: string | undefined;
    try {
      if (coverImage) {
        if (coverMediaType === 'video') {
          videoUrl = await uploadVideoToStorage(coverImage, 'user-media', `bundles/${user?.id || 'anon'}`);
        } else {
          imageUrl = (await persistableImageUri(coverImage, 'user-media', `bundles/${user?.id || 'anon'}`)) || '';
        }
      }
    } catch (e) {
      console.warn('[bundle-builder] media upload failed', e);
    }

    const items: BundleItem[] = services.map((s, i) => ({
      id: `item-${Date.now()}-${i}`,
      name: s.name.trim() || `Service ${i + 1}`,
      description: s.description.trim() || undefined,
      category: 'service',
      provider: 'You',
      providerAvatar: '',
      providerLink: undefined,
      price: s.price || 0,
      icon: '📦',
    }));

    const bundleDescription =
      services[0]?.description?.trim() ||
      services.map((s) => s.name.trim()).filter(Boolean).join(', ') ||
      `${items.length} service${items.length !== 1 ? 's' : ''}`;

    const result = createBundle({
      title: title.trim(),
      description: bundleDescription,
      price: finalPrice,
      items,
      imageUrl,
      videoUrl,
      mediaType: coverMediaType,
      category: category || 'other',
      location: location.trim(),
      dateRange: dateRange.trim(),
      tags: tags.length ? tags : ['Bundle'],
      creator: {
        name: user?.fullName || user?.username || 'You',
        avatar: user?.avatar || '',
        rating: 5.0,
        reviews: 0,
      },
      creatorId: user?.id || '',
      availableCount: Math.max(parseInt(availableCount, 10) || 1, 1),
      plannerNotes: plannerNotes.trim() || undefined,
    });

    if (!result.success) {
      setPublishing(false);
      Alert.alert('Limit Reached', result.error);
      return;
    }

    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.headerBtn, { backgroundColor: colors.surface }]}>
          <ChevronLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Create a Bundle</Text>
        <TouchableOpacity
          style={[styles.publishBtnSmall, { backgroundColor: canPublish ? colors.accent : colors.surfaceHighlight }]}
          onPress={handlePublish}
          disabled={!canPublish}
          activeOpacity={0.9}
        >
          <Text style={[styles.publishBtnSmallText, { color: canPublish ? '#FFF' : colors.textTertiary }]}>Post</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Cover Image */}
        <TouchableOpacity
          style={[styles.imagePicker, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={pickImage}
          activeOpacity={0.7}
        >
          {coverImage ? (
            <View style={styles.imagePreview}>
              {coverMediaType === 'video' ? (
                <View style={[styles.coverImage, styles.videoTile]}>
                  <Play size={28} color="#FFF" fill="#FFF" />
                </View>
              ) : (
                <Image source={{ uri: coverImage }} style={styles.coverImage} />
              )}
              <View style={[styles.imageOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                {coverMediaType === 'video' ? <Play size={14} color="#FFF" fill="#FFF" /> : <Camera size={14} color="#FFF" />}
                <Text style={styles.imageOverlayText}>{coverMediaType === 'video' ? 'Change Video' : 'Change'}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.imagePlaceholder}>
              <Camera size={28} color={colors.textTertiary} />
              <Text style={[styles.imagePickerText, { color: colors.textSecondary }]}>Add Cover Photo or Video</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Title */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Bundle Title</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="What's your bundle called?"
          placeholderTextColor={colors.textTertiary}
          value={title}
          onChangeText={setTitle}
          maxLength={80}
        />

        {/* Bundle Price + Available */}
        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Bundle Price ($)</Text>
            <View style={[styles.input, styles.priceWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <DollarSign size={18} color={colors.textSecondary} />
              <TextInput
                style={[styles.priceField, { color: colors.text }]}
                placeholder="Set your price"
                placeholderTextColor={colors.textTertiary}
                value={bundlePrice}
                onChangeText={setBundlePrice}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
          <View style={styles.half}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Spots (people who can grab)</Text>
            <View style={[styles.input, styles.priceWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={{ color: colors.textSecondary, fontSize: 15, marginRight: 4 }}>×</Text>
              <TextInput
                style={[styles.priceField, { color: colors.text }]}
                placeholder="1"
                placeholderTextColor={colors.textTertiary}
                value={availableCount}
                onChangeText={(t) => setAvailableCount(t.replace(/[^0-9]/g, '').slice(0, 4))}
                keyboardType="number-pad"
              />
            </View>
          </View>
        </View>
        {!bundlePrice && itemsTotal > 0 && (
          <Text style={[styles.priceHint, { color: colors.textTertiary }]}>
            Services sum to ${itemsTotal} — set a different bundle price above, or leave blank to use the sum.
          </Text>
        )}

        {/* Services */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Services in this bundle</Text>
        {services.map((s, idx) => (
          <View key={s.id} style={[styles.serviceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.serviceHeader}>
              <Text style={[styles.serviceIndex, { color: colors.textTertiary }]}>Service {idx + 1}</Text>
              <TouchableOpacity onPress={() => removeService(s.id)} disabled={services.length <= 1} style={services.length <= 1 && { opacity: 0.3 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Trash2 size={16} color={colors.error || '#EF4444'} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="Service name (e.g. Plumbing Inspection)"
              placeholderTextColor={colors.textTertiary}
              value={s.name}
              onChangeText={(v) => updateService(s.id, 'name', v)}
            />

            <TextInput
              style={[styles.input, styles.descInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="What's included, delivered, timeline..."
              placeholderTextColor={colors.textTertiary}
              value={s.description}
              onChangeText={(v) => updateService(s.id, 'description', v)}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />

            <View style={[styles.input, styles.priceWrap, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <DollarSign size={16} color={colors.textSecondary} />
              <TextInput
                style={[styles.priceField, { color: colors.text }]}
                placeholder="Item price (optional)"
                placeholderTextColor={colors.textTertiary}
                value={s.price > 0 ? String(s.price) : ''}
                onChangeText={(v) => updateService(s.id, 'price', v)}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        ))}

        <TouchableOpacity style={[styles.addServiceBtn, { borderColor: colors.accent }]} onPress={addService} activeOpacity={0.7}>
          <Plus size={18} color={colors.accent} />
          <Text style={[styles.addServiceText, { color: colors.accent }]}>Add Another Service</Text>
        </TouchableOpacity>

        {/* Category */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
          {BUNDLE_CATEGORIES.map((cat) => {
            const selected = category === cat.key;
            return (
              <TouchableOpacity
                key={cat.key}
                style={[
                  styles.categoryPill,
                  {
                    backgroundColor: selected ? `${colors.accent}20` : colors.surface,
                    borderColor: selected ? colors.accent : colors.border,
                  },
                ]}
                onPress={() => setCategory(cat.key)}
                activeOpacity={0.7}
              >
                <Text style={styles.categoryEmoji}>{cat.icon}</Text>
                <Text style={[styles.categoryLabel, { color: selected ? colors.accent : colors.text }]}>{cat.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Location + Date */}
        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Location</Text>
            <View style={[styles.input, styles.priceWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <MapPin size={16} color={colors.textSecondary} />
              <TextInput
                style={[styles.priceField, { color: colors.text }]}
                placeholder="Where"
                placeholderTextColor={colors.textTertiary}
                value={location}
                onChangeText={setLocation}
              />
            </View>
          </View>
          <View style={styles.half}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Date Range</Text>
            <View style={[styles.input, styles.priceWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Calendar size={16} color={colors.textSecondary} />
              <TextInput
                style={[styles.priceField, { color: colors.text }]}
                placeholder="e.g. Weekends"
                placeholderTextColor={colors.textTertiary}
                value={dateRange}
                onChangeText={setDateRange}
              />
            </View>
          </View>
        </View>

        {/* Tags */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Tags</Text>
        <View style={[styles.tagWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Tag size={18} color={colors.textSecondary} />
          <View style={{ flex: 1 }}>
            {tags.length > 0 && (
              <View style={styles.tagsRow}>
                {tags.map((tag) => (
                  <TouchableOpacity key={tag} onPress={() => removeTag(tag)} style={[styles.tagPill, { backgroundColor: `${colors.accent}20` }]}>
                    <Text style={[styles.tagPillText, { color: colors.accent }]}>#{tag}</Text>
                    <X size={12} color={colors.accent} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <TextInput
              style={[styles.tagInput, { color: colors.text }]}
              placeholder="Add up to 5 tags"
              placeholderTextColor={colors.textTertiary}
              value={tagInput}
              onChangeText={setTagInput}
              onSubmitEditing={addTag}
              returnKeyType="done"
            />
          </View>
        </View>

        {/* Planner Notes */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Planner Notes (private)</Text>
        <TextInput
          style={[styles.input, styles.descInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="Links, contacts, instructions — for you only"
          placeholderTextColor={colors.textTertiary}
          value={plannerNotes}
          onChangeText={setPlannerNotes}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        {/* Live Preview */}
        <View style={styles.previewWrapper}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Preview</Text>
          <View style={[styles.previewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {coverImage ? (
              coverMediaType === 'video' ? (
                <View style={[styles.previewCover, styles.videoTile]}>
                  <Play size={28} color="#FFF" fill="#FFF" />
                </View>
              ) : (
                <Image source={{ uri: coverImage }} style={styles.previewCover} />
              )
            ) : (
              <View style={[styles.previewCover, { backgroundColor: colors.surfaceHighlight }]}>
                <Text style={{ fontSize: 48 }}>📦</Text>
              </View>
            )}
            <View style={styles.previewBody}>
              <View style={styles.previewHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.previewTitle, { color: colors.text }]} numberOfLines={2}>
                    {title || 'Untitled Bundle'}
                  </Text>
                  <View style={styles.previewMetaRow}>
                    <Star size={12} color="#F59E0B" fill="#F59E0B" />
                    <Text style={[styles.previewMetaText, { color: colors.textSecondary }]}>5.0 (0)</Text>
                    {location ? (
                      <>
                        <Text style={[styles.previewMetaText, { color: colors.textTertiary }]}>·</Text>
                        <MapPin size={12} color={colors.textTertiary} />
                        <Text style={[styles.previewMetaText, { color: colors.textSecondary }]} numberOfLines={1}>{location}</Text>
                      </>
                    ) : null}
                  </View>
                </View>
                <View style={[styles.previewPriceBadge, { backgroundColor: colors.accent }]}>
                  <Text style={styles.previewPriceText}>${finalPrice || '?'}</Text>
                </View>
              </View>

              <View style={styles.previewItems}>
                <Text style={[styles.previewItemsTitle, { color: colors.textSecondary }]}>
                  {services.length} service{services.length !== 1 ? 's' : ''} included:
                </Text>
                {services.map((s) => (
                  <View key={s.id} style={styles.previewItemRow}>
                    <Text style={styles.previewItemEmoji}>📦</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.previewItemName, { color: colors.text }]} numberOfLines={1}>
                        {s.name.trim() || 'Untitled Service'}
                      </Text>
                      {s.description.trim() ? (
                        <Text style={[styles.previewItemDesc, { color: colors.textTertiary }]} numberOfLines={2}>
                          {s.description.trim()}
                        </Text>
                      ) : null}
                    </View>
                    {s.price > 0 ? (
                      <Text style={[styles.previewItemPrice, { color: colors.accent }]}>${s.price}</Text>
                    ) : null}
                  </View>
                ))}
              </View>

              {tags.length > 0 && (
                <View style={styles.previewTags}>
                  {tags.map((tag) => (
                    <View key={tag} style={[styles.previewTag, { backgroundColor: `${colors.accent}15` }]}>
                      <Text style={[styles.previewTagText, { color: colors.accent }]}>#{tag}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom publish bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12, backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.publishBtn, { backgroundColor: canPublish ? colors.accent : colors.surfaceHighlight }]}
          onPress={handlePublish}
          disabled={!canPublish}
          activeOpacity={0.9}
        >
          <Package size={18} color={canPublish ? '#FFF' : colors.textTertiary} />
          <Text style={[styles.publishBtnText, { color: canPublish ? '#FFF' : colors.textTertiary }]}>
            Publish Bundle
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerBtn: { padding: 8, borderRadius: 20 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', marginLeft: 12 },
  publishBtnSmall: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  publishBtnSmallText: { fontSize: 14, fontWeight: '700' },

  content: { padding: 16 },

  imagePicker: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 4 },
  imagePreview: { position: 'relative' },
  coverImage: { height: 160, width: '100%' },
  videoTile: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#0D0D12' },
  imagePlaceholder: { height: 120, alignItems: 'center', justifyContent: 'center', gap: 6 },
  imageOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  imageOverlayText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  imagePickerText: { fontSize: 14 },

  sectionLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8 },

  input: {
    borderRadius: 14, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 14, fontSize: 16,
  },
  descInput: { minHeight: 72, lineHeight: 20, textAlignVertical: 'top' },

  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  priceWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priceField: { flex: 1, fontSize: 16, fontWeight: '600', padding: 0 },
  priceHint: { fontSize: 12, marginTop: 8 },

  serviceCard: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10, gap: 10 },
  serviceHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  serviceIndex: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  addServiceBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderRadius: 14, paddingVertical: 13, borderStyle: 'dashed',
  },
  addServiceText: { fontSize: 14, fontWeight: '700' },

  categoryRow: { flexDirection: 'row', gap: 8 },
  categoryPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 24, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1.5,
  },
  categoryEmoji: { fontSize: 16 },
  categoryLabel: { fontSize: 13, fontWeight: '600' },

  tagWrap: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingTop: 12,
  },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingBottom: 6 },
  tagPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  tagPillText: { fontSize: 12, fontWeight: '600' },
  tagInput: { fontSize: 15, paddingVertical: 8 },

  previewWrapper: { marginTop: 24 },
  previewCard: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  previewCover: { height: 140, alignItems: 'center', justifyContent: 'center' },
  previewBody: { padding: 14 },
  previewHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  previewTitle: { fontSize: 17, fontWeight: '700' },
  previewMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  previewMetaText: { fontSize: 12 },
  previewPriceBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  previewPriceText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  previewItems: { marginTop: 12, gap: 8 },
  previewItemsTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  previewItemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  previewItemEmoji: { fontSize: 16 },
  previewItemName: { fontSize: 14, fontWeight: '600' },
  previewItemDesc: { fontSize: 12, marginTop: 1, lineHeight: 16 },
  previewItemPrice: { fontSize: 14, fontWeight: '800' },
  previewTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 12 },
  previewTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  previewTagText: { fontSize: 11, fontWeight: '600' },

  bottomBar: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  publishBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16, borderRadius: 16,
  },
  publishBtnText: { fontSize: 16, fontWeight: '700' },
});
