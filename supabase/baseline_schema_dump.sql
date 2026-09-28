-- ============================================================
-- BASELINE SCHEMA DUMP (public) — generated FIX PART 4
-- Best-effort reproducibility artifact. NOT auto-applied.
-- Generated 2026-09-28T13:27:13.682Z

CREATE TABLE public.activity_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  action_type text,
  severity text,
  description text,
  metadata jsonb,
  ip_address text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.bills (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  amount numeric(10,2) NOT NULL,
  due_date date NOT NULL,
  category text NOT NULL,
  is_paid boolean DEFAULT false,
  is_recurring boolean DEFAULT false,
  frequency text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.bookings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  listing_id uuid NOT NULL,
  user_id uuid NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  total_price numeric(10,2) NOT NULL,
  status text DEFAULT 'pending'::text,
  guest_count integer,
  message text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.bundles (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  type text NOT NULL,
  items jsonb DEFAULT '[]'::jsonb,
  total_value numeric(10,2) DEFAULT 0,
  bundle_price numeric(10,2) DEFAULT 0,
  discount_percent integer DEFAULT 0,
  commission_percent integer DEFAULT 10,
  image text,
  category text DEFAULT 'lifestyle'::text,
  status text DEFAULT 'draft'::text,
  views integer DEFAULT 0,
  grabs integer DEFAULT 0,
  earnings numeric(10,2) DEFAULT 0,
  provider_name text,
  provider_avatar text,
  location text,
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  creator_id uuid,
  services _text DEFAULT '{}'::text[],
  price numeric(10,2),
  cover_image text
);

CREATE TABLE public.calendar_events (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  type text,
  date date NOT NULL,
  time text NOT NULL,
  duration integer DEFAULT 60,
  location text,
  attendees _text,
  priority text,
  is_completed boolean DEFAULT false,
  income_amount numeric(10,2),
  income_source text,
  payment_status text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.chauffeur_applications (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text,
  email text,
  license_url text,
  registration_url text,
  id_url text,
  status text DEFAULT 'pending'::text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.connection_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  target_user_id uuid,
  message text,
  status text DEFAULT 'pending'::text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.contact_follow_ups (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  relationship_id uuid NOT NULL,
  title text NOT NULL,
  due_date date NOT NULL,
  priority text DEFAULT 'medium'::text,
  status text DEFAULT 'pending'::text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.contact_interactions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  relationship_id uuid NOT NULL,
  type text NOT NULL,
  date date NOT NULL,
  time text,
  duration integer,
  notes text,
  outcome text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.contact_meetings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  relationship_id uuid NOT NULL,
  title text NOT NULL,
  date date NOT NULL,
  time text NOT NULL,
  location text,
  agenda text,
  status text DEFAULT 'scheduled'::text,
  reminder_sent boolean DEFAULT false,
  expected_income numeric(10,2),
  income_type text,
  income_status text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.conversations (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  participant_one uuid NOT NULL,
  participant_two uuid NOT NULL,
  last_message_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.follows (
  id bigint NOT NULL DEFAULT nextval('follows_id_seq'::regclass),
  follower_id uuid NOT NULL,
  following_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.hidden_posts (
  id bigint NOT NULL DEFAULT nextval('hidden_posts_id_seq'::regclass),
  post_id text NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.income_sources (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  type text,
  estimated_amount numeric(10,2) NOT NULL,
  frequency text,
  confidence integer DEFAULT 80,
  linked_connections _text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.job_requests (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  type text,
  status text DEFAULT 'pending'::text,
  title text,
  description text,
  pickup_zip text,
  pickup_city text,
  pickup_state text,
  pickup_location text,
  dropoff_zip text,
  dropoff_city text,
  dropoff_state text,
  dropoff_location text,
  pickup_time text,
  return_time text,
  payment_method text,
  hours text,
  tasks jsonb,
  tools _text,
  notes text,
  plan_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  accepted_by uuid,
  accepted_by_name text,
  accepted_by_avatar text,
  accepted_by_rating numeric(3,2) DEFAULT 0,
  image text
);

CREATE TABLE public.listings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  description text,
  images _text,
  price numeric(10,2),
  location text,
  status text DEFAULT 'pending'::text,
  created_at timestamp with time zone DEFAULT now(),
  views integer DEFAULT 0,
  sales integer DEFAULT 0,
  messages_unread integer DEFAULT 0,
  category text,
  host_id uuid,
  price_per_day numeric(null,null),
  specs jsonb DEFAULT '{}'::jsonb,
  address text,
  available_from date,
  amenity_ids _text DEFAULT '{}'::text[],
  cancellation_policy text DEFAULT 'flexible'::text,
  coordinates jsonb,
  price_per_hour numeric(10,2),
  currency text DEFAULT 'USD'::text,
  rating numeric(3,2) DEFAULT 0,
  review_count integer DEFAULT 0,
  instant_book boolean DEFAULT false,
  rules _text DEFAULT '{}'::text[]
);

CREATE TABLE public.live_streams (
  id integer NOT NULL DEFAULT nextval('live_streams_id_seq'::regclass),
  streamer_id uuid NOT NULL,
  streamer_name text,
  streamer_avatar text,
  title text NOT NULL,
  thumbnail text,
  viewers integer DEFAULT 1,
  category text,
  tags text,
  description text,
  scheduled_for timestamp with time zone,
  duration text,
  is_live boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.market_watch (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  symbol text NOT NULL,
  name text NOT NULL,
  price numeric(12,2) NOT NULL,
  change numeric(10,2) DEFAULT 0,
  change_percent numeric(6,2) DEFAULT 0,
  type text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  conversation_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  receiver_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  read boolean DEFAULT false,
  actor_id uuid,
  actor_name text,
  actor_avatar text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.pipeline_items (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  pipeline_id uuid NOT NULL,
  stage_id uuid NOT NULL,
  title text NOT NULL,
  value numeric(10,2),
  linked_contact_id uuid,
  notes text,
  tags _text DEFAULT '{}'::text[],
  priority text,
  due_date date,
  webhook_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.pipeline_stages (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  pipeline_id uuid NOT NULL,
  name text NOT NULL,
  color text DEFAULT '#94A3B8'::text,
  order_index integer NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.pipelines (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.plan_sync (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  plan_id text NOT NULL,
  room_id text,
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  section text NOT NULL,
  data jsonb NOT NULL,
  version integer DEFAULT 1,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.plans (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  status text DEFAULT 'pending'::text,
  date date NOT NULL,
  date_label text,
  location_type text,
  custom_location text,
  transport text,
  pickup_zip text,
  pickup_city text,
  pickup_state text,
  dropoff_zip text,
  dropoff_city text,
  dropoff_state text,
  plan jsonb DEFAULT '{}'::jsonb,
  sent_proposals jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.post_comments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  post_id uuid NOT NULL,
  author_id uuid NOT NULL,
  text text NOT NULL,
  parent_id uuid,
  likes integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.post_likes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.posts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  content text NOT NULL,
  image_url text,
  timestamp text DEFAULT 'Just now'::text,
  likes integer DEFAULT 0,
  comments integer DEFAULT 0,
  shares integer DEFAULT 0,
  is_apparently boolean DEFAULT false,
  apparently_tag text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  post_kind text,
  video_url text,
  media_type text
);

CREATE TABLE public.product_inquiries (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  product_id uuid NOT NULL,
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  user_avatar text,
  message text NOT NULL,
  is_swap_offer boolean DEFAULT false,
  swap_service_id text,
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  title text NOT NULL,
  description text,
  price numeric(null,null),
  category text,
  images _text,
  location text,
  condition text,
  accepts_swap boolean DEFAULT false,
  status text DEFAULT 'pending'::text,
  created_at timestamp with time zone DEFAULT now(),
  views integer DEFAULT 0,
  seller_id uuid
);

CREATE TABLE public.profiles (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  phone text,
  full_name text,
  location text,
  wallet numeric(10,2) DEFAULT 0.00,
  created_at timestamp with time zone DEFAULT now(),
  username text DEFAULT ('user_'::text || (gen_random_uuid())::text),
  email text,
  avatar text,
  is_blocked boolean DEFAULT false,
  bio text,
  push_token text,
  push_token_updated_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now(),
  is_verified boolean NOT NULL DEFAULT false,
  followers_count integer NOT NULL DEFAULT 0,
  is_live boolean NOT NULL DEFAULT false,
  relationship_category text
);

CREATE TABLE public.relationships (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  avatar text,
  category text NOT NULL,
  last_interaction text DEFAULT 'Never'::text,
  last_interaction_date date,
  interaction_score integer DEFAULT 100,
  notes text,
  upcoming_birthday date,
  tags _text DEFAULT '{}'::text[],
  phone text,
  email text,
  company text,
  role text,
  needs_attention boolean DEFAULT false,
  attention_reason text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.reports (
  id bigint NOT NULL DEFAULT nextval('reports_id_seq'::regclass),
  post_id text NOT NULL,
  reported_by uuid NOT NULL,
  reason text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.room_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_id text NOT NULL,
  user_id uuid,
  user_name text NOT NULL,
  action text NOT NULL,
  detail text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.room_storage_quota (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_id text NOT NULL,
  bytes_used bigint NOT NULL DEFAULT 0,
  quota_limit bigint NOT NULL DEFAULT '5368709120'::bigint,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.rooms (
  id text NOT NULL,
  name text NOT NULL,
  topic text NOT NULL DEFAULT ''::text,
  goal text DEFAULT ''::text,
  category text DEFAULT 'General'::text,
  visibility text DEFAULT 'public'::text,
  max_participants integer DEFAULT 25,
  scheduled_date timestamp with time zone,
  cover_image text,
  creator_id uuid,
  creator_name text NOT NULL,
  creator_avatar text,
  participants jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  status text DEFAULT 'draft'::text,
  invite_link text,
  presentation_state text DEFAULT 'idle'::text,
  presenter_id uuid,
  presenter_name text,
  presenter_tab text,
  open_discussion boolean DEFAULT true,
  environment text DEFAULT 'generic'::text,
  activity_log jsonb DEFAULT '[]'::jsonb,
  edit_indicators jsonb DEFAULT '[]'::jsonb,
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.saved_posts (
  id bigint NOT NULL DEFAULT nextval('saved_posts_id_seq'::regclass),
  user_id uuid NOT NULL,
  post_id text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.service_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  category text,
  status text DEFAULT 'open'::text,
  budget numeric(10,2),
  location text,
  assigned_to uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  image_url text,
  creator_id uuid
);

CREATE TABLE public.site_leads (
  id bigint NOT NULL DEFAULT nextval('site_leads_id_seq'::regclass),
  need_help_with text NOT NULL DEFAULT ''::text,
  role_or_company text NOT NULL DEFAULT ''::text,
  timeline text NOT NULL DEFAULT ''::text,
  phone text NOT NULL DEFAULT ''::text,
  email text NOT NULL DEFAULT ''::text,
  source text DEFAULT 'nationalcompliancehub.com'::text,
  notified boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.skill_deals (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  service text NOT NULL,
  description text,
  featured_image text,
  category text NOT NULL,
  price numeric(10,2) NOT NULL,
  status text DEFAULT 'active'::text,
  views integer DEFAULT 0,
  grabs integer DEFAULT 0,
  earnings numeric(10,2) DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  creator_id uuid
);

CREATE TABLE public.stories (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  image_url text NOT NULL,
  timestamp text,
  viewed boolean DEFAULT false,
  background_color text,
  text_content text,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval)
);

CREATE TABLE public.swap_matches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  swap_post_id uuid,
  matched_user_id uuid,
  status text DEFAULT 'pending'::text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.swap_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  title text,
  description text,
  category text,
  images _text,
  status text DEFAULT 'open'::text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.user_grabs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  item_id text NOT NULL,
  item_type text,
  title text NOT NULL,
  price numeric(10,2) NOT NULL,
  status text DEFAULT 'pending'::text,
  booked_at timestamp with time zone DEFAULT now(),
  pickup_time timestamp with time zone,
  provider_id uuid,
  provider_name text,
  provider_avatar text,
  provider_rating numeric(3,2),
  conversation_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.user_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  reviewer_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  rating numeric(2,1),
  text text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role app_role NOT NULL DEFAULT 'user'::app_role,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.user_saves (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  item_id text NOT NULL,
  item_type text,
  title text NOT NULL,
  price numeric(10,2) NOT NULL,
  distance numeric(10,2),
  expires_at timestamp with time zone,
  image text,
  saved_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.virtual_room_environments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_id text NOT NULL,
  environment_type text NOT NULL DEFAULT 'generic'::text,
  background_color text DEFAULT '#FFFFFF'::text,
  camera_x double precision DEFAULT 0,
  camera_y double precision DEFAULT 0,
  camera_scale double precision DEFAULT 1,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.virtual_room_objects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_id text NOT NULL,
  object_type text NOT NULL DEFAULT 'image'::text,
  name text,
  description text,
  notes text,
  image_url text,
  position_x double precision NOT NULL DEFAULT 0,
  position_y double precision NOT NULL DEFAULT 0,
  width double precision NOT NULL DEFAULT 100,
  height double precision NOT NULL DEFAULT 100,
  rotation double precision NOT NULL DEFAULT 0,
  scale double precision NOT NULL DEFAULT 1,
  z_index integer NOT NULL DEFAULT 0,
  owner_id uuid,
  owner_name text,
  metadata jsonb DEFAULT '{}'::jsonb,
  price numeric(10,2),
  is_listed boolean DEFAULT false,
  sponsor_id uuid,
  reward_points integer,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE bills ADD CONSTRAINT bills_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE bookings ADD CONSTRAINT bookings_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id);
ALTER TABLE bookings ADD CONSTRAINT bookings_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id);
ALTER TABLE bundles ADD CONSTRAINT bundles_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE calendar_events ADD CONSTRAINT calendar_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id);
ALTER TABLE chauffeur_applications ADD CONSTRAINT chauffeur_applications_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES profiles(id);
ALTER TABLE chauffeur_applications ADD CONSTRAINT chauffeur_applications_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE contact_follow_ups ADD CONSTRAINT contact_follow_ups_relationship_id_fkey FOREIGN KEY (relationship_id) REFERENCES relationships(id) ON DELETE CASCADE;
ALTER TABLE contact_interactions ADD CONSTRAINT contact_interactions_relationship_id_fkey FOREIGN KEY (relationship_id) REFERENCES relationships(id) ON DELETE CASCADE;
ALTER TABLE contact_meetings ADD CONSTRAINT contact_meetings_relationship_id_fkey FOREIGN KEY (relationship_id) REFERENCES relationships(id) ON DELETE CASCADE;
ALTER TABLE conversations ADD CONSTRAINT conversations_participant_one_fkey FOREIGN KEY (participant_one) REFERENCES profiles(id);
ALTER TABLE conversations ADD CONSTRAINT conversations_participant_two_fkey FOREIGN KEY (participant_two) REFERENCES profiles(id);
ALTER TABLE follows ADD CONSTRAINT follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE follows ADD CONSTRAINT follows_following_id_fkey FOREIGN KEY (following_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE hidden_posts ADD CONSTRAINT hidden_posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE income_sources ADD CONSTRAINT income_sources_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id);
ALTER TABLE job_requests ADD CONSTRAINT job_requests_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE SET NULL;
ALTER TABLE job_requests ADD CONSTRAINT job_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id);
ALTER TABLE listings ADD CONSTRAINT listings_host_id_fkey FOREIGN KEY (host_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE listings ADD CONSTRAINT listings_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id);
ALTER TABLE live_streams ADD CONSTRAINT live_streams_streamer_id_fkey FOREIGN KEY (streamer_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE market_watch ADD CONSTRAINT market_watch_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE messages ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
ALTER TABLE messages ADD CONSTRAINT messages_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE messages ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD CONSTRAINT notifications_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE pipeline_items ADD CONSTRAINT pipeline_items_linked_contact_id_fkey FOREIGN KEY (linked_contact_id) REFERENCES relationships(id) ON DELETE SET NULL;
ALTER TABLE pipeline_items ADD CONSTRAINT pipeline_items_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES pipelines(id) ON DELETE CASCADE;
ALTER TABLE pipeline_items ADD CONSTRAINT pipeline_items_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES pipeline_stages(id) ON DELETE CASCADE;
ALTER TABLE pipeline_stages ADD CONSTRAINT pipeline_stages_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES pipelines(id) ON DELETE CASCADE;
ALTER TABLE pipelines ADD CONSTRAINT pipelines_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE plan_sync ADD CONSTRAINT plan_sync_room_id_fkey FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL;
ALTER TABLE plans ADD CONSTRAINT plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id);
ALTER TABLE post_comments ADD CONSTRAINT post_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE post_comments ADD CONSTRAINT post_comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES post_comments(id) ON DELETE CASCADE;
ALTER TABLE post_comments ADD CONSTRAINT post_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;
ALTER TABLE post_likes ADD CONSTRAINT post_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;
ALTER TABLE post_likes ADD CONSTRAINT post_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE posts ADD CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id);
ALTER TABLE product_inquiries ADD CONSTRAINT product_inquiries_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id);
ALTER TABLE product_inquiries ADD CONSTRAINT product_inquiries_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id);
ALTER TABLE products ADD CONSTRAINT products_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES auth.users(id);
ALTER TABLE products ADD CONSTRAINT products_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE relationships ADD CONSTRAINT relationships_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE reports ADD CONSTRAINT reports_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE room_history ADD CONSTRAINT room_history_room_id_fkey FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;
ALTER TABLE saved_posts ADD CONSTRAINT saved_posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE service_requests ADD CONSTRAINT service_requests_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id);
ALTER TABLE service_requests ADD CONSTRAINT service_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE stories ADD CONSTRAINT stories_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id);
ALTER TABLE swap_matches ADD CONSTRAINT swap_matches_swap_post_id_fkey FOREIGN KEY (swap_post_id) REFERENCES swap_posts(id);
ALTER TABLE user_grabs ADD CONSTRAINT user_grabs_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES profiles(id);
ALTER TABLE user_grabs ADD CONSTRAINT user_grabs_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id);
ALTER TABLE user_reviews ADD CONSTRAINT user_reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE user_reviews ADD CONSTRAINT user_reviews_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE user_saves ADD CONSTRAINT user_saves_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id);
ALTER TABLE virtual_room_environments ADD CONSTRAINT virtual_room_environments_room_id_fkey FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;
ALTER TABLE virtual_room_objects ADD CONSTRAINT virtual_room_objects_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);
ALTER TABLE virtual_room_objects ADD CONSTRAINT virtual_room_objects_room_id_fkey FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.auto_generate_username()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
    BEGIN
      IF NEW.username IS NULL OR NEW.username = '' THEN
        NEW.username := 'user_' || substring(replace(NEW.id::text, '-', ''), 1, 10);
      END IF;
      RETURN NEW;
    END;
    $function$


CREATE OR REPLACE FUNCTION public.get_my_profile()
 RETURNS profiles
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT * FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$function$


CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, username, full_name, email, avatar)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'username', ''),
             'user_' || substr(replace(new.id::text, '-', ''), 1, 12)),
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''),
             nullif(new.raw_user_meta_data->>'name', ''), 'User'),
    new.email,
    'https://api.dicebear.com/7.x/avataaars/svg?seed=' || new.id::text
  )
  on conflict (id) do nothing;
  return new;
