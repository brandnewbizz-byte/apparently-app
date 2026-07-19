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
  timestamp: string;
  likes: number;
  comments: number;
  shares: number;
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

export const mockUsers: User[] = [
  {
    id: "1",
    name: "Mom",
    username: "mom",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop",
    isVerified: false,
    followersCount: 0,
    relationshipCategory: 'family',
  },
  {
    id: "2",
    name: "George Whitman",
    username: "georgewhitman",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop",
    isVerified: true,
    followersCount: 2500,
    relationshipCategory: 'business',
  },
  {
    id: "3",
    name: "Jessica Taylor",
    username: "jessicataylor",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop",
    isVerified: false,
    followersCount: 890,
    relationshipCategory: 'friend',
  },
  {
    id: "4",
    name: "Robert Chen",
    username: "robertchen",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop",
    isVerified: true,
    followersCount: 15000,
    relationshipCategory: 'mentor',
  },
  {
    id: "5",
    name: "Sarah Miller",
    username: "sarahmiller",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop",
    isVerified: false,
    followersCount: 1200,
    isLive: true,
    relationshipCategory: 'colleague',
  },
  {
    id: "6",
    name: "Marcus Johnson",
    username: "marcusj",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop",
    isVerified: false,
    followersCount: 3400,
    relationshipCategory: 'business',
  },
];

export const mockPosts: Post[] = [
  {
    id: "1",
    user: mockUsers[0],
    content: "Thanksgiving prep in full swing! Can't wait for the whole family to be together. Making grandma's secret recipe this year 🍂🦃",
    imageUrl: "https://images.unsplash.com/photo-1574672280600-4accfa5b6f98?w=600&h=400&fit=crop",
    timestamp: "15m ago",
    likes: 24,
    comments: 8,
    shares: 2,
    relevance: {
      affectsDirectly: true,
      affectsNetwork: false,
      directReason: "Family event you may want to attend",
      relevanceScore: 95,
      topicTrends: ['family', 'holidays'],
    },
  },
  {
    id: "2",
    user: mockUsers[1],
    content: "Just closed an incredible deal today! The real estate market is moving fast. Excited for what's coming in Q1 2026. 📈💼",
    timestamp: "45m ago",
    likes: 156,
    comments: 23,
    shares: 12,
    relevance: {
      affectsDirectly: true,
      affectsNetwork: true,
      directReason: "Business contact with pending investment meeting",
      networkReason: "2 other business contacts discussing real estate",
      relevanceScore: 92,
      topicTrends: ['real-estate', 'investment', 'Q1-2026'],
      mentionedContacts: ['Marcus Johnson'],
    },
  },
  {
    id: "3",
    user: mockUsers[2],
    content: "Coffee shop vibes and catching up on my reading list. This book is a game changer! Anyone else reading 'Atomic Habits'? 📚☕",
    imageUrl: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600&h=400&fit=crop",
    timestamp: "1h ago",
    likes: 89,
    comments: 34,
    shares: 5,
    relevance: {
      affectsDirectly: false,
      affectsNetwork: true,
      networkReason: "3 friends discussing productivity & self-improvement",
      relevanceScore: 65,
      topicTrends: ['productivity', 'books', 'self-improvement'],
    },
  },
  {
    id: "4",
    user: mockUsers[3],
    content: "Mentorship Monday! Had an amazing session with my mentees today. Remember: success isn't just about what you achieve, it's about who you help along the way. 🌟",
    timestamp: "2h ago",
    likes: 342,
    comments: 67,
    shares: 89,
    relevance: {
      affectsDirectly: true,
      affectsNetwork: false,
      directReason: "Your mentor - quarterly catchup overdue",
      relevanceScore: 88,
      topicTrends: ['mentorship', 'career', 'leadership'],
    },
  },
  {
    id: "5",
    user: mockUsers[4],
    content: "Sprint review done! Project Alpha is on track for the Q4 release. Proud of the team's hard work! 🚀",
    imageUrl: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&h=400&fit=crop",
    timestamp: "3h ago",
    likes: 78,
    comments: 19,
    shares: 4,
    relevance: {
      affectsDirectly: true,
      affectsNetwork: false,
      directReason: "Colleague on your active project",
      relevanceScore: 90,
      topicTrends: ['work', 'project-alpha', 'Q4'],
    },
  },
  {
    id: "6",
    user: mockUsers[5],
    content: "Just wrapped up a creative brainstorming session. The ideas are flowing! Who's ready to disrupt the marketing world with us? 🎨✨",
    timestamp: "4h ago",
    likes: 203,
    comments: 45,
    shares: 28,
    relevance: {
      affectsDirectly: true,
      affectsNetwork: true,
      directReason: "Partnership proposal due soon",
      networkReason: "Marketing topic trending among 4 business contacts",
      relevanceScore: 85,
      topicTrends: ['marketing', 'creative', 'business'],
    },
  },
  {
    id: "7",
    user: mockUsers[2],
    content: "Birthday countdown begins! 🎂 Only 3 weeks left. Already planning something special with the squad!",
    timestamp: "5h ago",
    likes: 156,
    comments: 52,
    shares: 3,
    relevance: {
      affectsDirectly: true,
      affectsNetwork: false,
      directReason: "Friend's birthday - reminder set for surprise planning",
      relevanceScore: 78,
      topicTrends: ['birthday', 'celebration'],
    },
  },
  {
    id: "8",
    user: mockUsers[0],
    content: "Nothing beats a Sunday morning family breakfast. Grateful for these moments 💕",
    imageUrl: "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?w=600&h=400&fit=crop",
    timestamp: "6h ago",
    likes: 45,
    comments: 12,
    shares: 1,
    relevance: {
      affectsDirectly: true,
      affectsNetwork: false,
      directReason: "Family member sharing life moments",
      relevanceScore: 82,
      topicTrends: ['family', 'gratitude'],
    },
  },
];

