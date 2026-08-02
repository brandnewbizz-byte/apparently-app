import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView,
  Platform, StyleSheet, Image,
} from 'react-native';
import { Send, User, Smile, Check, CheckCheck } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read: boolean;
  created_at: string;
  // Enriched at render time
  sender_name?: string;
  sender_avatar?: string;
}

interface ChatTabProps {
  roomId: string;
  roomName: string;
}

export default function ChatTab({ roomId, roomName }: ChatTabProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const subscriptionRef = useRef<any>(null);

  // Use conversation_id as room identifier — avoids needing separate room_messages table
  const roomConvId = `room_${roomId}`;

  // Load messages + subscribe to real-time
  useEffect(() => {
    loadMessages();

    const channel = supabase
      .channel(`room_chat_${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${roomConvId}` },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setMessages(prev => {
            // Deduplicate
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
          // Mark as read if from someone else
          if (newMsg.sender_id !== user?.id && !newMsg.read) {
            supabase.from('messages').update({ read: true }).eq('id', newMsg.id).then(() => {});
          }
        }
      )
      .subscribe();

    subscriptionRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const loadMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', roomConvId)
      .order('created_at', { ascending: true })
      .limit(100);
    if (data) {
      setMessages(data);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 200);
    }
  };

  // Typing indicator
  const onInputChange = (text: string) => {
    setInput(text);
    // Clear existing timer
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    // Set typing
    setTypingUsers(prev => new Set(prev).add(user?.id || ''));
    // Clear after 2s
    typingTimerRef.current = setTimeout(() => {
      setTypingUsers(prev => {
        const next = new Set(prev);
        next.delete(user?.id || '');
        return next;
      });
    }, 2000);
  };

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || !user?.id || sending) return;
    setSending(true);
    setInput('');
    // Clear typing immediately
    setTypingUsers(new Set());
    const msg = {
      conversation_id: roomConvId,
      sender_id: user.id,
      content: text,
      read: false,
      created_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('messages').insert(msg);
    if (error) {
      console.log('[Chat] Send error:', error.message);
      // Fallback: add locally even if Supabase insert failed
      const localMsg: ChatMessage = { ...msg, id: `local_${Date.now()}` };
      setMessages(prev => [...prev, localMsg]);
    }
    setSending(false);
  }, [input, user?.id, user, roomConvId, sending]);

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMe = item.sender_id === user?.id;
    const time = new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return (
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        {!isMe && (
          <View style={styles.msgAvatar}>
            <User size={16} color="#8E8E93" />
          </View>
        )}
        <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleOther]}>
          <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{item.content}</Text>
          <View style={styles.msgFooter}>
            <Text style={styles.msgTime}>{time}</Text>
            {isMe && (
              item.read
                ? <CheckCheck size={12} color="#A0D2FF" style={{ marginLeft: 4 }} />
                : <Check size={12} color="#A0D2FF" style={{ marginLeft: 4 }} />
            )}
          </View>
        </View>
      </View>
    );
  };

  const typingText = Array.from(typingUsers).length > 0 ? 'typing...' : '';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {messages.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Room Chat</Text>
          <Text style={styles.emptySub}>Be the first to say something in {roomName || 'this room'}</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.msgList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />
      )}
      {typingText ? (
        <Text style={styles.typingText}>{typingText}</Text>
      ) : null}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor="#8E8E93"
          value={input}
          onChangeText={onInputChange}
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!input.trim() || sending}
        >
          <Send size={18} color={input.trim() && !sending ? '#FFFFFF' : '#8E8E93'} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  msgList: { padding: 12, paddingBottom: 8 },
  msgRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end' },
  msgRowMe: { justifyContent: 'flex-end' },
  msgAvatar: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#F0F0F0',
    marginRight: 8, alignItems: 'center', justifyContent: 'center',
  },
  msgBubble: {
    maxWidth: '75%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8,
  },
  msgBubbleOther: { backgroundColor: '#F0F0F0', borderBottomLeftRadius: 4 },
  msgBubbleMe: { backgroundColor: '#3B82F6', borderBottomRightRadius: 4 },
  msgText: { fontSize: 15, color: '#262626', lineHeight: 20 },
  msgTextMe: { color: '#FFFFFF' },
  msgFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 },
  msgTime: { fontSize: 10, color: '#8E8E93' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#262626', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#8E8E93', textAlign: 'center' },
  typingText: { fontSize: 12, color: '#8E8E93', fontStyle: 'italic', paddingHorizontal: 16, paddingBottom: 4 },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', padding: 8,
    borderTopWidth: 1, borderTopColor: '#F0F0F0', backgroundColor: '#FAFAFA',
  },
  input: {
    flex: 1, fontSize: 15, color: '#262626', backgroundColor: '#F5F5F5',
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
    maxHeight: 100, marginRight: 8,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#3B82F6',
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#E5E5E5' },
});
