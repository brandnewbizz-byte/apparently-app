import { ArrowLeft, Moon, Sun, LogOut, Mail } from 'lucide-react-native';
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();

  const handleToggleTheme = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleTheme();
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
    container: { flex: 1 },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1,
    },
    backButton: {
      width: 40, height: 40, borderRadius: 20,
      alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { fontSize: 18, fontWeight: '600' },
    placeholder: { width: 40 },
    scrollView: { flex: 1 },
    scrollContent: { paddingBottom: 32 },
    section: { padding: 16, borderBottomWidth: 1 },
    sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
    sectionSubtitle: { fontSize: 13, marginBottom: 16 },
    settingItem: {
      flexDirection: 'row', alignItems: 'center',
      padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 10,
    },
    settingIcon: {
      width: 40, height: 40, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center', marginRight: 14,
    },
    settingContent: { flex: 1 },
    settingLabel: { fontSize: 15, fontWeight: '600' },
    settingValue: { fontSize: 13, marginTop: 2 },
    themeToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    logoutItem: { backgroundColor: 'rgba(255, 82, 82, 0.08)', borderColor: 'rgba(255, 82, 82, 0.2)' },
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
        {/* Appearance */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Appearance</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>Customize how the app looks</Text>

          <View style={[styles.settingItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.settingIcon, { backgroundColor: colors.accentGlow }]}>
              {isDark ? <Moon size={20} color="#FFD93D" /> : <Sun size={20} color="#FF8C00" />}
            </View>
            <View style={[styles.settingContent, styles.themeToggleRow]}>
              <View>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Dark Mode</Text>
                <Text style={[styles.settingValue, { color: colors.textSecondary }]}>{isDark ? 'On' : 'Off'}</Text>
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

        {/* Account */}
        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Account</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>Edit your profile by tapping your avatar on your profile page</Text>

          <View style={[styles.settingItem, { backgroundColor: colors.surface, borderColor: colors.border, opacity: 0.8 }]}>
            <View style={[styles.settingIcon, { backgroundColor: colors.accentGlow }]}>
              <Mail size={20} color={colors.accent} />
            </View>
            <View style={styles.settingContent}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Email</Text>
              <Text style={[styles.settingValue, { color: colors.textSecondary }]}>{user?.email || 'Not signed in'}</Text>
            </View>
          </View>

          {/* Sign Out */}
          <TouchableOpacity
            style={[styles.settingItem, styles.logoutItem]}
            onPress={handleSignOut}
          >
            <View style={[styles.settingIcon, { backgroundColor: 'rgba(255,82,82,0.2)' }]}>
              <LogOut size={20} color="#FF5252" />
            </View>
            <View style={styles.settingContent}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#FF5252' }}>Sign Out</Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={[styles.versionText, { color: colors.textTertiary }]}>apparently v1.0</Text>
      </ScrollView>
    </View>
  );
}
