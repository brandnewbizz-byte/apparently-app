import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

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
}

const STORAGE_KEY = 'apparently_messaging_state';

export const [MessagingProvider, useMessaging] = createContextHook<MessagingState>(() => {
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);

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
          if (existing.find(e => e.id === cv.id)) continue;
          const otherId = cv.participant_one === authUser.id ? cv.participant_two : cv.participant_one;
          const { data: msgs } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', cv.id)
            .order('created_at', { ascending: true });

          const messages: Message[] = (msgs || []).map((m: any) => ({
            id: m.id, text: m.content || '', content: m.content,
            senderId: m.sender_id, receiverId: otherId,
            timestamp: m.created_at, read: m.read,
          }));

          existing.push({
            id: cv.id, participantId: otherId,
            participantName: 'User', participantAvatar: '', participantUsername: 'user',
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

    const timestamp = new Date().toISOString();
    let updatedConversations = [...conversations];
    const existingIndex = updatedConversations.findIndex(c => c.participantId === participantId);
    let conversation: Conversation;

    if (existingIndex >= 0) {
      conversation = { ...updatedConversations[existingIndex] };
    } else {
      conversation = getOrCreateConversation(participantId, participantInfo);
    }

    const newMessage: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text,
      senderId: authUser?.id || '',
      receiverId: participantId,
      timestamp,
      read: false,
    };

    conversation.messages = [...conversation.messages, newMessage];
    conversation.lastMessageAt = timestamp;

    if (existingIndex >= 0) {
      updatedConversations[existingIndex] = conversation;
    } else {
      updatedConversations = [conversation, ...updatedConversations];
    }

    updatedConversations.sort((a, b) => 
      new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );

    logger.info('MessagingContext', 'Sent message', { participantId, messageId: newMessage.id });
    persistState(updatedConversations);
  }, [conversations, getOrCreateConversation, persistState]);

  const getConversation = useCallback((participantId: string) => {
    return conversations.find(c => c.participantId === participantId);
  }, [conversations]);

  const markConversationAsRead = useCallback((participantId: string) => {
    const updatedConversations = conversations.map(conv => {
      if (conv.participantId === participantId) {
        return {
          ...conv,
          unreadCount: 0,
          messages: conv.messages.map(msg => ({
            ...msg,
            read: msg.receiverId === (authUser?.id || '') ? true : msg.read,
          })),
        };
      }
      return conv;
    });

    logger.info('MessagingContext', 'Marked conversation as read', { participantId });
    persistState(updatedConversations);
  }, [conversations, persistState]);

  const getTotalUnreadCount = useCallback(() => {
    return conversations.reduce((total, conv) => total + conv.unreadCount, 0);
  }, [conversations]);

  return {
    conversations,
    isLoading: query.isLoading,
    sharePostToUsers,
    sendMessage,
    getConversation,
    markConversationAsRead,
    getTotalUnreadCount,
  };
});
