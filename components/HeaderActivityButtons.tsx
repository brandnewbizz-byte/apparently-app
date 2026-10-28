import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Heart, Send } from 'lucide-react-native';

import { useTheme } from '@/contexts/ThemeContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useMessaging } from '@/contexts/MessagingContext';

/**
 * Instagram-style header actions:
 *  ♡  Activity (notifications) — red dot when there's anything new
 *  ✈  Messages — red count badge for unread conversations
 */
export default function HeaderActivityButtons({ size = 25, color, gap }: { size?: number; color?: string; gap?: number }) {
  const router = useRouter();
  const { colors } = useTheme();
  const iconColor = color || colors.text;
  const { unreadCount: unreadNotifications } = useNotifications();
  const { conversations } = useMessaging();
  const unreadThreads = conversations.filter((c) => (c.unreadCount || 0) > 0).length;

  // Little "pop" when a new notification arrives
  const pop = useRef(new Animated.Value(1)).current;
  const lastCount = useRef(unreadNotifications);
  useEffect(() => {
    if (unreadNotifications > lastCount.current) {
      Animated.sequence([
        Animated.spring(pop, { toValue: 1.25, useNativeDriver: true, speed: 40, bounciness: 12 }),
        Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 30 }),
      ]).start();
    }
    lastCount.current = unreadNotifications;
  }, [unreadNotifications, pop]);

  const go = (path: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(path as any);
  };

  return (
    <View style={[styles.row, gap !== undefined && { gap }]}>
      <TouchableOpacity
        onPress={() => go('/notifications')}
        hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
        accessibilityLabel={unreadNotifications ? `Notifications, ${unreadNotifications} new` : 'Notifications'}
        testID="header-notifications"
      >
        <Animated.View style={{ transform: [{ scale: pop }] }}>
          <Heart size={size} color={iconColor} strokeWidth={2} />
          {unreadNotifications > 0 && <View style={[styles.dot, { borderColor: colors.background }]} />}
        </Animated.View>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => go('/inbox')}
        hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
        accessibilityLabel={unreadThreads ? `Messages, ${unreadThreads} unread` : 'Messages'}
        testID="header-messages"
      >
        <View>
          <Send size={size - 1} color={iconColor} strokeWidth={2} style={{ transform: [{ rotate: '15deg' }] }} />
          {unreadThreads > 0 && (
            <View style={[styles.badge, { borderColor: colors.background }]}>
              <Text style={styles.badgeText}>{unreadThreads > 9 ? '9+' : unreadThreads}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 22 },
  dot: {
    position: 'absolute', top: -1, right: -2,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#FF3040', borderWidth: 1.5,
  },
  badge: {
    position: 'absolute', top: -7, right: -9,
    minWidth: 19, height: 19, borderRadius: 10, paddingHorizontal: 4,
    backgroundColor: '#FF3040', borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
});
