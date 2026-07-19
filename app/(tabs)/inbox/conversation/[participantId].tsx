import { ArrowLeft, Send, AtSign, Phone, BadgeCheck, Heart, MessageCircle, ExternalLink } from 'lucide-react-native';
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Linking,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/contexts/ThemeContext';
import { useMessaging, Message, SharedPost } from '@/contexts/MessagingContext';
import { mockUsers } from '@/mocks/data';

export default function ConversationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { participantId } = useLocalSearchParams<{ participantId: string }>();
  const { colors } = useTheme();
  const { getConversation, sendMessage, markConversationAsRead } = useMessaging();
  const [messageText, setMessageText] = useState('');
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  const conversation = getConversation(participantId || '');
  const participant = mockUsers.find(u => u.id === participantId) || {
    id: participantId || '',
    name: conversation?.participantName || 'Unknown',
    username: conversation?.participantUsername || 'unknown',
    avatar: conversation?.participantAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop',
    isVerified: false,
    followersCount: 0,
  };

  const myAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop';

  useEffect(() => {
    if (participantId) {
      markConversationAsRead(participantId);
    }
  }, [participantId, markConversationAsRead]);

  const handleSendMessage = () => {
    if (messageText.trim() && participantId) {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      sendMessage(participantId, messageText.trim());
      setMessageText('');
      setShowMentionSuggestions(false);
      
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const handleTextChange = (text: string) => {
    setMessageText(text);

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
    const words = messageText.split(/\s/);
    words[words.length - 1] = `@${username} `;
    setMessageText(words.join(' '));
    setShowMentionSuggestions(false);
    setMentionQuery('');
  };

  const filteredUsers = mockUsers.filter(user =>
    user.username.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const renderSharedPost = (sharedPost: SharedPost) => {
    const post = sharedPost.post;
    
    return (
      <TouchableOpacity 
        style={[styles.sharedPostCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => {
          if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          router.push(`/user/${post.user.id}` as any);
        }}
        activeOpacity={0.8}
      >
        <View style={styles.sharedPostHeader}>
          <Image source={{ uri: post.user.avatar }} style={styles.sharedPostAvatar} />
          <View style={styles.sharedPostUserInfo}>
            <View style={styles.sharedPostNameRow}>
              <Text style={[styles.sharedPostUserName, { color: colors.text }]} numberOfLines={1}>
                {post.user.name}
              </Text>
              {post.user.isVerified && (
                <BadgeCheck size={12} color={colors.accent} />
              )}
            </View>
            <Text style={[styles.sharedPostUsername, { color: colors.textTertiary }]}>
              @{post.user.username}
            </Text>
          </View>
          <ExternalLink size={16} color={colors.textTertiary} />
        </View>
        
        <Text style={[styles.sharedPostContent, { color: colors.textSecondary }]} numberOfLines={3}>
          {post.content}
        </Text>
        
        {post.imageUrl && (
          <Image 
            source={{ uri: post.imageUrl }} 
            style={styles.sharedPostImage}
            resizeMode="cover"
          />
        )}
        
        <View style={styles.sharedPostStats}>
          <View style={styles.sharedPostStat}>
            <Heart size={12} color={colors.textTertiary} />
            <Text style={[styles.sharedPostStatText, { color: colors.textTertiary }]}>{post.likes}</Text>
          </View>
          <View style={styles.sharedPostStat}>
            <MessageCircle size={12} color={colors.textTertiary} />
            <Text style={[styles.sharedPostStatText, { color: colors.textTertiary }]}>{post.comments}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderMessage = (message: Message) => {
    const isMe = message.senderId === 'current-user';
    const user = isMe ? { name: 'You', avatar: myAvatar } : participant;

    const textWithMentions = message.text.split(/(@\w+)/g).map((part, i) => {
      if (part.startsWith('@')) {
        return (
          <Text key={i} style={styles.mentionText}>
            {part}
          </Text>
        );
      }
      return part;
    });

    return (
      <View
        key={message.id}
        style={[
          styles.messageContainer,
          isMe ? styles.myMessageContainer : styles.theirMessageContainer,
        ]}
      >
        {!isMe && (
          <Image source={{ uri: user.avatar }} style={styles.messageAvatar} />
        )}
        <View style={[
          styles.messageBubble, 
          isMe ? [styles.myMessageBubble, { backgroundColor: colors.accent }] : [styles.theirMessageBubble, { backgroundColor: colors.surface, borderColor: colors.border }]
        ]}>
          {message.sharedPost && (
            <>
              <Text style={[styles.sharedLabel, { color: isMe ? 'rgba(255,255,255,0.7)' : colors.textTertiary }]}>
                Shared a post
              </Text>
              {renderSharedPost(message.sharedPost)}
            </>
          )}
          {message.text.trim() && (
            <Text style={[styles.messageText, isMe ? styles.myMessageText : { color: colors.textSecondary }]}>
              {textWithMentions}
            </Text>
          )}
          <Text style={[styles.messageTimestamp, isMe ? styles.myMessageTimestamp : { color: colors.textTertiary }]}>
            {formatTimestamp(message.timestamp)}
          </Text>
        </View>
        {isMe && (
          <Image source={{ uri: user.avatar }} style={styles.messageAvatar} />
        )}
      </View>
    );
  };

  const messages = conversation?.messages || [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.headerUser}
          onPress={() => router.push(`/user/${participantId}` as any)}
          activeOpacity={0.7}
        >
          <Image source={{ uri: participant.avatar }} style={[styles.headerAvatar, { backgroundColor: colors.backgroundTertiary }]} />
          <View>
            <View style={styles.headerNameRow}>
              <Text style={[styles.headerName, { color: colors.text }]}>{participant.name}</Text>
              {participant.isVerified && (
                <BadgeCheck size={14} color={colors.accent} />
              )}
            </View>
            <Text style={[styles.headerStatus, { color: colors.textSecondary }]}>@{participant.username}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.callButton, { backgroundColor: colors.accent + '20' }]}
          onPress={() => {
            if (Platform.OS === 'web') {
              Alert.alert('Call', `Call ${participant.name}?`);
            } else {
              Linking.openURL(`tel:555-123-4567`).catch(() => {
                Alert.alert('Unable to Call', 'Phone calls are not supported on this device.');
              });
            }
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Phone size={22} color={colors.accent} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesScrollView}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: false })}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.surface }]}>
                <Send size={32} color={colors.textTertiary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Start the conversation</Text>
              <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                Send a message or share something with {participant.name}
              </Text>
            </View>
          ) : (
            messages.map(renderMessage)
          )}
        </ScrollView>

        {showMentionSuggestions && filteredUsers.length > 0 && (
          <View style={[styles.mentionSuggestions, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.mentionSuggestionsContent}
            >
              {filteredUsers.map((user) => (
                <TouchableOpacity
                  key={user.id}
                  style={[styles.mentionSuggestion, { backgroundColor: colors.background, borderColor: colors.border }]}
                  onPress={() => handleMentionSelect(user.username)}
                >
                  <Image source={{ uri: user.avatar }} style={[styles.mentionAvatar, { backgroundColor: colors.backgroundTertiary }]} />
                  <Text style={[styles.mentionUsername, { color: colors.text }]}>@{user.username}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={[styles.inputContainer, { paddingBottom: insets.bottom || 12, borderTopColor: colors.border, backgroundColor: colors.background }]}>
          <TouchableOpacity
            style={[styles.mentionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => {
              setMessageText(prev => prev + '@');
              setShowMentionSuggestions(true);
            }}
          >
            <AtSign size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              style={[styles.messageInput, { color: colors.text }]}
              placeholder="Type a message..."
              placeholderTextColor={colors.textTertiary}
              value={messageText}
              onChangeText={handleTextChange}
              multiline
              maxLength={500}
            />
          </View>
          <TouchableOpacity
            style={[
              styles.sendButton, 
              { backgroundColor: messageText.trim() ? colors.accent : colors.surface, borderColor: colors.border },
              !messageText.trim() && styles.sendButtonDisabled
            ]}
            onPress={handleSendMessage}
            disabled={!messageText.trim()}
          >
            <Send
              size={20}
              color={messageText.trim() ? '#FFFFFF' : colors.textTertiary}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerUser: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginLeft: 8,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  headerStatus: {
    fontSize: 12,
    marginTop: 2,
  },
  keyboardView: {
    flex: 1,
  },
  messagesScrollView: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    gap: 16,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  myMessageContainer: {
    justifyContent: 'flex-end',
  },
  theirMessageContainer: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  myMessageBubble: {
    borderBottomRightRadius: 4,
  },
  theirMessageBubble: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  sharedLabel: {
    fontSize: 11,
    fontWeight: '500' as const,
    marginBottom: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  sharedPostCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  sharedPostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sharedPostAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
  },
  sharedPostUserInfo: {
    flex: 1,
  },
  sharedPostNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sharedPostUserName: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  sharedPostUsername: {
    fontSize: 11,
  },
  sharedPostContent: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  sharedPostImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginBottom: 8,
  },
  sharedPostStats: {
    flexDirection: 'row',
    gap: 12,
  },
  sharedPostStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sharedPostStatText: {
    fontSize: 11,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    color: '#FFFFFF',
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  mentionText: {
    color: '#FFB300',
    fontWeight: '600' as const,
  },
  messageTimestamp: {
    fontSize: 11,
    marginTop: 4,
    color: 'rgba(255,255,255,0.7)',
  },
  myMessageTimestamp: {
    color: 'rgba(255,255,255,0.7)',
  },
  mentionSuggestions: {
    borderTopWidth: 1,
    paddingVertical: 8,
  },
  mentionSuggestionsContent: {
    paddingHorizontal: 16,
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
  },
  mentionUsername: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 8,
  },
  mentionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  inputWrapper: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  messageInput: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
