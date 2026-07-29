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

export const mockCalendarEvents: CalendarEvent[] = [];

export const mockBills: Bill[] = [];

export const mockRelationships: Relationship[] = [];

export const mockIncomeSources: IncomeSource[] = [];

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

export const wellnessSuggestions: WellnessSuggestion[] = [];
