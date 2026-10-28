import {
  ArrowLeft, Moon, Sun, Smartphone, LogOut, Mail, Camera, User, AtSign, Lock, Bell, Trash2, ShieldOff,
  ChevronRight, LifeBuoy, FileText, Shield, Check, X, Info,
} from 'lucide-react-native';
import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert, Switch, TextInput, Image,
  ActivityIndicator, Linking, KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { supabase } from '@/lib/supabase';
import { syncUserAvatar } from '@/lib/avatar-sync';
import { sanitizeBio, sanitizeFullName, sanitizeUsername } from '@/lib/sanitize';
import { useUsernameCheck } from '@/hooks/useUsernameCheck';
import { PRIVACY_POLICY_URL, SUPPORT_EMAIL, TERMS_URL, USERNAME_MAX } from '@/constants/app';

import { useTheme, type ThemeMode } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSocial } from '@/contexts/SocialContext';

const tap = () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };

// Each switch controls every notification type in its group (the push
// trigger checks `notification_prefs[type]`).
const NOTIF_GROUPS: { label: string; hint: string; keys: string[] }[] = [
  { label: 'Messages', hint: 'New chats and voice notes', keys: ['messages', 'new_message'] },
  { label: 'Grabs & orders', hint: 'When someone grabs your bundle, skill or request', keys: ['bundle_grab', 'skill_grab', 'service_response', 'new_grab', 'grab_accepted', 'grab_declined', 'grab_cancelled', 'bundle_sold', 'deal_sold', 'booking_confirmed', 'booking_cancelled'] },
  { label: 'Likes', hint: 'Likes on your posts', keys: ['like', 'new_like'] },
  { label: 'Comments', hint: 'Comments and replies', keys: ['comment', 'new_comment'] },
  { label: 'Mentions', hint: 'When someone @mentions you', keys: ['mention'] },
  { label: 'New followers', hint: 'When someone follows you', keys: ['follow'] },
  { label: 'Spot invites', hint: 'Invites to hang out in a room', keys: ['room_invite'] },
  { label: 'Calls', hint: 'Incoming calls', keys: ['call'] },
];

interface BlockedPerson { id: string; name: string; username: string; avatar: string | null }


type Colors = ReturnType<typeof useTheme>['colors'];

// Defined outside the screen so typing in a field never remounts the section.
function Row({ colors, icon, label, value, onPress, danger, last, right, testID }: {
  colors: Colors; icon: React.ReactNode; label: string; value?: string; onPress?: () => void; danger?: boolean; last?: boolean; right?: React.ReactNode; testID?: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
      accessibilityLabel={label}
      testID={testID}
    >
      <View style={[styles.rowIcon, { backgroundColor: danger ? 'rgba(255,82,82,0.12)' : colors.accentGlow }]}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: danger ? '#FF5252' : colors.text }]}>{label}</Text>
        {value ? <Text style={[styles.rowValue, { color: colors.textSecondary }]} numberOfLines={1}>{value}</Text> : null}
      </View>
      {right ?? (onPress ? <ChevronRight size={18} color={colors.textTertiary} /> : null)}
    </TouchableOpacity>
  );
}

