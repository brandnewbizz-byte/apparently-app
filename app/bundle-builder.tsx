import React, { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
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
  Package,
  Plus,
  X,
  DollarSign,
  MapPin,
  Calendar,
  Tag,
  Camera,
  Star,
  Trash2,
  GripVertical,
} from 'lucide-react-native';

import { useTheme } from '@/contexts/ThemeContext';
import { useBundles, type BundleItem } from '@/contexts/BundleContext';

type Step = 'services' | 'details' | 'preview';

let serviceIdCounter = 0;

interface ServiceDraft {
  id: string;
  name: string;
  description: string;
  price: number;
  provider: string;
  providerLink: string;
  deliveryNotes: string;
  resourcesNeeded: string;
}

export default function BundleBuilderScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { createBundle } = useBundles();
  const { user } = useAuth();

  const [step, setStep] = useState<Step>('services');

  // Step 1 state — free-form service entries
  const [selectedServices, setSelectedServices] = useState<ServiceDraft[]>([
    { id: `svc-${++serviceIdCounter}`, name: '', description: '', price: 0, provider: '', providerLink: '', deliveryNotes: '', resourcesNeeded: '' },
  ]);

  // Step 2 state
  const [title, setTitle] = useState('');
  const [bundlePrice, setBundlePrice] = useState('');
  const [location, setLocation] = useState('');
  const [dateRange, setDateRange] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [availableCount, setAvailableCount] = useState('10');
  const [plannerNotes, setPlannerNotes] = useState('');

  const totalItemsPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const finalPrice = bundlePrice ? parseFloat(bundlePrice) : totalItemsPrice;

  const addServiceDraft = useCallback(() => {
    const id = `svc-${++serviceIdCounter}`;
    setSelectedServices((prev) => [
      ...prev,
      { id, name: '', description: '', price: 0, provider: '', providerLink: '', deliveryNotes: '', resourcesNeeded: '' },
    ]);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const updateServiceField = useCallback((id: string, field: keyof ServiceDraft, value: string) => {
    setSelectedServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: field === 'price' ? parseFloat(value) || 0 : value } : s))
    );
  }, []);

  const removeService = useCallback((id: string) => {
    setSelectedServices((prev) => {
      if (prev.length <= 1) return prev; // keep at least one
      return prev.filter((s) => s.id !== id);
    });
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

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
    if (step === 'services') return selectedServices.length > 0;
    if (step === 'details') return title.trim() && (finalPrice > 0);
    return true;
  };

  const handleNext = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step === 'services') setStep('details');
    else if (step === 'details') setStep('preview');
  };

  const handleBack = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step === 'details') setStep('services');
    else if (step === 'preview') setStep('details');
    else router.back();
  };

  const handlePublish = () => {
    if (!title.trim() || finalPrice <= 0) {
      Alert.alert('Missing Info', 'Please add a title and price before publishing.');
      return;
    }

    const items: BundleItem[] = selectedServices.map((s, i) => ({
      id: `item-${Date.now()}-${i}`,
      name: s.name || 'Untitled Service',
      description: s.description || undefined,
      category: 'service',
      provider: s.provider || 'You',
      providerAvatar: '',
      providerLink: s.providerLink || undefined,
      price: s.price || 0,
      icon: '📦',
      deliveryNotes: s.deliveryNotes || undefined,
      resourcesNeeded: s.resourcesNeeded || undefined,
    }));

    // Build bundle description from first service's description or item names
    const bundleDescription = selectedServices[0]?.description?.trim()
      || selectedServices.map(s => s.name).filter(Boolean).join(', ')
      || `${items.length} service${items.length !== 1 ? 's' : ''}`;

    const result = createBundle({
      title: title.trim(),
      description: bundleDescription,
      price: finalPrice,
      items,
      imageUrl: coverImage || '',
      category: 'service',
      location: location.trim(),
      dateRange: dateRange.trim(),
      tags: tags.length ? tags : ['Bundle'],
      creator: {
        name: 'You',
        avatar: '',
        rating: 5.0,
        reviews: 0,
      },
      creatorId: user?.id || '',
      availableCount: parseInt(availableCount, 10) || 10,
      plannerNotes: plannerNotes.trim() || undefined,
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
      <View style={[styles.stepDot, (step === 'services' || step === 'details' || step === 'preview') && { backgroundColor: colors.accent }]}>
        <Text style={[styles.stepDotText, { color: step === 'services' ? '#FFF' : colors.textSecondary }]}>1</Text>
      </View>
      <View style={[styles.stepLine, { backgroundColor: step !== 'services' ? colors.accent : colors.border }]} />
      <View style={[styles.stepDot, (step === 'details' || step === 'preview') && { backgroundColor: colors.accent }]}>
        <Text style={[styles.stepDotText, { color: step === 'details' ? '#FFF' : colors.textSecondary }]}>2</Text>
      </View>
      <View style={[styles.stepLine, { backgroundColor: step === 'preview' ? colors.accent : colors.border }]} />
      <View style={[styles.stepDot, step === 'preview' && { backgroundColor: colors.accent }]}>
        <Text style={[styles.stepDotText, { color: step === 'preview' ? '#FFF' : colors.textSecondary }]}>3</Text>
      </View>
    </View>
  );

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
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Build Bundle
        </Text>
        <View style={styles.headerRight}>
          <StepIndicator />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {step === 'services' && (
          <>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Add Services</Text>
            <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
              Write in each service you're bundling — name it, describe it, price it
            </Text>

            {/* Service Cards */}
            {selectedServices.map((service, idx) => (
              <View key={service.id} style={[styles.serviceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.serviceCardHeader}>
                  <View style={styles.serviceCardHandle}>
                    <GripVertical size={14} color={colors.textTertiary} />
                    <Text style={[styles.serviceCardIndex, { color: colors.textTertiary }]}>
                      Service {idx + 1}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => removeService(service.id)}
                    disabled={selectedServices.length <= 1}
                    style={[styles.removeBtn, selectedServices.length <= 1 && { opacity: 0.3 }]}
                  >
                    <Trash2 size={16} color={colors.error || '#EF4444'} />
                  </TouchableOpacity>
                </View>

                {/* Service Name — free text */}
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Service Name</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  placeholder='e.g. "Website Redesign" or "Plumbing Inspection"'
                  placeholderTextColor={colors.textTertiary}
                  value={service.name}
                  onChangeText={(v) => updateServiceField(service.id, 'name', v)}
                />

                {/* Per-item Description — THE MAIN NEW FEATURE */}
                <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 10 }]}>
                  Description
                </Text>
                <TextInput
                  style={[styles.input, styles.descInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  placeholder="What this service includes, what's delivered, timeline, etc."
                  placeholderTextColor={colors.textTertiary}
                  value={service.description}
                  onChangeText={(v) => updateServiceField(service.id, 'description', v)}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />

                {/* Price + Provider row */}
                <View style={styles.serviceRow}>
                  <View style={styles.serviceRowField}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Price</Text>
                    <View>
                      <TextInput
                        style={[styles.input, styles.priceInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                        placeholder="0"
                        placeholderTextColor={colors.textTertiary}
                        value={service.price > 0 ? String(service.price) : ''}
                        onChangeText={(v) => updateServiceField(service.id, 'price', v)}
                        keyboardType="decimal-pad"
                      />
                      <DollarSign size={14} color={colors.textTertiary} style={{ position: 'absolute', left: 12, top: 13 }} />
                    </View>
                  </View>
                  <View style={[styles.serviceRowField, { flex: 1 }]}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Provider (optional)</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                      placeholder="Who's fulfilling this?"
                      placeholderTextColor={colors.textTertiary}
                      value={service.provider}
                      onChangeText={(v) => updateServiceField(service.id, 'provider', v)}
                    />
                  </View>
                </View>

                {/* Provider Link */}
                <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 10 }]}>Provider Link (optional)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  placeholder="URL for booking or delivery"
                  placeholderTextColor={colors.textTertiary}
                  value={service.providerLink}
                  onChangeText={(v) => updateServiceField(service.id, 'providerLink', v)}
                  autoCapitalize="none"
                  keyboardType="url"
                />

                {/* Delivery Notes */}
                <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 10 }]}>Delivery Notes (optional)</Text>
                <TextInput
                  style={[styles.input, styles.descInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  placeholder="What's needed to fulfill this service?"
                  placeholderTextColor={colors.textTertiary}
                  value={service.deliveryNotes}
                  onChangeText={(v) => updateServiceField(service.id, 'deliveryNotes', v)}
                  multiline
                  numberOfLines={2}
                  textAlignVertical="top"
                />

                {/* Resources Needed */}
                <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 10 }]}>Resources Needed (optional)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  placeholder="Tools, contacts, materials required"
                  placeholderTextColor={colors.textTertiary}
                  value={service.resourcesNeeded}
                  onChangeText={(v) => updateServiceField(service.id, 'resourcesNeeded', v)}
                />
              </View>
            ))}

            {/* Add Another Service button */}
            <TouchableOpacity
              style={[styles.addServiceBtn, { borderColor: colors.accent }]}
              onPress={addServiceDraft}
              activeOpacity={0.7}
            >
              <Plus size={18} color={colors.accent} />
              <Text style={[styles.addServiceBtnText, { color: colors.accent }]}>
                Add Another Service
              </Text>
            </TouchableOpacity>

            {/* Total */}
            <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>
                {selectedServices.length} service{selectedServices.length !== 1 ? 's' : ''} — items total
              </Text>
              <Text style={[styles.totalValue, { color: colors.accent }]}>${totalItemsPrice}</Text>
            </View>
          </>
        )}

        {step === 'details' && (
          <>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Bundle Details</Text>
            <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
              Give your bundle a title, cover image, and price
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

            {/* Title */}
            <TextInput
              style={[styles.input, styles.titleInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="Bundle Title"
              placeholderTextColor={colors.textTertiary}
              value={title}
              onChangeText={setTitle}
              maxLength={80}
            />

            {/* Bundle Price */}
            <View style={styles.fieldRow}>
              <View style={[styles.fieldHalf, styles.priceField]}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Bundle Price</Text>
                <View>
                  <TextInput
                    style={[styles.input, styles.priceInputFull, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                    placeholder="0"
                    placeholderTextColor={colors.textTertiary}
                    value={bundlePrice}
                    onChangeText={setBundlePrice}
                    keyboardType="decimal-pad"
                  />
                  <DollarSign size={16} color={colors.textTertiary} style={{ position: 'absolute', left: 12, top: 14 }} />
                </View>
              </View>
              <View style={styles.fieldHalf}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Available</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  placeholder="10"
                  placeholderTextColor={colors.textTertiary}
                  value={availableCount}
                  onChangeText={setAvailableCount}
                  keyboardType="number-pad"
                />
              </View>
            </View>
            <Text style={[styles.priceHint, { color: colors.textTertiary }]}>
              Items sum: ${totalItemsPrice} — you can set a different bundle price
            </Text>

            {/* Location */}
            <View style={[styles.iconInput, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <MapPin size={18} color={colors.textSecondary} />
              <TextInput
                style={[styles.iconInputField, { color: colors.text }]}
                placeholder="Location"
                placeholderTextColor={colors.textTertiary}
                value={location}
                onChangeText={setLocation}
              />
            </View>

            {/* Date Range */}
            <View style={[styles.iconInput, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Calendar size={18} color={colors.textSecondary} />
              <TextInput
                style={[styles.iconInputField, { color: colors.text }]}
                placeholder="Date range (e.g. Weekends)"
                placeholderTextColor={colors.textTertiary}
                value={dateRange}
                onChangeText={setDateRange}
              />
            </View>

            {/* Tags */}
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

            {/* Planner Notes */}
            <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 20, marginBottom: 8 }]}>
              Planner Notes (private)
            </Text>
            <TextInput
              style={[styles.input, styles.descInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="Links, contacts, instructions — everything you'll need to deliver this bundle smoothly"
              placeholderTextColor={colors.textTertiary}
              value={plannerNotes}
              onChangeText={setPlannerNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </>
        )}

        {step === 'preview' && (
          <>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Preview & Publish</Text>
            <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
              Here's how your bundle will appear
            </Text>

            {/* Preview Card */}
            <View style={[styles.previewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {/* Cover */}
              <View style={[styles.previewCover, { backgroundColor: colors.surfaceHighlight }]}>
                {coverImage ? (
                  <Image source={{ uri: coverImage }} style={styles.previewCoverImage} />
                ) : (
                  <Text style={{ fontSize: 56 }}>📦</Text>
                )}
              </View>

              <View style={styles.previewBody}>
                <View style={styles.previewHeader}>
                  <Text style={[styles.previewTitle, { color: colors.text }]}>{title || 'Untitled Bundle'}</Text>
                  <View style={[styles.previewPriceBadge, { backgroundColor: colors.accent }]}>
                    <Text style={styles.previewPriceText}>${finalPrice}</Text>
                  </View>
                </View>

                {/* Bundle summary — uses first service description as overview */}
                {selectedServices[0]?.description ? (
                  <Text style={[styles.previewDesc, { color: colors.textSecondary }]} numberOfLines={3}>
                    {selectedServices[0].description}
                  </Text>
                ) : (
                  <Text style={[styles.previewDesc, { color: colors.textTertiary }]} numberOfLines={1}>
                    {selectedServices.length} service{selectedServices.length !== 1 ? 's' : ''} bundled together
                  </Text>
                )}

                {/* Items */}
                <View style={styles.previewItems}>
                  <Text style={[styles.previewItemsTitle, { color: colors.textSecondary }]}>
                    {selectedServices.length} Services Included:
                  </Text>
                  {selectedServices.map((s) => (
                    <View key={s.id} style={styles.previewItemBlock}>
                      <View style={styles.previewItemRow}>
                        <Text style={styles.previewItemEmoji}>📦</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.previewItemName, { color: colors.text }]}>
                            {s.name || 'Untitled Service'}
                          </Text>
                          {s.description ? (
                            <Text style={[styles.previewItemDesc, { color: colors.textTertiary }]} numberOfLines={2}>
                              {s.description}
                            </Text>
                          ) : null}
                        </View>
                        <Text style={[styles.previewItemPrice, { color: colors.accent }]}>
                          {s.price > 0 ? `$${s.price}` : ''}
                        </Text>
                      </View>
                      {s.providerLink ? (
                        <Text style={[styles.previewItemDetail, { color: colors.accent }]} numberOfLines={1}>
                          🔗 {s.providerLink}
                        </Text>
                      ) : null}
                      {s.deliveryNotes ? (
                        <Text style={[styles.previewItemDetail, { color: colors.textTertiary }]} numberOfLines={2}>
                          📋 {s.deliveryNotes}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>

                {/* Details */}
                <View style={styles.previewDetails}>
                  {location ? (
                    <View style={styles.previewDetailRow}>
                      <MapPin size={14} color={colors.textTertiary} />
                      <Text style={[styles.previewDetailText, { color: colors.textSecondary }]}>{location}</Text>
                    </View>
                  ) : null}
                  {dateRange ? (
                    <View style={styles.previewDetailRow}>
                      <Calendar size={14} color={colors.textTertiary} />
                      <Text style={[styles.previewDetailText, { color: colors.textSecondary }]}>{dateRange}</Text>
                    </View>
                  ) : null}
                  <View style={styles.previewDetailRow}>
                    <Package size={14} color={colors.textTertiary} />
                    <Text style={[styles.previewDetailText, { color: colors.textSecondary }]}>
                      {parseInt(availableCount, 10) || 10} available
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

                {/* Planner Notes */}
                {plannerNotes.trim() ? (
                  <View style={[styles.previewPlannerNotes, { borderTopColor: colors.border }]}>
                    <Text style={[styles.previewPlannerNotesLabel, { color: colors.textTertiary }]}>
                      📝 Planner Notes
                    </Text>
                    <Text style={[styles.previewPlannerNotesText, { color: colors.textSecondary }]}>
                      {plannerNotes.trim()}
                    </Text>
                  </View>
                ) : null}

                {/* Creator */}
                <View style={[styles.previewCreator, { borderTopColor: colors.border }]}>
                  <View style={styles.previewCreatorInfo}>
                    <View style={[styles.previewCreatorAvatar, { backgroundColor: colors.surfaceHighlight }]}>
                      <Package size={16} color={colors.textSecondary} />
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
            <Package size={18} color="#FFF" />
            <Text style={styles.publishBtnText}>Publish Bundle</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: canGoNext() ? colors.accent : colors.surfaceHighlight }]}
            onPress={handleNext}
            disabled={!canGoNext()}
            activeOpacity={0.9}
          >
            <Text style={[styles.nextBtnText, { color: canGoNext() ? '#FFF' : colors.textTertiary }]}>
              {step === 'services' ? 'Continue to Details' : 'Preview Bundle'}
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

  // Step 1 — Service Cards (free-form entry)
  serviceCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  serviceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  serviceCardHandle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  serviceCardIndex: {
    fontSize: 12,
    fontWeight: '600',
  },
  removeBtn: {
    padding: 6,
    borderRadius: 8,
  },
  addServiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    marginTop: 4,
    marginBottom: 20,
  },
  addServiceBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  input: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  serviceRow: { flexDirection: 'row', gap: 10 },
  serviceRowField: { position: 'relative' },
  priceInput: { width: 120, paddingLeft: 30 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, marginTop: 4, borderTopWidth: 1 },
  totalLabel: { fontSize: 14, fontWeight: '600' },
  totalValue: { fontSize: 20, fontWeight: '800' },

  // Step 2 — Details
  imagePicker: { borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 16 },
  imagePreview: { position: 'relative' },
  coverImage: { height: 180, width: '100%', borderRadius: 14 },
  imagePlaceholder: { height: 180, alignItems: 'center', justifyContent: 'center', gap: 8 },
  imageOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  imageOverlayText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  imagePickerText: { fontSize: 14 },
  titleInput: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  descInput: { minHeight: 80, marginBottom: 16 },
  fieldRow: { flexDirection: 'row', gap: 12, marginBottom: 6 },
  fieldHalf: { flex: 1 },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase' },
  priceField: { position: 'relative' },
  priceInputFull: { paddingLeft: 30 },
  priceHint: { fontSize: 12, marginBottom: 16 },
  iconInput: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, marginBottom: 12, gap: 10 },
  iconInputField: { flex: 1, fontSize: 15, paddingVertical: 12 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 10 },
  tagPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  tagPillText: { fontSize: 12, fontWeight: '600' },
  tagInput: { fontSize: 15, paddingVertical: 10 },

  // Step 3 — Preview
  previewCard: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  previewCover: { height: 180, alignItems: 'center', justifyContent: 'center' },
  previewCoverImage: { width: '100%', height: '100%' },
  previewBody: { padding: 18 },
  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  previewTitle: { fontSize: 20, fontWeight: '700', flex: 1, marginRight: 12 },
  previewPriceBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  previewPriceText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  previewDesc: { fontSize: 14, marginBottom: 16, lineHeight: 20 },
  previewItems: { marginBottom: 14 },
  previewItemsTitle: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  previewItemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, gap: 8 },
  previewItemBlock: { paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.06)' },
  previewItemDetail: { fontSize: 11, marginLeft: 24, marginBottom: 2, lineHeight: 15 },
  previewItemEmoji: { fontSize: 16 },
  previewItemName: { flex: 1, fontSize: 14, fontWeight: '600' },
  previewItemDesc: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  previewItemPrice: { fontSize: 14, fontWeight: '600' },
  previewDetails: { marginBottom: 12, gap: 6 },
  previewDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  previewDetailText: { fontSize: 13 },
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
  previewPlannerNotes: { paddingVertical: 12, borderTopWidth: 1 },
  previewPlannerNotesLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  previewPlannerNotesText: { fontSize: 13, lineHeight: 18 },

  // Bottom Bar
  bottomBar: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1 },
  nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 16 },
  nextBtnText: { fontSize: 16, fontWeight: '700' },
  publishBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 16 },
  publishBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
