import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView,
  Platform, StyleSheet, Image,
} from 'react-native';
import { Send, User, Smile } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar: string;
  content: string;
  created_at: string;
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
  const flatListRef = useRef<FlatList>(null);
  const subscriptionRef = useRef<any>(null);

  // Load messages
  useEffect(() => {
    loadMessages();
    // Subscribe to real-time
    const channel = supabase
      .channel(`room_chat_${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'room_messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          setMessages(prev => [...prev, payload.new as ChatMessage]);
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
      )
      .subscribe();
    subscriptionRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  const loadMessages = async () => {
    const { data } = await supabase
      .from('room_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(100);
    if (data) setMessages(data);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 200);
  };

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || !user?.id || sending) return;
    setSending(true);
    setInput('');
    const msg = {
      room_id: roomId,
      sender_id: user.id,
      sender_name: (user as any)?.fullName || (user as any)?.name || 'User',
      sender_avatar: (user as any)?.avatar || '',
      content: text,
      created_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('room_messages').insert(msg);
    if (error) console.log('[Chat] Send error:', error.message);
    setSending(false);
  }, [input, user?.id, user, roomId, sending]);

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMe = item.sender_id === user?.id;
    const time = new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return (
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        {!isMe && (
          <View style={styles.msgAvatar}>
            {item.sender_avatar ? (
              <Image source={{ uri: item.sender_avatar }} style={styles.avatarImg} />
            ) : (
              <User size={16} color="#8E8E93" />
            )}
          </View>
        )}
        <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleOther]}>
          {!isMe && <Text style={styles.msgName}>{item.sender_name}</Text>}
          <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{item.content}</Text>
          <Text style={styles.msgTime}>{time}</Text>
        </View>
      </View>
    );
  };

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
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor="#8E8E93"
          value={input}
          onChangeText={setInput}
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
  avatarImg: { width: 28, height: 28, borderRadius: 14 },
  msgBubble: {
    maxWidth: '75%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8,
  },
  msgBubbleOther: { backgroundColor: '#F0F0F0', borderBottomLeftRadius: 4 },
  msgBubbleMe: { backgroundColor: '#3B82F6', borderBottomRightRadius: 4 },
  msgName: { fontSize: 12, fontWeight: '600', color: '#3B82F6', marginBottom: 2 },
  msgText: { fontSize: 15, color: '#262626', lineHeight: 20 },
  msgTextMe: { color: '#FFFFFF' },
  msgTime: { fontSize: 10, color: '#8E8E93', marginTop: 4, alignSelf: 'flex-end' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#262626', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#8E8E93', textAlign: 'center' },
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
