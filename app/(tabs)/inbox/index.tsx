import { Bell, MessageCircle, Heart, Users, Zap, Settings, BadgeCheck, Search, X, UserPlus, Check, MapPin, Clock, Phone, Mail, Star } from 'lucide-react-native';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  TextInput,
  RefreshControl,
  Modal,
  Alert,
  Linking,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';


import { useConnections, ConnectionRequest } from '@/contexts/ConnectionsContext';
import { useLifeCrm } from '@/contexts/LifeCrmContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useTabBar } from '@/contexts/TabBarContext';
import { useMessaging } from '@/contexts/MessagingContext';

interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'live' | 'mention' | 'insight';
  user: { id: string; name: string; username: string; avatar: string };
  message: string;
  timestamp: string;
  read: boolean;
}

const mockNotifications: Notification[] = [];

const mainTabs = [
  { id: 'notifications', label: 'Activity', icon: Bell },
  { id: 'messages', label: 'Messages', icon: MessageCircle },
  { id: 'requests', label: 'Requests', icon: UserPlus },
];

const notificationTabs = [
  { id: 'all', label: 'All', icon: Bell },
  { id: 'mentions', label: 'Mentions', icon: MessageCircle },
  { id: 'likes', label: 'Likes', icon: Heart },
  { id: 'follows', label: 'Follows', icon: Users },
];



