import { supabase } from './supabase';
import { isAbortError, logAbort, withAbortSignal } from '@/lib/abort';
import type {
  DbUser,
  DbPost,
  DbStory,
  DbListing,
  DbBooking,
  DbProduct,
  DbProductInquiry,
  DbCalendarEvent,
  DbBill,
  DbRelationship,
  DbContactInteraction,
  DbContactMeeting,
  DbContactFollowUp,
  DbPipeline,
  DbPipelineStage,
  DbPipelineItem,
  DbIncomeSource,
  DbMarketWatch,
} from './database.types';

type DbQueryOpts = {
  signal?: AbortSignal;
};


export class DatabaseService {

  private static unavailableTables = new Set<string>();

  static async fetchUsers(opts?: DbQueryOpts): Promise<DbUser[]> {
    const table = 'users';
    if (DatabaseService.isTableUnavailable(table)) {
      console.log('[DB] Skipping fetchUsers - table unavailable');
      return [];
    }

    console.log('[DB] Fetching users...');
    const { data, error } = await withAbortSignal(
      supabase.from(table).select('*').order('created_at', { ascending: false }),
      opts?.signal
    );

    if (error) {
      if (isAbortError(error)) {
        logAbort('[DB][fetchUsers]');
        return [];
      }
      if (DatabaseService.isMissingTableError(error)) {
        DatabaseService.markTableUnavailable(table, error);
        return [];
      }
      console.error('[DB] Error fetching users:', error.message, error.code, error.details);
      return [];
    }

    console.log('[DB] Fetched users:', data?.length || 0);
    return data || [];
  }

  static async fetchUserById(id: string, opts?: DbQueryOpts): Promise<DbUser | null> {
    const table = 'users';
    if (DatabaseService.isTableUnavailable(table)) {
      console.log('[DB] Skipping fetchUserById - table unavailable');
      return null;
    }

    console.log('[DB] Fetching user by id:', id);
    const { data, error } = await withAbortSignal(
      supabase.from(table).select('*').eq('id', id).single(),
      opts?.signal
    );

    if (error) {
      if (isAbortError(error)) {
        logAbort('[DB][fetchUserById]');
        return null;
      }
      if (DatabaseService.isMissingTableError(error)) {
        DatabaseService.markTableUnavailable(table, error);
        return null;
      }
      console.error('[DB] Error fetching user by id:', error.message, error.code, error.details);
      return null;
    }

    return data;
  }


  private static isMissingTableError(error: unknown): boolean {
    const anyErr = error as { code?: string; message?: string; details?: string } | null;
    const code = anyErr?.code;
    const message = anyErr?.message ?? '';
    const details = anyErr?.details ?? '';
    return code === 'PGRST205' || message.includes('schema cache') || details.includes('schema cache');
  }

  private static markTableUnavailable(table: string, error: unknown) {
    if (!DatabaseService.unavailableTables.has(table)) {
      console.warn('[DB] Table missing/unavailable:', table, error);
      DatabaseService.unavailableTables.add(table);
    }
  }

  private static isTableUnavailable(table: string) {
    return DatabaseService.unavailableTables.has(table);
  }

  static async getCurrentUserId(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id || null;
  }

  private static DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

  static async ensureDefaultUser(): Promise<string> {
    const existingUser = await this.fetchUserById(this.DEFAULT_USER_ID);
    if (existingUser) {
      console.log('[DB] Default user exists:', this.DEFAULT_USER_ID);
      return this.DEFAULT_USER_ID;
    }

    console.log('[DB] Creating default user...');
    const { data, error } = await supabase
      .from('users')
      .insert({
        id: this.DEFAULT_USER_ID,
        name: 'App User',
        username: 'appuser',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop',
        is_verified: false,
        followers_count: 0,
      })
      .select()
      .single();

    if (error) {
      console.error('[DB] Error creating default user:', error.message, error.code, error.details);
      if (error.code === '23505') {
        console.log('[DB] Default user already exists (race condition)');
        return this.DEFAULT_USER_ID;
      }
      throw new Error(`Failed to create default user: ${error.message}`);
    }

    console.log('[DB] Created default user:', data.id);
    return data.id;
  }

