/**
 * useActiveFeedPost — detects which feed post is currently active.
 *
 * Uses FlatList viewability detection (TikTok-style snap paging). With
 * `snapToInterval` + `decelerationRate="fast"`, exactly one post occupies the
 * viewport at a time, so a high `itemVisiblePercentThreshold` yields a single
 * candidate. A short debounce smooths rapid scrolling so presence/voice joins
 * only fire once the user actually settles on a post.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ListViewToken as ViewToken } from 'react-native';

export interface UseActiveFeedPostResult {
  activePostId: string | null;
  viewabilityConfig: { itemVisiblePercentThreshold: number; minimumViewTime: number };
  onViewableItemsChanged: (info: { viewableItems: Array<ViewToken>; changed: Array<ViewToken> }) => void;
}

const SETTLE_MS = 250;

export function useActiveFeedPost(onActiveChange?: (postId: string | null) => void): UseActiveFeedPostResult {
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const activeRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onActiveChange);
  onChangeRef.current = onActiveChange;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
    minimumViewTime: 150,
  }).current;

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: Array<ViewToken>; changed: Array<ViewToken> }) => {
      const viewable = viewableItems.filter((v) => v.isViewable && v.item);
      if (viewable.length === 0) return;

      // With snap paging only one item is near-100% visible at a time. Prefer
      // the highest-index viewable item as a stable tie-breaker.
      const candidate = viewable[viewable.length - 1];
      const nextId: string | null = (candidate.item as any)?.id ?? candidate.key ?? null;
      if (!nextId) return;
      if (activeRef.current === nextId) return;

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        activeRef.current = nextId;
        setActivePostId(nextId);
        onChangeRef.current?.(nextId);
      }, SETTLE_MS);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return { activePostId, viewabilityConfig, onViewableItemsChanged };
}
