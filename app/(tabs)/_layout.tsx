import { Tabs } from 'expo-router';
import { Home, Newspaper, Radio, CalendarDays, User } from 'lucide-react-native';
import React from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { useTheme } from '@/contexts/ThemeContext';
import { useTabBar } from '@/contexts/TabBarContext';

// Only these tabs appear in the bar
const VISIBLE_TABS = ['(home)', 'feed', 'live', 'planner', 'profile'];

const ICON_MAP: Record<string, React.FC<{ size: number; color: string }>> = {
  '(home)': Home,
  feed: Newspaper,
  live: Radio,
  planner: CalendarDays,
  profile: User,
};

const LABEL_MAP: Record<string, string> = {
  '(home)': 'Home',
  feed: 'Feed',
  live: 'Spot',
  planner: 'Planner',
  profile: 'Profile',
};

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const { tabBarTranslateY } = useTabBar();
  const insets = useSafeAreaInsets();
  const baseHeight = Platform.OS === 'ios' ? 56 : 52;
  const tabBarHeight = baseHeight + Math.max(insets.bottom, 0);

  // Filter to only visible tabs
  const visibleRoutes = state.routes.filter((route) => VISIBLE_TABS.includes(route.name));

  return (
    <Animated.View
      style={[
        styles.tabBar,
        {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom - 4, 4),
          height: tabBarHeight,
          transform: [{ translateY: tabBarTranslateY }],
        },
      ]}
    >
      {visibleRoutes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        // Find the actual index in state.routes for focus
        const actualIndex = state.routes.findIndex((r) => r.key === route.key);
        const isActualFocused = state.index === actualIndex;

        const Icon = ICON_MAP[route.name];
        const label = LABEL_MAP[route.name] || options.title || route.name;
        const color = isActualFocused ? colors.tabIconSelected : colors.tabIconDefault;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isActualFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            style={styles.tabItem}
            activeOpacity={0.7}
          >
            {Icon && (
              <View style={isActualFocused ? [styles.activeIconContainer, { backgroundColor: colors.accentGlow }] : undefined}>
                <Icon size={24} color={color} />
              </View>
            )}
            <Text style={[styles.label, { color }]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </Animated.View>
  );
}

export default function TabLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          tabBarActiveTintColor: colors.tabIconSelected,
          tabBarInactiveTintColor: colors.tabIconDefault,
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="(home)"
          options={{ title: 'Home' }}
        />
        <Tabs.Screen
          name="feed"
          options={{ title: 'Feed' }}
        />
        <Tabs.Screen
          name="live"
          options={{ title: 'Spot' }}
        />
        <Tabs.Screen
          name="planner"
          options={{ title: 'Planner' }}
        />
        <Tabs.Screen
          name="profile"
          options={{ title: 'Profile' }}
        />

        {/* Hidden from tab bar — registered for navigation only */}
        <Tabs.Screen name="book" options={{ href: null }} />
        <Tabs.Screen name="swap" options={{ href: null, title: 'Swap' }} />
        <Tabs.Screen name="inbox" options={{ href: null, title: 'Inbox' }} />
      </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 4,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
  },
  activeIconContainer: {
    padding: 6,
    borderRadius: 12,
    marginBottom: -4,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
  },
});
