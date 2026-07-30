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

export const EXTERNAL_EVENTS: ExternalEvent[] = [
  {
    id: 'e1',
    title: 'Summer Jazz Festival',
    date: 'Sat Jul 26',
    time: '6:00 PM – 11:00 PM',
    venue: 'Central Park',
    category: 'Music',
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800',
    price: '$25',
    is_free: false,
    description:
      'An evening of world-class jazz under the stars. Featuring the Marcus Reynolds Quartet, Sarah Lin Trio, and special guest appearances. Food trucks, craft cocktails, and a VIP lounge available.',
    organizer: 'NYC Summer Arts Collective',
    ticketUrl: 'https://www.ticketmaster.com',
    tags: ['music', 'jazz', 'outdoor', 'festival'],
  },
  {
    id: 'e2',
    title: 'Food Truck Night Market',
    date: 'Sun Jul 27',
    time: '4:00 PM – 10:00 PM',
    venue: 'Brooklyn Bridge Park',
    category: 'Food',
    image: 'https://images.unsplash.com/photo-1565123409695-7b5ef63a2efb?w=800',
    price: 'FREE',
    is_free: true,
    description:
      'Over 40 food trucks, live DJs, and waterfront views. Sample cuisine from around the world — from Korean BBQ tacos to artisanal gelato. Family-friendly with a dedicated kids zone.',
    organizer: 'Brooklyn Night Markets LLC',
    tags: ['food', 'market', 'outdoor', 'family'],
  },
  {
    id: 'e3',
    title: 'Broadway Under the Stars',
    date: 'Mon Jul 28',
    time: '7:30 PM – 10:00 PM',
    venue: 'Times Square',
    category: 'Theatre',
    image: 'https://images.unsplash.com/photo-1503095396549-807759245b35?w=800',
    price: '$40',
    is_free: false,
    description:
      'A magical open-air theatre experience in the heart of NYC. Excerpts from Hamilton, Wicked, The Lion King, and more — performed by the original Broadway casts. Premium seating includes a meet-and-greet.',
    organizer: 'Broadway Cares / Equity Fights AIDS',
    ticketUrl: 'https://www.broadway.com',
    tags: ['theatre', 'broadway', 'outdoor'],
  },
  {
    id: 'e4',
    title: 'Yoga in the Park',
    date: 'Tue Jul 29',
    time: '8:00 AM – 9:30 AM',
    venue: 'Hudson Yards',
    category: 'Wellness',
    image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800',
    price: 'FREE',
    is_free: true,
    description:
      'Start your morning with a rejuvenating yoga session led by master instructor Anika Patel. All levels welcome — bring your own mat. Post-session smoothies provided by Juice Generation.',
    organizer: 'Hudson Yards Wellness',
    tags: ['yoga', 'wellness', 'morning', 'free'],
  },
  {
    id: 'e5',
    title: 'Indie Film Screening',
    date: 'Wed Jul 30',
    time: '6:30 PM – 9:30 PM',
    venue: 'DUMBO Arts Center',
    category: 'Film',
    image: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800',
    price: '$15',
    is_free: false,
    description:
      'A curated selection of award-winning indie short films, followed by a Q&A with the directors. Popcorn and drinks included. Limited to 80 seats — advance booking recommended.',
    organizer: 'DUMBO Film Collective',
    ticketUrl: 'https://www.eventbrite.com',
    tags: ['film', 'indie', 'screening'],
  },
  {
    id: 'e6',
    title: 'Street Art Walking Tour',
    date: 'Thu Jul 31',
    time: '11:00 AM – 2:00 PM',
    venue: 'Williamsburg BK',
    category: 'Art',
    image: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800',
    price: '$10',
    is_free: false,
    description:
      'Explore Williamsburg\'s vibrant street art scene with a professional local guide. See iconic murals, meet working artists in their studios, and end with a craft beer at a hidden rooftop bar.',
    organizer: 'BK Art Walks',
    ticketUrl: 'https://www.eventbrite.com',
    tags: ['art', 'tour', 'walking', 'brooklyn'],
  },
];
