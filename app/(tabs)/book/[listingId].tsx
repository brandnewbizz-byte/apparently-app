import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Heart,
  Share2,
  Star,
  MapPin,
  Zap,
  Calendar,
  Users,
  ChevronRight,
  Shield,
  Home,
  Car,
  Ship,
  MessageSquare,
  X,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/contexts/ThemeContext';
import { useBookings, type Listing, type ListingCategory } from '@/contexts/BookingsContext';

import { useLifeCrm } from '@/contexts/LifeCrmContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function chipBg(isDark: boolean) {
  return isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
}

function getCategoryIcon(category: ListingCategory) {
  switch (category) {
    case 'stay':
      return Home;
    case 'car':
      return Car;
    case 'boat':
      return Ship;
    default:
      return Home;
  }
}

export default function ListingDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { listingId } = useLocalSearchParams<{ listingId: string }>();
  const { colors, isDark } = useTheme();

  const { getListingById, toggleFavorite, isFavorite, createBooking } = useBookings();
  
  const { addBill } = useLifeCrm();

  const listing = getListingById(listingId ?? '');
  const isFav = isFavorite(listingId ?? '');

  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const [showBookingModal, setShowBookingModal] = useState<boolean>(false);
  const [bookingDates, setBookingDates] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [guestCount, setGuestCount] = useState<number>(1);
  const [message, setMessage] = useState<string>('');

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 240,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const onPressHaptic = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleBack = useCallback(() => {
    onPressHaptic();
    router.back();
  }, [onPressHaptic, router]);

  const handleFavorite = useCallback(() => {
    onPressHaptic();
    toggleFavorite(listingId ?? '');
  }, [onPressHaptic, toggleFavorite, listingId]);

  const handleShare = useCallback(() => {
    onPressHaptic();
    Alert.alert('Share', 'Share this listing with friends!');
  }, [onPressHaptic]);

  const openBooking = useCallback(() => {
    onPressHaptic();
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 2);
    setBookingDates({
      start: tomorrow.toISOString().split('T')[0],
      end: dayAfter.toISOString().split('T')[0],
    });
    setShowBookingModal(true);
  }, [onPressHaptic]);

  const totalPrice = useMemo(() => {
    if (!listing || !bookingDates.start || !bookingDates.end) return 0;
    const start = new Date(bookingDates.start);
    const end = new Date(bookingDates.end);
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    return listing.pricePerDay * days;
  }, [bookingDates.end, bookingDates.start, listing]);

  const handleConfirmBooking = useCallback(() => {
    if (!listing || !bookingDates.start || !bookingDates.end) {
      Alert.alert('Error', 'Please select valid dates');
      return;
    }

    onPressHaptic();

    createBooking({
      listingId: listing.id,
      startDate: bookingDates.start,
      endDate: bookingDates.end,
      guestCount,
      message: message.trim() || undefined,
    });

    addBill({
      name: listing.instantBook ? `Booking: ${listing.title}` : `Booking request: ${listing.title}`,
      amount: totalPrice,
      dueDate: listing.instantBook ? new Date().toISOString() : bookingDates.start,
      category: 'other',
      isPaid: listing.instantBook,
      isRecurring: false,
    });

    setShowBookingModal(false);

    Alert.alert(
      listing.instantBook ? 'Booking Confirmed!' : 'Request Sent!',
      listing.instantBook
        ? 'Your booking has been confirmed. Next: consider offering a service to reduce future costs.'
        : 'The host will review your request soon.',
      [{ text: 'OK' }]
    );
  }, [addBill, bookingDates.end, bookingDates.start, createBooking, guestCount, listing, message, onPressHaptic, totalPrice]);

  if (!listing) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]} testID="listingNotFound">
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.notFound, { paddingTop: insets.top + 60 }]}> 
          <Text style={[styles.notFoundTitle, { color: colors.text }]}>Listing not found</Text>
          <TouchableOpacity onPress={handleBack} style={[styles.primaryBtn, { backgroundColor: colors.accent }]} testID="listingBackNotFound">
            <Text style={styles.primaryBtnText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const CategoryIcon = getCategoryIcon(listing.category);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]} testID="listingDetailScreen">
      <Stack.Screen options={{ headerShown: false }} />

      <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                setCurrentImageIndex(index);
              }}
            >
              {listing.images.map((img, idx) => (
                <Image key={idx} source={{ uri: img }} style={styles.heroImage} />
              ))}
            </ScrollView>

            <View style={[styles.heroNav, { top: insets.top + 10 }]}> 
              <TouchableOpacity onPress={handleBack} style={[styles.navBtn, { backgroundColor: 'rgba(0,0,0,0.45)' }]} testID="listingBackButton">
                <ArrowLeft size={20} color="#fff" />
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity onPress={handleShare} style={[styles.navBtn, { backgroundColor: 'rgba(0,0,0,0.45)' }]} testID="listingShareButton">
                  <Share2 size={18} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleFavorite} style={[styles.navBtn, { backgroundColor: 'rgba(0,0,0,0.45)' }]} testID="listingFavButton">
                  <Heart size={18} color={isFav ? '#FF6B6B' : '#fff'} fill={isFav ? '#FF6B6B' : 'transparent'} />
                </TouchableOpacity>
              </View>
            </View>

            {listing.images.length > 1 ? (
              <View style={styles.dots}>
                {listing.images.map((_, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.dot,
                      {
                        opacity: idx === currentImageIndex ? 1 : 0.45,
                        backgroundColor: '#fff',
                      },
                    ]}
                  />
                ))}
              </View>
            ) : null}

            <View style={[styles.categoryPill, { backgroundColor: colors.accent }]}>
              <CategoryIcon size={14} color="#fff" />
              <Text style={styles.categoryPillText}>{listing.category.toUpperCase()}</Text>
            </View>
          </View>

          <View style={styles.body}>
            <Text style={[styles.title, { color: colors.text }]}>{listing.title}</Text>

            <View style={styles.metaRow}>
              <View style={styles.ratingRow}>
                <Star size={14} color="#FFB800" fill="#FFB800" />
                <Text style={[styles.ratingText, { color: colors.text }]}>{listing.rating}</Text>
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>{`(${listing.reviewCount})`}</Text>
              </View>
              <View style={styles.locationRow}>
                <MapPin size={14} color={colors.textSecondary} />
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>{listing.location}</Text>
              </View>
            </View>

            <View style={[styles.hostCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}> 
              <Image source={{ uri: listing.host.avatar }} style={styles.hostAvatar} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.hostName, { color: colors.text }]}>{`Hosted by ${listing.host.name}`}</Text>
                {listing.host.isVerified ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <Shield size={12} color={colors.accent} />
                    <Text style={[styles.hostVerified, { color: colors.accent }]}>Verified</Text>
                  </View>
                ) : null}
              </View>
              <TouchableOpacity style={[styles.messageBtn, { borderColor: colors.border }]} testID="listingMessageHost">
                <MessageSquare size={18} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>About</Text>
            <Text style={[styles.desc, { color: colors.textSecondary }]}>{listing.description}</Text>

            <View style={[styles.inlinePrompt, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="listingServicePrompt">
              <View style={[styles.inlinePromptIcon, { backgroundColor: colors.accentGlow }]}> 
                <Zap size={16} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inlinePromptTitle, { color: colors.text }]}>Reduce the cost by offering a service</Text>
                <Text style={[styles.inlinePromptBody, { color: colors.textSecondary }]}>Post a paid service (or a swap) and apply value toward a stay, car, or boat.</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  onPressHaptic();
                  const prefillTitle = `Offer a service to reduce this ${listing.category}`;
                  const prefillDetails = `I'm interested in ${listing.title} in ${listing.location}. I'm open to offering a service to reduce the cost.\n\nDesired dates: ${bookingDates.start || '—'} to ${bookingDates.end || '—'}.\nBudget/target discount: $`;

                  router.push({
                    pathname: '/(tabs)/swap' as any,
                    params: {
                      openCreate: '1',
                      mode: 'paid',
                      from: 'booking',
                      title: prefillTitle,
                      needing: `Discount/credit toward ${listing.title}`,
                      offering: '',
                      details: prefillDetails,
                      category: 'Business',
                    },
                  });
                }}
                style={[styles.inlinePromptCta, { backgroundColor: colors.accent }]}
                testID="listingServicePromptCta"
              >
                <Text style={styles.inlinePromptCtaText}>Post</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: colors.background, borderColor: colors.border, paddingBottom: insets.bottom + 12 }]}> 
          <View style={{ flex: 1 }}>
            <Text style={[styles.price, { color: colors.text }]}>${listing.pricePerDay}<Text style={[styles.perDay, { color: colors.textSecondary }]}> / day</Text></Text>
            {listing.pricePerHour ? (
              <Text style={[styles.hourly, { color: colors.textSecondary }]}>or ${listing.pricePerHour}/hr</Text>
            ) : null}
          </View>

          <View style={styles.footerBtns}>
            <TouchableOpacity onPress={openBooking} style={[styles.bookBtn, { backgroundColor: colors.accent }]} testID="bookNowButton">
              <Text style={styles.bookBtnText}>{listing.instantBook ? 'Book Now' : 'Request to Book'}</Text>
              <ChevronRight size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <BookingModal
          visible={showBookingModal}
          onClose={() => setShowBookingModal(false)}
          listing={listing}
          colors={colors}
          isDark={isDark}
          bookingDates={bookingDates}
          setBookingDates={setBookingDates}
          guestCount={guestCount}
          setGuestCount={setGuestCount}
          message={message}
          setMessage={setMessage}
          totalPrice={totalPrice}
          onConfirm={handleConfirmBooking}
        />
      </Animated.View>
    </View>
  );
}

