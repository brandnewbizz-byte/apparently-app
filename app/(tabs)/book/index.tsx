import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Animated,
  Platform,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Search,
  X,
  Home,
  Car,
  Ship,
  Star,
  MapPin,
  Heart,
  Zap,
  SlidersHorizontal,
  ShoppingBag,
  Calendar,
  Plus,
  FileText,
  Package,
  Smartphone,
  Shirt,
  Dumbbell,
  Palette,
  Box,
  RefreshCw,
  Eye,
  MessageCircle,
  Tag,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/contexts/ThemeContext';
import { useBookings, type ListingCategory, type Listing } from '@/contexts/BookingsContext';
import { useTabBar } from '@/contexts/TabBarContext';
import CreateRentalModal from '@/components/CreateRentalModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type ListingType = 'all' | 'rental' | 'sale';
type CategoryFilter = 'all' | ListingCategory;

const LISTING_TYPE_OPTIONS: { key: ListingType; label: string; icon: React.ComponentType<any> }[] = [
  { key: 'all', label: 'All', icon: Package },
  { key: 'rental', label: 'Rentals', icon: Calendar },
  { key: 'sale', label: 'For Sale', icon: Tag },
];

const RENTAL_CATEGORIES: { key: ListingCategory | 'all'; label: string; icon: React.ComponentType<any> }[] = [
  { key: 'all', label: 'All', icon: SlidersHorizontal },
  { key: 'stay', label: 'Stays', icon: Home },
  { key: 'car', label: 'Cars', icon: Car },
  { key: 'boat', label: 'Boats', icon: Ship },
];

const PRODUCT_CATEGORIES: { key: 'all' | 'product'; label: string; icon: React.ComponentType<any> }[] = [
  { key: 'all', label: 'All', icon: Package },
  { key: 'product', label: 'Items', icon: ShoppingBag },
];

function chipBg(isDark: boolean) {
  return isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
}

function getConditionLabel(condition: string): string {
  const labels: Record<string, string> = {
    new: 'New',
    like_new: 'Like New',
    good: 'Good',
    fair: 'Fair',
    used: 'Used',
  };
  return labels[condition] || condition;
}

interface UnifiedListing {
  id: string;
  type: 'rental' | 'sale';
  title: string;
  description: string;
  images: string[];
  location: string;
  price: number;
  priceLabel: string;
  rating?: number;
  reviewCount?: number;
  category: string;
  sellerId: string;
  sellerName: string;
  sellerAvatar: string;
  instantBook?: boolean;
  condition?: string;
  acceptsSwap?: boolean;
  views?: number;
  inquiries?: number;
  createdAt: string;
}

