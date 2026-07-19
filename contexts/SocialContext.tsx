import createContextHook from '@nkzw/create-context-hook';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Share, Platform } from 'react-native';
import { useCallback, useEffect, useState, useRef } from 'react';

import { Post, Story, mockPosts, mockStories, mockUsers } from '@/mocks/data';
import { DatabaseService } from '@/lib/database';
import * as localApi from '@/lib/api';

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export interface SocialComment {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  text: string;
  timestamp: string;
  likes: number;
  isLiked: boolean;
  replies: SocialComment[];
  parentId?: string;
}

export interface StoryInteraction {
  storyId: string;
  likes: number;
  isLiked: boolean;
  comments: SocialComment[];
}

interface PostInteraction {
  likeCount: number;
  commentCount: number;
  shareCount: number;
  isLiked: boolean;
  comments: SocialComment[];
}

export interface UserPost extends Post {
  isUserCreated: boolean;
}

export interface UserStory extends Story {
  isUserCreated: boolean;
  backgroundColor?: string;
  textContent?: string;
}

interface SocialState {
  interactions: Record<string, PostInteraction>;
  storyInteractions: Record<string, StoryInteraction>;
  userPosts: UserPost[];
  userStories: UserStory[];
  isLoading: boolean;
  toggleLike: (postId: string) => void;
  addComment: (postId: string, text: string, parentId?: string) => void;
  toggleCommentLike: (postId: string, commentId: string) => void;
  sharePost: (post: Post) => Promise<void>;
  getComments: (postId: string) => SocialComment[];
  toggleStoryLike: (storyId: string) => void;
  addStoryComment: (storyId: string, text: string) => void;
  getStoryInteraction: (storyId: string) => StoryInteraction;
  updatePost: (postId: string, content: string) => void;
  deletePost: (postId: string) => void;
  createPost: (content: string, imageUrl?: string) => void;
  createStory: (imageUrl?: string, backgroundColor?: string, textContent?: string) => void;
  getAllPosts: () => Post[];
  getAllStories: () => Story[];
}


const buildDefaultState = (posts: Post[]) => {
  const base: Record<string, PostInteraction> = {};
  posts.forEach((post) => {
    base[post.id] = {
      likeCount: post.likes,
      commentCount: post.comments,
      shareCount: post.shares,
      isLiked: false,
      comments: [],
    };
  });
  console.log('[SocialContext] Built default state for', posts.length, 'posts');
  return base;
};

const defaultState = buildDefaultState([]);

const currentUser = {
  id: 'current-user',
  name: 'You',
  username: 'you',
  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop',
  isVerified: false,
  followersCount: 0,
};

