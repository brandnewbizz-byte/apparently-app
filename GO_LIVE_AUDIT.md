# 🔴 Rork/Apparently App — Go-Live Readiness Audit

**Date:** 2026-07-29  
**Backend:** Supabase (`inejlmksbzujgpwvnnch.supabase.co`) — real, live, connected  
**Mock Data Status:** All mock arrays emptied (proper upgrade from mock → live backend)

---

## ⚡ TL;DR

- **Supabase is live and connected.** Posts, likes, comments, plans, calendar, bills, relationships, products, listings — all write to real Supabase tables.
- **4 major features are completely dead/mock:** Live/Spot tab (all hardcoded), Stories UI (missing), Search (missing), Report/Hide (empty handlers).
- **Many user actions are local-only (AsyncStorage)**: Save posts, Join events, Celebrate achievements, Bundles, Skills, Messages, Service Requests — lost on reinstall.
- **Profile stats are hardcoded**: Streak, earnings, rating, completed count — fake numbers.
- **Video playback is cosmetic**: Play button shows but never plays.
- **Event detail page uses hardcoded data**: EXTERNAL_EVENTS isn't synced with any backend.

---

## 📊 BACKEND LAYER STATUS BY CONTEXT

| Context | AsyncStorage (local-only) | Supabase (real) | Verdict |
|---------|--------------------------|-----------------|---------|
| SocialContext | 6 refs | 17 refs | ✅ Strong Supabase |
| BookingsContext | 7 refs | 23 refs | ✅ Strong Supabase |
| PlannerContext | 0 refs | 13 refs | ✅ Pure Supabase |
| MarketplaceContext | 0 refs | 5 refs | ✅ Pure Supabase |
| LifeCrmContext | 4 refs | 12 refs | ✅ Strong Supabase |
| AuthContext | 4 refs | 16 refs | ✅ Strong Supabase |
| SwapContext | 8 refs | 5 refs | ⚠️ Mixed |
| SkillContext | 3 refs | 1 refs | ⚠️ Mostly local |
| BundleContext | 5 refs | 1 refs | ⚠️ Mostly local |
| ServiceRequestContext | 5 refs | 0 refs | ⚠️ Local only |
| MessagingContext | 4 refs | 0 refs | ⚠️ Local only |
| UserPostsContext | 4 refs | 0 refs | ⚠️ Local only |
| ConnectionsContext | 3 refs | 3 refs | ⚠️ Mixed |

---

## 🏠 HOME TAB

### WORKING ✅
- Tab bar navigation (all 5 tabs)
- Header buttons: **+** (Create Deal modal), **💬** (→ Inbox), **📊** (→ Manage)
- "Plan Your Day" card → Planner tab (reads real plans from Supabase)
- "Lifestyle" header + 6 category cards → /book (navigation works)
- Bundle swipe cards (Grab/Skip/Save with animations, confetti)
- Bundle "For You" / "Hot" toggle
- "See All" links (→ Planner, → Book, → Marketplace)
- Recently Grabbed section (from Supabase `job_requests`)

### PARTIAL ⚠️
- **Pull-to-refresh**: Only invalidates `grabbedBundles` cache. Doesn't refresh bundles, skills, or requests from any remote source. 1.5s arbitrary timeout.
- **Lifestyle category counts**: Hardcoded numbers (24, 18, 32, 15, 28, 12). No API.
- **All 6 lifestyle cards** → same `/book` route, no category filtering.
- **Bundle Grab/Save**: Local AsyncStorage only. Lost on reinstall.
- **Bundle "For You" / "Hot" tabs**: Same data, just sorted differently.

### DEAD 🔴
- **Live ticker bar**: `LIVE_UPDATES = []` — empty array. Green LIVE dot renders but no text ever scrolls.

---

## 📰 FEED TAB

### WORKING ✅
- **Like/Unlike** (⭐ Star): → SocialContext → `localApi.toggleLike()` → Supabase `post_likes` table
- **Comments** (💬): Real Supabase CRUD via `post_comments` table + replies
- **Share** (✈ Forward): Native `Share.share()` — real
- **Filter pills** (All/Live/Photos/Videos/Events/Plans): Local filtering works
- **#Hashtag taps**: Sets tag filter, filters feed
- **Comment detail modal**: Full comment view, real comment input → Supabase
- **Post detail modal**: Full-screen view, media viewer with zoom
- **+ Create post (Instagram camera)**: Opens full camera UI, photo capture/edit, creates local post
- **Delete post**: Removes from local + AsyncStorage context
- **For You row**: Renders first 5 posts as compact cards
- **Inbox button**: Navigates → /inbox

### PARTIAL ⚠️
- **Save post (🔖 Bookmark)**: Local `useState` per card + `Set` in FeedScreen. **No AsyncStorage, no Supabase. Lost on restart.**
- **Join (🔵 CTA)**: Local `Set` toggle. No RSVP, no navigation, no backend call. User has no idea what "joining" does.
- **View (🟢 marketplace CTA)**: Opens generic detail modal instead of product purchase flow.
- **Grab (🟣 bundle CTA)**: Opens generic detail modal instead of actual purchase.
- **Event card title click** → `/event/[id]`: Route exists but uses `EXTERNAL_EVENTS` hardcoded data (not Supabase).
- **Happening This Week cards**: Hardcoded `EXTERNAL_EVENTS` array.