exception when unique_violation then
  -- Never break auth signup: the app upserts the canonical profile (with the
  -- user's chosen handle) immediately after signup.
  return new;
end;
$function$


CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$function$


CREATE OR REPLACE FUNCTION public.inc_listing_view()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE public.listings 
  SET views = views + 1 
  WHERE id = NEW.id;
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.is_user_blocked()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT COALESCE((SELECT is_blocked FROM public.profiles WHERE id = auth.uid()), false);
$function$


CREATE OR REPLACE FUNCTION public.resolve_login_email(p_username text)
 RETURNS TABLE(email text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT p.email FROM public.profiles p
  WHERE lower(p.username) = lower(p_username) LIMIT 1;
$function$


CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  UPDATE public.conversations SET last_message_at = NOW() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.update_profiles_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$


-- TRIGGER update_bills_updated_at ON bills
EXECUTE FUNCTION update_updated_at_column();

-- TRIGGER update_bookings_updated_at ON bookings
EXECUTE FUNCTION update_updated_at_column();

-- TRIGGER update_bundles_updated_at ON bundles
EXECUTE FUNCTION update_updated_at_column();

-- TRIGGER update_calendar_events_updated_at ON calendar_events
EXECUTE FUNCTION update_updated_at_column();

-- TRIGGER update_chauffeur_applications_updated_at ON chauffeur_applications
EXECUTE FUNCTION update_updated_at_column();

-- TRIGGER update_contact_follow_ups_updated_at ON contact_follow_ups
EXECUTE FUNCTION update_updated_at_column();

-- TRIGGER update_contact_meetings_updated_at ON contact_meetings
EXECUTE FUNCTION update_updated_at_column();

-- TRIGGER update_income_sources_updated_at ON income_sources
EXECUTE FUNCTION update_updated_at_column();

-- TRIGGER update_job_requests_updated_at ON job_requests
EXECUTE FUNCTION update_updated_at_column();

-- TRIGGER listing_view_inc ON listings
EXECUTE FUNCTION inc_listing_view();

-- TRIGGER update_listings_updated_at ON listings
EXECUTE FUNCTION update_updated_at_column();

-- TRIGGER update_market_watch_updated_at ON market_watch
EXECUTE FUNCTION update_updated_at_column();

-- TRIGGER update_conversation_timestamp ON messages
EXECUTE FUNCTION update_conversation_last_message();

-- TRIGGER update_pipeline_items_updated_at ON pipeline_items
EXECUTE FUNCTION update_updated_at_column();

-- TRIGGER update_pipelines_updated_at ON pipelines
EXECUTE FUNCTION update_updated_at_column();

-- TRIGGER update_plans_updated_at ON plans
EXECUTE FUNCTION update_updated_at_column();

-- TRIGGER update_posts_updated_at ON posts
EXECUTE FUNCTION update_updated_at_column();

-- TRIGGER update_products_updated_at ON products
EXECUTE FUNCTION update_updated_at_column();

-- TRIGGER profiles_auto_username ON profiles
EXECUTE FUNCTION auto_generate_username();

-- TRIGGER profiles_auto_username ON profiles
EXECUTE FUNCTION auto_generate_username();

-- TRIGGER profiles_updated_at ON profiles
EXECUTE FUNCTION update_profiles_updated_at();

-- TRIGGER update_profiles_updated_at ON profiles
EXECUTE FUNCTION update_updated_at_column();

-- TRIGGER update_relationships_updated_at ON relationships
EXECUTE FUNCTION update_updated_at_column();

-- TRIGGER update_skill_deals_updated_at ON skill_deals
EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity_logs delete admin" ON public.activity_logs AS PERMISSIVE FOR DELETE TO {public} USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "activity_logs insert self" ON public.activity_logs AS PERMISSIVE FOR INSERT TO {public} WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "activity_logs select admin" ON public.activity_logs AS PERMISSIVE FOR SELECT TO {public} USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "activity_logs update admin" ON public.activity_logs AS PERMISSIVE FOR UPDATE TO {public} USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create own bills" ON public.bills AS PERMISSIVE FOR INSERT TO {public} WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can delete own bills" ON public.bills AS PERMISSIVE FOR DELETE TO {public} USING ((auth.uid() = user_id));
CREATE POLICY "Users can update own bills" ON public.bills AS PERMISSIVE FOR UPDATE TO {public} USING ((auth.uid() = user_id));
CREATE POLICY "Users can view own bills" ON public.bills AS PERMISSIVE FOR SELECT TO {public} USING ((auth.uid() = user_id));

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create bookings" ON public.bookings AS PERMISSIVE FOR INSERT TO {public} WITH CHECK (((auth.uid() = user_id) AND (NOT is_user_blocked())));
CREATE POLICY "Users can update own bookings" ON public.bookings AS PERMISSIVE FOR UPDATE TO {public} USING (((auth.uid() = user_id) AND (NOT is_user_blocked())));
CREATE POLICY "Users can view own bookings" ON public.bookings AS PERMISSIVE FOR SELECT TO {public} USING ((auth.uid() = user_id));

ALTER TABLE public.bundles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active bundles" ON public.bundles AS PERMISSIVE FOR SELECT TO {public} USING (((status = 'active'::text) OR (user_id = auth.uid())));
CREATE POLICY "Public read bundles" ON public.bundles AS PERMISSIVE FOR SELECT TO {public} USING (true);
CREATE POLICY "Users can create own bundles" ON public.bundles AS PERMISSIVE FOR INSERT TO {public} WITH CHECK (((auth.uid() IS NOT NULL) AND (NOT is_user_blocked())));
CREATE POLICY "Users can delete own bundles" ON public.bundles AS PERMISSIVE FOR DELETE TO {public} USING (((user_id = auth.uid()) AND (NOT is_user_blocked())));
CREATE POLICY "Users can update own bundles" ON public.bundles AS PERMISSIVE FOR UPDATE TO {public} USING (((user_id = auth.uid()) AND (NOT is_user_blocked())));

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create own events" ON public.calendar_events AS PERMISSIVE FOR INSERT TO {public} WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can delete own events" ON public.calendar_events AS PERMISSIVE FOR DELETE TO {public} USING ((auth.uid() = user_id));
CREATE POLICY "Users can update own events" ON public.calendar_events AS PERMISSIVE FOR UPDATE TO {public} USING ((auth.uid() = user_id));
CREATE POLICY "Users can view own events" ON public.calendar_events AS PERMISSIVE FOR SELECT TO {public} USING ((auth.uid() = user_id));

ALTER TABLE public.chauffeur_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create own chauffeur applications" ON public.chauffeur_applications AS PERMISSIVE FOR INSERT TO {public} WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can update own chauffeur applications" ON public.chauffeur_applications AS PERMISSIVE FOR UPDATE TO {public} USING ((auth.uid() = user_id));
CREATE POLICY "Users can view own chauffeur applications" ON public.chauffeur_applications AS PERMISSIVE FOR SELECT TO {public} USING ((auth.uid() = user_id));

ALTER TABLE public.connection_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conn_req delete participant" ON public.connection_requests AS PERMISSIVE FOR DELETE TO {public} USING ((((user_id = auth.uid()) OR (target_user_id = auth.uid())) AND (NOT is_user_blocked())));
CREATE POLICY "conn_req insert sender" ON public.connection_requests AS PERMISSIVE FOR INSERT TO {public} WITH CHECK (((user_id = auth.uid()) AND (NOT is_user_blocked())));
CREATE POLICY "conn_req select participant" ON public.connection_requests AS PERMISSIVE FOR SELECT TO {public} USING (((user_id = auth.uid()) OR (target_user_id = auth.uid())));
CREATE POLICY "conn_req update participant" ON public.connection_requests AS PERMISSIVE FOR UPDATE TO {public} USING ((((user_id = auth.uid()) OR (target_user_id = auth.uid())) AND (NOT is_user_blocked())));

ALTER TABLE public.contact_follow_ups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage contact follow-ups" ON public.contact_follow_ups AS PERMISSIVE FOR ALL TO {public} USING ((EXISTS ( SELECT 1
   FROM relationships
  WHERE ((relationships.id = contact_follow_ups.relationship_id) AND (relationships.user_id = auth.uid())))));

