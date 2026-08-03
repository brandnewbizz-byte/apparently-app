import { ArrowLeft, Moon, Sun, LogOut, Mail, Camera, User, MapPin, FileText, Save, AtSign, Lock, Info } from 'lucide-react-native';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert, Switch, TextInput, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { sanitizeBio, sanitizeFullName, sanitizeUsername } from '@/lib/sanitize';

import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, refreshProfile, signOut } = useAuth();

  const [editingName, setEditingName] = useState(user?.fullName || '');
  const [editingUsername, setEditingUsername] = useState(user?.username || '');
  const [editingBio, setEditingBio] = useState(user?.bio || '');
  const [editingAvatar, setEditingAvatar] = useState((user as any)?.avatar_url || user?.avatar || '');
  const [editingAvatarBase64, setEditingAvatarBase64] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditingName(user?.fullName || '');
    setEditingUsername(user?.username || '');
    setEditingBio(user?.bio || '');
    setEditingAvatar((user as any)?.avatar_url || user?.avatar || '');
  }, [user]);

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets?.length > 0) {
      const uri = result.assets[0].uri;
      // Store base64 for reliable upload — fetch() can fail with local file:// URIs
      if (result.assets[0].base64) {
        setEditingAvatarBase64(result.assets[0].base64);
      }
      setEditingAvatar(uri);
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);
    try {
      let finalAvatar = editingAvatar;
      // Upload new avatar if changed — require base64 (never save file:// URIs to DB)
      if (editingAvatar && !editingAvatar.startsWith('http')) {
        if (!editingAvatarBase64) {
          Alert.alert('Upload failed', 'Image data not available. Please select the image again.');
          setSaving(false);
          return;
        }
        const ext = (editingAvatar.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
        const safeExt = ['jpg','jpeg','png','gif','webp'].includes(ext) ? ext : 'jpg';
        const mimeType = { jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', gif:'image/gif', webp:'image/webp' }[safeExt] || 'image/jpeg';
        const path = `avatars/${user.id}_${Date.now()}.${safeExt}`;
        const blob = await (await fetch(`data:${mimeType};base64,${editingAvatarBase64}`)).blob();
        const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: mimeType });
        if (uploadErr) {
          console.log('[Settings] Avatar upload error:', uploadErr.message);
          Alert.alert('Upload failed', uploadErr.message || 'Could not upload profile picture. Please try again.');
          setSaving(false);
          return;
        }
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
        finalAvatar = urlData?.publicUrl || '';
        if (!finalAvatar) {
          Alert.alert('Upload failed', 'Could not get public URL for uploaded image.');
          setSaving(false);
          return;
        }
      }
      const profileUpdates: any = { full_name: sanitizeFullName(editingName), username: sanitizeUsername(editingUsername), bio: sanitizeBio(editingBio), avatar: finalAvatar, updated_at: new Date().toISOString() };
      const { error: saveErr } = await supabase.from('profiles').upsert({ id: user.id, ...profileUpdates }, { onConflict: 'id' });
      if (saveErr) {
        Alert.alert('Error', saveErr.message);
        setSaving(false);
        return;
      }
      await refreshProfile();
      Alert.alert('Saved', 'Profile updated.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleTheme = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleTheme();
  };

  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showEmailChange, setShowEmailChange] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [accountLoading, setAccountLoading] = useState(false);

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    setAccountLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setAccountLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Success', 'Password updated');
      setNewPassword('');
      setShowPasswordChange(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!newEmail || !newEmail.includes('@')) {
      Alert.alert('Error', 'Enter a valid email address');
      return;
    }
    setAccountLoading(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setAccountLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Check your email', 'A confirmation link was sent to your new email address.');
      setNewEmail('');
      setShowEmailChange(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => { signOut(); } },
    ]);
  };

  const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
    backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '600' },
    placeholder: { width: 40 },
    scrollView: { flex: 1 },
    scrollContent: { paddingBottom: 40 },
    section: { padding: 16, borderBottomWidth: 1 },
    sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
    sectionSubtitle: { fontSize: 13, marginBottom: 16 },
    settingItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
    settingIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
    settingContent: { flex: 1 },
    settingLabel: { fontSize: 15, fontWeight: '600' },
    settingValue: { fontSize: 13, marginTop: 2 },
    avatarSection: { alignItems: 'center', marginBottom: 16 },
    avatarWrapper: { position: 'relative', marginBottom: 8 },
    avatar: { width: 80, height: 80, borderRadius: 40 },
    avatarEditBadge: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    inputGroup: { marginBottom: 12 },
    inputLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
    input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
    saveBtn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 4 },
    saveBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
    themeToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    logoutItem: { backgroundColor: 'rgba(255,82,82,0.08)', borderColor: 'rgba(255,82,82,0.2)' },
    versionText: { fontSize: 12, textAlign: 'center', marginTop: 24 },
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.surface }]}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Editing */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Profile</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>Your public profile info</Text>

          <View style={styles.avatarSection}>
            <TouchableOpacity onPress={pickAvatar} style={styles.avatarWrapper}>
              {editingAvatar ? (
                <Image source={{ uri: editingAvatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }]}>
                  <User size={32} color={colors.textSecondary} />
                </View>
              )}
              <View style={[styles.avatarEditBadge, { backgroundColor: colors.accent }]}>
                <Camera size={14} color="#fff" />
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Name</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <User size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
              <TextInput style={[styles.input, { flex: 1, color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]} value={editingName} onChangeText={setEditingName} placeholder="Your name" placeholderTextColor={colors.textTertiary} />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Username</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AtSign size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
              <TextInput style={[styles.input, { flex: 1, color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]} value={editingUsername} onChangeText={setEditingUsername} placeholder="your_username" placeholderTextColor={colors.textTertiary} autoCapitalize="none" />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Bio</Text>
            <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface, minHeight: 80, textAlignVertical: 'top' }]} value={editingBio} onChangeText={setEditingBio} placeholder="A short bio..." placeholderTextColor={colors.textTertiary} multiline numberOfLines={3} />
          </View>

          <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.accent, opacity: saving ? 0.6 : 1 }]} onPress={handleSave} disabled={saving}>
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Profile'}</Text>
          </TouchableOpacity>
        </View>

        {/* Appearance */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Appearance</Text>
          <View style={[styles.settingItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.settingIcon, { backgroundColor: colors.accentGlow }]}>
              {isDark ? <Moon size={20} color="#FFD93D" /> : <Sun size={20} color="#FF8C00" />}
            </View>
            <View style={[styles.settingContent, styles.themeToggleRow]}>
              <View>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Dark Mode</Text>
                <Text style={[styles.settingValue, { color: colors.textSecondary }]}>{isDark ? 'On' : 'Off'}</Text>
              </View>
              <Switch value={isDark} onValueChange={handleToggleTheme} trackColor={{ false: colors.border, true: colors.accent }} thumbColor="#FFFFFF" ios_backgroundColor={colors.border} />
            </View>
          </View>
        </View>

        {/* Account */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Account</Text>
          <View style={[styles.settingItem, { backgroundColor: colors.surface, borderColor: colors.border, opacity: 0.8 }]}>
            <View style={[styles.settingIcon, { backgroundColor: colors.accentGlow }]}>
              <Mail size={20} color={colors.accent} />
            </View>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Email</Text>
              <Text style={[styles.settingValue, { color: colors.textSecondary }]}>{user?.email || 'Not signed in'}</Text>
            </View>
          </View>

          {/* Change Email */}
          <TouchableOpacity style={[styles.settingItem, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setShowEmailChange(!showEmailChange)}>
            <View style={[styles.settingIcon, { backgroundColor: colors.accentGlow }]}>
              <Mail size={20} color={colors.accent} />
            </View>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Change Email</Text>
            </View>
          </TouchableOpacity>
          {showEmailChange && (
            <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
              <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface, marginBottom: 8 }]} value={newEmail} onChangeText={setNewEmail} placeholder="New email address" placeholderTextColor={colors.textTertiary} autoCapitalize="none" keyboardType="email-address" />
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.accent, opacity: accountLoading ? 0.6 : 1 }]} onPress={handleChangeEmail} disabled={accountLoading}>
                <Text style={styles.saveBtnText}>{accountLoading ? 'Sending...' : 'Update Email'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Change Password */}
          <TouchableOpacity style={[styles.settingItem, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setShowPasswordChange(!showPasswordChange)}>
            <View style={[styles.settingIcon, { backgroundColor: colors.accentGlow }]}>
              <Lock size={20} color={colors.accent} />
            </View>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Change Password</Text>
            </View>
          </TouchableOpacity>
          {showPasswordChange && (
            <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
              <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface, marginBottom: 8 }]} value={newPassword} onChangeText={setNewPassword} placeholder="New password (min 6 chars)" placeholderTextColor={colors.textTertiary} secureTextEntry />
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.accent, opacity: accountLoading ? 0.6 : 1 }]} onPress={handleChangePassword} disabled={accountLoading}>
                <Text style={styles.saveBtnText}>{accountLoading ? 'Updating...' : 'Update Password'}</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={[styles.settingItem, styles.logoutItem]} onPress={handleSignOut}>
            <View style={[styles.settingIcon, { backgroundColor: 'rgba(255,82,82,0.2)' }]}>
              <LogOut size={20} color="#FF5252" />
            </View>
            <View style={styles.settingContent}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#FF5252' }}>Sign Out</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* About */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>About</Text>
          <View style={[styles.settingItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.settingIcon, { backgroundColor: colors.accentGlow }]}>
              <Info size={20} color={colors.accent} />
            </View>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Version</Text>
              <Text style={[styles.settingValue, { color: colors.textSecondary }]}>1.0.0 (Build 64)</Text>
            </View>
          </View>
        </View>

        <Text style={[styles.versionText, { color: colors.textTertiary }]}>apparently v1.0</Text>
      </ScrollView>
    </View>
  );
}
