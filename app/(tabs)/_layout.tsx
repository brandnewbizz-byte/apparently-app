import { Tabs } from 'expo-router';
import { Home, Newspaper, Users, User, Search, Plus } from 'lucide-react-native';
import React from 'react';
import { View, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/contexts/ThemeContext';
import { useTabBar } from '@/contexts/TabBarContext';
import { useCreatePost } from '@/contexts/CreatePostContext';

export default function TabLayout() {
  const { colors } = useTheme();
  const { tabBarTranslateY } = useTabBar();
  const { openCreate } = useCreatePost();
  const insets = useSafeAreaInsets();

  const baseHeight = Platform.OS === 'ios' ? 56 : 52;
  const tabBarHeight = baseHeight + Math.max(insets.bottom, 0);

  return (
    <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.tabIconSelected,
          tabBarInactiveTintColor: colors.tabIconDefault,
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.tabBar,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            paddingTop: 4,
            paddingBottom: Math.max(insets.bottom - 4, 4),
            height: tabBarHeight,
            position: 'absolute' as const,
            left: 0,
            right: 0,
            bottom: 0,
            transform: [{ translateY: tabBarTranslateY }],
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '500' as const,
            marginTop: 4,
          },
        }}
      >
        <Tabs.Screen
          name="(home)"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? [styles.activeIconContainer, { backgroundColor: colors.accentGlow }] : undefined}>
                <Home size={24} color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: 'Search',
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? [styles.activeIconContainer, { backgroundColor: colors.accentGlow }] : undefined}>
                <Search size={24} color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="feed"
          options={{
            title: 'Feed',
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? [styles.activeIconContainer, { backgroundColor: colors.accentGlow }] : undefined}>
                <Newspaper size={24} color={color} />
              </View>
            ),
          }}
        />
        {/* Centered create-post button — raises above the bar, opens the compose flow */}
        <Tabs.Screen
          name="create"
          options={{
            title: 'Create',
            tabBarShowLabel: false,
            tabBarButton: () => (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Create post"
                onPress={openCreate}
                activeOpacity={0.8}
                style={styles.createButtonWrap}
              >
                <View style={[styles.createButton, { backgroundColor: colors.accent }]}>
                  <Plus size={28} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
            ),
          }}
        />
        <Tabs.Screen
          name="live"
          options={{
            tabBarShowLabel: false,
            title: 'Live',
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? [styles.activeIconContainer, { backgroundColor: colors.accentGlow }] : undefined}>
                <Users size={24} color={color} />
              </View>
            ),
          }}
        />
        {/* Planner moved to top-right header icons (feed + profile) — hidden from bottom nav */}
        <Tabs.Screen
          name="planner"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? [styles.activeIconContainer, { backgroundColor: colors.accentGlow }] : undefined}>
                <User size={24} color={color} />
              </View>
            ),
          }}
        />
      </Tabs>
  );
}

const styles = StyleSheet.create({
  activeIconContainer: {
    padding: 6,
    borderRadius: 12,
    marginBottom: -4,
  },
  createButtonWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
  },
  createButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -18,
    borderWidth: 4,
    borderColor: 'transparent',
  },
});