ALTER TABLE public.contact_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage contact interactions" ON public.contact_interactions AS PERMISSIVE FOR ALL TO {public} USING ((EXISTS ( SELECT 1
   FROM relationships
  WHERE ((relationships.id = contact_interactions.relationship_id) AND (relationships.user_id = auth.uid())))));

ALTER TABLE public.contact_meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage contact meetings" ON public.contact_meetings AS PERMISSIVE FOR ALL TO {public} USING ((EXISTS ( SELECT 1
   FROM relationships
  WHERE ((relationships.id = contact_meetings.relationship_id) AND (relationships.user_id = auth.uid())))));

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conversations delete participant" ON public.conversations AS PERMISSIVE FOR DELETE TO {public} USING ((((auth.uid() = participant_one) OR (auth.uid() = participant_two)) AND (NOT is_user_blocked())));
CREATE POLICY "conversations insert participant" ON public.conversations AS PERMISSIVE FOR INSERT TO {public} WITH CHECK ((((auth.uid() = participant_one) OR (auth.uid() = participant_two)) AND (NOT is_user_blocked())));
CREATE POLICY "conversations select participant" ON public.conversations AS PERMISSIVE FOR SELECT TO {public} USING (((auth.uid() = participant_one) OR (auth.uid() = participant_two)));
CREATE POLICY "conversations update participant" ON public.conversations AS PERMISSIVE FOR UPDATE TO {public} USING ((((auth.uid() = participant_one) OR (auth.uid() = participant_two)) AND (NOT is_user_blocked())));

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "follows delete self" ON public.follows AS PERMISSIVE FOR DELETE TO {public} USING (((follower_id = auth.uid()) AND (NOT is_user_blocked())));
CREATE POLICY "follows insert self" ON public.follows AS PERMISSIVE FOR INSERT TO {public} WITH CHECK (((follower_id = auth.uid()) AND (NOT is_user_blocked())));
CREATE POLICY "follows select public" ON public.follows AS PERMISSIVE FOR SELECT TO {public} USING (true);

