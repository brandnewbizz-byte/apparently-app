/**
 * Account privacy (Instagram-style): Private account switch + follow requests.
 * Private: only followers you approve see your posts and stories and can message
 * you. Your bundles and skill deals stay public on Home either way.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Lock, User } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { approveFollow, declineFollow, getPrivate, listFollowRequests, setPrivate, type FollowRequest } from '@/lib/privacy';
import { confirmAction, notify } from '@/lib/dialog';
import { SettingsPage, Group, Item, ToggleItem, tap } from '@/components/settings/SettingsUI';

export default function PrivacySettings() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [isPrivate, setIsPrivateState] = useState<boolean | null>(null);
  const [requests, setRequests] = useState<FollowRequest[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const [p, r] = await Promise.all([getPrivate(user.id), listFollowRequests(user.id)]);
    setIsPrivateState(p);
    setRequests(r);
  }, [user?.id]);
  useEffect(() => { load(); }, [load]);

  const toggle = (on: boolean) => {
    if (!user?.id) return;
    const apply = async () => {
      setIsPrivateState(on);
      const ok = await setPrivate(user.id, on);
      if (!ok) { setIsPrivateState(!on); notify('Couldn’t change that', 'Please try again.'); return; }
      if (!on) setRequests([]); // going public approves everyone waiting
    };
    if (on) {
      confirmAction(
        'Switch to a private account?',
        'Only people you approve will see your posts and stories and can message you. Your bundles and skill deals stay public on Home.',
        'Switch to private',
        apply,
      );
    } else {
      confirmAction(
        'Switch to a public account?',
        'Anyone can see your posts and message you. Everyone waiting will be approved.',
        'Switch to public',
        apply,
      );
    }
  };

  const me = { id: user?.id || '', name: (user as any)?.fullName || (user as any)?.username || 'Someone', avatar: (user as any)?.avatar || null };
  const answer = async (r: FollowRequest, ok: boolean) => {
    tap();
    setBusy(r.followerId);
    const done = ok ? await approveFollow(me, r.followerId) : await declineFollow(me.id, r.followerId);
    setBusy(null);
    if (done) setRequests((prev) => prev.filter((x) => x.followerId !== r.followerId));
    else notify('Something went wrong', 'Please try again.');
  };

  return (
    <SettingsPage title="Account privacy">
      {isPrivate === null ? <ActivityIndicator style={{ marginTop: 40 }} /> : (
        <>
          <Group footer="When your account is private, only people you approve can see your posts and stories, see who you follow, and message you. People you trade with (grabs and orders) can still chat with you. Bundles and skill deals always stay public.">
            <ToggleItem icon={<Lock size={18} color="#FFF" />} iconBg="#334155" label="Private account" value={isPrivate} onChange={toggle} testID="privacy-private" />
          </Group>
          {isPrivate ? (
            <Group title={`Follow requests${requests.length ? ` · ${requests.length}` : ''}`}>
              {!requests.length ? (
                <Item icon={<User size={18} color={colors.textSecondary} />} iconBg={colors.surfaceHighlight} label="No requests right now" />
              ) : requests.map((r) => (
                <Item
                  key={r.followerId}
                  icon={r.avatar ? <Image source={{ uri: r.avatar }} style={styles.avatar} /> : <User size={18} color={colors.textSecondary} />}
                  iconBg={r.avatar ? 'transparent' : colors.surfaceHighlight}
                  label={r.name}
                  sub={r.username ? `@${r.username}` : undefined}
                  onPress={() => router.push(`/user/${r.followerId}` as never)}
                  right={busy === r.followerId ? <ActivityIndicator /> : (
                    <View style={styles.row}>
                      <TouchableOpacity onPress={() => answer(r, true)} style={[styles.pill, styles.confirm]} accessibilityLabel={`Confirm ${r.name}`}>
                        <Text style={[styles.pillText, { color: '#FFF' }]}>Confirm</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => answer(r, false)} style={[styles.pill, { borderColor: colors.border, borderWidth: 1 }]} accessibilityLabel={`Delete ${r.name}'s request`}>
                        <Text style={[styles.pillText, { color: colors.text }]}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                />
              ))}
            </Group>
          ) : null}
        </>
      )}
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 32, height: 32, borderRadius: 16 },
  row: { flexDirection: 'row', gap: 6 },
  pill: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  confirm: { backgroundColor: '#3B82F6' },
  pillText: { fontSize: 13, fontWeight: '700' },
});