### DEAD 🔴
- **Story bar**: SocialContext has full story infrastructure (Supabase `stories` table, createStory, getStories) — but NO Story UI is rendered anywhere. **Feature exists in code but is invisible to users.**
- **Search bar**: Search icon imported but never rendered as functional input.
- **Report menu option**: `onPress: () => {}` — empty handler.
- **Hide menu option**: `onPress: () => {}` — empty handler.
- **Video "play" overlay** (▶ icon): Purely cosmetic. No `<Video>` component, no actual playback.
- **Celebrate (achievement CTA)**: Local `Set` toggle. Zero visible UI change. No confetti. No backend.

---

## 🔴 SPOT/LIVE TAB

### WORKING ✅
- Tab navigation (renders correctly)
- ScrollView layout, pull-to-refresh (1.5s spinner, no real data fetch)
- Card UI (thumbnails, viewer counts, category badges)

### DEAD 🔴 (ENTIRE TAB IS MOCK)
- **LIVE_STREAMS**: 4 hardcoded streams with Unsplash stock photos. No actual streaming.
- **UPCOMING_SHOWS**: Hardcoded array, 0 viewers, scheduled times are fake.
- **CHAT_SEED**: Hardcoded chat messages (8 fake messages from fake users).
- **No streaming infrastructure**: No RTMP, no WebRTC, no Agora/Zego, no OBS support, no camera broadcast.
- **No chat backends**: Messages are static arrays, can't actually send/receive.
- **"Watch Live" CTA from Feed** → routes here, which is all fake data.

---

## 📅 PLANNER TAB

### WORKING ✅
- **Create Plan** (QuickPlan modal): → `createPlan()` → Supabase `plans` table
- **"Plan Day" card** → plan-day.tsx
- **"Add Block" card** → add-block.tsx
- **"Browse Jobs" card** → browse-jobs.tsx
- **Monthly calendar**: Day selection works, dots show dates with plans
- **Plan cards**: Tap → detail view. Displays real plan data from Supabase.
- **Delete plan**: Alert confirm → Supabase delete
- **Mode toggle**: My Day / My Plans / Requests — all work
- **Service requests view**: Lists requests from ServiceRequestContext
- **CreateRequest modal**: Creates request locally
- **Pull-to-refresh**: refetch() + haptic

### PARTIAL ⚠️
- **Plan stats row**: Counts are real (from Supabase), display is correct
- **"Build Bundle" card**: Navigates to `/bundle-builder` which writes to AsyncStorage (local-only)
- **Add block / Plan day**: Write to PlannerContext → Supabase (good), but deep screens unverified
- **Service requests**: Created locally in AsyncStorage, never synced to Supabase

### DEAD 🔴
- Status: **None found** — Planner is the most well-connected tab

---

## 👤 PROFILE TAB

### WORKING ✅
- **Avatar display**: Uses `user.avatar` from AuthContext
- **Edit Profile → photo picker**: ImagePicker → `updateAvatar()` from AuthContext
- **Stats row**: Posts count (deduped from social + user posts), Bundles count (BundleContext)
- **Tab bar** (Posts/Bundles/Skills/Plans): All 4 tabs render correctly
- **Posts grid**: 3-column Instagram-style grid, merged social + user posts
- **Bundles tab**: Lists user's bundles, "New Bundle" → /bundle-builder
- **Skills tab**: Lists user's skills, "Add Skill" → /skill-builder
- **Plans tab**: Lists grabbed bundles from Supabase `job_requests` table
- **Settings button** → /profile/settings
- **Book/Shop button** → /book
- **Delete bundle/skill**: Works (removes from local context)
- **Bundle card tap** → /planner/[id]

### PARTIAL ⚠️
- **Pull-to-refresh**: 1.5s spinner with no actual data reload
- **Streak badge**: Renders with fake value from `useState(6)`

### DEAD 🔴
- **Streak counter**: Hardcoded `useState(6)` — never changes, no real tracking
- **Earnings**: Hardcoded `useState(128)` — fake
- **Rating**: Hardcoded `"4.9"` in stats array — fake
- **Completed jobs**: Hardcoded `"24"` in stats array — fake
- **Bio**: Hardcoded `'Ready to grab opportunities!'` — the EditProfileModal has a bio input but it never saves/reads from any backend, and it uses a DIFFERENT default string (`'Building the future of compliance automation.'`)
- **Edit Profile bio field**: Typing in it does nothing — no `updateProfile()` call, no Supabase write

### Settings Screen
- ✅ Theme toggle (dark/light mode) — persisted to AsyncStorage
- ✅ Notification toggles — appears to be display-only (no push notification infrastructure verified)
- ⚠️ All other settings (privacy, about, etc.) — visual UI only, no verified backend

