import { Heart, MessageCircle, MoreHorizontal, BadgeCheck, Zap, Send, X, AtSign, Bookmark, EyeOff, Flag, UserMinus, Link2, Bell, BellOff, Star, CornerDownRight, Copy, MessageSquare, Users, Check, Trash2 } from 'lucide-react-native';
import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform, TextInput, Modal, KeyboardAvoidingView, ScrollView, Animated, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import { useTheme } from '@/contexts/ThemeContext';
import { Post, mockUsers } from '@/mocks/data';
import { useSocial, SocialComment } from '@/contexts/SocialContext';
import { useMessaging } from '@/contexts/MessagingContext';
import PhotoViewer from '@/components/PhotoViewer';

interface Props {
  post: Post;
  onPress?: () => void;
}

const PostCard = React.memo(function PostCard({ post, onPress }: Props) {
  const router = useRouter();
  const { colors } = useTheme();
  const { interactions, toggleLike, addComment, toggleCommentLike, sharePost, getComments, deletePost } = useSocial();
  const { sharePostToUsers } = useMessaging();
  const interaction = interactions[post.id] ?? {
    likeCount: post.likes,
    commentCount: post.comments,
    shareCount: post.shares,
    isLiked: false,
    comments: [],
  };
  const [isCommentModalVisible, setIsCommentModalVisible] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [showLikeAnimation, setShowLikeAnimation] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isNotificationsOn, setIsNotificationsOn] = useState(false);
  const [isInterested, setIsInterested] = useState(false);
  const [replyingTo, setReplyingTo] = useState<SocialComment | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [shareMessage, setShareMessage] = useState('');
  const [shareSent, setShareSent] = useState(false);
  const comments: SocialComment[] = getComments(post.id);
  
  const lastTap = useRef<number>(0);
  const likeAnimationScale = useRef(new Animated.Value(0)).current;
  const likeAnimationOpacity = useRef(new Animated.Value(0)).current;
  const commentInputRef = useRef<TextInput>(null);

  const handleImageTap = () => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTap.current;
    
    if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
      if (!interaction.isLiked) {
        handleLike();
      }
      triggerLikeAnimation();
      lastTap.current = 0;
    } else {
      lastTap.current = now;
      setTimeout(() => {
        if (lastTap.current !== 0 && Date.now() - lastTap.current >= 300) {
          setShowPhotoViewer(true);
          lastTap.current = 0;
        }
      }, 310);
    }
  };

  const triggerLikeAnimation = () => {
    setShowLikeAnimation(true);
    likeAnimationScale.setValue(0);
    likeAnimationOpacity.setValue(1);
    
    Animated.sequence([
      Animated.spring(likeAnimationScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 6,
      }),
      Animated.timing(likeAnimationOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowLikeAnimation(false);
    });
  };

  const handleLike = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    toggleLike(post.id);
  };

  const handleComment = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setIsCommentModalVisible(true);
  };

  const handlePostComment = () => {
    if (commentText.trim()) {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      addComment(post.id, commentText, replyingTo?.id);
      setCommentText('');
      setShowMentionSuggestions(false);
      setReplyingTo(null);
    }
  };

  const handleCommentTextChange = (text: string) => {
    setCommentText(text);

    const lastWord = text.split(/\s/).pop() || '';
    if (lastWord.startsWith('@') && lastWord.length > 1) {
      const query = lastWord.substring(1);
      setMentionQuery(query);
      setShowMentionSuggestions(true);
    } else {
      setShowMentionSuggestions(false);
      setMentionQuery('');
    }
  };

  const handleMentionSelect = (username: string) => {
    const words = commentText.split(/\s/);
    words[words.length - 1] = `@${username} `;
    setCommentText(words.join(' '));
    setShowMentionSuggestions(false);
    setMentionQuery('');
  };

  const filteredUsers = mockUsers.filter(user =>
    user.username.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  const handleShare = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setShowShareModal(true);
  };

  const handleShareToFriends = () => {
    if (selectedFriends.length === 0) {
      Alert.alert('Select Friends', 'Please select at least one friend to share with.');
      return;
    }
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setShareSent(true);
    
    sharePostToUsers(post, selectedFriends, shareMessage.trim() || undefined);
    sharePost(post);
    
    console.log('[PostCard] Shared post to friends via messaging', { postId: post.id, friendIds: selectedFriends });
    
    setTimeout(() => {
      setShowShareModal(false);
      setSelectedFriends([]);
      setShareMessage('');
      setShareSent(false);
    }, 1500);
  };

  const handleShareExternal = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setShowShareModal(false);
    await sharePost(post);
  };

  const handleCopyShareLink = () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    Alert.alert('Link Copied!', 'Post link has been copied to your clipboard.');
    setShowShareModal(false);
  };

  const toggleFriendSelection = (friendId: string) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    setSelectedFriends(prev => 
      prev.includes(friendId) 
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    );
  };

  const handleProfilePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push(`/user/${post.user.id}` as any);
  };

  const handleMorePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setShowOptionsModal(true);
  };

  const handleSavePost = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setIsSaved(!isSaved);
    setShowOptionsModal(false);
  };

  const handleShowInterest = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setIsInterested(!isInterested);
    setShowOptionsModal(false);
    Alert.alert(
      isInterested ? 'Interest Removed' : 'Interested!',
      isInterested 
        ? 'You will see fewer posts like this.' 
        : 'You will see more posts like this in your feed.'
    );
  };

  const handleHidePost = () => {
    setShowOptionsModal(false);
    Alert.alert(
      'Post Hidden',
      'You won\'t see this post anymore. You can undo this in your settings.',
      [
        { text: 'Undo', style: 'cancel' },
        { text: 'OK' }
      ]
    );
  };

  const handleReportPost = () => {
    setShowOptionsModal(false);
    Alert.alert(
      'Report Post',
      'Why are you reporting this post?',
      [
        { text: 'Spam', onPress: () => confirmReport('Spam') },
        { text: 'Inappropriate Content', onPress: () => confirmReport('Inappropriate') },
        { text: 'Harassment', onPress: () => confirmReport('Harassment') },
        { text: 'False Information', onPress: () => confirmReport('False Information') },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const confirmReport = (reason: string) => {
    Alert.alert(
      'Report Submitted',
      `Thank you for your report. We'll review this post for ${reason.toLowerCase()}.`
    );
  };

  const handleUnfollowUser = () => {
    setShowOptionsModal(false);
    Alert.alert(
      `Unfollow @${post.user.username}?`,
      'You will no longer see their posts in your feed.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Unfollow', 
          style: 'destructive',
          onPress: () => {
            Alert.alert('Unfollowed', `You unfollowed @${post.user.username}`);
          }
        }
      ]
    );
  };

  const handleCopyLink = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setShowOptionsModal(false);
    Alert.alert('Link Copied', 'Post link has been copied to your clipboard.');
  };

  const handleToggleNotifications = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setIsNotificationsOn(!isNotificationsOn);
    setShowOptionsModal(false);
    Alert.alert(
      isNotificationsOn ? 'Notifications Off' : 'Notifications On',
      isNotificationsOn 
        ? `You won't receive notifications about this post.`
        : `You'll be notified about new comments and activity.`
    );
  };

  const handleDeletePost = () => {
    setShowOptionsModal(false);
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            deletePost(post.id);
            console.log('[PostCard] Deleted post', post.id);
          }
        }
      ]
    );
  };

  const isUserPost = 'isUserCreated' in post && (post as any).isUserCreated === true;

  const handleCommentLike = (commentId: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    toggleCommentLike(post.id, commentId);
  };

  const handleReplyToComment = (comment: SocialComment) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    setReplyingTo(comment);
    setCommentText(`@${comment.authorName.replace(/\s/g, '')} `);
    commentInputRef.current?.focus();
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
    setCommentText('');
  };

  const formatCount = (count: number) => {
    if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
    if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
    return count.toString();
  };

  const renderComment = (comment: SocialComment, isReply: boolean = false) => {
    const textWithMentions = comment.text.split(/(@\w+)/g).map((part, i) => {
      if (part.startsWith('@')) {
        return (
          <Text key={i} style={styles.mentionTextInComment}>
            {part}
          </Text>
        );
      }
      return part;
    });

    return (
      <View key={comment.id} style={[styles.commentItem, isReply && styles.replyItem]}>
        {isReply && (
          <CornerDownRight size={16} color={colors.textTertiary} style={styles.replyIcon} />
        )}
        <Image
          source={{ uri: comment.authorAvatar }}
          style={[styles.commentAvatar, isReply && styles.replyAvatar]}
        />
        <View style={styles.commentContent}>
          <View style={styles.commentHeader}>
            <Text style={[styles.commentUserName, { color: colors.text }]}>{comment.authorName}</Text>
            <Text style={[styles.commentTimestamp, { color: colors.textTertiary }]}>{comment.timestamp}</Text>
          </View>
          <Text style={[styles.commentText, { color: colors.textSecondary }]}>{textWithMentions}</Text>
          <View style={styles.commentActions}>
            <TouchableOpacity 
              style={styles.commentActionButton}
              onPress={() => handleCommentLike(comment.id)}
            >
              <Heart 
                size={14} 
                color={comment.isLiked ? colors.live : colors.textTertiary}
                fill={comment.isLiked ? colors.live : 'none'}
              />
              <Text style={[styles.commentActionText, { color: colors.textTertiary }, comment.isLiked && styles.commentActionTextLiked]}>
                {comment.likes > 0 ? formatCount(comment.likes) : 'Like'}
              </Text>
            </TouchableOpacity>
            {!isReply && (
              <TouchableOpacity 
                style={styles.commentActionButton}
                onPress={() => handleReplyToComment(comment)}
              >
                <MessageCircle size={14} color={colors.textTertiary} />
                <Text style={[styles.commentActionText, { color: colors.textTertiary }]}>Reply</Text>
              </TouchableOpacity>
            )}
          </View>
          {comment.replies && comment.replies.length > 0 && (
            <View style={styles.repliesContainer}>
              {comment.replies.map((reply) => renderComment(reply, true))}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <>
      <View style={styles.postWrapper}>
        <TouchableOpacity
          style={styles.container}
          onPress={onPress}
          activeOpacity={0.7}
          testID={`post-${post.id}-card`}
        >
      {post.isApparently && post.apparentlyTag && (
        <View style={styles.apparentlyBanner}>
          <Zap size={14} color={colors.accent} />
          <Text style={[styles.apparentlyText, { color: colors.accent }]}>
            Apparently • {post.apparentlyTag}
          </Text>
        </View>
      )}

      <View style={styles.headerWrapper}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.userInfo} 
            testID={`post-${post.id}-author`}
            onPress={handleProfilePress}
          >
            <Image source={{ uri: post.user.avatar }} style={styles.avatar} />
            {post.user.isLive && <View style={styles.liveBadge} />}
            <View style={styles.userText}>
              <View style={styles.nameRow}>
                <Text style={[styles.userName, { color: colors.text }]}>{post.user.name}</Text>
                {post.user.isVerified && (
                  <BadgeCheck size={16} color={colors.accent} />
                )}
              </View>
              <Text style={[styles.userHandle, { color: colors.textTertiary }]}>@{post.user.username} • {post.timestamp}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.moreButton}
            onPress={handleMorePress}
            testID={`post-${post.id}-more`}
          >
            <MoreHorizontal size={20} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>
        <View style={styles.usernameSeparator} />
      </View>

      <Text style={[styles.content, { color: colors.text }]}>{post.content}</Text>

      {post.imageUrl && (
        <TouchableOpacity 
          onPress={handleImageTap}
          activeOpacity={1}
          style={styles.imageContainer}
        >
          <Image
            source={{ uri: post.imageUrl }}
            style={styles.postImage}
            resizeMode="cover"
          />
          {showLikeAnimation && (
            <Animated.View
              style={[
                styles.likeAnimation,
                {
                  transform: [{ scale: likeAnimationScale }],
                  opacity: likeAnimationOpacity,
                },
              ]}
            >
              <Heart size={80} color={colors.live} fill={colors.live} />
            </Animated.View>
          )}
        </TouchableOpacity>
      )}

      <View style={styles.actions}>
        <View style={styles.actionsLeft}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleLike}
            activeOpacity={0.7}
            testID={`post-${post.id}-like`}
          >
            <Heart
              size={22}
              color={interaction.isLiked ? colors.live : colors.text}
              fill={interaction.isLiked ? colors.live : 'none'}
            />
            <Text style={[styles.actionText, { color: colors.text }, interaction.isLiked && { color: colors.live }]}>
              {formatCount(interaction.likeCount)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleComment}
            activeOpacity={0.7}
            testID={`post-${post.id}-comment`}
          >
            <MessageCircle size={22} color={colors.text} />
            <Text style={[styles.actionText, { color: colors.text }]}>{formatCount(interaction.commentCount)}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleShare}
            activeOpacity={0.7}
            testID={`post-${post.id}-share`}
          >
            <Send size={22} color={colors.text} />
            <Text style={[styles.actionText, { color: colors.text }]}>{formatCount(interaction.shareCount)}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSavePost}
          activeOpacity={0.7}
          testID={`post-${post.id}-save`}
        >
          <Bookmark
            size={22}
            color={isSaved ? colors.text : colors.text}
            fill={isSaved ? colors.text : 'none'}
          />
        </TouchableOpacity>
      </View>
        </TouchableOpacity>
        <View style={[styles.postSeparator, { backgroundColor: colors.border }]} />
      </View>

    <Modal
      visible={isCommentModalVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => {
        setIsCommentModalVisible(false);
        setReplyingTo(null);
      }}
    >
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => {
            setIsCommentModalVisible(false);
            setReplyingTo(null);
          }}
        />
        <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Comments ({interaction.commentCount})</Text>
            <TouchableOpacity
              onPress={() => {
                setIsCommentModalVisible(false);
                setReplyingTo(null);
              }}
              style={styles.closeButton}
            >
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.commentsScrollView} showsVerticalScrollIndicator={false}>
            {comments.length === 0 ? (
              <View style={styles.emptyComments}>
                <MessageCircle size={48} color={colors.textTertiary} />
                <Text style={[styles.emptyCommentsText, { color: colors.textSecondary }]}>No comments yet</Text>
                <Text style={[styles.emptyCommentsSubtext, { color: colors.textTertiary }]}>Be the first to comment!</Text>
              </View>
            ) : (
              comments.map((comment) => renderComment(comment))
            )}
          </ScrollView>

          {showMentionSuggestions && filteredUsers.length > 0 && (
            <View style={[styles.mentionSuggestionsContainer, { backgroundColor: colors.backgroundTertiary, borderTopColor: colors.border }]}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.mentionSuggestionsContent}
              >
                {filteredUsers.map((user) => (
                  <TouchableOpacity
                    key={user.id}
                    style={[styles.mentionSuggestion, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => handleMentionSelect(user.username)}
                    testID={`mention-${user.username}`}
                  >
                    <Image source={{ uri: user.avatar }} style={styles.mentionAvatar} />
                    <Text style={[styles.mentionUsername, { color: colors.text }]}>@{user.username}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {replyingTo && (
            <View style={[styles.replyingToContainer, { backgroundColor: colors.backgroundTertiary, borderTopColor: colors.border }]}>
              <Text style={[styles.replyingToText, { color: colors.textSecondary }]}>
                Replying to <Text style={styles.replyingToName}>{replyingTo.authorName}</Text>
              </Text>
              <TouchableOpacity onPress={handleCancelReply}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          <View style={[styles.commentInputContainer, { borderTopColor: colors.border }]}>
            <Image
              source={{ uri: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop' }}
              style={styles.inputAvatar}
            />
            <View style={[styles.inputWrapper, { backgroundColor: colors.backgroundTertiary, borderColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.mentionButton, { backgroundColor: colors.backgroundTertiary }]}
                onPress={() => {
                  setCommentText(prev => prev + '@');
                  setShowMentionSuggestions(true);
                }}
              >
                <AtSign size={16} color={colors.textSecondary} />
              </TouchableOpacity>
              <TextInput
                ref={commentInputRef}
                style={[styles.commentInput, { color: colors.text, backgroundColor: colors.backgroundTertiary, borderColor: colors.border }]}
                placeholder={replyingTo ? `Reply to ${replyingTo.authorName}...` : "Add a comment..."}
                placeholderTextColor={colors.textTertiary}
                value={commentText}
                onChangeText={handleCommentTextChange}
                multiline
                maxLength={300}
              />
            </View>
            <TouchableOpacity
              style={[styles.sendButton, !commentText.trim() && styles.sendButtonDisabled]}
              onPress={handlePostComment}
              disabled={!commentText.trim()}
              testID={`post-${post.id}-send-comment`}
            >
              <Send size={20} color={commentText.trim() ? colors.accent : colors.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>

    {post.imageUrl && (
      <PhotoViewer
        visible={showPhotoViewer}
        images={[post.imageUrl]}
        onClose={() => setShowPhotoViewer(false)}
      />
    )}

    <Modal
      visible={showShareModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => {
        setShowShareModal(false);
        setSelectedFriends([]);
        setShareMessage('');
        setShareSent(false);
      }}
    >
      <KeyboardAvoidingView
        style={styles.shareModalBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <TouchableOpacity
          style={styles.shareModalBackdropInner}
          activeOpacity={1}
          onPress={() => {
            setShowShareModal(false);
            setSelectedFriends([]);
            setShareMessage('');
            setShareSent(false);
          }}
        />
        <View style={[styles.shareModalContent, { backgroundColor: colors.background }]}>
          <View style={[styles.shareModalHandle, { backgroundColor: colors.textTertiary }]} />
          
          {shareSent ? (
            <View style={styles.shareSentContainer}>
              <View style={[styles.shareSentIcon, { backgroundColor: '#2ED573' }]}>
                <Check size={32} color="#FFFFFF" />
              </View>
              <Text style={[styles.shareSentText, { color: colors.text }]}>Sent!</Text>
              <Text style={[styles.shareSentSubtext, { color: colors.textSecondary }]}>
                Shared with {selectedFriends.length} friend{selectedFriends.length !== 1 ? 's' : ''}
              </Text>
            </View>
          ) : (
            <>
              <View style={[styles.shareModalHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.shareModalTitle, { color: colors.text }]}>Share Post</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowShareModal(false);
                    setSelectedFriends([]);
                    setShareMessage('');
                  }}
                  style={styles.shareCloseButton}
                >
                  <X size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.shareQuickActions}>
                <TouchableOpacity 
                  style={[styles.shareQuickAction, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={handleShareExternal}
                >
                  <View style={[styles.shareQuickActionIcon, { backgroundColor: 'rgba(0, 149, 246, 0.15)' }]}>
                    <Send size={20} color="#0095F6" />
                  </View>
                  <Text style={[styles.shareQuickActionText, { color: colors.text }]}>Share</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.shareQuickAction, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={handleCopyShareLink}
                >
                  <View style={[styles.shareQuickActionIcon, { backgroundColor: 'rgba(123, 97, 255, 0.15)' }]}>
                    <Copy size={20} color="#7B61FF" />
                  </View>
                  <Text style={[styles.shareQuickActionText, { color: colors.text }]}>Copy Link</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.shareQuickAction, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => {
                    setShowShareModal(false);
                    handleComment();
                  }}
                >
                  <View style={[styles.shareQuickActionIcon, { backgroundColor: 'rgba(255, 179, 0, 0.15)' }]}>
                    <MessageSquare size={20} color="#FFB300" />
                  </View>
                  <Text style={[styles.shareQuickActionText, { color: colors.text }]}>Quote</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.shareFriendsSection, { borderTopColor: colors.border }]}>
                <View style={styles.shareFriendsHeader}>
                  <Users size={18} color={colors.textSecondary} />
                  <Text style={[styles.shareFriendsTitle, { color: colors.text }]}>Send to Friends</Text>
                </View>
                
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.shareFriendsList}
                >
                  {mockUsers.map((user) => (
                    <TouchableOpacity
                      key={user.id}
                      style={[
                        styles.shareFriendItem,
                        selectedFriends.includes(user.id) && styles.shareFriendItemSelected
                      ]}
                      onPress={() => toggleFriendSelection(user.id)}
                    >
                      <View style={styles.shareFriendAvatarContainer}>
                        <Image source={{ uri: user.avatar }} style={styles.shareFriendAvatar} />
                        {selectedFriends.includes(user.id) && (
                          <View style={[styles.shareFriendCheck, { backgroundColor: colors.accent }]}>
                            <Check size={10} color="#FFFFFF" strokeWidth={3} />
                          </View>
                        )}
                      </View>
                      <Text 
                        style={[
                          styles.shareFriendName, 
                          { color: selectedFriends.includes(user.id) ? colors.accent : colors.text }
                        ]} 
                        numberOfLines={1}
                      >
                        {user.name.split(' ')[0]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {selectedFriends.length > 0 && (
                  <View style={styles.shareMessageContainer}>
                    <View style={[styles.shareMessageInputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <TextInput
                        style={[styles.shareMessageInput, { color: colors.text }]}
                        placeholder="Add a message... (optional)"
                        placeholderTextColor={colors.textTertiary}
                        value={shareMessage}
                        onChangeText={setShareMessage}
                        multiline
                        maxLength={200}
                      />
                    </View>
                    <TouchableOpacity
                      style={[styles.shareSendButton, { backgroundColor: colors.accent }]}
                      onPress={handleShareToFriends}
                    >
                      <Send size={18} color="#FFFFFF" />
                      <Text style={styles.shareSendButtonText}>
                        Send to {selectedFriends.length} friend{selectedFriends.length !== 1 ? 's' : ''}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>

    <Modal
      visible={showOptionsModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowOptionsModal(false)}
    >
      <TouchableOpacity
        style={styles.optionsModalBackdrop}
        activeOpacity={1}
        onPress={() => setShowOptionsModal(false)}
      >
        <View style={[styles.optionsModalContent, { backgroundColor: colors.background }]}>
          <View style={[styles.optionsModalHandle, { backgroundColor: colors.textTertiary }]} />
          
          <TouchableOpacity style={styles.optionItem} onPress={handleShowInterest}>
            <View style={[styles.optionIconContainer, { backgroundColor: colors.backgroundTertiary, borderColor: colors.border }, isInterested && styles.optionIconActive]}>
              <Star size={22} color={isInterested ? colors.accent : colors.text} fill={isInterested ? colors.accent : 'none'} />
            </View>
            <View style={styles.optionTextContainer}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>{isInterested ? 'Not Interested' : 'Interested'}</Text>
              <Text style={[styles.optionSubtitle, { color: colors.textTertiary }]}>{isInterested ? 'Show fewer posts like this' : 'Show more posts like this'}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionItem} onPress={handleSavePost}>
            <View style={[styles.optionIconContainer, { backgroundColor: colors.backgroundTertiary, borderColor: colors.border }, isSaved && styles.optionIconActive]}>
              <Bookmark size={22} color={isSaved ? colors.accent : colors.text} fill={isSaved ? colors.accent : 'none'} />
            </View>
            <View style={styles.optionTextContainer}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>{isSaved ? 'Unsave Post' : 'Save Post'}</Text>
              <Text style={[styles.optionSubtitle, { color: colors.textTertiary }]}>{isSaved ? 'Remove from saved' : 'Add to your saved items'}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionItem} onPress={handleToggleNotifications}>
            <View style={[styles.optionIconContainer, { backgroundColor: colors.backgroundTertiary, borderColor: colors.border }, isNotificationsOn && styles.optionIconActive]}>
              {isNotificationsOn ? (
                <BellOff size={22} color={colors.text} />
              ) : (
                <Bell size={22} color={colors.text} />
              )}
            </View>
            <View style={styles.optionTextContainer}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>{isNotificationsOn ? 'Turn Off Notifications' : 'Turn On Notifications'}</Text>
              <Text style={[styles.optionSubtitle, { color: colors.textTertiary }]}>{isNotificationsOn ? 'Stop receiving updates' : 'Get notified about activity'}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionItem} onPress={handleCopyLink}>
            <View style={[styles.optionIconContainer, { backgroundColor: colors.backgroundTertiary, borderColor: colors.border }]}>
              <Link2 size={22} color={colors.text} />
            </View>
            <View style={styles.optionTextContainer}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>Copy Link</Text>
              <Text style={[styles.optionSubtitle, { color: colors.textTertiary }]}>Share this post elsewhere</Text>
            </View>
          </TouchableOpacity>

          <View style={[styles.optionDivider, { backgroundColor: colors.border }]} />

          <TouchableOpacity style={styles.optionItem} onPress={handleHidePost}>
            <View style={[styles.optionIconContainer, { backgroundColor: colors.backgroundTertiary, borderColor: colors.border }]}>
              <EyeOff size={22} color={colors.textSecondary} />
            </View>
            <View style={styles.optionTextContainer}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>Hide Post</Text>
              <Text style={[styles.optionSubtitle, { color: colors.textTertiary }]}>Remove this from your feed</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionItem} onPress={handleUnfollowUser}>
            <View style={[styles.optionIconContainer, { backgroundColor: colors.backgroundTertiary, borderColor: colors.border }]}>
              <UserMinus size={22} color={colors.textSecondary} />
            </View>
            <View style={styles.optionTextContainer}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>Unfollow @{post.user.username}</Text>
              <Text style={[styles.optionSubtitle, { color: colors.textTertiary }]}>Stop seeing their posts</Text>
            </View>
          </TouchableOpacity>

          {!isUserPost && (
            <TouchableOpacity style={[styles.optionItem, styles.optionItemDanger]} onPress={handleReportPost}>
              <View style={[styles.optionIconContainer, styles.optionIconDanger]}>
                <Flag size={22} color={colors.live} />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionTitle, styles.optionTitleDanger]}>Report Post</Text>
                <Text style={[styles.optionSubtitle, { color: colors.textTertiary }]}>Report inappropriate content</Text>
              </View>
            </TouchableOpacity>
          )}

          {isUserPost && (
            <>
              <View style={[styles.optionDivider, { backgroundColor: colors.border }]} />
              <TouchableOpacity style={[styles.optionItem, styles.optionItemDanger]} onPress={handleDeletePost}>
                <View style={[styles.optionIconContainer, styles.optionIconDanger]}>
                  <Trash2 size={22} color={colors.live} />
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={[styles.optionTitle, styles.optionTitleDanger]}>Delete Post</Text>
                  <Text style={[styles.optionSubtitle, { color: colors.textTertiary }]}>Permanently remove this post</Text>
                </View>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity 
            style={[styles.cancelButton, { backgroundColor: colors.backgroundTertiary, borderColor: colors.border }]} 
            onPress={() => setShowOptionsModal(false)}
          >
            <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
    </>
  );
});

export default PostCard;

const styles = StyleSheet.create({
  postWrapper: {
    backgroundColor: 'transparent',
  },
  container: {
    backgroundColor: 'transparent',
    paddingVertical: 20,
    paddingHorizontal: 0,
  },
  apparentlyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  apparentlyText: {
    fontSize: 12,
    fontWeight: '600' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerWrapper: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  usernameSeparator: {
    height: 0,
  },
  postSeparator: {
    height: 0,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  liveBadge: {
    position: 'absolute',
    left: 32,
    bottom: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#ED4956',
    borderWidth: 2,
    borderColor: '#000000',
  },
  userText: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  userHandle: {
    fontSize: 13,
    marginTop: 2,
  },
  moreButton: {
    padding: 4,
  },
  content: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  imageContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  postImage: {
    width: '100%',
    height: undefined,
    aspectRatio: 1,
    minHeight: 200,
    maxHeight: 450,
    borderRadius: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  likeAnimation: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -40,
    marginLeft: -40,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  actionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  saveButton: {
    padding: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 14,
  },
  actionTextLiked: {
    color: '#ED4956',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  closeButton: {
    padding: 4,
  },
  commentsScrollView: {
    maxHeight: 400,
    paddingHorizontal: 20,
  },
  emptyComments: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyCommentsText: {
    fontSize: 16,
    fontWeight: '600' as const,
    marginTop: 12,
  },
  emptyCommentsSubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  commentItem: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  replyItem: {
    marginLeft: 20,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(255, 255, 255, 0.1)',
  },
  replyIcon: {
    marginRight: -8,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  replyAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  commentUserName: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  commentTimestamp: {
    fontSize: 12,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginTop: 8,
  },
  commentActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentActionText: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  commentActionTextLiked: {
    color: '#ED4956',
  },
  repliesContainer: {
    marginTop: 8,
  },
  replyingToContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  replyingToText: {
    fontSize: 13,
  },
  replyingToName: {
    color: '#0095F6',
    fontWeight: '600' as const,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    gap: 12,
  },
  inputAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  commentInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
    borderWidth: 1,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  mentionTextInComment: {
    color: '#F58529',
    fontWeight: '600' as const,
  },
  mentionSuggestionsContainer: {
    borderTopWidth: 1,
    paddingVertical: 8,
  },
  mentionSuggestionsContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  mentionSuggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  mentionAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  mentionUsername: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  optionsModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  optionsModalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 34,
    paddingTop: 12,
  },
  optionsModalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
  },
  optionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  optionIconActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderColor: '#0095F6',
  },
  optionIconDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    marginBottom: 2,
  },
  optionTitleDanger: {
    color: '#ED4956',
  },
  optionSubtitle: {
    fontSize: 13,
  },
  optionItemDanger: {
    marginTop: 4,
  },
  optionDivider: {
    height: 1,
    marginVertical: 8,
    marginHorizontal: 20,
  },
  cancelButton: {
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  shareModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  shareModalBackdropInner: {
    flex: 1,
  },
  shareModalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 34,
    paddingTop: 12,
    maxHeight: '80%',
  },
  shareModalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  shareModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  shareModalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  shareCloseButton: {
    padding: 4,
  },
  shareQuickActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  shareQuickAction: {
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 90,
  },
  shareQuickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareQuickActionText: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  shareFriendsSection: {
    borderTopWidth: 1,
    paddingTop: 16,
  },
  shareFriendsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  shareFriendsTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  shareFriendsList: {
    paddingHorizontal: 16,
    gap: 16,
  },
  shareFriendItem: {
    alignItems: 'center',
    width: 64,
  },
  shareFriendItemSelected: {
    opacity: 1,
  },
  shareFriendAvatarContainer: {
    position: 'relative',
  },
  shareFriendAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  shareFriendCheck: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#000',
  },
  shareFriendName: {
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
  },
  shareMessageContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  shareMessageInputWrapper: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  shareMessageInput: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    minHeight: 60,
    maxHeight: 100,
    textAlignVertical: 'top',
  },
  shareSendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  shareSendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  shareSentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  shareSentIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  shareSentText: {
    fontSize: 22,
    fontWeight: '700' as const,
  },
  shareSentSubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    paddingLeft: 8,
  },
  mentionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
});
