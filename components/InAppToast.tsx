/**
 * Instagram-style banner at the top of the screen while you're using the app:
 * a new message ("Name: text") or new activity (likes, comments, follows,
 * grabs, invites). Tap to open it, swipe up or wait to dismiss.
 *
 * Works from the live database feed, so it shows even when the phone isn't
 * receiving push notifications. Calls use the full-screen ringing screen instead.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Image, PanResponder, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getActiveConversation } from '@/lib/notifications';
import { isCallNotification, isCallUiActive } from '@/lib/calls';

interface Toast { key: string; title: string; body: string; avatar?: string | null; href: string }

const SHOW_MS = 4000;

export default function InAppToast() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<Toast | null>(null);
  const y = useRef(new Animated.Value(-160)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const names = useRef<Record<string, { name: string; avatar: string | null }>>({});

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    Animated.timing(y, { toValue: -160, duration: 200, useNativeDriver: true }).start(() => setToast(null));
  }, [y]);

  const show = useCallback((t: Toast) => {
    if (isCallUiActive()) return;
    setToast(t);
    y.setValue(-160);
    Animated.spring(y, { toValue: 0, useNativeDriver: true, friction: 8, tension: 80 }).start();
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(hide, SHOW_MS);
  }, [y, hide]);

  const person = useCallback(async (id: string) => {
    if (names.current[id]) return names.current[id];
    const { data } = await supabase.from('profiles').select('full_name, username, avatar').eq('id', id).maybeSingle();
    const v = { name: (data as any)?.full_name || (data as any)?.username || 'Someone', avatar: (data as any)?.avatar || null };
    names.current[id] = v;
    return v;
  }, []);

  useEffect(() => {
    const me = user?.id;
    if (!me) return;
    const ch = supabase
      .channel(`in-app-toast:${me}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${me}` }, async (p: any) => {
        const m = p?.new;
        if (!m?.sender_id || m.sender_id === me || getActiveConversation() === m.sender_id) return;
        const who = await person(m.sender_id);
        const md = m.metadata || {};
        const body = md.voice_note ? '🎤 Voice note' : md.image ? '📷 Photo' : md.payment_request ? '💳 Payment request' : (m.content || 'Sent you a message');
        show({ key: `m-${m.id}`, title: who.name, body, avatar: who.avatar, href: `/inbox/conversation/${m.sender_id}` });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${me}` }, (p: any) => {
        const n = p?.new;
        if (!n || isCallNotification(n.type) || n.actor_id === me) return;
        const d = n.data || {};
        const href =
          d.kind === 'missed_call' && d.caller_id ? `/inbox/conversation/${d.caller_id}`
          : n.type === 'room_invite' && d.room_id ? `/(tabs)/live/room/${d.room_id}`
          : n.type === 'follow' && n.actor_id && d.kind !== 'follow_request' ? `/user/${n.actor_id}`
          : (n.type === 'bundle_grab' || n.type === 'skill_grab' || n.type === 'service_grab' || n.type === 'service_response') && n.actor_id ? `/inbox/conversation/${n.actor_id}`
          : '/notifications';
        show({ key: `n-${n.id}`, title: n.title || 'New notification', body: n.body || '', avatar: n.actor_avatar || null, href });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, person, show]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => g.dy < -6,
    onPanResponderMove: (_e, g) => { if (g.dy < 0) y.setValue(g.dy); },
    onPanResponderRelease: (_e, g) => {
      if (g.dy < -30) hide();
      else Animated.spring(y, { toValue: 0, useNativeDriver: true }).start();
    },
  })).current;

  if (!toast) return null;
  return (
    <Animated.View {...pan.panHandlers} style={[styles.wrap, { top: insets.top + 6, transform: [{ translateY: y }] }]} pointerEvents="box-none">
      <TouchableOpacity
        activeOpacity={0.9}
        style={styles.card}
        onPress={() => { const h = toast.href; hide(); router.push(h as never); }}
        accessibilityRole="button"
        accessibilityLabel={`${toast.title}. ${toast.body}`}
      >
        {toast.avatar ? <Image source={{ uri: toast.avatar }} style={styles.avatar} /> : (
          <View style={[styles.avatar, styles.avatarEmpty]}><Text style={styles.initial}>{toast.title.charAt(0).toUpperCase()}</Text></View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{toast.title}</Text>
          {toast.body ? <Text style={styles.body} numberOfLines={2}>{toast.body}</Text> : null}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 10, right: 10, zIndex: 9999, elevation: 30 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18,
    backgroundColor: 'rgba(28,28,34,0.96)',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarEmpty: { backgroundColor: '#E91E8C', alignItems: 'center', justifyContent: 'center' },
  initial: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  title: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  body: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 1 },
});
