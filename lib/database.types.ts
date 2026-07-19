export type RelationshipCategory = 'family' | 'friend' | 'business' | 'mentor' | 'colleague' | 'associate' | 'investor' | 'prospect';

export interface DbUser {
  id: string;
  name: string;
  username: string;
  avatar: string;
  is_verified: boolean;
  followers_count: number;
  is_live?: boolean;
  relationship_category?: RelationshipCategory;
  created_at: string;
  updated_at: string;
}

export interface DbPost {
  id: string;
  user_id: string;
  content: string;
  image_url?: string;
  timestamp: string;
  likes: number;
  comments: number;
  shares: number;
  is_apparently?: boolean;
  apparently_tag?: string;
  created_at: string;
  updated_at: string;
}

export interface DbStory {
  id: string;
  user_id: string;
  image_url: string;
  timestamp: string;
  viewed: boolean;
  background_color?: string;
  text_content?: string;
  created_at: string;
  expires_at: string;
}

export interface DbListing {
  id: string;
  category: 'stay' | 'car' | 'boat' | 'product';
  title: string;
  description: string;
  images: string[];
  host_id: string;
  location: string;
  coordinates?: { lat: number; lng: number };
  price_per_day: number;
  price_per_hour?: number;
  currency: string;
  rating: number;
  review_count: number;
  views?: number;
  messages_count?: number;
  sales_count?: number;
  amenity_ids?: string[];
  status: 'available' | 'booked' | 'unavailable';
  instant_book: boolean;
  specs?: Record<string, string>;
  rules?: string[];
  cancellation_policy?: 'flexible' | 'moderate' | 'strict';
  created_at: string;
  updated_at: string;
}

export interface DbBooking {
  id: string;
  listing_id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  total_price: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  guest_count?: number;
  message?: string;
  created_at: string;
  updated_at: string;
}

export interface DbProduct {
  id: string;
  seller_id: string;
  seller_name: string;
  seller_avatar: string;
  seller_username: string;
  title: string;
  description: string;
  price: number;
  accepts_swap: boolean;
  condition: 'new' | 'like_new' | 'good' | 'fair' | 'used';
  category: 'electronics' | 'clothing' | 'home' | 'sports' | 'vehicles' | 'collectibles' | 'services' | 'other';
  images: { id: string; uri: string; isVideo?: boolean }[];
  location: string;
  views: number;
  saves: number;
  status: 'active' | 'sold' | 'reserved' | 'deleted';
  created_at: string;
  updated_at: string;
}

export interface DbProductInquiry {
  id: string;
  product_id: string;
  user_id: string;
  user_name: string;
  user_avatar: string;
  message: string;
  is_swap_offer?: boolean;
  swap_service_id?: string;
  read: boolean;
  created_at: string;
}

export interface DbCalendarEvent {
  id: string;
  user_id: string;
  title: string;
  type: 'meeting' | 'personal' | 'business' | 'reminder' | 'deadline';
  date: string;
  time: string;
  duration: number;
  location?: string;
  attendees?: string[];
  priority: 'low' | 'medium' | 'high';
  is_completed: boolean;
  income_amount?: number;
  income_source?: string;
  payment_status?: 'expected' | 'received' | 'overdue';
  created_at: string;
  updated_at: string;
}

export interface DbBill {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  due_date: string;
  category: 'utilities' | 'subscription' | 'loan' | 'insurance' | 'rent' | 'other';
  is_paid: boolean;
  is_recurring: boolean;
  frequency?: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  created_at: string;
  updated_at: string;
}

export interface DbRelationship {
  id: string;
  user_id: string;
  name: string;
  avatar: string;
  category: RelationshipCategory;
  last_interaction: string;
  last_interaction_date: string;
  interaction_score: number;
  notes?: string;
  upcoming_birthday?: string;
  tags: string[];
  phone?: string;
  email?: string;
  company?: string;
  role?: string;
  needs_attention: boolean;
  attention_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface DbContactInteraction {
  id: string;
  relationship_id: string;
  type: 'call' | 'meeting' | 'message' | 'email' | 'in_person';
  date: string;
  time?: string;
  duration?: number;
  notes?: string;
  outcome?: string;
  created_at: string;
}

export interface DbContactMeeting {
  id: string;
  relationship_id: string;
  title: string;
  date: string;
  time: string;
  location?: string;
  agenda?: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';
  reminder_sent?: boolean;
  expected_income?: number;
  income_type?: 'consulting' | 'service' | 'product' | 'commission' | 'retainer' | 'project' | 'other';
  income_status?: 'planned' | 'closed_paid' | 'closed_unpaid' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface DbContactFollowUp {
  id: string;
  relationship_id: string;
  title: string;
  due_date: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'completed' | 'overdue';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface DbPipeline {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface DbPipelineStage {
  id: string;
  pipeline_id: string;
  name: string;
  color: string;
  order_index: number;
}

export interface DbPipelineItem {
  id: string;
  pipeline_id: string;
  stage_id: string;
  title: string;
  value?: number;
  linked_contact_id?: string;
  notes?: string;
  tags?: string[];
  priority?: 'low' | 'medium' | 'high';
  due_date?: string;
  webhook_url?: string;
  created_at: string;
  updated_at: string;
}

export interface DbIncomeSource {
  id: string;
  user_id: string;
  name: string;
  type: 'business' | 'freelance' | 'investment' | 'passive' | 'salary';
  estimated_amount: number;
  frequency: 'daily' | 'weekly' | 'monthly';
  confidence: number;
  linked_connections?: string[];
  created_at: string;
  updated_at: string;
}

export interface DbMarketWatch {
  id: string;
  user_id: string;
  symbol: string;
  name: string;
  price: number;
  change: number;
  change_percent: number;
  type: 'stock' | 'index' | 'crypto' | 'forex';
  created_at: string;
  updated_at: string;
}
