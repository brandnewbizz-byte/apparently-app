import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Info, Megaphone, AlertTriangle, X } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

/**
 * A one-line notice set from the admin dashboard (Announcements → App banner),
 * stored in app_settings.app_banner as { text, tone, link }. People can close it;
 * a new message shows again.
 */
interface Banner { text: string; tone?: 'info' | 'success' | 'warning'; link?: string | null }

const DISMISSED_KEY = 'app_banner_dismissed';
const TONES = {
  info: { bg: 'rgba(56,189,248,0.14)', border: 'rgba(56,189,248,0.45)', fg: '#38BDF8', Icon: Info },
  success: { bg: 'rgba(16,185,129,0.14)', border: 'rgba(16,185,129,0.45)', fg: '#10B981', Icon: Megaphone },
  warning: { bg: 'rgba(245,158,11,0.16)', border: 'rgba(245,158,11,0.5)', fg: '#F59E0B', Icon: AlertTriangle },
} as const;

export default function AppBanner({ textColor }: { textColor: string }) {
  const [banner, setBanner] = useState<Banner | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await supabase.from('app_settings').select('value').eq('key', 'app_banner').maybeSingle();
      const v = (data?.value ?? null) as Banner | null;
      setBanner(v && typeof v.text === 'string' && v.text.trim() ? v : null);
    } catch {
      // A missing banner is never an error worth showing.
    }
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(DISMISSED_KEY).then(setDismissed).catch(() => undefined);
    load();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') load(); });
    return () => sub.remove();
  }, [load]);

  if (!banner || dismissed === banner.text) return null;
  const tone = TONES[banner.tone || 'info'] || TONES.info;
  const Icon = tone.Icon;
  const open = banner.link && /^https?:\/\//i.test(banner.link) ? () => Linking.openURL(banner.link!).catch(() => undefined) : undefined;

  return (
    <Pressable
      onPress={open}
      disabled={!open}
      accessibilityRole={open ? 'link' : 'text'}
      style={[styles.wrap, { backgroundColor: tone.bg, borderColor: tone.border }]}
      testID="app-banner"
    >
      <Icon size={16} color={tone.fg} />
      <Text style={[styles.text, { color: textColor }]} numberOfLines={3}>
        {banner.text}{open ? <Text style={{ color: tone.fg, fontWeight: '700' }}>  Open</Text> : null}
      </Text>
      <Pressable
        hitSlop={10}
        accessibilityLabel="Close notice"
        onPress={() => {
          setDismissed(banner.text);
          AsyncStorage.setItem(DISMISSED_KEY, banner.text).catch(() => undefined);
        }}
      >
        <X size={16} color={textColor} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 10, paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1,
  },
  text: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '500' },
});
