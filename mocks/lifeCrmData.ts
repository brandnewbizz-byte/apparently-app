export type EventPaymentStatus = 'expected' | 'received' | 'overdue';

export interface CalendarEvent {
  id: string;
  title: string;
  type: 'meeting' | 'personal' | 'business' | 'reminder' | 'deadline';
  date: string;
  time: string;
  duration: number;
  location?: string;
  attendees?: string[];
  priority: 'low' | 'medium' | 'high';
  isCompleted: boolean;
  incomeAmount?: number;
  incomeSource?: string;
  paymentStatus?: EventPaymentStatus;
}

export interface Bill {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  category: 'utilities' | 'subscription' | 'loan' | 'insurance' | 'rent' | 'other';
  isPaid: boolean;
  isRecurring: boolean;
  frequency?: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
}

export interface ContactInteraction {
  id: string;
  type: 'call' | 'meeting' | 'message' | 'email' | 'in_person';
  date: string;
  time?: string;
  duration?: number;
  notes?: string;
  outcome?: string;
}

export type MeetingIncomeStatus = 'planned' | 'closed_paid' | 'closed_unpaid' | 'cancelled';
export type MeetingIncomeType = 'consulting' | 'service' | 'product' | 'commission' | 'retainer' | 'project' | 'other';

export interface ContactMeeting {
  id: string;
  title: string;
  date: string;
  time: string;
  location?: string;
  agenda?: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';
  linkedContactId: string;
  reminderSent?: boolean;
  expectedIncome?: number;
  incomeType?: MeetingIncomeType;
  incomeStatus?: MeetingIncomeStatus;
}

export interface ContactFollowUp {
  id: string;
  title: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'completed' | 'overdue';
  linkedContactId: string;
  notes?: string;
}

export interface Relationship {
  id: string;
  name: string;
  avatar: string;
  category: 'family' | 'friend' | 'business' | 'mentor' | 'colleague' | 'associate' | 'investor' | 'prospect';
  lastInteraction: string;
  lastInteractionDate: string;
  interactionScore: number;
  notes?: string;
  upcomingBirthday?: string;
  tags: string[];
  phone?: string;
  email?: string;
  company?: string;
  role?: string;
  interactions: ContactInteraction[];
  meetings: ContactMeeting[];
  followUps: ContactFollowUp[];
  needsAttention: boolean;
  attentionReason?: string;
}

export interface IncomeSource {
  id: string;
  name: string;
  type: 'business' | 'freelance' | 'investment' | 'passive' | 'salary';
  estimatedAmount: number;
  frequency: 'daily' | 'weekly' | 'monthly';
  confidence: number;
  linkedConnections?: string[];
}

export const mockCalendarEvents: CalendarEvent[] = [
  {
    id: '1',
    title: 'Team Standup',
    type: 'business',
    date: '2025-11-29',
    time: '09:00',
    duration: 30,
    location: 'Zoom',
    attendees: ['Sarah Chen', 'Marcus Johnson'],
    priority: 'medium',
    isCompleted: false,
  },
  {
    id: '2',
    title: 'Client Presentation',
    type: 'business',
    date: '2025-11-29',
    time: '14:00',
    duration: 60,
    location: 'Conference Room A',
    priority: 'high',
    isCompleted: false,
    incomeAmount: 2500,
    incomeSource: 'Project milestone delivery',
    paymentStatus: 'expected',
  },
  {
    id: '3',
    title: 'Gym Session',
    type: 'personal',
    date: '2025-11-29',
    time: '18:00',
    duration: 60,
    location: 'FitLife Gym',
    priority: 'medium',
    isCompleted: false,
  },
  {
    id: '4',
    title: 'Dinner with Family',
    type: 'personal',
    date: '2025-11-30',
    time: '19:00',
    duration: 120,
    priority: 'high',
    isCompleted: false,
  },
  {
    id: '5',
    title: 'Q4 Report Deadline',
    type: 'deadline',
    date: '2025-12-01',
    time: '17:00',
    duration: 0,
    priority: 'high',
    isCompleted: false,
  },
  {
    id: '6',
    title: 'Coffee with Mentor',
    type: 'meeting',
    date: '2025-12-02',
    time: '10:00',
    duration: 45,
    location: 'Blue Bottle Coffee',
    priority: 'medium',
    isCompleted: false,
  },
  {
    id: '7',
    title: 'Consulting Session',
    type: 'business',
    date: '2025-12-02',
    time: '15:00',
    duration: 90,
    location: 'Virtual',
    priority: 'high',
    isCompleted: false,
    incomeAmount: 450,
    incomeSource: 'Hourly consulting rate',
    paymentStatus: 'expected',
  },
  {
    id: '8',
    title: 'Workshop Facilitation',
    type: 'business',
    date: '2025-12-05',
    time: '09:00',
    duration: 240,
    location: 'Client Office',
    priority: 'high',
    isCompleted: false,
    incomeAmount: 1200,
    incomeSource: 'Workshop fee',
    paymentStatus: 'expected',
  },
];

