import createContextHook from '@nkzw/create-context-hook';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Share, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState, useRef } from 'react';

import { Post, Story } from '@/mocks/data';
import { DatabaseService } from '@/lib/database';
import * as localApi from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

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
  feedStories: Story[];
  isLoading: boolean;
  toggleLike: (postId: string, initialLikeCount?: number) => void;
  addComment: (postId: string, text: string, parentId?: string) => void;
  toggleCommentLike: (postId: string, commentId: string) => void;
  sharePost: (post: Post) => Promise<void>;
  getComments: (postId: string) => SocialComment[];
  toggleStoryLike: (storyId: string) => void;
  addStoryComment: (storyId: string, text: string) => void;
  getStoryInteraction: (storyId: string) => StoryInteraction;
  updatePost: (postId: string, content: string) => void;
  deletePost: (postId: string) => void;
  createPost: (content: string, imageUrl?: string, options?: { postKind?: 'post' | 'sell'; category?: string; mediaType?: 'image' | 'video' }) => void;
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
  logger.info('SocialContext', 'Built default state for', { length: posts.length });
  return base;
};

const defaultState = buildDefaultState([]);

const currentUser = {
  id: 'current-user',
  name: 'You',
  username: 'you',
  avatar: '',
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
  const [authUserId, setAuthUserId] = useState<string>('u-dev');

  // Fetch like statuses from Supabase for all loaded posts
  useEffect(() => {
    if (!authUserId || authUserId === 'u-dev') return;
    const postIds = Object.keys(interactions);
    if (postIds.length === 0) return;
    
    postIds.forEach(postId => {
      localApi.getLikeStatus(postId, authUserId).then(({ liked }) => {
        if (liked) {
          setInteractions((prev: Record<string, PostInteraction>) => {
            const current = prev[postId];
            if (!current) return { ...prev, [postId]: { likeCount: 1, commentCount: 0, shareCount: 0, isLiked: true, comments: [] } };
            if (current.isLiked) return prev;
            return { ...prev, [postId]: { ...current, isLiked: true, likeCount: Math.max(current.likeCount, 1) } };
          });
        }
      });
    });
  }, [authUserId]); // Run once when auth is ready

  // Get real auth user ID on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.id) {
        setAuthUserId(data.user.id);
        logger.info('SocialContext', 'Got auth user ID', { userId: data.user.id });
      }
    });
  }, []);

  const postsQuery = useQuery({
    queryKey: ['supabasePosts'],
    queryFn: async ({ signal }) => {
      try {
        const dbPosts = await DatabaseService.fetchPosts({ signal });
        if (dbPosts && dbPosts.length > 0) {
          logger.info('SocialContext', 'Fetched posts from Supabase', { length: dbPosts.length });
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
        logger.info('SocialContext', 'No Supabase posts');
        return [];
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          logger.info('SocialContext', 'Posts fetch aborted (navigation)');
          return [];
        }
        logger.error('SocialContext', 'Error fetching posts from Supabase', { error });
        return [];
      }
    },
    staleTime: 1000 * 30,
  });

  const storiesQuery = useQuery({
    queryKey: ['supabaseStories'],
    queryFn: async ({ signal }) => {
      try {
        const dbStories = await DatabaseService.fetchStories({ signal });
        if (dbStories && dbStories.length > 0) {
          logger.info('SocialContext', 'Fetched stories from Supabase', { length: dbStories.length });
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
        logger.info('SocialContext', 'No Supabase stories');
        return [];
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          logger.info('SocialContext', 'Stories fetch aborted (navigation)');
          return [];
        }
        logger.error('SocialContext', 'Error fetching stories from Supabase', { error });
        return [];
      }
    },
    staleTime: 1000 * 30,
  });

  useEffect(() => {
    if (postsQuery.data) {
      setFeedPosts(postsQuery.data);
      // Build defaults from DB, then overlay any persisted likes/stats from AsyncStorage
      const defaults = buildDefaultState(postsQuery.data);
      AsyncStorage.getItem('apparently_social_interactions').then((persisted) => {
        if (persisted) {
          try {
            const saved: Record<string, PostInteraction> = JSON.parse(persisted);
            // Merge: persisted values win over defaults
            const merged: Record<string, PostInteraction> = {};
            for (const id of new Set([...Object.keys(defaults), ...Object.keys(saved)])) {
              const d = defaults[id] || { likeCount: 0, commentCount: 0, shareCount: 0, isLiked: false, comments: [] };
              const s = saved[id] || { likeCount: 0, commentCount: 0, shareCount: 0, isLiked: false, comments: [] };
              merged[id] = {
                ...d,
                likeCount: s.likeCount !== undefined ? s.likeCount : d.likeCount,
                isLiked: s.isLiked !== undefined ? s.isLiked : d.isLiked,
                commentCount: s.commentCount !== undefined ? s.commentCount : d.commentCount,
                shareCount: s.shareCount !== undefined ? s.shareCount : d.shareCount,
                comments: s.comments || d.comments,
              };
            }
            setInteractions(merged);
            logger.info('SocialContext', 'Merged persisted interactions', { merged: Object.keys(merged).length });
          } catch {
            setInteractions(defaults);
          }
        } else {
          setInteractions(defaults);
        }
      }).catch(() => {
        setInteractions(defaults);
      });
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
      logger.info('SocialContext', 'Social interaction state is in-memory only');
      return defaultState;
    },
  });

  const storyQuery = useQuery({
    queryKey: ['storyState'],
    queryFn: async () => {
      logger.info('SocialContext', 'Story interaction state is in-memory only');
      return {} as Record<string, StoryInteraction>;
    },
  });

  const userPostsQuery = useQuery({
    queryKey: ['userPosts'],
    queryFn: async () => {
      logger.info('SocialContext', 'User posts are loaded from Supabase posts table');
      return [] as UserPost[];
    },
  });

  const userStoriesQuery = useQuery({
    queryKey: ['userStories'],
    queryFn: async () => {
      logger.info('SocialContext', 'User stories are loaded from Supabase stories table');
      return [] as UserStory[];
    },
  });

  const { mutate: persistMutation } = useMutation({
    mutationFn: async (payload: Record<string, PostInteraction>) => {
      await AsyncStorage.setItem('apparently_social_interactions', JSON.stringify(payload));
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['socialState'] });
    },
  });

  const { mutate: persistStoryMutation } = useMutation({
    mutationFn: async (payload: Record<string, StoryInteraction>) => {
      await AsyncStorage.setItem('apparently_story_interactions', JSON.stringify(payload));
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storyState'] });
    },
  });

  const { mutate: persistUserPostsMutation } = useMutation({
    mutationFn: async (payload: UserPost[]) => {
      await AsyncStorage.setItem('apparently_user_posts', JSON.stringify(payload));
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
          logger.info('SocialContext', 'Created post in Supabase', { id: dbPost.id });
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

  const ensureInteraction = useCallback((postId: string, initialLikeCount?: number): PostInteraction => {
    if (interactions[postId]) {
      return interactions[postId];
    }
    const fallback: PostInteraction = {
      likeCount: initialLikeCount ?? 0,
      commentCount: 0,
      shareCount: 0,
      isLiked: false,
      comments: [],
    };
    const next = { ...interactions, [postId]: fallback };
    persistState(next);
    return fallback;
  }, [interactions, persistState]);

  const toggleLike = useCallback((postId: string, initialLikeCount?: number) => {
    const current = ensureInteraction(postId, initialLikeCount);
    const updated: PostInteraction = {
      ...current,
      isLiked: !current.isLiked,
      likeCount: current.isLiked ? current.likeCount - 1 : current.likeCount + 1,
    };
    const next = { ...interactions, [postId]: updated };
    logger.info('SocialContext', 'Toggled like', { postId, isLiked: updated.isLiked, likeCount: updated.likeCount });
    persistState(next);
    localApi.toggleLike(postId, authUserId).catch(() => {});
    // Send notification if liking
    if (!current.isLiked && authUserId && authUserId !== 'u-dev') {
      supabase.from('posts').select('user_id').eq('id', postId).single().then(({ data: post }: any) => {
        if (post?.user_id && post.user_id !== authUserId) {
          supabase.from('notifications').insert({
            recipient_id: post.user_id, sender_id: authUserId, type: 'like',
            content: JSON.stringify({ post_id: postId, message: 'liked your post' }),
            read: false, created_at: new Date().toISOString(),
          });
        }
      });
    }
  }, [ensureInteraction, interactions, persistState, authUserId]);

  const addComment = useCallback((postId: string, text: string, parentId?: string) => {
    if (!text.trim()) {
      return;
    }
    const current = ensureInteraction(postId);
    const newComment: SocialComment = {
      id: Date.now().toString(),
      authorId: authUserId,
      authorName: 'You',
      authorAvatar: '',
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
    logger.info('SocialContext', 'Added comment', { postId, commentCount: updated.commentCount, parentId });
    persistState(next);
    localApi.addComment(postId, authUserId, text, parentId).catch(() => {});
    // Send notification to post author
    if (authUserId && authUserId !== 'u-dev') {
      supabase.from('posts').select('user_id').eq('id', postId).single().then(({ data: post }: any) => {
        if (post?.user_id && post.user_id !== authUserId) {
          supabase.from('notifications').insert({
            recipient_id: post.user_id, sender_id: authUserId, type: 'comment',
            content: JSON.stringify({ post_id: postId, message: 'commented: "' + text.slice(0, 60) + '"' }),
            read: false, created_at: new Date().toISOString(),
          });
        }
      });
    }
  }, [ensureInteraction, interactions, persistState, authUserId]);

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
    logger.info('SocialContext', 'Toggled comment like', { postId, commentId });
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
          logger.info('SocialContext', 'Copied share message to clipboard');
          return true;
        }
        logger.info('SocialContext', 'Web share fallback unavailable');
        return false;
      }
      await Share.share({ title, message });
      return true;
    } catch (error) {
      logger.info('SocialContext', 'Share failed', { error });
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
    logger.info('SocialContext', 'Shared post', { postId: post.id, shareCount: updated.shareCount });
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
    });
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
    logger.info('SocialContext', 'Toggled story like', { storyId, isLiked: updated.isLiked });
    persistStoryState(next);
  }, [ensureStoryInteraction, storyInteractions, persistStoryState]);

  const addStoryComment = useCallback((storyId: string, text: string) => {
    if (!text.trim()) return;
    const current = ensureStoryInteraction(storyId);
    const newComment: SocialComment = {
      id: Date.now().toString(),
      authorId: authUserId,
      authorName: 'You',
      authorAvatar: '',
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
    logger.info('SocialContext', 'Added story comment', { storyId });
    persistStoryState(next);
  }, [ensureStoryInteraction, storyInteractions, persistStoryState]);

  const getStoryInteraction = useCallback((storyId: string): StoryInteraction => {
    return ensureStoryInteraction(storyId);
  }, [ensureStoryInteraction]);

  const updatePost = useCallback((postId: string, content: string) => {
    logger.info('SocialContext', 'Post update requested', { postId });
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
        logger.info('SocialContext', 'Deleted post from Supabase', { postId });
        queryClient.invalidateQueries({ queryKey: ['supabasePosts'] });
      }
    });
    
    logger.info('SocialContext', 'Deleted post', { postId });
  }, [interactions, persistState, userPosts, persistUserPostsMutation, queryClient]);

  const createPostMutate = createPostMutation.mutate;

  const createPost = useCallback((content: string, imageUrl?: string, options?: { postKind?: 'post' | 'sell'; category?: string; mediaType?: 'image' | 'video' }) => {
    const isVideo = options?.mediaType === 'video';
    const videoUrl = isVideo ? imageUrl : undefined;
    const finalImageUrl = isVideo ? undefined : imageUrl;
    logger.info('SocialContext', 'Creating post...', { hasVideo: !!videoUrl, hasImage: !!finalImageUrl });
    createPostMutate({ content, imageUrl: finalImageUrl });
    queryClient.invalidateQueries({ queryKey: ['supabasePosts'] });
    localApi.createPost(authUserId, content, imageUrl, options).then((saved) => {
      logger.info('SocialContext', 'Post saved to local API', { id: saved?.id });
      // When it's a sell post, also create a marketplace product
      if (options?.postKind === 'sell') {
        localApi.createProduct({
          seller_id: authUserId,
          seller_name: 'You',
          seller_avatar: '',
          seller_username: 'you',
          title: content.slice(0, 100),
          description: content,
          price: 0,
          accepts_swap: true,
          condition: 'good',
          category: options?.category || 'General',
          images: imageUrl ? [{ id: '1', uri: imageUrl }] : [],
          location: 'Local',
        }).then(() => {
          logger.info('SocialContext', 'Sell post also created as marketplace product');
        }).catch((e) => {
          logger.info('SocialContext', 'Marketplace product create failed', { message: e?.message });
        });
      }
      apiLoaded.current = false;
      localApi.getPosts().then((rawPosts: any[]) => {
        const mapped: Post[] = rawPosts.map((p: any) => {
          const joinedUser = p.user;
          return {
            id: p.id,
            user: {
              id: p.user_id,
              name: joinedUser?.name || p.author_name || 'Unknown',
              username: joinedUser?.username || p.author_username || 'unknown',
              avatar: joinedUser?.avatar || p.author_avatar || '',
              isVerified: !!(joinedUser?.is_verified ?? p.author_verified),
              followersCount: joinedUser?.followers_count ?? p.author_followers ?? 0,
              relationshipCategory: joinedUser?.relationship_category || p.author_relationship,
            },
            content: p.content,
            imageUrl: p.image_url,
            videoUrl: p.video_url,
            mediaType: p.media_type as 'image' | 'video' | undefined,
            timestamp: p.created_at ? timeAgo(new Date(p.created_at)) : 'Just now',
            likes: p.likes || 0,
            comments: p.comments || 0,
            shares: p.shares || 0,
            category: p.category || undefined,
            postKind: p.post_kind || 'post',
            renderFullImage: Boolean(p.image_url?.startsWith?.('data:') || p.image_url?.startsWith?.('file:')),
          };
        });
        setApiPosts(mapped);
        setInteractions(buildDefaultState(mapped));
      });
    }).catch(err => {
      logger.info('SocialContext', 'Failed to save post to local API', { message: err.message });
    });
  }, [createPostMutate, queryClient, authUserId]);

  const createStory = useCallback((imageUrl?: string, backgroundColor?: string, textContent?: string) => {
    logger.info('SocialContext', 'Creating story in Supabase...');
    DatabaseService.getCurrentUserId().then(async (userId) => {
      if (!userId) {
        logger.info('SocialContext', 'createStory blocked - no user session');
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
      logger.info('SocialContext', 'Save response', { res });
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
      const mapped: Post[] = rawPosts.map((p: any) => {
        const joinedUser = p.user;
        return {
          id: p.id,
          user: {
            id: p.user_id,
            name: joinedUser?.name || p.author_name || 'Unknown',
            username: joinedUser?.username || p.author_username || 'unknown',
            avatar: joinedUser?.avatar || p.author_avatar || '',
            isVerified: !!(joinedUser?.is_verified ?? p.author_verified),
            followersCount: joinedUser?.followers_count ?? p.author_followers ?? 0,
            relationshipCategory: joinedUser?.relationship_category || p.author_relationship,
          },
          content: p.content,
          imageUrl: p.image_url,
          timestamp: p.created_at ? timeAgo(new Date(p.created_at)) : p.timestamp || 'unknown',
          likes: p.likes || 0,
          comments: p.comments || 0,
          shares: p.shares || 0,
          category: p.category || undefined,
          postKind: p.post_kind || 'post',
          renderFullImage: Boolean(p.image_url?.startsWith?.('data:') || p.image_url?.startsWith?.('file:')),
          isApparently: !!p.is_apparently,
          apparentlyTag: p.apparently_tag,
        };
      });
      logger.info('SocialContext', 'Loaded', { length: mapped.length });
      setApiPosts(mapped);
      setInteractions(buildDefaultState(mapped));
    }).catch(err => {
      logger.info('SocialContext', 'Local API unavailable, using mock data', { message: err.message });
    });
  }, []);

  const getAllPosts = useCallback((): Post[] => {
    if (apiPosts && apiPosts.length > 0) return [...apiPosts];
    if (feedPosts && feedPosts.length > 0) return [...feedPosts];
    return [];
  }, [apiPosts, feedPosts]);

  const getAllStories = useCallback((): Story[] => {
    return [...feedStories];
  }, [feedStories]);

  return {
    interactions,
    storyInteractions,
    userPosts,
    userStories,
    feedStories,
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