  static async getOrCreateUserId(): Promise<string> {
    const authUserId = await this.getCurrentUserId();
    if (authUserId) {
      console.log('[DB] Using authenticated user:', authUserId);
      return authUserId;
    }
    
    // If no authenticated user, try to ensure default user exists
    // But if that fails (e.g., RLS blocks it), still return the default ID
    try {
      return await this.ensureDefaultUser();
    } catch (error) {
      console.warn('[DB] Could not ensure default user, using default ID anyway:', error);
      return this.DEFAULT_USER_ID;
    }
  }

  static getDefaultUserId(): string {
    return this.DEFAULT_USER_ID;
  }

  static async fetchPosts(opts?: DbQueryOpts): Promise<DbPost[]> {
    const table = 'posts';
    if (DatabaseService.isTableUnavailable(table)) {
      console.log('[DB] Skipping fetchPosts - table unavailable');
      return [];
    }

    console.log('[DB] Fetching posts...');
    const { data, error } = await withAbortSignal(
      supabase.from(table).select('*').order('created_at', { ascending: false }),
      opts?.signal
    );

    if (error) {
      if (isAbortError(error)) {
        logAbort('[DB][fetchPosts]');
        return [];
      }
      if (DatabaseService.isMissingTableError(error)) {
        DatabaseService.markTableUnavailable(table, error);
        return [];
      }
      console.error('[DB] Error fetching posts:', error.message, error.code, error.details);
      return [];
    }
    console.log('[DB] Fetched posts:', data?.length || 0);
    return data || [];
  }

  static async fetchUserPosts(userId: string, opts?: DbQueryOpts): Promise<DbPost[]> {
    console.log('[DB] Fetching user posts for:', userId);
    const { data, error } = await withAbortSignal(
      supabase.from('posts').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      opts?.signal
    );

    if (error) {
      if (isAbortError(error)) {
        logAbort('[DB][fetchUserPosts]');
        return [];
      }
      console.error('[DB] Error fetching user posts:', error.message, error.code, error.details);
      return [];
    }
    return data || [];
  }

  static async createPost(post: Omit<DbPost, 'id' | 'created_at' | 'updated_at'>): Promise<DbPost | null> {
    console.log('[DB] Creating post...');
    const { data, error } = await supabase
      .from('posts')
      .insert(post)
      .select()
      .single();

    if (error) {
      console.error('[DB] Error creating post:', error.message, error.code, error.details);
      return null;
    }
    console.log('[DB] Created post:', data.id);
    return data;
  }