### Contact/CRM Sub-Screens
- **Add Contact** → `useLifeCrm().addContact()` → DatabaseService → Supabase `relationships` ✅
- **Add Bill** → `useLifeCrm().addBill()` → DatabaseService → Supabase `bills` ✅
- **Add Event** → `useLifeCrm().addCalendarEvent()` → DatabaseService → Supabase `calendar_events` ✅
- **Import Lead** → Not verified (no Supabase ref found, may be local-only)
- **Contact Detail** → Not verified

---

## 📱 STANDALONE SCREENS

### Bundle Builder (`app/bundle-builder.tsx`)
- ✅ Multi-step UI, free-text services, per-item descriptions, publish → BundleContext (AsyncStorage)
- ⚠️ **Data is AsyncStorage-only** — no Supabase sync for bundles

### Skill Builder (`app/skill-builder.tsx`)
- ✅ Creates skills → SkillContext (AsyncStorage)
- ⚠️ **Data is AsyncStorage-only** — minimal Supabase usage (1 ref in SkillContext)

### Manage (`app/manage.tsx`)
- ✅ Fetches from `localApi.getSkillDeals()` and `localApi.getBundles()` → Supabase-backed
- ✅ Edit, delete, status tracking → calls Supabase API
- ⚠️ Error catch is silent (empty catch block)

### Inbox (`app/inbox/index.tsx`)
- ✅ Conversation list from MessagingContext + ConnectionsContext
- ⚠️ **All conversations are AsyncStorage-only** — no Supabase, no push notifications

### Inbox Conversation (`app/inbox/conversation/[participantId].tsx`)
- ✅ Send/receive messages, typing, mentions — uses MessagingContext
- ⚠️ **Messages are AsyncStorage-only** — not real-time, no backend sync

### Inbox Notification (`app/inbox/[notificationId].tsx`)
- ⚠️ Chat-like interface but **no Supabase/AsyncStorage refs found** — may be display-only

### Book/Rentals (`app/book/index.tsx`)
- ✅ Uses BookingsContext (23 Supabase refs — strong backend)
- ✅ Listings, favorites, search — all Supabase-backed
- ✅ Category filtering (Stays/Cars/Boats)

### Book Listing Detail (`app/book/[listingId].tsx`)
- ✅ Uses BookingsContext → Supabase

### Book My Rentals (`app/book/my-rentals.tsx`)
- ✅ Uses BookingsContext → Supabase

### Book Product (`app/book/product/[productId].tsx`)
- ✅ Uses MarketplaceContext → Supabase

### Swap (`app/swap/index.tsx`)
- ✅ Swap posts CRUD → SwapContext → Supabase + AsyncStorage
- ⚠️ Mixed persistence (5 Supabase, 8 AsyncStorage refs)

### Event Detail (`app/event/[id].tsx`)
- 🔴 Uses `EXTERNAL_EVENTS` hardcoded array — **no real event data**
- 🔴 Ticket "purchase" is mock — `setTickets(n+1)` local state, no payment flow

### Create Content (`app/create-content.tsx`)
- ⚠️ Has 1 Supabase ref — limited connectivity verified

### Apparently All (`app/apparently-all.tsx`)
- 🔴 `const apparentlyPosts: Post[] = [];` — **empty array, dead screen**
- 🔴 Refresh → 1.5s spinner, never loads anything
- 🔴 Filter buttons ("All", "Grab", "Skip", "Saved") filter an empty array

---

## 🔑 TOP 10 GO-LIVE BLOCKERS

| # | Issue | Impact | Fix Complexity |
|---|-------|--------|----------------|
| 1 | **Spot/Live tab is 100% mock** | Entire tab is fake — users will notice immediately | High (need streaming infra) |
| 2 | **No story bar rendered** | Missing feature, backend exists but no UI | Low (add StoriesRow component) |
| 3 | **Profile stats are all fake** | Streak, earnings, rating, completed — hardcoded numbers | Medium (need real tracking) |
| 4 | **Bundles/Skills are local-only** | User data lost on reinstall — AsyncStorage, no Supabase | Medium (add Supabase sync) |
| 5 | **Messages are local-only** | Conversations don't sync across devices, no push | High (need real-time backend) |
| 6 | **Service Requests are local-only** | Posted requests only exist on device | Medium |
| 7 | **Event pages use hardcoded data** | EXTERNAL_EVENTS never updates, "ticket buying" is fake | Medium |
| 8 | **Video "play" overlay is cosmetic** | Shows ▶ but never plays video | Medium (add expo-av) |
| 9 | **Report/Hide menu items are dead** | Empty handlers — report function doesn't exist | Low |
| 10 | **Save/Join/Celebrate are local-only** | User actions vanish on restart | Low-Medium |

---

## ✅ THINGS THAT WILL WORK AT LAUNCH

- **Post feed** — real Supabase CRUD (create, read, like, comment, share, delete)
- **Planner** — real Supabase CRUD (plans, calendar events, bills, relationships)
- **Marketplace** — real Supabase CRUD (products, listings, bookings)
- **Profile display** — real auth info, real bundles/skills counts
- **Bundle/swap browse** — real data from local context (but not cross-device)
- **Life CRM** — real Supabase CRUD (contacts, bills, calendar)
- **Navigation** — all tabs and deep links work
