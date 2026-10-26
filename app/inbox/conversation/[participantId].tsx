import { ChevronLeft, Phone, Video, BadgeCheck, Heart, MessageCircle, Mic, Play, Pause, Tag, Image as ImageIcon, Camera, Trash2, ArrowUp, Smile } from 'lucide-react-native';
import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  Modal,
  Animated,
  ActionSheetIOS,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { ScrollViewInstance } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';

import { useTheme } from '@/contexts/ThemeContext';
import { useMessaging, Message, SharedPost } from '@/contexts/MessagingContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  AudioModule,
  createAudioPlayer,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
  IOSOutputFormat,
  AudioQuality,
} from 'expo-audio';
import type { AudioPlayer, AudioRecorder, RecordingOptions } from 'expo-audio';
import { supabase } from '@/lib/supabase';
import { generateUsername } from '@/lib/sanitize';

// Voice notes are recorded as AAC/M4A so they decode natively on both iOS and
// Android (mirrors lib/audio-relay.ts, which already migrated off expo-av).
const RECORDING_OPTIONS: RecordingOptions = {
  extension: '.m4a',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 64000,
  android: {
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
  },
  ios: {
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.LOW,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 64000,
  },
};

// `fetch(uri).blob()` does not work on local file:// paths in React Native —
// read bytes via expo-file-system's File class instead (SDK 57 API).
async function readLocalFileBytes(uri: string): Promise<Uint8Array> {
  const { File } = await import('expo-file-system');
  return new File(uri).bytes();
}