export default function InboxScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const connections = useConnections();
  const messaging = useMessaging();
  const { relationships } = useLifeCrm();
  const { colors } = useTheme();
  const { handleScroll: handleTabBarScroll } = useTabBar();
  const [mainTab, setMainTab] = useState('notifications');
  const [selectedRequest, setSelectedRequest] = useState<ConnectionRequest | null>(null);
  const [showRequestProfile, setShowRequestProfile] = useState(false);
  const [selectedTab, setSelectedTab] = useState('all');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showContactActions, setShowContactActions] = useState(false);
  const [selectedNotificationUser, setSelectedNotificationUser] = useState<Notification['user'] | null>(null);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const getNotificationIcon = useCallback((type: Notification['type']) => {
    switch (type) {
      case 'like':
        return { icon: Heart, color: colors.live };
      case 'comment':
        return { icon: MessageCircle, color: colors.accent };
      case 'follow':
        return { icon: Users, color: colors.gradient2 };
      case 'live':
        return { icon: Zap, color: colors.live };
      case 'mention':
        return { icon: MessageCircle, color: colors.gradient3 };
      case 'insight':
        return { icon: Zap, color: colors.accent };
      default:
        return { icon: Bell, color: colors.textSecondary };
    }
  }, [colors]);

  const filteredNotifications = useMemo(() => {
    let notifications = selectedTab === 'all' 
      ? mockNotifications 
      : mockNotifications.filter(n => {
          if (selectedTab === 'mentions') return n.type === 'mention' || n.type === 'comment';
          if (selectedTab === 'likes') return n.type === 'like';
          if (selectedTab === 'follows') return n.type === 'follow';
          return true;
        });
    
    if (searchQuery.trim()) {
      notifications = notifications.filter(n =>
        n.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.message.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return notifications;
  }, [selectedTab, searchQuery]);

  const unreadCount = mockNotifications.filter(n => !n.read).length;
  const requestsCount = connections.incomingRequests.length;
  const messagesCount = messaging.conversations.length;

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const date = new Date(timestamp);
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const handleApproveRequest = (request: ConnectionRequest) => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    connections.approveRequest(request.id);
    setShowRequestProfile(false);
    setSelectedRequest(null);
    Alert.alert(
      'Connection Approved!',
      `You are now connected with ${request.fromProfile.name}. You can now message each other.`
    );
  };

  const handleRejectRequest = (request: ConnectionRequest) => {
    Alert.alert(
      'Decline Request',
      `Are you sure you want to decline the request from ${request.fromProfile.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: () => {
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            connections.rejectRequest(request.id);
            setShowRequestProfile(false);
            setSelectedRequest(null);
          },
        },
      ]
    );
  };

  const handleViewRequestProfile = (request: ConnectionRequest) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedRequest(request);
    setShowRequestProfile(true);
  };

  const renderRequestCard = useCallback((request: ConnectionRequest) => (
    <TouchableOpacity
      key={request.id}
      style={[styles.requestCard, { backgroundColor: colors.surface, borderColor: colors.accent + '30' }]}
      activeOpacity={0.8}
      onPress={() => handleViewRequestProfile(request)}
    >
      <Image source={{ uri: request.fromProfile.avatar }} style={[styles.requestAvatar, { backgroundColor: colors.backgroundTertiary }]} />
      
      <View style={styles.requestContent}>
        <View style={styles.requestHeader}>
          <Text style={[styles.requestName, { color: colors.text }]}>{request.fromProfile.name}</Text>
          <Text style={[styles.requestTime, { color: colors.textTertiary }]}>{formatTimeAgo(request.createdAt)}</Text>
        </View>
        
        <View style={styles.requestMeta}>
          <MapPin size={12} color={colors.textTertiary} />
          <Text style={[styles.requestLocation, { color: colors.textTertiary }]}>{request.fromProfile.location}</Text>
        </View>
        
        <Text style={[styles.requestBio, { color: colors.textSecondary }]} numberOfLines={1}>
          {request.fromProfile.bio}
        </Text>
        
        <View style={styles.requestSkills}>
          {request.fromProfile.skills.slice(0, 2).map((skill, idx) => (
            <View key={idx} style={[styles.requestSkillPill, { backgroundColor: colors.backgroundTertiary }]}>
              <Text style={[styles.requestSkillText, { color: colors.text }]}>{skill}</Text>
            </View>
          ))}
          {request.fromProfile.skills.length > 2 && (
            <Text style={[styles.moreSkillsText, { color: colors.textTertiary }]}>+{request.fromProfile.skills.length - 2}</Text>
          )}
        </View>
      </View>

      <View style={styles.requestActions}>
        <TouchableOpacity
          style={styles.approveBtn}
          onPress={(e) => {
            e.stopPropagation();
            handleApproveRequest(request);
          }}
        >
          <Check size={18} color="#10B981" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.declineBtn, { backgroundColor: colors.live + '20' }]}
          onPress={(e) => {
            e.stopPropagation();
            handleRejectRequest(request);
          }}
        >
          <X size={18} color={colors.live} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  ), [colors, formatTimeAgo, handleApproveRequest, handleRejectRequest, handleViewRequestProfile]);

  const renderRequestsSection = () => {
    if (connections.incomingRequests.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconContainer, { backgroundColor: colors.surface }]}>
            <UserPlus size={48} color={colors.textTertiary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No connection requests</Text>
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
            When someone wants to connect with you, their request will appear here
          </Text>
        </View>
      );
    }

    return (
      <>
        <View style={styles.requestsHeader}>
          <Text style={[styles.requestsCount, { color: colors.text }]}>
            {connections.incomingRequests.length} pending {connections.incomingRequests.length === 1 ? 'request' : 'requests'}
          </Text>
        </View>
        {connections.incomingRequests.map(renderRequestCard)}
        
        {connections.outgoingRequests.length > 0 && (
          <>
            <View style={[styles.sectionDivider, { borderTopColor: colors.border }]}>
              <Text style={[styles.sectionDividerText, { color: colors.textSecondary }]}>Sent Requests</Text>
            </View>
            {connections.outgoingRequests.map((request) => (
              <View key={request.id} style={[styles.sentRequestCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Image source={{ uri: request.toProfile?.avatar }} style={[styles.sentRequestAvatar, { backgroundColor: colors.backgroundTertiary }]} />
                <View style={styles.sentRequestContent}>
                  <Text style={[styles.sentRequestName, { color: colors.text }]}>{request.toProfile?.name}</Text>
                  <View style={styles.sentRequestStatus}>
                    <Clock size={12} color={colors.textTertiary} />
                    <Text style={[styles.sentRequestStatusText, { color: colors.textTertiary }]}>Pending</Text>
                  </View>
                </View>
              </View>
            ))}
          </>
        )}
      </>
    );
  };

const handleSearchOpen = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setIsSearchOpen(true);
  };

  const handleSearchClose = () => {
    setIsSearchOpen(false);
    setSearchQuery('');
  };

  const handleSettings = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push('/profile/settings' as any);
  };

  const findContactForUser = (user: Notification['user']) => {
    return relationships.find(
      (r) => r.name.toLowerCase() === user.name.toLowerCase() ||
             r.name.toLowerCase().includes(user.name.toLowerCase())
    );
  };

  const handleNotificationUserPress = (user: Notification['user']) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedNotificationUser(user);
    setShowContactActions(true);
  };

  const handleCallContact = () => {
    if (!selectedNotificationUser) return;
    const contact = findContactForUser(selectedNotificationUser);
    if (contact?.phone) {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      Linking.openURL(`tel:${contact.phone}`);
    } else {
      Alert.alert('No Phone Number', `No phone number saved for ${selectedNotificationUser.name}`);
    }
    setShowContactActions(false);
    setSelectedNotificationUser(null);
  };

  const handleEmailContact = () => {
    if (!selectedNotificationUser) return;
    const contact = findContactForUser(selectedNotificationUser);
    if (contact?.email) {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      Linking.openURL(`mailto:${contact.email}`);
    } else {
      Alert.alert('No Email', `No email saved for ${selectedNotificationUser.name}`);
    }
    setShowContactActions(false);
    setSelectedNotificationUser(null);
  };

  const handleViewProfile = () => {
    if (!selectedNotificationUser) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setShowContactActions(false);
    setSelectedNotificationUser(null);
    router.push(`/user/${selectedNotificationUser.id}` as any);
  };

  const handleConversationPress = (participantId: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push(`/inbox/conversation/${participantId}` as any);
  };

  const renderMessagesSection = () => {
    if (messaging.conversations.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconContainer, { backgroundColor: colors.surface }]}>
            <MessageCircle size={48} color={colors.textTertiary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No messages yet</Text>
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
            Share a post with someone to start a conversation
          </Text>
        </View>
      );
    }

    return (
      <>
        {messaging.conversations.map((conversation) => {
          const lastMessage = conversation.messages[conversation.messages.length - 1];
          const hasSharedPost = lastMessage?.sharedPost;
          
          return (
            <TouchableOpacity
              key={conversation.id}
              style={[styles.conversationCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              activeOpacity={0.8}
              onPress={() => handleConversationPress(conversation.participantId)}
            >
              <Image 
                source={{ uri: conversation.participantAvatar }} 
                style={[styles.conversationAvatar, { backgroundColor: colors.backgroundTertiary }]} 
              />
              
              <View style={styles.conversationContent}>
                <View style={styles.conversationHeader}>
                  <Text style={[styles.conversationName, { color: colors.text }]} numberOfLines={1}>
                    {conversation.participantName}
                  </Text>
                  <Text style={[styles.conversationTime, { color: colors.textTertiary }]}>
                    {formatTimeAgo(conversation.lastMessageAt)}
                  </Text>
                </View>
                
                <Text style={[styles.conversationPreview, { color: colors.textSecondary }]} numberOfLines={1}>
                  {hasSharedPost 
                    ? `📎 Shared a post${lastMessage.text ? `: ${lastMessage.text}` : ''}` 
                    : lastMessage?.text || 'No messages yet'}
                </Text>
              </View>

              {conversation.unreadCount > 0 && (
                <View style={[styles.conversationUnread, { backgroundColor: colors.accent }]}>
                  <Text style={styles.conversationUnreadText}>{conversation.unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <View style={styles.headerRow}>
          {!isSearchOpen ? (
            <>
              <View style={styles.titleRow}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Inbox</Text>
                {unreadCount > 0 && (
                  <View style={[styles.unreadBadge, { backgroundColor: colors.live }]}>
                    <Text style={[styles.unreadText, { color: colors.text }]}>
                      {unreadCount}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.headerActions}>
                <TouchableOpacity style={[styles.iconButton, { backgroundColor: colors.surface }]} onPress={handleSearchOpen}>
                  <Search size={20} color={colors.text} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.iconButton, { backgroundColor: colors.surface }]} onPress={handleSettings}>
                  <Settings size={20} color={colors.text} />
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.searchContainer}>
              <View style={[styles.searchInputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Search size={18} color={colors.textTertiary} />
                <TextInput
                  style={[styles.searchInput, { color: colors.text }]}
                  placeholder="Search notifications..."
                  placeholderTextColor={colors.textTertiary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <X size={18} color={colors.textTertiary} />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity onPress={handleSearchClose}>
                <Text style={[styles.cancelButton, { color: colors.accent }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.mainTabsContainer}>
          {mainTabs.map((tab) => {
            const isSelected = mainTab === tab.id;
            const IconComponent = tab.icon;
            const count = tab.id === 'notifications' ? unreadCount : 
                           tab.id === 'messages' ? messagesCount : requestsCount;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.mainTab, 
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  isSelected && { backgroundColor: colors.accentGlow, borderColor: colors.accent }
                ]}
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  setMainTab(tab.id);
                }}
              >
                <IconComponent
                  size={18}
                  color={isSelected ? colors.accent : colors.textSecondary}
                />
                <Text style={[styles.mainTabText, { color: isSelected ? colors.accent : colors.textSecondary }]}>
                  {tab.label}
                </Text>
                {count > 0 && (
                  <View style={[styles.mainTabBadge, { backgroundColor: isSelected ? colors.accent : colors.border }]}>
                    <Text style={[styles.mainTabBadgeText, { color: colors.text }]}>{count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {mainTab === 'notifications' && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsContainer}
          >
            {notificationTabs.map((tab) => {
              const isSelected = selectedTab === tab.id;
              const IconComponent = tab.icon;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[styles.tab, { backgroundColor: colors.surface, borderColor: colors.border }, isSelected && styles.tabActive]}
                  onPress={() => setSelectedTab(tab.id)}
                >
                  {isSelected && (
                    <LinearGradient
                      colors={[colors.gradient1, colors.gradient2]}
                      style={StyleSheet.absoluteFill}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    />
                  )}
                  <IconComponent
                    size={16}
                    color={isSelected ? colors.text : colors.textSecondary}
                  />
                  <Text style={[styles.tabText, { color: isSelected ? colors.text : colors.textSecondary }]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={(e) => handleTabBarScroll(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {mainTab === 'messages' ? (
            renderMessagesSection()
          ) : mainTab === 'requests' ? (
            renderRequestsSection()
          ) : mainTab === 'notifications' ? (
            <>
              {filteredNotifications.map((notification) => {
                const { icon: IconComponent, color } = getNotificationIcon(notification.type);
                const userContact = findContactForUser(notification.user);
                const hasContactInfo = userContact?.phone || userContact?.email;
                
                return (
                  <TouchableOpacity
                    key={notification.id}
                    style={[
                      styles.notificationCard,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                      !notification.read && { backgroundColor: colors.surfaceHighlight, borderColor: colors.accent + '30' },
                    ]}
                    activeOpacity={0.8}
                    onPress={() => {
                      if (Platform.OS !== 'web') {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                      router.push(`/inbox/${notification.id}` as any);
                    }}
                  >
                    {!notification.read && <View style={[styles.unreadIndicator, { backgroundColor: colors.accent }]} />}
                    
                    <TouchableOpacity 
                      style={styles.avatarContainer}
                      onPress={() => handleNotificationUserPress(notification.user)}
                      activeOpacity={0.7}
                    >
                      <Image
                        source={{ uri: notification.user.avatar }}
                        style={[styles.avatar, { backgroundColor: colors.backgroundTertiary }]}
                      />
                      <View style={[styles.iconBadge, { backgroundColor: color + '30', borderColor: colors.surface }]}>
                        <IconComponent size={12} color={color} />
                      </View>
                      {hasContactInfo && (
                        <View style={[styles.contactIndicator, { borderColor: colors.surface }]}>
                          <Phone size={8} color="#FFFFFF" />
                        </View>
                      )}
                    </TouchableOpacity>

                    <View style={styles.notificationContent}>
                      <View style={styles.notificationHeader}>
                        <TouchableOpacity 
                          style={styles.nameRow}
                          onPress={() => handleNotificationUserPress(notification.user)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.userName, { color: colors.text }]}>{notification.user.name}</Text>
                          {false && (
                            <BadgeCheck size={14} color={colors.accent} />
                          )}
                        </TouchableOpacity>
                        <Text style={[styles.timestamp, { color: colors.textTertiary }]}>{notification.timestamp}</Text>
                      </View>
                      <Text style={[styles.message, { color: colors.textSecondary }]} numberOfLines={2}>
                        {notification.message}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {filteredNotifications.length === 0 && (
                <View style={styles.emptyState}>
                  <Bell size={48} color={colors.textTertiary} />
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>No notifications yet</Text>
                  <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                    When something happens, you will see it here
                  </Text>
                </View>
              )}
            </>
          ) : null}
        </Animated.View>
      </ScrollView>

      <Modal
        visible={showRequestProfile}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRequestProfile(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowRequestProfile(false)}
        >
          <View style={[styles.requestProfileModal, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHandleBar, { backgroundColor: colors.border }]} />
            
            {selectedRequest && (
              <>
                <View style={styles.profilePreviewHeader}>
                  <Image
                    source={{ uri: selectedRequest.fromProfile.avatar }}
                    style={[styles.profilePreviewAvatar, { backgroundColor: colors.backgroundTertiary }]}
                  />
                  {selectedRequest.fromProfile.verified && (
                    <View style={[styles.profilePreviewVerified, { backgroundColor: colors.surface }]}>
                      <BadgeCheck size={20} color="#10B981" />
                    </View>
                  )}
                </View>

                <Text style={[styles.profilePreviewName, { color: colors.text }]}>{selectedRequest.fromProfile.name}</Text>
                
                <View style={styles.profilePreviewMeta}>
                  <MapPin size={14} color={colors.textSecondary} />
                  <Text style={[styles.profilePreviewLocation, { color: colors.textSecondary }]}>{selectedRequest.fromProfile.location}</Text>
                  <Text style={[styles.profilePreviewDot, { color: colors.textTertiary }]}>•</Text>
                  <Text style={[styles.profilePreviewDistance, { color: colors.textSecondary }]}>{selectedRequest.fromProfile.distance} mi away</Text>
                </View>

                <View style={styles.profilePreviewRating}>
                  <Star size={14} color="#F59E0B" fill="#F59E0B" />
                  <Text style={[styles.profilePreviewRatingText, { color: colors.text }]}>{selectedRequest.fromProfile.rating}</Text>
                  <Text style={[styles.profilePreviewReviews, { color: colors.textTertiary }]}>({selectedRequest.fromProfile.reviewCount} reviews)</Text>
                </View>

                <Text style={[styles.profilePreviewBio, { color: colors.textSecondary }]}>{selectedRequest.fromProfile.bio}</Text>

                <View style={styles.profilePreviewSkills}>
                  {selectedRequest.fromProfile.skills.map((skill, idx) => (
                    <View key={idx} style={[styles.profilePreviewSkillPill, { backgroundColor: colors.backgroundTertiary }]}>
                      <Text style={[styles.profilePreviewSkillText, { color: colors.text }]}>{skill}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.profilePreviewLookingFor}>
                  <Text style={[styles.profilePreviewLookingForLabel, { color: colors.textSecondary }]}>Looking for:</Text>
                  <View style={[styles.profilePreviewLookingForBadge, { backgroundColor: colors.accent + '20' }]}>
                    <Text style={[styles.profilePreviewLookingForText, { color: colors.accent }]}>
                      {selectedRequest.fromProfile.lookingFor === 'networking' ? 'Networking' :
                       selectedRequest.fromProfile.lookingFor === 'collaboration' ? 'Collaboration' :
                       selectedRequest.fromProfile.lookingFor === 'hiring' ? 'Hiring' : 'Opportunities'}
                    </Text>
                  </View>
                </View>

                {selectedRequest.message && (
                  <View style={[styles.requestMessage, { backgroundColor: colors.backgroundTertiary }]}>
                    <Text style={[styles.requestMessageLabel, { color: colors.textTertiary }]}>Message:</Text>
                    <Text style={[styles.requestMessageText, { color: colors.text }]}>{selectedRequest.message}</Text>
                  </View>
                )}

                <View style={styles.profilePreviewActions}>
                  <TouchableOpacity
                    style={[styles.declineActionBtn, { backgroundColor: colors.live + '15' }]}
                    onPress={() => handleRejectRequest(selectedRequest)}
                  >
                    <X size={18} color={colors.live} />
                    <Text style={[styles.declineActionText, { color: colors.live }]}>Decline</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.approveActionBtn}
                    onPress={() => handleApproveRequest(selectedRequest)}
                  >
                    <LinearGradient
                      colors={[colors.accent, colors.accentSecondary]}
                      style={styles.approveActionGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Check size={18} color={colors.text} />
                      <Text style={[styles.approveActionText, { color: colors.text }]}>Accept</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showContactActions}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowContactActions(false);
          setSelectedNotificationUser(null);
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setShowContactActions(false);
            setSelectedNotificationUser(null);
          }}
        >
          <View style={[styles.contactActionSheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.contactActionHeader, { borderBottomColor: colors.border }]}>
              {selectedNotificationUser && (
                <>
                  <Image
                    source={{ uri: selectedNotificationUser.avatar }}
                    style={[styles.contactActionAvatar, { backgroundColor: colors.backgroundTertiary }]}
                  />
                  <Text style={[styles.contactActionName, { color: colors.text }]}>{selectedNotificationUser.name}</Text>
                  {false && (
                    <BadgeCheck size={16} color={colors.accent} style={{ marginLeft: 4 }} />
                  )}
                </>
              )}
            </View>

            {selectedNotificationUser && (() => {
              const contact = findContactForUser(selectedNotificationUser);
              return (
                <>
                  {contact?.phone && (
                    <TouchableOpacity style={styles.contactActionItem} onPress={handleCallContact}>
                      <View style={[styles.contactActionIcon, { backgroundColor: '#10B98120' }]}>
                        <Phone size={20} color="#10B981" />
                      </View>
                      <View style={styles.contactActionContent}>
                        <Text style={[styles.contactActionText, { color: colors.text }]}>Call</Text>
                        <Text style={[styles.contactActionSubtext, { color: colors.textTertiary }]}>{contact.phone}</Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {contact?.email && (
                    <TouchableOpacity style={styles.contactActionItem} onPress={handleEmailContact}>
                      <View style={[styles.contactActionIcon, { backgroundColor: colors.accent + '20' }]}>
                        <Mail size={20} color={colors.accent} />
                      </View>
                      <View style={styles.contactActionContent}>
                        <Text style={[styles.contactActionText, { color: colors.text }]}>Email</Text>
                        <Text style={[styles.contactActionSubtext, { color: colors.textTertiary }]}>{contact.email}</Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {!contact?.phone && !contact?.email && (
                    <View style={styles.noContactInfo}>
                      <Text style={[styles.noContactInfoText, { color: colors.textTertiary }]}>
                        No contact information saved for this person
                      </Text>
                    </View>
                  )}
                </>
              );
            })()}

            <TouchableOpacity style={styles.contactActionItem} onPress={handleViewProfile}>
              <View style={[styles.contactActionIcon, { backgroundColor: colors.surface }]}>
                <Users size={20} color={colors.textSecondary} />
              </View>
              <View style={styles.contactActionContent}>
                <Text style={[styles.contactActionText, { color: colors.text }]}>View Profile</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.contactActionCancel, { backgroundColor: colors.backgroundTertiary }]}
              onPress={() => {
                setShowContactActions(false);
                setSelectedNotificationUser(null);
              }}
            >
              <Text style={[styles.contactActionCancelText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    marginTop: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  cancelButton: {
    fontSize: 15,
    fontWeight: '500' as const,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
  },
  unreadBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  unreadText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  tabsContainer: {
    gap: 10,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tabActive: {
    borderColor: 'transparent',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  notificationCard: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
  },
  unreadIndicator: {
    position: 'absolute',
    left: 4,
    top: '50%',
    marginTop: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  iconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  timestamp: {
    fontSize: 12,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    marginTop: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  mainTabsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  mainTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  mainTabText: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  mainTabBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  mainTabBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
  },
  connectContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  connectIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  connectTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    marginBottom: 12,
    textAlign: 'center',
  },
  connectSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  connectButton: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  connectButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    gap: 10,
  },
  connectButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  emailHeader2: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginBottom: 8,
    borderBottomWidth: 1,
  },
  emailUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emailUserAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  emailUserName: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  emailUserEmail: {
    fontSize: 12,
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  emailTabsScroll: {
    marginBottom: 16,
  },
  emailTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  emailTabText: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  emailTabBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    marginLeft: 2,
  },
  emailTabBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
  },
  emailCard: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  emailUnreadIndicator: {
    position: 'absolute',
    left: 4,
    top: '50%',
    marginTop: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emailLeft: {
    position: 'relative',
    marginRight: 12,
  },
  emailAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  emailAvatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailAvatarText: {
    fontSize: 18,
    fontWeight: '600' as const,
  },
  priorityDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  emailContent: {
    flex: 1,
  },
  emailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  emailMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emailSender: {
    fontSize: 14,
    fontWeight: '500' as const,
    flex: 1,
  },
  emailTime: {
    fontSize: 11,
  },
  emailSubject: {
    fontSize: 14,
    marginBottom: 4,
  },
  emailSnippet: {
    fontSize: 13,
    lineHeight: 18,
  },
  emailMoreButton: {
    padding: 4,
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingBottom: 34,
  },
  actionSheetHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  actionSheetTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  actionSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  actionSheetDestructive: {},
  actionSheetText: {
    fontSize: 16,
  },
  actionSheetCancel: {
    marginTop: 8,
    marginHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionSheetCancelText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  requestCard: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  requestAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 12,
  },
  requestContent: {
    flex: 1,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  requestName: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  requestTime: {
    fontSize: 12,
  },
  requestMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  requestLocation: {
    fontSize: 12,
  },
  requestBio: {
    fontSize: 13,
    marginBottom: 8,
    lineHeight: 18,
  },
  requestSkills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  requestSkillPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  requestSkillText: {
    fontSize: 10,
    fontWeight: '500' as const,
  },
  moreSkillsText: {
    fontSize: 10,
    paddingVertical: 4,
  },
  requestActions: {
    flexDirection: 'column',
    gap: 8,
    marginLeft: 8,
  },
  approveBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10B98120',
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestsHeader: {
    marginBottom: 12,
  },
  requestsCount: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  sectionDivider: {
    marginTop: 20,
    marginBottom: 12,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  sectionDividerText: {
    fontSize: 13,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  sentRequestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  sentRequestAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  sentRequestContent: {
    flex: 1,
  },
  sentRequestName: {
    fontSize: 15,
    fontWeight: '600' as const,
    marginBottom: 2,
  },
  sentRequestStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sentRequestStatusText: {
    fontSize: 12,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  requestProfileModal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  modalHandleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  profilePreviewHeader: {
    alignItems: 'center',
    position: 'relative',
    marginBottom: 16,
  },
  profilePreviewAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  profilePreviewVerified: {
    position: 'absolute',
    top: 0,
    right: '30%',
    borderRadius: 12,
    padding: 2,
  },
  profilePreviewName: {
    fontSize: 24,
    fontWeight: '700' as const,
    textAlign: 'center',
    marginBottom: 8,
  },
  profilePreviewMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 8,
  },
  profilePreviewLocation: {
    fontSize: 14,
  },
  profilePreviewDot: {
    fontSize: 14,
  },
  profilePreviewDistance: {
    fontSize: 14,
  },
  profilePreviewRating: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 16,
  },
  profilePreviewRatingText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  profilePreviewReviews: {
    fontSize: 13,
  },
  profilePreviewBio: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
    paddingHorizontal: 10,
  },
  profilePreviewSkills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  profilePreviewSkillPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  profilePreviewSkillText: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  profilePreviewLookingFor: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  profilePreviewLookingForLabel: {
    fontSize: 14,
  },
  profilePreviewLookingForBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  profilePreviewLookingForText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  requestMessage: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  requestMessageLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    marginBottom: 6,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  requestMessageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  profilePreviewActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  declineActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  declineActionText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  approveActionBtn: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  approveActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  approveActionText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  contactIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  contactActionSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: 40,
  },
  contactActionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
  },
  contactActionAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  contactActionName: {
    fontSize: 18,
    fontWeight: '600' as const,
  },
  contactActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 14,
  },
  contactActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactActionContent: {
    flex: 1,
  },
  contactActionText: {
    fontSize: 16,
    fontWeight: '500' as const,
  },
  contactActionSubtext: {
    fontSize: 13,
    marginTop: 2,
  },
  contactActionCancel: {
    marginTop: 8,
    marginHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  contactActionCancelText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  noContactInfo: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
  },
  noContactInfoText: {
    fontSize: 14,
    textAlign: 'center',
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
  },
  conversationAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 12,
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '600' as const,
    flex: 1,
  },
  conversationTime: {
    fontSize: 12,
    marginLeft: 8,
  },
  conversationPreview: {
    fontSize: 14,
    lineHeight: 18,
  },
  conversationUnread: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  conversationUnreadText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
});
