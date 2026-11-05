/**
 * Full-screen incoming call (like Instagram / WhatsApp): the caller's photo
 * blurred behind their name, the phone rings and vibrates, and two big
 * buttons — Decline and Accept. It closes by itself if the caller hangs up
 * or nobody answers.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Phone, PhoneOff, Video, User } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { playTone, stopTone } from '@/lib/callTones';
import { CALL_RING_MS, declineCall, markCallNotificationRead, setCallUiActive } from '@/lib/calls';
import { dismissCallNotifications } from '@/lib/notifications';
import { ringStart, ringStop } from '@/lib/callAudio';

export default function IncomingCallScreen() {
  const p = useLocalSearchParams<Record<string, string>>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [gone, setGone] = useState<null | 'missed'>(null);
  const done = useRef(false);

  const roomId = p.roomId || '';
  const callerName = p.callerName || 'Someone';
  const callerId = p.callerId || '';
  const myId = p.currentUserId || '';
  const video = p.video === '1';
  const avatar = p.peerAvatar || '';
  const createdAt = Number(p.ringStartedAt) || Date.now();

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/(home)' as never);
  };

  const finish = (how: 'answer' | 'decline' | 'missed') => {
    if (done.current) return;
    done.current = true;
    ringStop();
    stopTone();
    dismissCallNotifications();
    markCallNotificationRead(p.notificationId);
    if (how === 'answer') {
      const { ringStartedAt, notificationId, ...params } = p;
      router.replace({ pathname: '/call/[roomId]' as any, params: params as any } as any);
      return;
    }
    if (how === 'decline') {
      declineCall(roomId, myId, callerId);
      close();
      return;
    }
    setGone('missed');
    setTimeout(close, 1600);
  };

  // Ring until answered, declined, the caller hangs up or time runs out.
  useEffect(() => {
    setCallUiActive(true, `ring:${roomId}`);
    // The phone's own ringtone when we can; otherwise our built-in one.
    if (!ringStart()) playTone('ringtone');
    dismissCallNotifications();
    const left = Math.max(5_000, CALL_RING_MS - (Date.now() - createdAt));
    const t = setTimeout(() => finish('missed'), left);

    // The caller hanging up stops the ringing here too.
    let ch: ReturnType<typeof supabase.channel> | null = null;
    if (roomId) {
      ch = supabase.channel(`call:${roomId}`, { config: { broadcast: { self: false } } });
      ch.on('broadcast', { event: 'call_ended' }, ({ payload }: any) => {
        if (!payload?.peerId || payload.peerId === callerId) finish('missed');
      });
      ch.subscribe();
    }
    return () => {
      clearTimeout(t);
      ringStop();
      stopTone();
      setCallUiActive(false, `ring:${roomId}`);
      if (ch) supabase.removeChannel(ch).then(() => {}, () => {});
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Soft pulsing rings around the photo.
  const pulseA = useRef(new Animated.Value(0)).current;
  const pulseB = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const mk = (v: Animated.Value) => Animated.loop(
      Animated.timing(v, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    );
    const a = mk(pulseA);
    const b = mk(pulseB);
    a.start();
    const t = setTimeout(() => b.start(), 900);
    return () => { clearTimeout(t); a.stop(); b.stop(); };
  }, [pulseA, pulseB]);
  const ring = (v: Animated.Value) => ({
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
  });

  // Accept button gently bounces (Instagram).
  const bounce = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bounce, { toValue: -8, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(bounce, { toValue: 0, duration: 380, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.delay(700),
    ]));
    loop.start();
    return () => loop.stop();
  }, [bounce]);

  const press = (how: 'answer' | 'decline') => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    finish(how);
  };

  return (
    <View style={styles.container}>
      {avatar ? <Image source={{ uri: avatar }} style={StyleSheet.absoluteFill} blurRadius={40} /> : null}
      <LinearGradient colors={['rgba(10,10,20,0.55)', 'rgba(10,10,20,0.85)', '#0A0A14']} style={StyleSheet.absoluteFill} />

      <View style={[styles.top, { paddingTop: insets.top + 56 }]}>
        <View style={styles.avatarWrap}>
          <Animated.View style={[styles.ring, ring(pulseA)]} />
          <Animated.View style={[styles.ring, ring(pulseB)]} />
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarEmpty]}><User size={56} color="#FFF" /></View>
          )}
        </View>
        <Text style={styles.name} numberOfLines={1}>{callerName}</Text>
        <Text style={styles.sub}>
          {gone === 'missed' ? 'Missed call' : video ? 'Apparently video call…' : 'Apparently audio call…'}
        </Text>
      </View>

      {gone ? null : (
        <View style={[styles.actions, { paddingBottom: insets.bottom + 56 }]}>
          <View style={styles.action}>
            <TouchableOpacity style={[styles.btn, styles.decline]} onPress={() => press('decline')} accessibilityLabel="Decline call">
              <PhoneOff size={30} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.label}>Decline</Text>
          </View>
          <View style={styles.action}>
            <Animated.View style={{ transform: [{ translateY: bounce }] }}>
              <TouchableOpacity style={[styles.btn, styles.accept]} onPress={() => press('answer')} accessibilityLabel="Accept call">
                {video ? <Video size={30} color="#FFF" /> : <Phone size={30} color="#FFF" />}
              </TouchableOpacity>
            </Animated.View>
            <Text style={styles.label}>Accept</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const AV = 132;
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A14', justifyContent: 'space-between' },
  top: { alignItems: 'center', paddingHorizontal: 24 },
  avatarWrap: { width: AV, height: AV, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  ring: { position: 'absolute', width: AV, height: AV, borderRadius: AV / 2, borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)' },
  avatar: { width: AV, height: AV, borderRadius: AV / 2, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)' },
  avatarEmpty: { backgroundColor: '#3A3A4A', alignItems: 'center', justifyContent: 'center' },
  name: { color: '#FFF', fontSize: 30, fontWeight: '700', maxWidth: '90%' },
  sub: { color: 'rgba(255,255,255,0.75)', fontSize: 16, marginTop: 8 },
  actions: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 32 },
  action: { alignItems: 'center', width: 120 },
  btn: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  decline: { backgroundColor: '#FF3B30' },
  accept: { backgroundColor: '#22C55E' },
  label: { color: '#FFF', fontSize: 14, marginTop: 10, fontWeight: '500' },
});
