import crypto from 'crypto';
import { getDB, saveDB } from './db.js';

export function seedAll() {
  const db = getDB();

  // Check if already seeded
  const stmt = db.prepare('SELECT COUNT(*) as c FROM users');
  stmt.step();
  const count = stmt.getAsObject();
  stmt.free();

  if (count.c > 0) {
    console.log(`🌱 Already seeded (${count.c} users). Skipping.`);
    return;
  }

  console.log('🌱 Seeding database...');
  const now = new Date().toISOString();
  const uid = () => crypto.randomUUID();

  function run(sql, params = []) { db.run(sql, params); }
  function subMinutes(m) { return new Date(Date.now() - m * 60000).toISOString(); }
  function subHours(h) { return new Date(Date.now() - h * 3600000).toISOString(); }

  // ─── Users ───
  run(`INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, ['u1', 'Mom', 'mom', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop', 0, 0, 0, 'family', now, now]);
  run(`INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, ['u2', 'George Whitman', 'georgewhitman', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop', 1, 2500, 0, 'business', now, now]);
  run(`INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, ['u3', 'Jessica Taylor', 'jessicataylor', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop', 0, 890, 0, 'friend', now, now]);
  run(`INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, ['u4', 'Robert Chen', 'robertchen', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop', 1, 15000, 0, 'mentor', now, now]);
  run(`INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, ['u5', 'Sarah Miller', 'sarahmiller', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop', 0, 1200, 1, 'colleague', now, now]);
  run(`INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, ['u6', 'Marcus Johnson', 'marcusj', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop', 0, 3400, 0, 'business', now, now]);
  run(`INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, ['u-dev', 'You', 'you', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop', 0, 0, 0, null, now, now]);

  // ─── Posts ───
  const posts = [
    ['p1', 'u1', "Thanksgiving prep in full swing! Can't wait for the whole family to be together. Making grandma's secret recipe this year 🍂🦃", 'https://images.unsplash.com/photo-1574672280600-4accfa5b6f98?w=600&h=400&fit=crop', 24, 8, 2, subMinutes(15)],
    ['p2', 'u2', "Just closed an incredible deal today! The real estate market is moving fast. Excited for what's coming in Q1 2026. 📈💼", null, 156, 23, 12, subMinutes(45)],
    ['p3', 'u3', "Coffee shop vibes and catching up on my reading list. This book is a game changer! Anyone else reading 'Atomic Habits'? 📚☕", 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600&h=400&fit=crop', 89, 34, 5, subHours(1)],
    ['p4', 'u4', "Mentorship Monday! Had an amazing session with my mentees today. Remember: success isn't just about what you achieve, it's about who you help along the way. 🌟", null, 342, 67, 89, subHours(2)],
    ['p5', 'u5', "Sprint review done! Project Alpha is on track for the Q4 release. Proud of the team's hard work! 🚀", 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&h=400&fit=crop', 78, 19, 4, subHours(3)],
    ['p6', 'u6', "Just wrapped up a creative brainstorming session. The ideas are flowing! Who's ready to disrupt the marketing world with us? 🎨✨", null, 203, 45, 28, subHours(4)],
    ['p7', 'u3', "Birthday countdown begins! 🎂 Only 3 weeks left. Already planning something special with the squad!", null, 156, 52, 3, subHours(5)],
    ['p8', 'u1', "Nothing beats a Sunday morning family breakfast. Grateful for these moments 💕", 'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?w=600&h=400&fit=crop', 45, 12, 1, subHours(6)],
  ];
  for (const p of posts) {
    run(`INSERT INTO posts (id, user_id, content, image_url, likes, comments, shares, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], p[7]]);
  }

  // ─── Stories ───
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const stories = [
    ['s1', 'u1', 'https://images.unsplash.com/photo-1574672280600-4accfa5b6f98?w=400&h=600&fit=crop', 0],
    ['s2', 'u2', 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&h=600&fit=crop', 0],
    ['s3', 'u3', 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&h=600&fit=crop', 1],
    ['s4', 'u4', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop', 0],
    ['s5', 'u5', 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&h=600&fit=crop', 0],
    ['s6', 'u6', 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=400&h=600&fit=crop', 1],
  ];
  for (const s of stories) {
    run(`INSERT INTO stories (id, user_id, image_url, viewed, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)`, [s[0], s[1], s[2], s[3], now, expires]);
  }

  // ─── Comments ───
  const comments = [
    ['c1', 'p1', 'u3', 'Can I come over? 😍', null, subMinutes(10)],
    ['c2', 'p1', 'u4', 'Family time is everything!', null, subMinutes(5)],
    ['c3', 'p2', 'u5', 'Congrats George! 🚀', null, subMinutes(30)],
    ['c4', 'p2', 'u6', "Let's connect on that deal!", null, subMinutes(25)],
    ['c5', 'p3', 'u2', 'Great book! Changed my morning routine completely.', null, subMinutes(50)],
    ['c6', 'p3', 'u4', 'Yes! James Clear is a genius.', null, subMinutes(45)],
    ['c7', 'p5', 'u6', 'When are we seeing a demo? 👀', null, subHours(2)],
    ['c8', 'p5', 'u2', 'Great progress Sarah!', null, subHours(1.5)],
  ];
  for (const c of comments) {
    run(`INSERT INTO comments (id, post_id, author_id, text, parent_id, likes, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)`, [c[0], c[1], c[2], c[3], c[4], c[5]]);
  }

  // ─── Listings ───
  const listings = [
    ['l1', 'stay', 'Cozy Downtown Studio', 'New York, NY', 120, 4.8, 56, '["https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&h=400&fit=crop","https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&h=400&fit=crop"]'],
    ['l2', 'stay', 'Luxury Penthouse Suite', 'Miami, FL', 450, 4.9, 124, '["https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600&h=400&fit=crop"]'],
    ['l3', 'car', 'Tesla Model 3', 'Los Angeles, CA', 89, 4.7, 34, '["https://images.unsplash.com/photo-1561580125-25f40e193b98?w=600&h=400&fit=crop"]'],
    ['l4', 'car', 'BMW X5 2025', 'Chicago, IL', 120, 4.9, 18, '["https://images.unsplash.com/photo-1555215695-3004980ad54e?w=600&h=400&fit=crop"]'],
    ['l5', 'boat', 'Sunset Yacht', 'Miami Beach', 800, 5.0, 12, '["https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?w=600&h=400&fit=crop"]'],
  ];
  for (const l of listings) {
    run(`INSERT INTO listings (id, category, title, description, images, host_id, location, price_per_day, currency, rating, review_count, status, instant_book, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'USD', ?, ?, 'available', 1, ?, ?)`,
      [l[0], l[1], l[2], l[2] + ' - Beautiful listing', l[7], 'u-dev', l[3], l[4], l[5], l[6], now, now]);
  }

  // ─── Products ───
  run(`INSERT INTO products (id, seller_id, seller_name, seller_avatar, seller_username, title, description, price, accepts_swap, condition, category, images, location, views, saves, status, created_at, updated_at)
    VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'active', ?, ?)`,
    ['mp1', 'u2', 'George Whitman', 'georgewhitman', 'Vintage Record Player', 'Vintage record player description', 150, 0, 'good', 'electronics', '["https://images.unsplash.com/photo-1461360228754-6e81c478b882?w=400&h=400&fit=crop"]', 'NYC', now, now]);
  run(`INSERT INTO products (id, seller_id, seller_name, seller_avatar, seller_username, title, description, price, accepts_swap, condition, category, images, location, views, saves, status, created_at, updated_at)
    VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'active', ?, ?)`,
    ['mp2', 'u5', 'Sarah Miller', 'sarahmiller', 'MacBook Pro M3 2025', 'MacBook Pro description', 1800, 0, 'like_new', 'electronics', '["https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&h=400&fit=crop"]', 'SF', now, now]);
  run(`INSERT INTO products (id, seller_id, seller_name, seller_avatar, seller_username, title, description, price, accepts_swap, condition, category, images, location, views, saves, status, created_at, updated_at)
    VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'active', ?, ?)`,
    ['mp3', 'u3', 'Jessica Taylor', 'jessicataylor', 'Handmade Ceramic Vase Set', 'Vase set description', 45, 1, 'new', 'home', '["https://images.unsplash.com/photo-1578500494198-246f612d3b3d?w=400&h=400&fit=crop"]', 'Austin', now, now]);

  // ─── Calendar Events ───
  const events = [
    ['Team Standup', 'business', '2025-11-29', '09:00', 30, 'Zoom', 'medium', null],
    ['Client Presentation', 'business', '2025-11-29', '14:00', 60, 'Conference Room A', 'high', 2500],
    ['Gym Session', 'personal', '2025-11-29', '18:00', 60, 'FitLife Gym', 'medium', null],
    ['Dinner with Family', 'personal', '2025-11-30', '19:00', 120, null, 'high', null],
    ['Q4 Report Deadline', 'deadline', '2025-12-01', '17:00', 0, null, 'high', null],
    ['Coffee with Mentor', 'meeting', '2025-12-02', '10:00', 45, 'Blue Bottle Coffee', 'medium', null],
    ['Consulting Session', 'business', '2025-12-02', '15:00', 90, 'Virtual', 'high', 450],
    ['Workshop Facilitation', 'business', '2025-12-05', '09:00', 240, 'Client Office', 'high', 1200],
  ];
  for (const e of events) {
    run(`INSERT INTO calendar_events (id, user_id, title, type, date, time, duration, location, attendees, priority, is_completed, income_amount, income_source, payment_status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, 0, ?, ?, ?, ?, ?)`,
      [uid(), 'u-dev', e[0], e[1], e[2], e[3], e[4], e[5], e[6], e[7], e[7] ? 'Project milestone' : null, e[7] ? 'expected' : null, now, now]);
  }

  // ─── Bills ───
  const bills = [
    ['Rent', 2500, '2025-12-01', 'rent', 1, 'monthly'],
    ['Electric Bill', 145, '2025-12-05', 'utilities', 1, 'monthly'],
    ['Netflix', 22.99, '2025-12-10', 'subscription', 1, 'monthly'],
    ['Car Insurance', 180, '2025-12-15', 'insurance', 1, 'quarterly'],
  ];
  for (const b of bills) {
    run(`INSERT INTO bills (id, user_id, name, amount, due_date, category, is_paid, is_recurring, frequency, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`, [uid(), 'u-dev', b[0], b[1], b[2], b[3], b[4], b[5], now, now]);
  }

  // ─── Relationships ───
  const rels = [
    ['Sarah Chen', 'colleague', 85, '["work","product"]', '555-0101', 'sarah@example.com', 'TechCorp', 'Engineering Lead', 1, 'Pending project review'],
    ['Marcus Johnson', 'business', 72, '["partner","investor"]', '555-0102', 'marcus@example.com', 'Ventures LLC', 'Investor', 0, null],
    ['Dr. Lisa Park', 'mentor', 65, '["mentorship","career"]', '555-0103', 'lisa@example.com', 'Stanford', 'Professor', 0, null],
    ['Tom Davis', 'friend', 40, '["personal"]', '555-0104', 'tom@example.com', null, null, 0, null],
  ];
  for (const r of rels) {
    run(`INSERT INTO relationships (id, user_id, name, avatar, category, last_interaction, last_interaction_date, interaction_score, tags, phone, email, company, role, needs_attention, attention_reason, created_at, updated_at)
      VALUES (?, ?, ?, '', ?, 'None', '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uid(), 'u-dev', r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9], now, now]);
  }

  // ─── Swap Posts ───
  const swaps = [
    ['u2', 'Website Redesign', 'Professional UI/UX design', 'Content writing or SEO help', 'design', 'Remote', '2 weeks'],
    ['u5', 'Spanish Lessons', 'Conversational Spanish tutoring', 'Guitar lessons', 'education', 'NYC', '1hr/week'],
    ['u4', 'Investment Advice', 'Portfolio review + strategy', 'Legal contract review', 'business', 'Remote', null],
  ];
  for (const s of swaps) {
    run(`INSERT INTO swap_posts (id, author_id, title, details, offering, needing, category, location, time_estimate, price, status, is_service_request, created_at, updated_at)
      VALUES (?, ?, ?, 'Looking to collaborate!', ?, ?, ?, ?, ?, NULL, 'open', 0, ?, ?)`,
      [uid(), s[0], s[1], s[2], s[3], s[4], s[5], s[6], now, now]);
  }

  // ─── Plans ───
  const plans = [
    ['Morning Workout', '2025-11-29', '07:00', 60, 'fitness', 'Fitness', '#10B981', 'home', 'high'],
    ['Team Standup', '2025-11-29', '09:00', 30, 'work', 'Work', '#3B82F6', 'home', 'medium'],
    ['Lunch with Sarah', '2025-11-29', '12:00', 60, 'social', 'Social', '#FFB800', 'hotel', 'medium'],
    ['Project Review', '2025-11-30', '10:00', 90, 'work', 'Work', '#3B82F6', null, 'high'],
  ];
  for (const p of plans) {
    run(`INSERT INTO plans (id, user_id, title, date, start_time, duration_minutes, category, category_label, category_color, location, location_type, priority, is_completed, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, 0, ?, ?)`,
      [uid(), 'u-dev', p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], p[8], now, now]);
  }

  // ─── Income Sources ───
  run(`INSERT INTO income_sources (id, user_id, name, type, estimated_amount, frequency, confidence, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [uid(), 'u-dev', 'Freelance Consulting', 'freelance', 4500, 'monthly', 80, now, now]);
  run(`INSERT INTO income_sources (id, user_id, name, type, estimated_amount, frequency, confidence, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [uid(), 'u-dev', 'Workshop Income', 'business', 1200, 'monthly', 60, now, now]);

  saveDB();

  function countTable(t) { const s = db.prepare(`SELECT COUNT(*) as c FROM ${t}`); s.step(); const r = s.getAsObject(); s.free(); return r.c; }
  console.log(`✅ Seeded: ${countTable('users')} users, ${countTable('posts')} posts, ${countTable('stories')} stories, ${countTable('listings')} listings`);
  console.log(`   ${countTable('products')} products, ${countTable('calendar_events')} events, ${countTable('bills')} bills`);
  console.log(`   ${countTable('relationships')} contacts, ${countTable('swap_posts')} swap posts, ${countTable('plans')} plans`);
}