export const mockLiveStreams: LiveStream[] = [
  {
    id: "1",
    user: mockUsers[0],
    title: "Breaking down today's market movements LIVE",
    viewerCount: 12400,
    thumbnailUrl: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&h=300&fit=crop",
    category: "Finance",
    isLive: true,
  },
  {
    id: "2",
    user: mockUsers[2],
    title: "Community Town Hall: Local Issues Discussion",
    viewerCount: 3200,
    thumbnailUrl: "https://images.unsplash.com/photo-1577962917302-cd874c4e31d2?w=400&h=300&fit=crop",
    category: "Community",
    isLive: true,
  },
  {
    id: "3",
    user: mockUsers[1],
    title: "Tech Talk: AI in 2025 - What to Expect",
    viewerCount: 8900,
    thumbnailUrl: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=400&h=300&fit=crop",
    category: "Technology",
    isLive: true,
  },
  {
    id: "4",
    user: mockUsers[3],
    title: "Weekly Tech News Roundup",
    viewerCount: 0,
    thumbnailUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=300&fit=crop",
    category: "Technology",
    isLive: false,
    scheduledFor: "Tomorrow at 6 PM",
  },
];

export const mockInsights: Insight[] = [
  {
    id: "1",
    title: "Remote Work Policy Change",
    description: "A new policy affecting your industry was announced. 3 connections are discussing it.",
    category: "Career",
    relevanceScore: 95,
    timestamp: "Just now",
    icon: "briefcase",
  },
  {
    id: "2",
    title: "Local Event Near You",
    description: "A tech meetup is happening 2 miles away. 5 people you follow are attending.",
    category: "Networking",
    relevanceScore: 88,
    timestamp: "10m ago",
    icon: "map-pin",
  },
  {
    id: "3",
    title: "Trending in Your Circle",
    description: "AI regulation is being discussed by 12 of your connections right now.",
    category: "Trending",
    relevanceScore: 82,
    timestamp: "30m ago",
    icon: "trending-up",
  },
  {
    id: "4",
    title: "Opportunity Match",
    description: "A freelance opportunity matches your skills and goals perfectly.",
    category: "Opportunity",
    relevanceScore: 90,
    timestamp: "1h ago",
    icon: "sparkles",
  },
];