ALTER TABLE public.hidden_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hidden_posts delete own" ON public.hidden_posts AS PERMISSIVE FOR DELETE TO {public} USING ((user_id = auth.uid()));
CREATE POLICY "hidden_posts insert own" ON public.hidden_posts AS PERMISSIVE FOR INSERT TO {public} WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "hidden_posts select own" ON public.hidden_posts AS PERMISSIVE FOR SELECT TO {public} USING ((user_id = auth.uid()));

ALTER TABLE public.income_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create own income sources" ON public.income_sources AS PERMISSIVE FOR INSERT TO {public} WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can delete own income sources" ON public.income_sources AS PERMISSIVE FOR DELETE TO {public} USING ((auth.uid() = user_id));
CREATE POLICY "Users can update own income sources" ON public.income_sources AS PERMISSIVE FOR UPDATE TO {public} USING ((auth.uid() = user_id));
CREATE POLICY "Users can view own income sources" ON public.income_sources AS PERMISSIVE FOR SELECT TO {public} USING ((auth.uid() = user_id));

ALTER TABLE public.job_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view job requests" ON public.job_requests AS PERMISSIVE FOR SELECT TO {public} USING (true);
CREATE POLICY "Users can create own job requests" ON public.job_requests AS PERMISSIVE FOR INSERT TO {public} WITH CHECK (((auth.uid() = user_id) AND (NOT is_user_blocked())));
CREATE POLICY "Users can delete own job requests" ON public.job_requests AS PERMISSIVE FOR DELETE TO {public} USING (((auth.uid() = user_id) AND (NOT is_user_blocked())));
CREATE POLICY "Users can update own job requests" ON public.job_requests AS PERMISSIVE FOR UPDATE TO {public} USING (((auth.uid() = user_id) AND (NOT is_user_blocked())));
CREATE POLICY "job_requests accept open" ON public.job_requests AS PERMISSIVE FOR UPDATE TO {public} USING (((status = 'open'::text) AND (accepted_by IS NULL) AND (NOT is_user_blocked()))) WITH CHECK (((accepted_by = auth.uid()) AND (NOT is_user_blocked())));
CREATE POLICY "job_requests update acceptor avatar" ON public.job_requests AS PERMISSIVE FOR UPDATE TO {public} USING (((accepted_by = auth.uid()) AND (NOT is_user_blocked()))) WITH CHECK (((accepted_by = auth.uid()) AND (NOT is_user_blocked())));

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow select listings" ON public.listings AS PERMISSIVE FOR SELECT TO {public} USING (true);
CREATE POLICY "Anyone can view listings" ON public.listings AS PERMISSIVE FOR SELECT TO {public} USING (true);
CREATE POLICY "Edit own listings" ON public.listings AS PERMISSIVE FOR UPDATE TO {public} USING (((user_id = auth.uid()) AND (NOT is_user_blocked())));
CREATE POLICY "Insert own listings" ON public.listings AS PERMISSIVE FOR INSERT TO {public} WITH CHECK (((user_id = auth.uid()) AND (NOT is_user_blocked())));
CREATE POLICY "User Own Listings" ON public.listings AS PERMISSIVE FOR SELECT TO {authenticated} USING ((auth.uid() = user_id));
CREATE POLICY "Users can create own listings" ON public.listings AS PERMISSIVE FOR INSERT TO {public} WITH CHECK (((auth.uid() = host_id) AND (NOT is_user_blocked())));
CREATE POLICY "Users can delete own listings" ON public.listings AS PERMISSIVE FOR DELETE TO {public} USING (((auth.uid() = host_id) AND (NOT is_user_blocked())));
CREATE POLICY "Users can update own listings" ON public.listings AS PERMISSIVE FOR UPDATE TO {public} USING (((auth.uid() = host_id) AND (NOT is_user_blocked())));
CREATE POLICY "Users insert own posts" ON public.listings AS PERMISSIVE FOR INSERT TO {authenticated} WITH CHECK (((auth.uid() = user_id) AND (NOT is_user_blocked())));
CREATE POLICY "Users see own" ON public.listings AS PERMISSIVE FOR SELECT TO {authenticated} USING ((auth.uid() = user_id));
CREATE POLICY "View all listings" ON public.listings AS PERMISSIVE FOR SELECT TO {public} USING (true);

