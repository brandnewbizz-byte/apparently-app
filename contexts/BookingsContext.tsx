import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import {
  type Listing,
  type Booking,
  type ListingCategory,
  type RentalSubmission,
  type RentalSubmissionStatus,
  homeAmenities,
  carAmenities,
  boatAmenities,
} from '@/mocks/bookingsData';
import { DatabaseService } from '@/lib/database';
import * as localApi from '@/lib/api';

export type { Listing, Booking, ListingCategory, RentalSubmission, RentalSubmissionStatus };

export type RentalSubmissionInput = Omit<RentalSubmission, 'id' | 'submittedAt' | 'submissionStatus' | 'reviewedAt' | 'rejectionReason'>;

interface BookingsState {
  listings: Listing[];
  bookings: Booking[];
  favorites: string[];
  rentalSubmissions: RentalSubmission[];
  myListings: Listing[];
  isLoading: boolean;
  getListingsByCategory: (category: ListingCategory) => Listing[];
  getListingById: (id: string) => Listing | undefined;
  getBookingById: (id: string) => Booking | undefined;
  getMyBookings: () => Booking[];
  getUpcomingBookings: () => Booking[];
  getPastBookings: () => Booking[];
  createBooking: (input: {
    listingId: string;
    startDate: string;
    endDate: string;
    guestCount?: number;
    message?: string;
  }) => void;
  cancelBooking: (bookingId: string) => void;
  toggleFavorite: (listingId: string) => void;
  isFavorite: (listingId: string) => boolean;
  searchListings: (query: string, category?: ListingCategory) => Listing[];
  filterListings: (filters: ListingFilters) => Listing[];
  submitRental: (input: RentalSubmissionInput) => void;
  getMyRentalSubmissions: () => RentalSubmission[];
  deleteRentalSubmission: (id: string) => void;
  getAmenitiesForCategory: (category: ListingCategory) => { id: string; name: string; icon: string }[];
  refreshMyListings: () => void;
}

export interface ListingFilters {
  category?: ListingCategory;
  minPrice?: number;
  maxPrice?: number;
  instantBook?: boolean;
  location?: string;
  minRating?: number;
}

const BOOKINGS_KEY = 'apparently_bookings_v1';
const FAVORITES_KEY = 'apparently_booking_favorites_v1';
const RENTAL_SUBMISSIONS_KEY = 'apparently_rental_submissions_v1';

const makeId = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;
const nowIso = () => new Date().toISOString();

const safeParse = <T,>(raw: string | null, fallback: T): T => {
  if (!raw || raw === 'undefined' || raw === 'null') return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    console.error('[BookingsContext] JSON parse error:', e);
    return fallback;
  }
};

const calculateTotalPrice = (listing: Listing, startDate: string, endDate: string): number => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  return listing.pricePerDay * days;
};

const mapDbListingToListing = (dbListing: any, host: any): Listing => ({
  id: dbListing.id,
  category: dbListing.category,
  title: dbListing.title,
  description: dbListing.description,
  images: dbListing.images || [],
  host: host || {
    id: dbListing.host_id,
    name: 'Host',
    username: 'host',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop',
    isVerified: false,
    followersCount: 0,
  },
  location: dbListing.location,
  coordinates: dbListing.coordinates,
  pricePerDay: dbListing.price_per_day,
  pricePerHour: dbListing.price_per_hour,
  currency: dbListing.currency,
  rating: dbListing.rating,
  reviewCount: dbListing.review_count,
  amenities: (dbListing.amenity_ids || []).map((id: string) => {
    const allAmenities = [...homeAmenities, ...carAmenities, ...boatAmenities];
    return allAmenities.find(a => a.id === id) || { id, name: id, icon: 'circle' };
  }),
  status: dbListing.status,
  instantBook: dbListing.instant_book,
  createdAt: dbListing.created_at,
  specs: dbListing.specs,
  rules: dbListing.rules,
  cancellationPolicy: dbListing.cancellation_policy,
  views: dbListing.views ?? 0,
  messagesCount: dbListing.messages_count ?? 0,
  salesCount: dbListing.sales_count ?? 0,
});

