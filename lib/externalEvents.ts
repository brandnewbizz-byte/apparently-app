// lib/externalEvents.ts — "Happening This Week" event data
// Administrator-controlled advertisement/promoted event slots
// Users can pay for these placements

export interface ExternalEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  venue: string;
  category: string;
  image: string;
  price: string;
  is_free: boolean;
  description?: string;
  organizer?: string;
  ticketUrl?: string;
  tags?: string[];
}

// All hardcoded events removed — app now pulls from Supabase live backend only
export const EXTERNAL_EVENTS: ExternalEvent[] = [];