export const mockBills: Bill[] = [
  {
    id: '1',
    name: 'Rent',
    amount: 2500,
    dueDate: '2025-12-01',
    category: 'rent',
    isPaid: false,
    isRecurring: true,
    frequency: 'monthly',
  },
  {
    id: '2',
    name: 'Electric Bill',
    amount: 145,
    dueDate: '2025-12-05',
    category: 'utilities',
    isPaid: false,
    isRecurring: true,
    frequency: 'monthly',
  },
  {
    id: '3',
    name: 'Netflix',
    amount: 22.99,
    dueDate: '2025-12-10',
    category: 'subscription',
    isPaid: false,
    isRecurring: true,
    frequency: 'monthly',
  },
  {
    id: '4',
    name: 'Car Insurance',
    amount: 180,
    dueDate: '2025-12-15',
    category: 'insurance',
    isPaid: false,
    isRecurring: true,
    frequency: 'monthly',
  },
  {
    id: '5',
    name: 'Gym Membership',
    amount: 49.99,
    dueDate: '2025-12-01',
    category: 'subscription',
    isPaid: true,
    isRecurring: true,
    frequency: 'monthly',
  },
];

export const mockRelationships: Relationship[] = [
  {
    id: '1',
    name: 'Mom',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop',
    category: 'family',
    lastInteraction: '2 days ago',
    lastInteractionDate: '2025-11-27',
    interactionScore: 85,
    upcomingBirthday: '2025-03-15',
    tags: ['family', 'priority'],
    phone: '+1 (555) 234-5678',
    interactions: [
      { id: 'i1', type: 'call', date: '2025-11-27', duration: 25, notes: 'Caught up about Thanksgiving plans' },
      { id: 'i2', type: 'in_person', date: '2025-11-24', duration: 180, notes: 'Sunday dinner' },
    ],
    meetings: [],
    followUps: [],
    needsAttention: false,
  },
  {
    id: '2',
    name: 'George Whitman',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop',
    category: 'business',
    lastInteraction: '5 days ago',
    lastInteractionDate: '2025-11-24',
    interactionScore: 58,
    notes: 'Key investor contact for real estate deals',
    tags: ['investor', 'real-estate', 'high-value'],
    phone: '+1 (555) 789-0123',
    email: 'george.whitman@invest.co',
    company: 'Whitman Capital Partners',
    role: 'Managing Partner',
    interactions: [
      { id: 'i3', type: 'meeting', date: '2025-11-24', duration: 60, notes: 'Discussed preliminary terms for the building investment', outcome: 'Positive - wants more details' },
      { id: 'i4', type: 'email', date: '2025-11-20', notes: 'Sent investment proposal deck' },
    ],
    meetings: [
      {
        id: 'm1',
        title: 'Investment Approval Discussion',
        date: '2025-12-04',
        time: '14:00',
        location: 'Whitman Capital Office',
        agenda: 'Review $50,000 investment for new real estate building. Present final numbers and get approval.',
        status: 'scheduled',
        linkedContactId: '2',
        expectedIncome: 5000,
        incomeType: 'commission',
        incomeStatus: 'planned',
      },
    ],
    followUps: [
      {
        id: 'f1',
        title: 'Send updated financial projections to George',
        dueDate: '2025-12-02',
        priority: 'high',
        status: 'pending',
        linkedContactId: '2',
        notes: 'Include Q4 numbers and 5-year outlook',
      },
    ],
    needsAttention: true,
    attentionReason: 'Important meeting in 5 days - follow up needed',
  },
  {
    id: '3',
    name: 'Jessica Taylor',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop',
    category: 'friend',
    lastInteraction: '3 days ago',
    lastInteractionDate: '2025-11-26',
    interactionScore: 78,
    upcomingBirthday: '2025-12-20',
    tags: ['college', 'close'],
    phone: '+1 (555) 345-6789',
    email: 'jessica.t@email.com',
    interactions: [
      { id: 'i5', type: 'message', date: '2025-11-26', notes: 'Texted about holiday plans' },
      { id: 'i6', type: 'call', date: '2025-11-20', duration: 45, notes: 'Long catch up call' },
    ],
    meetings: [],
    followUps: [
      {
        id: 'f2',
        title: 'Plan birthday surprise for Jessica',
        dueDate: '2025-12-15',
        priority: 'medium',
        status: 'pending',
        linkedContactId: '3',
      },
    ],
    needsAttention: false,
  },
  {
    id: '4',
    name: 'Robert Chen',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop',
    category: 'mentor',
    lastInteraction: '2 weeks ago',
    lastInteractionDate: '2025-11-15',
    interactionScore: 45,
    notes: 'Schedule quarterly catchup',
    tags: ['career', 'advisor'],
    phone: '+1 (555) 456-7890',
    email: 'rchen@venture.io',
    company: 'Chen Ventures',
    role: 'Founder & CEO',
    interactions: [
      { id: 'i7', type: 'meeting', date: '2025-11-15', duration: 90, notes: 'Quarterly career review', outcome: 'Great advice on scaling business' },
    ],
    meetings: [],
    followUps: [
      {
        id: 'f3',
        title: 'Schedule next quarterly catchup with Robert',
        dueDate: '2025-12-01',
        priority: 'medium',
        status: 'overdue',
        linkedContactId: '4',
      },
    ],
    needsAttention: true,
    attentionReason: 'Haven\'t connected in 2 weeks - overdue for catchup',
  },
  {
    id: '5',
    name: 'Sarah Miller',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop',
    category: 'colleague',
    lastInteraction: 'Yesterday',
    lastInteractionDate: '2025-11-28',
    interactionScore: 92,
    tags: ['work', 'project-alpha'],
    email: 'sarah.miller@company.com',
    company: 'Tech Solutions Inc',
    role: 'Product Manager',
    interactions: [
      { id: 'i8', type: 'meeting', date: '2025-11-28', duration: 30, notes: 'Sprint planning' },
      { id: 'i9', type: 'message', date: '2025-11-27', notes: 'Slack chat about feature release' },
    ],
    meetings: [
      {
        id: 'm2',
        title: 'Project Alpha Review',
        date: '2025-12-02',
        time: '10:00',
        location: 'Conference Room B',
        agenda: 'Review Q4 deliverables and plan Q1 roadmap',
        status: 'scheduled',
        linkedContactId: '5',
        expectedIncome: 750,
        incomeType: 'project',
        incomeStatus: 'planned',
      },
    ],
    followUps: [],
    needsAttention: false,
  },
  {
    id: '6',
    name: 'Marcus Johnson',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop',
    category: 'business',
    lastInteraction: '1 week ago',
    lastInteractionDate: '2025-11-22',
    interactionScore: 55,
    notes: 'Potential partnership opportunity',
    tags: ['partnership', 'marketing'],
    phone: '+1 (555) 567-8901',
    email: 'marcus@brandagency.com',
    company: 'Brand Agency Co',
    role: 'Creative Director',
    interactions: [
      { id: 'i10', type: 'call', date: '2025-11-22', duration: 20, notes: 'Initial partnership discussion' },
    ],
    meetings: [],
    followUps: [
      {
        id: 'f4',
        title: 'Send partnership proposal to Marcus',
        dueDate: '2025-12-03',
        priority: 'high',
        status: 'pending',
        linkedContactId: '6',
        notes: 'Include case studies and pricing',
      },
    ],
    needsAttention: true,
    attentionReason: 'Partnership proposal due soon',
  },
];