export const [BookingsProvider, useBookings] = createContextHook<BookingsState>(() => {
  const queryClient = useQueryClient();

  const [listings, setListings] = useState<Listing[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [rentalSubmissions, setRentalSubmissions] = useState<RentalSubmission[]>([]);
  const [myListings, setMyListings] = useState<Listing[]>([]);

  const listingsQuery = useQuery({
    queryKey: ['supabaseListings'],
    queryFn: async ({ signal }) => {
      try {
        console.log('[BookingsContext] Starting to fetch all listings from Supabase...');
        const dbListings = await DatabaseService.fetchListings(undefined, { signal });
        console.log('[BookingsContext] Listings query result:', dbListings?.length || 0);
        
        if (dbListings && dbListings.length > 0) {
          console.log('[BookingsContext] Fetched listings from Supabase:', dbListings.length);
          const users = await DatabaseService.fetchUsers({ signal });
          const userMap = new Map(users.map(u => [u.id, {
            id: u.id,
            name: u.name,
            username: u.username,
            avatar: u.avatar,
            isVerified: u.is_verified,
            followersCount: u.followers_count,
          }]));
          
          const mappedListings = dbListings.map(l => mapDbListingToListing(l, userMap.get(l.host_id)));
          console.log('[BookingsContext] Mapped listings:', mappedListings.length);
          return mappedListings;
        }
        console.log('[BookingsContext] No listings found in Supabase');
        
        // Try local API fallback
        try {
          const localBookings = await localApi.getBookings();
          if (localBookings && localBookings.length > 0) {
            console.log('[BookingsContext] Fetched bookings from local API:', localBookings.length);
            return localBookings.map((b: any) => ({
              id: b.id,
              listingId: b.listing_id,
              hostId: b.user_id || 'u-dev',
              host: { id: b.user_id || 'u-dev', name: 'Host', avatar: '', isVerified: false },
              guestId: b.user_id || 'u-dev',
              startDate: b.start_date,
              endDate: b.end_date,
              totalPrice: b.total_price || 0,
              status: b.status || 'pending',
              guestCount: b.guest_count || 1,
              message: b.message || '',
            })) as any[];
          }
        } catch (e2) {
          console.log('[BookingsContext] Local API also unavailable');
        }
        return [];
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          console.log('[BookingsContext] Listings fetch aborted (navigation)');
          return [];
        }
        console.error('[BookingsContext] Error fetching listings from Supabase:', error);
        return [];
      }
    },
    staleTime: 1000 * 60 * 5,
    retry: (failureCount, error: any) => error?.name !== 'AbortError' && failureCount < 2,
  });

  useEffect(() => {
    if (listingsQuery.data) {
      setListings(listingsQuery.data);
    }
  }, [listingsQuery.data]);

  const myListingsQuery = useQuery({
    queryKey: ['myListings'],
    queryFn: async ({ signal }) => {
      try {
        const hostId = DatabaseService.getDefaultUserId();
        console.log('[BookingsContext] Fetching my listings for host:', hostId);
        
        const dbListings = await DatabaseService.fetchUserListings(hostId, { signal });
        console.log('[BookingsContext] My listings query result:', dbListings?.length || 0);
        
        if (dbListings && dbListings.length > 0) {
          console.log('[BookingsContext] Fetched my listings from Supabase:', dbListings.length);
          const users = await DatabaseService.fetchUsers({ signal });
          const userMap = new Map(users.map(u => [u.id, {
            id: u.id,
            name: u.name,
            username: u.username,
            avatar: u.avatar,
            isVerified: u.is_verified,
            followersCount: u.followers_count,
          }]));
          
          return dbListings.map(l => mapDbListingToListing(l, userMap.get(l.host_id)));
        }
        console.log('[BookingsContext] No my listings found in Supabase');
        return [];
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          console.log('[BookingsContext] My listings fetch aborted (navigation)');
          return [];
        }
        console.error('[BookingsContext] Error fetching my listings from Supabase:', error);
        return [];
      }
    },
    staleTime: 1000 * 60 * 2,
    retry: (failureCount, error: any) => error?.name !== 'AbortError' && failureCount < 2,
  });

  useEffect(() => {
    if (myListingsQuery.data) {
      setMyListings(myListingsQuery.data);
    }
  }, [myListingsQuery.data]);

  const bookingsQuery = useQuery({
    queryKey: ['bookings'],
    queryFn: async ({ signal }) => {
      try {
        const userId = await DatabaseService.getCurrentUserId();
        if (userId) {
          const dbBookings = await DatabaseService.fetchBookings(userId, { signal });
          if (dbBookings && dbBookings.length > 0) {
            console.log('[BookingsContext] Fetched bookings from Supabase:', dbBookings.length);
            return dbBookings.map(b => {
              const listing = listings.find(l => l.id === b.listing_id);
              return {
                id: b.id,
                listingId: b.listing_id,
                listing: listing || listings[0],
                userId: b.user_id,
                startDate: b.start_date,
                endDate: b.end_date,
                totalPrice: b.total_price,
                status: b.status,
                createdAt: b.created_at,
                guestCount: b.guest_count,
                message: b.message,
              } as Booking;
            });
          }
        }
        
        const raw = await AsyncStorage.getItem(BOOKINGS_KEY);
        const parsed = safeParse<Booking[]>(raw, []);
        console.log('[BookingsContext] Hydrated bookings from local:', parsed.length);
        return parsed;
      } catch (e: any) {
        if (e?.name === 'AbortError') {
          console.log('[BookingsContext] Bookings fetch aborted (navigation)');
          return [];
        }
        console.error('[BookingsContext] Error loading bookings:', e);
        return [];
      }
    },
    staleTime: 1000 * 60 * 2,
    retry: (failureCount, error: any) => error?.name !== 'AbortError' && failureCount < 2,
  });

  const favoritesQuery = useQuery({
    queryKey: ['bookingFavorites'],
    queryFn: async () => {
      try {
        const raw = await AsyncStorage.getItem(FAVORITES_KEY);
        const parsed = safeParse<string[]>(raw, []);
        console.log('[BookingsContext] Hydrated favorites:', parsed.length);
        return parsed;
      } catch (e) {
        console.error('[BookingsContext] Error loading favorites:', e);
        return [];
      }
    },
  });

  const rentalSubmissionsQuery = useQuery({
    queryKey: ['rentalSubmissions'],
    queryFn: async () => {
      try {
        const raw = await AsyncStorage.getItem(RENTAL_SUBMISSIONS_KEY);
        const parsed = safeParse<RentalSubmission[]>(raw, []);
        console.log('[BookingsContext] Hydrated rental submissions:', parsed.length);
        return parsed;
      } catch (e) {
        console.error('[BookingsContext] Error loading rental submissions:', e);
        return [];
      }
    },
  });

  const { mutate: persistBookingsMutate } = useMutation({
    mutationFn: async (payload: Booking[]) => {
      await AsyncStorage.setItem(BOOKINGS_KEY, JSON.stringify(payload));
      console.log('[BookingsContext] Persisted bookings:', payload.length);
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });

  const { mutate: persistFavoritesMutate } = useMutation({
    mutationFn: async (payload: string[]) => {
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(payload));
      console.log('[BookingsContext] Persisted favorites:', payload.length);
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookingFavorites'] });
    },
  });

  const { mutate: persistRentalSubmissionsMutate } = useMutation({
    mutationFn: async (payload: RentalSubmission[]) => {
      await AsyncStorage.setItem(RENTAL_SUBMISSIONS_KEY, JSON.stringify(payload));
      console.log('[BookingsContext] Persisted rental submissions:', payload.length);
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rentalSubmissions'] });
    },
  });

  const createBookingMutation = useMutation({
    mutationFn: async (booking: Omit<Booking, 'id' | 'createdAt'>) => {
      const userId = await DatabaseService.getCurrentUserId();
      if (userId) {
        const dbBooking = await DatabaseService.createBooking({
          listing_id: booking.listingId,
          user_id: userId,
          start_date: booking.startDate,
          end_date: booking.endDate,
          total_price: booking.totalPrice,
          status: booking.status,
          guest_count: booking.guestCount,
          message: booking.message,
        });
        if (dbBooking) {
          console.log('[BookingsContext] Created booking in Supabase:', dbBooking.id);
          return dbBooking;
        }
      }
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });

  useEffect(() => {
    if (bookingsQuery.data) setBookings(bookingsQuery.data);
  }, [bookingsQuery.data]);

  useEffect(() => {
    if (favoritesQuery.data) setFavorites(favoritesQuery.data);
  }, [favoritesQuery.data]);

  useEffect(() => {
    if (rentalSubmissionsQuery.data) setRentalSubmissions(rentalSubmissionsQuery.data);
  }, [rentalSubmissionsQuery.data]);

  const getListingsByCategory = useCallback(
    (category: ListingCategory) => listings.filter((l) => l.category === category),
    [listings]
  );

  const getListingById = useCallback(
    (id: string) => listings.find((l) => l.id === id),
    [listings]
  );

  const getBookingById = useCallback(
    (id: string) => bookings.find((b) => b.id === id),
    [bookings]
  );

  const getMyBookings = useCallback(() => bookings, [bookings]);

  const getUpcomingBookings = useCallback(() => {
    const now = new Date();
    return bookings.filter((b) => {
      const startDate = new Date(b.startDate);
      return startDate >= now && (b.status === 'pending' || b.status === 'confirmed');
    }).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [bookings]);

  const getPastBookings = useCallback(() => {
    const now = new Date();
    return bookings.filter((b) => {
      const endDate = new Date(b.endDate);
      return endDate < now || b.status === 'completed' || b.status === 'cancelled';
    }).sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());
  }, [bookings]);

  const createBookingMutate = createBookingMutation.mutate;

  const createBooking = useCallback(
    (input: {
      listingId: string;
      startDate: string;
      endDate: string;
      guestCount?: number;
      message?: string;
    }) => {
      const listing = getListingById(input.listingId);
      if (!listing) {
        console.error('[BookingsContext] Listing not found:', input.listingId);
        return;
      }

      const totalPrice = calculateTotalPrice(listing, input.startDate, input.endDate);

      const newBooking: Booking = {
        id: makeId(),
        listingId: input.listingId,
        listing,
        userId: 'current-user',
        startDate: input.startDate,
        endDate: input.endDate,
        totalPrice,
        status: listing.instantBook ? 'confirmed' : 'pending',
        createdAt: nowIso(),
        guestCount: input.guestCount,
        message: input.message,
      };

      const next = [newBooking, ...bookings];
      setBookings(next);
      persistBookingsMutate(next);
      
      createBookingMutate({
        listingId: input.listingId,
        listing,
        userId: 'current-user',
        startDate: input.startDate,
        endDate: input.endDate,
        totalPrice,
        status: listing.instantBook ? 'confirmed' : 'pending',
        guestCount: input.guestCount,
        message: input.message,
      });
      
      console.log('[BookingsContext] Created booking:', newBooking.id);
    },
    [bookings, getListingById, persistBookingsMutate, createBookingMutate]
  );

  const cancelBooking = useCallback(
    (bookingId: string) => {
      const next = bookings.map((b) =>
        b.id === bookingId ? { ...b, status: 'cancelled' as const } : b
      );
      setBookings(next);
      persistBookingsMutate(next);
      
      DatabaseService.updateBooking(bookingId, { status: 'cancelled' }).then(result => {
        if (result) {
          console.log('[BookingsContext] Updated booking status in Supabase:', bookingId);
        }
      });
      
      console.log('[BookingsContext] Cancelled booking:', bookingId);
    },
    [bookings, persistBookingsMutate]
  );

  const toggleFavorite = useCallback(
    (listingId: string) => {
      const isFav = favorites.includes(listingId);
      const next = isFav
        ? favorites.filter((id) => id !== listingId)
        : [...favorites, listingId];
      setFavorites(next);
      persistFavoritesMutate(next);
      console.log('[BookingsContext] Toggled favorite:', listingId, !isFav);
    },
    [favorites, persistFavoritesMutate]
  );

  const isFavorite = useCallback(
    (listingId: string) => favorites.includes(listingId),
    [favorites]
  );

  const searchListings = useCallback(
    (query: string, category?: ListingCategory) => {
      const q = query.toLowerCase().trim();
      let results = category ? getListingsByCategory(category) : listings;

      if (q) {
        results = results.filter((l) => {
          const blob = `${l.title} ${l.description} ${l.location} ${l.host.name}`.toLowerCase();
          return blob.includes(q);
        });
      }

      return results;
    },
    [getListingsByCategory, listings]
  );

  const filterListings = useCallback(
    (filters: ListingFilters) => {
      let results = filters.category ? getListingsByCategory(filters.category) : listings;

      if (filters.minPrice !== undefined) {
        results = results.filter((l) => l.pricePerDay >= (filters.minPrice ?? 0));
      }

      if (filters.maxPrice !== undefined) {
        results = results.filter((l) => l.pricePerDay <= (filters.maxPrice ?? Infinity));
      }

      if (filters.instantBook !== undefined) {
        results = results.filter((l) => l.instantBook === filters.instantBook);
      }

      if (filters.location) {
        const loc = filters.location.toLowerCase();
        results = results.filter((l) => l.location.toLowerCase().includes(loc));
      }

      if (filters.minRating !== undefined) {
        results = results.filter((l) => l.rating >= (filters.minRating ?? 0));
      }

      return results;
    },
    [getListingsByCategory, listings]
  );

  const submitRental = useCallback(
    async (input: RentalSubmissionInput) => {
      console.log('[BookingsContext] Starting rental submission to Supabase...');

      try {
        const hostId = await DatabaseService.getOrCreateUserId();
        console.log('[BookingsContext] Using host_id for listing:', hostId);
        
        const dbListing = await DatabaseService.createListing({
          category: input.category,
          title: input.title,
          description: input.description,
          images: input.images,
          host_id: hostId,
          location: input.location,
          coordinates: undefined,
          price_per_day: input.pricePerDay,
          price_per_hour: input.pricePerHour || undefined,
          currency: input.currency || 'USD',
          rating: 0,
          review_count: 0,
          status: 'available',
          instant_book: input.instantBook || false,
          specs: input.specs || {},
          rules: input.rules || [],
          cancellation_policy: input.cancellationPolicy || 'flexible',
        });

        if (dbListing) {
          console.log('[BookingsContext] SUCCESS: Created listing in Supabase:', dbListing.id);
          queryClient.invalidateQueries({ queryKey: ['supabaseListings'] });
          queryClient.invalidateQueries({ queryKey: ['myListings'] });
          
          const newSubmission: RentalSubmission = {
            ...input,
            id: dbListing.id,
            submittedAt: dbListing.created_at,
            submissionStatus: 'approved',
          };
          const next = [newSubmission, ...rentalSubmissions];
          setRentalSubmissions(next);
          persistRentalSubmissionsMutate(next);
        } else {
          console.error('[BookingsContext] FAILED: Could not create listing in Supabase');
          const newSubmission: RentalSubmission = {
            ...input,
            id: makeId(),
            submittedAt: nowIso(),
            submissionStatus: 'pending',
          };
          const next = [newSubmission, ...rentalSubmissions];
          setRentalSubmissions(next);
          persistRentalSubmissionsMutate(next);
        }
      } catch (error) {
        console.error('[BookingsContext] Error creating listing:', error);
        const newSubmission: RentalSubmission = {
          ...input,
          id: makeId(),
          submittedAt: nowIso(),
          submissionStatus: 'pending',
        };
        const next = [newSubmission, ...rentalSubmissions];
        setRentalSubmissions(next);
        persistRentalSubmissionsMutate(next);
      }
    },
    [rentalSubmissions, persistRentalSubmissionsMutate, queryClient]
  );

  const getMyRentalSubmissions = useCallback(() => {
    // Only use Supabase data - ignore local storage to prevent showing old/stale records
    const supabaseAsSubmissions: RentalSubmission[] = myListings.map((listing) => ({
      id: listing.id,
      category: listing.category,
      title: listing.title,
      description: listing.description,
      images: listing.images,
      ownerId: listing.host.id,
      ownerName: listing.host.name,
      ownerAvatar: listing.host.avatar,
      location: listing.location,
      pricePerDay: listing.pricePerDay,
      pricePerHour: listing.pricePerHour,
      currency: listing.currency || 'USD',
      amenityIds: listing.amenities?.map(a => a.id) || [],
      specs: listing.specs || {},
      rules: listing.rules || [],
      cancellationPolicy: listing.cancellationPolicy || 'flexible',
      instantBook: listing.instantBook || false,
      submittedAt: listing.createdAt,
      submissionStatus: listing.status === 'available' ? 'approved' : 'pending',
    }));
    
    supabaseAsSubmissions.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    
    console.log('[BookingsContext] getMyRentalSubmissions - Supabase only:', supabaseAsSubmissions.length);
    return supabaseAsSubmissions;
  }, [myListings]);

  const deleteRentalSubmission = useCallback(
    async (id: string) => {
      const next = rentalSubmissions.filter((s) => s.id !== id);
      setRentalSubmissions(next);
      persistRentalSubmissionsMutate(next);
      console.log('[BookingsContext] Deleted rental submission locally:', id);
      
      const deleted = await DatabaseService.deleteListing(id);
      if (deleted) {
        console.log('[BookingsContext] Deleted listing from Supabase:', id);
        queryClient.invalidateQueries({ queryKey: ['supabaseListings'] });
        queryClient.invalidateQueries({ queryKey: ['myListings'] });
      }
    },
    [rentalSubmissions, persistRentalSubmissionsMutate, queryClient]
  );

  const getAmenitiesForCategory = useCallback((category: ListingCategory) => {
    switch (category) {
      case 'stay':
        return homeAmenities;
      case 'car':
        return carAmenities;
      case 'boat':
        return boatAmenities;
      default:
        return [];
    }
  }, []);

  const refreshMyListings = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['myListings'] });
    queryClient.invalidateQueries({ queryKey: ['supabaseListings'] });
    console.log('[BookingsContext] Refreshing my listings');
  }, [queryClient]);

  const isLoading = bookingsQuery.isLoading || favoritesQuery.isLoading || rentalSubmissionsQuery.isLoading || listingsQuery.isLoading || myListingsQuery.isLoading;

  return {
    listings,
    bookings,
    favorites,
    rentalSubmissions,
    myListings,
    isLoading,
    getListingsByCategory,
    getListingById,
    getBookingById,
    getMyBookings,
    getUpcomingBookings,
    getPastBookings,
    createBooking,
    cancelBooking,
    toggleFavorite,
    isFavorite,
    searchListings,
    filterListings,
    submitRental,
    getMyRentalSubmissions,
    deleteRentalSubmission,
    getAmenitiesForCategory,
    refreshMyListings,
  };
});