ALTER TABLE public.live_streams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "live_streams delete self" ON public.live_streams AS PERMISSIVE FOR DELETE TO {public} USING ((streamer_id = auth.uid()));
CREATE POLICY "live_streams insert self" ON public.live_streams AS PERMISSIVE FOR INSERT TO {public} WITH CHECK ((streamer_id = auth.uid()));
CREATE POLICY "live_streams select public" ON public.live_streams AS PERMISSIVE FOR SELECT TO {public} USING (true);
CREATE POLICY "live_streams update self" ON public.live_streams AS PERMISSIVE FOR UPDATE TO {public} USING ((streamer_id = auth.uid()));

ALTER TABLE public.market_watch ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create own market watch" ON public.market_watch AS PERMISSIVE FOR INSERT TO {public} WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can delete own market watch" ON public.market_watch AS PERMISSIVE FOR DELETE TO {public} USING ((auth.uid() = user_id));
CREATE POLICY "Users can update own market watch" ON public.market_watch AS PERMISSIVE FOR UPDATE TO {public} USING ((auth.uid() = user_id));
CREATE POLICY "Users can view own market watch" ON public.market_watch AS PERMISSIVE FOR SELECT TO {public} USING ((auth.uid() = user_id));

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can send messages in own conversations" ON public.messages AS PERMISSIVE FOR INSERT TO {public} WITH CHECK (((auth.uid() = sender_id) AND (EXISTS ( SELECT 1
   FROM conversations
  WHERE ((conversations.id = messages.conversation_id) AND ((conversations.participant_one = auth.uid()) OR (conversations.participant_two = auth.uid()))))) AND (NOT is_user_blocked())));