export default function BookScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { handleScroll: handleTabBarScroll } = useTabBar();
  const {
    listings,
    searchListings,
    toggleFavorite,
    isFavorite,
    isLoading: isLoadingRentals,
  } = useBookings();

  const [listingType, setListingType] = useState<ListingType>('all');
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const unifiedListings = useMemo((): UnifiedListing[] => {
    const rentalItems: UnifiedListing[] = listings.map((l) => ({
      id: l.id,
      type: 'rental' as const,
      title: l.title,
      description: l.description,
      images: l.images,
      location: l.location,
      price: l.pricePerDay,
      priceLabel: `$${l.pricePerDay}/day`,
      rating: l.rating,
      reviewCount: l.reviewCount,
      category: l.category,
      sellerId: l.host.id,
      sellerName: l.host.name,
      sellerAvatar: l.host.avatar,
      instantBook: l.instantBook,
      createdAt: l.createdAt,
    }));

    const productItems: UnifiedListing[] = listings
      .filter((l) => l.category === 'product')
      .map((l) => ({
        id: l.id,
        type: 'sale' as const,
        title: l.title,
        description: l.description,
        images: l.images,
        location: l.location,
        price: l.pricePerDay,
        priceLabel: l.pricePerDay === 0 ? 'Negotiable' : `${l.pricePerDay.toLocaleString()}`,
        category: l.category,
        sellerId: l.host.id,
        sellerName: l.host.name,
        sellerAvatar: l.host.avatar,
        condition: l.specs?.condition,
        acceptsSwap: (l.specs?.acceptsSwap ?? 'false') === 'true',
        views: l.views ?? 0,
        inquiries: l.messagesCount ?? 0,
        createdAt: l.createdAt,
      }));

    return [...rentalItems, ...productItems].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [listings]);

  const filteredListings = useMemo(() => {
    let results = unifiedListings;

    if (listingType !== 'all') {
      results = results.filter((l) => l.type === listingType);
    }

    if (activeCategory !== 'all') {
      results = results.filter((l) => l.category === activeCategory);
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      results = results.filter((l) => {
        const blob = `${l.title} ${l.description} ${l.location} ${l.sellerName}`.toLowerCase();
        return blob.includes(q);
      });
    }

    return results;
  }, [unifiedListings, listingType, activeCategory, search]);

  const featuredListings = useMemo(() => {
    return unifiedListings
      .filter((l) => l.type === 'rental' && l.rating && l.rating >= 4.9)
      .slice(0, 5);
  }, [unifiedListings]);

  const currentCategories = useMemo(() => {
    if (listingType === 'rental') return RENTAL_CATEGORIES;
    if (listingType === 'sale') return PRODUCT_CATEGORIES;
    return [{ key: 'all' as const, label: 'All', icon: SlidersHorizontal }];
  }, [listingType]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const onPressHaptic = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleListingTypeChange = useCallback((type: ListingType) => {
    onPressHaptic();
    setListingType(type);
    setActiveCategory('all');
  }, [onPressHaptic]);

  const handleCategoryChange = useCallback((cat: CategoryFilter) => {
    onPressHaptic();
    setActiveCategory(cat);
  }, [onPressHaptic]);

  const handleListingPress = useCallback((listing: UnifiedListing) => {
    onPressHaptic();
    if (listing.type === 'rental') {
      router.push(`/book/${listing.id}` as any);
    } else {
      router.push(`/book/product/${listing.id}` as any);
    }
  }, [onPressHaptic, router]);

  const handleFavoritePress = useCallback((listing: UnifiedListing) => {
    onPressHaptic();
    toggleFavorite(listing.id);
  }, [onPressHaptic, toggleFavorite]);

  const isItemFavorite = useCallback((listing: UnifiedListing) => {
    return isFavorite(listing.id);
  }, [isFavorite]);

  const getCategoryIcon = (category: string): React.ComponentType<any> => {
    const allCategories = [...RENTAL_CATEGORIES, ...PRODUCT_CATEGORIES];
    const found = allCategories.find((c) => c.key === category);
    return found?.icon || Package;
  };

  const isLoading = isLoadingRentals;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]} testID="bookScreen">
      <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
        <View style={[styles.header, { paddingTop: insets.top + 4, backgroundColor: colors.background }]}>
          <View style={styles.headerTop}>
            <View>
              <Text style={[styles.title, { color: colors.text }]}>Listings</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Rent or buy
              </Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={[styles.myListingsButton, { backgroundColor: chipBg(isDark), borderColor: colors.border }]}
                onPress={() => {
                  onPressHaptic();
                  router.push('/book/my-rentals' as any);
                }}
                testID="myListingsButton"
              >
                <FileText size={16} color={colors.textSecondary} />
                <Text style={[styles.myListingsText, { color: colors.textSecondary }]}>My Listings</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: colors.accent }]}
                onPress={() => {
                  onPressHaptic();
                  setShowCreateModal(true);
                }}
                testID="addListingButton"
              >
                <Plus size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.typeFilterRow}>
            {LISTING_TYPE_OPTIONS.map((opt) => {
              const isActive = listingType === opt.key;
              const Icon = opt.icon;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.typeFilterPill,
                    {
                      backgroundColor: isActive ? colors.accent : chipBg(isDark),
                      borderColor: isActive ? colors.accent : colors.border,
                    },
                  ]}
                  onPress={() => handleListingTypeChange(opt.key)}
                  testID={`typeFilter_${opt.key}`}
                >
                  <Icon size={16} color={isActive ? '#fff' : colors.textSecondary} />
                  <Text
                    style={[
                      styles.typeFilterText,
                      { color: isActive ? '#fff' : colors.textSecondary },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={[styles.searchWrap, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
            <Search size={18} color={colors.textSecondary} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search listings..."
              placeholderTextColor={colors.textTertiary}
              style={[styles.searchInput, { color: colors.text }]}
              testID="listingSearchInput"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} testID="listingSearchClear">
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {listingType !== 'all' && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryRow}
            >
              {currentCategories.map((cat) => {
                const isActive = activeCategory === cat.key;
                const Icon = cat.icon;
                return (
                  <TouchableOpacity
                    key={cat.key}
                    onPress={() => handleCategoryChange(cat.key as CategoryFilter)}
                    style={[
                      styles.categoryPill,
                      {
                        backgroundColor: isActive ? colors.accent : chipBg(isDark),
                        borderColor: isActive ? colors.accent : colors.border,
                      },
                    ]}
                    testID={`category_${cat.key}`}
                  >
                    <Icon size={16} color={isActive ? '#fff' : colors.textSecondary} />
                    <Text
                      style={[
                        styles.categoryText,
                        { color: isActive ? '#fff' : colors.textSecondary },
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 100 }}
          onScroll={(e) => handleTabBarScroll(e.nativeEvent.contentOffset.y)}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          testID="listingsScroll"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          }
        >
          {listingType === 'all' && !search && featuredListings.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Featured Rentals</Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                Top-rated experiences
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.featuredScroll}
              >
                {featuredListings.map((listing) => (
                  <FeaturedCard
                    key={listing.id}
                    listing={listing}
                    colors={colors}
                    isDark={isDark}
                    isFav={isItemFavorite(listing)}
                    onPress={() => handleListingPress(listing)}
                    onFavorite={() => handleFavoritePress(listing)}
                    getCategoryIcon={getCategoryIcon}
                  />
                ))}
              </ScrollView>
            </View>
          )}

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {listingType === 'all' ? 'All Listings' : listingType === 'rental' ? 'Rentals' : 'For Sale'}
                </Text>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                  {filteredListings.length} available
                </Text>
              </View>
            </View>

            {isLoading ? (
              <View style={[styles.emptyCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>Loading...</Text>
              </View>
            ) : filteredListings.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                <Package size={48} color={colors.textTertiary} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No listings found</Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  Try adjusting your filters or be the first to list something!
                </Text>
                <TouchableOpacity
                  style={[styles.emptyButton, { backgroundColor: colors.accent }]}
                  onPress={() => setShowCreateModal(true)}
                >
                  <Plus size={18} color="#fff" />
                  <Text style={styles.emptyButtonText}>Create Listing</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.listingsList}>
                {filteredListings.map((listing) => (
                  <UnifiedListingCard
                    key={`${listing.type}-${listing.id}`}
                    listing={listing}
                    colors={colors}
                    isDark={isDark}
                    isFav={isItemFavorite(listing)}
                    onPress={() => handleListingPress(listing)}
                    onFavorite={() => handleFavoritePress(listing)}
                    getCategoryIcon={getCategoryIcon}
                  />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </Animated.View>

      <CreateRentalModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </View>
  );
}

function FeaturedCard({
  listing,
  colors,
  isDark,
  isFav,
  onPress,
  onFavorite,
  getCategoryIcon,
}: {
  listing: UnifiedListing;
  colors: any;
  isDark: boolean;
  isFav: boolean;
  onPress: () => void;
  onFavorite: () => void;
  getCategoryIcon: (cat: string) => React.ComponentType<any>;
}) {
  const Icon = getCategoryIcon(listing.category);

  return (
    <TouchableOpacity
      style={[styles.featuredCard, { backgroundColor: colors.backgroundSecondary }]}
      onPress={onPress}
      activeOpacity={0.9}
      testID={`featuredCard_${listing.id}`}
    >
      <Image source={{ uri: listing.images[0] }} style={styles.featuredImage} />
      <View style={styles.featuredOverlay}>
        <TouchableOpacity
          onPress={onFavorite}
          style={[styles.favoriteButton, { backgroundColor: 'rgba(0,0,0,0.4)' }]}
          testID={`featuredFav_${listing.id}`}
        >
          <Heart
            size={18}
            color={isFav ? '#FF6B6B' : '#fff'}
            fill={isFav ? '#FF6B6B' : 'transparent'}
          />
        </TouchableOpacity>
        <View style={[styles.categoryBadge, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <Icon size={12} color="#fff" />
        </View>
      </View>
      <View style={styles.featuredContent}>
        <Text style={[styles.featuredTitle, { color: colors.text }]} numberOfLines={1}>
          {listing.title}
        </Text>
        <View style={styles.featuredMeta}>
          <View style={styles.ratingRow}>
            <Star size={12} color="#FFB800" fill="#FFB800" />
            <Text style={[styles.ratingText, { color: colors.text }]}>{listing.rating}</Text>
            <Text style={[styles.reviewCount, { color: colors.textSecondary }]}>
              ({listing.reviewCount})
            </Text>
          </View>
          <Text style={[styles.featuredPrice, { color: colors.accent }]}>
            {listing.priceLabel}
          </Text>
        </View>
        <View style={styles.locationRow}>
          <MapPin size={12} color={colors.textSecondary} />
          <Text style={[styles.locationText, { color: colors.textSecondary }]} numberOfLines={1}>
            {listing.location}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function UnifiedListingCard({
  listing,
  colors,
  isDark,
  isFav,
  onPress,
  onFavorite,
  getCategoryIcon,
}: {
  listing: UnifiedListing;
  colors: any;
  isDark: boolean;
  isFav: boolean;
  onPress: () => void;
  onFavorite: () => void;
  getCategoryIcon: (cat: string) => React.ComponentType<any>;
}) {
  const Icon = getCategoryIcon(listing.category);
  const isRental = listing.type === 'rental';

  return (
    <TouchableOpacity
      style={[styles.listingCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.9}
      testID={`listingCard_${listing.id}`}
    >
      <View style={styles.listingImageWrap}>
        <Image source={{ uri: listing.images[0] }} style={styles.listingImage} />
        <TouchableOpacity
          onPress={onFavorite}
          style={[styles.listingFavButton, { backgroundColor: 'rgba(0,0,0,0.4)' }]}
          testID={`listingFav_${listing.id}`}
        >
          <Heart
            size={16}
            color={isFav ? '#FF6B6B' : '#fff'}
            fill={isFav ? '#FF6B6B' : 'transparent'}
          />
        </TouchableOpacity>
        <View style={[styles.listingTypeBadge, { backgroundColor: isRental ? colors.accent : '#10B981' }]}>
          {isRental ? <Calendar size={10} color="#fff" /> : <Tag size={10} color="#fff" />}
          <Text style={styles.listingTypeText}>{isRental ? 'Rent' : 'Sale'}</Text>
        </View>
        {listing.instantBook && (
          <View style={[styles.instantBadge, { backgroundColor: '#10B981' }]}>
            <Zap size={10} color="#fff" fill="#fff" />
            <Text style={styles.instantText}>Instant</Text>
          </View>
        )}
        {listing.acceptsSwap && (
          <View style={[styles.swapBadge, { backgroundColor: '#8B5CF6' }]}>
            <RefreshCw size={10} color="#fff" />
            <Text style={styles.swapText}>Swap</Text>
          </View>
        )}
        {listing.condition && (
          <View style={[styles.conditionBadge, { backgroundColor: colors.accent }]}>
            <Text style={styles.conditionText}>{getConditionLabel(listing.condition)}</Text>
          </View>
        )}
      </View>

      <View style={styles.listingContent}>
        <Text style={[styles.listingTitle, { color: colors.text }]} numberOfLines={2}>
          {listing.title}
        </Text>

        <View style={styles.listingMeta}>
          {isRental && listing.rating ? (
            <View style={styles.ratingRow}>
              <Star size={12} color="#FFB800" fill="#FFB800" />
              <Text style={[styles.ratingText, { color: colors.text }]}>{listing.rating}</Text>
              <Text style={[styles.reviewCount, { color: colors.textSecondary }]}>
                ({listing.reviewCount})
              </Text>
            </View>
          ) : (
            <View style={styles.statsRow}>
              {listing.views !== undefined && (
                <View style={styles.statItem}>
                  <Eye size={11} color={colors.textTertiary} />
                  <Text style={[styles.statText, { color: colors.textTertiary }]}>{listing.views}</Text>
                </View>
              )}
              {listing.inquiries !== undefined && listing.inquiries > 0 && (
                <View style={styles.statItem}>
                  <MessageCircle size={11} color={colors.textTertiary} />
                  <Text style={[styles.statText, { color: colors.textTertiary }]}>{listing.inquiries}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        <View style={styles.locationRow}>
          <MapPin size={12} color={colors.textSecondary} />
          <Text style={[styles.locationText, { color: colors.textSecondary }]} numberOfLines={1}>
            {listing.location}
          </Text>
        </View>

        <View style={styles.listingFooter}>
          <Text style={[styles.listingPrice, { color: colors.accent }]}>
            {listing.priceLabel}
          </Text>
        </View>

        <View style={styles.sellerRow}>
          <Image source={{ uri: listing.sellerAvatar }} style={styles.sellerAvatar} />
          <Text style={[styles.sellerName, { color: colors.textSecondary }]} numberOfLines={1}>
            {listing.sellerName}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  myListingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  myListingsText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '500' as const,
  },
  typeFilterRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  typeFilterPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  typeFilterText: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    marginTop: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500' as const,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    paddingRight: 16,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
  },
  sectionSubtitle: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '500' as const,
  },
  featuredScroll: {
    paddingTop: 12,
    paddingRight: 16,
    gap: 14,
  },
  featuredCard: {
    width: 240,
    borderRadius: 16,
    overflow: 'hidden',
  },
  featuredImage: {
    width: '100%',
    height: 140,
  },
  featuredOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  favoriteButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredContent: {
    padding: 12,
  },
  featuredTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  featuredMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  reviewCount: {
    fontSize: 11,
    fontWeight: '500' as const,
  },
  featuredPrice: {
    fontSize: 14,
    fontWeight: '800' as const,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  locationText: {
    fontSize: 12,
    fontWeight: '500' as const,
    flex: 1,
  },
  listingsList: {
    gap: 14,
  },
  listingCard: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  listingImageWrap: {
    width: 130,
    height: 150,
    position: 'relative',
  },
  listingImage: {
    width: '100%',
    height: '100%',
  },
  listingFavButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listingTypeBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  listingTypeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700' as const,
  },
  instantBadge: {
    position: 'absolute',
    bottom: 36,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  instantText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700' as const,
  },
  swapBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  swapText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700' as const,
  },
  conditionBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  conditionText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700' as const,
  },
  listingContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  listingTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    lineHeight: 18,
  },
  listingMeta: {
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statText: {
    fontSize: 11,
    fontWeight: '500' as const,
  },
  listingFooter: {
    marginTop: 4,
  },
  listingPrice: {
    fontSize: 16,
    fontWeight: '800' as const,
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.1)',
  },
  sellerAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  sellerName: {
    fontSize: 11,
    fontWeight: '500' as const,
    flex: 1,
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    marginTop: 16,
  },
  emptyText: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '500' as const,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700' as const,
  },
});
