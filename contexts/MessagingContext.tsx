import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Post } from '@/mocks/data';
import { logger } from '@/lib/logger';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export interface SharedPost {
  post: Post;
  message?: string;
  sharedAt: string;
}

export interface Message {
  id: string;
  text: string;
  content?: string;
  senderId: string;
  receiverId: string;
  timestamp: string;
  read: boolean;
  sharedPost?: SharedPost;
  metadata?: {
    bundle_card?: {
      type: string;
      id: string;
      title: string;
      description?: string;
      category?: string;
      price?: string;
      image_url?: string;
      creator_name?: string;
    };
    skill_card?: {
      type: string;
      id: string;
      title: string;
      description?: string;
      category?: string;
      price?: string;
      image_url?: string;
      creator_name?: string;
    };
  };
}

export interface Conversation {
  id: string;
  participantId: string;
  participantName: string;
  participantAvatar: string;
  participantUsername: string;
  messages: Message[];
  lastMessageAt: string;
  unreadCount: number;
}

interface MessagingState {
  conversations: Conversation[];
  isLoading: boolean;
  sharePostToUsers: (post: Post, userIds: string[], message?: string) => void;
  sendMessage: (participantId: string, text: string) => void;
  getConversation: (participantId: string) => Conversation | undefined;
  markConversationAsRead: (participantId: string) => void;
  getTotalUnreadCount: () => number;
  deleteMessage: (messageId: string, participantId: string) => Promise<void>;
  deleteConversation: (participantId: string) => Promise<void>;
  /** participantId => presence payload (typing / online) */
  presence: Record<string, { typing?: boolean; online?: boolean }>;
  /** Signal typing to the given participant. */
  notifyTyping: (participantId: string, typing: boolean) => void;
}

const STORAGE_KEY = 'apparently_messaging_state';