export const mockStories: Story[] = [
  {
    id: "s1",
    user: mockUsers[0],
    imageUrl: "https://images.unsplash.com/photo-1574672280600-4accfa5b6f98?w=400&h=600&fit=crop",
    timestamp: "2h ago",
    viewed: false,
  },
  {
    id: "s2",
    user: mockUsers[1],
    imageUrl: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&h=600&fit=crop",
    timestamp: "4h ago",
    viewed: false,
  },
  {
    id: "s3",
    user: mockUsers[2],
    imageUrl: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&h=600&fit=crop",
    timestamp: "5h ago",
    viewed: true,
  },
  {
    id: "s4",
    user: mockUsers[3],
    imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop",
    timestamp: "6h ago",
    viewed: false,
  },
  {
    id: "s5",
    user: mockUsers[4],
    imageUrl: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&h=600&fit=crop",
    timestamp: "8h ago",
    viewed: false,
  },
  {
    id: "s6",
    user: mockUsers[5],
    imageUrl: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=400&h=600&fit=crop",
    timestamp: "10h ago",
    viewed: true,
  },
];

export const interests: Interest[] = [
  { id: "1", name: "Technology", icon: "cpu" },
  { id: "2", name: "Finance", icon: "trending-up" },
  { id: "3", name: "Health & Wellness", icon: "heart" },
  { id: "4", name: "Entrepreneurship", icon: "rocket" },
  { id: "5", name: "Politics", icon: "landmark" },
  { id: "6", name: "Science", icon: "flask-conical" },
  { id: "7", name: "Entertainment", icon: "clapperboard" },
  { id: "8", name: "Sports", icon: "trophy" },
  { id: "9", name: "Travel", icon: "plane" },
  { id: "10", name: "Food & Dining", icon: "utensils" },
  { id: "11", name: "Art & Design", icon: "palette" },
  { id: "12", name: "Music", icon: "music" },
  { id: "13", name: "Education", icon: "graduation-cap" },
  { id: "14", name: "Real Estate", icon: "home" },
  { id: "15", name: "Environment", icon: "leaf" },
  { id: "16", name: "Gaming", icon: "gamepad-2" },
];

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