CREATE POLICY "Users can update own messages" ON public.messages AS PERMISSIVE FOR UPDATE TO {public} USING (((EXISTS ( SELECT 1
   FROM conversations
  WHERE ((conversations.id = messages.conversation_id) AND ((conversations.participant_one = auth.uid()) OR (conversations.participant_two = auth.uid()))))) AND (NOT is_user_blocked())));
CREATE POLICY "Users can view messages in own conversations" ON public.messages AS PERMISSIVE FOR SELECT TO {public} USING ((EXISTS ( SELECT 1
   FROM conversations
  WHERE ((conversations.id = messages.conversation_id) AND ((conversations.participant_one = auth.uid()) OR (conversations.participant_two = auth.uid()))))));

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can delete own notifications" ON public.notifications AS PERMISSIVE FOR DELETE TO {public} USING (((auth.uid() = user_id) AND (NOT is_user_blocked())));
CREATE POLICY "Users can update own notifications" ON public.notifications AS PERMISSIVE FOR UPDATE TO {public} USING (((auth.uid() = user_id) AND (NOT is_user_blocked())));
CREATE POLICY "Users can view own notifications" ON public.notifications AS PERMISSIVE FOR SELECT TO {public} USING ((auth.uid() = user_id));
CREATE POLICY "notifications insert self actor" ON public.notifications AS PERMISSIVE FOR INSERT TO {public} WITH CHECK (((auth.uid() = actor_id) AND (NOT is_user_blocked())));

ALTER TABLE public.pipeline_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage pipeline items" ON public.pipeline_items AS PERMISSIVE FOR ALL TO {public} USING ((EXISTS ( SELECT 1
   FROM pipelines
  WHERE ((pipelines.id = pipeline_items.pipeline_id) AND (pipelines.user_id = auth.uid())))));

ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage pipeline stages" ON public.pipeline_stages AS PERMISSIVE FOR ALL TO {public} USING ((EXISTS ( SELECT 1
   FROM pipelines
  WHERE ((pipelines.id = pipeline_stages.pipeline_id) AND (pipelines.user_id = auth.uid())))));

ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create own pipelines" ON public.pipelines AS PERMISSIVE FOR INSERT TO {public} WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can delete own pipelines" ON public.pipelines AS PERMISSIVE FOR DELETE TO {public} USING ((auth.uid() = user_id));
CREATE POLICY "Users can update own pipelines" ON public.pipelines AS PERMISSIVE FOR UPDATE TO {public} USING ((auth.uid() = user_id));
CREATE POLICY "Users can view own pipelines" ON public.pipelines AS PERMISSIVE FOR SELECT TO {public} USING ((auth.uid() = user_id));

