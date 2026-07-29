export type RelationshipCategory = 'family' | 'friend' | 'business' | 'mentor' | 'colleague' | 'associate';

export interface User {
  id: string;
  name: string;
  username: string;
  avatar: string;
  isVerified: boolean;
  followersCount: number;
  isLive?: boolean;
  relationshipCategory?: RelationshipCategory;
}

export interface PostRelevance {
  affectsDirectly: boolean;
  affectsNetwork: boolean;
  directReason?: string;
  networkReason?: string;
  topicTrends?: string[];
  mentionedContacts?: string[];
  relevanceScore: number;
}

export interface Post {
  id: string;
  user: User;
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  mediaType?: 'image' | 'video';
  timestamp: string;
  likes: number;
  comments: number;
  shares: number;
  category?: string;
  postKind?: 'post' | 'sell';
  imageWidth?: number;
  imageHeight?: number;
  imageAspectRatio?: number;
  renderFullImage?: boolean;
  isApparently?: boolean;
  apparentlyTag?: string;
  relevance?: PostRelevance;
}

export interface LiveStream {
  id: string;
  user: User;
  title: string;
  viewerCount: number;
  thumbnailUrl: string;
  category: string;
  isLive: boolean;
  scheduledFor?: string;
}

export interface Insight {
  id: string;
  title: string;
  description: string;
  category: string;
  relevanceScore: number;
  timestamp: string;
  icon: string;
}

export interface Interest {
  id: string;
  name: string;
  icon: string;
  selected?: boolean;
}

export interface Story {
  id: string;
  user: User;
  imageUrl: string;
  timestamp: string;
  viewed: boolean;
}

export type MarketplaceRateType = 'hourly' | 'session' | 'project' | 'custom';

export interface MarketplaceRate {
  type: MarketplaceRateType;
  amount: string;
  customLabel?: string;
}

export interface MarketplaceProfile {
  id: string;
  name: string;
  username: string;
  avatar: string;
  location: string;
  distance: number;
  skills: string[];
  bio: string;
  lookingFor: 'networking' | 'collaboration' | 'hiring' | 'opportunities';
  category: string;
  verified: boolean;
  rating: number;
  reviewCount: number;
  availability: 'available' | 'busy' | 'offline';
  hourlyRate?: string;
  rate?: MarketplaceRate;
  portfolio?: string[];
}

// All mock data removed — app now uses Supabase live backend
export const mockUsers: User[] = [];
export const mockPosts: Post[] = [];
export const mockLiveStreams: LiveStream[] = [];
export const mockInsights: Insight[] = [];
export const mockStories: Story[] = [];
export const mockMarketplaceProfiles: MarketplaceProfile[] = [];
export const interests: Interest[] = [];
export const goals: Interest[] = [];
