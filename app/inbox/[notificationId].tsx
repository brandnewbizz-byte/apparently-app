import { ArrowLeft, Send, AtSign, Phone, Mic, Play, Pause, Square } from 'lucide-react-native';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Audio } from 'expo-av';
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
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';

interface Message {
  id: string;
  text: string;
  userId: string;
  timestamp: string;
  mentions?: string[];
  audioUrl?: string;
  audioDuration?: number;
}

export default function ConversationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { notificationId } = useLocalSearchParams<{ notificationId: string }>();
  const { user } = useAuth();
  const { colors } = useTheme();

  const [messageText, setMessageText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [isCalling, setIsCalling] = useState(false);
  const [incomingCall, setIncomingCall] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const callRoomRef = useRef<string | null>(null);

  // ── Phone call ──
  const startCall = async () => {
    if (!user?.id) return;
    const roomId = `call-${Date.now()}`;
    callRoomRef.current = roomId;
    setIsCalling(true);
    // Send call notification to recipient
    await supabase.from('notifications').insert({
      recipient_id: notificationId,
      sender_id: user.id,
      type: 'call_request',
      content: JSON.stringify({
        room_id: roomId,
        caller_name: user.fullName || 'Someone',
        message: `is calling you...`,
      }),
      read: false,
      created_at: new Date().toISOString(),
    });
    Alert.alert('Calling...', `Calling ${participant.name}...`, [
      { text: 'Cancel', onPress: () => { setIsCalling(false); callRoomRef.current = null; }, style: 'cancel' },
    ]);
  };

  // Real participant data — fetched from Supabase
  const [participant, setParticipant] = useState<{ name: string; avatar: string; username: string }>({
    name: 'Loading...',
    avatar: '',
    username: '',
  });
  const myAvatar = user?.avatar || '';
  const myName = user?.fullName || 'You';

  const formatTimeAgo = (ts: string) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - new Date(ts).getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  // Fetch participant + messages from Supabase
  useEffect(() => {
    if (!notificationId) return;

    const fetchData = async () => {
      // Fetch participant profile from profiles table
      const { data: userData } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar')
        .eq('id', notificationId)
        .single();
      if (userData) {
        setParticipant({
          name: userData.full_name || userData.username || 'Unknown',
          avatar: userData.avatar || '',
          username: userData.username || '',
        });
      } else {
        setParticipant({ name: 'Unknown', avatar: '', username: '' });
      }

      // Fetch messages — messages table uses conversation_id (NOT recipient_id)
      if (user?.id) {
        // Find conversation between these two users
        const [a, b] = [user.id, notificationId].sort();
        const { data: conv } = await supabase
          .from('conversations')
          .select('id')
          .eq('participant_one', a as string)
          .eq('participant_two', b as string)
          .maybeSingle();
        if (conv?.id) {
          const { data: msgData } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: true })
            .limit(100);
          if (msgData) {
            setMessages(
              (msgData || []).map((m: any) => ({
                id: m.id,
                text: m.content || '',
                userId: m.sender_id === user.id ? 'me' : notificationId,
                timestamp: formatTimeAgo(m.created_at),
              })),
            );
          }
        }
      }
      setIsLoadingMessages(false);
    };

    fetchData();
  }, [notificationId, user?.id]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !user?.id) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const text = messageText.trim();
    const mentionMatches = text.match(/@(\w+)/g) || [];
    const mentions = mentionMatches.map(m => m.substring(1));

    const tempId = `temp-${Date.now()}`;
    const newMessage: Message = {
      id: tempId,
      text,
      userId: 'me',
      timestamp: 'Just now',
      mentions,
    };

    const previousMessages = messages;
    setMessages(prev => [...prev, newMessage]);
    setMessageText('');
    setShowMentionSuggestions(false);

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      // Find or create conversation, then send with conversation_id + content (real column names)
      const [a, b] = [user.id, notificationId].sort();
      let { data: conv } = await supabase
        .from('conversations')
        .select('id')
        .eq('participant_one', a as string)
        .eq('participant_two', b as string)
        .maybeSingle();
      if (!conv?.id) {
        const { data: created } = await supabase
          .from('conversations')
          .insert({ participant_one: a, participant_two: b })
          .select('id')
          .single();
        if (created) conv = created;
      }
      if (!conv?.id) throw new Error('No conversation');

      const { data, error } = await supabase.from('messages').insert({
        conversation_id: conv.id,
        sender_id: user.id,
        content: text,
        read: false,
      }).select('id, created_at').single();

      if (error) throw error;
      if (data) {
        setMessages(prev =>
          prev.map(m => m.id === tempId ? { ...m, id: data.id, timestamp: formatTimeAgo(data.created_at) } : m),
        );
      }
    } catch (err: any) {
      console.error('[Conversation] send error:', err.message);
      setMessages(previousMessages);
      Alert.alert('Error', 'Failed to send message.');
    }
  };

  // ── Voice recording ──
  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      recordingRef.current = rec;
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => setRecordingDuration(p => p + 1), 1000);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (err: any) {
      console.error('[Voice] start:', err.message);
      Alert.alert('Error', 'Could not access microphone.');
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;
    try {
      setIsRecording(false);
      if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      const dur = recordingDuration;
      setRecordingDuration(0);

      if (!uri || !user?.id) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const fileName = `voice/${user.id}/${Date.now()}.m4a`;
      const resp = await fetch(uri);
      const blob = await resp.blob();
      const { error: uploadError } = await supabase.storage
        .from('messages')
        .upload(fileName, blob, { contentType: 'audio/m4a', upsert: false });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('messages').getPublicUrl(fileName);
      const audioUrl = urlData?.publicUrl;
      if (audioUrl) {
        const tempId = `temp-${Date.now()}`;
        const prev = messages;
        setMessages(p => [...p, { id: tempId, text: '', userId: 'me', timestamp: 'Just now', audioUrl, audioDuration: dur }]);
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
        // Find/create conversation, then send voice as content (correct column names)
        const [va, vb] = [user.id, notificationId].sort();
        const { data: vConvData } = await supabase.from('conversations').select('id').eq('participant_one', va).eq('participant_two', vb).maybeSingle();
        let vConvId = vConvData?.id;
        if (!vConvId) {
          const { data: vCreated } = await supabase.from('conversations').insert({ participant_one: va, participant_two: vb }).select('id').single();
          vConvId = vCreated?.id;
        }
        if (!vConvId) throw new Error('No conversation for voice');
        const { data, error } = await supabase.from('messages').insert({
          conversation_id: vConvId,
          sender_id: user.id,
          content: JSON.stringify({ type: 'voice', audio_url: audioUrl, duration: dur }),
          created_at: new Date().toISOString(),
          read: false,
        }).select('id, created_at').single();
        if (!error && data) {
          setMessages(p => p.map(m => m.id === tempId ? { ...m, id: data.id, timestamp: formatTimeAgo(data.created_at) } : m));
        } else if (error) { setMessages(prev); }
      }
    } catch (err: any) {
      console.error('[Voice] stop:', err.message);
      Alert.alert('Error', 'Failed to send voice message.');
    }
  };

  const playAudio = async (audioUrl: string, messageId: string) => {
    try {
      if (playingAudioId === messageId) {
        if (soundRef.current) { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); soundRef.current = null; }
        setPlayingAudioId(null); return;
      }
      if (soundRef.current) { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri: audioUrl }, { shouldPlay: true });
      soundRef.current = sound;
      setPlayingAudioId(messageId);
      sound.setOnPlaybackStatusUpdate((s: any) => { if (s.didJustFinish) { setPlayingAudioId(null); soundRef.current = null; } });
    } catch (err: any) { console.error('[Voice] play:', err.message); setPlayingAudioId(null); }
  };

  useEffect(() => {
    return () => {
      if (soundRef.current) soundRef.current.unloadAsync().catch(() => {});
      if (recordingRef.current) recordingRef.current.stopAndUnloadAsync().catch(() => {});
    };
  }, []);

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

  const filteredUsers = useCallback(async (query: string) => {
    if (!query || query.length < 2) return [];
    const { data } = await supabase
      .from('users')
      .select('id, name, username, avatar')
      .ilike('username', `%${query}%`)
      .limit(5);
    return (data || []).map((u: any) => ({
      id: u.id,
      name: u.name || '',
      username: u.username || '',
      avatar: u.avatar || '',
      isVerified: false,
      followersCount: 0,
    }));
  }, []);

  const [mentionUsers, setMentionUsers] = useState<any[]>([]);

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const renderMessage = (message: Message, index: number) => {
    const isMe = message.userId === 'me';
    const isAudio = !!message.audioUrl;

    if (isAudio) {
      const isPlaying = playingAudioId === message.id;
      return (
        <View key={message.id} style={[styles.messageContainer, isMe ? styles.myMessageContainer : styles.theirMessageContainer]}>
          {!isMe && <Image source={{ uri: participant.avatar }} style={styles.messageAvatar} />}
          <TouchableOpacity
            style={[styles.audioBubble, isMe ? styles.myAudioBubble : styles.theirAudioBubble]}
            onPress={() => playAudio(message.audioUrl!, message.id)}
            activeOpacity={0.7}
          >
            {isPlaying ? <Pause size={22} color="#FFFFFF" /> : <Play size={22} color="#FFFFFF" />}
            <View style={styles.audioWave}>
              <View style={[styles.audioWaveBar, { height: 8 }]} />
              <View style={[styles.audioWaveBar, { height: 16 }]} />
              <View style={[styles.audioWaveBar, { height: 12 }]} />
              <View style={[styles.audioWaveBar, { height: 20 }]} />
              <View style={[styles.audioWaveBar, { height: 10 }]} />
              <View style={[styles.audioWaveBar, { height: 14 }]} />
            </View>
            <Text style={styles.audioDuration}>{formatDuration(message.audioDuration || 0)}</Text>
          </TouchableOpacity>
          <Text style={[styles.messageTimestamp, isMe && styles.myMessageTimestamp, { alignSelf: 'flex-end', marginTop: 2 }]}>
            {message.timestamp}
          </Text>
          {isMe && <Image source={{ uri: myAvatar }} style={styles.messageAvatar} />}
        </View>
      );
    }

    const textWithMentions = (message.text || '').split(/(@\w+)/g).map((part, i) => {
      if (part.startsWith('@')) {
        return <Text key={i} style={styles.mentionText}>{part}</Text>;
      }
      return part;
    });

    return (
      <View key={message.id} style={[styles.messageContainer, isMe ? styles.myMessageContainer : styles.theirMessageContainer]}>
        {!isMe && <Image source={{ uri: participant.avatar }} style={styles.messageAvatar} />}
        <View style={[styles.messageBubble, isMe ? styles.myMessageBubble : styles.theirMessageBubble]}>
          <Text style={[styles.messageText, isMe && styles.myMessageText]}>{textWithMentions}</Text>
          <Text style={[styles.messageTimestamp, isMe && styles.myMessageTimestamp]}>{message.timestamp}</Text>
        </View>
        {isMe && <Image source={{ uri: myAvatar }} style={styles.messageAvatar} />}
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
          <Image source={{ uri: participant.avatar }} style={styles.headerAvatar} />
          <View>
            <Text style={styles.headerName}>{participant.name}</Text>
            <Text style={styles.headerStatus}>Online</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.callButton}
          onPress={() => {
            Alert.alert('Call', `Call ${participant.name}?`);
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

        {showMentionSuggestions && mentionUsers.length > 0 && (
          <View style={styles.mentionSuggestions}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.mentionSuggestionsContent}
            >
              {mentionUsers.map((user: any) => (
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
          {isRecording ? (
            <View style={styles.recordingBar}>
              <Square size={20} color="#FF4444" />
              <Text style={styles.recordingText}>Recording {formatDuration(recordingDuration)}</Text>
              <TouchableOpacity onPress={stopRecording} style={styles.recordingSendBtn}>
                <Send size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={styles.micButton}
                onPressIn={startRecording}
                onPressOut={stopRecording}
                activeOpacity={0.6}
              >
                <Mic size={20} color={Colors.dark.textSecondary} />
              </TouchableOpacity>
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
                <Send size={20} color={messageText.trim() ? Colors.dark.accent : Colors.dark.textTertiary} />
              </TouchableOpacity>
            </>
          )}
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
  // ── Audio / Voice ──
  micButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.dark.surface, alignItems: 'center', justifyContent: 'center' },
  audioBubble: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, minWidth: 120 },
  myAudioBubble: { backgroundColor: Colors.dark.accent, borderBottomRightRadius: 4 },
  theirAudioBubble: { backgroundColor: Colors.dark.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: Colors.dark.border },
  audioWave: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 28 },
  audioWaveBar: { width: 3, backgroundColor: '#FFFFFF', borderRadius: 2 },
  audioDuration: { fontSize: 12, color: '#FFFFFF', minWidth: 32 },
  recordingBar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  recordingText: { flex: 1, fontSize: 14, color: '#FF4444', fontWeight: '600' },
  recordingSendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.dark.accent, alignItems: 'center', justifyContent: 'center' },
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
