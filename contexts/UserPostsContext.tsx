// UserPostsContext.tsx — Shared user post store for feed + profile
// Posts created via camera/caption flow appear on both feed and profile

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@app/user_posts_v1';

// ── Types ──
export interface UserPost {
  id: string;
  caption: string;
  mediaUri?: string;
  timestamp: string;
}

interface UserPostsContextValue {
  userPosts: UserPost[];
  addUserPost: (post: UserPost) => void;
  deleteUserPost: (id: string) => void;
}

const UserPostsContext = createContext<UserPostsContextValue | null>(null);

// ── Provider ──
export function UserPostsProvider({ children }: { children: React.ReactNode }) {
  const [userPosts, setUserPosts] = useState<UserPost[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored) {
        try {
          setUserPosts(JSON.parse(stored) as UserPost[]);
        } catch (_) {}
      }
      setLoaded(true);
    });
  }, []);

  // Persist whenever list changes
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(userPosts)).catch(() => {});
  }, [userPosts, loaded]);

  const addUserPost = useCallback((post: UserPost) => {
    setUserPosts((prev) => [post, ...prev]);
  }, []);

  const deleteUserPost = useCallback((id: string) => {
    setUserPosts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return (
    <UserPostsContext.Provider value={{ userPosts, addUserPost, deleteUserPost }}>
      {children}
    </UserPostsContext.Provider>
  );
}

// ── Hook ──
export function useUserPosts() {
  const ctx = useContext(UserPostsContext);
  if (!ctx) throw new Error('useUserPosts must be used within UserPostsProvider');
  return ctx;
}
