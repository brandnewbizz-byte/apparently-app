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
  Zap,
  X,
  DollarSign,
  Camera,
  Tag,
} from 'lucide-react-native';

import { useTheme } from '@/contexts/ThemeContext';
import { useSkills } from '@/contexts/SkillContext';

// ── Categories ───────────────────────────────────────────────────────

const SKILL_CATEGORIES = [
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

// ── Emojis ────────────────────────────────────────────────────────────

const EMOJI_GRID = [
  '🧹', '👨‍🍳', '🐕', '📸', '📚', '💪', '🎨', '💻',
  '🧘', '🌲', '🎉', '🚗', '💄', '🔧', '🏠', '🍽️',
  '🐾', '🎵', '📱', '✂️', '🪴', '🧺', '🎂', '🗣️',
  '🏋️', '🎯', '🧵', '📊', '🎬', '🥇', '🛋️', '💡',
];

export default function SkillBuilderScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { createSkill } = useSkills();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('🛠️');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [availableCount, setAvailableCount] = useState('20');
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const finalPrice = price ? parseFloat(price) : 0;

  const pickImage = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [16, 9],
    });
    if (!result.canceled && result.assets?.[0]) {
      setCoverImage(result.assets[0].uri);
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

  const handlePublish = () => {
    if (!canPublish) {
      Alert.alert('Missing Info', 'Add a title and price to publish your skill.');
      return;
    }

    const result = createSkill({
      title: title.trim(),
      description: description.trim(),
      icon,
      price: finalPrice,
      originalPrice: 0,
      imageUrl: coverImage || '',
      category: category || 'other',
      tags: tags.length ? tags : ['Skill'],
      creator: { name: 'You', avatar: '', rating: 5.0, reviews: 0 },
      availableCount: parseInt(availableCount, 10) || 20,
      providerLink: undefined,
      deliveryNotes: undefined,
      resourcesNeeded: undefined,
      expiresIn: 86400, // 24h default
    });

    if (!result.success) {
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Post a Skill</Text>
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
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
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
              <Image source={{ uri: coverImage }} style={styles.coverImage} />
              <View style={[styles.imageOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                <Camera size={14} color="#FFF" />
                <Text style={styles.imageOverlayText}>Change</Text>
              </View>
            </View>
          ) : (
            <View style={styles.imagePlaceholder}>
              <Camera size={28} color={colors.textTertiary} />
              <Text style={[styles.imagePickerText, { color: colors.textSecondary }]}>Add Cover Image</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Icon + Title */}
        <View style={styles.iconRow}>
          <TouchableOpacity
            style={[styles.iconPicker, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setShowEmojiPicker(!showEmojiPicker)}
            activeOpacity={0.7}
          >
            <Text style={styles.iconPreview}>{icon}</Text>
          </TouchableOpacity>
          <TextInput
            style={[styles.titleInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            placeholder="What's your skill called?"
            placeholderTextColor={colors.textTertiary}
            value={title}
            onChangeText={setTitle}
            maxLength={80}
          />
        </View>

        {showEmojiPicker && (
          <View style={[styles.emojiGrid, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {EMOJI_GRID.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={[
                  styles.emojiGridItem,
                  icon === emoji && { backgroundColor: `${colors.accent}30`, borderRadius: 12 },
                ]}
                onPress={() => { setIcon(emoji); setShowEmojiPicker(false); }}
              >
                <Text style={{ fontSize: 24 }}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Category */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
          {SKILL_CATEGORIES.map((cat) => {
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
                <Text style={[styles.categoryLabel, { color: selected ? colors.accent : colors.text }]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Description */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Description</Text>
        <TextInput
          style={[styles.descInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="Describe what you offer..."
          placeholderTextColor={colors.textTertiary}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        {/* Price + Available Grabs */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Price ($)</Text>
            <View style={[styles.priceInput, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <DollarSign size={18} color={colors.textSecondary} />
              <TextInput
                style={[styles.priceField, { color: colors.text }]}
                placeholder="Set your rate"
                placeholderTextColor={colors.textTertiary}
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Available Grabs</Text>
            <View style={[styles.priceInput, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={{ color: colors.textSecondary, fontSize: 15, marginRight: 4 }}>×</Text>
              <TextInput
                style={[styles.priceField, { color: colors.text }]}
                placeholder="20"
                placeholderTextColor={colors.textTertiary}
                value={availableCount}
                onChangeText={setAvailableCount}
                keyboardType="number-pad"
              />
            </View>
          </View>
        </View>

        {/* Tags */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Tags</Text>
        <View style={[styles.iconInput, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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

        {/* Live Preview */}
        {title.trim() && (
          <View style={styles.previewWrapper}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Preview</Text>
            <View style={[styles.previewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {coverImage ? (
                <Image source={{ uri: coverImage }} style={styles.previewCover} />
              ) : (
                <View style={[styles.previewCover, { backgroundColor: colors.surfaceHighlight }]}>
                  <Text style={{ fontSize: 48 }}>{icon}</Text>
                </View>
              )}
              <View style={styles.previewBody}>
                <View style={styles.previewHeader}>
                  <Text style={styles.previewIcon}>{icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.previewTitle, { color: colors.text }]}>{title}</Text>
                    {description ? (
                      <Text style={[styles.previewDesc, { color: colors.textSecondary }]} numberOfLines={2}>{description}</Text>
                    ) : null}
                  </View>
                </View>
                <View style={styles.previewFooter}>
                  <View style={[styles.previewPriceBadge, { backgroundColor: colors.accent }]}>
                    <Text style={styles.previewPriceText}>${finalPrice || '?'}</Text>
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
          </View>
        )}
      </ScrollView>

      {/* Bottom publish bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12, backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.publishBtn, { backgroundColor: canPublish ? colors.accent : colors.surfaceHighlight }]}
          onPress={handlePublish}
          disabled={!canPublish}
          activeOpacity={0.9}
        >
          <Zap size={18} color={canPublish ? '#FFF' : colors.textTertiary} />
          <Text style={[styles.publishBtnText, { color: canPublish ? '#FFF' : colors.textTertiary }]}>
            Publish Skill
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
  publishBtnSmall: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  publishBtnSmallText: { fontSize: 14, fontWeight: '700' },

  content: { padding: 16 },

  // Image
  imagePicker: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 16 },
  imagePreview: { position: 'relative' },
  coverImage: { height: 160, width: '100%' },
  imagePlaceholder: { height: 120, alignItems: 'center', justifyContent: 'center', gap: 6 },
  imageOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  imageOverlayText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  imagePickerText: { fontSize: 14 },

  // Icon
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  iconPicker: { borderRadius: 14, borderWidth: 1, width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  iconPreview: { fontSize: 28 },
  emojiGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    borderRadius: 14, borderWidth: 1, padding: 10, marginBottom: 12,
  },
  emojiGridItem: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  // Title
  titleInput: {
    flex: 1, borderRadius: 14, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, fontWeight: '600',
  },

  // Sections
  sectionLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8 },

  // Categories (horizontal scroll)
  categoryRow: { flexDirection: 'row', gap: 8 },
  categoryPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 24, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1.5,
  },
  categoryEmoji: { fontSize: 16 },
  categoryLabel: { fontSize: 13, fontWeight: '600' },

  // Description
  descInput: {
    borderRadius: 14, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, minHeight: 90, lineHeight: 20,
  },

  // Price
  priceInput: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12,
  },
  priceField: { flex: 1, fontSize: 18, fontWeight: '700' },

  // Tags
  iconInput: {
    flexDirection: 'row', alignItems: 'flex-start',
    borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingTop: 12, gap: 10,
  },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingBottom: 6 },
  tagPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  tagPillText: { fontSize: 12, fontWeight: '600' },
  tagInput: { fontSize: 15, paddingVertical: 8 },

  // Preview
  previewWrapper: { marginTop: 24 },
  previewCard: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  previewCover: { height: 140, alignItems: 'center', justifyContent: 'center' },
  previewBody: { padding: 14 },
  previewHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  previewIcon: { fontSize: 28 },
  previewTitle: { fontSize: 18, fontWeight: '700' },
  previewDesc: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  previewFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  previewPriceBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  previewPriceText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  previewTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, flex: 1 },
  previewTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  previewTagText: { fontSize: 11, fontWeight: '600' },

  // Bottom bar
  bottomBar: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  publishBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16, borderRadius: 16,
  },
  publishBtnText: { fontSize: 16, fontWeight: '700' },
});
