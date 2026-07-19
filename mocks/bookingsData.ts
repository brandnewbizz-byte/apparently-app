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
  // Car-specific fields
  carMake?: string;
  carModel?: string;
  carYear?: number;
  carType?: string;
  carSeats?: number;
  carFuelType?: string;
  carTransmission?: string;
  carMileage?: number;
  // Home/Stay-specific fields
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  maxGuests?: number;
  beds?: string;
  // Boat-specific fields
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

export const mockStayListings: Listing[] = [
  {
    id: 'stay-1',
    category: 'stay',
    title: 'Modern Loft in Downtown',
    description: 'Beautiful modern loft with stunning city views. Perfect for business travelers or couples looking for a stylish getaway. Features floor-to-ceiling windows, designer furniture, and a fully equipped kitchen.',
    images: [
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1484154218962-a197022b25ba?w=800&h=600&fit=crop',
    ],
    host: mockUsers[1],
    location: 'Downtown Manhattan, NY',
    pricePerDay: 185,
    currency: 'USD',
    rating: 4.92,
    reviewCount: 128,
    amenities: [stayAmenities[0], stayAmenities[1], stayAmenities[3], stayAmenities[7], stayAmenities[8]],
    status: 'available',
    instantBook: true,
    createdAt: new Date().toISOString(),
    specs: {
      'Bedrooms': '1',
      'Beds': '1 King',
      'Bathrooms': '1',
      'Max Guests': '2',
    },
    rules: ['No smoking', 'No parties', 'Check-in after 3 PM'],
    cancellationPolicy: 'moderate',
  },
  {
    id: 'stay-2',
    category: 'stay',
    title: 'Cozy Brooklyn Brownstone',
    description: 'Charming brownstone apartment in the heart of Brooklyn. Walk to amazing restaurants, bars, and the park. Original hardwood floors, exposed brick, and modern amenities.',
    images: [
      'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1536376072261-38c75010e6c9?w=800&h=600&fit=crop',
    ],
    host: mockUsers[2],
    location: 'Williamsburg, Brooklyn',
    pricePerDay: 145,
    currency: 'USD',
    rating: 4.87,
    reviewCount: 89,
    amenities: [stayAmenities[0], stayAmenities[1], stayAmenities[6], stayAmenities[9]],
    status: 'available',
    instantBook: true,
    createdAt: new Date().toISOString(),
    specs: {
      'Bedrooms': '2',
      'Beds': '1 Queen, 1 Twin',
      'Bathrooms': '1',
      'Max Guests': '4',
    },
    rules: ['Pets allowed', 'No smoking indoors'],
    cancellationPolicy: 'flexible',
  },
  {
    id: 'stay-3',
    category: 'stay',
    title: 'Luxury Penthouse with Rooftop',
    description: 'Stunning penthouse with private rooftop terrace and 360-degree views of the city. Premium finishes throughout, smart home features, and concierge service available.',
    images: [
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800&h=600&fit=crop',
    ],
    host: mockUsers[3],
    location: 'Midtown, Manhattan',
    pricePerDay: 450,
    currency: 'USD',
    rating: 4.98,
    reviewCount: 64,
    amenities: [stayAmenities[0], stayAmenities[1], stayAmenities[2], stayAmenities[3], stayAmenities[4], stayAmenities[5], stayAmenities[7]],
    status: 'available',
    instantBook: false,
    createdAt: new Date().toISOString(),
    specs: {
      'Bedrooms': '3',
      'Beds': '2 King, 2 Twin',
      'Bathrooms': '2.5',
      'Max Guests': '6',
    },
    rules: ['No parties', 'No smoking', 'Quiet hours 10 PM - 8 AM'],
    cancellationPolicy: 'strict',
  },
  {
    id: 'stay-4',
    category: 'stay',
    title: 'Artist Studio in SoHo',
    description: 'Creative space perfect for artists and photographers. High ceilings, natural light, and eclectic decor. Located in the heart of SoHo near galleries and boutiques.',
    images: [
      'https://images.unsplash.com/photo-1560185893-a55cbc8c57e8?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1617806118233-18e1de247200?w=800&h=600&fit=crop',
    ],
    host: mockUsers[4],
    location: 'SoHo, Manhattan',
    pricePerDay: 165,
    currency: 'USD',
    rating: 4.75,
    reviewCount: 52,
    amenities: [stayAmenities[0], stayAmenities[8], stayAmenities[7]],
    status: 'available',
    instantBook: true,
    createdAt: new Date().toISOString(),
    specs: {
      'Bedrooms': 'Studio',
      'Beds': '1 Queen',
      'Bathrooms': '1',
      'Max Guests': '2',
    },
    cancellationPolicy: 'flexible',
  },
];

