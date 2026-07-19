import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import { Post, mockUsers } from '@/mocks/data';

export interface SharedPost {
  post: Post;
  message?: string;
  sharedAt: string;
}

export interface Message {
  id: string;
  text: string;
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

const currentUser = {
  id: 'current-user',
  name: 'You',
  username: 'you',
  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop',
};

export const [MessagingProvider, useMessaging] = createContextHook<MessagingState>(() => {
  const queryClient = useQueryClient();
  const [conversations, setConversations] = useState<Conversation[]>([]);

  const query = useQuery({
    queryKey: ['messagingState'],
    queryFn: async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored && stored !== 'undefined' && stored !== 'null') {
          try {
            const parsed = JSON.parse(stored);
            console.log('[MessagingContext] Hydrated messaging state from storage');
            return parsed as Conversation[];
          } catch (parseError) {
            console.error('[MessagingContext] JSON parse error, clearing corrupted data:', parseError);
            await AsyncStorage.removeItem(STORAGE_KEY);
            return [];
          }
        }
        console.log('[MessagingContext] Using default messaging state');
        return [];
      } catch (error) {
        console.error('[MessagingContext] Error loading stored data:', error);
        return [];
      }
    },
  });

  const { mutate: persistMutation } = useMutation({
    mutationFn: async (payload: Conversation[]) => {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      console.log('[MessagingContext] Persisted messaging state');
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

  const persistState = useCallback((next: Conversation[]) => {
    setConversations(next);
    persistMutation(next);
  }, [persistMutation]);

  const getOrCreateConversation = useCallback((participantId: string): Conversation => {
    const existing = conversations.find(c => c.participantId === participantId);
    if (existing) {
      return existing;
    }

    const user = mockUsers.find(u => u.id === participantId);
    const newConversation: Conversation = {
      id: `conv-${participantId}-${Date.now()}`,
      participantId,
      participantName: user?.name || 'Unknown User',
      participantAvatar: user?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop',
      participantUsername: user?.username || 'unknown',
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
        conversation = getOrCreateConversation(userId);
      }

      const newMessage: Message = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        text: message || '',
        senderId: currentUser.id,
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

    console.log('[MessagingContext] Shared post to users', { postId: post.id, userIds, conversationsCount: updatedConversations.length });
    persistState(updatedConversations);
  }, [conversations, getOrCreateConversation, persistState]);

  const sendMessage = useCallback((participantId: string, text: string) => {
    if (!text.trim()) return;

    const timestamp = new Date().toISOString();
    let updatedConversations = [...conversations];
    const existingIndex = updatedConversations.findIndex(c => c.participantId === participantId);
    let conversation: Conversation;

    if (existingIndex >= 0) {
      conversation = { ...updatedConversations[existingIndex] };
    } else {
      conversation = getOrCreateConversation(participantId);
    }

    const newMessage: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text,
      senderId: currentUser.id,
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

    console.log('[MessagingContext] Sent message', { participantId, messageId: newMessage.id });
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
            read: msg.receiverId === currentUser.id ? true : msg.read,
          })),
        };
      }
      return conv;
    });

    console.log('[MessagingContext] Marked conversation as read', { participantId });
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
