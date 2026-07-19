import { Tabs } from 'expo-router';
import { Home, Newspaper, CalendarDays, User } from 'lucide-react-native';
import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/contexts/ThemeContext';
import { useTabBar } from '@/contexts/TabBarContext';

export default function TabLayout() {
  const { colors } = useTheme();
  const { tabBarTranslateY } = useTabBar();
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
          name="book"
          options={{
            tabBarButton: () => null,
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
        <Tabs.Screen
          name="swap"
          options={{
            title: 'Swap',
            tabBarButton: () => null,
          }}
        />
        <Tabs.Screen
          name="planner"
          options={{
            title: 'Planner',
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? [styles.activeIconContainer, { backgroundColor: colors.accentGlow }] : undefined}>
                <CalendarDays size={24} color={color} />
              </View>
            ),
          }}
        />

        <Tabs.Screen
          name="inbox"
          options={{
            title: 'Inbox',
            tabBarButton: () => null,
          }}
        />
        <Tabs.Screen
          name="manage"
          options={{
            title: 'Manage Deals',
            tabBarButton: () => null,
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
});
