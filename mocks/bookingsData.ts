// Types and constants kept — mock data arrays emptied
// App now uses Supabase live backend

import { mockUsers, type User } from './data';

export type ListingCategory = 'stay' | 'car' | 'boat' | 'product';
export type ListingStatus = 'available' | 'booked' | 'unavailable';
export type RentalSubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface RentalSubmission {
  id: string;
  category: ListingCategory;
  title: string;
  description: string;
  images: string[];
  ownerId: string;
  ownerName: string;
  ownerAvatar: string;
  location: string;
  pricePerDay: number;
  pricePerHour?: number;
  currency: string;
  amenityIds: string[];
  specs: Record<string, string>;
  rules: string[];
  cancellationPolicy: 'flexible' | 'moderate' | 'strict';
  instantBook: boolean;
  submissionStatus: RentalSubmissionStatus;
  submittedAt: string;
  reviewedAt?: string;
  rejectionReason?: string;
  carMake?: string;
  carModel?: string;
  carYear?: number;
  carType?: string;
  carSeats?: number;
  carFuelType?: string;
  carTransmission?: string;
  carMileage?: number;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  maxGuests?: number;
  beds?: string;
  boatType?: string;
  boatLength?: number;
  boatCapacity?: number;
  boatCabins?: number;
  captainIncluded?: boolean;
  requiresLicense?: boolean;
}

export interface ListingAmenity {
  id: string;
  name: string;
  icon: string;
}

export interface ListingReview {
  id: string;
  user: User;
  rating: number;
  comment: string;
  date: string;
}

export interface Listing {
  id: string;
  category: ListingCategory;
  title: string;
  description: string;
  images: string[];
  host: User;
  location: string;
  coordinates?: { lat: number; lng: number };
  pricePerDay: number;
  pricePerHour?: number;
  currency: string;
  rating: number;
  reviewCount: number;
  amenities: ListingAmenity[];
  status: ListingStatus;
  instantBook: boolean;
  createdAt: string;
  specs?: Record<string, string>;
  rules?: string[];
  cancellationPolicy: 'flexible' | 'moderate' | 'strict';
  views?: number;
  messagesCount?: number;
  salesCount?: number;
}

export interface Booking {
  id: string;
  listingId: string;
  listing: Listing;
  userId: string;
  startDate: string;
  endDate: string;
  totalPrice: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  createdAt: string;
  guestCount?: number;
  message?: string;
}

// Amenity catalogs kept (not user data, just option lists)
export const stayAmenities: ListingAmenity[] = [
  { id: 'wifi', name: 'WiFi', icon: 'wifi' },
  { id: 'kitchen', name: 'Kitchen', icon: 'utensils' },
  { id: 'parking', name: 'Parking', icon: 'car' },
  { id: 'ac', name: 'Air Conditioning', icon: 'snowflake' },
  { id: 'pool', name: 'Pool', icon: 'waves' },
  { id: 'gym', name: 'Gym', icon: 'dumbbell' },
  { id: 'washer', name: 'Washer', icon: 'shirt' },
  { id: 'tv', name: 'TV', icon: 'tv' },
  { id: 'workspace', name: 'Workspace', icon: 'laptop' },
  { id: 'pets', name: 'Pet Friendly', icon: 'paw-print' },
];

export const carAmenities: ListingAmenity[] = [
  { id: 'bluetooth', name: 'Bluetooth', icon: 'bluetooth' },
  { id: 'gps', name: 'GPS Navigation', icon: 'navigation' },
  { id: 'usb', name: 'USB Charger', icon: 'usb' },
  { id: 'backup-camera', name: 'Backup Camera', icon: 'camera' },
  { id: 'sunroof', name: 'Sunroof', icon: 'sun' },
  { id: 'heated-seats', name: 'Heated Seats', icon: 'flame' },
  { id: 'child-seat', name: 'Child Seat', icon: 'baby' },
  { id: 'autopilot', name: 'Autopilot', icon: 'cpu' },
];

export const homeAmenities: ListingAmenity[] = [
  { id: 'wifi', name: 'WiFi', icon: 'wifi' },
  { id: 'kitchen', name: 'Kitchen', icon: 'utensils' },
  { id: 'parking', name: 'Parking', icon: 'car' },
  { id: 'ac', name: 'Air Conditioning', icon: 'snowflake' },
  { id: 'heating', name: 'Heating', icon: 'flame' },
  { id: 'pool', name: 'Pool', icon: 'waves' },
  { id: 'hot-tub', name: 'Hot Tub', icon: 'bath' },
  { id: 'gym', name: 'Gym', icon: 'dumbbell' },
  { id: 'washer', name: 'Washer/Dryer', icon: 'shirt' },
  { id: 'tv', name: 'TV', icon: 'tv' },
  { id: 'workspace', name: 'Workspace', icon: 'laptop' },
  { id: 'pets', name: 'Pet Friendly', icon: 'paw-print' },
  { id: 'fireplace', name: 'Fireplace', icon: 'flame' },
  { id: 'balcony', name: 'Balcony/Patio', icon: 'door-open' },
  { id: 'ev-charger', name: 'EV Charger', icon: 'zap' },
  { id: 'security', name: 'Security System', icon: 'shield' },
];

export const boatAmenities: ListingAmenity[] = [
  { id: 'captain', name: 'Captain Included', icon: 'anchor' },
  { id: 'fishing', name: 'Fishing Gear', icon: 'fish' },
  { id: 'snorkel', name: 'Snorkeling Gear', icon: 'glasses' },
  { id: 'cooler', name: 'Cooler', icon: 'box' },
  { id: 'sound-system', name: 'Sound System', icon: 'music' },
  { id: 'grill', name: 'BBQ Grill', icon: 'flame' },
  { id: 'kayak', name: 'Kayak', icon: 'ship' },
  { id: 'floats', name: 'Water Floats', icon: 'life-buoy' },
];

// All mock listings removed — app now uses Supabase
export const mockStayListings: Listing[] = [];
export const mockCarListings: Listing[] = [];
export const mockBoatListings: Listing[] = [];
export const allListings: Listing[] = [];

// Option catalogs kept (not user data)
export const CAR_TYPES = ['Sedan', 'SUV', 'Sports Car', 'Truck', 'Van', 'Convertible', 'Luxury', 'Electric', 'Hybrid', 'Compact'];
export const CAR_FUEL_TYPES = ['Gasoline', 'Diesel', 'Electric', 'Hybrid', 'Plug-in Hybrid'];
export const CAR_TRANSMISSIONS = ['Automatic', 'Manual'];
export const PROPERTY_TYPES = ['Apartment', 'House', 'Condo', 'Townhouse', 'Villa', 'Loft', 'Studio', 'Cabin', 'Guest House', 'Penthouse'];
export const BOAT_TYPES = ['Motor Yacht', 'Sailboat', 'Pontoon', 'Fishing Boat', 'Speedboat', 'Catamaran', 'Houseboat', 'Jet Ski', 'Kayak', 'Canoe'];
export const CANCELLATION_POLICIES = [
  { key: 'flexible' as const, label: 'Flexible', description: 'Full refund up to 24 hours before' },
  { key: 'moderate' as const, label: 'Moderate', description: 'Full refund up to 5 days before' },
  { key: 'strict' as const, label: 'Strict', description: '50% refund up to 1 week before' },
];