function Section({ colors, title, children, footer }: { colors: Colors; title: string; children: React.ReactNode; footer?: string }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{title}</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>{children}</View>
      {footer ? <Text style={[styles.footer, { color: colors.textTertiary }]}>{footer}</Text> : null}
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark, themeMode, setTheme } = useTheme();
  const { user, refreshProfile, signOut } = useAuth();
  const { blockedUserIds, unblockUser } = useSocial();

  // ── Profile ──────────────────────────────────────────────────────────────
  const [editingName, setEditingName] = useState(user?.fullName || '');
  const [editingUsername, setEditingUsername] = useState(user?.username || '');
  const [editingBio, setEditingBio] = useState(user?.bio || '');
  const [editingAvatar, setEditingAvatar] = useState(user?.avatar || '');
  const [editingAvatarBase64, setEditingAvatarBase64] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    setEditingName(user?.fullName || '');
    setEditingUsername(user?.username || '');
    setEditingBio(user?.bio || '');
    setEditingAvatar(user?.avatar || '');
  }, [user?.fullName, user?.username, user?.bio, user?.avatar]);

  const usernameCheck = useUsernameCheck(editingUsername, user?.username, user?.id);
  const dirty = useMemo(() => (
    editingName.trim() !== (user?.fullName || '')
    || editingUsername.trim().toLowerCase() !== (user?.username || '')
    || editingBio.trim() !== (user?.bio || '')
    || editingAvatar !== (user?.avatar || '')
  ), [editingName, editingUsername, editingBio, editingAvatar, user]);
  const canSave = dirty && !saving && !!editingName.trim() && usernameCheck.ok;

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow photo library access to set a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets?.length > 0) {
      const a = result.assets[0];
      if (a.base64) {
        setEditingAvatarBase64(a.base64);
        setEditingAvatar(a.uri);
        setSavedNote(null);
      } else {
        Alert.alert('Error', 'Could not read image data. Please try a different photo.');
      }
    }
  };

  const handleSave = async () => {
    if (!user?.id || !canSave) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);
    setProfileError(null);
    setSavedNote(null);
    try {
      let finalAvatar = editingAvatar;
      // Upload a new avatar if one was picked (never save file:// URIs).
      if (editingAvatar && !editingAvatar.startsWith('http')) {
        if (!editingAvatarBase64) { setProfileError('Please pick the photo again.'); return; }
        const ext = (editingAvatar.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
        const safeExt = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) ? ext : 'jpg';
        const mimeType = ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' } as Record<string, string>)[safeExt] || 'image/jpeg';
        const path = `${user.id}_${Date.now()}.${safeExt}`;
        const byteChars = atob(editingAvatarBase64);
        const bytes = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
        const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, bytes, { upsert: true, contentType: mimeType });
        if (uploadErr) { setProfileError('Could not upload your photo. Please try again.'); return; }
        finalAvatar = supabase.storage.from('avatars').getPublicUrl(path).data?.publicUrl || '';
        if (!finalAvatar) { setProfileError('Could not upload your photo. Please try again.'); return; }
        setEditingAvatarBase64(null);
      }
      const updates = {
        full_name: sanitizeFullName(editingName),
        username: sanitizeUsername(editingUsername),
        bio: sanitizeBio(editingBio),
        avatar: finalAvatar,
        updated_at: new Date().toISOString(),
      };
      const { error: saveErr } = await supabase.from('profiles').update(updates).eq('id', user.id);
      if (saveErr) {
        // 23505 = someone grabbed that username a moment ago.
        setProfileError(saveErr.code === '23505' ? `@${updates.username} was just taken — try another.` : 'Could not save. Please try again.');
        return;
      }
      setEditingAvatar(finalAvatar);
      await refreshProfile();
      syncUserAvatar(user.id, finalAvatar);
      setSavedNote('Profile saved');
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setProfileError('Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Notifications ────────────────────────────────────────────────────────
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (!user?.id) return;
    supabase.from('profiles').select('notification_prefs').eq('id', user.id).maybeSingle()
      .then(({ data }) => { if (data?.notification_prefs) setNotifPrefs(data.notification_prefs as Record<string, boolean>); });
  }, [user?.id]);

  const savePrefs = async (next: Record<string, boolean>) => {
    if (!user?.id) return;
    const prev = notifPrefs;
    setNotifPrefs(next);
    const { error } = await supabase.from('profiles').update({ notification_prefs: next }).eq('id', user.id);
    if (error) setNotifPrefs(prev);
  };
  const allOn = notifPrefs.all !== false;
  const groupOn = (keys: string[]) => notifPrefs[keys[0]] !== false;
  const toggleAll = () => { tap(); savePrefs({ ...notifPrefs, all: !allOn }); };
  const toggleGroup = (keys: string[]) => {
    tap();
    const on = !groupOn(keys);
    const next = { ...notifPrefs };
    keys.forEach((k) => { next[k] = on; });
    savePrefs(next);
  };

  // ── Blocked accounts ─────────────────────────────────────────────────────
  const [showBlocked, setShowBlocked] = useState(false);
  const [blocked, setBlocked] = useState<BlockedPerson[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
  useEffect(() => {
    if (!showBlocked) return;
    if (!blockedUserIds.length) { setBlocked([]); return; }
    setBlockedLoading(true);
    supabase.from('profiles').select('id, full_name, username, avatar').in('id', blockedUserIds)
      .then(({ data }) => {
        setBlocked((data || []).map((p: any) => ({ id: p.id, name: p.full_name || p.username || 'User', username: p.username || '', avatar: p.avatar || null })));
      })
      .then(() => setBlockedLoading(false), () => setBlockedLoading(false));
  }, [showBlocked, blockedUserIds]);

  const doUnblock = async (p: BlockedPerson) => {
    tap();
    const res = await unblockUser(p.id);
    if (!res.success) Alert.alert('Could not unblock', 'Please try again.');
  };

  // ── Account ──────────────────────────────────────────────────────────────
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showEmailChange, setShowEmailChange] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountNote, setAccountNote] = useState<{ ok: boolean; text: string } | null>(null);

  const passwordProblem = !newPassword ? null
    : newPassword.length < 8 ? 'Use at least 8 characters.'
    : confirmPassword && confirmPassword !== newPassword ? "Passwords don't match."
    : null;

  const handleChangePassword = async () => {
    if (newPassword.length < 8 || newPassword !== confirmPassword) return;
    setAccountLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setAccountLoading(false);
    if (error) { setAccountNote({ ok: false, text: error.message }); return; }
    setAccountNote({ ok: true, text: 'Password updated.' });
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswordChange(false);
  };

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim());
  const handleChangeEmail = async () => {
    if (!emailValid) return;
    setAccountLoading(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim().toLowerCase() });
    setAccountLoading(false);
    if (error) { setAccountNote({ ok: false, text: error.message }); return; }
    setAccountNote({ ok: true, text: 'Check your new inbox for a confirmation link.' });
    setNewEmail('');
    setShowEmailChange(false);
  };

  // App Store / Play Store require in-app account deletion.
  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account, profile, posts, messages and bookings. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete forever',
          style: 'destructive',
          onPress: async () => {
            setAccountLoading(true);
            try {
              const { error } = await supabase.rpc('delete_my_account');
              if (error) { Alert.alert('Could not delete account', error.message); return; }
              await signOut();
            } catch (e: any) {
              Alert.alert('Could not delete account', e?.message || 'Please try again.');
            } finally {
              setAccountLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleSignOut = () => {
    Alert.alert('Sign out?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => { signOut(); } },
    ]);
  };

  const openUrl = (url: string) => { tap(); Linking.openURL(url).catch(() => Alert.alert('Could not open link')); };

  const version = Constants.expoConfig?.version || Application.nativeApplicationVersion || '1.0.0';
  const build = Application.nativeBuildVersion;

  // ── UI helpers ───────────────────────────────────────────────────────────
  const card = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }];
  const input = [styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }];

  const usernameColor = usernameCheck.state === 'available' ? '#16A34A'
    : usernameCheck.state === 'taken' || usernameCheck.state === 'invalid' ? '#EF4444'
    : colors.textTertiary;

  const themeOptions: { id: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { id: 'light', label: 'Light', icon: <Sun size={16} color={themeMode === 'light' ? '#FFF' : colors.text} /> },
    { id: 'dark', label: 'Dark', icon: <Moon size={16} color={themeMode === 'dark' ? '#FFF' : colors.text} /> },
    { id: 'system', label: 'Automatic', icon: <Smartphone size={16} color={themeMode === 'system' ? '#FFF' : colors.text} /> },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 4, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.surface }]} accessibilityLabel="Back">
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* ── Profile ── */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>PROFILE</Text>
            <View style={[card, { padding: 16 }]}>
              <View style={styles.profileTop}>
                <TouchableOpacity onPress={pickAvatar} style={styles.avatarWrapper} accessibilityLabel="Change profile photo">
                  {editingAvatar ? (
                    <Image source={{ uri: editingAvatar }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, { backgroundColor: colors.surfaceHighlight || colors.border, alignItems: 'center', justifyContent: 'center' }]}>
                      <User size={30} color={colors.textSecondary} />
                    </View>
                  )}
                  <View style={[styles.avatarEditBadge, { backgroundColor: colors.accent, borderColor: colors.surface }]}>
                    <Camera size={12} color="#fff" />
                  </View>
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.profileName, { color: colors.text }]} numberOfLines={1}>{user?.fullName || 'Your name'}</Text>
                  <Text style={[styles.rowValue, { color: colors.textSecondary }]} numberOfLines={1}>@{user?.username || 'username'}</Text>
                </View>
              </View>

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Name</Text>
              <TextInput style={input} value={editingName} onChangeText={(t) => { setEditingName(t); setSavedNote(null); }} placeholder="Your name" placeholderTextColor={colors.textTertiary} maxLength={50} accessibilityLabel="Name" />

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Username</Text>
              <View style={[input, styles.usernameBox]}>
                <AtSign size={16} color={colors.textSecondary} />
                <TextInput
                  style={[styles.usernameInput, { color: colors.text }]}
                  value={editingUsername}
                  onChangeText={(t) => { setEditingUsername(t.toLowerCase().replace(/\s/g, '')); setSavedNote(null); }}
                  placeholder="your_username"
                  placeholderTextColor={colors.textTertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={USERNAME_MAX}
                  accessibilityLabel="Username"
                />
                {usernameCheck.state === 'checking' ? <ActivityIndicator size="small" />
                  : usernameCheck.state === 'available' ? <Check size={18} color="#16A34A" />
                  : usernameCheck.state === 'taken' || usernameCheck.state === 'invalid' ? <X size={18} color="#EF4444" /> : null}
              </View>
              <Text style={[styles.helper, { color: usernameColor }]}>
                {usernameCheck.message || 'Your unique handle. Letters, numbers, dots and underscores.'}
              </Text>

              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Bio</Text>
              <TextInput
                style={[input, { minHeight: 76, textAlignVertical: 'top' }]}
                value={editingBio}
                onChangeText={(t) => { setEditingBio(t); setSavedNote(null); }}
                placeholder="A short bio…"
                placeholderTextColor={colors.textTertiary}
                multiline
                maxLength={150}
                accessibilityLabel="Bio"
              />
              <Text style={[styles.helper, { color: colors.textTertiary, textAlign: 'right' }]}>{editingBio.length}/150</Text>

              {profileError ? <Text style={[styles.note, { color: '#EF4444' }]}>{profileError}</Text> : null}
              {savedNote ? <Text style={[styles.note, { color: '#16A34A' }]}>✓ {savedNote}</Text> : null}

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.accent, opacity: canSave ? 1 : 0.45 }]}
                onPress={handleSave}
                disabled={!canSave}
                accessibilityLabel="Save profile"
              >
                {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Save profile</Text>}
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Appearance ── */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>APPEARANCE</Text>
            <View style={[card, styles.segment]}>
              {themeOptions.map((o) => {
                const on = themeMode === o.id;
                return (
                  <TouchableOpacity
                    key={o.id}
                    onPress={() => { tap(); setTheme(o.id); }}
                    style={[styles.segBtn, on && { backgroundColor: colors.accent }]}
                    accessibilityLabel={`${o.label} theme`}
                    accessibilityState={{ selected: on }}
                  >
                    {o.icon}
                    <Text style={[styles.segText, { color: on ? '#FFF' : colors.text }]}>{o.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={[styles.footer, { color: colors.textTertiary }]}>Automatic follows your phone's setting{themeMode === 'system' ? ` (now ${isDark ? 'dark' : 'light'})` : ''}.</Text>
          </View>

          {/* ── Notifications ── */}
          <Section colors={colors} title="PUSH NOTIFICATIONS">
            <Row
              colors={colors}
              icon={<Bell size={18} color={colors.accent} />}
              label="Allow notifications"
              value={allOn ? 'On' : 'Off — you won’t get any pushes'}
              last={!allOn}
              right={<Switch value={allOn} onValueChange={toggleAll} trackColor={{ false: colors.border, true: colors.accent }} thumbColor="#FFFFFF" ios_backgroundColor={colors.border} accessibilityLabel="Allow notifications" />}
            />
            {allOn ? NOTIF_GROUPS.map((g, i) => (
              <View key={g.label} style={[styles.row, i < NOTIF_GROUPS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
                <View style={{ flex: 1, paddingLeft: 4 }}>
                  <Text style={[styles.rowLabel, { color: colors.text }]}>{g.label}</Text>
                  <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{g.hint}</Text>
                </View>
                <Switch value={groupOn(g.keys)} onValueChange={() => toggleGroup(g.keys)} trackColor={{ false: colors.border, true: colors.accent }} thumbColor="#FFFFFF" ios_backgroundColor={colors.border} accessibilityLabel={`${g.label} notifications`} />
              </View>
            )) : null}
          </Section>

          {/* ── Privacy & safety ── */}
          <Section colors={colors} title="PRIVACY & SAFETY">
            <Row
              colors={colors}
              icon={<ShieldOff size={18} color={colors.accent} />}
              label="Blocked accounts"
              value={blockedUserIds.length ? `${blockedUserIds.length} blocked` : 'No one blocked'}
              onPress={() => { tap(); setShowBlocked((v) => !v); }}
              last={!showBlocked}
            />
            {showBlocked ? (
              blockedLoading ? <ActivityIndicator style={{ padding: 16 }} />
              : !blocked.length ? <Text style={[styles.emptyText, { color: colors.textSecondary }]}>You haven't blocked anyone.</Text>
              : blocked.map((p, i) => (
                <View key={p.id} style={[styles.row, i < blocked.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
                  {p.avatar ? <Image source={{ uri: p.avatar }} style={styles.smallAvatar} /> : (
                    <View style={[styles.smallAvatar, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}><User size={16} color={colors.textSecondary} /></View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowLabel, { color: colors.text }]} numberOfLines={1}>{p.name}</Text>
                    {p.username ? <Text style={[styles.rowValue, { color: colors.textSecondary }]}>@{p.username}</Text> : null}
                  </View>
                  <TouchableOpacity onPress={() => doUnblock(p)} style={[styles.pill, { borderColor: colors.border }]} accessibilityLabel={`Unblock ${p.name}`}>
                    <Text style={[styles.pillText, { color: colors.text }]}>Unblock</Text>
                  </TouchableOpacity>
                </View>
              ))
            ) : null}
          </Section>

          {/* ── Account ── */}
          <Section colors={colors} title="ACCOUNT">
            <Row colors={colors} icon={<Mail size={18} color={colors.accent} />} label="Email" value={user?.email || 'Not set'} onPress={() => { tap(); setShowEmailChange((v) => !v); setAccountNote(null); }} />
            {showEmailChange ? (
              <View style={styles.inlineForm}>
                <TextInput style={input} value={newEmail} onChangeText={setNewEmail} placeholder="New email address" placeholderTextColor={colors.textTertiary} autoCapitalize="none" keyboardType="email-address" autoCorrect={false} accessibilityLabel="New email" />
                <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.accent, opacity: emailValid && !accountLoading ? 1 : 0.45 }]} onPress={handleChangeEmail} disabled={!emailValid || accountLoading} accessibilityLabel="Update email">
                  <Text style={styles.primaryBtnText}>{accountLoading ? 'Sending…' : 'Send confirmation link'}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            <Row colors={colors} icon={<Lock size={18} color={colors.accent} />} label="Change password" onPress={() => { tap(); setShowPasswordChange((v) => !v); setAccountNote(null); }} />
            {showPasswordChange ? (
              <View style={styles.inlineForm}>
                <TextInput style={input} value={newPassword} onChangeText={setNewPassword} placeholder="New password (8+ characters)" placeholderTextColor={colors.textTertiary} secureTextEntry autoCapitalize="none" textContentType="newPassword" accessibilityLabel="New password" />
                <TextInput style={[input, { marginTop: 8 }]} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm new password" placeholderTextColor={colors.textTertiary} secureTextEntry autoCapitalize="none" textContentType="newPassword" accessibilityLabel="Confirm new password" />
                {passwordProblem ? <Text style={[styles.helper, { color: '#EF4444' }]}>{passwordProblem}</Text> : null}
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: colors.accent, opacity: newPassword.length >= 8 && newPassword === confirmPassword && !accountLoading ? 1 : 0.45 }]}
                  onPress={handleChangePassword}
                  disabled={newPassword.length < 8 || newPassword !== confirmPassword || accountLoading}
                  accessibilityLabel="Update password"
                >
                  <Text style={styles.primaryBtnText}>{accountLoading ? 'Updating…' : 'Update password'}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {accountNote ? <Text style={[styles.note, { color: accountNote.ok ? '#16A34A' : '#EF4444', paddingHorizontal: 16, paddingBottom: 10 }]}>{accountNote.text}</Text> : null}
            <Row colors={colors} icon={<LogOut size={18} color="#FF5252" />} label="Sign out" onPress={handleSignOut} danger last />
          </Section>

          {/* ── Support & legal ── */}
          {SUPPORT_EMAIL || PRIVACY_POLICY_URL || TERMS_URL ? (
            <Section colors={colors} title="SUPPORT & LEGAL">
              {SUPPORT_EMAIL ? <Row colors={colors} icon={<LifeBuoy size={18} color={colors.accent} />} label="Contact support" value={SUPPORT_EMAIL} onPress={() => openUrl(`mailto:${SUPPORT_EMAIL}`)} last={!PRIVACY_POLICY_URL && !TERMS_URL} /> : null}
              {PRIVACY_POLICY_URL ? <Row colors={colors} icon={<Shield size={18} color={colors.accent} />} label="Privacy Policy" onPress={() => openUrl(PRIVACY_POLICY_URL)} last={!TERMS_URL} /> : null}
              {TERMS_URL ? <Row colors={colors} icon={<FileText size={18} color={colors.accent} />} label="Terms of Service" onPress={() => openUrl(TERMS_URL)} last /> : null}
            </Section>
          ) : null}

          {/* ── Danger zone ── */}
          <Section colors={colors} title="DANGER ZONE" footer="Deleting your account removes your profile, posts, messages and bookings for good.">
            <Row colors={colors} icon={<Trash2 size={18} color="#FF5252" />} label="Delete account" onPress={handleDeleteAccount} danger last testID="delete-account" />
          </Section>

          <View style={styles.about}>
            <Info size={14} color={colors.textTertiary} />
            <Text style={[styles.aboutText, { color: colors.textTertiary }]}>Apparently {version}{build ? ` (${build})` : ''}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  section: { paddingHorizontal: 16, marginTop: 22 },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginBottom: 8, marginLeft: 4 },
  footer: { fontSize: 12, marginTop: 6, marginLeft: 4, lineHeight: 16 },
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 56 },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowValue: { fontSize: 13, marginTop: 1 },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 6 },
  profileName: { fontSize: 17, fontWeight: '700' },
  avatarWrapper: { position: 'relative' },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarEditBadge: { position: 'absolute', bottom: -2, right: -2, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  inputLabel: { fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 11 : 8, fontSize: 15 },
  usernameBox: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 0, minHeight: 44 },
  usernameInput: { flex: 1, fontSize: 15, paddingVertical: Platform.OS === 'ios' ? 11 : 8 },
  helper: { fontSize: 12, marginTop: 5 },
  note: { fontSize: 13, fontWeight: '600', marginTop: 10 },
  primaryBtn: { height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  primaryBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  segment: { flexDirection: 'row', padding: 4, gap: 4 },
  segBtn: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12 },
  segText: { fontSize: 14, fontWeight: '600' },
  inlineForm: { paddingHorizontal: 14, paddingBottom: 14 },
  smallAvatar: { width: 36, height: 36, borderRadius: 18 },
  pill: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  pillText: { fontSize: 13, fontWeight: '700' },
  emptyText: { fontSize: 14, padding: 16, textAlign: 'center' },
  about: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 28 },
  aboutText: { fontSize: 12 },
});
