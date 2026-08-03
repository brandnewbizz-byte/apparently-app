/**
 * Offline action queue — saves failed mutations to AsyncStorage
 * and retries when the app regains connectivity.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from './logger';

const QUEUE_KEY = 'apparently_offline_queue_v1';

export interface QueuedAction {
  id: string; // e.g. "like_post123_user456"
  type: 'like' | 'unlike' | 'comment';
  payload: Record<string, unknown>;
  createdAt: number; // Date.now()
  retries: number;
}

/** Push a failed action onto the offline queue. Deduplicates by id. */
export async function queueAction(action: Omit<QueuedAction, 'retries'>): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const queue: QueuedAction[] = raw ? JSON.parse(raw) : [];
    // Deduplicate — if same id exists, bump retries
    const existing = queue.findIndex((a) => a.id === action.id);
    if (existing >= 0) {
      queue[existing].retries++;
      queue[existing].createdAt = action.createdAt;
    } else {
      queue.push({ ...action, retries: 0 });
    }
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    logger.info('offlineQueue', 'Queued action', { id: action.id, queueSize: queue.length });
  } catch {
    // Queue is best-effort — don't crash if storage fails
  }
}

/** Dequeue one action by id. */
export async function dequeueAction(actionId: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const queue: QueuedAction[] = raw ? JSON.parse(raw) : [];
    const filtered = queue.filter((a) => a.id !== actionId);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
  } catch {}
}

/** Get all queued actions sorted by creation time (oldest first). */
export async function getQueuedActions(): Promise<QueuedAction[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const queue: QueuedAction[] = JSON.parse(raw);
    return queue.sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

/** Discard the entire queue. Use after a full sync. */
export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

/** Max retries before giving up. */
export const MAX_RETRIES = 5;
