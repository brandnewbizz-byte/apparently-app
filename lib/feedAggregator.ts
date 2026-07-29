/**
 * Feed Aggregator — converts cross-tab context data into unified FeedPost format
 * so Marketplace listings, Rentals, Swaps, and Connections all appear in the feed.
 */

import type { Product } from '@/contexts/MarketplaceContext';
import type { SwapPost } from '@/contexts/SwapContext';
import type { ConnectionRequest, Connection } from '@/contexts/ConnectionsContext';
import type { ServiceRequest } from '@/contexts/ServiceRequestContext';

/**
 * Convert a UserBundle into a feed card.
 */
import type { UserBundle } from '@/contexts/BundleContext';

export function bundleToFeedPost(bundle: UserBundle): AggregatedFeedPost {
  return {
    id: `bundle-${bundle.id}`,
    type: 'bundle',
    author: {
      name: bundle.creator.name,
      avatar: bundle.creator.avatar,
    },
    authorId: bundle.creatorId,
    category: 'Bundles',
    timestamp: 'Available',
    caption: bundle.description || bundle.title,
    media: bundle.imageUrl,
    mediaHeight: 200,
    location: bundle.location,
    tags: bundle.tags,
    likes: 0,
    stats: { saves: 0, comments: 0 },
    price: bundle.price,
  };
}

// Re-use the app's FeedPost type shape (we mirror it here to avoid circular imports)
export type FeedPostType = 'text' | 'photo' | 'video' | 'live' | 'event' | 'plan' | 'achievement' | 'marketplace' | 'rental' | 'swap' | 'connection' | 'request' | 'bundle';

export interface AggregatedFeedPost {
  id: string;
  type: FeedPostType;
  title?: string;
  author: { name: string; avatar: string };
  /** The creator's user ID — used to resolve live profile photos at render time */
  authorId?: string;
  category: string;
  timestamp: string;
  caption: string;
  media?: string;
  mediaHeight?: number;
  location?: string;
  date?: string;
  attendees?: number;
  maxAttendees?: number;
  tags: string[];
  likes: number;
  stats: { saves: number; comments: number };
  viewerCount?: number;
  streamDuration?: string;
  // Marketplace-specific
  price?: number;
  condition?: string;
  // Rental-specific
  pricePerNight?: string;
  // Connection-specific
  canMessage?: boolean;
}

/**
 * Convert a Marketplace Product into a feed card.
 */
export function productToFeedPost(product: Product): AggregatedFeedPost {
  const msAgo = Math.round((Date.now() - new Date(product.createdAt).getTime()) / 1000 / 60);
  const timeAgo = msAgo < 60 ? `${msAgo}m ago` : msAgo < 1440 ? `${Math.round(msAgo / 60)}h ago` : `${Math.round(msAgo / 1440)}d ago`;

  return {
    id: `marketplace-${product.id}`,
    type: 'marketplace',
    author: {
      name: product.sellerName,
      avatar: product.sellerAvatar || '',
    },
    authorId: product.sellerId,
    category: 'Marketplace',
    timestamp: timeAgo,
    caption: product.title,
    media: product.images?.[0]?.uri,
    mediaHeight: 240,
    location: product.location,
    tags: [product.category, product.condition, product.acceptsSwap ? 'Accepts Swaps' : ''].filter(Boolean),
    likes: product.saves || 0,
    stats: { saves: product.saves || 0, comments: product.inquiries?.length || 0 },
    price: product.price,
    condition: product.condition,
  };
}

/**
 * Convert a Rental Listing into a feed card.
 */
export function listingToFeedPost(listing: any): AggregatedFeedPost {
  const images = listing.images || listing.image ? [listing.images?.[0] || listing.image] : [];
  const mediaUri = typeof images[0] === 'string' ? images[0] : images[0]?.uri || images[0]?.url;

  return {
    id: `rental-${listing.id}`,
    type: 'rental',
    author: {
      name: listing.hostName || listing.ownerName || 'Host',
      avatar: listing.hostAvatar || listing.ownerAvatar || '',
    },
    authorId: listing.hostId || listing.ownerId || listing.userId,
    category: 'Rentals',
    timestamp: 'Available',
    caption: listing.title || listing.name,
    media: mediaUri,
    mediaHeight: 220,
    location: listing.location || listing.city,
    tags: [listing.category || 'Rental', listing.type, listing.instantBook ? 'Instant Book' : ''].filter(Boolean),
    likes: 0,
    stats: { saves: listing.favorites?.length || 0, comments: 0 },
    price: listing.price,
    pricePerNight: listing.price ? `$${listing.price}/night` : undefined,
  };
}

/**
 * Convert a Swap Post into a feed card.
 */
export function swapPostToFeedPost(post: SwapPost): AggregatedFeedPost {
  const msAgo = Math.round((Date.now() - new Date(post.createdAt).getTime()) / 1000 / 60);
  const timeAgo = msAgo < 60 ? `${msAgo}m ago` : msAgo < 1440 ? `${Math.round(msAgo / 60)}h ago` : `${Math.round(msAgo / 1440)}d ago`;

  return {
    id: `swap-${post.id}`,
    type: 'swap',
    author: {
      name: post.author?.name || 'User',
      avatar: post.author?.avatar || '',
    },
    authorId: post.authorId,
    category: 'Swaps',
    timestamp: timeAgo,
    caption: post.title,
    location: post.location,
    tags: [post.category, post.offering ? `Offering: ${post.offering}` : '', post.needing ? `Needs: ${post.needing}` : ''].filter(Boolean),
    likes: 0,
    stats: { saves: 0, comments: 0 },
    price: post.price,
  };
}

/**
 * Convert a Connection Request into a feed card.
 */
export function connectionToFeedPost(connection: Connection): AggregatedFeedPost {
  return {
    id: `connection-${connection.id}`,
    type: 'connection',
    author: {
      name: connection.profile?.name || 'User',
      avatar: connection.profile?.avatar || '',
    },
    authorId: connection.profile?.id,
    category: 'Connections',
    timestamp: connection.connectedAt || 'Recently',
    caption: `${connection.profile?.name || 'Someone'} is now connected${connection.canMessage ? ' — say hello!' : ''}`,
    media: connection.profile?.avatar,
    tags: ['Connection', 'Network'],
    likes: 0,
    stats: { saves: 0, comments: 0 },
    canMessage: connection.canMessage,
  };
}

/**
 * Convert a Service Request into a feed card.
 */
export function requestToFeedPost(request: ServiceRequest): AggregatedFeedPost {
  const msAgo = Math.round((Date.now() - new Date(request.createdAt).getTime()) / 1000 / 60);
  const timeAgo = msAgo < 60 ? `${msAgo}m ago` : msAgo < 1440 ? `${Math.round(msAgo / 60)}h ago` : `${Math.round(msAgo / 1440)}d ago`;

  return {
    id: `request-${request.id}`,
    type: 'request',
    author: {
      name: request.createdBy.name,
      avatar: request.createdBy.avatar,
    },
    authorId: request.creatorId,
    category: 'Requests',
    timestamp: timeAgo,
    caption: request.title,
    location: request.location,
    date: request.date,
    tags: request.tags,
    likes: 0,
    stats: { saves: 0, comments: request.responders },
    price: request.budgetMin,
    pricePerNight: `$${request.budgetMin}–$${request.budgetMax}`,
  };
}