export const mockCarListings: Listing[] = [
  {
    id: 'car-1',
    category: 'car',
    title: 'Tesla Model 3 Long Range',
    description: 'Experience electric driving at its finest. This Tesla Model 3 offers incredible range, autopilot capabilities, and a premium interior. Perfect for road trips or daily use.',
    images: [
      'https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1617788138017-80ad40651399?w=800&h=600&fit=crop',
    ],
    host: mockUsers[1],
    location: 'Chelsea, Manhattan',
    pricePerDay: 95,
    currency: 'USD',
    rating: 4.95,
    reviewCount: 203,
    amenities: [carAmenities[0], carAmenities[1], carAmenities[2], carAmenities[3], carAmenities[7]],
    status: 'available',
    instantBook: true,
    createdAt: new Date().toISOString(),
    specs: {
      'Year': '2023',
      'Seats': '5',
      'Range': '358 miles',
      'Type': 'Electric',
    },
    rules: ['No smoking', 'Return with same charge level', 'Clean interior'],
    cancellationPolicy: 'moderate',
  },
  {
    id: 'car-2',
    category: 'car',
    title: 'BMW X5 xDrive40i',
    description: 'Luxury SUV perfect for family trips or business travel. Spacious interior, advanced safety features, and powerful performance. Includes premium sound system.',
    images: [
      'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1603386329225-868f9b1ee6c9?w=800&h=600&fit=crop',
    ],
    host: mockUsers[3],
    location: 'Upper East Side, Manhattan',
    pricePerDay: 145,
    currency: 'USD',
    rating: 4.88,
    reviewCount: 87,
    amenities: [carAmenities[0], carAmenities[1], carAmenities[3], carAmenities[4], carAmenities[5]],
    status: 'available',
    instantBook: true,
    createdAt: new Date().toISOString(),
    specs: {
      'Year': '2024',
      'Seats': '7',
      'MPG': '21 city / 26 highway',
      'Type': 'SUV',
    },
    rules: ['No smoking', 'No pets', 'Return clean'],
    cancellationPolicy: 'moderate',
  },
  {
    id: 'car-3',
    category: 'car',
    title: 'Porsche 911 Carrera',
    description: 'Iconic sports car for an unforgettable driving experience. Perfect for special occasions, photo shoots, or just enjoying the open road.',
    images: [
      'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?w=800&h=600&fit=crop',
    ],
    host: mockUsers[5],
    location: 'Financial District, Manhattan',
    pricePerDay: 350,
    currency: 'USD',
    rating: 5.0,
    reviewCount: 42,
    amenities: [carAmenities[0], carAmenities[1], carAmenities[3]],
    status: 'available',
    instantBook: false,
    createdAt: new Date().toISOString(),
    specs: {
      'Year': '2023',
      'Seats': '2',
      'Horsepower': '379 HP',
      'Type': 'Sports Car',
    },
    rules: ['Must be 25+', 'No track use', 'No smoking'],
    cancellationPolicy: 'strict',
  },
  {
    id: 'car-4',
    category: 'car',
    title: 'Jeep Wrangler Rubicon',
    description: 'Ready for any adventure! This Jeep Wrangler is perfect for beach trips, camping, or just cruising around town with the top down.',
    images: [
      'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=800&h=600&fit=crop',
    ],
    host: mockUsers[2],
    location: 'Brooklyn Heights',
    pricePerDay: 110,
    currency: 'USD',
    rating: 4.82,
    reviewCount: 156,
    amenities: [carAmenities[0], carAmenities[2], carAmenities[3]],
    status: 'available',
    instantBook: true,
    createdAt: new Date().toISOString(),
    specs: {
      'Year': '2022',
      'Seats': '4',
      'Type': '4x4 SUV',
      'Features': 'Removable Top',
    },
    cancellationPolicy: 'flexible',
  },
];

