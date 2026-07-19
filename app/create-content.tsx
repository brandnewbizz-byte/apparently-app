import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  Dimensions,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {
  X,
  Camera,
  Type,
  RefreshCw,
  Zap,
  Send,
  Circle,
  Video,
  ChevronDown,
  Image as ImageIcon,
  MapPin,
  Globe,
  Folder,
  DollarSign,
  Check,
  Package,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/contexts/ThemeContext';
import { useSocial } from '@/contexts/SocialContext';
import { DatabaseService } from '@/lib/database';
import { requireSupabaseUser } from '@/lib/supabaseSave';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type ContentMode = 'post' | 'story' | 'reel' | 'product';
type CreateMode = 'camera' | 'text';

const TEXT_BACKGROUNDS = [
  { id: '1', colors: ['#667eea', '#764ba2'] },
  { id: '2', colors: ['#f093fb', '#f5576c'] },
  { id: '3', colors: ['#4facfe', '#00f2fe'] },
  { id: '4', colors: ['#43e97b', '#38f9d7'] },
  { id: '5', colors: ['#fa709a', '#fee140'] },
  { id: '6', colors: ['#a18cd1', '#fbc2eb'] },
  { id: '7', colors: ['#30cfd0', '#330867'] },
  { id: '8', colors: ['#ff0844', '#ffb199'] },
];

const SAMPLE_IMAGES_FOR_POST = [
  'https://images.unsplash.com/photo-1574672280600-4accfa5b6f98?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?w=600&h=400&fit=crop',
];

export default function CreateContentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { createStory, createPost } = useSocial();

  const [permission, requestPermission] = useCameraPermissions();
  const initialMode = params.type === 'post' ? 'post' : params.type === 'reel' ? 'reel' : params.type === 'product' ? 'product' : 'story';
  const [contentMode, setContentMode] = useState<ContentMode>(initialMode);
  const [createMode, setCreateMode] = useState<CreateMode>('camera');
  const [facing, setFacing] = useState<CameraType>('back');
  const [flashOn, setFlashOn] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [textContent, setTextContent] = useState('');
  const [selectedBackground, setSelectedBackground] = useState(TEXT_BACKGROUNDS[0]);
  const [isRecording, setIsRecording] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [postImage, setPostImage] = useState<string | null>(null);
  const [showPostImagePicker, setShowPostImagePicker] = useState(false);
  const [imagePickerPermission, requestImagePickerPermission] = ImagePicker.useMediaLibraryPermissions();
  const cameraRef = useRef<CameraView>(null);

  type ProductCondition = 'new' | 'like_new' | 'good' | 'fair' | 'used';
  type ProductCategory = 'electronics' | 'clothing' | 'home' | 'sports' | 'vehicles' | 'collectibles' | 'services' | 'other';

  const CATEGORY_OPTIONS: { key: ProductCategory; label: string }[] = [
    { key: 'electronics', label: 'Electronics' },
    { key: 'clothing', label: 'Clothing' },
    { key: 'home', label: 'Home' },
    { key: 'sports', label: 'Sports' },
    { key: 'vehicles', label: 'Vehicles' },
    { key: 'collectibles', label: 'Collectibles' },
    { key: 'services', label: 'Services' },
    { key: 'other', label: 'Other' },
  ];

  const CONDITION_OPTIONS: { key: ProductCondition; label: string }[] = [
    { key: 'new', label: 'New' },
    { key: 'like_new', label: 'Like New' },
    { key: 'good', label: 'Good' },
    { key: 'fair', label: 'Fair' },
    { key: 'used', label: 'Used' },
  ];

  const [productTitle, setProductTitle] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productLocation, setProductLocation] = useState('');
  const [productCategory, setProductCategory] = useState<ProductCategory>('other');
  const [productCondition, setProductCondition] = useState<ProductCondition>('good');
  const [isSubmittingProduct, setIsSubmittingProduct] = useState<boolean>(false);
  const [productAcceptsSwap, setProductAcceptsSwap] = useState(true);
  const [productImages, setProductImages] = useState<string[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showConditionPicker, setShowConditionPicker] = useState(false);
  const [isServiceListing, setIsServiceListing] = useState(false);

  useEffect(() => {
    if (params.type === 'post') {
      setContentMode('post');
    } else if (params.type === 'story') {
      setContentMode('story');
    } else if (params.type === 'reel') {
      setContentMode('reel');
    } else if (params.type === 'product') {
      setContentMode('product');
    }
  }, [params.type]);

  const handleClose = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.back();
  };

  const toggleCameraFacing = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setFacing((current: CameraType) => (current === 'back' ? 'front' : 'back'));
  };

  const toggleFlash = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setFlashOn(!flashOn);
  };

  const handleCapture = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    
    if (cameraRef.current && !isCapturing) {
      setIsCapturing(true);
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
        });
        if (photo?.uri) {
          setCapturedImage(photo.uri);
          console.log('[CreateContent] Photo captured:', photo.uri);
        }
      } catch (error) {
        console.log('[CreateContent] Capture failed:', error);
        Alert.alert('Capture Failed', 'Unable to capture photo. Please try again.');
      } finally {
        setIsCapturing(false);
      }
    }
  };

  const handleLongPressStart = () => {
    if (contentMode === 'reel') {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
      setIsRecording(true);
      console.log('[CreateContent] Started recording');
    }
  };

  const handleLongPressEnd = () => {
    if (isRecording) {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      setIsRecording(false);
      console.log('[CreateContent] Stopped recording');
      Alert.alert('Recording Saved', 'Your reel has been captured!');
    }
  };

  const handleRetake = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setCapturedImage(null);
  };

  const handlePost = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    if (contentMode === 'post') {
      if (!postContent.trim()) {
        Alert.alert('Empty Post', 'Please write something to share.');
        return;
      }
      createPost(postContent.trim(), postImage || undefined);
      console.log('[CreateContent] Feed post created', { postContent, postImage });
      router.back();
      return;
    }
    
    if (createMode === 'camera' && !capturedImage) {
      Alert.alert('No Photo', 'Please capture a photo first.');
      return;
    }
    
    if (createMode === 'text' && !textContent.trim()) {
      Alert.alert('No Content', 'Please enter some text.');
      return;
    }
    
    if (createMode === 'text') {
      createStory(undefined, selectedBackground.colors[0], textContent);
    } else {
      createStory(capturedImage || undefined);
    }
    
    console.log('[CreateContent] Posting', { type: contentMode, createMode, capturedImage, textContent });
    router.back();
  };

  const handleModeSwitch = (newMode: CreateMode) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    setCreateMode(newMode);
  };

  const handleContentModeSwitch = (mode: ContentMode) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    setContentMode(mode);
  };

  const handleSelectBackground = (bg: typeof TEXT_BACKGROUNDS[0]) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    setSelectedBackground(bg);
  };

  const handleSelectPostImage = (imageUrl: string) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    setPostImage(postImage === imageUrl ? null : imageUrl);
    setShowPostImagePicker(false);
  };

  const handlePickImageFromLibrary = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (Platform.OS !== 'web' && !imagePickerPermission?.granted) {
      const { status } = await requestImagePickerPermission();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'We need access to your photos to upload images.');
        return;
      }
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setPostImage(result.assets[0].uri);
        setShowPostImagePicker(false);
        console.log('[CreateContent] Selected image from library:', result.assets[0].uri);
      }
    } catch (error) {
      console.log('[CreateContent] Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handleRemovePostImage = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setPostImage(null);
  };

  const handleAddProductImage = useCallback(async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (productImages.length >= 5) {
      Alert.alert('Maximum Photos', 'You can add up to 5 photos per listing.');
      return;
    }

    if (Platform.OS !== 'web' && !imagePickerPermission?.granted) {
      const { status } = await requestImagePickerPermission();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'We need access to your photos to upload images.');
        return;
      }
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setProductImages([...productImages, result.assets[0].uri]);
        console.log('[CreateContent] Added product image:', result.assets[0].uri);
      }
    } catch (error) {
      console.log('[CreateContent] Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  }, [productImages, imagePickerPermission, requestImagePickerPermission]);

  const handleRemoveProductImage = useCallback((index: number) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setProductImages(productImages.filter((_, i) => i !== index));
  }, [productImages]);

  const handleProductSubmit = useCallback(async () => {
    if (!productTitle.trim()) {
      Alert.alert('Missing Title', 'Please enter a title for your listing.');
      return;
    }
    
    if (!isServiceListing && (!productPrice || parseFloat(productPrice) < 0)) {
      Alert.alert('Invalid Price', 'Please enter a valid price (or 0 for negotiable).');
      return;
    }
    
    if (!productLocation.trim()) {
      Alert.alert('Missing Location', 'Please enter your location.');
      return;
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const images: string[] = productImages.length > 0
      ? productImages
      : ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&h=600&fit=crop'];

    if (isSubmittingProduct) return;

    setIsSubmittingProduct(true);
    try {
      const auth = await requireSupabaseUser({ onMissingUserMessage: 'Please log in first' });
      if (!auth) {
        setIsSubmittingProduct(false);
        return;
      }
      const hostId = auth.userId;

      const created = await DatabaseService.createListing({
        category: 'product',
        title: productTitle.trim(),
        description: productDescription.trim(),
        images,
        host_id: hostId,
        location: productLocation.trim(),
        coordinates: undefined,
        price_per_day: isServiceListing ? 0 : parseFloat(productPrice) || 0,
        price_per_hour: undefined,
        currency: 'USD',
        rating: 0,
        review_count: 0,
        views: 0,
        messages_count: 0,
        sales_count: 0,
        amenity_ids: [],
        status: 'available',
        instant_book: true,
        specs: {
          listingType: isServiceListing ? 'service' : 'item',
          productCategory,
          condition: isServiceListing ? 'new' : productCondition,
          acceptsSwap: productAcceptsSwap ? 'true' : 'false',
        },
        rules: [],
        cancellation_policy: 'flexible',
      } as any);

      console.log('[CreateContent] Product listing created in listings table:', created?.id);
      Alert.alert('Success', 'Your listing has been created!', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e) {
      console.error('[CreateContent] Failed to create listing:', e);
      Alert.alert('Error', 'Could not create listing. Please try again.');
    } finally {
      setIsSubmittingProduct(false);
    }
  }, [productTitle, productDescription, productPrice, productLocation, productCategory, productCondition, productAcceptsSwap, productImages, isServiceListing, isSubmittingProduct, router]);

  const getCategoryLabel = useCallback(() => {
    return CATEGORY_OPTIONS.find(c => c.key === productCategory)?.label || 'Select Category';
  }, [productCategory]);

  const getConditionLabel = useCallback(() => {
    return CONDITION_OPTIONS.find(c => c.key === productCondition)?.label || 'Select Condition';
  }, [productCondition]);

  const renderProductMode = () => (
    <KeyboardAvoidingView
      style={[styles.productContainer, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 60 : 0}
    >
      <ScrollView
        style={styles.productScrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        <View style={styles.productSection}>
          <Text style={[styles.productSectionTitle, { color: colors.text }]}>Photos</Text>
          <Text style={[styles.productSectionSubtitle, { color: colors.textSecondary }]}>
            Add up to 5 photos of your item
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.productImagesScroll}>
            <TouchableOpacity
              style={[styles.addProductImageButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={handleAddProductImage}
            >
              <Camera size={28} color={colors.accent} />
              <Text style={[styles.addProductImageText, { color: colors.textSecondary }]}>Add Photo</Text>
            </TouchableOpacity>
            {productImages.map((uri, idx) => (
              <View key={idx} style={styles.productImageWrap}>
                <Image source={{ uri }} style={styles.productImage} />
                <TouchableOpacity
                  style={styles.removeProductImageButton}
                  onPress={() => handleRemoveProductImage(idx)}
                >
                  <X size={14} color="#fff" />
                </TouchableOpacity>
                {idx === 0 && (
                  <View style={[styles.mainPhotoBadge, { backgroundColor: colors.accent }]}>
                    <Text style={styles.mainPhotoBadgeText}>Main</Text>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={styles.productSection}>
          <Text style={[styles.productSectionTitle, { color: colors.text }]}>Listing Type</Text>
          <View style={styles.listingTypeRow}>
            <TouchableOpacity
              style={[
                styles.listingTypeButton,
                { backgroundColor: !isServiceListing ? colors.accent : colors.surface, borderColor: !isServiceListing ? colors.accent : colors.border }
              ]}
              onPress={() => {
                setIsServiceListing(false);
                if (Platform.OS !== 'web') Haptics.selectionAsync();
              }}
            >
              <Package size={18} color={!isServiceListing ? '#fff' : colors.textSecondary} />
              <Text style={[styles.listingTypeText, { color: !isServiceListing ? '#fff' : colors.textSecondary }]}>Product</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.listingTypeButton,
                { backgroundColor: isServiceListing ? colors.accent : colors.surface, borderColor: isServiceListing ? colors.accent : colors.border }
              ]}
              onPress={() => {
                setIsServiceListing(true);
                setProductCategory('services');
                if (Platform.OS !== 'web') Haptics.selectionAsync();
              }}
            >
              <Zap size={18} color={isServiceListing ? '#fff' : colors.textSecondary} />
              <Text style={[styles.listingTypeText, { color: isServiceListing ? '#fff' : colors.textSecondary }]}>Service</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.productSection}>
          <Text style={[styles.productSectionTitle, { color: colors.text }]}>Details</Text>
          
          <View style={styles.productInputGroup}>
            <Text style={[styles.productInputLabel, { color: colors.textSecondary }]}>Title *</Text>
            <TextInput
              value={productTitle}
              onChangeText={setProductTitle}
              placeholder={isServiceListing ? "What service are you offering?" : "What are you selling?"}
              placeholderTextColor={colors.textTertiary}
              style={[styles.productTextInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              maxLength={100}
            />
          </View>

          <View style={styles.productInputGroup}>
            <Text style={[styles.productInputLabel, { color: colors.textSecondary }]}>Description</Text>
            <TextInput
              value={productDescription}
              onChangeText={setProductDescription}
              placeholder={isServiceListing ? "Describe your service, experience, and availability..." : "Describe your item, condition, and any details..."}
              placeholderTextColor={colors.textTertiary}
              style={[styles.productTextInput, styles.productTextArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={1000}
            />
          </View>

          <View style={styles.productInputGroup}>
            <Text style={[styles.productInputLabel, { color: colors.textSecondary }]}>
              {isServiceListing ? 'Price (enter 0 for negotiable)' : 'Price *'}
            </Text>
            <View style={[styles.productPriceInputWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <DollarSign size={18} color={colors.textTertiary} />
              <TextInput
                value={productPrice}
                onChangeText={(text) => setProductPrice(text.replace(/[^0-9.]/g, ''))}
                placeholder={isServiceListing ? "0 (negotiable)" : "0.00"}
                placeholderTextColor={colors.textTertiary}
                style={[styles.productPriceInput, { color: colors.text }]}
                keyboardType="decimal-pad"
              />
            </View>
            {isServiceListing && (
              <Text style={[styles.priceHint, { color: colors.textTertiary }]}>
                Enter 0 to show &quot;Negotiable&quot; to buyers
              </Text>
            )}
          </View>

          <View style={styles.productInputGroup}>
            <Text style={[styles.productInputLabel, { color: colors.textSecondary }]}>Location *</Text>
            <View style={[styles.productLocationInputWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <MapPin size={18} color={colors.textTertiary} />
              <TextInput
                value={productLocation}
                onChangeText={setProductLocation}
                placeholder={isServiceListing ? "City, State or 'Remote'" : "City, State"}
                placeholderTextColor={colors.textTertiary}
                style={[styles.productLocationInput, { color: colors.text }]}
              />
            </View>
          </View>

          <View style={styles.productInputGroup}>
            <Text style={[styles.productInputLabel, { color: colors.textSecondary }]}>Category</Text>
            <TouchableOpacity
              style={[styles.productPickerButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setShowCategoryPicker(!showCategoryPicker)}
            >
              <Text style={[styles.productPickerButtonText, { color: colors.text }]}>{getCategoryLabel()}</Text>
              <ChevronDown size={18} color={colors.textTertiary} />
            </TouchableOpacity>
            {showCategoryPicker && (
              <View style={[styles.productPickerOptions, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {CATEGORY_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.productPickerOption, productCategory === opt.key && { backgroundColor: colors.accent + '15' }]}
                    onPress={() => {
                      setProductCategory(opt.key);
                      setShowCategoryPicker(false);
                      if (Platform.OS !== 'web') Haptics.selectionAsync();
                    }}
                  >
                    <Text style={[styles.productPickerOptionText, { color: colors.text }]}>
                      {opt.label}
                    </Text>
                    {productCategory === opt.key && <Check size={18} color={colors.accent} />}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {!isServiceListing && (
            <View style={styles.productInputGroup}>
              <Text style={[styles.productInputLabel, { color: colors.textSecondary }]}>Condition</Text>
              <TouchableOpacity
                style={[styles.productPickerButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => setShowConditionPicker(!showConditionPicker)}
              >
                <Text style={[styles.productPickerButtonText, { color: colors.text }]}>{getConditionLabel()}</Text>
                <ChevronDown size={18} color={colors.textTertiary} />
              </TouchableOpacity>
              {showConditionPicker && (
                <View style={[styles.productPickerOptions, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  {CONDITION_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.productPickerOption, productCondition === opt.key && { backgroundColor: colors.accent + '15' }]}
                      onPress={() => {
                        setProductCondition(opt.key);
                        setShowConditionPicker(false);
                        if (Platform.OS !== 'web') Haptics.selectionAsync();
                      }}
                    >
                      <View style={styles.conditionOptionContent}>
                        <Text style={[styles.productPickerOptionText, { color: colors.text }]}>{opt.label}</Text>
                        <Text style={[styles.conditionDescription, { color: colors.textTertiary }]}>
                          
                        </Text>
                      </View>
                      {productCondition === opt.key && <Check size={18} color={colors.accent} />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>

        <View style={styles.productSection}>
          <Text style={[styles.productSectionTitle, { color: colors.text }]}>Trading Options</Text>
          
          <TouchableOpacity
            style={[styles.swapToggle, { backgroundColor: colors.surface, borderColor: productAcceptsSwap ? '#10B981' : colors.border }]}
            onPress={() => {
              setProductAcceptsSwap(!productAcceptsSwap);
              if (Platform.OS !== 'web') Haptics.selectionAsync();
            }}
          >
            <View style={[styles.swapIconWrap, { backgroundColor: productAcceptsSwap ? '#10B981' : colors.backgroundSecondary }]}>
              <RefreshCw size={20} color={productAcceptsSwap ? '#fff' : colors.textTertiary} />
            </View>
            <View style={styles.swapContent}>
              <Text style={[styles.swapTitle, { color: colors.text }]}>Accept Skill Swaps</Text>
              <Text style={[styles.swapDescription, { color: colors.textSecondary }]}>
                Let buyers offer services instead of cash
              </Text>
            </View>
            <View style={[styles.checkbox, { borderColor: productAcceptsSwap ? '#10B981' : colors.border, backgroundColor: productAcceptsSwap ? '#10B981' : 'transparent' }]}>
              {productAcceptsSwap && <Check size={14} color="#fff" />}
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={[styles.productFooter, { paddingBottom: insets.bottom || 16, borderTopColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={[styles.productSubmitButton, { backgroundColor: colors.accent }]}
          onPress={handleProductSubmit}
        >
          <Text style={styles.productSubmitButtonText}>Post Listing</Text>
          <Send size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );

  const renderPostMode = () => (
    <KeyboardAvoidingView
      style={[styles.postContainer, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 60 : 0}
    >
      <ScrollView 
        style={styles.postScrollContent} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <View style={styles.postUserSection}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop' }}
            style={[styles.postAvatar, { backgroundColor: colors.backgroundTertiary }]}
          />
          <View style={styles.postUserInfo}>
            <Text style={[styles.postUserName, { color: colors.text }]}>You</Text>
            <View style={[styles.postPrivacySelector, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Globe size={14} color={colors.textSecondary} />
              <Text style={[styles.postPrivacyText, { color: colors.textSecondary }]}>Public</Text>
            </View>
          </View>
        </View>

        <View style={styles.postMediaSection}>
          <TouchableOpacity
            style={[styles.postMediaPickerButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handlePickImageFromLibrary}
          >
            <Folder size={24} color={colors.accent} />
            <Text style={[styles.postMediaPickerText, { color: colors.text }]}>Add Photo from Gallery</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={[styles.postContentInput, { color: colors.text }]}
          placeholder="What's on your mind?"
          placeholderTextColor={colors.textTertiary}
          value={postContent}
          onChangeText={setPostContent}
          multiline
          autoFocus
          textAlignVertical="top"
        />

        {postImage && (
          <View style={styles.postSelectedImageContainer}>
            <Image source={{ uri: postImage }} style={styles.postSelectedImage} />
            <TouchableOpacity
              style={[styles.postRemoveImageButton, { backgroundColor: colors.background }]}
              onPress={handleRemovePostImage}
            >
              <X size={16} color={colors.text} />
            </TouchableOpacity>
          </View>
        )}

        {showPostImagePicker && (
          <View style={[styles.postImagePickerContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.postImagePickerTitle, { color: colors.text }]}>Add a photo</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.postImagePickerList}>
              {SAMPLE_IMAGES_FOR_POST.map((img, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.postImagePickerItem,
                    postImage === img && { borderColor: colors.accent, borderWidth: 2 },
                  ]}
                  onPress={() => handleSelectPostImage(img)}
                >
                  <Image source={{ uri: img }} style={styles.postImagePickerImage} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      <View style={[styles.postFooter, { paddingBottom: insets.bottom || 16, borderTopColor: colors.border, backgroundColor: colors.background }]}>
        <View style={styles.postFooterActions}>
          <TouchableOpacity
            style={[
              styles.postFooterButton,
              { backgroundColor: showPostImagePicker ? colors.accent + '20' : colors.surface },
            ]}
            onPress={() => setShowPostImagePicker(!showPostImagePicker)}
          >
            <ImageIcon size={20} color={showPostImagePicker ? colors.accent : colors.textSecondary} />
            <Text style={[styles.postFooterButtonText, { color: showPostImagePicker ? colors.accent : colors.textSecondary }]}>
              Photo
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.postFooterButton, { backgroundColor: colors.surface }]}>
            <MapPin size={20} color={colors.textSecondary} />
            <Text style={[styles.postFooterButtonText, { color: colors.textSecondary }]}>Location</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[
            styles.postSubmitButton,
            { backgroundColor: colors.accent },
            !postContent.trim() && styles.postSubmitButtonDisabled,
          ]}
          onPress={handlePost}
          disabled={!postContent.trim()}
        >
          <Text style={styles.postSubmitButtonText}>Post</Text>
          <Send size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );

  const renderCameraPermissionRequest = () => (
    <View style={[styles.permissionContainer, { paddingTop: insets.top + 60 }]}>
      <Camera size={64} color={colors.textSecondary} />
      <Text style={[styles.permissionTitle, { color: colors.text }]}>Camera Access</Text>
      <Text style={[styles.permissionText, { color: colors.textSecondary }]}>
        We need access to your camera to create {contentMode}s.
      </Text>
      <TouchableOpacity style={[styles.permissionButton, { backgroundColor: colors.accent }]} onPress={requestPermission}>
        <Text style={styles.permissionButtonText}>Grant Permission</Text>
      </TouchableOpacity>
    </View>
  );

  const renderCameraMode = () => {
    if (Platform.OS === 'web') {
      return (
        <View style={[styles.webCameraPlaceholder, { paddingTop: insets.top + 60 }]}>
          <Camera size={64} color={colors.textSecondary} />
          <Text style={[styles.webCameraText, { color: colors.text }]}>Camera Preview</Text>
          <Text style={[styles.webCameraSubtext, { color: colors.textSecondary }]}>
            Camera is available on mobile devices.{'\n'}
            Use text mode on web.
          </Text>
          <TouchableOpacity
            style={[styles.switchModeButton, { backgroundColor: colors.accent }]}
            onPress={() => handleModeSwitch('text')}
          >
            <Type size={20} color="#FFFFFF" />
            <Text style={styles.switchModeText}>Switch to Text Mode</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!permission?.granted) {
      return renderCameraPermissionRequest();
    }

    if (capturedImage) {
      return (
        <View style={styles.previewContainer}>
          <Image source={{ uri: capturedImage }} style={styles.previewImage} />
          <View style={[styles.previewActions, { paddingBottom: insets.bottom + 100 }]}>
            <TouchableOpacity style={[styles.retakeButton, { backgroundColor: 'rgba(255,255,255,0.2)' }]} onPress={handleRetake}>
              <RefreshCw size={24} color="#FFFFFF" />
              <Text style={styles.retakeText}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.postButton, { backgroundColor: colors.accent }]} onPress={handlePost}>
              <Text style={styles.postButtonText}>Share</Text>
              <Send size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        flash={flashOn ? 'on' : 'off'}
      >
        <View style={[styles.cameraOverlay, { paddingTop: insets.top + 60 }]}>
          <View style={styles.cameraControls}>
            <TouchableOpacity style={styles.cameraControlButton} onPress={toggleFlash}>
              <Zap
                size={24}
                color="#FFFFFF"
                fill={flashOn ? '#FFD700' : 'none'}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.cameraControlButton} onPress={toggleCameraFacing}>
              <RefreshCw size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </CameraView>
    );
  };

  const renderTextMode = () => (
    <View style={styles.textModeContainer}>
      <View
        style={[
          styles.textPreview,
          { backgroundColor: selectedBackground.colors[0], paddingTop: insets.top + 80 },
        ]}
      >
        <TextInput
          style={styles.textInput}
          placeholder="Type something..."
          placeholderTextColor="rgba(255,255,255,0.6)"
          value={textContent}
          onChangeText={setTextContent}
          multiline
          textAlign="center"
          autoFocus
        />
      </View>

      <View style={[styles.textControls, { paddingBottom: insets.bottom + 100, backgroundColor: colors.surface }]}>
        <Text style={[styles.backgroundLabel, { color: colors.textSecondary }]}>Background</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.backgroundList}
        >
          {TEXT_BACKGROUNDS.map((bg) => (
            <TouchableOpacity
              key={bg.id}
              style={[
                styles.backgroundOption,
                { backgroundColor: bg.colors[0] },
                selectedBackground.id === bg.id && styles.backgroundOptionSelected,
              ]}
              onPress={() => handleSelectBackground(bg)}
            />
          ))}
        </ScrollView>

        <TouchableOpacity
          style={[styles.postButton, { backgroundColor: colors.accent }, !textContent.trim() && styles.postButtonDisabled]}
          onPress={handlePost}
          disabled={!textContent.trim()}
        >
          <Text style={styles.postButtonText}>Share</Text>
          <Send size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: '#000000' }]}>
      <Stack.Screen
        options={{
          headerShown: false,
          presentation: 'fullScreenModal',
        }}
      />

      <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: (contentMode === 'post' || contentMode === 'product') ? colors.background : 'transparent' }]}>
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <X size={28} color={(contentMode === 'post' || contentMode === 'product') ? colors.text : '#FFFFFF'} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <TouchableOpacity style={styles.headerDropdown}>
            <Text style={[styles.headerTitle, (contentMode === 'post' || contentMode === 'product') && { color: colors.text }]}>
              {contentMode === 'post' ? 'New Post' : contentMode === 'product' ? 'List an Item' : contentMode === 'story' ? 'Story' : 'Reel'}
            </Text>
            {contentMode !== 'product' && <ChevronDown size={18} color={contentMode === 'post' ? colors.text : '#FFFFFF'} />}
          </TouchableOpacity>
        </View>

        {contentMode !== 'post' && contentMode !== 'product' && (
          <View style={styles.modeSwitcher}>
            <TouchableOpacity
              style={[styles.modeButton, createMode === 'camera' && styles.modeButtonActive]}
              onPress={() => handleModeSwitch('camera')}
            >
              <Camera size={18} color={createMode === 'camera' ? '#FFFFFF' : 'rgba(255,255,255,0.5)'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, createMode === 'text' && styles.modeButtonActive]}
              onPress={() => handleModeSwitch('text')}
            >
              <Type size={18} color={createMode === 'text' ? '#FFFFFF' : 'rgba(255,255,255,0.5)'} />
            </TouchableOpacity>
          </View>
        )}
        {(contentMode === 'post' || contentMode === 'product') && <View style={{ width: 80 }} />}
      </View>

      <View style={[styles.content, (contentMode === 'post' || contentMode === 'product') && { backgroundColor: colors.background }]}>
        {contentMode === 'product' ? renderProductMode() : contentMode === 'post' ? renderPostMode() : createMode === 'camera' ? renderCameraMode() : renderTextMode()}
      </View>

      {contentMode !== 'post' && contentMode !== 'product' && createMode === 'camera' && !capturedImage && (
        <View style={[styles.bottomControls, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.contentModeSelector}>
            <TouchableOpacity
              style={[styles.contentModeButton, contentMode === 'story' && styles.contentModeButtonActive]}
              onPress={() => handleContentModeSwitch('story')}
            >
              <Circle size={16} color={contentMode === 'story' ? '#FFFFFF' : 'rgba(255,255,255,0.5)'} />
              <Text style={[styles.contentModeText, contentMode === 'story' && styles.contentModeTextActive]}>
                STORY
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.contentModeButton, contentMode === 'reel' && styles.contentModeButtonActive]}
              onPress={() => handleContentModeSwitch('reel')}
            >
              <Video size={16} color={contentMode === 'reel' ? '#FFFFFF' : 'rgba(255,255,255,0.5)'} />
              <Text style={[styles.contentModeText, contentMode === 'reel' && styles.contentModeTextActive]}>
                REEL
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.captureContainer}>
            <TouchableOpacity
              style={[
                styles.captureButton,
                isCapturing && styles.captureButtonDisabled,
                isRecording && styles.captureButtonRecording,
              ]}
              onPress={contentMode === 'story' ? handleCapture : undefined}
              onPressIn={contentMode === 'reel' ? handleLongPressStart : undefined}
              onPressOut={contentMode === 'reel' ? handleLongPressEnd : undefined}
              disabled={isCapturing}
              activeOpacity={0.8}
            >
              {isCapturing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <View style={[
                  styles.captureInner,
                  contentMode === 'reel' && styles.captureInnerReel,
                  isRecording && styles.captureInnerRecording,
                ]} />
              )}
            </TouchableOpacity>
            <Text style={styles.captureHint}>
              {contentMode === 'story' ? 'Tap to capture' : 'Hold to record'}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  modeSwitcher: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    padding: 4,
  },
  modeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  content: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  cameraControls: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    gap: 16,
  },
  cameraControlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: 20,
  },
  contentModeSelector: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 24,
  },
  contentModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  contentModeButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  contentModeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
  },
  contentModeTextActive: {
    color: '#FFFFFF',
  },
  captureContainer: {
    alignItems: 'center',
    gap: 12,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonRecording: {
    borderColor: '#FF3B30',
    transform: [{ scale: 1.1 }],
  },
  captureInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
  },
  captureInnerReel: {
    backgroundColor: '#FF3B30',
  },
  captureInnerRecording: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#FF3B30',
  },
  captureHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  previewContainer: {
    flex: 1,
  },
  previewImage: {
    flex: 1,
    width: SCREEN_WIDTH,
  },
  previewActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
  },
  retakeText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  postButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  postButtonDisabled: {
    opacity: 0.5,
  },
  postButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    marginTop: 16,
  },
  permissionText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  permissionButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 24,
    marginTop: 16,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  webCameraPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  webCameraText: {
    fontSize: 24,
    fontWeight: '700' as const,
    marginTop: 16,
  },
  webCameraSubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  switchModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    marginTop: 24,
  },
  switchModeText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  textModeContainer: {
    flex: 1,
  },
  textPreview: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  textInput: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    textAlign: 'center',
    width: '100%',
    minHeight: 200,
  },
  textControls: {
    paddingHorizontal: 20,
    paddingTop: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  backgroundLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 12,
  },
  backgroundList: {
    gap: 12,
    paddingBottom: 20,
  },
  backgroundOption: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  backgroundOptionSelected: {
    borderColor: '#FFFFFF',
    borderWidth: 3,
  },
  postContainer: {
    flex: 1,
  },
  postScrollContent: {
    flex: 1,
  },
  postUserSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  postAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  postUserInfo: {
    flex: 1,
    gap: 4,
  },
  postUserName: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  postPrivacySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  postPrivacyText: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  postMediaSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  postMediaPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  postMediaPickerText: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  postContentInput: {
    fontSize: 18,
    lineHeight: 26,
    paddingHorizontal: 16,
    minHeight: 150,
  },
  postSelectedImageContainer: {
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  postSelectedImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  postRemoveImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  postImagePickerContainer: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  postImagePickerTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 12,
  },
  postImagePickerList: {
    gap: 10,
  },
  postImagePickerItem: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  postImagePickerImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  postFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  postFooterActions: {
    flexDirection: 'row',
    gap: 8,
  },
  postFooterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  postFooterButtonText: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  postSubmitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  postSubmitButtonDisabled: {
    opacity: 0.5,
  },
  postSubmitButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  productContainer: {
    flex: 1,
  },
  productScrollContent: {
    flex: 1,
  },
  productSection: {
    padding: 16,
    paddingTop: 20,
  },
  productSectionTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  productSectionSubtitle: {
    fontSize: 13,
    fontWeight: '500' as const,
    marginBottom: 14,
  },
  productImagesScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  addProductImageButton: {
    width: 110,
    height: 110,
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    gap: 6,
  },
  addProductImageText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  productImageWrap: {
    width: 110,
    height: 110,
    borderRadius: 14,
    overflow: 'hidden',
    marginRight: 12,
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  removeProductImageButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainPhotoBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  mainPhotoBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700' as const,
  },
  listingTypeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  listingTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  listingTypeText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  productInputGroup: {
    marginBottom: 18,
  },
  productInputLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    marginBottom: 8,
  },
  productTextInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: '500' as const,
  },
  productTextArea: {
    height: 110,
    paddingTop: 14,
  },
  productPriceInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  productPriceInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500' as const,
    paddingVertical: 14,
    marginLeft: 8,
  },
  priceHint: {
    fontSize: 12,
    fontWeight: '400' as const,
    marginTop: 6,
  },
  productLocationInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  productLocationInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500' as const,
    paddingVertical: 14,
    marginLeft: 8,
  },
  productPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  productPickerButtonText: {
    fontSize: 15,
    fontWeight: '500' as const,
  },
  productPickerOptions: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  productPickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  productPickerOptionText: {
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
  productFooter: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  productSubmitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
  },
  productSubmitButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
});