export const [SocialProvider, useSocial] = createContextHook<SocialState>(() => {
  const queryClient = useQueryClient();
  const [interactions, setInteractions] = useState<Record<string, PostInteraction>>(defaultState);
  const [storyInteractions, setStoryInteractions] = useState<Record<string, StoryInteraction>>({});
  const [userPosts, setUserPosts] = useState<UserPost[]>([]);
  const [userStories, setUserStories] = useState<UserStory[]>([]);
  const [feedPosts, setFeedPosts] = useState<Post[]>([]);
  const [feedStories, setFeedStories] = useState<Story[]>([]);

  const postsQuery = useQuery({
    queryKey: ['supabasePosts'],
    queryFn: async ({ signal }) => {
      try {
        const dbPosts = await DatabaseService.fetchPosts({ signal });
        if (dbPosts && dbPosts.length > 0) {
          console.log('[SocialContext] Fetched posts from Supabase:', dbPosts.length);
          const users = await DatabaseService.fetchUsers({ signal });
          const userMap = new Map(users.map(u => [u.id, u]));
          
          return dbPosts.map(p => {
            const user = userMap.get(p.user_id);
            return {
              id: p.id,
              user: user ? {
                id: user.id,
                name: user.name,
                username: user.username,
                avatar: user.avatar,
                isVerified: user.is_verified,
                followersCount: user.followers_count,
                relationshipCategory: user.relationship_category,
              } : currentUser,
              content: p.content,
              imageUrl: p.image_url,
              timestamp: p.timestamp,
              likes: p.likes,
              comments: p.comments,
              shares: p.shares,
              isApparently: p.is_apparently,
              apparentlyTag: p.apparently_tag,
            } as Post;
          });
        }
        console.log('[SocialContext] No Supabase posts');
        return [];
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          console.log('[SocialContext] Posts fetch aborted (navigation)');
          return [];
        }
        console.error('[SocialContext] Error fetching posts from Supabase:', error);
        return [];
      }
    },
    staleTime: 1000 * 60 * 5,
  });

  const storiesQuery = useQuery({
    queryKey: ['supabaseStories'],
    queryFn: async ({ signal }) => {
      try {
        const dbStories = await DatabaseService.fetchStories({ signal });
        if (dbStories && dbStories.length > 0) {
          console.log('[SocialContext] Fetched stories from Supabase:', dbStories.length);
          const users = await DatabaseService.fetchUsers({ signal });
          const userMap = new Map(users.map(u => [u.id, u]));
          
          return dbStories.map(s => {
            const user = userMap.get(s.user_id);
            return {
              id: s.id,
              user: user ? {
                id: user.id,
                name: user.name,
                username: user.username,
                avatar: user.avatar,
                isVerified: user.is_verified,
                followersCount: user.followers_count,
              } : currentUser,
              imageUrl: s.image_url,
              timestamp: s.timestamp,
              viewed: s.viewed,
            } as Story;
          });
        }
        console.log('[SocialContext] No Supabase stories');
        return [];
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          console.log('[SocialContext] Stories fetch aborted (navigation)');
          return [];
        }
        console.error('[SocialContext] Error fetching stories from Supabase:', error);
        return [];
      }
    },
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (postsQuery.data) {
      setFeedPosts(postsQuery.data);
      setInteractions(buildDefaultState(postsQuery.data));
    }
  }, [postsQuery.data]);

  useEffect(() => {
    if (storiesQuery.data) {
      setFeedStories(storiesQuery.data);
    }
  }, [storiesQuery.data]);

  const query = useQuery({
    queryKey: ['socialState'],
    queryFn: async () => {
      console.log('[SocialContext] Social interaction state is in-memory only');
      return defaultState;
    },
  });

  const storyQuery = useQuery({
    queryKey: ['storyState'],
    queryFn: async () => {
      console.log('[SocialContext] Story interaction state is in-memory only');
      return {} as Record<string, StoryInteraction>;
    },
  });

  const userPostsQuery = useQuery({
    queryKey: ['userPosts'],
    queryFn: async () => {
      console.log('[SocialContext] User posts are loaded from Supabase posts table');
      return [] as UserPost[];
    },
  });

  const userStoriesQuery = useQuery({
    queryKey: ['userStories'],
    queryFn: async () => {
      console.log('[SocialContext] User stories are loaded from Supabase stories table');
      return [] as UserStory[];
    },
  });

  const { mutate: persistMutation } = useMutation({
    mutationFn: async (payload: Record<string, PostInteraction>) => {
      console.log('[SocialContext] persistMutation ignored (no local storage)', Object.keys(payload).length);
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['socialState'] });
    },
  });

  const { mutate: persistStoryMutation } = useMutation({
    mutationFn: async (payload: Record<string, StoryInteraction>) => {
      console.log('[SocialContext] persistStoryMutation ignored (no local storage)', Object.keys(payload).length);
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storyState'] });
    },
  });

  const { mutate: persistUserPostsMutation } = useMutation({
    mutationFn: async (payload: UserPost[]) => {
      console.log('[SocialContext] persistUserPostsMutation ignored (no local storage)', payload.length);
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userPosts'] });
    },
  });



  const createPostMutation = useMutation({
    mutationFn: async (post: { content: string; imageUrl?: string }) => {
      const userId = await DatabaseService.getCurrentUserId();
      if (userId) {
        const dbPost = await DatabaseService.createPost({
          user_id: userId,
          content: post.content,
          image_url: post.imageUrl,
          timestamp: 'Just now',
          likes: 0,
          comments: 0,
          shares: 0,
        });
        if (dbPost) {
          console.log('[SocialContext] Created post in Supabase:', dbPost.id);
          return dbPost;
        }
      }
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabasePosts'] });
    },
  });

  useEffect(() => {
    if (query.data) {
      setInteractions(prev => ({ ...prev, ...query.data }));
    }
  }, [query.data]);

  useEffect(() => {
    if (storyQuery.data) {
      setStoryInteractions(storyQuery.data);
    }
  }, [storyQuery.data]);

  useEffect(() => {
    if (userPostsQuery.data) {
      setUserPosts(userPostsQuery.data);
    }
  }, [userPostsQuery.data]);

  useEffect(() => {
    if (userStoriesQuery.data) {
      setUserStories(userStoriesQuery.data);
    }
  }, [userStoriesQuery.data]);

  const persistState = useCallback((next: Record<string, PostInteraction>) => {
    setInteractions(next);
    persistMutation(next);
  }, [persistMutation]);

  const persistStoryState = useCallback((next: Record<string, StoryInteraction>) => {
    setStoryInteractions(next);
    persistStoryMutation(next);
  }, [persistStoryMutation]);

  const getInteraction = useCallback((postId: string): PostInteraction => {
    if (interactions[postId]) {
      return interactions[postId];
    }
    return {
      likeCount: 0,
      commentCount: 0,
      shareCount: 0,
      isLiked: false,
      comments: [],
    };
  }, [interactions]);

  const ensureInteraction = useCallback((postId: string): PostInteraction => {
    if (interactions[postId]) {
      return interactions[postId];
    }
    const fallback: PostInteraction = {
      likeCount: 0,
      commentCount: 0,
      shareCount: 0,
      isLiked: false,
      comments: [],
    };
    const next = { ...interactions, [postId]: fallback };
    persistState(next);
    return fallback;
  }, [interactions, persistState]);

  const toggleLike = useCallback((postId: string) => {
    const current = ensureInteraction(postId);
    const updated: PostInteraction = {
      ...current,
      isLiked: !current.isLiked,
      likeCount: current.isLiked ? current.likeCount - 1 : current.likeCount + 1,
    };
    const next = { ...interactions, [postId]: updated };
    console.log('[SocialContext] Toggled like', { postId, isLiked: updated.isLiked, likeCount: updated.likeCount });
    persistState(next);
    // Persist to local API
    localApi.toggleLike(postId, 'u-dev').catch(() => {});
  }, [ensureInteraction, interactions, persistState]);

  const addComment = useCallback((postId: string, text: string, parentId?: string) => {
    if (!text.trim()) {
      return;
    }
    const current = ensureInteraction(postId);
    const newComment: SocialComment = {
      id: Date.now().toString(),
      authorId: 'current-user',
      authorName: 'You',
      authorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop',
      text,
      timestamp: 'Just now',
      likes: 0,
      isLiked: false,
      replies: [],
      parentId,
    };

    let updatedComments: SocialComment[];
    if (parentId) {
      updatedComments = current.comments.map(comment => {
        if (comment.id === parentId) {
          return {
            ...comment,
            replies: [newComment, ...comment.replies],
          };
        }
        return comment;
      });
    } else {
      updatedComments = [newComment, ...current.comments];
    }

    const updated: PostInteraction = {
      ...current,
      commentCount: current.commentCount + 1,
      comments: updatedComments,
    };
    const next = { ...interactions, [postId]: updated };
    console.log('[SocialContext] Added comment', { postId, commentCount: updated.commentCount, parentId });
    persistState(next);
    // Persist to local API
    localApi.addComment(postId, 'u-dev', text, parentId).catch(() => {});
  }, [ensureInteraction, interactions, persistState]);

  const toggleCommentLike = useCallback((postId: string, commentId: string) => {
    const current = ensureInteraction(postId);
    
    const updateCommentLike = (comments: SocialComment[]): SocialComment[] => {
      return comments.map(comment => {
        if (comment.id === commentId) {
          return {
            ...comment,
            isLiked: !comment.isLiked,
            likes: comment.isLiked ? comment.likes - 1 : comment.likes + 1,
          };
        }
        if (comment.replies.length > 0) {
          return {
            ...comment,
            replies: updateCommentLike(comment.replies),
          };
        }
        return comment;
      });
    };

    const updated: PostInteraction = {
      ...current,
      comments: updateCommentLike(current.comments),
    };
    const next = { ...interactions, [postId]: updated };
    console.log('[SocialContext] Toggled comment like', { postId, commentId });
    persistState(next);
  }, [ensureInteraction, interactions, persistState]);

  const sharePayload = useCallback(async (title: string, message: string) => {
    try {
      if (Platform.OS === 'web') {
        const hasWindow = typeof window !== 'undefined';
        type NavigatorLike = {
          share?: (data: { title?: string; text?: string }) => Promise<void>;
          clipboard?: {
            writeText?: (input: string) => Promise<void>;
          };
        };
        const maybeNavigator: NavigatorLike | undefined = hasWindow
          ? (window.navigator as unknown as NavigatorLike)
          : undefined;
        if (maybeNavigator?.share) {
          await maybeNavigator.share({ title, text: message });
          return true;
        }
        if (maybeNavigator?.clipboard?.writeText) {
          await maybeNavigator.clipboard.writeText(message);
          console.log('[SocialContext] Copied share message to clipboard');
          return true;
        }
        console.log('[SocialContext] Web share fallback unavailable');
        return false;
      }
      await Share.share({ title, message });
      return true;
    } catch (error) {
      console.log('[SocialContext] Share failed', error);
      return false;
    }
  }, []);

  const sharePost = useCallback(async (post: Post) => {
    const current = ensureInteraction(post.id);
    const succeeded = await sharePayload(
      `Post by ${post.user.name}`,
      `${post.content}\n\nShared via Apparently`
    );
    if (!succeeded) {
      return;
    }
    const updated: PostInteraction = {
      ...current,
      shareCount: current.shareCount + 1,
    };
    const next = { ...interactions, [post.id]: updated };
    console.log('[SocialContext] Shared post', { postId: post.id, shareCount: updated.shareCount });
    persistState(next);
  }, [ensureInteraction, interactions, persistState, sharePayload]);

  const getComments = useCallback((postId: string): SocialComment[] => {
    const local = getInteraction(postId).comments;
    // Try to load from API in background
    localApi.getComments(postId).then((apiComments: any[]) => {
      if (apiComments && apiComments.length > 0) {
        const mapped: SocialComment[] = apiComments.map((c: any) => ({
          id: c.id,
          authorId: c.author_id,
          authorName: c.author_name || 'Unknown',
          authorAvatar: c.author_avatar || '',
          text: c.text,
          timestamp: c.created_at ? timeAgo(new Date(c.created_at)) : c.timestamp || 'unknown',
          likes: c.likes || 0,
          isLiked: false,
          replies: (c.replies || []).map((r: any) => ({
            id: r.id,
            authorId: r.author_id,
            authorName: r.author_name || 'Unknown',
            authorAvatar: r.author_avatar || '',
            text: r.text,
            timestamp: r.created_at ? timeAgo(new Date(r.created_at)) : r.timestamp || 'unknown',
            likes: r.likes || 0,
            isLiked: false,
            replies: [],
            parentId: c.id,
          })),
        }));
        // Merge API comments into state
        const current = ensureInteraction(postId);
        const updated = { ...current, comments: mapped };
        const next = { ...interactions, [postId]: updated };
        setInteractions(next);
      }
    }).catch(() => {});
    return local;
  }, [getInteraction, ensureInteraction, interactions]);

  const ensureStoryInteraction = useCallback((storyId: string): StoryInteraction => {
    if (storyInteractions[storyId]) {
      return storyInteractions[storyId];
    }
    const fallback: StoryInteraction = {
      storyId,
      likes: Math.floor(Math.random() * 100) + 10,
      isLiked: false,
      comments: [],
    };
    return fallback;
  }, [storyInteractions]);

  const toggleStoryLike = useCallback((storyId: string) => {
    const current = ensureStoryInteraction(storyId);
    const updated: StoryInteraction = {
      ...current,
      isLiked: !current.isLiked,
      likes: current.isLiked ? current.likes - 1 : current.likes + 1,
    };
    const next = { ...storyInteractions, [storyId]: updated };
    console.log('[SocialContext] Toggled story like', { storyId, isLiked: updated.isLiked });
    persistStoryState(next);
  }, [ensureStoryInteraction, storyInteractions, persistStoryState]);

  const addStoryComment = useCallback((storyId: string, text: string) => {
    if (!text.trim()) return;
    const current = ensureStoryInteraction(storyId);
    const newComment: SocialComment = {
      id: Date.now().toString(),
      authorId: 'current-user',
      authorName: 'You',
      authorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop',
      text,
      timestamp: 'Just now',
      likes: 0,
      isLiked: false,
      replies: [],
    };
    const updated: StoryInteraction = {
      ...current,
      comments: [...current.comments, newComment],
    };
    const next = { ...storyInteractions, [storyId]: updated };
    console.log('[SocialContext] Added story comment', { storyId });
    persistStoryState(next);
  }, [ensureStoryInteraction, storyInteractions, persistStoryState]);

  const getStoryInteraction = useCallback((storyId: string): StoryInteraction => {
    return ensureStoryInteraction(storyId);
  }, [ensureStoryInteraction]);

  const updatePost = useCallback((postId: string, content: string) => {
    console.log('[SocialContext] Post update requested', { postId });
  }, []);

  const deletePost = useCallback((postId: string) => {
    const updated = { ...interactions };
    delete updated[postId];
    persistState(updated);
    
    const updatedUserPosts = userPosts.filter(p => p.id !== postId);
    setUserPosts(updatedUserPosts);
    persistUserPostsMutation(updatedUserPosts);
    
    DatabaseService.deletePost(postId).then(success => {
      if (success) {
        console.log('[SocialContext] Deleted post from Supabase:', postId);
        queryClient.invalidateQueries({ queryKey: ['supabasePosts'] });
      }
    });
    
    console.log('[SocialContext] Deleted post', { postId });
  }, [interactions, persistState, userPosts, persistUserPostsMutation, queryClient]);

  const createPostMutate = createPostMutation.mutate;

  const createPost = useCallback((content: string, imageUrl?: string) => {
    console.log('[SocialContext] Creating post...');
    createPostMutate({ content, imageUrl });
    queryClient.invalidateQueries({ queryKey: ['supabasePosts'] });
    // Save to local API
    localApi.createPost('u-dev', content, imageUrl).then((saved) => {
      console.log('[SocialContext] Post saved to local API:', saved?.id);
      // Refresh posts from API
      apiLoaded.current = false;
      localApi.getPosts().then((rawPosts: any[]) => {
        const mapped: Post[] = rawPosts.map((p: any) => ({
          id: p.id,
          user: {
            id: p.user_id,
            name: p.author_name || 'Unknown',
            username: p.author_username || 'unknown',
            avatar: p.author_avatar || '',
            isVerified: !!p.author_verified,
            followersCount: p.author_followers || 0,
            relationshipCategory: p.author_relationship,
          },
          content: p.content,
          imageUrl: p.image_url,
          timestamp: p.created_at ? timeAgo(new Date(p.created_at)) : 'Just now',
          likes: p.likes || 0,
          comments: p.comments || 0,
          shares: p.shares || 0,
        }));
        setApiPosts(mapped);
        setInteractions(buildDefaultState(mapped));
      }).catch(() => {});
    }).catch(err => {
      console.log('[SocialContext] Failed to save post to local API:', err.message);
    });
  }, [createPostMutate, queryClient]);

  const createStory = useCallback((imageUrl?: string, backgroundColor?: string, textContent?: string) => {
    console.log('[SocialContext] Creating story in Supabase...');
    DatabaseService.getCurrentUserId().then(async (userId) => {
      if (!userId) {
        console.log('[SocialContext] createStory blocked - no user session');
        return;
      }

      const payload = {
        user_id: userId,
        image_url: imageUrl ?? '',
        timestamp: 'Just now',
        viewed: false,
        background_color: backgroundColor,
        text_content: textContent,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      const res = await DatabaseService.createStory(payload as any);
      console.log('[SocialContext] Save response:', res);
      queryClient.invalidateQueries({ queryKey: ['supabaseStories'] });
    });
  }, [queryClient]);

  // ─── API-backed data loading ───
  const [apiPosts, setApiPosts] = useState<Post[] | null>(null);
  const apiLoaded = useRef(false);

  useEffect(() => {
    if (apiLoaded.current) return;
    apiLoaded.current = true;
    localApi.getPosts().then((rawPosts: any[]) => {
      const mapped: Post[] = rawPosts.map((p: any) => ({
        id: p.id,
        user: {
          id: p.user_id,
          name: p.author_name || 'Unknown',
          username: p.author_username || 'unknown',
          avatar: p.author_avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop',
          isVerified: !!p.author_verified,
          followersCount: p.author_followers || 0,
          relationshipCategory: p.author_relationship,
        },
        content: p.content,
        imageUrl: p.image_url,
        timestamp: p.created_at ? timeAgo(new Date(p.created_at)) : p.timestamp || 'unknown',
        likes: p.likes || 0,
        comments: p.comments || 0,
        shares: p.shares || 0,
        isApparently: !!p.is_apparently,
        apparentlyTag: p.apparently_tag,
      }));
      console.log('[SocialContext] Loaded', mapped.length, 'posts from local API');
      setApiPosts(mapped);
      setInteractions(buildDefaultState(mapped));
    }).catch(err => {
      console.log('[SocialContext] Local API unavailable, using mock data:', err.message);
    });
  }, []);

  const getAllPosts = useCallback((): Post[] => {
    if (apiPosts && apiPosts.length > 0) return [...apiPosts];
    if (feedPosts && feedPosts.length > 0) return [...feedPosts];
    return [...mockPosts];
  }, [apiPosts, feedPosts]);

  const getAllStories = useCallback((): Story[] => {
    return [...feedStories];
  }, [feedStories]);

  return {
    interactions,
    storyInteractions,
    userPosts,
    userStories,
    isLoading: query.isLoading || postsQuery.isLoading,
    toggleLike,
    addComment,
    toggleCommentLike,
    sharePost,
    getComments,
    toggleStoryLike,
    addStoryComment,
    getStoryInteraction,
    updatePost,
    deletePost,
    createPost,
    createStory,
    getAllPosts,
    getAllStories,
  };
});
