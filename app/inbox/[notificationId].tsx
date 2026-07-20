import { ArrowLeft, Send, AtSign, Phone } from 'lucide-react-native';
import React, { useState, useRef } from 'react';
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
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import Colors from '@/constants/colors';
import { mockUsers } from '@/mocks/data';

interface Message {
  id: string;
  text: string;
  userId: string;
  timestamp: string;
  mentions?: string[];
}

export default function ConversationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [messageText, setMessageText] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Hey! Thanks for following up on that investment opportunity.',
      userId: mockUsers[0].id,
      timestamp: '2h ago',
    },
    {
      id: '2',
      text: 'Of course! I wanted to discuss the real estate building project. Are you still interested?',
      userId: 'me',
      timestamp: '1h ago',
    },
    {
      id: '3',
      text: 'Absolutely! The $50,000 investment looks promising. Let\'s schedule a call this Thursday?',
      userId: mockUsers[0].id,
      timestamp: '45m ago',
    },
  ]);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  const currentUser = mockUsers[0];
  const myAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop';

  const handleSendMessage = () => {
    if (messageText.trim()) {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      const mentionMatches = messageText.match(/@(\w+)/g) || [];
      const mentions = mentionMatches.map(m => m.substring(1));

      const newMessage: Message = {
        id: Date.now().toString(),
        text: messageText,
        userId: 'me',
        timestamp: 'Just now',
        mentions,
      };

      setMessages(prev => [...prev, newMessage]);
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

  const renderMessage = (message: Message, index: number) => {
    const isMe = message.userId === 'me';
    const user = isMe ? { name: 'You', avatar: myAvatar } : currentUser;

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
        <View style={[styles.messageBubble, isMe ? styles.myMessageBubble : styles.theirMessageBubble]}>
          <Text style={[styles.messageText, isMe && styles.myMessageText]}>
            {textWithMentions}
          </Text>
          <Text style={[styles.messageTimestamp, isMe && styles.myMessageTimestamp]}>
            {message.timestamp}
          </Text>
        </View>
        {isMe && (
          <Image source={{ uri: user.avatar }} style={styles.messageAvatar} />
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={24} color={Colors.dark.text} />
        </TouchableOpacity>
        <View style={styles.headerUser}>
          <Image source={{ uri: currentUser.avatar }} style={styles.headerAvatar} />
          <View>
            <Text style={styles.headerName}>{currentUser.name}</Text>
            <Text style={styles.headerStatus}>Active now</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.callButton}
          onPress={() => {
            const phoneNumber = '555-123-4567';
            if (Platform.OS === 'web') {
              Alert.alert('Call', `Call ${currentUser.name} at ${phoneNumber}?`);
            } else {
              Linking.openURL(`tel:${phoneNumber}`).catch(() => {
                Alert.alert('Unable to Call', 'Phone calls are not supported on this device.');
              });
            }
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Phone size={22} color={Colors.dark.accent} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesScrollView}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: false })}
        >
          {messages.map(renderMessage)}
        </ScrollView>

        {showMentionSuggestions && filteredUsers.length > 0 && (
          <View style={styles.mentionSuggestions}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.mentionSuggestionsContent}
            >
              {filteredUsers.map((user) => (
                <TouchableOpacity
                  key={user.id}
                  style={styles.mentionSuggestion}
                  onPress={() => handleMentionSelect(user.username)}
                >
                  <Image source={{ uri: user.avatar }} style={styles.mentionAvatar} />
                  <Text style={styles.mentionUsername}>@{user.username}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={[styles.inputContainer, { paddingBottom: insets.bottom || 12 }]}>
          <TouchableOpacity
            style={styles.mentionButton}
            onPress={() => {
              setMessageText(prev => prev + '@');
              setShowMentionSuggestions(true);
            }}
          >
            <AtSign size={20} color={Colors.dark.textSecondary} />
          </TouchableOpacity>
          <TextInput
            style={styles.messageInput}
            placeholder="Type a message..."
            placeholderTextColor={Colors.dark.textTertiary}
            value={messageText}
            onChangeText={handleTextChange}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendButton, !messageText.trim() && styles.sendButtonDisabled]}
            onPress={handleSendMessage}
            disabled={!messageText.trim()}
          >
            <Send
              size={20}
              color={messageText.trim() ? Colors.dark.accent : Colors.dark.textTertiary}
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
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
    backgroundColor: Colors.dark.background,
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
    backgroundColor: 'rgba(0, 149, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.backgroundTertiary,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  headerStatus: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
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
    backgroundColor: Colors.dark.backgroundTertiary,
  },
  messageBubble: {
    maxWidth: '70%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  myMessageBubble: {
    backgroundColor: Colors.dark.accent,
    borderBottomRightRadius: 4,
  },
  theirMessageBubble: {
    backgroundColor: Colors.dark.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  messageText: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
    lineHeight: 20,
  },
  myMessageText: {
    color: Colors.dark.text,
  },
  mentionText: {
    color: Colors.dark.gradient1,
    fontWeight: '600' as const,
  },
  messageTimestamp: {
    fontSize: 11,
    color: Colors.dark.textTertiary,
    marginTop: 4,
  },
  myMessageTimestamp: {
    color: Colors.dark.text,
    opacity: 0.7,
  },
  mentionSuggestions: {
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    backgroundColor: Colors.dark.surface,
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
    backgroundColor: Colors.dark.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  mentionAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.dark.backgroundTertiary,
  },
  mentionUsername: {
    fontSize: 14,
    color: Colors.dark.text,
    fontWeight: '500' as const,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    backgroundColor: Colors.dark.background,
    gap: 8,
  },
  mentionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  messageInput: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.dark.text,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