  static async updatePost(id: string, updates: Partial<DbPost>): Promise<DbPost | null> {
    console.log('[DB] Updating post:', id);
    const { data, error } = await supabase
      .from('posts')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[DB] Error updating post:', error.message, error.code, error.details);
      return null;
    }
    return data;
  }

  static async deletePost(id: string): Promise<boolean> {
    console.log('[DB] Deleting post:', id);
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[DB] Error deleting post:', error.message, error.code, error.details);
      return false;
    }
    return true;
  }

  static async fetchStories(opts?: DbQueryOpts): Promise<DbStory[]> {
    const table = 'stories';
    if (DatabaseService.isTableUnavailable(table)) {
      console.log('[DB] Skipping fetchStories - table unavailable');
      return [];
    }

    console.log('[DB] Fetching stories...');
    const { data, error } = await withAbortSignal(
      supabase
        .from(table)
        .select('*')
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false }),
      opts?.signal
    );

    if (error) {
      if (isAbortError(error)) {
        logAbort('[DB][fetchStories]');
        return [];
      }
      if (DatabaseService.isMissingTableError(error)) {
        DatabaseService.markTableUnavailable(table, error);
        return [];
      }
      console.error('[DB] Error fetching stories:', error.message, error.code, error.details);
      return [];
    }
    console.log('[DB] Fetched stories:', data?.length || 0);
    return data || [];
  }

  static async createStory(story: Omit<DbStory, 'id' | 'created_at'>): Promise<DbStory | null> {
    console.log('[DB] Creating story...');
    const { data, error } = await supabase
      .from('stories')
      .insert(story)
      .select()
      .single();

    if (error) {
      console.error('[DB] Error creating story:', error.message, error.code, error.details);
      return null;
    }
    return data;
  }

  static async fetchListings(category?: string, opts?: DbQueryOpts): Promise<DbListing[]> {
    const table = 'listings';
    if (DatabaseService.isTableUnavailable(table)) {
      console.log('[DB] Skipping fetchListings - table unavailable');
      return [];
    }

    console.log('[DB] Fetching listings from Supabase...', category ? `category: ${category}` : '');
    let query = supabase
      .from(table)
      .select('*')
      .order('created_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await withAbortSignal(query, opts?.signal);

    if (error) {
      if (isAbortError(error)) {
        logAbort('[DB][fetchListings]');
        return [];
      }
      if (DatabaseService.isMissingTableError(error)) {
        DatabaseService.markTableUnavailable(table, error);
        return [];
      }
      console.error('[DB] Error fetching listings:', error.message, error.code, error.details);
      return [];
    }
    console.log('[DB] Fetched listings from Supabase:', data?.length || 0);
    return data || [];
  }

  static async createListing(listing: Omit<DbListing, 'id' | 'created_at' | 'updated_at'>): Promise<DbListing | null> {
    console.log('[DB] Creating listing...');
    
    try {
      // First try to get authenticated user, then fall back to default
      let validUserId: string = await this.getCurrentUserId() || this.DEFAULT_USER_ID;
      
      console.log('[DB] Using user_id for listing:', validUserId);
      
      // Ensure we have a valid user ID
      if (!validUserId || validUserId.trim() === '') {
        validUserId = this.DEFAULT_USER_ID;
        console.log('[DB] Fallback to default user ID:', validUserId);
      }
      
      // Build clean listing object with explicit user_id
      const listingToInsert: Record<string, any> = {
        category: listing.category,
        type: (listing as any).type || 'rental',
        title: listing.title,
        description: listing.description,
        images: listing.images || [],
        location: listing.location,
        price_per_day: listing.price_per_day,
        currency: listing.currency || 'USD',
        rating: listing.rating ?? 0,
        review_count: listing.review_count ?? 0,
        status: listing.status || 'available',
        instant_book: listing.instant_book ?? false,
        // Set BOTH user_id and host_id to cover different schema possibilities
        user_id: validUserId,
        host_id: validUserId,
      };
      
      // Add optional fields only if they have values
      if (listing.price_per_hour !== undefined) {
        listingToInsert.price_per_hour = listing.price_per_hour;
      }
      if (listing.coordinates) {
        listingToInsert.coordinates = listing.coordinates;
      }
      if (listing.specs && Object.keys(listing.specs).length > 0) {
        listingToInsert.specs = listing.specs;
      }
      if (listing.rules && listing.rules.length > 0) {
        listingToInsert.rules = listing.rules;
      }
      if (listing.amenity_ids && listing.amenity_ids.length > 0) {
        listingToInsert.amenity_ids = listing.amenity_ids;
      }
      
      console.log('[DB] Inserting listing with user_id:', listingToInsert.user_id, 'host_id:', listingToInsert.host_id);
      
      const { data, error } = await supabase
        .from('listings')
        .insert(listingToInsert)
        .select()
        .single();

      if (error) {
        console.error('[DB] Error creating listing:', error.message, error.code, error.details, error.hint);
        return null;
      }
      console.log('[DB] Created listing in Supabase:', data.id);
      return data;
    } catch (err) {
      console.error('[DB] Exception creating listing:', err);
      return null;
    }
  }

  static async fetchListingById(id: string): Promise<DbListing | null> {
    const { data, error } = await supabase
      .from('listings')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[DB] Error fetching listing:', error.message, error.code, error.details);
      return null;
    }
    return data;
  }

  static async fetchUserListings(hostId: string, opts?: DbQueryOpts): Promise<DbListing[]> {
    const table = 'listings';
    if (DatabaseService.isTableUnavailable(table)) {
      console.log('[DB] Skipping fetchUserListings - table unavailable');
      return [];
    }

    const validHostId = hostId === 'current-user' ? this.DEFAULT_USER_ID : hostId;
    console.log('[DB] Fetching user listings for host:', validHostId);
    
    const { data, error } = await withAbortSignal(
      supabase
        .from(table)
        .select('*')
        .eq('host_id', validHostId)
        .order('created_at', { ascending: false }),
      opts?.signal
    );

    if (error) {
      if (isAbortError(error)) {
        logAbort('[DB][fetchUserListings]');
        return [];
      }
      if (DatabaseService.isMissingTableError(error)) {
        DatabaseService.markTableUnavailable(table, error);
        return [];
      }
      console.error('[DB] Error fetching user listings:', error.message, error.code, error.details);
      return [];
    }
    console.log('[DB] Fetched user listings from Supabase:', data?.length || 0);
    return data || [];
  }

  static async updateListing(id: string, updates: Partial<DbListing>): Promise<DbListing | null> {
    console.log('[DB] Updating listing:', id);
    const { data, error } = await supabase
      .from('listings')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[DB] Error updating listing:', error.message, error.code, error.details);
      return null;
    }
    console.log('[DB] Updated listing:', data.id);
    return data;
  }

  static async deleteListing(id: string): Promise<boolean> {
    console.log('[DB] Deleting listing:', id);
    const { error } = await supabase
      .from('listings')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[DB] Error deleting listing:', error.message, error.code, error.details);
      return false;
    }
    console.log('[DB] Deleted listing:', id);
    return true;
  }

  static async fetchBookings(userId: string, opts?: DbQueryOpts): Promise<DbBooking[]> {
    const table = 'bookings';
    if (DatabaseService.isTableUnavailable(table)) {
      console.log('[DB] Skipping fetchBookings - table unavailable');
      return [];
    }

    console.log('[DB] Fetching bookings for user:', userId);
    const { data, error } = await withAbortSignal(
      supabase.from(table).select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      opts?.signal
    );

    if (error) {
      if (isAbortError(error)) {
        logAbort('[DB][fetchBookings]');
        return [];
      }
      if (DatabaseService.isMissingTableError(error)) {
        DatabaseService.markTableUnavailable(table, error);
        return [];
      }
      const anyErr = error as unknown as { message?: string; code?: string; details?: string; hint?: string };
      console.error('[DB] Error fetching bookings:', anyErr?.message ?? String(error), anyErr?.code, anyErr?.details);
      return [];
    }
    return data || [];
  }

  static async createBooking(booking: Omit<DbBooking, 'id' | 'created_at' | 'updated_at'>): Promise<DbBooking | null> {
    console.log('[DB] Creating booking...');
    const { data, error } = await supabase
      .from('bookings')
      .insert(booking)
      .select()
      .single();

    if (error) {
      console.error('[DB] Error creating booking:', error.message, error.code, error.details);
      return null;
    }
    console.log('[DB] Created booking:', data.id);
    return data;
  }

  static async updateBooking(id: string, updates: Partial<DbBooking>): Promise<DbBooking | null> {
    const { data, error } = await supabase
      .from('bookings')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[DB] Error updating booking:', error.message, error.code, error.details);
      return null;
    }
    return data;
  }

  static async fetchProducts(category?: string, opts?: DbQueryOpts): Promise<DbProduct[]> {
    const table = 'products';
    if (DatabaseService.isTableUnavailable(table)) {
      console.log('[DB] Skipping fetchProducts - table unavailable');
      return [];
    }

    console.log('[DB] Fetching products...', category ? `category: ${category}` : '');
    let query = supabase
      .from(table)
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await withAbortSignal(query, opts?.signal);

    if (error) {
      if (isAbortError(error)) {
        logAbort('[DB][fetchProducts]');
        return [];
      }
      if (DatabaseService.isMissingTableError(error)) {
        DatabaseService.markTableUnavailable(table, error);
        return [];
      }
      console.error('[DB] Error fetching products:', error.message, error.code, error.details);
      return [];
    }
    console.log('[DB] Fetched products:', data?.length || 0);
    return data || [];
  }

  static async fetchUserProducts(userId: string): Promise<DbProduct[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('seller_id', userId)
      .neq('status', 'deleted')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[DB] Error fetching user products:', error.message, error.code, error.details);
      return [];
    }
    return data || [];
  }

  static async createProduct(product: Omit<DbProduct, 'id' | 'created_at' | 'updated_at' | 'views' | 'saves'>): Promise<DbProduct | null> {
    console.log('[DB] Creating product...');
    const { data, error } = await supabase
      .from('products')
      .insert({ ...product, views: 0, saves: 0 })
      .select()
      .single();

    if (error) {
      console.error('[DB] Error creating product:', error.message, error.code, error.details);
      return null;
    }
    console.log('[DB] Created product:', data.id);
    return data;
  }

  static async updateProduct(id: string, updates: Partial<DbProduct>): Promise<DbProduct | null> {
    const { data, error } = await supabase
      .from('products')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[DB] Error updating product:', error.message, error.code, error.details);
      return null;
    }
    return data;
  }

  static async fetchProductInquiries(productId: string, opts?: DbQueryOpts): Promise<DbProductInquiry[]> {
    const { data, error } = await withAbortSignal(
      supabase.from('product_inquiries').select('*').eq('product_id', productId).order('created_at', { ascending: false }),
      opts?.signal
    );

    if (error) {
      if (isAbortError(error)) {
        logAbort('[DB][fetchProductInquiries]');
        return [];
      }
      console.error('[DB] Error fetching inquiries:', error.message, error.code, error.details);
      return [];
    }
    return data || [];
  }

  static async createProductInquiry(inquiry: Omit<DbProductInquiry, 'id' | 'created_at'>): Promise<DbProductInquiry | null> {
    const { data, error } = await supabase
      .from('product_inquiries')
      .insert(inquiry)
      .select()
      .single();

    if (error) {
      console.error('[DB] Error creating inquiry:', error.message, error.code, error.details);
      return null;
    }
    return data;
  }

  static async fetchCalendarEvents(userId: string, opts?: DbQueryOpts): Promise<DbCalendarEvent[]> {
    const table = 'calendar_events';
    if (DatabaseService.isTableUnavailable(table)) {
      console.log('[DB] Skipping fetchCalendarEvents - table unavailable');
      return [];
    }

    console.log('[DB] Fetching calendar events for user:', userId);
    const { data, error } = await withAbortSignal(
      supabase.from(table).select('*').eq('user_id', userId).order('date', { ascending: true }),
      opts?.signal
    );

    if (error) {
      if (isAbortError(error)) {
        logAbort('[DB][fetchCalendarEvents]');
        return [];
      }
      if (DatabaseService.isMissingTableError(error)) {
        DatabaseService.markTableUnavailable(table, error);
        return [];
      }
      const anyErr = error as unknown as { message?: string; code?: string; details?: string; hint?: string };
      console.error('[DB] Error fetching calendar events:', anyErr?.message ?? String(error), anyErr?.code, anyErr?.details);
      return [];
    }
    return data || [];
  }

  static async createCalendarEvent(event: Omit<DbCalendarEvent, 'id' | 'created_at' | 'updated_at'>): Promise<DbCalendarEvent | null> {
    const { data, error } = await supabase
      .from('calendar_events')
      .insert(event)
      .select()
      .single();

    if (error) {
      console.error('[DB] Error creating calendar event:', error);
      return null;
    }
    return data;
  }

  static async updateCalendarEvent(id: string, updates: Partial<DbCalendarEvent>): Promise<DbCalendarEvent | null> {
    const { data, error } = await supabase
      .from('calendar_events')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[DB] Error updating calendar event:', error);
      return null;
    }
    return data;
  }

  static async deleteCalendarEvent(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('calendar_events')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[DB] Error deleting calendar event:', error);
      return false;
    }
    return true;
  }

  static async fetchBills(userId: string, opts?: DbQueryOpts): Promise<DbBill[]> {
    const table = 'bills';
    if (DatabaseService.isTableUnavailable(table)) {
      console.log('[DB] Skipping fetchBills - table unavailable');
      return [];
    }

    console.log('[DB] Fetching bills for user:', userId);
    const { data, error } = await withAbortSignal(
      supabase.from(table).select('*').eq('user_id', userId).order('due_date', { ascending: true }),
      opts?.signal
    );

    if (error) {
      if (isAbortError(error)) {
        logAbort('[DB][fetchBills]');
        return [];
      }
      if (DatabaseService.isMissingTableError(error)) {
        DatabaseService.markTableUnavailable(table, error);
        return [];
      }
      const anyErr = error as unknown as { message?: string; code?: string; details?: string; hint?: string };
      console.error('[DB] Error fetching bills:', anyErr?.message ?? String(error), anyErr?.code, anyErr?.details);
      return [];
    }
    return data || [];
  }

  static async createBill(bill: Omit<DbBill, 'id' | 'created_at' | 'updated_at'>): Promise<DbBill | null> {
    const { data, error } = await supabase
      .from('bills')
      .insert(bill)
      .select()
      .single();

    if (error) {
      console.error('[DB] Error creating bill:', error);
      return null;
    }
    return data;
  }

  static async updateBill(id: string, updates: Partial<DbBill>): Promise<DbBill | null> {
    const { data, error } = await supabase
      .from('bills')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[DB] Error updating bill:', error);
      return null;
    }
    return data;
  }

  static async deleteBill(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('bills')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[DB] Error deleting bill:', error);
      return false;
    }
    return true;
  }

  static async fetchRelationships(userId: string, opts?: DbQueryOpts): Promise<DbRelationship[]> {
    const table = 'relationships';
    if (DatabaseService.isTableUnavailable(table)) {
      console.log('[DB] Skipping fetchRelationships - table unavailable');
      return [];
    }

    console.log('[DB] Fetching relationships for user:', userId);
    const { data, error } = await withAbortSignal(
      supabase.from(table).select('*').eq('user_id', userId).order('name', { ascending: true }),
      opts?.signal
    );

    if (error) {
      if (isAbortError(error)) {
        logAbort('[DB][fetchRelationships]');
        return [];
      }
      if (DatabaseService.isMissingTableError(error)) {
        DatabaseService.markTableUnavailable(table, error);
        return [];
      }
      const anyErr = error as unknown as { message?: string; code?: string; details?: string; hint?: string };
      console.error('[DB] Error fetching relationships:', anyErr?.message ?? String(error), anyErr?.code, anyErr?.details);
      return [];
    }
    return data || [];
  }

  static async createRelationship(relationship: Omit<DbRelationship, 'id' | 'created_at' | 'updated_at'>): Promise<DbRelationship | null> {
    const { data, error } = await supabase
      .from('relationships')
      .insert(relationship)
      .select()
      .single();

    if (error) {
      console.error('[DB] Error creating relationship:', error);
      return null;
    }
    return data;
  }

  static async updateRelationship(id: string, updates: Partial<DbRelationship>): Promise<DbRelationship | null> {
    const { data, error } = await supabase
      .from('relationships')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[DB] Error updating relationship:', error);
      return null;
    }
    return data;
  }

  static async deleteRelationship(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('relationships')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[DB] Error deleting relationship:', error);
      return false;
    }
    return true;
  }

  static async fetchContactInteractions(relationshipId: string, opts?: DbQueryOpts): Promise<DbContactInteraction[]> {
    const { data, error } = await withAbortSignal(
      supabase.from('contact_interactions').select('*').eq('relationship_id', relationshipId).order('date', { ascending: false }),
      opts?.signal
    );

    if (error) {
      if (isAbortError(error)) {
        logAbort('[DB][fetchContactInteractions]');
        return [];
      }
      console.error('[DB] Error fetching interactions:', error);
      return [];
    }
    return data || [];
  }

  static async createContactInteraction(interaction: Omit<DbContactInteraction, 'id' | 'created_at'>): Promise<DbContactInteraction | null> {
    const { data, error } = await supabase
      .from('contact_interactions')
      .insert(interaction)
      .select()
      .single();

    if (error) {
      console.error('[DB] Error creating interaction:', error);
      return null;
    }
    return data;
  }

  static async fetchContactMeetings(relationshipId: string, opts?: DbQueryOpts): Promise<DbContactMeeting[]> {
    const { data, error } = await withAbortSignal(
      supabase.from('contact_meetings').select('*').eq('relationship_id', relationshipId).order('date', { ascending: true }),
      opts?.signal
    );

    if (error) {
      if (isAbortError(error)) {
        logAbort('[DB][fetchContactMeetings]');
        return [];
      }
      console.error('[DB] Error fetching meetings:', error);
      return [];
    }
    return data || [];
  }

  static async createContactMeeting(meeting: Omit<DbContactMeeting, 'id' | 'created_at' | 'updated_at'>): Promise<DbContactMeeting | null> {
    const { data, error } = await supabase
      .from('contact_meetings')
      .insert(meeting)
      .select()
      .single();

    if (error) {
      console.error('[DB] Error creating meeting:', error);
      return null;
    }
    return data;
  }

  static async updateContactMeeting(id: string, updates: Partial<DbContactMeeting>): Promise<DbContactMeeting | null> {
    const { data, error } = await supabase
      .from('contact_meetings')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[DB] Error updating meeting:', error);
      return null;
    }
    return data;
  }

  static async deleteContactMeeting(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('contact_meetings')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[DB] Error deleting meeting:', error);
      return false;
    }
    return true;
  }

  static async fetchContactFollowUps(relationshipId: string, opts?: DbQueryOpts): Promise<DbContactFollowUp[]> {
    const { data, error } = await withAbortSignal(
      supabase.from('contact_follow_ups').select('*').eq('relationship_id', relationshipId).order('due_date', { ascending: true }),
      opts?.signal
    );

    if (error) {
      if (isAbortError(error)) {
        logAbort('[DB][fetchContactFollowUps]');
        return [];
      }
      console.error('[DB] Error fetching follow-ups:', error);
      return [];
    }
    return data || [];
  }

  static async createContactFollowUp(followUp: Omit<DbContactFollowUp, 'id' | 'created_at' | 'updated_at'>): Promise<DbContactFollowUp | null> {
    const { data, error } = await supabase
      .from('contact_follow_ups')
      .insert(followUp)
      .select()
      .single();

    if (error) {
      console.error('[DB] Error creating follow-up:', error);
      return null;
    }
    return data;
  }

  static async updateContactFollowUp(id: string, updates: Partial<DbContactFollowUp>): Promise<DbContactFollowUp | null> {
    const { data, error } = await supabase
      .from('contact_follow_ups')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[DB] Error updating follow-up:', error);
      return null;
    }
    return data;
  }

  static async deleteContactFollowUp(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('contact_follow_ups')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[DB] Error deleting follow-up:', error);
      return false;
    }
    return true;
  }

  static async fetchPipelines(userId: string): Promise<DbPipeline[]> {
    const { data, error } = await supabase
      .from('pipelines')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[DB] Error fetching pipelines:', error);
      return [];
    }
    return data || [];
  }

  static async fetchPipelineStages(pipelineId: string): Promise<DbPipelineStage[]> {
    const { data, error } = await supabase
      .from('pipeline_stages')
      .select('*')
      .eq('pipeline_id', pipelineId)
      .order('order_index', { ascending: true });

    if (error) {
      console.error('[DB] Error fetching pipeline stages:', error);
      return [];
    }
    return data || [];
  }

  static async fetchPipelineItems(pipelineId: string): Promise<DbPipelineItem[]> {
    const { data, error } = await supabase
      .from('pipeline_items')
      .select('*')
      .eq('pipeline_id', pipelineId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[DB] Error fetching pipeline items:', error);
      return [];
    }
    return data || [];
  }

  static async createPipelineItem(item: Omit<DbPipelineItem, 'id' | 'created_at' | 'updated_at'>): Promise<DbPipelineItem | null> {
    const { data, error } = await supabase
      .from('pipeline_items')
      .insert(item)
      .select()
      .single();

    if (error) {
      console.error('[DB] Error creating pipeline item:', error);
      return null;
    }
    return data;
  }

  static async updatePipelineItem(id: string, updates: Partial<DbPipelineItem>): Promise<DbPipelineItem | null> {
    const { data, error } = await supabase
      .from('pipeline_items')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[DB] Error updating pipeline item:', error);
      return null;
    }
    return data;
  }

  static async deletePipelineItem(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('pipeline_items')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[DB] Error deleting pipeline item:', error);
      return false;
    }
    return true;
  }

  static async fetchIncomeSources(userId: string): Promise<DbIncomeSource[]> {
    const { data, error } = await supabase
      .from('income_sources')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[DB] Error fetching income sources:', error);
      return [];
    }
    return data || [];
  }

  static async fetchMarketWatch(userId: string): Promise<DbMarketWatch[]> {
    const { data, error } = await supabase
      .from('market_watch')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[DB] Error fetching market watch:', error);
      return [];
    }
    return data || [];
  }

}

export default DatabaseService;