function BookingModal({
  visible,
  onClose,
  listing,
  colors,
  isDark,
  bookingDates,
  setBookingDates,
  guestCount,
  setGuestCount,
  message,
  setMessage,
  totalPrice,
  onConfirm,
}: {
  visible: boolean;
  onClose: () => void;
  listing: Listing;
  colors: any;
  isDark: boolean;
  bookingDates: { start: string; end: string };
  setBookingDates: (dates: { start: string; end: string }) => void;
  guestCount: number;
  setGuestCount: (count: number) => void;
  message: string;
  setMessage: (msg: string) => void;
  totalPrice: number;
  onConfirm: () => void;
}) {
  const insets = useSafeAreaInsets();

  const days = useMemo(() => {
    if (!bookingDates.start || !bookingDates.end) return 1;
    const start = new Date(bookingDates.start);
    const end = new Date(bookingDates.end);
    return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  }, [bookingDates.end, bookingDates.start]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.modalSheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]} testID="bookingModal">
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Confirm booking</Text>
            <TouchableOpacity onPress={onClose} style={[styles.modalClose, { backgroundColor: chipBg(isDark) }]} testID="bookingModalClose">
              <X size={18} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
            <View style={[styles.bookingCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              <Image source={{ uri: listing.images[0] }} style={styles.bookingImage} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.bookingTitle, { color: colors.text }]} numberOfLines={2}>
                  {listing.title}
                </Text>
                <Text style={[styles.bookingMeta, { color: colors.textSecondary }]}>{listing.location}</Text>
              </View>
            </View>

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Dates</Text>
            <View style={styles.dateRow}>
              <View style={[styles.field, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                <Calendar size={16} color={colors.textSecondary} />
                <TextInput
                  value={bookingDates.start}
                  onChangeText={(t) => setBookingDates({ ...bookingDates, start: t })}
                  placeholder="Start (YYYY-MM-DD)"
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.fieldInput, { color: colors.text }]}
                  testID="bookingStartDate"
                />
              </View>
              <View style={[styles.field, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                <Calendar size={16} color={colors.textSecondary} />
                <TextInput
                  value={bookingDates.end}
                  onChangeText={(t) => setBookingDates({ ...bookingDates, end: t })}
                  placeholder="End (YYYY-MM-DD)"
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.fieldInput, { color: colors.text }]}
                  testID="bookingEndDate"
                />
              </View>
            </View>

            <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 12 }]}>Guests</Text>
            <View style={[styles.guestRow, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              <Users size={16} color={colors.textSecondary} />
              <TouchableOpacity
                onPress={() => setGuestCount(Math.max(1, guestCount - 1))}
                style={[styles.counterBtn, { backgroundColor: chipBg(isDark) }]}
                testID="bookingGuestsMinus"
              >
                <Text style={[styles.counterText, { color: colors.text }]}>−</Text>
              </TouchableOpacity>
              <Text style={[styles.guestCount, { color: colors.text }]} testID="bookingGuestsCount">
                {guestCount}
              </Text>
              <TouchableOpacity
                onPress={() => setGuestCount(guestCount + 1)}
                style={[styles.counterBtn, { backgroundColor: chipBg(isDark) }]}
                testID="bookingGuestsPlus"
              >
                <Text style={[styles.counterText, { color: colors.text }]}>+</Text>
              </TouchableOpacity>
            </View>

            {!listing.instantBook ? (
              <>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 12 }]}>Message (optional)</Text>
                <TextInput
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Introduce yourself and explain your trip…"
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.messageInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  testID="bookingMessage"
                />
              </>
            ) : null}

            <View style={[styles.priceBox, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              <Text style={[styles.priceBoxTitle, { color: colors.text }]}>Price</Text>
              <Text style={[styles.priceBoxMeta, { color: colors.textSecondary }]}>{`$${listing.pricePerDay} × ${days} ${days === 1 ? 'day' : 'days'}`}</Text>
              <Text style={[styles.priceBoxTotal, { color: colors.text }]} testID="bookingTotalPrice">{`$${totalPrice}`}</Text>
            </View>
          </ScrollView>

          <TouchableOpacity onPress={onConfirm} style={[styles.confirmBtn, { backgroundColor: colors.accent }]} testID="bookingConfirm">
            <Text style={styles.confirmBtnText}>{listing.instantBook ? 'Confirm & Pay' : 'Request to Book'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  notFound: { alignItems: 'center', paddingHorizontal: 20 },
  notFoundTitle: { fontSize: 18, fontWeight: '800' as const, marginBottom: 14 },
  primaryBtn: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12 },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' as const },

  hero: { position: 'relative' },
  heroImage: { width: SCREEN_WIDTH, height: 300, backgroundColor: '#000' },
  heroNav: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: { position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  categoryPill: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  categoryPillText: { color: '#fff', fontSize: 11, fontWeight: '900' as const, letterSpacing: 0.6 },

  body: { paddingHorizontal: 16, paddingTop: 14 },
  title: { fontSize: 22, fontWeight: '900' as const, letterSpacing: -0.4 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, gap: 12 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratingText: { fontSize: 13, fontWeight: '900' as const },
  metaText: { fontSize: 13, fontWeight: '600' as const },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'flex-end' },

  hostCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, marginTop: 14 },
  hostAvatar: { width: 46, height: 46, borderRadius: 16 },
  hostName: { fontSize: 14, fontWeight: '900' as const },
  hostVerified: { fontSize: 12, fontWeight: '800' as const },
  messageBtn: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  sectionTitle: { marginTop: 18, fontSize: 15, fontWeight: '900' as const },
  desc: { marginTop: 8, fontSize: 14, fontWeight: '500' as const, lineHeight: 22 },

  inlinePrompt: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inlinePromptIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  inlinePromptTitle: { fontSize: 13, fontWeight: '900' as const },
  inlinePromptBody: { marginTop: 2, fontSize: 12, fontWeight: '600' as const, lineHeight: 16 },
  inlinePromptCta: { height: 34, paddingHorizontal: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  inlinePromptCtaText: { color: '#fff', fontSize: 12, fontWeight: '900' as const },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  price: { fontSize: 18, fontWeight: '900' as const },
  perDay: { fontSize: 13, fontWeight: '600' as const },
  hourly: { marginTop: 2, fontSize: 12, fontWeight: '600' as const },
  footerBtns: { flex: 1, alignItems: 'flex-end' },
  bookBtn: { height: 48, borderRadius: 16, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  bookBtnText: { color: '#fff', fontSize: 14, fontWeight: '900' as const },

  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 14, maxHeight: '92%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalTitle: { fontSize: 16, fontWeight: '900' as const },
  modalClose: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  bookingCard: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
  bookingImage: { width: 64, height: 64, borderRadius: 12 },
  bookingTitle: { fontSize: 14, fontWeight: '900' as const },
  bookingMeta: { marginTop: 4, fontSize: 12, fontWeight: '600' as const },

  fieldLabel: { fontSize: 11, fontWeight: '900' as const, textTransform: 'uppercase', letterSpacing: 0.7, marginTop: 6, marginBottom: 8 },
  dateRow: { flexDirection: 'row', gap: 10 },
  field: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, height: 46 },
  fieldInput: { flex: 1, fontSize: 13, fontWeight: '700' as const },

  guestRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, height: 46 },
  counterBtn: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  counterText: { fontSize: 18, fontWeight: '900' as const },
  guestCount: { minWidth: 18, textAlign: 'center', fontSize: 14, fontWeight: '900' as const },

  messageInput: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, minHeight: 96, fontSize: 13, fontWeight: '600' as const },

  priceBox: { borderWidth: 1, borderRadius: 16, padding: 14, marginTop: 12 },
  priceBoxTitle: { fontSize: 12, fontWeight: '900' as const },
  priceBoxMeta: { marginTop: 6, fontSize: 12, fontWeight: '600' as const },
  priceBoxTotal: { marginTop: 8, fontSize: 20, fontWeight: '900' as const, letterSpacing: -0.3 },

  confirmBtn: { height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '900' as const },
});