export const mockMarketplaceProfiles: MarketplaceProfile[] = [
  {
    id: 'm1',
    name: 'Alex Rivera',
    username: 'alexrivera',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop',
    location: 'New York, NY',
    distance: 0.8,
    skills: ['UI/UX Design', 'Branding', 'Product Design'],
    bio: 'Creative designer with 8+ years helping brands tell their story. Love collaborating on innovative projects.',
    lookingFor: 'collaboration',
    category: 'Design',
    verified: true,
    rating: 4.9,
    reviewCount: 127,
    availability: 'available',
    hourlyRate: '$80-120/hr',
    rate: { type: 'hourly', amount: '$80-120' },
    portfolio: [
      'https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=300&h=300&fit=crop',
      'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=300&h=300&fit=crop',
    ],
  },
  {
    id: 'm2',
    name: 'Maya Patel',
    username: 'mayapatel',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop',
    location: 'New York, NY',
    distance: 1.2,
    skills: ['Full-Stack Development', 'React Native', 'Node.js'],
    bio: 'Building scalable mobile and web applications. Open to new opportunities and mentorship.',
    lookingFor: 'opportunities',
    category: 'Technology',
    verified: true,
    rating: 5.0,
    reviewCount: 89,
    availability: 'available',
    hourlyRate: '$100-150/hr',
    rate: { type: 'hourly', amount: '$100-150' },
  },
  {
    id: 'm3',
    name: 'James Chen',
    username: 'jameschen',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop',
    location: 'Brooklyn, NY',
    distance: 2.1,
    skills: ['Marketing Strategy', 'Social Media', 'Content Creation'],
    bio: 'Marketing consultant helping businesses grow their online presence. Let\'s connect!',
    lookingFor: 'networking',
    category: 'Marketing',
    verified: false,
    rating: 4.7,
    reviewCount: 54,
    availability: 'available',
  },
  {
    id: 'm4',
    name: 'Sophia Martinez',
    username: 'sophiamartinez',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop',
    location: 'Manhattan, NY',
    distance: 3.5,
    skills: ['Business Consulting', 'Strategy', 'Operations'],
    bio: 'Experienced business consultant. Passionate about helping startups scale efficiently.',
    lookingFor: 'hiring',
    category: 'Business',
    verified: true,
    rating: 4.8,
    reviewCount: 201,
    availability: 'busy',
    hourlyRate: '$150-200/hr',
    rate: { type: 'session', amount: '$300-500', customLabel: 'Consulting Session' },
  },
  {
    id: 'm5',
    name: 'David Kim',
    username: 'davidkim',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop',
    location: 'Queens, NY',
    distance: 4.2,
    skills: ['Photography', 'Videography', 'Video Editing'],
    bio: 'Visual storyteller capturing moments that matter. Available for events and brand collaborations.',
    lookingFor: 'collaboration',
    category: 'Creative',
    verified: false,
    rating: 4.9,
    reviewCount: 76,
    availability: 'available',
    hourlyRate: '$60-90/hr',
    rate: { type: 'hourly', amount: '$60-90' },
    portfolio: [
      'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=300&h=300&fit=crop',
      'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=300&h=300&fit=crop',
    ],
  },
  {
    id: 'm6',
    name: 'Emily Johnson',
    username: 'emilyjohnson',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop',
    location: 'New York, NY',
    distance: 1.8,
    skills: ['Financial Planning', 'Investment Strategy', 'Tax Consulting'],
    bio: 'CFP helping individuals and businesses achieve financial goals. Free initial consultation.',
    lookingFor: 'networking',
    category: 'Finance',
    verified: true,
    rating: 5.0,
    reviewCount: 143,
    availability: 'available',
    hourlyRate: '$120-180/hr',
    rate: { type: 'hourly', amount: '$120-180' },
  },
  {
    id: 'm7',
    name: 'Lucas Brown',
    username: 'lucasbrown',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop',
    location: 'Brooklyn, NY',
    distance: 2.8,
    skills: ['Personal Training', 'Nutrition', 'Wellness Coaching'],
    bio: 'Certified trainer helping people transform their lives through fitness and wellness.',
    lookingFor: 'opportunities',
    category: 'Health & Wellness',
    verified: false,
    rating: 4.8,
    reviewCount: 92,
    availability: 'available',
    hourlyRate: '$50-80/hr',
    rate: { type: 'session', amount: '$75', customLabel: 'Training Session' },
  },
  {
    id: 'm8',
    name: 'Olivia Davis',
    username: 'oliviadavis',
    avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=150&h=150&fit=crop',
    location: 'Manhattan, NY',
    distance: 3.2,
    skills: ['Legal Consulting', 'Contract Review', 'Compliance'],
    bio: 'Corporate lawyer specializing in startup and tech law. Here to help you navigate legal challenges.',
    lookingFor: 'networking',
    category: 'Legal',
    verified: true,
    rating: 4.9,
    reviewCount: 167,
    availability: 'busy',
    hourlyRate: '$200-300/hr',
    rate: { type: 'hourly', amount: '$200-300' },
  },
];

export const goals: Interest[] = [
  { id: "1", name: "Grow my network", icon: "users" },
  { id: "2", name: "Stay informed", icon: "newspaper" },
  { id: "3", name: "Find opportunities", icon: "search" },
  { id: "4", name: "Build community", icon: "heart-handshake" },
  { id: "5", name: "Learn new skills", icon: "brain" },
  { id: "6", name: "Create content", icon: "video" },
  { id: "7", name: "Earn income", icon: "wallet" },
  { id: "8", name: "Make an impact", icon: "zap" },
];
