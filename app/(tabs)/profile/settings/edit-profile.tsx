/** Edit profile: photo, name, username and bio. */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, ActivityIndicator, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { AtSign, Camera, Check, User, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { syncUserAvatar } from '@/lib/avatar-sync';
import { sanitizeBio, sanitizeFullName, sanitizeUsername } from '@/lib/sanitize';
import { useUsernameCheck } from '@/hooks/useUsernameCheck';
import { USERNAME_MAX } from '@/constants/app';
import { notify } from '@/lib/dialog';
import { SettingsPage } from '@/components/settings/SettingsUI';

export default function EditProfile() {
  const { colors } = useTheme();
  const { user, refreshProfile } = useAuth();

  const [name, setName] = useState(user?.fullName || '');
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fill in once the profile arrives (opening this page straight from a link).
  const [filled, setFilled] = useState(!!user?.id);
  useEffect(() => {
    if (filled || !user?.id) return;
    setName(user.fullName || ''); setUsername(user.username || ''); setBio(user.bio || ''); setAvatar(user.avatar || ''); // eslint-disable-line react-hooks/set-state-in-effect
    setFilled(true);
  }, [filled, user]);

  const usernameCheck = useUsernameCheck(username, user?.username, user?.id);
  const dirty = useMemo(() => (
    name.trim() !== (user?.fullName || '')
    || username.trim().toLowerCase() !== (user?.username || '')
    || bio.trim() !== (user?.bio || '')
    || avatar !== (user?.avatar || '')
  ), [name, username, bio, avatar, user]);
  const canSave = dirty && !saving && !!name.trim() && usernameCheck.ok;

  const touch = () => { setSaved(false); setError(null); };

  const pickAvatar = async () => {
    if (Platform.OS !== 'web') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { notify('Photos access needed', 'Allow photo access to set a profile picture.'); return; }
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8, base64: true });
    if (result.canceled || !result.assets?.length) return;
    const a = result.assets[0];
    let b64 = a.base64 || null;
    // On the web the picker may hand back a data: URL instead of base64.
    if (!b64 && a.uri.startsWith('data:')) b64 = a.uri.split(',')[1] || null;
    if (!b64) { notify('Couldn’t read that photo', 'Please try a different one.'); return; }
    setAvatarBase64(b64);
    setAvatar(a.uri);
    touch();
  };

  const save = async () => {
    if (!user?.id || !canSave) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true); setError(null); setSaved(false);
    try {
      let finalAvatar = avatar;
      if (avatar && !avatar.startsWith('http')) {
        if (!avatarBase64) { setError('Please pick the photo again.'); return; }
        const path = `${user.id}_${Date.now()}.jpg`;
        const chars = atob(avatarBase64);
        const bytes = new Uint8Array(chars.length);
        for (let i = 0; i < chars.length; i++) bytes[i] = chars.charCodeAt(i);
        const { error: upErr } = await supabase.storage.from('avatars').upload(path, bytes, { upsert: true, contentType: 'image/jpeg' });
        if (upErr) { setError('Could not upload your photo. Please try again.'); return; }
        finalAvatar = supabase.storage.from('avatars').getPublicUrl(path).data?.publicUrl || '';
        if (!finalAvatar) { setError('Could not upload your photo. Please try again.'); return; }
        setAvatarBase64(null);
      }
      const updates = {
        full_name: sanitizeFullName(name), username: sanitizeUsername(username), bio: sanitizeBio(bio),
        avatar: finalAvatar, updated_at: new Date().toISOString(),
      };
      const { error: saveErr } = await supabase.from('profiles').update(updates).eq('id', user.id);
      if (saveErr) { setError(saveErr.code === '23505' ? `@${updates.username} was just taken. Try another.` : 'Could not save. Please try again.'); return; }
      setAvatar(finalAvatar);
      await refreshProfile();
      syncUserAvatar(user.id, finalAvatar);
      setSaved(true);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setError('Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const input = [styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }];
  const userColor = usernameCheck.state === 'available' ? '#16A34A' : usernameCheck.state === 'taken' || usernameCheck.state === 'invalid' ? '#EF4444' : colors.textTertiary;

  return (
    <SettingsPage
      title="Edit profile"
      right={
        <TouchableOpacity onPress={save} disabled={!canSave} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Save profile" testID="edit-profile-save">
          {saving ? <ActivityIndicator color={colors.accent} /> : <Text style={{ color: canSave ? colors.accent : colors.textTertiary, fontWeight: '700', fontSize: 16 }}>Save</Text>}
        </TouchableOpacity>
      }
    >
      <View style={styles.photoWrap}>
        <TouchableOpacity onPress={pickAvatar} accessibilityLabel="Change profile photo" activeOpacity={0.8}>
          {avatar ? <Image source={{ uri: avatar }} style={styles.avatar} /> : (
            <View style={[styles.avatar, styles.center, { backgroundColor: colors.surfaceHighlight }]}><User size={40} color={colors.textSecondary} /></View>
          )}
          <View style={[styles.camera, { backgroundColor: colors.accent, borderColor: colors.backgroundSecondary }]}><Camera size={14} color="#FFF" /></View>
        </TouchableOpacity>
        <TouchableOpacity onPress={pickAvatar}><Text style={[styles.changePhoto, { color: colors.accent }]}>Change photo</Text></TouchableOpacity>
      </View>

      <View style={styles.form}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Name</Text>
        <TextInput style={input} value={name} onChangeText={(t) => { setName(t); touch(); }} placeholder="Your name" placeholderTextColor={colors.textTertiary} maxLength={50} accessibilityLabel="Name" />

        <Text style={[styles.label, { color: colors.textSecondary }]}>Username</Text>
        <View style={[input, styles.userBox]}>
          <AtSign size={16} color={colors.textSecondary} />
          <TextInput
            style={[styles.userInput, { color: colors.text }]}
            value={username}
            onChangeText={(t) => { setUsername(t.toLowerCase().replace(/\s/g, '')); touch(); }}
            placeholder="your_username" placeholderTextColor={colors.textTertiary}
            autoCapitalize="none" autoCorrect={false} maxLength={USERNAME_MAX} accessibilityLabel="Username"
          />
          {usernameCheck.state === 'checking' ? <ActivityIndicator size="small" />
            : usernameCheck.state === 'available' ? <Check size={18} color="#16A34A" />
            : usernameCheck.state === 'taken' || usernameCheck.state === 'invalid' ? <X size={18} color="#EF4444" /> : null}
        </View>
        <Text style={[styles.helper, { color: userColor }]}>{usernameCheck.message || 'Letters, numbers, dots and underscores.'}</Text>

        <Text style={[styles.label, { color: colors.textSecondary }]}>Bio</Text>
        <TextInput
          style={[input, { minHeight: 90, textAlignVertical: 'top' }]}
          value={bio} onChangeText={(t) => { setBio(t); touch(); }}
          placeholder="Tell people what you’re about" placeholderTextColor={colors.textTertiary}
          multiline maxLength={150} accessibilityLabel="Bio"
        />
        <Text style={[styles.helper, { color: colors.textTertiary, textAlign: 'right' }]}>{bio.length}/150</Text>

        {error ? <Text style={[styles.note, { color: '#EF4444' }]}>{error}</Text> : null}
        {saved ? <Text style={[styles.note, { color: '#16A34A' }]}>✓ Profile saved</Text> : null}

        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.accent, opacity: canSave ? 1 : 0.45 }]} onPress={save} disabled={!canSave} accessibilityLabel="Save profile">
          {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveText}>Save</Text>}
        </TouchableOpacity>
      </View>
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  photoWrap: { alignItems: 'center', marginTop: 24, gap: 10 },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  center: { alignItems: 'center', justifyContent: 'center' },
  camera: { position: 'absolute', right: -2, bottom: -2, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
  changePhoto: { fontSize: 15, fontWeight: '700' },
  form: { paddingHorizontal: 16, marginTop: 8 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 16, marginBottom: 6, marginLeft: 2 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 12 : 9, fontSize: 16 },
  userBox: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 0, minHeight: 46 },
  userInput: { flex: 1, fontSize: 16, paddingVertical: Platform.OS === 'ios' ? 12 : 9 },
  helper: { fontSize: 12, marginTop: 6, marginLeft: 2 },
  note: { fontSize: 14, fontWeight: '600', marginTop: 12 },
  saveBtn: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  saveText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
