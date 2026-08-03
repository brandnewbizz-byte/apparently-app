/**
 * Drains the offline action queue when the app comes to the foreground.
 * Call from inside a context (SocialContext) that has access to localApi.
 */
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { getQueuedActions, dequeueAction, QueuedAction, MAX_RETRIES } from '@/lib/offlineQueue';
import { logger } from '@/lib/logger';

type RetryHandler = {
  /** Called for each queued 'like' / 'unlike' action */
  retryLike: (payload: Record<string, unknown>) => Promise<boolean>;
  /** Called for each queued 'comment' action */
  retryComment: (payload: Record<string, unknown>) => Promise<boolean>;
};

export function useOfflineRetry(handlers: RetryHandler) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    let isDraining = false;

    const drainQueue = async () => {
      if (isDraining) return;
      isDraining = true;
      try {
        const queue = await getQueuedActions();
        if (!queue.length) return;
        logger.info('useOfflineRetry', 'Draining offline queue', { count: queue.length });

        for (const action of queue) {
          if (action.retries >= MAX_RETRIES) {
            logger.warn('useOfflineRetry', 'Discarding action (max retries)', { id: action.id });
            await dequeueAction(action.id);
            continue;
          }

          let ok = false;
          try {
            if (action.type === 'like' || action.type === 'unlike') {
              ok = await handlersRef.current.retryLike(action.payload);
            } else if (action.type === 'comment') {
              ok = await handlersRef.current.retryComment(action.payload);
            }
          } catch {
            ok = false;
          }

          if (ok) {
            await dequeueAction(action.id);
            logger.info('useOfflineRetry', 'Action replayed successfully', { id: action.id });
          }
          // On failure the action stays in the queue (retry count incremented by the queueAction call)
        }
      } catch (e: any) {
        logger.warn('useOfflineRetry', 'Queue drain error', { error: e?.message });
      } finally {
        isDraining = false;
      }
    };

    // Drain on mount (app launch / provider re-mount)
    drainQueue();

    // Drain on foreground
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') drainQueue();
    });

    return () => sub.remove();
  }, []);
}