export default function ConversationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { participantId } = useLocalSearchParams<{ participantId: string }>();
  const { colors, isDark } = useTheme();
  const { getConversation, sendMessage, markConversationAsRead, deleteMessage, loadEarlierMessages, presence, notifyTyping } = useMessaging();
  const { user: authUser } = useAuth();
  const [messageText, setMessageText] = useState('');
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  // Image attachment state
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUrlCache, setImageUrlCache] = useState<Record<string, string>>({});
  const [viewerImage, setViewerImage] = useState<string | null>(null);
  const recordingRef = useRef<AudioRecorder | null>(null);
  const soundRef = useRef<AudioPlayer | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollViewRef = useRef<ScrollViewInstance>(null);

  const conversation = getConversation(participantId || '');
  const [fetchedProfile, setFetchedProfile] = useState<{ name: string; username: string; avatar: string } | null>(null);

  // Fetch the participant's profile directly so name/avatar show correctly even
  // for brand-new conversations (where no MessagingContext entry exists yet).
  useEffect(() => {
    if (!participantId || conversation) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar')
        .eq('id', participantId)
        .maybeSingle();
      if (!cancelled && data) {
        setFetchedProfile({
          name: data.full_name || data.username || 'Unknown',
          username: data.username || generateUsername(participantId),
          avatar: data.avatar || '',
        });
      }
    })();
    return () => { cancelled = true; };
  }, [participantId, conversation]);

  const participant = {
    id: participantId || '',
    name: conversation?.participantName || fetchedProfile?.name || 'Unknown',
    username: conversation?.participantUsername || fetchedProfile?.username || generateUsername(participantId),
    avatar: conversation?.participantAvatar || fetchedProfile?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop',
    isVerified: false,
    followersCount: 0,
  };

  const myAvatar = (authUser as any)?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop';

  useEffect(() => {
    if (participantId) {
      markConversationAsRead(participantId);
    }
  }, [participantId, markConversationAsRead]);

  const startCall = async () => {
    if (!authUser?.id || !participantId) return;
    const callRoomId = `call-${Date.now()}`;
    try {
      await supabase.from('notifications').insert({
        user_id: participantId,
        actor_id: authUser.id,
        type: 'call_request',
        title: `${(authUser as any)?.fullName || 'Someone'} is calling you`,
        body: 'is calling you...',
        data: { room_id: callRoomId, caller_id: authUser.id },
        read: false,
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('[Call] notification insert failed', e);
    }
    router.push({
      pathname: '/call/[roomId]' as any,
      params: {
        roomId: callRoomId,
        callerId: authUser.id,
        callerName: (authUser as any)?.fullName || 'You',
        targetId: participantId,
        targetName: participant.name,
        isOutgoing: '1',
        currentUserId: authUser.id,
        currentUserName: (authUser as any)?.fullName || 'You',
      },
    } as any);
  };

  // ── Voice recording ──
  const startRecording = async () => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission Required', 'We need microphone access to send voice notes.');
        return;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
      });
      const rec = new AudioModule.AudioRecorder({});
      await rec.prepareToRecordAsync(RECORDING_OPTIONS);
      rec.record();
      recordingRef.current = rec;
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => setRecordingDuration(p => p + 1), 1000);
    } catch (e) {
      console.warn('[Conversation] startRecording failed:', e);
      Alert.alert('Error', 'Could not access microphone.');
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;
    const rec = recordingRef.current;
    recordingRef.current = null;
    try {
      setIsRecording(false);
      if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
      await rec.stop();
      const uri = rec.uri;
      if (!uri) { setRecordingDuration(0); return; }
      const dur = recordingDuration;
      setRecordingDuration(0);
      // Read local bytes and upload to the private `messages` bucket.
      const bytes = await readLocalFileBytes(uri);
      const filePath = `voice/${participantId || 'anon'}/${Date.now()}.m4a`;
      const { error: uploadErr } = await supabase.storage.from('messages').upload(filePath, bytes, { contentType: 'audio/m4a' });
      if (uploadErr) {
        console.warn('[Conversation] voice upload failed:', uploadErr.message);
        Alert.alert('Error', 'Failed to upload voice note');
        return;
      }
      if (participantId) {
        sendMessage(participantId, '', undefined, { voice_note: { path: filePath, duration: dur } });
      }
    } catch (e: any) {
      console.warn('[Conversation] stopRecording failed:', e);
      Alert.alert('Error', e.message || 'Failed to send voice note');
    }
  };

  // Discard an in-progress voice note (trash button while recording)
  const cancelRecording = async () => {
    const rec = recordingRef.current;
    recordingRef.current = null;
    setIsRecording(false);
    setRecordingDuration(0);
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    try { await rec?.stop(); } catch {}
  };

  // ── Image attachments (gallery or camera) ──
  const pickImage = async (source: 'library' | 'camera' = 'library') => {
    if (!participantId) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const perm = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission Required', source === 'camera'
          ? 'We need camera access to send photos.'
          : 'We need access to your photos to send images.');
        return;
      }
    }
    try {
      const options = { mediaTypes: ['images'] as ImagePicker.MediaType[], allowsEditing: false, quality: 0.8 };
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setImageUploading(true);
      const ext = (asset.fileName?.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const mime = asset.mimeType || `image/${ext === 'png' ? 'png' : 'jpeg'}`;
      const filePath = `images/${participantId}/${Date.now()}.${ext}`;
      // `fetch(asset.uri).blob()` does not work on device file:// paths — use
      // expo-file-system's File class to read raw bytes instead.
      const bytes = await readLocalFileBytes(asset.uri);
      const { error: uploadErr } = await supabase.storage.from('messages').upload(filePath, bytes, { contentType: mime });
      if (uploadErr) {
        Alert.alert('Error', 'Failed to upload image. Please try again.');
        return;
      }
      sendMessage(participantId, '', undefined, {
        image: { path: filePath, width: asset.width, height: asset.height },
      });
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 150);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to send image');
    } finally {
      setImageUploading(false);
    }
  };

  const togglePlayAudio = async (voiceNote: any, messageId: string) => {
    try {
      if (playingAudioId === messageId) {
        soundRef.current?.pause();
        soundRef.current?.remove();
        soundRef.current = null;
        setPlayingAudioId(null);
        return;
      }
      if (soundRef.current) {
        soundRef.current.pause();
        soundRef.current.remove();
        soundRef.current = null;
      }
      // Resolve a signed URL from the stored path (bucket is private).
      let audioUrl: string | null = null;
      const path = voiceNote?.path || voiceNote?.url;
      if (path && !String(path).startsWith('http')) {
        const { data: signed } = await supabase.storage.from('messages').createSignedUrl(path, 3600);
        audioUrl = signed?.signedUrl || null;
      } else if (path) {
        audioUrl = path; // legacy public-URL fallback
      }
      if (!audioUrl) {
        Alert.alert('Error', 'Voice note unavailable');
        return;
      }
      const player = createAudioPlayer({ uri: audioUrl });
      soundRef.current = player;
      setPlayingAudioId(messageId);
      player.addListener('playbackStatusUpdate', (status: any) => {
        if (status.didJustFinish) {
          setPlayingAudioId(null);
          player.remove();
          soundRef.current = null;
        }
      });
      player.play();
    } catch (e) {
      console.warn('[Conversation] audio playback error:', e);
    }
  };

  const handleSendMessage = () => {
    if (messageText.trim() && participantId) {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      sendMessage(participantId, messageText.trim());
      setMessageText('');
      stopTyping();
      setShowMentionSuggestions(false);
      
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  // ── "typing…" signal for the other person (cleared after 3s idle) ──
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const stopTyping = () => {
    if (typingTimerRef.current) { clearTimeout(typingTimerRef.current); typingTimerRef.current = null; }
    if (isTypingRef.current && participantId) notifyTyping(participantId, false);
    isTypingRef.current = false;
  };
  useEffect(() => () => {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (isTypingRef.current && participantId) notifyTyping(participantId, false);
  }, [participantId, notifyTyping]);

  const handleTextChange = (text: string) => {
    setMessageText(text);
    if (participantId && text.trim()) {
      if (!isTypingRef.current) { notifyTyping(participantId, true); isTypingRef.current = true; }
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(stopTyping, 3000);
    } else {
      stopTyping();
    }

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

  const [mentionUsers, setMentionUsers] = useState<{ id: string; name: string; username: string; avatar: string; isVerified: boolean; followersCount: number }[]>([]);

  // Resolve signed URLs for image messages in this conversation.
  useEffect(() => {
    const imageMessages = (conversation?.messages || []).filter((m: any) => m.metadata?.image);
    imageMessages.forEach((m: any) => {
      const path = m.metadata.image.path || m.metadata.image.url;
      if (path && !String(path).startsWith('http') && !imageUrlCache[path]) {
        supabase.storage.from('messages').createSignedUrl(path, 3600).then(({ data }) => {
          if (data?.signedUrl) {
            setImageUrlCache(prev => ({ ...prev, [path]: data.signedUrl }));
          }
        }).catch(() => {});
      }
    });
  }, [conversation?.messages]);

  // Fetch mention suggestions when the user types @ (e.g. "@john").
  useEffect(() => {
    if (!mentionQuery || mentionQuery.length < 2) {
      setMentionUsers([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar')
        .or(`full_name.ilike.%${mentionQuery}%,username.ilike.%${mentionQuery}%`)
        .limit(5);
      if (!cancelled) {
        setMentionUsers((data || []).map((u: any) => ({
          id: u.id,
          name: u.full_name || u.username || '',
          username: u.username || generateUsername(u.id),
          avatar: u.avatar || '',
          isVerified: false,
          followersCount: 0,
        })));
      }
    })();
    return () => { cancelled = true; };
  }, [mentionQuery]);

  // ─────────────────────────────────────────────────────────────────────────
  // Instagram-style rendering
  // ─────────────────────────────────────────────────────────────────────────

  const myId = authUser?.id || '';
  const peer = presence[participantId || ''];
  const isOnline = !!peer?.online;
  const isTyping = !!peer?.typing;
  const theirBubble = isDark ? '#262626' : '#EFEFEF';
  const messages = useMemo(() => conversation?.messages || [], [conversation?.messages]);

  // Last message I sent — gets the "Seen / Sent" label under it.
  const lastMineId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].senderId === myId) return messages[i].id;
    return null;
  }, [messages, myId]);

  const GROUP_GAP_MS = 5 * 60 * 1000;
  const SEPARATOR_GAP_MS = 30 * 60 * 1000;
  const ts = (m?: Message) => (m ? new Date(m.timestamp).getTime() : 0);

  const separatorLabel = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const sameDay = d.toDateString() === now.toDateString();
    const yest = new Date(now); yest.setDate(now.getDate() - 1);
    if (sameDay) return `Today ${time}`;
    if (d.toDateString() === yest.toDateString()) return `Yesterday ${time}`;
    const diffDays = (now.getTime() - d.getTime()) / 86400000;
    if (diffDays < 7) return `${d.toLocaleDateString([], { weekday: 'long' })} ${time}`;
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' })}, ${time}`;
  };

  const onMessageLongPress = (message: Message) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const isMe = message.senderId === myId;
    const label = isMe ? 'Unsend' : 'Delete';
    const run = () => deleteMessage(message.id, participantId || '');
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', label], destructiveButtonIndex: 1, cancelButtonIndex: 0 },
        (i) => { if (i === 1) run(); },
      );
    } else {
      Alert.alert(isMe ? 'Unsend message?' : 'Delete message?', isMe ? 'This removes it for everyone.' : undefined, [
        { text: 'Cancel', style: 'cancel' },
        { text: label, style: 'destructive', onPress: run },
      ]);
    }
  };

  const renderTextWithMentions = (text: string, isMe: boolean) =>
    text.split(/(@\w+)/g).map((part, i) =>
      part.startsWith('@') ? (
        <Text key={i} style={{ fontWeight: '700', color: isMe ? '#FFFFFF' : colors.accent }}>{part}</Text>
      ) : (
        part
      ),
    );

  const renderSharedPost = (sharedPost: SharedPost) => {
    const post = sharedPost.post;
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: theirBubble }]}
        onPress={() => router.push(`/user/${post.user.id}` as any)}
        activeOpacity={0.85}
      >
        <View style={styles.cardHeader}>
          <Image source={{ uri: post.user.avatar }} style={styles.cardAvatar} />
          <Text style={[styles.cardUser, { color: colors.text }]} numberOfLines={1}>{post.user.username || post.user.name}</Text>
          {post.user.isVerified && <BadgeCheck size={13} color={colors.accent} />}
        </View>
        {post.imageUrl ? <Image source={{ uri: post.imageUrl }} style={styles.cardImage} resizeMode="cover" /> : null}
        {!!post.content && (
          <Text style={[styles.cardCaption, { color: colors.text }]} numberOfLines={2}>
            <Text style={{ fontWeight: '700' }}>{post.user.username || post.user.name} </Text>{post.content}
          </Text>
        )}
        <View style={styles.cardStats}>
          <Heart size={13} color={colors.textSecondary} />
          <Text style={[styles.cardStatText, { color: colors.textSecondary }]}>{post.likes}</Text>
          <MessageCircle size={13} color={colors.textSecondary} />
          <Text style={[styles.cardStatText, { color: colors.textSecondary }]}>{post.comments}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderOfferCard = (card: any) => (
    <View style={[styles.card, { backgroundColor: theirBubble }]}>
      {card.image_url ? <Image source={{ uri: card.image_url }} style={styles.cardImage} resizeMode="cover" /> : null}
      <View style={{ padding: 12, gap: 3 }}>
        <View style={styles.offerTag}>
          <Tag size={12} color={colors.accent} />
          <Text style={[styles.offerTagText, { color: colors.accent }]}>{card.type === 'skill_card' ? 'Skill' : 'Bundle'}</Text>
        </View>
        <Text style={[styles.offerTitle, { color: colors.text }]} numberOfLines={2}>{card.title}</Text>
        {!!card.price && <Text style={[styles.offerPrice, { color: colors.text }]}>{card.price}</Text>}
        {!!card.description && <Text style={{ color: colors.textSecondary, fontSize: 13 }} numberOfLines={2}>{card.description}</Text>}
      </View>
    </View>
  );

  const WAVE = [6, 12, 18, 10, 22, 14, 8, 20, 16, 10, 24, 12, 18, 8, 14, 20, 10, 16, 6, 12];
  const renderVoice = (voice: any, message: Message, isMe: boolean) => {
    const playing = playingAudioId === message.id;
    const fg = isMe ? '#FFFFFF' : colors.text;
    const secs = Number(voice.duration) || 0;
    return (
      <TouchableOpacity style={styles.voiceRow} onPress={() => togglePlayAudio(voice, message.id)} activeOpacity={0.8}>
        {playing ? <Pause size={20} color={fg} fill={fg} /> : <Play size={20} color={fg} fill={fg} />}
        <View style={styles.wave}>
          {WAVE.map((h, i) => (
            <View key={i} style={{ width: 2.5, height: h, borderRadius: 2, backgroundColor: fg, opacity: playing ? 1 : 0.75 }} />
          ))}
        </View>
        <Text style={[styles.voiceTime, { color: fg }]}>{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}</Text>
      </TouchableOpacity>
    );
  };

  const bubbleRadius = (isMe: boolean, joinedAbove: boolean, joinedBelow: boolean) => {
    const R = 22, r = 5;
    return isMe
      ? { borderTopLeftRadius: R, borderBottomLeftRadius: R, borderTopRightRadius: joinedAbove ? r : R, borderBottomRightRadius: joinedBelow ? r : R }
      : { borderTopRightRadius: R, borderBottomRightRadius: R, borderTopLeftRadius: joinedAbove ? r : R, borderBottomLeftRadius: joinedBelow ? r : R };
  };

  const renderMessage = (message: Message, index: number) => {
    const prev = messages[index - 1];
    const next = messages[index + 1];
    const isMe = message.senderId === myId;
    const showSeparator = !prev || ts(message) - ts(prev) > SEPARATOR_GAP_MS;
    const joinedAbove = !!prev && !showSeparator && prev.senderId === message.senderId && ts(message) - ts(prev) < GROUP_GAP_MS;
    const nextSeparates = !next || ts(next) - ts(message) > SEPARATOR_GAP_MS;
    const joinedBelow = !!next && !nextSeparates && next.senderId === message.senderId && ts(next) - ts(message) < GROUP_GAP_MS;
    const meta: any = (message as any).metadata || {};
    const offer = meta.bundle_card || meta.skill_card;
    const text = (message.text || '').trim();
    const pending = String(message.id || '').startsWith('pending-');

    let body: React.ReactNode = null;
    if (meta.image) {
      const uri = imageUrlCache[meta.image.path] || meta.image.url || null;
      const w = Number(meta.image.width) || 3;
      const h = Number(meta.image.height) || 4;
      const width = 230;
      const height = Math.min(320, Math.max(140, (width * h) / w));
      body = uri ? (
        <TouchableOpacity activeOpacity={0.9} onPress={() => setViewerImage(uri)} onLongPress={() => onMessageLongPress(message)}>
          <Image source={{ uri }} style={[styles.photo, { width, height, opacity: pending ? 0.6 : 1 }]} resizeMode="cover" />
        </TouchableOpacity>
      ) : (
        <View style={[styles.photo, { width, height, backgroundColor: theirBubble }]} />
      );
    } else if (message.sharedPost) {
      body = renderSharedPost(message.sharedPost);
    } else if (offer) {
      body = renderOfferCard(offer);
    }

    const bubbleContent = meta.voice_note ? renderVoice(meta.voice_note, message, isMe) : text ? (
      <Text style={[styles.msgText, { color: isMe ? '#FFFFFF' : colors.text }]}>{renderTextWithMentions(text, isMe)}</Text>
    ) : null;

    const bubbleStyle = [styles.bubble, bubbleRadius(isMe, joinedAbove, joinedBelow)];

    return (
      <View key={message.id}>
        {showSeparator && <Text style={[styles.separator, { color: colors.textTertiary }]}>{separatorLabel(message.timestamp)}</Text>}
        <View style={[styles.msgRow, isMe ? styles.rowMine : styles.rowTheirs, { marginTop: joinedAbove ? 2 : 8 }]}>
          {!isMe && (
            <View style={styles.msgAvatarSlot}>
              {!joinedBelow && <Image source={{ uri: participant.avatar }} style={styles.msgAvatar} />}
            </View>
          )}
          <View style={{ maxWidth: '75%', alignItems: isMe ? 'flex-end' : 'flex-start', gap: 2 }}>
            {body}
            {bubbleContent && (
              <TouchableOpacity activeOpacity={0.85} onLongPress={() => onMessageLongPress(message)} delayLongPress={350}>
                {isMe ? (
                  <LinearGradient
                    colors={['#7C3AED', '#3B82F6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[bubbleStyle, { opacity: pending ? 0.7 : 1 }]}
                  >
                    {bubbleContent}
                  </LinearGradient>
                ) : (
                  <View style={[bubbleStyle, { backgroundColor: theirBubble }]}>{bubbleContent}</View>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
        {isMe && message.id === lastMineId && (
          <Text style={[styles.status, { color: colors.textTertiary }]}>
            {pending ? 'Sending…' : message.read ? 'Seen' : 'Sent'}
          </Text>
        )}
      </View>
    );
  };

  // Animated "typing…" bubble
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    if (!isTyping) return;
    const pulse = (v: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.3, duration: 300, useNativeDriver: true }),
        Animated.delay(450 - delay),
      ]));
    const anims = [pulse(dot1, 0), pulse(dot2, 150), pulse(dot3, 300)];
    anims.forEach((a) => a.start());
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 50);
    return () => anims.forEach((a) => a.stop());
  }, [isTyping, dot1, dot2, dot3]);

  const hasText = messageText.trim().length > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 4, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={{ paddingRight: 4 }}>
          <ChevronLeft size={30} color={colors.text} strokeWidth={2.2} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerUser} onPress={() => router.push(`/user/${participantId}` as any)} activeOpacity={0.7}>
          <View>
            <Image source={{ uri: participant.avatar }} style={[styles.headerAvatar, { backgroundColor: colors.backgroundTertiary }]} />
            {isOnline && <View style={[styles.onlineDot, { borderColor: colors.background }]} />}
          </View>
          <View style={{ flexShrink: 1 }}>
            <View style={styles.headerNameRow}>
              <Text style={[styles.headerName, { color: colors.text }]} numberOfLines={1}>{participant.name}</Text>
              {participant.isVerified && <BadgeCheck size={14} color={colors.accent} />}
            </View>
            <Text style={[styles.headerSub, { color: colors.textSecondary }]} numberOfLines={1}>
              {isTyping ? 'typing…' : isOnline ? 'Active now' : participant.username}
            </Text>
          </View>
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => Alert.alert('Call', `Call ${participant.name}?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Call', onPress: startCall }])}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Audio call"
          >
            <Phone size={24} color={colors.text} strokeWidth={1.9} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => Alert.alert('Video call', `Call ${participant.name}?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Call', onPress: startCall }])}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Video call"
          >
            <Video size={26} color={colors.text} strokeWidth={1.9} />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.flex}
          contentContainerStyle={styles.thread}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: false })}
        >
          {conversation?.hasMore ? (
            <TouchableOpacity style={styles.loadEarlier} onPress={() => loadEarlierMessages(participantId || '')}>
              <Text style={[styles.loadEarlierText, { color: colors.textSecondary }]}>Load earlier messages</Text>
            </TouchableOpacity>
          ) : (
            // Profile intro at the start of the thread, like Instagram
            <View style={styles.intro}>
              <Image source={{ uri: participant.avatar }} style={[styles.introAvatar, { backgroundColor: colors.backgroundTertiary }]} />
              <Text style={[styles.introName, { color: colors.text }]}>{participant.name}</Text>
              <Text style={[styles.introSub, { color: colors.textSecondary }]}>{participant.username} · Apparently</Text>
              <TouchableOpacity
                style={[styles.introBtn, { backgroundColor: colors.backgroundTertiary }]}
                onPress={() => router.push(`/user/${participantId}` as any)}
              >
                <Text style={[styles.introBtnText, { color: colors.text }]}>View profile</Text>
              </TouchableOpacity>
            </View>
          )}

          {messages.map(renderMessage)}

          {isTyping && (
            <View style={[styles.msgRow, styles.rowTheirs, { marginTop: 8 }]}>
              <View style={styles.msgAvatarSlot}>
                <Image source={{ uri: participant.avatar }} style={styles.msgAvatar} />
              </View>
              <View style={[styles.bubble, styles.typingBubble, { backgroundColor: theirBubble }]}>
                {[dot1, dot2, dot3].map((d, i) => (
                  <Animated.View key={i} style={[styles.typingDot, { backgroundColor: colors.textSecondary, opacity: d }]} />
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {showMentionSuggestions && mentionUsers.length > 0 && (
          <View style={[styles.mentions, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
            {mentionUsers.map((u) => (
              <TouchableOpacity key={u.id} style={styles.mentionRow} onPress={() => handleMentionSelect(u.username)}>
                <Image source={{ uri: u.avatar }} style={[styles.mentionAvatar, { backgroundColor: colors.backgroundTertiary }]} />
                <View>
                  <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>{u.username}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{u.name}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Composer ── */}
        <View style={[styles.composerWrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <View style={[styles.composer, { backgroundColor: colors.backgroundTertiary }]}>
            {isRecording ? (
              <>
                <TouchableOpacity style={[styles.roundBtn, { backgroundColor: '#FF3040' }]} onPress={cancelRecording} accessibilityLabel="Discard voice message">
                  <Trash2 size={18} color="#FFF" />
                </TouchableOpacity>
                <View style={styles.recording}>
                  <View style={styles.recDot} />
                  <Text style={[styles.recTime, { color: colors.text }]}>
                    {Math.floor(recordingDuration / 60)}:{String(recordingDuration % 60).padStart(2, '0')}
                  </Text>
                </View>
                <TouchableOpacity onPress={stopRecording} style={styles.sendTextBtn} accessibilityLabel="Send voice message">
                  <View style={[styles.roundBtn, { backgroundColor: colors.accent }]}>
                    <ArrowUp size={20} color="#FFF" />
                  </View>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.roundBtn, { backgroundColor: colors.accent }]}
                  onPress={() => pickImage('camera')}
                  disabled={imageUploading}
                  accessibilityLabel="Take a photo"
                >
                  <Camera size={19} color="#FFF" />
                </TouchableOpacity>
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Message..."
                  placeholderTextColor={colors.textTertiary}
                  value={messageText}
                  onChangeText={handleTextChange}
                  multiline
                  maxLength={1000}
                  testID="chat-input"
                />
                {hasText ? (
                  <TouchableOpacity onPress={handleSendMessage} style={styles.sendTextBtn} testID="chat-send">
                    <Text style={[styles.sendText, { color: colors.accent }]}>Send</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.composerIcons}>
                    <TouchableOpacity onPress={startRecording} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }} accessibilityLabel="Record voice message">
                      <Mic size={23} color={colors.text} strokeWidth={1.9} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => pickImage('library')} disabled={imageUploading} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }} accessibilityLabel="Send a photo">
                      <ImageIcon size={23} color={imageUploading ? colors.textTertiary : colors.text} strokeWidth={1.9} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => { handleTextChange(messageText + '@'); setShowMentionSuggestions(true); }}
                      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                      accessibilityLabel="Mention someone"
                    >
                      <Smile size={23} color={colors.text} strokeWidth={1.9} />
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </View>
          {imageUploading && <Text style={[styles.uploading, { color: colors.textSecondary }]}>Sending photo…</Text>}
        </View>
      </KeyboardAvoidingView>

      <Modal visible={!!viewerImage} transparent animationType="fade" onRequestClose={() => setViewerImage(null)}>
        <View style={styles.viewerBackdrop}>
          <TouchableOpacity style={[styles.viewerClose, { top: insets.top + 12 }]} onPress={() => setViewerImage(null)} hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}>
            <Text style={styles.viewerCloseText}>✕</Text>
          </TouchableOpacity>
          {viewerImage ? <Image source={{ uri: viewerImage }} style={styles.viewerImage} resizeMode="contain" /> : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  headerUser: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: { width: 36, height: 36, borderRadius: 18 },
  onlineDot: { position: 'absolute', right: -1, bottom: -1, width: 12, height: 12, borderRadius: 6, backgroundColor: '#22C55E', borderWidth: 2 },
  headerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerName: { fontSize: 16, fontWeight: '700' },
  headerSub: { fontSize: 12 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 20, paddingHorizontal: 8 },
  thread: { paddingHorizontal: 10, paddingBottom: 12, flexGrow: 1 },
  loadEarlier: { alignSelf: 'center', paddingVertical: 14 },
  loadEarlierText: { fontSize: 13, fontWeight: '600' },
  intro: { alignItems: 'center', paddingTop: 28, paddingBottom: 18, gap: 4 },
  introAvatar: { width: 96, height: 96, borderRadius: 48, marginBottom: 8 },
  introName: { fontSize: 20, fontWeight: '700' },
  introSub: { fontSize: 14 },
  introBtn: { marginTop: 12, paddingHorizontal: 14, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  introBtnText: { fontSize: 14, fontWeight: '600' },
  separator: { textAlign: 'center', fontSize: 12, fontWeight: '600', marginTop: 18, marginBottom: 6 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end' },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  msgAvatarSlot: { width: 28, marginRight: 8 },
  msgAvatar: { width: 28, height: 28, borderRadius: 14 },
  bubble: { paddingHorizontal: 14, paddingVertical: 9 },
  msgText: { fontSize: 16, lineHeight: 21 },
  status: { alignSelf: 'flex-end', fontSize: 12, marginTop: 3, marginRight: 4 },
  photo: { borderRadius: 18 },
  card: { width: 230, borderRadius: 18, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 },
  cardAvatar: { width: 24, height: 24, borderRadius: 12 },
  cardUser: { fontSize: 13, fontWeight: '700', flexShrink: 1 },
  cardImage: { width: '100%', height: 230 },
  cardCaption: { fontSize: 13, lineHeight: 18, paddingHorizontal: 10, paddingTop: 8 },
  cardStats: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 10 },
  cardStatText: { fontSize: 12, marginRight: 8 },
  offerTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  offerTagText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  offerTitle: { fontSize: 15, fontWeight: '700' },
  offerPrice: { fontSize: 14, fontWeight: '600' },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 190 },
  wave: { flexDirection: 'row', alignItems: 'center', gap: 2.5, flex: 1 },
  voiceTime: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  typingBubble: { flexDirection: 'row', gap: 5, borderRadius: 22, paddingVertical: 14 },
  typingDot: { width: 8, height: 8, borderRadius: 4 },
  mentions: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 4 },
  mentionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 8 },
  mentionAvatar: { width: 36, height: 36, borderRadius: 18 },
  composerWrap: { paddingHorizontal: 10, paddingTop: 6 },
  composer: { flexDirection: 'row', alignItems: 'center', minHeight: 48, borderRadius: 24, paddingLeft: 6, paddingRight: 14, gap: 10 },
  roundBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, fontSize: 16, maxHeight: 120, paddingTop: Platform.OS === 'ios' ? 12 : 8, paddingBottom: Platform.OS === 'ios' ? 12 : 8 },
  composerIcons: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  sendTextBtn: { paddingVertical: 6 },
  sendText: { fontSize: 16, fontWeight: '700' },
  recording: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF3040' },
  recTime: { fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] },
  uploading: { fontSize: 12, textAlign: 'center', marginTop: 4 },
  viewerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' },
  viewerClose: { position: 'absolute', right: 20, zIndex: 2 },
  viewerCloseText: { color: '#FFF', fontSize: 26 },
  viewerImage: { width: '100%', height: '80%' },
});
