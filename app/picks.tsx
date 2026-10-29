import React, { useEffect, useMemo, useReducer, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { feedStore, type FeedProfile } from '@/lib/feedEngine';
import { GOING_WITH, MAX_PICKS, VIBES, type GoingWith } from '@/lib/vibes';

const VIOLET = '#7B61FF';
const PINK = '#E91E8C';

/**
 * "What's your kind of plan?" — shown once on Home for accounts that haven't
 * picked yet, and from Settings → Your picks. The picks give those kinds of
 * bundles a head start in the Home feed (see lib/feedEngine.ts).
 */
export default function PicksScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  useEffect(() => feedStore.subscribe(rerender), []);
  useEffect(() => { feedStore.load(user?.id || null); }, [user?.id]);
  // Wait for the saved picks so Settings → Your picks opens filled in.
  const ready = !!user?.id && feedStore.uid === user.id && feedStore.loaded && feedStore.synced;
  if (!ready) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={VIOLET} />
      </View>
    );
  }
  return <PicksForm editing={edit === '1'} saved={feedStore.state.profile} />;
}

function PicksForm({ editing, saved }: { editing: boolean; saved?: FeedProfile }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [picks, setPicks] = useState<string[]>(() => saved?.picks || []);
  const [goingWith, setGoingWith] = useState<GoingWith | undefined>(saved?.goingWith);

  const full = picks.length >= MAX_PICKS;
  const tap = () => { if (Platform.OS !== 'web') Haptics.selectionAsync(); };
  const toggle = (k: string) => {
    tap();
    setPicks((p) => (p.includes(k) ? p.filter((x) => x !== k) : p.length >= MAX_PICKS ? p : [...p, k]));
  };
  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/(home)' as never));
  const done = () => {
    if (!picks.length) return;
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    feedStore.setProfile({ picks, goingWith });
    close();
  };
  const skip = () => { if (!editing) feedStore.setProfile('skip'); close(); };

  const counter = useMemo(() => (picks.length ? `${picks.length} of ${MAX_PICKS} picked` : `Pick up to ${MAX_PICKS}`), [picks.length]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: editing }} />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={skip} hitSlop={12} testID="picks-skip" accessibilityRole="button">
          <Text style={[styles.skip, { color: colors.textSecondary }]}>{editing ? 'Cancel' : 'Skip for now'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 120 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <Text style={[styles.kicker, { color: VIOLET }]}>{editing ? 'YOUR PICKS' : 'WELCOME TO APPARENTLY'}</Text>
        <Text style={[styles.title, { color: colors.text }]}>What’s your kind of plan?</Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>
          Pick up to {MAX_PICKS}. We’ll show you more of these first, and learn as you go.
        </Text>

        <View style={styles.grid}>
          {VIBES.map((v) => {
            const on = picks.includes(v.key);
            const dim = full && !on;
            return (
              <TouchableOpacity
                key={v.key} onPress={() => toggle(v.key)} activeOpacity={0.8} disabled={dim}
                style={[styles.tile, { backgroundColor: on ? 'rgba(123,97,255,0.10)' : colors.surface, borderColor: on ? VIOLET : colors.border, opacity: dim ? 0.45 : 1 }]}
                accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled: dim }} accessibilityLabel={v.label}
                testID={`pick-${v.key}`}
              >
                {on ? <View style={styles.check}><Check size={13} color="#FFFFFF" strokeWidth={3} /></View> : null}
                <Text style={styles.tileIcon}>{v.icon}</Text>
                <Text style={[styles.tileLabel, { color: colors.text }]}>{v.label}</Text>
                <Text style={[styles.tileBlurb, { color: colors.textTertiary }]} numberOfLines={2}>{v.blurb}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.question, { color: colors.text }]}>Usually going with…</Text>
        <View style={styles.chips}>
          {GOING_WITH.map((g) => {
            const on = goingWith === g.key;
            return (
              <TouchableOpacity key={g.key} onPress={() => { tap(); setGoingWith(on ? undefined : g.key); }} activeOpacity={0.8}
                style={[styles.chip, { borderColor: on ? VIOLET : colors.border, backgroundColor: on ? VIOLET : colors.surface }]}
                accessibilityRole="radio" accessibilityState={{ checked: on }} testID={`going-${g.key}`}>
                <Text style={[styles.chipText, { color: on ? '#FFFFFF' : colors.text }]}>{g.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={[styles.note, { color: colors.textTertiary }]}>You can change these any time in Settings → Your picks.</Text>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 14, backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <Text style={[styles.counter, { color: colors.textSecondary }]}>{counter}</Text>
        <TouchableOpacity onPress={done} disabled={!picks.length} activeOpacity={0.85} style={{ opacity: picks.length ? 1 : 0.4 }} testID="picks-done" accessibilityRole="button">
          <LinearGradient colors={[VIOLET, PINK]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cta}>
            <Text style={styles.ctaText}>{editing ? 'Save my picks' : 'Show me my feed'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, height: 32, alignItems: 'center' },
  skip: { fontSize: 15, fontWeight: '600' },
  content: { paddingHorizontal: 20, paddingTop: 8, maxWidth: 560, width: '100%', alignSelf: 'center' },
  kicker: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  title: { fontSize: 30, fontWeight: '800', marginTop: 6, letterSpacing: -0.5 },
  sub: { fontSize: 15, lineHeight: 21, marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 22 },
  tile: { width: '47.8%', flexGrow: 1, borderWidth: 1.5, borderRadius: 18, padding: 14, minHeight: 116 },
  check: { position: 'absolute', top: 10, right: 10, width: 22, height: 22, borderRadius: 11, backgroundColor: VIOLET, alignItems: 'center', justifyContent: 'center' },
  tileIcon: { fontSize: 30 },
  tileLabel: { fontSize: 16, fontWeight: '800', marginTop: 8 },
  tileBlurb: { fontSize: 12.5, lineHeight: 17, marginTop: 3 },
  question: { fontSize: 17, fontWeight: '800', marginTop: 28 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 16 },
  chipText: { fontSize: 14, fontWeight: '700' },
  note: { fontSize: 12.5, marginTop: 18 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  counter: { textAlign: 'center', fontSize: 13, fontWeight: '600', marginBottom: 10 },
  cta: { height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', maxWidth: 520, width: '100%', alignSelf: 'center' },
  ctaText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
});