ALTER TABLE public.plan_sync ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Plan sync: owner insert" ON public.plan_sync AS PERMISSIVE FOR INSERT TO {authenticated} WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Plan sync: owner update" ON public.plan_sync AS PERMISSIVE FOR UPDATE TO {authenticated} USING ((auth.uid() = user_id));
CREATE POLICY "Plan sync: public read" ON public.plan_sync AS PERMISSIVE FOR SELECT TO {authenticated} USING (true);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create own plans" ON public.plans AS PERMISSIVE FOR INSERT TO {public} WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can delete own plans" ON public.plans AS PERMISSIVE FOR DELETE TO {public} USING ((auth.uid() = user_id));
CREATE POLICY "Users can update own plans" ON public.plans AS PERMISSIVE FOR UPDATE TO {public} USING ((auth.uid() = user_id));
CREATE POLICY "Users can view own plans" ON public.plans AS PERMISSIVE FOR SELECT TO {public} USING ((auth.uid() = user_id));

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view comments" ON public.post_comments AS PERMISSIVE FOR SELECT TO {public} USING (true);
CREATE POLICY "Users can delete own comments" ON public.post_comments AS PERMISSIVE FOR DELETE TO {public} USING (((auth.uid() = author_id) AND (NOT is_user_blocked())));
CREATE POLICY "post_comments insert self author" ON public.post_comments AS PERMISSIVE FOR INSERT TO {public} WITH CHECK (((auth.uid() = author_id) AND (NOT is_user_blocked())));

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view likes" ON public.post_likes AS PERMISSIVE FOR SELECT TO {public} USING (true);
CREATE POLICY "Users can like posts" ON public.post_likes AS PERMISSIVE FOR INSERT TO {public} WITH CHECK (((auth.uid() = user_id) AND (NOT is_user_blocked())));
CREATE POLICY "Users can unlike posts" ON public.post_likes AS PERMISSIVE FOR DELETE TO {public} USING (((auth.uid() = user_id) AND (NOT is_user_blocked())));

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view posts" ON public.posts AS PERMISSIVE FOR SELECT TO {public} USING (true);
CREATE POLICY "Users can create own posts" ON public.posts AS PERMISSIVE FOR INSERT TO {public} WITH CHECK (((auth.uid() = user_id) AND (NOT is_user_blocked())));
CREATE POLICY "Users can delete own posts" ON public.posts AS PERMISSIVE FOR DELETE TO {public} USING (((auth.uid() = user_id) AND (NOT is_user_blocked())));
CREATE POLICY "Users can update own posts" ON public.posts AS PERMISSIVE FOR UPDATE TO {public} USING (((auth.uid() = user_id) AND (NOT is_user_blocked())));

ALTER TABLE public.product_inquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create inquiries" ON public.product_inquiries AS PERMISSIVE FOR INSERT TO {public} WITH CHECK (true);
CREATE POLICY "Users can view product inquiries" ON public.product_inquiries AS PERMISSIVE FOR SELECT TO {public} USING (true);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active products" ON public.products AS PERMISSIVE FOR SELECT TO {public} USING (((status = 'active'::text) OR (auth.uid() = seller_id)));
CREATE POLICY "Users can create own products" ON public.products AS PERMISSIVE FOR INSERT TO {public} WITH CHECK (((auth.uid() = seller_id) AND (NOT is_user_blocked())));
CREATE POLICY "Users can update own products" ON public.products AS PERMISSIVE FOR UPDATE TO {public} USING (((auth.uid() = seller_id) AND (NOT is_user_blocked())));

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can insert profiles" ON public.profiles AS PERMISSIVE FOR INSERT TO {public} WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR (auth.uid() = id)));
CREATE POLICY "Admins can update all profiles" ON public.profiles AS PERMISSIVE FOR UPDATE TO {public} USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view all profiles" ON public.profiles AS PERMISSIVE FOR SELECT TO {public} USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Allow profile insert after signup" ON public.profiles AS PERMISSIVE FOR INSERT TO {authenticated} WITH CHECK (((auth.uid() = id) AND (NOT is_user_blocked())));
CREATE POLICY "Users can insert own profile" ON public.profiles AS PERMISSIVE FOR INSERT TO {public} WITH CHECK (((auth.uid() = id) AND (NOT is_user_blocked())));
CREATE POLICY "Users can insert their own profile" ON public.profiles AS PERMISSIVE FOR INSERT TO {public} WITH CHECK (((auth.uid() = id) AND (NOT is_user_blocked())));
CREATE POLICY "Users can update own profile" ON public.profiles AS PERMISSIVE FOR UPDATE TO {public} USING (((auth.uid() = id) AND (NOT is_user_blocked())));
CREATE POLICY "Users can update their own profile" ON public.profiles AS PERMISSIVE FOR UPDATE TO {public} USING (((auth.uid() = id) AND (NOT is_user_blocked()))) WITH CHECK (((auth.uid() = id) AND (NOT is_user_blocked())));
CREATE POLICY "Users can view all profiles" ON public.profiles AS PERMISSIVE FOR SELECT TO {public} USING (true);
CREATE POLICY "Users can view any profile" ON public.profiles AS PERMISSIVE FOR SELECT TO {public} USING (true);
CREATE POLICY "Users can view own profile" ON public.profiles AS PERMISSIVE FOR SELECT TO {public} USING ((auth.uid() = id));

