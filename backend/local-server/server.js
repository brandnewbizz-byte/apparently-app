import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { initDB, getDB, saveDB } from './db.js';
import { seedAll } from './seed.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Helper: run a SELECT and return array of objects
function queryAll(sql, params = []) {
  const db = getDB();
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// Helper: run a SELECT and return single object or null
function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length ? rows[0] : null;
}

// Helper: run an INSERT/UPDATE/DELETE
function execute(sql, params = []) {
  const db = getDB();
  db.run(sql, params);
  saveDB();
}

// ─── Health ───
app.get('/', (_, res) => res.json({ ok: true, db: 'sqlite' }));

// ─── Users ───
app.get('/api/users', (_, res) => {
  res.json(queryAll('SELECT * FROM users ORDER BY created_at DESC'));
});

app.get('/api/users/:id', (req, res) => {
  const u = queryOne('SELECT * FROM users WHERE id = ?', [req.params.id]);
  u ? res.json(u) : res.status(404).json({ error: 'Not found' });
});

// ─── Posts ───
app.get('/api/posts', (_, res) => {
  const posts = queryAll(`
    SELECT p.*, u.name as author_name, u.username as author_username, u.avatar as author_avatar,
           u.is_verified as author_verified, u.followers_count as author_followers,
           u.relationship_category as author_relationship
    FROM posts p LEFT JOIN users u ON p.user_id = u.id
    ORDER BY p.created_at DESC
  `);
  res.json(posts);
});

app.post('/api/posts', (req, res) => {
  const { user_id, content, image_url, post_kind, category } = req.body;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  execute(`INSERT INTO posts (id, user_id, content, image_url, likes, comments, shares, post_kind, category, created_at, updated_at)
    VALUES (?, ?, ?, ?, 0, 0, 0, ?, ?, ?, ?)`, [
    id,
    user_id,
    content,
    image_url || null,
    post_kind || 'post',
    category || null,
    now,
    now,
  ]);
  const post = queryOne('SELECT * FROM posts WHERE id = ?', [id]);
  res.status(201).json(post);
});

app.put('/api/posts/:id', (req, res) => {
  execute('UPDATE posts SET content = ?, updated_at = ? WHERE id = ?',
    [req.body.content, new Date().toISOString(), req.params.id]);
  res.json({ ok: true });
});

