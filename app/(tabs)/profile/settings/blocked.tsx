/** Blocked accounts, with Unblock. */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { User, ShieldOff } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useSocial } from '@/contexts/SocialContext';
import { supabase } from '@/lib/supabase';
import { confirmAction, notify } from '@/lib/dialog';
import { SettingsPage, Group, Item } from '@/components/settings/SettingsUI';

interface Person { id: string; name: string; username: string; avatar: string | null }

export default function BlockedAccounts() {
  const { colors } = useTheme();
  const { blockedUserIds, unblockUser } = useSocial();
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true;
    if (!blockedUserIds.length) { Promise.resolve().then(() => { if (on) { setPeople([]); setLoading(false); } }); return () => { on = false; }; }
    supabase.from('profiles').select('id, full_name, username, avatar').in('id', blockedUserIds)
      .then(({ data }) => {
        if (!on) return;
        setPeople((data || []).map((p: any) => ({ id: p.id, name: p.full_name || p.username || 'User', username: p.username || '', avatar: p.avatar || null })));
        setLoading(false);
      }, () => { if (on) setLoading(false); });
    return () => { on = false; };
  }, [blockedUserIds]);

  const unblock = (p: Person) => confirmAction(`Unblock ${p.name}?`, 'They’ll be able to see your posts and message you again.', 'Unblock', async () => {
    const res = await unblockUser(p.id);
    if (!res.success) notify('Couldn’t unblock', 'Please try again.');
  });

  return (
    <SettingsPage title="Blocked accounts">
      {loading ? <ActivityIndicator style={{ marginTop: 40 }} /> : !people.length ? (
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceHighlight }]}><ShieldOff size={26} color={colors.textSecondary} /></View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No one blocked</Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>When you block someone, they can’t see your posts or message you. They show up here.</Text>
        </View>
      ) : (
        <Group footer="Blocked people aren’t told that you blocked them.">
          {people.map((p) => (
            <Item
              key={p.id}
              icon={p.avatar ? <Image source={{ uri: p.avatar }} style={styles.avatar} /> : <User size={18} color={colors.textSecondary} />}
              iconBg={p.avatar ? 'transparent' : colors.surfaceHighlight}
              label={p.name}
              sub={p.username ? `@${p.username}` : undefined}
              right={
                <TouchableOpacity onPress={() => unblock(p)} style={[styles.pill, { borderColor: colors.border }]} accessibilityLabel={`Unblock ${p.name}`}>
                  <Text style={[styles.pillText, { color: colors.text }]}>Unblock</Text>
                </TouchableOpacity>
              }
            />
          ))}
        </Group>
      )}
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 32, height: 32, borderRadius: 16 },
  pill: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6 },
  pillText: { fontSize: 14, fontWeight: '700' },
  empty: { alignItems: 'center', paddingHorizontal: 32, marginTop: 56, gap: 10 },
  emptyIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
