import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Animated,
  Platform,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  ArrowLeft,
  Heart,
  Share2,
  MapPin,
  Eye,
  MessageCircle,
  RefreshCw,
  Clock,
  Send,
  MoreHorizontal,
  Trash2,
  Edit3,
  CheckCircle,
  User,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/contexts/ThemeContext';
import { useMarketplace, Product } from '@/contexts/MarketplaceContext';
import { CONDITION_OPTIONS, CATEGORY_OPTIONS } from '@/mocks/marketplaceData';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

function getConditionLabel(condition: string): string {
  return CONDITION_OPTIONS.find(c => c.key === condition)?.label || condition;
}

function getCategoryLabel(category: string): string {
  return CATEGORY_OPTIONS.find(c => c.key === category)?.label || category;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ProductDetailScreen() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const {
    getProductById,
    saveProduct,
    unsaveProduct,
    isSaved,
    incrementViews,
    addInquiry,
    markAsSold,
    deleteProduct,
  } = useMarketplace();

  const [product, setProduct] = useState<Product | undefined>();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [message, setMessage] = useState('');
  const [showInquiries, setShowInquiries] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (productId) {
      const p = getProductById(productId);
      setProduct(p);
      if (p) {
        incrementViews(productId);
      }
    }
  }, [productId, getProductById, incrementViews]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const isOwner = product?.sellerId === 'current-user';
  const saved = product ? isSaved(product.id) : false;

  const onPressHaptic = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleBack = useCallback(() => {
    onPressHaptic();
    router.back();
  }, [onPressHaptic, router]);

  const handleSave = useCallback(() => {
    if (!product) return;
    onPressHaptic();
    if (saved) {
      unsaveProduct(product.id);
    } else {
      saveProduct(product.id);
    }
  }, [product, saved, onPressHaptic, saveProduct, unsaveProduct]);

  const handleShare = useCallback(() => {
    onPressHaptic();
    Alert.alert('Share', 'Share functionality coming soon!');
  }, [onPressHaptic]);

  const handleSendMessage = useCallback(() => {
    if (!product || !message.trim()) return;
    onPressHaptic();
    addInquiry(product.id, {
      userId: 'current-user',
      userName: 'You',
      userAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop',
      message: message.trim(),
    });
    setMessage('');
    Alert.alert('Message Sent', 'Your message has been sent to the seller.');
  }, [product, message, onPressHaptic, addInquiry]);

  const handleOfferSwap = useCallback(() => {
    if (!product) return;
    onPressHaptic();
    addInquiry(product.id, {
      userId: 'current-user',
      userName: 'You',
      userAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop',
      message: "I'd like to offer a skill swap for this item. Let me know what services you're interested in!",
      isSwapOffer: true,
    });
    Alert.alert('Swap Offer Sent', 'Your swap offer has been sent to the seller.');
  }, [product, onPressHaptic, addInquiry]);

  const handleMarkAsSold = useCallback(() => {
    if (!product) return;
    onPressHaptic();
    Alert.alert(
      'Mark as Sold',
      'Are you sure you want to mark this item as sold?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Sold',
          onPress: () => {
            markAsSold(product.id);
            router.back();
          },
        },
      ]
    );
  }, [product, onPressHaptic, markAsSold, router]);

  const handleDelete = useCallback(() => {
    if (!product) return;
    onPressHaptic();
    Alert.alert(
      'Delete Listing',
      'Are you sure you want to delete this listing?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteProduct(product.id);
            router.back();
          },
        },
      ]
    );
  }, [product, onPressHaptic, deleteProduct, router]);

  const handleSellerProfile = useCallback(() => {
    if (!product) return;
    onPressHaptic();
    router.push(`/user/${product.sellerId}` as any);
  }, [product, onPressHaptic, router]);

  if (!product) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
          <Text style={[styles.loadingText, { color: colors.text }]}>Product not found</Text>
          <TouchableOpacity onPress={handleBack} style={[styles.backButton, { backgroundColor: colors.surface }]}>
            <Text style={[styles.backButtonText, { color: colors.accent }]}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: isOwner ? 20 : 100 }}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.imageContainer}>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => {
                  const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                  setCurrentImageIndex(index);
                }}
              >
                {product.images.map((img, idx) => (
                  <Image
                    key={img.id}
                    source={{ uri: img.uri }}
                    style={styles.productImage}
                  />
                ))}
              </ScrollView>

              <View style={[styles.imageHeader, { paddingTop: insets.top + 10 }]}>
                <TouchableOpacity
                  style={[styles.headerButton, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
                  onPress={handleBack}
                >
                  <ArrowLeft size={22} color="#fff" />
                </TouchableOpacity>
                <View style={styles.headerRight}>
                  {!isOwner && (
                    <TouchableOpacity
                      style={[styles.headerButton, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
                      onPress={handleSave}
                    >
                      <Heart
                        size={22}
                        color={saved ? '#FF6B6B' : '#fff'}
                        fill={saved ? '#FF6B6B' : 'transparent'}
                      />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.headerButton, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
                    onPress={handleShare}
                  >
                    <Share2 size={20} color="#fff" />
                  </TouchableOpacity>
                  {isOwner && (
                    <TouchableOpacity
                      style={[styles.headerButton, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
                      onPress={() => setShowActions(!showActions)}
                    >
                      <MoreHorizontal size={22} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {product.images.length > 1 && (
                <View style={styles.imageDots}>
                  {product.images.map((_, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.dot,
                        {
                          backgroundColor: idx === currentImageIndex ? '#fff' : 'rgba(255,255,255,0.4)',
                        },
                      ]}
                    />
                  ))}
                </View>
              )}

              {product.acceptsSwap && (
                <View style={[styles.swapBadge, { backgroundColor: '#10B981' }]}>
                  <RefreshCw size={14} color="#fff" />
                  <Text style={styles.swapBadgeText}>Open to Swaps</Text>
                </View>
              )}
            </View>

            {showActions && isOwner && (
              <View style={[styles.actionsMenu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TouchableOpacity style={styles.actionItem} onPress={handleMarkAsSold}>
                  <CheckCircle size={20} color="#10B981" />
                  <Text style={[styles.actionText, { color: colors.text }]}>Mark as Sold</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionItem} onPress={() => Alert.alert('Edit', 'Edit coming soon')}>
                  <Edit3 size={20} color={colors.accent} />
                  <Text style={[styles.actionText, { color: colors.text }]}>Edit Listing</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionItem} onPress={handleDelete}>
                  <Trash2 size={20} color="#FF6B6B" />
                  <Text style={[styles.actionText, { color: '#FF6B6B' }]}>Delete Listing</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.content}>
              <View style={styles.priceRow}>
                <Text style={[styles.price, { color: colors.text }]}>
                  ${product.price.toLocaleString()}
                </Text>
                <View style={[styles.conditionTag, { backgroundColor: colors.accent + '20' }]}>
                  <Text style={[styles.conditionTagText, { color: colors.accent }]}>
                    {getConditionLabel(product.condition)}
                  </Text>
                </View>
              </View>

              <Text style={[styles.title, { color: colors.text }]}>{product.title}</Text>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <MapPin size={14} color={colors.textSecondary} />
                  <Text style={[styles.metaText, { color: colors.textSecondary }]}>{product.location}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Clock size={14} color={colors.textSecondary} />
                  <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                    {formatDate(product.createdAt)}
                  </Text>
                </View>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Eye size={18} color={colors.textTertiary} />
                  <Text style={[styles.statValue, { color: colors.text }]}>{product.views}</Text>
                  <Text style={[styles.statLabel, { color: colors.textTertiary }]}>views</Text>
                </View>
                <View style={styles.statBox}>
                  <Heart size={18} color={colors.textTertiary} />
                  <Text style={[styles.statValue, { color: colors.text }]}>{product.saves}</Text>
                  <Text style={[styles.statLabel, { color: colors.textTertiary }]}>saves</Text>
                </View>
                <View style={styles.statBox}>
                  <MessageCircle size={18} color={colors.textTertiary} />
                  <Text style={[styles.statValue, { color: colors.text }]}>{product.inquiries.length}</Text>
                  <Text style={[styles.statLabel, { color: colors.textTertiary }]}>inquiries</Text>
                </View>
              </View>

              <View style={[styles.section, { borderTopColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Description</Text>
                <Text style={[styles.description, { color: colors.textSecondary }]}>
                  {product.description}
                </Text>
              </View>

              <View style={[styles.section, { borderTopColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Details</Text>
                <View style={styles.detailsGrid}>
                  <View style={styles.detailItem}>
                    <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Category</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {getCategoryLabel(product.category)}
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Condition</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {getConditionLabel(product.condition)}
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Accepts Swap</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>
                      {product.acceptsSwap ? 'Yes' : 'No'}
                    </Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.sellerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={handleSellerProfile}
                activeOpacity={0.8}
              >
                <Image source={{ uri: product.sellerAvatar }} style={styles.sellerAvatar} />
                <View style={styles.sellerInfo}>
                  <Text style={[styles.sellerName, { color: colors.text }]}>{product.sellerName}</Text>
                  <Text style={[styles.sellerUsername, { color: colors.textSecondary }]}>
                    @{product.sellerUsername}
                  </Text>
                </View>
                <View style={[styles.viewProfileButton, { backgroundColor: colors.accent + '15' }]}>
                  <User size={16} color={colors.accent} />
                  <Text style={[styles.viewProfileText, { color: colors.accent }]}>Profile</Text>
                </View>
              </TouchableOpacity>

              {isOwner && product.inquiries.length > 0 && (
                <View style={[styles.section, { borderTopColor: colors.border }]}>
                  <TouchableOpacity
                    style={styles.inquiriesHeader}
                    onPress={() => setShowInquiries(!showInquiries)}
                  >
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                      Inquiries ({product.inquiries.length})
                    </Text>
                    <Text style={[styles.toggleText, { color: colors.accent }]}>
                      {showInquiries ? 'Hide' : 'Show'}
                    </Text>
                  </TouchableOpacity>
                  
                  {showInquiries && (
                    <View style={styles.inquiriesList}>
                      {product.inquiries.map((inquiry) => (
                        <View
                          key={inquiry.id}
                          style={[styles.inquiryCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                        >
                          <View style={styles.inquiryHeader}>
                            <Image source={{ uri: inquiry.userAvatar }} style={styles.inquiryAvatar} />
                            <View style={styles.inquiryMeta}>
                              <Text style={[styles.inquiryName, { color: colors.text }]}>{inquiry.userName}</Text>
                              <Text style={[styles.inquiryTime, { color: colors.textTertiary }]}>
                                {formatDate(inquiry.timestamp)}
                              </Text>
                            </View>
                            {inquiry.isSwapOffer && (
                              <View style={[styles.swapOfferTag, { backgroundColor: '#10B981' }]}>
                                <RefreshCw size={10} color="#fff" />
                                <Text style={styles.swapOfferText}>Swap</Text>
                              </View>
                            )}
                            {!inquiry.read && (
                              <View style={styles.unreadDot} />
                            )}
                          </View>
                          <Text style={[styles.inquiryMessage, { color: colors.textSecondary }]}>
                            {inquiry.message}
                          </Text>
                          <TouchableOpacity
                            style={[styles.replyButton, { borderColor: colors.border }]}
                            onPress={() => router.push(`/user/${inquiry.userId}` as any)}
                          >
                            <MessageCircle size={14} color={colors.accent} />
                            <Text style={[styles.replyButtonText, { color: colors.accent }]}>Reply</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>
          </ScrollView>

          {!isOwner && (
            <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom + 10 }]}>
              {product.acceptsSwap && (
                <TouchableOpacity
                  style={[styles.swapButton, { backgroundColor: '#10B981' }]}
                  onPress={handleOfferSwap}
                >
                  <RefreshCw size={18} color="#fff" />
                  <Text style={styles.swapButtonText}>Offer Swap</Text>
                </TouchableOpacity>
              )}
              <View style={[styles.messageInputWrap, { backgroundColor: colors.surface, borderColor: colors.border, flex: product.acceptsSwap ? 1 : undefined }]}>
                <TextInput
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Ask about this item..."
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.messageInput, { color: colors.text }]}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.sendButton, { backgroundColor: message.trim() ? colors.accent : colors.border }]}
                  onPress={handleSendMessage}
                  disabled={!message.trim()}
                >
                  <Send size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.85,
    position: 'relative',
  },
  productImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.85,
  },
  imageHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 10,
  },
  imageDots: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  swapBadge: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  swapBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700' as const,
  },
  actionsMenu: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  actionText: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  content: {
    padding: 16,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  price: {
    fontSize: 28,
    fontWeight: '800' as const,
  },
  conditionTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  conditionTagText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    marginTop: 8,
    lineHeight: 28,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginTop: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(128,128,128,0.08)',
    gap: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500' as const,
  },
  section: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
  },
  detailsGrid: {
    gap: 12,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 24,
    gap: 12,
  },
  sellerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  sellerInfo: {
    flex: 1,
  },
  sellerName: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  sellerUsername: {
    fontSize: 13,
    fontWeight: '500' as const,
    marginTop: 2,
  },
  viewProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  viewProfileText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  inquiriesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  inquiriesList: {
    gap: 12,
    marginTop: 12,
  },
  inquiryCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  inquiryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inquiryAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  inquiryMeta: {
    flex: 1,
  },
  inquiryName: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  inquiryTime: {
    fontSize: 11,
    fontWeight: '500' as const,
    marginTop: 2,
  },
  swapOfferTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  swapOfferText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700' as const,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF6B6B',
  },
  inquiryMessage: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: 10,
  },
  replyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  replyButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  swapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
  },
  swapButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  messageInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingLeft: 14,
    paddingRight: 6,
    minHeight: 50,
  },
  messageInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500' as const,
    maxHeight: 80,
    paddingVertical: 10,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
