import { ArrowLeft, Moon, Sun, LogOut, Camera, Mail, User, MapPin, FileText, Save, AlertCircle } from 'lucide-react-native';
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Platform, Alert, Switch, TextInput, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';

import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/supabaseClient';

const MAX_BIO = 160;

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, signOut, updateAvatar, refreshProfile } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar || '');
  const [mediaPerm, requestMediaPerm] = ImagePicker.useMediaLibraryPermissions();

  // Editable profile fields
  const [name, setName] = useState(user?.fullName || '');
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [location, setLocation] = useState(user?.location || '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleToggleTheme = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleTheme();
  };

  const handleChangeAvatar = async () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!mediaPerm?.granted) {
      const { status } = await requestMediaPerm();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'We need access to your photos to change your avatar.');
        return;
      }
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        setAvatarUrl(uri);
        const saveResult = await updateAvatar(uri);
        if (!saveResult.success) {
          Alert.alert('Error', saveResult.error || 'Failed to save profile photo.');
        } else if (saveResult.error) {
          Alert.alert('Saved Locally', saveResult.error);
        }
      }
    } catch {
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handleSaveProfile = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const updates: any = {};
      if (name.trim() && name !== user?.fullName) updates.full_name = name.trim();
      if (username.trim() && username !== user?.username) updates.username = username.trim();
      if (bio.trim() !== (user?.bio || '')) updates.bio = bio.trim();
      if (location.trim() !== (user?.location || '')) updates.location = location.trim();

      if (Object.keys(updates).length === 0) {
        setSaving(false);
        return;
      }

      // Update profiles table
      if (user?.id) {
        const { error } = await supabase
          .from('profiles')
          .upsert({ id: user.id, ...updates, updated_at: new Date().toISOString() });
        if (error) throw new Error(error.message);
        // Also update users table so search/follow/social see changes
        await supabase.from('users').upsert({ id: user.id, ...updates });
      }

      // Refresh AuthContext so UI reflects changes immediately
      await refreshProfile();

      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to save. Please try again.');
      Alert.alert('Error', err?.message || 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          signOut();
        },
      },
    ]);
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: colors.surface,
      alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
    placeholder: { width: 40 },
    scrollView: { flex: 1 },
    scrollContent: { paddingBottom: 32 },
    section: { padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 4 },
    sectionSubtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 16 },
    settingItem: {
      flexDirection: 'row', alignItems: 'center',
      padding: 14, borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1, borderColor: colors.border,
      marginBottom: 10,
    },
    settingIcon: {
      width: 40, height: 40, borderRadius: 12,
      backgroundColor: colors.accentGlow,
      alignItems: 'center', justifyContent: 'center', marginRight: 14,
    },
    settingContent: { flex: 1 },
    settingLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
    settingValue: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    themeToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    logoutItem: {
      backgroundColor: 'rgba(255, 82, 82, 0.08)',
      borderColor: 'rgba(255, 82, 82, 0.2)',
    },
    logoutLabel: { color: '#FF5252' },
    // Editable fields
    fieldInput: { fontSize: 15, paddingVertical: 0 },
    bioInput: { minHeight: 60, textAlignVertical: 'top', lineHeight: 20 },
    charCount: { fontSize: 12, marginTop: 4, textAlign: 'right' },
    errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 10 },
    errorText: { fontSize: 13, flex: 1 },
    saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 14, marginBottom: 14 },
    saveBtnText: { fontSize: 15, fontWeight: '600', color: '#FFF' },
    versionText: { fontSize: 12, color: colors.textTertiary, textAlign: 'center', marginTop: 24 },
  });

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Dark Mode */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <Text style={styles.sectionSubtitle}>Customize how the app looks</Text>

          <View style={styles.settingItem}>
            <View style={styles.settingIcon}>
              {isDark ? <Moon size={20} color="#FFD93D" /> : <Sun size={20} color="#FF8C00" />}
            </View>
            <View style={[styles.settingContent, styles.themeToggleRow]}>
              <View>
                <Text style={styles.settingLabel}>Dark Mode</Text>
                <Text style={styles.settingValue}>{isDark ? 'On' : 'Off'}</Text>
              </View>
              <Switch
                value={isDark}
                onValueChange={handleToggleTheme}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor="#FFFFFF"
                ios_backgroundColor={colors.border}
              />
            </View>
          </View>
        </View>

        {/* Managed Account */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Text style={styles.sectionSubtitle}>Manage your profile</Text>

          <TouchableOpacity style={styles.settingItem} onPress={handleChangeAvatar}>
            <Image
              source={{ uri: avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200' }}
              style={{ width: 40, height: 40, borderRadius: 20, marginRight: 14 }}
            />
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Profile Picture</Text>
              <Text style={styles.settingValue}>Tap to change</Text>
            </View>
            <Camera size={18} color={colors.textTertiary} />
          </TouchableOpacity>

          {/* Editable Name */}
          <View style={styles.settingItem}>
            <View style={styles.settingIcon}>
              <User size={20} color={colors.accent} />
            </View>
            <View style={styles.settingContent}>
              <TextInput
                style={[styles.fieldInput, { color: colors.text }]}
                placeholder="Your name"
                placeholderTextColor={colors.textTertiary}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Editable Username */}
          <View style={styles.settingItem}>
            <View style={styles.settingIcon}>
              <Text style={{ color: colors.textTertiary, fontSize: 18, fontWeight: '700' }}>@</Text>
            </View>
            <View style={styles.settingContent}>
              <TextInput
                style={[styles.fieldInput, { color: colors.text }]}
                placeholder="username"
                placeholderTextColor={colors.textTertiary}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Editable Bio */}
          <View style={[styles.settingItem, { alignItems: 'flex-start' }]}>
            <View style={[styles.settingIcon, { marginTop: 2 }]}>
              <FileText size={20} color={colors.accent} />
            </View>
            <View style={styles.settingContent}>
              <TextInput
                style={[styles.fieldInput, styles.bioInput, { color: colors.text }]}
                placeholder="Tell people about yourself..."
                placeholderTextColor={colors.textTertiary}
                value={bio}
                onChangeText={(t) => setBio(t.slice(0, MAX_BIO))}
                multiline
                numberOfLines={3}
                maxLength={MAX_BIO}
              />
              <Text style={[styles.charCount, { color: colors.textTertiary }]}>
                {bio.length}/{MAX_BIO}
              </Text>
            </View>
          </View>

          {/* Editable Location */}
          <View style={styles.settingItem}>
            <View style={styles.settingIcon}>
              <MapPin size={20} color={colors.accent} />
            </View>
            <View style={styles.settingContent}>
              <TextInput
                style={[styles.fieldInput, { color: colors.text }]}
                placeholder="Location"
                placeholderTextColor={colors.textTertiary}
                value={location}
                onChangeText={setLocation}
              />
            </View>
          </View>

          {/* Email (read-only) */}
          <View style={[styles.settingItem, { opacity: 0.8 }]}>
            <View style={styles.settingIcon}>
              <Mail size={20} color={colors.accent} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingLabel}>Email</Text>
              <Text style={styles.settingValue}>{user?.email || 'Not signed in'}</Text>
            </View>
          </View>

          {/* Save Button */}
          {saveError ? (
            <View style={[styles.errorBox, { backgroundColor: 'rgba(255,82,82,0.1)', borderColor: 'rgba(255,82,82,0.3)' }]}>
              <AlertCircle size={16} color="#FF5252" />
              <Text style={[styles.errorText, { color: '#FF5252' }]}>{saveError}</Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.accent, opacity: saving ? 0.6 : 1 }]}
            onPress={handleSaveProfile}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Save size={18} color="#FFF" />
            )}
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Profile'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.settingItem, styles.logoutItem]} onPress={handleSignOut}>
            <View style={[styles.settingIcon, { backgroundColor: 'rgba(255, 82, 82, 0.15)' }]}>
              <LogOut size={20} color="#FF5252" />
            </View>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, styles.logoutLabel]}>Sign Out</Text>
              <Text style={styles.settingValue}>Log out of your account</Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.versionText}>apparently v1.0</Text>
      </ScrollView>
    </View>
  );
}
