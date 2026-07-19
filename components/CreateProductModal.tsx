import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  X,
  Camera,
  MapPin,
  DollarSign,
  RefreshCw,
  Check,
  ChevronDown,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/contexts/ThemeContext';
import { useMarketplace, ProductCategory, ProductCondition } from '@/contexts/MarketplaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { CATEGORY_OPTIONS, CONDITION_OPTIONS } from '@/mocks/marketplaceData';

interface CreateProductModalProps {
  visible: boolean;
  onClose: () => void;
}

const PLACEHOLDER_IMAGES = [
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=800&h=600&fit=crop',
];

export default function CreateProductModal({ visible, onClose }: CreateProductModalProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { addProduct } = useMarketplace();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState<ProductCategory>('other');
  const [condition, setCondition] = useState<ProductCondition>('good');
  const [acceptsSwap, setAcceptsSwap] = useState(true);
  const [images, setImages] = useState<string[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showConditionPicker, setShowConditionPicker] = useState(false);

  const resetForm = useCallback(() => {
    setTitle('');
    setDescription('');
    setPrice('');
    setLocation('');
    setCategory('other');
    setCondition('good');
    setAcceptsSwap(true);
    setImages([]);
  }, []);

  const onPressHaptic = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleClose = useCallback(() => {
    onPressHaptic();
    onClose();
  }, [onPressHaptic, onClose]);

  const handleAddImage = useCallback(() => {
    onPressHaptic();
    const randomImage = PLACEHOLDER_IMAGES[Math.floor(Math.random() * PLACEHOLDER_IMAGES.length)];
    if (images.length < 5) {
      setImages([...images, randomImage]);
    }
  }, [onPressHaptic, images]);

  const handleRemoveImage = useCallback((index: number) => {
    onPressHaptic();
    setImages(images.filter((_, i) => i !== index));
  }, [onPressHaptic, images]);

  const handleSubmit = useCallback(() => {
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter a title for your listing.');
      return;
    }
    if (!price || parseFloat(price) <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price.');
      return;
    }
    if (!location.trim()) {
      Alert.alert('Missing Location', 'Please enter your location.');
      return;
    }

    onPressHaptic();

    const productImages = images.length > 0 
      ? images.map((uri, idx) => ({ id: `img-${Date.now()}-${idx}`, uri }))
      : [{ id: `img-${Date.now()}-0`, uri: PLACEHOLDER_IMAGES[0] }];

    addProduct({
      sellerId: user?.id || '',
      sellerName: user?.fullName || 'You',
      sellerAvatar: user?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop',
      sellerUsername: user?.username || 'you',
      title: title.trim(),
      description: description.trim(),
      price: parseFloat(price),
      acceptsSwap,
      condition,
      category,
      images: productImages,
      location: location.trim(),
    });

    resetForm();
    onClose();
    Alert.alert('Success', 'Your listing has been created!');
  }, [title, description, price, location, category, condition, acceptsSwap, images, addProduct, onPressHaptic, resetForm, onClose, user?.id, user?.fullName, user?.avatar, user?.username]);

  const getCategoryLabel = () => {
    return CATEGORY_OPTIONS.find(c => c.key === category)?.label || 'Select Category';
  };

  const getConditionLabel = () => {
    return CONDITION_OPTIONS.find(c => c.key === condition)?.label || 'Select Condition';
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView 
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: insets.top > 0 ? insets.top : 16 }]}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <X size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Sell an Item</Text>
          <TouchableOpacity 
            onPress={handleSubmit}
            style={[styles.postButton, { backgroundColor: colors.accent }]}
          >
            <Text style={styles.postButtonText}>Post</Text>
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.content}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Photos</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              Add up to 5 photos of your item
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesScroll}>
              <TouchableOpacity
                style={[styles.addImageButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={handleAddImage}
              >
                <Camera size={28} color={colors.textTertiary} />
                <Text style={[styles.addImageText, { color: colors.textTertiary }]}>Add Photo</Text>
              </TouchableOpacity>
              {images.map((uri, idx) => (
                <View key={idx} style={styles.imageWrap}>
                  <Image source={{ uri }} style={styles.image} />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => handleRemoveImage(idx)}
                  >
                    <X size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Details</Text>
            
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Title *</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="What are you selling?"
                placeholderTextColor={colors.textTertiary}
                style={[styles.textInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                maxLength={100}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Description</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Describe your item..."
                placeholderTextColor={colors.textTertiary}
                style={[styles.textInput, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={1000}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Price *</Text>
              <View style={[styles.priceInputWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <DollarSign size={18} color={colors.textTertiary} />
                <TextInput
                  value={price}
                  onChangeText={(text) => setPrice(text.replace(/[^0-9.]/g, ''))}
                  placeholder="0.00"
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.priceInput, { color: colors.text }]}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Location *</Text>
              <View style={[styles.locationInputWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <MapPin size={18} color={colors.textTertiary} />
                <TextInput
                  value={location}
                  onChangeText={setLocation}
                  placeholder="City, State"
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.locationInput, { color: colors.text }]}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Category</Text>
              <TouchableOpacity
                style={[styles.pickerButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => setShowCategoryPicker(!showCategoryPicker)}
              >
                <Text style={[styles.pickerButtonText, { color: colors.text }]}>{getCategoryLabel()}</Text>
                <ChevronDown size={18} color={colors.textTertiary} />
              </TouchableOpacity>
              {showCategoryPicker && (
                <View style={[styles.pickerOptions, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  {CATEGORY_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.pickerOption, category === opt.key && { backgroundColor: colors.accent + '15' }]}
                      onPress={() => {
                        setCategory(opt.key);
                        setShowCategoryPicker(false);
                        onPressHaptic();
                      }}
                    >
                      <Text style={[styles.pickerOptionText, { color: colors.text }]}>
                        {opt.emoji} {opt.label}
                      </Text>
                      {category === opt.key && <Check size={18} color={colors.accent} />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Condition</Text>
              <TouchableOpacity
                style={[styles.pickerButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => setShowConditionPicker(!showConditionPicker)}
              >
                <Text style={[styles.pickerButtonText, { color: colors.text }]}>{getConditionLabel()}</Text>
                <ChevronDown size={18} color={colors.textTertiary} />
              </TouchableOpacity>
              {showConditionPicker && (
                <View style={[styles.pickerOptions, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  {CONDITION_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.pickerOption, condition === opt.key && { backgroundColor: colors.accent + '15' }]}
                      onPress={() => {
                        setCondition(opt.key);
                        setShowConditionPicker(false);
                        onPressHaptic();
                      }}
                    >
                      <View style={styles.conditionOptionContent}>
                        <Text style={[styles.pickerOptionText, { color: colors.text }]}>{opt.label}</Text>
                        <Text style={[styles.conditionDescription, { color: colors.textTertiary }]}>
                          {opt.description}
                        </Text>
                      </View>
                      {condition === opt.key && <Check size={18} color={colors.accent} />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Trading Options</Text>
            
            <TouchableOpacity
              style={[styles.swapToggle, { backgroundColor: colors.surface, borderColor: acceptsSwap ? '#10B981' : colors.border }]}
              onPress={() => {
                setAcceptsSwap(!acceptsSwap);
                onPressHaptic();
              }}
            >
              <View style={[styles.swapIconWrap, { backgroundColor: acceptsSwap ? '#10B981' : colors.backgroundSecondary }]}>
                <RefreshCw size={20} color={acceptsSwap ? '#fff' : colors.textTertiary} />
              </View>
              <View style={styles.swapContent}>
                <Text style={[styles.swapTitle, { color: colors.text }]}>Accept Skill Swaps</Text>
                <Text style={[styles.swapDescription, { color: colors.textSecondary }]}>
                  Let buyers offer services instead of cash
                </Text>
              </View>
              <View style={[styles.checkbox, { borderColor: acceptsSwap ? '#10B981' : colors.border, backgroundColor: acceptsSwap ? '#10B981' : 'transparent' }]}>
                {acceptsSwap && <Check size={14} color="#fff" />}
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
  },
  postButton: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
  },
  postButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '500' as const,
    marginBottom: 12,
  },
  imagesScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  addImageButton: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    gap: 4,
  },
  addImageText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  imageWrap: {
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 12,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '500' as const,
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  priceInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  priceInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500' as const,
    paddingVertical: 12,
    marginLeft: 8,
  },
  locationInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  locationInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500' as const,
    paddingVertical: 12,
    marginLeft: 8,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  pickerButtonText: {
    fontSize: 15,
    fontWeight: '500' as const,
  },
  pickerOptions: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pickerOptionText: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  conditionOptionContent: {
    flex: 1,
  },
  conditionDescription: {
    fontSize: 12,
    fontWeight: '400' as const,
    marginTop: 2,
  },
  swapToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    gap: 14,
  },
  swapIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swapContent: {
    flex: 1,
  },
  swapTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
  },
  swapDescription: {
    fontSize: 12,
    fontWeight: '500' as const,
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
