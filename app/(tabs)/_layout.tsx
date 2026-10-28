import { Tabs } from 'expo-router';
import { Home, Newspaper, User, LayoutGrid } from 'lucide-react-native';
import React from 'react';
import { View, StyleSheet, Platform, Image } from 'react-native';

const PLANNER_ICON = require('@/assets/images/planner-tab.png');
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/contexts/ThemeContext';
import { useTabBar } from '@/contexts/TabBarContext';

// Screens that live inside the tabs but have no button in the bar.
// Don't use `href: null` for this: in this Expo Router version it marks the
// screen as hidden, and navigating to a hidden screen is cancelled and sent
// back to Home — which is why Planner, Live and Search couldn't be opened.
const OFF_BAR = {
  tabBarButton: () => null,
  tabBarItemStyle: { display: 'none' as const },
};

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
        {/* Search moved to top-right header icon on feed — hidden from bottom nav */}
        <Tabs.Screen
          name="search"
          options={{
            ...OFF_BAR,
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
        {/* Planner — the app logo is its icon. (Create moved: skills, bundles and
            requests are made from Manage; posts from the + on the Feed.) */}
        <Tabs.Screen
          name="planner"
          options={{
            title: 'Planner',
            tabBarAccessibilityLabel: 'Planner',
            tabBarIcon: ({ focused }) => (
              <View style={focused ? [styles.activeIconContainer, { backgroundColor: colors.accentGlow }] : undefined}>
                <Image source={PLANNER_ICON} style={[styles.logoIcon, !focused && { opacity: 0.8 }]} resizeMode="contain" />
              </View>
            ),
          }}
        />
        <Tabs.Screen name="create" options={{ ...OFF_BAR }} />
        {/* Live/Spot moved into the Planner (calendar) tab — hidden from bottom nav */}
        <Tabs.Screen
          name="live"
          options={{
            ...OFF_BAR,
          }}
        />
        {/* Manage hub — skills, bundles, plans, and orders in one place */}
        <Tabs.Screen
          name="manage"
          options={{
            title: 'Manage',
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? [styles.activeIconContainer, { backgroundColor: colors.accentGlow }] : undefined}>
                <LayoutGrid size={24} color={color} />
              </View>
            ),
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
  logoIcon: { width: 30, height: 30 },
  activeIconContainer: {
    padding: 6,
    borderRadius: 12,
    marginBottom: -4,
  },
});