export const [MessagingProvider, useMessaging] = createContextHook<MessagingState>(() => {
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [presence, setPresence] = useState<Record<string, { typing?: boolean; online?: boolean }>>({});
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Scope storage per logged-in user — prevents message leakage between accounts
  const scopedKey = authUser?.id ? `${STORAGE_KEY}_${authUser.id}` : STORAGE_KEY;

  const query = useQuery({
    queryKey: ['messagingState', authUser?.id],
    queryFn: async () => {
      try {
        const stored = await AsyncStorage.getItem(scopedKey);
        if (stored && stored !== 'undefined' && stored !== 'null') {
          try {
            const parsed = JSON.parse(stored);
            logger.info('MessagingContext', 'Hydrated messaging state from storage');
            return parsed as Conversation[];
          } catch (parseError) {
            logger.error('MessagingContext', 'JSON parse error, clearing corrupted data', { parseError });
            await AsyncStorage.removeItem(scopedKey);
            return [];
          }
        }
        logger.info('MessagingContext', 'Using default messaging state');
        return [];
      } catch (error) {
        logger.error('MessagingContext', 'Error loading stored data', { error });
        return [];
      }
    },
  });

  const { mutate: persistMutation } = useMutation({
    mutationFn: async (payload: Conversation[]) => {
      await AsyncStorage.setItem(scopedKey, JSON.stringify(payload));
      logger.info('MessagingContext', 'Persisted messaging state');
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messagingState'] });
    },
  });

  useEffect(() => {
    if (query.data) {
      setConversations(query.data);
    }
  }, [query.data]);

  // Sync Supabase conversations into local state (bridges BundleContext.grabBundle → inbox)
  useEffect(() => {
    if (!authUser?.id) return;
    const sync = async () => {
      try {
        const { data: convs } = await supabase
          .from('conversations')
          .select('*')
          .or(`participant_one.eq.${authUser.id},participant_two.eq.${authUser.id}`)
          .order('last_message_at', { ascending: false });
        if (!convs?.length) return;

        const supabaseIds = new Set(convs.map((c: any) => c.id));
        const stored = await AsyncStorage.getItem(scopedKey);
        const existing: Conversation[] = stored ? JSON.parse(stored) : [];

        for (const cv of convs as any[]) {
          const otherId = cv.participant_one === authUser.id ? cv.participant_two : cv.participant_one;
          
          // Fetch participant profile from Supabase
          let profileName = 'User';
          let profileAvatar = '';
          let profileUsername = 'user';
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name, avatar, username')
              .eq('id', otherId)
              .maybeSingle();
            if (profile) {
              profileName = profile.full_name || profile.username || 'User';
              profileAvatar = profile.avatar || '';
              profileUsername = profile.username || 'user';
            }
          } catch {
            // Fall back to defaults
          }

          const existingConv = existing.find(e => e.id === cv.id);
          if (existingConv) {
            // Refresh participant info for existing conversations (was stale 'User')
            existingConv.participantName = profileName;
            existingConv.participantAvatar = profileAvatar;
            existingConv.participantUsername = profileUsername;
            continue;
          }

          const { data: msgs } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', cv.id)
            .order('created_at', { ascending: true });

          const messages: Message[] = (msgs || []).map((m: any) => ({
            id: m.id, text: m.content || '', content: m.content,
            senderId: m.sender_id, receiverId: otherId,
            timestamp: m.created_at, read: m.read,
            metadata: m.metadata || undefined,
          }));

          existing.push({
            id: cv.id, participantId: otherId,
            participantName: profileName, participantAvatar: profileAvatar, participantUsername: profileUsername,
            messages, lastMessageAt: messages.length ? messages.slice(-1)[0].timestamp : cv.last_message_at || cv.created_at,
            unreadCount: messages.filter(m => !m.read && m.receiverId === authUser.id).length,
          });
        }

        setConversations(existing);
        await AsyncStorage.setItem(scopedKey, JSON.stringify(existing));
        logger.info('MessagingContext', 'Synced Supabase conversations', { added: convs.length });
      } catch (err) {
        logger.warn('MessagingContext', 'Supabase sync failed', { error: String(err) });
      }
    };
    sync();
  }, [authUser?.id]);

  // ── REALTIME: live incoming messages + read receipts ──
  useEffect(() => {
    const me = authUser?.id || '';
    if (!me) return;

    const upsertMessageLocally = (incoming: any) => {
      const senderId: string = incoming.sender_id;
      const receiverId: string = me;
      const otherId = senderId === me ? receiverId : senderId;
      const msg: Message = {
        id: incoming.id,
        text: incoming.content || '',
        content: incoming.content || '',
        senderId,
        receiverId,
        timestamp: incoming.created_at,
        read: incoming.read ?? false,
        metadata: incoming.metadata || undefined,
      };

      setConversations(prev => {
        const idx = prev.findIndex(c => c.participantId === otherId);
        if (idx < 0) {
          // Unknown participant — re-run the sync to build the conversation with
          // profile info, or create a light entry.
          syncFromSupabase();
          return prev;
        }
        const conv = prev[idx];
        const already = conv.messages.some(m => m.id === msg.id);
        if (already) return prev; // de-dup realtime + local sync overlap
        const nextMsgs = [...conv.messages, msg];
        nextMsgs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        const next = prev.map((c, i) =>
          i === idx
            ? {
                ...c,
                messages: nextMsgs,
                lastMessageAt: msg.timestamp,
                // Unread only when it's addressed TO me and not the active read state
                unreadCount: msg.senderId !== me && !msg.read ? (c.unreadCount || 0) + 1 : c.unreadCount,
              }
            : c
        );
        next.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
        return next;
      });
    };

    const channel = supabase
      .channel(`messaging-${me}`)
    channelRef.current = channel;
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as Record<string, any>;
        const next: Record<string, { typing?: boolean; online?: boolean }> = {};
        for (const key of Object.keys(state)) {
          const peer = state[key]?.[0];
          if (!peer || peer.user_id === me) continue;
          next[key] = { typing: !!peer.typing, online: true };
        }
        setPresence(next);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        const peer = newPresences?.[0];
        if (!peer || peer.user_id === me) return;
        setPresence(prev => ({ ...prev, [key]: { typing: false, online: true } }));
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        setPresence(prev => {
          const cp = { ...prev };
          delete cp[key];
          return cp;
        });
      })
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=in.(select id from conversations where participant_one=eq.${me} or participant_two=eq.${me})` },
        (payload) => {
          const row = payload.new as any;
          if (row.sender_id === me) return; // ignore own echoes (handled optimistically)
          upsertMessageLocally(row);
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          const row = payload.new as any;
          // Reflect read-state changes pushed by the other participant
          setConversations(prev =>
            prev.map(c => ({
              ...c,
              messages: c.messages.map(m =>
                m.id === row.id ? { ...m, read: row.read ?? m.read } : m
              ),
            }))
          );
        }
      )
      .subscribe();

    // Local helper for the INSERT path when participant row is missing
    const syncFromSupabase = async () => {
      try {
        const { data: convs } = await supabase
          .from('conversations')
          .select('*')
          .or(`participant_one.eq.${me},participant_two.eq.${me}`);
        if (!convs?.length) return;
        const newState: Conversation[] = [];
        for (const cv of convs as any[]) {
          const otherId = cv.participant_one === me ? cv.participant_two : cv.participant_one;
          let profileName = 'User';
          let profileAvatar = '';
          let profileUsername = 'user';
          try {
            const { data: p } = await supabase
              .from('profiles')
              .select('full_name, avatar, username')
              .eq('id', otherId)
              .maybeSingle();
            if (p) {
              profileName = p.full_name || p.username || 'User';
              profileAvatar = p.avatar || '';
              profileUsername = p.username || 'user';
            }
          } catch {}
          const { data: msgs } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', cv.id)
            .order('created_at', { ascending: true });
          const messages: Message[] = (msgs || []).map((m: any) => ({
            id: m.id, text: m.content || '', content: m.content,
            senderId: m.sender_id, receiverId: otherId,
            timestamp: m.created_at, read: m.read,
            metadata: m.metadata || undefined,
          }));
          newState.push({
            id: cv.id, participantId: otherId,
            participantName: profileName, participantAvatar: profileAvatar, participantUsername: profileUsername,
            messages: messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
            lastMessageAt: cv.last_message_at || cv.created_at,
            unreadCount: messages.filter(m => !m.read && m.receiverId === me).length,
          });
        }
        newState.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
        setConversations(prev => {
          const merged = [...newState];
          for (const p of prev) {
            if (!merged.find(m => m.participantId === p.participantId)) merged.push(p);
          }
          merged.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
          return merged;
        });
      } catch {}
    };

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authUser?.id]);

  const persistState = useCallback((next: Conversation[]) => {
    setConversations(next);
    persistMutation(next);
  }, [persistMutation]);

  const getOrCreateConversation = useCallback((participantId: string, participantInfo?: { name?: string; avatar?: string; username?: string }): Conversation => {
    const existing = conversations.find(c => c.participantId === participantId);
    if (existing) {
      // Update participant info if it was previously unknown
      if (existing.participantName === 'Unknown User' && participantInfo?.name) {
        return {
          ...existing,
          participantName: participantInfo.name,
          participantAvatar: participantInfo.avatar || existing.participantAvatar,
          participantUsername: participantInfo.username || existing.participantUsername,
        };
      }
      return existing;
    }

    const newConversation: Conversation = {
      id: `conv-${participantId}-${Date.now()}`,
      participantId,
      participantName: participantInfo?.name || 'Unknown User',
      participantAvatar: participantInfo?.avatar || '',
      participantUsername: participantInfo?.username || 'unknown',
      messages: [],
      lastMessageAt: new Date().toISOString(),
      unreadCount: 0,
    };

    return newConversation;
  }, [conversations]);

  const sharePostToUsers = useCallback((post: Post, userIds: string[], message?: string) => {
    const timestamp = new Date().toISOString();
    let updatedConversations = [...conversations];

    userIds.forEach(userId => {
      const existingIndex = updatedConversations.findIndex(c => c.participantId === userId);
      let conversation: Conversation;

      if (existingIndex >= 0) {
        conversation = { ...updatedConversations[existingIndex] };
      } else {
        conversation = getOrCreateConversation(userId, { name: post.user?.name, avatar: post.user?.avatar, username: post.user?.username });
      }

      const newMessage: Message = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        text: message || '',
        senderId: authUser?.id || '',
        receiverId: userId,
        timestamp,
        read: false,
        sharedPost: {
          post,
          message,
          sharedAt: timestamp,
        },
      };

      conversation.messages = [...conversation.messages, newMessage];
      conversation.lastMessageAt = timestamp;

      if (existingIndex >= 0) {
        updatedConversations[existingIndex] = conversation;
      } else {
        updatedConversations = [conversation, ...updatedConversations];
      }
    });

    updatedConversations.sort((a, b) => 
      new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );

    logger.info('MessagingContext', 'Shared post to users', { postId: post.id, userIds, conversationsCount: updatedConversations.length });
    persistState(updatedConversations);
  }, [conversations, getOrCreateConversation, persistState]);

  const sendMessage = useCallback((participantId: string, text: string, participantInfo?: { name?: string; avatar?: string; username?: string }) => {
    if (!text.trim()) return;
    const me = authUser?.id || '';
    if (!me) return;

    const timestamp = new Date().toISOString();
    let updatedConversations = [...conversations];
    const existingIndex = updatedConversations.findIndex(c => c.participantId === participantId);
    let conversation: Conversation;

    if (existingIndex >= 0) {
      conversation = { ...updatedConversations[existingIndex] };
    } else {
      conversation = getOrCreateConversation(participantId, participantInfo);
    }

    // Optimistic append so the sender sees the message instantly.
    const optimistic: Message = {
      id: `pending-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text,
      senderId: me,
      receiverId: participantId,
      timestamp,
      read: false,
    };
    conversation.messages = [...conversation.messages, optimistic];
    conversation.lastMessageAt = timestamp;

    if (existingIndex >= 0) updatedConversations[existingIndex] = conversation;
    else updatedConversations = [conversation, ...updatedConversations];

    updatedConversations.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
    persistState(updatedConversations);

    // ── PERSIST to Supabase so the recipient can receive it ──
    // Guarantee stable ordering of participants so we always find/create the
    // same conversation row for a given pair.
    const [pa, pb] = [me, participantId].sort();
    (async () => {
      try {
        let convId = conversation.id.startsWith('conv-') ? null : conversation.id;
        if (!convId) {
          // find existing conversation row for this pair
          const { data: pair } = await supabase
            .from('conversations')
            .select('id')
            .or(`and(participant_one.eq.${pa},participant_two.eq.${pb}),and(participant_one.eq.${pb},participant_two.eq.${pa})`)
            .maybeSingle();
          if (pair) {
            convId = pair.id;
          } else {
            const { data: created } = await supabase
              .from('conversations')
              .insert({ participant_one: pa, participant_two: pb, last_message_at: timestamp })
              .select('id')
              .maybeSingle();
            if (created) convId = created.id;
          }
        }
        if (!convId) return;

        const { data: row } = await supabase
          .from('messages')
          .insert({
            conversation_id: convId,
            sender_id: me,
            receiver_id: participantId,
            content: text,
            read: false,
          })
          .select('id, content, created_at')
          .maybeSingle();

        if (!row) return;
        // Swap the optimistic (pending-*) message for the confirmed DB row.
        const confirmed: Message = { ...optimistic, id: row.id };
        setConversations(prev =>
          prev.map(c =>
            c.participantId === participantId
              ? { ...c, messages: c.messages.map(m => (m.id === optimistic.id ? confirmed : m)) }
              : c
          )
        );
      } catch (e) {
        logger.warn('MessagingContext', 'Persist sendMessage failed', { error: String(e) });
      }
    })();

    logger.info('MessagingContext', 'Sent message', { participantId, messageId: optimistic.id });
  }, [conversations, getOrCreateConversation, persistState, authUser?.id]);

  const getConversation = useCallback((participantId: string) => {
    return conversations.find(c => c.participantId === participantId);
  }, [conversations]);

  const markConversationAsRead = useCallback((participantId: string) => {
    const me = authUser?.id || '';
    const updatedConversations = conversations.map(conv => {
      if (conv.participantId === participantId) {
        // Persist read state of MY received messages up to the DB so the sender
        // sees the read receipt via realtime UPDATE.
        const myIncoming = conv.messages.filter(m => m.receiverId === me && !m.read);
        if (myIncoming.length && conv.id && !conv.id.startsWith('conv-')) {
          const ids = myIncoming.map(m => m.id);
          (async () => {
            try {
              await supabase.from('messages').update({ read: true }).in('id', ids);
              logger.info('MessagingContext', 'Persisted read receipts', { count: ids.length });
            } catch (err) {
              logger.warn('MessagingContext', 'Persist read receipts failed', { error: String(err) });
            }
          })();
        }
        return {
          ...conv,
          unreadCount: 0,
          messages: conv.messages.map(msg => ({
            ...msg,
            read: msg.receiverId === me ? true : msg.read,
          })),
        };
      }
      return conv;
    });

    logger.info('MessagingContext', 'Marked conversation as read', { participantId });
    persistState(updatedConversations);
  }, [conversations, persistState, authUser?.id]);

  const getTotalUnreadCount = useCallback(() => {
    return conversations.reduce((total, conv) => total + conv.unreadCount, 0);
  }, [conversations]);

  const deleteMessage = useCallback(async (messageId: string, participantId: string) => {
    try {
      // Delete from Supabase
      const { error } = await supabase.from('messages').delete().eq('id', messageId);
      if (error) { logger.warn('MessagingContext', 'Supabase delete message failed', { error: error.message }); }
    } catch (e) {
      logger.warn('MessagingContext', 'deleteMessage Supabase error', { error: String(e) });
    }
    // Remove from local state
    const updated = conversations.map(c => {
      if (c.participantId === participantId) {
        const filtered = c.messages.filter(m => m.id !== messageId);
        return { ...c, messages: filtered, lastMessageAt: filtered.length ? filtered[filtered.length - 1].timestamp : c.lastMessageAt };
      }
      return c;
    }).filter(c => c.messages.length > 0); // remove empty conversations
    logger.info('MessagingContext', 'Deleted message', { messageId, participantId });
    persistState(updated);
  }, [conversations, persistState]);

  const deleteConversation = useCallback(async (participantId: string) => {
    const conv = conversations.find(c => c.participantId === participantId);
    if (!conv) return;
    try {
      // Delete all messages + conversation from Supabase
      const { error: msgErr } = await supabase.from('messages').delete().eq('conversation_id', conv.id);
      if (msgErr) { logger.warn('MessagingContext', 'Supabase delete messages failed', { error: msgErr.message }); }
      const { error: convErr } = await supabase.from('conversations').delete().eq('id', conv.id);
      if (convErr) { logger.warn('MessagingContext', 'Supabase delete conversation failed', { error: convErr.message }); }
    } catch (e) {
      logger.warn('MessagingContext', 'deleteConversation Supabase error', { error: String(e) });
    }
    // Remove from local state
    const updated = conversations.filter(c => c.participantId !== participantId);
    logger.info('MessagingContext', 'Deleted conversation', { participantId });
    persistState(updated);
  }, [conversations, persistState]);

  const notifyTyping = useCallback((participantId: string, typing: boolean) => {
    // Broadcast typing intent to the conversation participant via the realtime
    // presence channel so the recipient can show a live "typing…" indicator.
    const ch = channelRef.current;
    if (!ch) return;
    try {
      // Channel presence is keyed by user id; use typed payload so peers can read it.
      ch.track({ user_id: authUser?.id, typing } as any);
    } catch (e) {
      logger.warn('MessagingContext', 'Typing broadcast failed', { error: String(e) });
    }
  }, [authUser?.id]);

  return {
    conversations,
    isLoading: query.isLoading,
    sharePostToUsers,
    sendMessage,
    getConversation,
    markConversationAsRead,
    getTotalUnreadCount,
    deleteMessage,
    deleteConversation,
    presence,
    notifyTyping,
  };
});