export const mockBoatListings: Listing[] = [
  {
    id: 'boat-1',
    category: 'boat',
    title: '42ft Luxury Yacht',
    description: 'Stunning yacht perfect for sunset cruises, celebrations, or a day on the water. Includes captain and fuel. Full bar and entertainment system onboard.',
    images: [
      'https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1605281317010-fe5ffe798166?w=800&h=600&fit=crop',
    ],
    host: mockUsers[3],
    location: 'Chelsea Piers, Manhattan',
    pricePerDay: 1200,
    pricePerHour: 250,
    currency: 'USD',
    rating: 4.96,
    reviewCount: 78,
    amenities: [boatAmenities[0], boatAmenities[4], boatAmenities[5], boatAmenities[7]],
    status: 'available',
    instantBook: false,
    createdAt: new Date().toISOString(),
    specs: {
      'Length': '42 ft',
      'Capacity': '12 guests',
      'Cabins': '2',
      'Type': 'Motor Yacht',
    },
    rules: ['No smoking inside', 'No shoes on deck', 'Captain required'],
    cancellationPolicy: 'strict',
  },
  {
    id: 'boat-2',
    category: 'boat',
    title: 'Pontoon Party Boat',
    description: 'Spacious pontoon boat perfect for groups. Easy to drive, no experience needed. Great for fishing, swimming, or just relaxing on the water.',
    images: [
      'https://images.unsplash.com/photo-1559731724-7f4a18b0cf08?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=600&fit=crop',
    ],
    host: mockUsers[4],
    location: 'Long Island Sound',
    pricePerDay: 400,
    pricePerHour: 75,
    currency: 'USD',
    rating: 4.85,
    reviewCount: 134,
    amenities: [boatAmenities[2], boatAmenities[3], boatAmenities[4], boatAmenities[7]],
    status: 'available',
    instantBook: true,
    createdAt: new Date().toISOString(),
    specs: {
      'Length': '24 ft',
      'Capacity': '10 guests',
      'Type': 'Pontoon',
      'Experience': 'Beginner Friendly',
    },
    rules: ['Life jackets required for kids', 'No glass containers'],
    cancellationPolicy: 'moderate',
  },
  {
    id: 'boat-3',
    category: 'boat',
    title: 'Sport Fishing Boat',
    description: 'Professional fishing boat fully equipped for deep sea fishing. Includes all fishing gear, bait, and an experienced captain who knows the best spots.',
    images: [
      'https://images.unsplash.com/photo-1544377193-33dcf4d68fb5?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1504472478235-9bc48ba4d60f?w=800&h=600&fit=crop',
    ],
    host: mockUsers[1],
    location: 'Montauk, Long Island',
    pricePerDay: 800,
    pricePerHour: 150,
    currency: 'USD',
    rating: 4.92,
    reviewCount: 67,
    amenities: [boatAmenities[0], boatAmenities[1], boatAmenities[3]],
    status: 'available',
    instantBook: false,
    createdAt: new Date().toISOString(),
    specs: {
      'Length': '32 ft',
      'Capacity': '6 guests',
      'Type': 'Fishing Boat',
      'Included': 'Captain + Gear',
    },
    rules: ['Fishing license required', 'Catch and release for certain species'],
    cancellationPolicy: 'moderate',
  },
  {
    id: 'boat-4',
    category: 'boat',
    title: 'Sailboat Adventure',
    description: 'Classic 36ft sailboat for those who love the wind and sea. Captain available or sail yourself if experienced. Perfect for romantic getaways.',
    images: [
      'https://images.unsplash.com/photo-1500514966906-fe245eea9344?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1534278931827-8a259344abe7?w=800&h=600&fit=crop',
    ],
    host: mockUsers[5],
    location: 'Newport, Rhode Island',
    pricePerDay: 550,
    currency: 'USD',
    rating: 4.89,
    reviewCount: 45,
    amenities: [boatAmenities[3], boatAmenities[2]],
    status: 'available',
    instantBook: true,
    createdAt: new Date().toISOString(),
    specs: {
      'Length': '36 ft',
      'Capacity': '4 guests',
      'Cabins': '1',
      'Type': 'Sailboat',
    },
    rules: ['Sailing experience required if no captain', 'Weather dependent'],
    cancellationPolicy: 'flexible',
  },
];

export const allListings: Listing[] = [
  ...mockStayListings,
  ...mockCarListings,
  ...mockBoatListings,
];

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