export const mockIncomeSources: IncomeSource[] = [
  {
    id: '1',
    name: 'Client Retainer - TechCorp',
    type: 'freelance',
    estimatedAmount: 850,
    frequency: 'daily',
    confidence: 95,
    linkedConnections: ['David Kim'],
  },
  {
    id: '2',
    name: 'Investment Returns',
    type: 'investment',
    estimatedAmount: 125,
    frequency: 'daily',
    confidence: 72,
  },
  {
    id: '3',
    name: 'Consulting Call',
    type: 'business',
    estimatedAmount: 350,
    frequency: 'daily',
    confidence: 88,
    linkedConnections: ['Robert Chen'],
  },
  {
    id: '4',
    name: 'Affiliate Revenue',
    type: 'passive',
    estimatedAmount: 45,
    frequency: 'daily',
    confidence: 65,
  },
];

export interface WellnessSuggestion {
  id: string;
  title: string;
  description: string;
  type: 'workload' | 'relationship' | 'financial' | 'market' | 'event';
  priority: 'low' | 'medium' | 'high';
  linkType?: 'bill' | 'event' | 'contact';
  linkedId?: string;
  isDismissed?: boolean;
}

export const wellnessSuggestions: WellnessSuggestion[] = [
  {
    id: '1',
    title: 'You\'ve been busy!',
    description: 'Your schedule shows 40+ hours this week. Consider blocking time for yourself.',
    type: 'workload',
    priority: 'high',
  },
  {
    id: '2',
    title: 'Family time reminder',
    description: 'You haven\'t connected with Mom in 2 days. How about a quick call?',
    type: 'relationship',
    priority: 'medium',
    linkType: 'contact',
    linkedId: '1',
  },
  {
    id: '3',
    title: 'Rent is due soon',
    description: 'Your rent ($2,500) is due on Dec 1. Make sure your account is funded.',
    type: 'financial',
    priority: 'high',
    linkType: 'bill',
    linkedId: '1',
  },
  {
    id: '4',
    title: 'Market Alert',
    description: 'Bitcoin dropped 1.29% today. Your portfolio may be affected.',
    type: 'market',
    priority: 'low',
  },
  {
    id: '5',
    title: 'Q4 Report Deadline approaching',
    description: 'Your Q4 Report is due today at 5:00 PM. Don\'t miss the deadline!',
    type: 'event',
    priority: 'high',
    linkType: 'event',
    linkedId: '5',
  },
];