app.delete('/api/posts/:id', (req, res) => {
  execute('DELETE FROM posts WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

// ─── Stories ───
app.get('/api/stories', (_, res) => {
  const stories = queryAll(`
    SELECT s.*, u.name as author_name, u.username as author_username, u.avatar as author_avatar
    FROM stories s LEFT JOIN users u ON s.user_id = u.id
    WHERE s.expires_at > datetime('now')
    ORDER BY s.created_at DESC
  `);
  res.json(stories);
});

app.post('/api/stories', (req, res) => {
  const { user_id, image_url, background_color, text_content } = req.body;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  execute(`INSERT INTO stories (id, user_id, image_url, viewed, background_color, text_content, created_at, expires_at)
    VALUES (?, ?, ?, 0, ?, ?, ?, ?)`, [id, user_id, image_url, background_color || null, text_content || null, now, expires]);
  res.status(201).json({ id });
});

// ─── Likes ───
app.get('/api/likes/:post_id', (req, res) => {
  const { user_id } = req.query;
  const count = queryOne('SELECT COUNT(*) as count FROM likes WHERE post_id = ?', [req.params.post_id]);
  const liked = user_id
    ? !!queryOne('SELECT 1 as found FROM likes WHERE post_id = ? AND user_id = ?', [req.params.post_id, user_id])
    : false;
  res.json({ count: count.count, liked });
});

app.post('/api/likes', (req, res) => {
  const { post_id, user_id } = req.body;
  const existing = queryOne('SELECT id FROM likes WHERE post_id = ? AND user_id = ?', [post_id, user_id]);
  if (existing) {
    execute('DELETE FROM likes WHERE id = ?', [existing.id]);
    execute('UPDATE posts SET likes = MAX(0, likes - 1) WHERE id = ?', [post_id]);
    res.json({ liked: false });
  } else {
    execute('INSERT INTO likes (id, post_id, user_id, created_at) VALUES (?, ?, ?, ?)',
      [crypto.randomUUID(), post_id, user_id, new Date().toISOString()]);
    execute('UPDATE posts SET likes = likes + 1 WHERE id = ?', [post_id]);
    res.json({ liked: true });
  }
});

// ─── Comments ───
app.get('/api/comments/:post_id', (req, res) => {
  const comments = queryAll(`
    SELECT c.*, u.name as author_name, u.avatar as author_avatar
    FROM comments c LEFT JOIN users u ON c.author_id = u.id
    WHERE c.post_id = ? AND c.parent_id IS NULL
    ORDER BY c.created_at ASC
  `, [req.params.post_id]);

  const result = comments.map(c => {
    const replies = queryAll(`
      SELECT r.*, u.name as author_name, u.avatar as author_avatar
      FROM comments r LEFT JOIN users u ON r.author_id = u.id
      WHERE r.parent_id = ? ORDER BY r.created_at ASC
    `, [c.id]);
    return { ...c, replies };
  });

  res.json(result);
});

app.post('/api/comments', (req, res) => {
  const { post_id, author_id, text, parent_id } = req.body;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  execute(`INSERT INTO comments (id, post_id, author_id, text, parent_id, likes, created_at)
    VALUES (?, ?, ?, ?, ?, 0, ?)`, [id, post_id, author_id, text, parent_id || null, now]);
  execute('UPDATE posts SET comments = comments + 1 WHERE id = ?', [post_id]);
  const comment = queryOne(`
    SELECT c.*, u.name as author_name, u.avatar as author_avatar
    FROM comments c LEFT JOIN users u ON c.author_id = u.id WHERE c.id = ?
  `, [id]);
  res.status(201).json(comment);
});

// ─── Listings ───
app.get('/api/listings', (req, res) => {
  const { category } = req.query;
  const listings = category
    ? queryAll('SELECT * FROM listings WHERE category = ? ORDER BY created_at DESC', [category])
    : queryAll('SELECT * FROM listings ORDER BY created_at DESC');
  res.json(listings);
});

app.get('/api/listings/:id', (req, res) => {
  const l = queryOne('SELECT * FROM listings WHERE id = ?', [req.params.id]);
  l ? res.json(l) : res.status(404).json({ error: 'Not found' });
});

app.post('/api/listings', (req, res) => {
  const l = req.body;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  execute(`INSERT INTO listings (id, category, title, description, images, host_id, location,
    price_per_day, currency, rating, review_count, status, instant_book, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, l.category, l.title, l.description, JSON.stringify(l.images || []), l.host_id, l.location,
      l.price_per_day, l.currency || 'USD', l.rating || 0, l.review_count || 0, l.status || 'available',
      l.instant_book ? 1 : 0, now, now]);
  res.status(201).json({ id });
});

// ─── Bookings ───
app.get('/api/bookings', (req, res) => {
  const { user_id } = req.query;
  const bookings = user_id
    ? queryAll('SELECT * FROM bookings WHERE user_id = ? ORDER BY created_at DESC', [user_id])
    : queryAll('SELECT * FROM bookings ORDER BY created_at DESC');
  res.json(bookings);
});

app.post('/api/bookings', (req, res) => {
  const b = req.body;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  execute(`INSERT INTO bookings (id, listing_id, user_id, start_date, end_date, total_price, status, guest_count, message, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, b.listing_id, b.user_id, b.start_date, b.end_date, b.total_price, b.status || 'pending',
      b.guest_count || 1, b.message || null, now, now]);
  res.status(201).json({ id });
});

// ─── Products ───
app.get('/api/products', (_, res) => {
  res.json(queryAll("SELECT * FROM products WHERE status = 'active' ORDER BY created_at DESC"));
});

app.post('/api/products', (req, res) => {
  const p = req.body;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  execute(`INSERT INTO products (id, seller_id, seller_name, seller_avatar, seller_username, title, description,
    price, accepts_swap, condition, category, images, location, views, saves, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'active', ?, ?)`,
    [id, p.seller_id, p.seller_name, p.seller_avatar, p.seller_username, p.title, p.description,
      p.price, p.accepts_swap ? 1 : 0, p.condition, p.category, JSON.stringify(p.images || []), p.location, now, now]);
  res.status(201).json({ id });
});

// ─── Calendar Events ───
app.get('/api/calendar-events', (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  res.json(queryAll('SELECT * FROM calendar_events WHERE user_id = ? ORDER BY date ASC, time ASC', [user_id]));
});

app.post('/api/calendar-events', (req, res) => {
  const e = req.body;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  execute(`INSERT INTO calendar_events (id, user_id, title, type, date, time, duration, location, attendees,
    priority, is_completed, income_amount, income_source, payment_status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, e.user_id, e.title, e.type, e.date, e.time, e.duration, e.location || null,
      JSON.stringify(e.attendees || []), e.priority, e.is_completed ? 1 : 0,
      e.income_amount || null, e.income_source || null, e.payment_status || null, now, now]);
  res.status(201).json({ id });
});

app.put('/api/calendar-events/:id', (req, res) => {
  const { is_completed } = req.body;
  if (is_completed !== undefined) {
    execute('UPDATE calendar_events SET is_completed = ?, updated_at = ? WHERE id = ?',
      [is_completed ? 1 : 0, new Date().toISOString(), req.params.id]);
  }
  res.json({ ok: true });
});

app.delete('/api/calendar-events/:id', (req, res) => {
  execute('DELETE FROM calendar_events WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

// ─── Bills ───
app.get('/api/bills', (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  res.json(queryAll('SELECT * FROM bills WHERE user_id = ? ORDER BY due_date ASC', [user_id]));
});

app.post('/api/bills', (req, res) => {
  const b = req.body;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  execute(`INSERT INTO bills (id, user_id, name, amount, due_date, category, is_paid, is_recurring, frequency, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, b.user_id, b.name, b.amount, b.due_date, b.category, b.is_paid ? 1 : 0,
      b.is_recurring ? 1 : 0, b.frequency || null, now, now]);
  res.status(201).json({ id });
});

app.put('/api/bills/:id', (req, res) => {
  execute('UPDATE bills SET is_paid = ?, updated_at = ? WHERE id = ?',
    [req.body.is_paid ? 1 : 0, new Date().toISOString(), req.params.id]);
  res.json({ ok: true });
});

// ─── Relationships ───
app.get('/api/relationships', (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  res.json(queryAll('SELECT * FROM relationships WHERE user_id = ? ORDER BY interaction_score DESC', [user_id]));
});

app.post('/api/relationships', (req, res) => {
  const r = req.body;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  execute(`INSERT INTO relationships (id, user_id, name, avatar, category, last_interaction, last_interaction_date,
    interaction_score, notes, upcoming_birthday, tags, phone, email, company, role, needs_attention, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, r.user_id, r.name, r.avatar, r.category, r.last_interaction, r.last_interaction_date,
      r.interaction_score || 0, r.notes || null, r.upcoming_birthday || null, JSON.stringify(r.tags || []),
      r.phone || null, r.email || null, r.company || null, r.role || null, r.needs_attention ? 1 : 0, now, now]);
  res.status(201).json({ id });
});

// ─── Contact Interactions ───
app.get('/api/contact-interactions/:relationship_id', (req, res) => {
  res.json(queryAll('SELECT * FROM contact_interactions WHERE relationship_id = ? ORDER BY date DESC', [req.params.relationship_id]));
});

app.post('/api/contact-interactions', (req, res) => {
  const i = req.body;
  const id = crypto.randomUUID();
  execute(`INSERT INTO contact_interactions (id, relationship_id, type, date, time, duration, notes, outcome, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, i.relationship_id, i.type, i.date, i.time || null, i.duration || null, i.notes || null, i.outcome || null, new Date().toISOString()]);
  res.status(201).json({ id });
});

// ─── Contact Meetings ───
app.get('/api/contact-meetings/:relationship_id', (req, res) => {
  res.json(queryAll('SELECT * FROM contact_meetings WHERE relationship_id = ? ORDER BY date DESC', [req.params.relationship_id]));
});

app.post('/api/contact-meetings', (req, res) => {
  const m = req.body;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  execute(`INSERT INTO contact_meetings (id, relationship_id, title, date, time, location, agenda, status,
    expected_income, income_type, income_status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, m.relationship_id, m.title, m.date, m.time, m.location || null, m.agenda || null,
      m.status || 'scheduled', m.expected_income || null, m.income_type || null, m.income_status || null, now, now]);
  res.status(201).json({ id });
});

// ─── Contact Follow-ups ───
app.get('/api/contact-followups/:relationship_id', (req, res) => {
  res.json(queryAll('SELECT * FROM contact_follow_ups WHERE relationship_id = ? ORDER BY due_date ASC', [req.params.relationship_id]));
});

app.post('/api/contact-followups', (req, res) => {
  const f = req.body;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  execute(`INSERT INTO contact_follow_ups (id, relationship_id, title, due_date, priority, status, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, f.relationship_id, f.title, f.due_date, f.priority || 'medium', f.status || 'pending', f.notes || null, now, now]);
  res.status(201).json({ id });
});

// ─── Income Sources ───
app.get('/api/income-sources', (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  res.json(queryAll('SELECT * FROM income_sources WHERE user_id = ? ORDER BY created_at DESC', [user_id]));
});

app.post('/api/income-sources', (req, res) => {
  const s = req.body;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  execute(`INSERT INTO income_sources (id, user_id, name, type, estimated_amount, frequency, confidence, linked_connections, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, s.user_id, s.name, s.type, s.estimated_amount, s.frequency, s.confidence || 0, JSON.stringify(s.linked_connections || []), now, now]);
  res.status(201).json({ id });
});

// ─── Swap Posts ───
app.get('/api/swap-posts', (_, res) => {
  res.json(queryAll('SELECT * FROM swap_posts ORDER BY created_at DESC'));
});

app.post('/api/swap-posts', (req, res) => {
  const p = req.body;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  execute(`INSERT INTO swap_posts (id, author_id, title, details, offering, needing, category, location,
    time_estimate, price, status, is_service_request, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, p.author_id, p.title, p.details, p.offering, p.needing, p.category, p.location || null,
      p.time_estimate || null, p.price || null, p.status || 'open', p.is_service_request ? 1 : 0, now, now]);
  res.status(201).json({ id });
});

app.delete('/api/swap-posts/:id', (req, res) => {
  execute('DELETE FROM swap_posts WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

// ─── Swap Matches ───
app.get('/api/swap-matches', (req, res) => {
  const { user_id } = req.query;
  const matches = user_id
    ? queryAll('SELECT * FROM swap_matches WHERE proposer_user_id = ? OR target_user_id = ? ORDER BY created_at DESC', [user_id, user_id])
    : queryAll('SELECT * FROM swap_matches ORDER BY created_at DESC');
  res.json(matches);
});

app.post('/api/swap-matches', (req, res) => {
  const m = req.body;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  execute(`INSERT INTO swap_matches (id, proposer_post_id, target_post_id, proposer_user_id, target_user_id,
    status, cash_offer, payment_method, proposer_accepted, target_accepted, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, m.proposer_post_id, m.target_post_id, m.proposer_user_id, m.target_user_id,
      m.status || 'pending', m.cash_offer || null, m.payment_method || null, 0, 0, now, now]);
  res.status(201).json({ id });
});

app.put('/api/swap-matches/:id', (req, res) => {
  const { status, proposer_accepted, target_accepted } = req.body;
  const sets = ['updated_at = ?'];
  const vals = [new Date().toISOString()];
  if (status) { sets.push('status = ?'); vals.push(status); }
  if (proposer_accepted !== undefined) { sets.push('proposer_accepted = ?'); vals.push(proposer_accepted ? 1 : 0); }
  if (target_accepted !== undefined) { sets.push('target_accepted = ?'); vals.push(target_accepted ? 1 : 0); }
  vals.push(req.params.id);
  execute(`UPDATE swap_matches SET ${sets.join(', ')} WHERE id = ?`, vals);
  res.json({ ok: true });
});

// ─── Plans ───
app.get('/api/plans', (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  res.json(queryAll('SELECT * FROM plans WHERE user_id = ? ORDER BY date ASC, start_time ASC', [user_id]));
});

app.post('/api/plans', (req, res) => {
  const p = req.body;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  execute(`INSERT INTO plans (id, user_id, title, date, start_time, duration_minutes, category, category_label,
    category_color, location, location_type, transport, assistance, payment, priority, is_completed, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, p.user_id, p.title, p.date, p.start_time, p.duration_minutes || 60,
      p.category, p.category_label || null, p.category_color || null,
      p.location || null, p.location_type || null, p.transport || null,
      JSON.stringify(p.assistance || []), p.payment || null, p.priority || 'medium', 0, now, now]);
  res.status(201).json({ id });
});

app.delete('/api/plans/:id', (req, res) => {
  execute('DELETE FROM plans WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

// ─── Connection Requests ───
app.get('/api/connection-requests', (req, res) => {
  const { user_id } = req.query;
  const requests = user_id
    ? queryAll('SELECT * FROM connection_requests WHERE to_user_id = ? OR from_user_id = ? ORDER BY created_at DESC', [user_id, user_id])
    : queryAll('SELECT * FROM connection_requests ORDER BY created_at DESC');
  res.json(requests);
});

app.post('/api/connection-requests', (req, res) => {
  const r = req.body;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  execute(`INSERT INTO connection_requests (id, from_user_id, to_user_id, from_name, from_avatar, from_username,
    to_name, to_avatar, to_username, status, message, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, r.from_user_id, r.to_user_id, r.from_name || null, r.from_avatar || null, r.from_username || null,
      r.to_name || null, r.to_avatar || null, r.to_username || null, r.status || 'pending', r.message || null, now, now]);
  res.status(201).json({ id });
});

app.put('/api/connection-requests/:id', (req, res) => {
  const { status } = req.body;
  execute('UPDATE connection_requests SET status = ?, updated_at = ? WHERE id = ?',
    [status, new Date().toISOString(), req.params.id]);
  res.json({ ok: true });
});

// ─── Skill Deals ───
app.get('/api/skill-deals', (_, res) => {
  res.json(queryAll("SELECT * FROM skill_deals WHERE status = 'active' ORDER BY created_at DESC"));
});

app.post('/api/skill-deals', (req, res) => {
  const s = req.body;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  execute(`INSERT INTO skill_deals (id, creator_id, creator_name, creator_avatar, title, description, price, icon, image_url, category, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
    [id, s.creator_id, s.creator_name, s.creator_avatar, s.title, s.description, s.price, s.icon || '🛠️', s.image_url || null, s.category || null, now, now]);
  res.status(201).json({ id });
});

// ─── Bundles ───
app.get('/api/bundles', (_, res) => {
  res.json(queryAll("SELECT * FROM bundles WHERE status = 'active' ORDER BY created_at DESC"));
});

app.post('/api/bundles', (req, res) => {
  const b = req.body;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  execute(`INSERT INTO bundles (id, creator_id, creator_name, creator_avatar, title, description, price, items, image_url, category, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
    [id, b.creator_id, b.creator_name, b.creator_avatar, b.title, b.description, b.price, JSON.stringify(b.items || []), b.image_url || null, b.category || null, now, now]);
  res.status(201).json({ id });
});

// ─── Init & Start ───
await initDB();
seedAll();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Local backend running on http://0.0.0.0:${PORT}`);
  console.log(`   Local: http://localhost:${PORT}`);
  console.log(`   Network: http://192.168.1.167:${PORT}`);
  console.log(`   Tables ready, data seeded.`);
});
