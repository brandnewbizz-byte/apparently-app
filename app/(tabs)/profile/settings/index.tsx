/**
 * Settings home: search, your profile, then short groups that each open their
 * own page (the layout Instagram, X and TikTok use).
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import {
  Search, X, User, UserCog, Crown, Banknote, Bell, Sparkles, Palette, ShieldOff, LifeBuoy, Shield, FileText, Info, LogOut, ChevronRight,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSocial } from '@/contexts/SocialContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { supabase } from '@/lib/supabase';
import { planFor } from '@/lib/plans';
import { feedStore } from '@/lib/feedEngine';
import { VIBES } from '@/lib/vibes';
import { getPayoutStatus } from '@/lib/payments';
import { confirmAction, notify } from '@/lib/dialog';
import { PRIVACY_POLICY_URL, SUPPORT_EMAIL, SUPPORT_URL, TERMS_URL } from '@/constants/app';
import { SettingsPage, Group, Item, tap, DANGER } from '@/components/settings/SettingsUI';

interface Entry {
  key: string;
  group: string;
  label: string;
  keywords: string;
  icon: React.ReactNode;
  color: string;
  value?: string;
  onPress?: () => void;
  testID?: string;
}

const W = '#FFFFFF';

export default function SettingsHome() {
  const router = useRouter();
  const { colors, themeMode } = useTheme();
  const { user, signOut } = useAuth();
  const { blockedUserIds } = useSocial();
  const { plan: sub } = useSubscription();
  const [q, setQ] = useState('');

  // Small status hints shown on the right of a few rows.
  const [notifOn, setNotifOn] = useState<boolean | null>(null);
  const [payouts, setPayouts] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!user?.id) return;
    let on = true;
    supabase.from('profiles').select('notification_prefs').eq('id', user.id).maybeSingle()
      .then(({ data }) => { if (on) setNotifOn((data?.notification_prefs as any)?.all !== false); });
    getPayoutStatus()
      .then((st) => { if (on) setPayouts(st.charges_enabled ? 'On' : st.connected ? 'Finish setup' : 'Set up'); })
      .catch(() => { if (on) setPayouts(undefined); });
    return () => { on = false; };
  }, [user?.id]);

  const go = (path: string) => router.push(path as never);
  const openUrl = (url: string) => Linking.openURL(url).catch(() => notify('Could not open link'));
  const version = Constants.expoConfig?.version || Application.nativeApplicationVersion || '1.0.0';
  const build = Application.nativeBuildVersion;

  const logOut = () => confirmAction(
    `Log out of @${user?.username || 'your account'}?`,
    'You can log back in any time.',
    'Log out',
    () => { signOut(); },
    true,
  );

  const picks = (feedStore.state.profile?.picks || []).map((k) => VIBES.find((v) => v.key === k)?.label).filter(Boolean).join(', ');
  const themeLabel = themeMode === 'dark' ? 'Dark' : themeMode === 'light' ? 'Light' : 'Automatic';

  const entries: Entry[] = [
    { key: 'account', group: 'Your account', label: 'Account', keywords: 'email password delete account login security personal details', icon: <UserCog size={18} color={W} />, color: '#64748B', value: user?.email || undefined, onPress: () => go('/profile/settings/account'), testID: 'settings-account' },
    ...(sub.enforced ? [{ key: 'plan', group: 'Your account', label: 'Plan & usage', keywords: 'subscription plan billing upgrade storage space restore purchases pro plus basic', icon: <Crown size={18} color={W} />, color: '#F59E0B', value: planFor(sub.tier).name, onPress: () => go('/profile/settings/plan'), testID: 'settings-plan' }] : []),
    { key: 'payouts', group: 'Your account', label: 'Get paid', keywords: 'payments payouts bank stripe earnings money', icon: <Banknote size={18} color={W} />, color: '#16A34A', value: payouts, onPress: () => go('/payouts'), testID: 'settings-get-paid' },
    { key: 'notifications', group: 'How you use Apparently', label: 'Notifications', keywords: 'push alerts messages likes comments follows calls', icon: <Bell size={18} color={W} />, color: '#EF4444', value: notifOn == null ? undefined : notifOn ? 'On' : 'Off', onPress: () => go('/profile/settings/notifications'), testID: 'settings-notifications' },
    { key: 'picks', group: 'How you use Apparently', label: 'Your picks', keywords: 'home feed interests vibes preferences', icon: <Sparkles size={18} color={W} />, color: '#8B5CF6', value: picks || 'Choose', onPress: () => go('/picks?edit=1'), testID: 'settings-your-picks' },
    { key: 'appearance', group: 'How you use Apparently', label: 'Appearance', keywords: 'dark mode light theme display', icon: <Palette size={18} color={W} />, color: '#0EA5E9', value: themeLabel, onPress: () => go('/profile/settings/appearance'), testID: 'settings-appearance' },
    { key: 'blocked', group: 'Privacy & safety', label: 'Blocked accounts', keywords: 'block unblock privacy safety', icon: <ShieldOff size={18} color={W} />, color: '#475569', value: blockedUserIds.length ? String(blockedUserIds.length) : undefined, onPress: () => go('/profile/settings/blocked'), testID: 'settings-blocked' },
    ...(SUPPORT_EMAIL ? [{ key: 'help', group: 'Support & about', label: 'Help & support', keywords: 'contact email help support problem', icon: <LifeBuoy size={18} color={W} />, color: '#06B6D4', onPress: () => openUrl(SUPPORT_URL || `mailto:${SUPPORT_EMAIL}`) }] : []),
    ...(PRIVACY_POLICY_URL ? [{ key: 'privacy', group: 'Support & about', label: 'Privacy Policy', keywords: 'privacy policy legal data', icon: <Shield size={18} color={W} />, color: '#6366F1', onPress: () => openUrl(PRIVACY_POLICY_URL) }] : []),
    ...(TERMS_URL ? [{ key: 'terms', group: 'Support & about', label: 'Terms of Service', keywords: 'terms legal', icon: <FileText size={18} color={W} />, color: '#6366F1', onPress: () => openUrl(TERMS_URL) }] : []),
    { key: 'about', group: 'Support & about', label: 'About Apparently', keywords: 'version about app', icon: <Info size={18} color={W} />, color: '#94A3B8', value: `Version ${version}${build ? ` (${build})` : ''}` },
  ];

  const query = q.trim().toLowerCase();
  const results = query ? entries.filter((e) => `${e.label} ${e.keywords} ${e.group}`.toLowerCase().includes(query)) : [];
  const groups = ['Your account', 'How you use Apparently', 'Privacy & safety', 'Support & about'];

  const renderEntry = (e: Entry) => (
    <Item key={e.key} icon={e.icon} iconBg={e.color} label={e.label} value={e.value} onPress={e.onPress} testID={e.testID} />
  );

  return (
    <SettingsPage title="Settings" testID="settings-home">
      {/* Search */}
      <View style={[styles.search, { backgroundColor: colors.surfaceHighlight }]}>
        <Search size={17} color={colors.textTertiary} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search settings"
          placeholderTextColor={colors.textTertiary}
          style={[styles.searchInput, { color: colors.text }]}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          accessibilityLabel="Search settings"
          testID="settings-search"
        />
        {q ? (
          <TouchableOpacity onPress={() => setQ('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Clear search">
            <X size={17} color={colors.textTertiary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {query ? (
        results.length ? (
          <Group>{results.map(renderEntry)}</Group>
        ) : (
          <Text style={[styles.noResults, { color: colors.textSecondary }]}>No settings match “{q.trim()}”.</Text>
        )
      ) : (
        <>
          {/* Profile */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => { tap(); go('/profile/settings/edit-profile'); }}
            style={[styles.profile, { backgroundColor: colors.surface, borderColor: colors.border }]}
            accessibilityLabel="Edit profile"
            testID="settings-edit-profile"
          >
            {user?.avatar ? <Image source={{ uri: user.avatar }} style={styles.avatar} /> : (
              <View style={[styles.avatar, styles.center, { backgroundColor: colors.surfaceHighlight }]}><User size={26} color={colors.textSecondary} /></View>
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{user?.fullName || user?.username || 'Your profile'}</Text>
              <Text style={[styles.handle, { color: colors.textSecondary }]} numberOfLines={1}>@{user?.username || 'username'}</Text>
              <Text style={[styles.editHint, { color: colors.accent }]}>Edit profile</Text>
            </View>
            <ChevronRight size={20} color={colors.textTertiary} />
          </TouchableOpacity>

          {groups.map((g) => (
            <Group key={g} title={g}>{entries.filter((e) => e.group === g).map(renderEntry)}</Group>
          ))}

          <Group title="Login">
            <Item label={`Log out @${user?.username || ''}`.trim()} onPress={logOut} danger icon={<LogOut size={18} color={W} />} iconBg={DANGER} right={<View />} testID="settings-log-out" />
          </Group>
        </>
      )}
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 14, paddingHorizontal: 12, height: 40, borderRadius: 12 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 0 },
  noResults: { textAlign: 'center', marginTop: 40, fontSize: 15 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 16, marginTop: 18, padding: 14, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  avatar: { width: 60, height: 60, borderRadius: 30 },
  center: { alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 18, fontWeight: '700' },
  handle: { fontSize: 14, marginTop: 1 },
  editHint: { fontSize: 14, fontWeight: '600', marginTop: 4 },
});
