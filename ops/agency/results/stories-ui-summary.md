# Stories UI — Implementation Summary

**Date:** 2026-07-30
**App:** Apparently (rork-apparently-app-real-app-main)
**Status:** ✅ Complete

---

## Components Created

### 1. `components/StoriesViewer.tsx` (567 lines)
Full-screen Instagram/Snapchat-style story viewer modal.

**Features:**
- Modal overlay with black background, covers entire screen
- Auto-advances every 5 seconds through stories within a user and across users
- Tap left third to go back, right two-thirds to go forward
- Long-press to pause/resume (with "⏸ Paused" indicator)
- Progress bar row at top showing per-story progress with fill animation
- Header with avatar, name, relative timestamp, and close (X) button
- Swipe-down-to-dismiss gesture (pan responder with spring-back or dismiss)
- Haptic feedback on navigation
- Handles optional text content overlay on stories

**Types exported:**
- `StoryUser` — groups stories per user (`userId`, `name`, `avatar`, `stories`)
- `StoryMedia` — individual story (`id`, `mediaUrl`, `backgroundColor?`, `textContent?`, `createdAt`)

### 2. `components/StoryRing.tsx` (299 lines)
Circular avatar with Instagram-style gradient border ring.

**Features:**
- Instagram gradient (orange → pink → purple) for unviewed stories via `expo-linear-gradient`
- Plain gray border for viewed stories
- Pulsing scale animation (1.0 ↔ 1.04) on unviewed rings
- "Add Story" mode: dashed border with translucent plus overlay on avatar
- Configurable size (default 68px) and name font size
- Name label below ring with text overflow handling

**Props:** `avatar`, `name`, `hasUnviewed`, `size?`, `nameSize?`, `isAddStory?`, `onPress`

### 3. `components/CreateStory.tsx` (273 lines)
Story creation modal with camera capture and gallery pick.

**Features:**
- Sheet-style modal with two options: "Take Photo" (opens InstagramCamera) or "Choose from Gallery" (opens expo-image-picker)
- Uses existing `InstagramCamera` component for camera capture
- Uses `expo-image-picker` for gallery selection
- Delegates to `SocialContext.createStory()` which handles:
  - Getting current user ID
  - Setting 24-hour expiry
  - Inserting into Supabase stories table
  - Cache invalidation
- Uploading indicator with haptic feedback
- Theme-aware colors (`background`, `text`, `accent`, `surface`)

---

## Wiring — Feed Integration (`app/(tabs)/feed/index.tsx`)

### Changes made:
1. **Imports added:** `StoriesViewer`, `StoryRing`, `CreateStory` (with types)
2. **State added:** `showStoriesViewer`, `storyViewerStartIndex`, `showCreateStory`
3. **`storyUsers` memo:** Transforms `feedStories` + `userStories` from `SocialContext` into `StoryUser[]` format expected by `StoriesViewer`. Groups stories by user, sorts by newest first, deduplicates by ID.
4. **ListHeaderComponent updated:** Replaced old raw TouchableOpacity stories row with:
   - `StoryRing` (isAddStory mode) for "Your Story" — opens CreateStory modal
   - `StoryRing` components for each story user — opens StoriesViewer at that user's index
5. **Modals added:** `StoriesViewer` and `CreateStory` components rendered at the end of the feed

---

## Data Flow

```
Supabase stories table
    ↓ (DatabaseService.fetchStories — filters expired)
SocialContext (feedStories, userStories)
    ↓
feed/index.tsx (storyUsers memo — groups by user)
    ↓
StoryRing components (display)
    ↓ onPress
StoriesViewer modal (full-screen viewing)
```

```
CreateStory → InstagramCamera / expo-image-picker
    ↓ image URI
SocialContext.createStory → DatabaseService.createStory → Supabase
    ↓
Cache invalidation → re-fetch
    ↓
StoryRing appears in feed
```

---

## TypeScript Verification

`npx tsc --noEmit` shows **zero new errors** from the Stories UI implementation. The only error in `app/(tabs)/feed/index.tsx` is a pre-existing one (line 950, `authorId` property).

---

## Dependencies Used
- `expo-haptics` — haptic feedback
- `expo-linear-gradient` — gradient ring border
- `expo-image-picker` — gallery image selection
- `lucide-react-native` — icons (X, ChevronLeft, ChevronRight, Camera, Image)
- `react-native-safe-area-context` — safe area insets
- `react-native` Animated API — progress bar, pulse, swipe-to-dismiss

All dependencies were already in the project's `package.json`.