ALTER TABLE public.relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create own relationships" ON public.relationships AS PERMISSIVE FOR INSERT TO {public} WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can delete own relationships" ON public.relationships AS PERMISSIVE FOR DELETE TO {public} USING ((auth.uid() = user_id));
CREATE POLICY "Users can update own relationships" ON public.relationships AS PERMISSIVE FOR UPDATE TO {public} USING ((auth.uid() = user_id));
CREATE POLICY "Users can view own relationships" ON public.relationships AS PERMISSIVE FOR SELECT TO {public} USING ((auth.uid() = user_id));

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports delete admin" ON public.reports AS PERMISSIVE FOR DELETE TO {public} USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "reports insert self" ON public.reports AS PERMISSIVE FOR INSERT TO {public} WITH CHECK ((reported_by = auth.uid()));
CREATE POLICY "reports select admin" ON public.reports AS PERMISSIVE FOR SELECT TO {public} USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "reports update admin" ON public.reports AS PERMISSIVE FOR UPDATE TO {public} USING (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.room_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Room history: auth insert" ON public.room_history AS PERMISSIVE FOR INSERT TO {authenticated} WITH CHECK ((auth.uid() IS NOT NULL));
CREATE POLICY "Room history: view for room members" ON public.room_history AS PERMISSIVE FOR SELECT TO {authenticated} USING (true);

ALTER TABLE public.room_storage_quota ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Quota: auth insert" ON public.room_storage_quota AS PERMISSIVE FOR INSERT TO {authenticated} WITH CHECK (true);
CREATE POLICY "Quota: auth read" ON public.room_storage_quota AS PERMISSIVE FOR SELECT TO {authenticated} USING (true);
CREATE POLICY "Quota: auth update" ON public.room_storage_quota AS PERMISSIVE FOR UPDATE TO {authenticated} USING (true);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read rooms" ON public.rooms AS PERMISSIVE FOR SELECT TO {public} USING (((visibility = 'public'::text) OR (visibility = 'invite_only'::text) OR (creator_id = auth.uid())));
CREATE POLICY "Auth users can create rooms" ON public.rooms AS PERMISSIVE FOR INSERT TO {public} WITH CHECK (((auth.uid() IS NOT NULL) AND (auth.uid() = creator_id)));
CREATE POLICY "Creator and hosts can update rooms" ON public.rooms AS PERMISSIVE FOR UPDATE TO {public} USING ((creator_id = auth.uid()));
CREATE POLICY "Creator can delete rooms" ON public.rooms AS PERMISSIVE FOR DELETE TO {public} USING ((creator_id = auth.uid()));

ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read service_requests" ON public.service_requests AS PERMISSIVE FOR SELECT TO {public} USING (true);

ALTER TABLE public.site_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon inserts on site_leads" ON public.site_leads AS PERMISSIVE FOR INSERT TO {anon} WITH CHECK (true);
CREATE POLICY "Service role full access on site_leads" ON public.site_leads AS PERMISSIVE FOR ALL TO {service_role} USING (true);

ALTER TABLE public.skill_deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active skill deals" ON public.skill_deals AS PERMISSIVE FOR SELECT TO {public} USING (((status = 'active'::text) OR (user_id = auth.uid())));
CREATE POLICY "Users can create own skill deals" ON public.skill_deals AS PERMISSIVE FOR INSERT TO {public} WITH CHECK (((user_id = auth.uid()) AND (NOT is_user_blocked())));
CREATE POLICY "Users can delete own skill deals" ON public.skill_deals AS PERMISSIVE FOR DELETE TO {public} USING (((user_id = auth.uid()) AND (NOT is_user_blocked())));
CREATE POLICY "Users can update own skill deals" ON public.skill_deals AS PERMISSIVE FOR UPDATE TO {public} USING (((user_id = auth.uid()) AND (NOT is_user_blocked())));

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view stories" ON public.stories AS PERMISSIVE FOR SELECT TO {public} USING (true);
CREATE POLICY "Users can create own stories" ON public.stories AS PERMISSIVE FOR INSERT TO {public} WITH CHECK (((auth.uid() = user_id) AND (NOT is_user_blocked())));
CREATE POLICY "Users can delete own stories" ON public.stories AS PERMISSIVE FOR DELETE TO {public} USING (((auth.uid() = user_id) AND (NOT is_user_blocked())));

ALTER TABLE public.swap_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "swap_matches delete participant" ON public.swap_matches AS PERMISSIVE FOR DELETE TO {public} USING (((user_id = auth.uid()) OR (matched_user_id = auth.uid())));
CREATE POLICY "swap_matches insert self" ON public.swap_matches AS PERMISSIVE FOR INSERT TO {public} WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "swap_matches select participant" ON public.swap_matches AS PERMISSIVE FOR SELECT TO {public} USING (((user_id = auth.uid()) OR (matched_user_id = auth.uid())));
CREATE POLICY "swap_matches update participant" ON public.swap_matches AS PERMISSIVE FOR UPDATE TO {public} USING (((user_id = auth.uid()) OR (matched_user_id = auth.uid())));

ALTER TABLE public.swap_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "swap_posts delete own" ON public.swap_posts AS PERMISSIVE FOR DELETE TO {public} USING ((user_id = auth.uid()));
CREATE POLICY "swap_posts insert own" ON public.swap_posts AS PERMISSIVE FOR INSERT TO {public} WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "swap_posts select public" ON public.swap_posts AS PERMISSIVE FOR SELECT TO {public} USING (true);
CREATE POLICY "swap_posts update own" ON public.swap_posts AS PERMISSIVE FOR UPDATE TO {public} USING ((user_id = auth.uid()));

ALTER TABLE public.user_grabs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can delete own grabs" ON public.user_grabs AS PERMISSIVE FOR DELETE TO {public} USING ((auth.uid() = user_id));
CREATE POLICY "Users can update own grabs" ON public.user_grabs AS PERMISSIVE FOR UPDATE TO {public} USING ((auth.uid() = user_id));
CREATE POLICY "Users can view own grabs" ON public.user_grabs AS PERMISSIVE FOR SELECT TO {public} USING ((auth.uid() = user_id));
CREATE POLICY "user_grabs insert own" ON public.user_grabs AS PERMISSIVE FOR INSERT TO {public} WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "user_grabs select provider" ON public.user_grabs AS PERMISSIVE FOR SELECT TO {public} USING ((provider_id = auth.uid()));
CREATE POLICY "user_grabs update provider" ON public.user_grabs AS PERMISSIVE FOR UPDATE TO {public} USING ((provider_id = auth.uid()));

ALTER TABLE public.user_reviews ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_saves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can delete own saves" ON public.user_saves AS PERMISSIVE FOR DELETE TO {public} USING ((auth.uid() = user_id));
CREATE POLICY "Users can update own saves" ON public.user_saves AS PERMISSIVE FOR UPDATE TO {public} USING ((auth.uid() = user_id));
CREATE POLICY "Users can view own saves" ON public.user_saves AS PERMISSIVE FOR SELECT TO {public} USING ((auth.uid() = user_id));
CREATE POLICY "user_saves insert own" ON public.user_saves AS PERMISSIVE FOR INSERT TO {public} WITH CHECK ((user_id = auth.uid()));

ALTER TABLE public.virtual_room_environments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "VRE insert" ON public.virtual_room_environments AS PERMISSIVE FOR INSERT TO {authenticated} WITH CHECK (true);
CREATE POLICY "VRE read" ON public.virtual_room_environments AS PERMISSIVE FOR SELECT TO {authenticated} USING (true);
CREATE POLICY "VRE update" ON public.virtual_room_environments AS PERMISSIVE FOR UPDATE TO {authenticated} USING (true) WITH CHECK (true);

ALTER TABLE public.virtual_room_objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "VRO delete" ON public.virtual_room_objects AS PERMISSIVE FOR DELETE TO {authenticated} USING (true);
CREATE POLICY "VRO insert" ON public.virtual_room_objects AS PERMISSIVE FOR INSERT TO {authenticated} WITH CHECK (true);
CREATE POLICY "VRO read" ON public.virtual_room_objects AS PERMISSIVE FOR SELECT TO {authenticated} USING (true);
CREATE POLICY "VRO update" ON public.virtual_room_objects AS PERMISSIVE FOR UPDATE TO {authenticated} USING (true) WITH CHECK (true);

