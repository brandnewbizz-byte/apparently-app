/** Push notifications: one master switch, then a switch per kind. */
import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Platform, Text, StyleSheet } from 'react-native';
import { Bell, MessageCircle, ShoppingBag, Heart, MessageSquare, AtSign, UserPlus, Radio, Phone, Eye, Volume2, BellOff } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { SettingsPage, Group, Item, ToggleItem } from '@/components/settings/SettingsUI';
import { registerForPushNotifications } from '@/lib/notifications';

const W = '#FFFFFF';

// Each switch controls every notification type in its group (the push trigger
// checks `notification_prefs[type]`).
const GROUPS: { title: string; items: { label: string; hint: string; keys: string[]; icon: React.ReactNode; color: string }[] }[] = [
  {
    title: 'Messages & orders',
    items: [
      { label: 'Messages', hint: 'New chats and voice notes', keys: ['messages', 'new_message'], icon: <MessageCircle size={18} color={W} />, color: '#0EA5E9' },
      { label: 'Grabs & orders', hint: 'Grabs on your listings, accepted and declined orders', keys: ['bundle_grab', 'skill_grab', 'service_response', 'new_grab', 'grab_accepted', 'grab_declined', 'grab_cancelled', 'bundle_sold', 'deal_sold', 'booking_confirmed', 'booking_cancelled'], icon: <ShoppingBag size={18} color={W} />, color: '#8B5CF6' },
    ],
  },
  {
    title: 'Posts & people',
    items: [
      { label: 'Likes', hint: 'Likes on your posts', keys: ['like', 'new_like'], icon: <Heart size={18} color={W} />, color: '#EF4444' },
      { label: 'Comments', hint: 'Comments and replies', keys: ['comment', 'new_comment'], icon: <MessageSquare size={18} color={W} />, color: '#F59E0B' },
      { label: 'Mentions', hint: 'When someone @mentions you', keys: ['mention'], icon: <AtSign size={18} color={W} />, color: '#6366F1' },
      { label: 'New followers', hint: 'Follows and follow requests', keys: ['follow', 'follow_request'], icon: <UserPlus size={18} color={W} />, color: '#14B8A6' },
    ],
  },
  {
    title: 'Live',
    items: [
      { label: 'Spot invites', hint: 'Invites to hang out in a room', keys: ['room_invite'], icon: <Radio size={18} color={W} />, color: '#EC4899' },
      { label: 'Calls', hint: 'Incoming calls', keys: ['call', 'call_request'], icon: <Phone size={18} color={W} />, color: '#22C55E' },
    ],
  },
];

export default function NotificationSettings() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('profiles').select('notification_prefs').eq('id', user.id).maybeSingle()
      .then(({ data }) => { if (data?.notification_prefs) setPrefs(data.notification_prefs as Record<string, boolean>); });
  }, [user?.id]);

  const save = async (next: Record<string, boolean>) => {
    if (!user?.id) return;
    const prev = prefs;
    setPrefs(next);
    const { error } = await supabase.from('profiles').update({ notification_prefs: next }).eq('id', user.id);
    if (error) setPrefs(prev);
  };

  // Is Apparently allowed to show notifications at all (phone setting)?
  const [osAllowed, setOsAllowed] = useState<boolean | null>(null);
  const checkOs = useCallback(async () => {
    if (Platform.OS === 'web') return;
    try {
      const N = await import('expo-notifications');
      const st = await N.getPermissionsAsync();
      setOsAllowed(st.granted);
    } catch { setOsAllowed(null); }
  }, []);
  useEffect(() => {
    checkOs();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') checkOs(); });
    return () => sub.remove();
  }, [checkOs]);
  const turnOnOs = async () => {
    if (!user?.id) return;
    const token = await registerForPushNotifications(user.id);
    if (!token) Linking.openSettings().catch(() => {});
    checkOs();
  };

  const allOn = prefs.all !== false;
  const isOn = (keys: string[]) => prefs[keys[0]] !== false;
  const setGroup = (keys: string[], on: boolean) => {
    const next = { ...prefs };
    keys.forEach((k) => { next[k] = on; });
    save(next);
  };

  return (
    <SettingsPage title="Notifications">
      {osAllowed === false ? (
        <Group footer="Your phone is blocking notifications from Apparently, so calls, messages and other alerts can't reach you.">
          <Item icon={<BellOff size={18} color={W} />} iconBg="#F59E0B" label="Turn on notifications" sub="Allow Apparently in your phone's settings" onPress={turnOnOs} testID="notif-os-off" />
        </Group>
      ) : null}
      <Group footer={allOn ? undefined : 'You won’t get any push notifications. Your in-app notifications still show up.'}>
        <ToggleItem icon={<Bell size={18} color={W} />} iconBg="#EF4444" label="Pause all" sub="Turn off every push notification" value={!allOn} onChange={(v) => save({ ...prefs, all: !v })} testID="notif-pause-all" />
      </Group>
      {allOn ? GROUPS.map((g) => (
        <Group key={g.title} title={g.title}>
          {g.items.map((it) => (
            <ToggleItem key={it.label} icon={it.icon} iconBg={it.color} label={it.label} sub={it.hint} value={isOn(it.keys)} onChange={(v) => setGroup(it.keys, v)} />
          ))}
        </Group>
      )) : (
        <Text style={[styles.paused, { color: colors.textSecondary }]}>Notifications are paused.</Text>
      )}
      <Group title="How they look" footer="Sounds, vibration, lock-screen and banner style for each kind (calls, messages, activity) are set in your phone's settings for Apparently.">
        <ToggleItem icon={<Eye size={18} color={W} />} iconBg="#0EA5E9" label="Show message previews" sub="Show the text of messages in notifications" value={prefs.previews !== false} onChange={(v) => save({ ...prefs, previews: v })} testID="notif-previews" />
        {Platform.OS !== 'web' ? (
          <Item icon={<Volume2 size={18} color={W} />} iconBg="#64748B" label="Sounds & banners" sub="Open phone notification settings" onPress={() => Linking.openSettings().catch(() => {})} />
        ) : null}
      </Group>
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  paused: { textAlign: 'center', marginTop: 28, fontSize: 15 },
});
