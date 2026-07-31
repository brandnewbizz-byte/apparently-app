import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import UserProfileContent from '@/components/UserProfileContent';
import { ArrowLeft } from 'lucide-react-native';

/**
 * User Profile Screen — shared wrapper around UserProfileContent.
 * Shows the same Instagram-style profile design as the profile tab,
 * but for ANY user (via route param userId).
 *
 * Navigation from feed/search/followers now routes here for non-own profiles.
 */
export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  if (!userId) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>User not found</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Header with back button */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <ArrowLeft size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 40 }} />
      </View>
      {/* Unified profile content — same design as the profile tab */}
      <UserProfileContent userId={userId} isOwnProfile={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  emptyText: { fontSize: 16, color: '#999' },
  backBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, backgroundColor: '#1C1C1E' },
  backBtnText: { fontSize: 14, fontWeight: '600', color: '#3B82F6' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#000',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});
