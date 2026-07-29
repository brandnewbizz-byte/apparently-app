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
  ChevronRight,
  Zap,
  Plus,
  X,
  DollarSign,
  Camera,
  Tag,
  Check,
  Star,
  Link,
  FileText,
  Wrench,
} from 'lucide-react-native';

import { useTheme } from '@/contexts/ThemeContext';
import { useSkills } from '@/contexts/SkillContext';

// ── Category grid (same categories, skill-flavored) ────────────────────

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

// ── Emoji quick-select grid ─────────────────────────────────────────────

const EMOJI_GRID = [
  '🧹', '👨‍🍳', '🐕', '📸', '📚', '💪', '🎨', '💻',
  '🧘', '🌲', '🎉', '🚗', '💄', '🔧', '🏠', '🍽️',
  '🐾', '🎵', '📱', '✂️', '🪴', '🧺', '🎂', '🗣️',
  '🏋️', '🎯', '🧵', '📊', '🎬', '🥇', '🛋️', '💡',
];

type Step = 'info' | 'details' | 'preview';

export default function SkillBuilderScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { createSkill } = useSkills();

  const [step, setStep] = useState<Step>('info');

  // Step 1 — Info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('🛠️');
  const [category, setCategory] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Step 2 — Details
  const [price, setPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [availableCount, setAvailableCount] = useState('20');
  const [providerLink, setProviderLink] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [resourcesNeeded, setResourcesNeeded] = useState('');
  const [expiresIn, setExpiresIn] = useState('24');

  const finalPrice = price ? parseFloat(price) : 0;
  const finalOriginalPrice = originalPrice ? parseFloat(originalPrice) : (finalPrice > 0 ? finalPrice * 1.3 : 0);

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

  const canGoNext = () => {
    if (step === 'info') return title.trim() && icon;
    if (step === 'details') return finalPrice > 0;
    return true;
  };

  const handleNext = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step === 'info') setStep('details');
    else if (step === 'details') setStep('preview');
  };

  const handleBack = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step === 'details') setStep('info');
    else if (step === 'preview') setStep('details');
    else router.back();
  };

  const handlePublish = () => {
    if (!title.trim() || finalPrice <= 0) {
      Alert.alert('Missing Info', 'Please add a title and price before publishing.');
      return;
    }

    const result = createSkill({
      title: title.trim(),
      description: description.trim(),
      icon,
      price: finalPrice,
      originalPrice: Math.round(finalOriginalPrice),
      imageUrl: coverImage || '',
      category: category || 'other',
      tags: tags.length ? tags : ['Skill'],
      creator: {
        name: 'You',
        avatar: '',
        rating: 5.0,
        reviews: 0,
      },
      availableCount: parseInt(availableCount, 10) || 20,
      providerLink: providerLink.trim() || undefined,
      deliveryNotes: deliveryNotes.trim() || undefined,
      resourcesNeeded: resourcesNeeded.trim() || undefined,
      expiresIn: (parseInt(expiresIn, 10) || 24) * 3600,
    });

    if (!result.success) {
      Alert.alert('Limit Reached', result.error);
      return;
    }

    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const StepIndicator = () => (
    <View style={styles.stepIndicator}>
      <View style={[styles.stepDot, step !== 'preview' && { backgroundColor: colors.accent }]}>
        <Text style={[styles.stepDotText, { color: step === 'info' ? '#FFF' : colors.textSecondary }]}>1</Text>
      </View>
      <View style={[styles.stepLine, { backgroundColor: step !== 'info' ? colors.accent : colors.border }]} />
      <View style={[styles.stepDot, step !== 'info' && { backgroundColor: colors.accent }]}>
        <Text style={[styles.stepDotText, { color: step === 'details' ? '#FFF' : colors.textSecondary }]}>2</Text>
      </View>
      <View style={[styles.stepLine, { backgroundColor: step === 'preview' ? colors.accent : colors.border }]} />
      <View style={[styles.stepDot, step === 'preview' && { backgroundColor: colors.accent }]}>
        <Text style={[styles.stepDotText, { color: step === 'preview' ? '#FFF' : colors.textSecondary }]}>3</Text>
      </View>
    </View>
  );

  const formatExpiry = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
    if (hrs > 0) return `${hrs}h`;
    return `${mins}m`;
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={handleBack} style={[styles.headerBtn, { backgroundColor: colors.surface }]}>
          <ChevronLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Post a Skill</Text>
        <View style={styles.headerRight}>
          <StepIndicator />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ═══ STEP 1: Info ═══ */}
        {step === 'info' && (
          <>
            <Text style={[styles.stepTitle, { color: colors.text }]}>What's your skill?</Text>
            <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
              Give it a name, pick an emoji, and choose a category
            </Text>

            {/* Icon Picker */}
            <TouchableOpacity
              style={[styles.iconPicker, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setShowEmojiPicker(!showEmojiPicker)}
              activeOpacity={0.7}
            >
              <Text style={styles.iconPreview}>{icon}</Text>
              <Text style={[styles.iconPickerHint, { color: colors.textSecondary }]}>Tap to change icon</Text>
            </TouchableOpacity>

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
            <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 16, marginBottom: 8 }]}>
              Category
            </Text>
            <View style={styles.categoryGrid}>
              {SKILL_CATEGORIES.map((cat) => {
                const isSelected = category === cat.key;
                return (
                  <TouchableOpacity
                    key={cat.key}
                    style={[
                      styles.categoryCard,
                      {
                        backgroundColor: isSelected ? `${colors.accent}20` : colors.surface,
                        borderColor: isSelected ? colors.accent : colors.border,
                      },
                    ]}
                    onPress={() => setCategory(cat.key)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.categoryEmoji}>{cat.icon}</Text>
                    <Text style={[styles.categoryLabel, { color: isSelected ? colors.accent : colors.text }]} numberOfLines={1}>
                      {cat.label}
                    </Text>
                    {isSelected && (
                      <View style={[styles.selectedBadge, { backgroundColor: colors.accent }]}>
                        <Check size={10} color="#FFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Title */}
            <TextInput
              style={[styles.input, styles.titleInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="Skill title (e.g. Professional Dog Walking)"
              placeholderTextColor={colors.textTertiary}
              value={title}
              onChangeText={setTitle}
              maxLength={80}
            />

            {/* Description */}
            <TextInput
              style={[styles.input, styles.descInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="Describe what you offer..."
              placeholderTextColor={colors.textTertiary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </>
        )}

        {/* ═══ STEP 2: Details ═══ */}
        {step === 'details' && (
          <>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Set Your Price & Details</Text>
            <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
              Add pricing, cover image, and delivery info
            </Text>

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
                    <Camera size={16} color="#FFF" />
                    <Text style={styles.imageOverlayText}>Change Cover</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Camera size={32} color={colors.textTertiary} />
                  <Text style={[styles.imagePickerText, { color: colors.textSecondary }]}>Add Cover Image</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Price Fields */}
            <View style={styles.priceRow}>
              <View style={styles.priceField}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Your Price</Text>
                <View>
                  <TextInput
                    style={[styles.input, styles.priceInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                    placeholder="0"
                    placeholderTextColor={colors.textTertiary}
                    value={price}
                    onChangeText={setPrice}
                    keyboardType="decimal-pad"
                  />
                  <DollarSign size={16} color={colors.textTertiary} style={{ position: 'absolute', left: 12, top: 14 }} />
                </View>
              </View>
              <View style={styles.priceField}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Original (strikethrough)</Text>
                <View>
                  <TextInput
                    style={[styles.input, styles.priceInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                    placeholder={finalPrice > 0 ? String(Math.round(finalPrice * 1.3)) : '0'}
                    placeholderTextColor={colors.textTertiary}
                    value={originalPrice}
                    onChangeText={setOriginalPrice}
                    keyboardType="decimal-pad"
                  />
                  <DollarSign size={16} color={colors.textTertiary} style={{ position: 'absolute', left: 12, top: 14 }} />
                </View>
              </View>
            </View>

            {/* Available Count + Expires In */}
            <View style={styles.priceRow}>
              <View style={styles.priceField}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Available</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  placeholder="20"
                  placeholderTextColor={colors.textTertiary}
                  value={availableCount}
                  onChangeText={setAvailableCount}
                  keyboardType="number-pad"
                />
              </View>
              <View style={styles.priceField}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Expires (hours)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  placeholder="24"
                  placeholderTextColor={colors.textTertiary}
                  value={expiresIn}
                  onChangeText={setExpiresIn}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            {/* Provider Link */}
            <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 8 }]}>Provider Link (optional)</Text>
            <View style={[styles.iconInput, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Link size={18} color={colors.textSecondary} />
              <TextInput
                style={[styles.iconInputField, { color: colors.text }]}
                placeholder="URL to the service/booking page"
                placeholderTextColor={colors.textTertiary}
                value={providerLink}
                onChangeText={setProviderLink}
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>

            {/* Delivery Notes */}
            <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 8 }]}>Delivery Notes</Text>
            <TextInput
              style={[styles.input, styles.descInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="How you'll deliver this — arrival time, what you bring, steps to follow"
              placeholderTextColor={colors.textTertiary}
              value={deliveryNotes}
              onChangeText={setDeliveryNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            {/* Resources Needed */}
            <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 8 }]}>Resources Needed</Text>
            <TextInput
              style={[styles.input, styles.descInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="Tools, contacts, equipment you'll need"
              placeholderTextColor={colors.textTertiary}
              value={resourcesNeeded}
              onChangeText={setResourcesNeeded}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />

            {/* Tags */}
            <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 12 }]}>Tags</Text>
            <View style={[styles.iconInput, { backgroundColor: colors.surface, borderColor: colors.border, alignItems: 'flex-start' }]}>
              <Tag size={18} color={colors.textSecondary} style={{ marginTop: 12 }} />
              <View style={{ flex: 1 }}>
                <View style={styles.tagsRow}>
                  {tags.map((tag) => (
                    <View key={tag} style={[styles.tagPill, { backgroundColor: `${colors.accent}20` }]}>
                      <Text style={[styles.tagPillText, { color: colors.accent }]}>#{tag}</Text>
                      <TouchableOpacity onPress={() => removeTag(tag)}>
                        <X size={12} color={colors.accent} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
                <TextInput
                  style={[styles.tagInput, { color: colors.text }]}
                  placeholder="Add tags (max 5)"
                  placeholderTextColor={colors.textTertiary}
                  value={tagInput}
                  onChangeText={setTagInput}
                  onSubmitEditing={addTag}
                  returnKeyType="done"
                />
              </View>
            </View>
          </>
        )}

        {/* ═══ STEP 3: Preview ═══ */}
        {step === 'preview' && (
          <>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Preview & Publish</Text>
            <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
              Here's how your skill will appear
            </Text>

            <View style={[styles.previewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {/* Cover */}
              <View style={styles.previewCoverWrapper}>
                {coverImage ? (
                  <Image source={{ uri: coverImage }} style={styles.previewCoverImage} />
                ) : (
                  <View style={[styles.previewCover, { backgroundColor: colors.surfaceHighlight }]}>
                    <Text style={{ fontSize: 56 }}>{icon}</Text>
                  </View>
                )}
                <View style={[styles.previewTimer, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
                  <Text style={styles.previewTimerText}>{formatExpiry((parseInt(expiresIn, 10) || 24) * 3600)}</Text>
                </View>
              </View>

              <View style={styles.previewBody}>
                <View style={styles.previewHeader}>
                  <Text style={styles.previewIcon}>{icon}</Text>
                  <Text style={[styles.previewTitle, { color: colors.text }]}>{title || 'Untitled Skill'}</Text>
                </View>

                <View style={styles.previewPriceRow}>
                  <View style={[styles.previewPriceBadge, { backgroundColor: colors.accent }]}>
                    <Text style={styles.previewPriceText}>${finalPrice}</Text>
                  </View>
                  {finalOriginalPrice > finalPrice && (
                    <Text style={[styles.previewOriginalPrice, { color: colors.textTertiary }]}>
                      ${Math.round(finalOriginalPrice)}
                    </Text>
                  )}
                </View>

                <Text style={[styles.previewDesc, { color: colors.textSecondary }]} numberOfLines={4}>
                  {description || 'No description'}
                </Text>

                {/* Delivery Info Preview */}
                {(providerLink || deliveryNotes || resourcesNeeded) ? (
                  <View style={[styles.previewSection, { borderTopColor: colors.border }]}>
                    <Text style={[styles.previewSectionTitle, { color: colors.textSecondary }]}>Delivery Info</Text>
                    {providerLink ? (
                      <View style={styles.previewDetailRow}>
                        <Link size={13} color={colors.textTertiary} />
                        <Text style={[styles.previewDetailText, { color: colors.accent }]} numberOfLines={1}>{providerLink}</Text>
                      </View>
                    ) : null}
                    {deliveryNotes ? (
                      <View style={styles.previewDetailRow}>
                        <FileText size={13} color={colors.textTertiary} />
                        <Text style={[styles.previewDetailText, { color: colors.textSecondary }]} numberOfLines={2}>📋 {deliveryNotes}</Text>
                      </View>
                    ) : null}
                    {resourcesNeeded ? (
                      <View style={styles.previewDetailRow}>
                        <Wrench size={13} color={colors.textTertiary} />
                        <Text style={[styles.previewDetailText, { color: colors.textSecondary }]} numberOfLines={2}>🔧 {resourcesNeeded}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {/* Details */}
                <View style={styles.previewDetails}>
                  <View style={styles.previewDetailRow}>
                    <Zap size={14} color={colors.textTertiary} />
                    <Text style={[styles.previewDetailText, { color: colors.textSecondary }]}>
                      {parseInt(availableCount, 10) || 20} available
                    </Text>
                  </View>
                </View>

                {/* Tags */}
                {tags.length > 0 && (
                  <View style={styles.previewTags}>
                    {tags.map((tag) => (
                      <View key={tag} style={[styles.previewTag, { backgroundColor: `${colors.accent}15` }]}>
                        <Text style={[styles.previewTagText, { color: colors.accent }]}>#{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Creator */}
                <View style={[styles.previewCreator, { borderTopColor: colors.border }]}>
                  <View style={styles.previewCreatorInfo}>
                    <View style={[styles.previewCreatorAvatar, { backgroundColor: colors.surfaceHighlight }]}>
                      <Zap size={16} color={colors.textSecondary} />
                    </View>
                    <View>
                      <Text style={[styles.previewCreatorName, { color: colors.text }]}>You</Text>
                      <View style={styles.previewCreatorRating}>
                        <Star size={12} color="#F59E0B" fill="#F59E0B" />
                        <Text style={[styles.previewCreatorRatingText, { color: colors.textSecondary }]}>5.0 (0)</Text>
                      </View>
                    </View>
                  </View>
                  <View style={[styles.previewStatusBadge, { backgroundColor: '#10B98120' }]}>
                    <Text style={{ color: '#10B981', fontSize: 11, fontWeight: '600' }}>Available</Text>
                  </View>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* Bottom Bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12, backgroundColor: colors.background, borderTopColor: colors.border }]}>
        {step === 'preview' ? (
          <TouchableOpacity
            style={[styles.publishBtn, { backgroundColor: colors.accent }]}
            onPress={handlePublish}
            activeOpacity={0.9}
          >
            <Zap size={18} color="#FFF" />
            <Text style={styles.publishBtnText}>Publish Skill</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: canGoNext() ? colors.accent : colors.surfaceHighlight }]}
            onPress={handleNext}
            disabled={!canGoNext()}
            activeOpacity={0.9}
          >
            <Text style={[styles.nextBtnText, { color: canGoNext() ? '#FFF' : colors.textTertiary }]}>
              {step === 'info' ? 'Continue to Details' : 'Preview Skill'}
            </Text>
            <ChevronRight size={18} color={canGoNext() ? '#FFF' : colors.textTertiary} />
          </TouchableOpacity>
        )}
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
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  stepIndicator: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotText: { fontSize: 12, fontWeight: '700' },
  stepLine: { width: 24, height: 2, borderRadius: 1 },
  content: { padding: 20 },
  stepTitle: { fontSize: 24, fontWeight: '800', marginBottom: 4 },
  stepSubtitle: { fontSize: 14, marginBottom: 20 },

  // Icon picker
  iconPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  iconPreview: { fontSize: 36 },
  iconPickerHint: { fontSize: 14, fontWeight: '500' },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },
  emojiGridItem: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Categories
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  categoryCard: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  categoryEmoji: { fontSize: 22, marginBottom: 2 },
  categoryLabel: { fontSize: 10, fontWeight: '600', textAlign: 'center' },
  selectedBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Inputs
  input: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  fieldLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  titleInput: { fontSize: 18, fontWeight: '600', marginBottom: 12, marginTop: 4 },
  descInput: { minHeight: 80, marginBottom: 8 },

  // Price
  priceRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  priceField: { flex: 1, position: 'relative' },
  priceInput: { paddingLeft: 30 },

  // Image
  imagePicker: { borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 16 },
  imagePreview: { position: 'relative' },
  coverImage: { height: 180, width: '100%', borderRadius: 14 },
  imagePlaceholder: { height: 180, alignItems: 'center', justifyContent: 'center', gap: 8 },
  imageOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  imageOverlayText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  imagePickerText: { fontSize: 14 },

  // Icon inputs
  iconInput: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, marginBottom: 12, gap: 10 },
  iconInputField: { flex: 1, fontSize: 15, paddingVertical: 12 },

  // Tags
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 10 },
  tagPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  tagPillText: { fontSize: 12, fontWeight: '600' },
  tagInput: { fontSize: 15, paddingVertical: 10 },

  // Preview
  previewCard: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  previewCoverWrapper: { position: 'relative' },
  previewCover: { height: 180, alignItems: 'center', justifyContent: 'center' },
  previewCoverImage: { width: '100%', height: 180 },
  previewTimer: { position: 'absolute', top: 12, right: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  previewTimerText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  previewBody: { padding: 18 },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  previewIcon: { fontSize: 28 },
  previewTitle: { fontSize: 20, fontWeight: '700', flex: 1 },
  previewPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  previewPriceBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  previewPriceText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  previewOriginalPrice: { fontSize: 14, textDecorationLine: 'line-through' },
  previewDesc: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  previewSection: { borderTopWidth: 1, paddingTop: 12, marginBottom: 8 },
  previewSectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  previewDetails: { marginBottom: 8, gap: 6 },
  previewDetailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 4 },
  previewDetailText: { fontSize: 13, flex: 1, lineHeight: 17 },
  previewTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  previewTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  previewTagText: { fontSize: 11, fontWeight: '600' },
  previewCreator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, borderTopWidth: 1 },
  previewCreatorInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  previewCreatorAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  previewCreatorName: { fontSize: 14, fontWeight: '600' },
  previewCreatorRating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  previewCreatorRatingText: { fontSize: 12 },
  previewStatusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },

  // Bottom bar
  bottomBar: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1 },
  nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 16 },
  nextBtnText: { fontSize: 16, fontWeight: '700' },
  publishBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 16 },
  publishBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
