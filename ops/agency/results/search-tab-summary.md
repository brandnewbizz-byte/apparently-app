# Search Tab — Build Summary

**Date:** 2026-07-30
**Task:** Build a Search tab for the "Apparently" app

---

## Files Created

### `app/(tabs)/search/index.tsx`
Full-featured search screen with:
- **Search bar**: Text input with 350ms debounce, clear button, loading spinner
- **People search**: Queries `users` table via `supabase`, matching on `name` and `username` with `.ilike()`, ordered by `followers_count` descending, limited to 10 results
- **Posts search**: Queries `posts` table via `supabase`, matching on `content` with `.ilike()`, limited to 20 results
- **Author enrichment**: After fetching posts, batches a `users` table lookup for unique author IDs to display author names and avatars
- **Results UI**: FlatList with section headers ("People" / "Posts") with icon + count badge
- **User cards**: Avatar, name (with verified badge), @username, follower count → navigates to `/user/[id]`
- **Post cards**: Author avatar/name, timestamp, content preview (3 lines), thumbnail image if present, like/comment stats → navigates to `/user/[user_id]`
- **Recent searches**: Stores last 5 searches in state, shown when search bar is empty with a "Clear All" button
- **Empty states**: Different messaging for "no query yet" vs "no results found"
- **Error handling**: Catch block displays error message inline
- **Styling**: Matches existing tab screens — uses `useTheme()` colors, `useSafeAreaInsets()`, consistent font sizes, border styles, and card patterns

## Files Modified

### `app/(tabs)/_layout.tsx`
- Imported `Search` icon from `lucide-react-native`
- Added `Tabs.Screen` for `name="search"` with title "Search" between Home and Feed tabs
- Uses the same `activeIconContainer` pattern as other tabs

## Patterns Followed
- `supabase` imported from `@/lib/supabase` (re-exports from `supabaseClient.js`)
- `useTheme()` hook for colors, `useAuth()` for current user context
- `useSafeAreaInsets()` for top safe area padding
- `useRouter()` from `expo-router` for navigation
- `useState`, `useEffect`, `useRef`, `useCallback` from React
- `Haptics.impactAsync()` for tactile feedback on taps
- File-based Expo Router routing: `app/(tabs)/search/index.tsx`

## TypeScript Verification
- `npx tsc --noEmit` passes clean for both new and modified files
- All existing TS errors are pre-existing in unrelated files (home screen, marketplace, product modals, etc.)

## Database Tables Used
- `users`: `id`, `name`, `username`, `avatar`, `is_verified`, `followers_count`, `is_live`
- `posts`: `id`, `user_id`, `content`, `image_url`, `timestamp`, `likes`, `comments`
