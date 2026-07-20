import { MessageCircle, UserPlus, Check, X, MapPin, Clock, Star } from 'lucide-react-native';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Image,
  Platform,
  RefreshControl,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useConnections, ConnectionRequest } from '@/contexts/ConnectionsContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useTabBar } from '@/contexts/TabBarContext';
import { useMessaging } from '@/contexts/MessagingContext';

const TABS = [
  { id: 'messages' as const, label: 'Messages', icon: MessageCircle },
  { id: 'requests' as const, label: 'Requests', icon: UserPlus },
];

export default function InboxScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const connections = useConnections();
  const messaging = useMessaging();
  const { colors } = useTheme();
  const { handleScroll: handleTabBarScroll } = useTabBar();

  const [activeTab, setActiveTab] = useState<'messages' | 'requests'>('messages');
  const [refreshing, setRefreshing] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const date = new Date(timestamp);
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  const requestCount = connections.incomingRequests.length;

  // ─── Messages Tab ───

  const renderMessages = () => {
    if (messaging.conversations.length === 0) {
      return (
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.surface }]}>
            <MessageCircle size={40} color={colors.textTertiary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No messages yet</Text>
          <Text style={[styles.emptySub, { color: colors.textTertiary }]}>
            Grab a bundle or skill from Home to start a conversation
          </Text>
        </View>
      );
    }

    return messaging.conversations.map((conv) => {
      const lastMsg = conv.messages[conv.messages.length - 1];
      return (
        <TouchableOpacity
          key={conv.id}
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          activeOpacity={0.8}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push(`/inbox/conversation/${conv.participantId}` as any);
          }}
        >
          <Image
            source={{ uri: conv.participantAvatar }}
            style={[styles.avatar, { backgroundColor: colors.backgroundTertiary }]}
          />
          <View style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>
                {conv.participantName}
              </Text>
              <Text style={[styles.cardTime, { color: colors.textTertiary }]}>
                {formatTimeAgo(conv.lastMessageAt)}
              </Text>
            </View>
            <Text style={[styles.cardPreview, { color: colors.textSecondary }]} numberOfLines={1}>
              {lastMsg?.text || 'No messages'}
            </Text>
          </View>
          {conv.unreadCount > 0 && (
            <View style={[styles.unread, { backgroundColor: colors.accent }]}>
              <Text style={styles.unreadText}>{conv.unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      );
    });
  };

  // ─── Requests Tab ───

  const approveRequest = (r: ConnectionRequest) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    connections.approveRequest(r.id);
    Alert.alert('Connected!', `You are now connected with ${r.fromProfile.name}.`);
  };

  const rejectRequest = (r: ConnectionRequest) => {
    Alert.alert('Decline', `Decline request from ${r.fromProfile.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline',
        style: 'destructive',
        onPress: () => {
          connections.rejectRequest(r.id);
        },
      },
    ]);
  };

  const renderRequests = () => {
    const { incomingRequests, outgoingRequests } = connections;

    if (incomingRequests.length === 0 && outgoingRequests.length === 0) {
      return (
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.surface }]}>
            <UserPlus size={40} color={colors.textTertiary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No requests</Text>
          <Text style={[styles.emptySub, { color: colors.textTertiary }]}>
            Connection requests will appear here
          </Text>
        </View>
      );
    }

    return (
      <>
        {incomingRequests.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              {incomingRequests.length} pending
            </Text>
            {incomingRequests.map((r) => (
              <View
                key={r.id}
                style={[styles.requestCard, { backgroundColor: colors.surface, borderColor: colors.accent + '30' }]}
              >
                <Image source={{ uri: r.fromProfile.avatar }} style={[styles.avatar, { backgroundColor: colors.backgroundTertiary }]} />
                <View style={styles.cardContent}>
                  <View style={styles.cardHeader}>
                    <Text style={[styles.cardName, { color: colors.text }]}>{r.fromProfile.name}</Text>
                    <Text style={[styles.cardTime, { color: colors.textTertiary }]}>{formatTimeAgo(r.createdAt)}</Text>
                  </View>
                  {r.fromProfile.location ? (
                    <View style={styles.metaRow}>
                      <MapPin size={11} color={colors.textTertiary} />
                      <Text style={[styles.metaText, { color: colors.textTertiary }]}>{r.fromProfile.location}</Text>
                    </View>
                  ) : null}
                  <Text style={[styles.bio, { color: colors.textSecondary }]} numberOfLines={1}>
                    {r.fromProfile.bio || 'Wants to connect'}
                  </Text>
                </View>
                <View style={styles.requestBtns}>
                  <TouchableOpacity style={styles.approveBtn} onPress={() => approveRequest(r)}>
                    <Check size={16} color="#10B981" />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.declineBtn, { backgroundColor: colors.live + '20' }]} onPress={() => rejectRequest(r)}>
                    <X size={16} color={colors.live} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}

        {outgoingRequests.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: 20 }]}>Sent</Text>
            {outgoingRequests.map((r) => (
              <View key={r.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Image source={{ uri: r.toProfile?.avatar }} style={[styles.avatar, { backgroundColor: colors.backgroundTertiary }]} />
                <View style={styles.cardContent}>
                  <Text style={[styles.cardName, { color: colors.text }]}>{r.toProfile?.name}</Text>
                  <View style={styles.metaRow}>
                    <Clock size={11} color={colors.textTertiary} />
                    <Text style={[styles.metaText, { color: colors.textTertiary }]}>Pending</Text>
                  </View>
                </View>
              </View>
            ))}
          </>
        )}
      </>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>Inbox</Text>

        {/* Tab switcher */}
        <View style={styles.tabRow}>
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            const Icon = tab.icon;
            const badge = tab.id === 'messages' ? messaging.conversations.length : requestCount;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.tab,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  active && { backgroundColor: colors.accentGlow, borderColor: colors.accent },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setActiveTab(tab.id);
                }}
              >
                <Icon size={16} color={active ? colors.accent : colors.textSecondary} />
                <Text style={[styles.tabLabel, { color: active ? colors.accent : colors.textSecondary }]}>{tab.label}</Text>
                {badge > 0 && (
                  <View style={[styles.tabBadge, { backgroundColor: active ? colors.accent : colors.border }]}>
                    <Text style={styles.tabBadgeText}>{badge}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollInner}
        showsVerticalScrollIndicator={false}
        onScroll={(e) => handleTabBarScroll(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {activeTab === 'messages' ? renderMessages() : renderRequests()}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 14 },
  tabRow: { flexDirection: 'row', gap: 8 },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1,
  },
  tabLabel: { fontSize: 13, fontWeight: '600' },
  tabBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 },
  tabBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFF' },
  scroll: { flex: 1 },
  scrollInner: { padding: 16, paddingBottom: 100 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 17, fontWeight: '600' },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
  card: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderRadius: 14, marginBottom: 10, borderWidth: 1,
  },
  requestCard: {
    flexDirection: 'row', alignItems: 'flex-start', padding: 14,
    borderRadius: 14, marginBottom: 10, borderWidth: 1,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  cardContent: { flex: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  cardName: { fontSize: 15, fontWeight: '600', flex: 1 },
  cardTime: { fontSize: 12, marginLeft: 8 },
  cardPreview: { fontSize: 13, lineHeight: 18 },
  unread: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginLeft: 8,
  },
  unreadText: { fontSize: 10, fontWeight: '700', color: '#FFF' },
  sectionLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  metaText: { fontSize: 12 },
  bio: { fontSize: 13, lineHeight: 18 },
  requestBtns: { flexDirection: 'column', gap: 6, marginLeft: 8 },
  approveBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: '#10B98120',
    alignItems: 'center', justifyContent: 'center',
  },
  declineBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
