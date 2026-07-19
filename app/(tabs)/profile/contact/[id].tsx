import {
  ArrowLeft,
  Phone,
  Mail,
  Building2,
  Briefcase,
  Calendar,
  Clock,
  MessageCircle,
  Users,
  AlertTriangle,
  CheckCircle2,
  Plus,
  ChevronRight,
  Flag,
  Edit2,
  Trash2,
  User,
  Tag,
  FileText,
  X,
  DollarSign,
} from 'lucide-react-native';
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Animated,
  TextInput,
  Modal,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import Colors from '@/constants/colors';
import { useLifeCrm } from '@/contexts/LifeCrmContext';
import { ContactInteraction, ContactFollowUp, Relationship, MeetingIncomeStatus, MeetingIncomeType } from '@/mocks/lifeCrmData';
import DateTimePicker from '@/components/DateTimePicker';

type TabType = 'overview' | 'interactions' | 'meetings' | 'followups';

const getCategoryColor = (category: string) => {
  const colors: Record<string, string> = {
    family: '#FF6B9D',
    friend: '#00D4FF',
    business: '#7B61FF',
    mentor: '#FFB300',
    colleague: '#00E676',
  };
  return colors[category] || Colors.dark.accent;
};

const getInteractionIcon = (type: string) => {
  switch (type) {
    case 'call':
      return Phone;
    case 'meeting':
      return Users;
    case 'message':
      return MessageCircle;
    case 'email':
      return Mail;
    case 'in_person':
      return Users;
    default:
      return MessageCircle;
  }
};

const getPriorityColor = (priority: string) => {
  const colors: Record<string, string> = {
    low: '#00D4FF',
    medium: '#FFB300',
    high: '#FF6B9D',
    urgent: '#FF5252',
  };
  return colors[priority] || Colors.dark.textSecondary;
};

export default function ContactDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showAddInteraction, setShowAddInteraction] = useState(false);
  const [showAddMeeting, setShowAddMeeting] = useState(false);
  const [showAddFollowUp, setShowAddFollowUp] = useState(false);
  const [showEditContact, setShowEditContact] = useState(false);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const {
    getContactById,
    addInteraction,
    addMeeting,
    addFollowUp,
    completeFollowUp,
    updateMeeting,
    updateContact,
    deleteContact,
  } = useLifeCrm();

  const contact = getContactById(id || '');

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleTabPress = (tab: TabType) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    setActiveTab(tab);
  };

  const handleCall = async () => {
    if (contact?.phone) {
      try {
        await Linking.openURL(`tel:${contact.phone}`);
        
        if (id) {
          addInteraction(id, {
            type: 'call',
            date: new Date().toISOString().split('T')[0],
            notes: 'Call initiated from app',
          });
          console.log('[Contact] Call logged for:', contact.name);
        }
        
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (error) {
        console.error('[Contact] Failed to open phone:', error);
        Alert.alert('Error', 'Unable to open phone app');
      }
    } else {
      Alert.alert('No Phone Number', 'This contact does not have a phone number');
    }
  };

  const handleEmail = async () => {
    if (contact?.email) {
      try {
        await Linking.openURL(`mailto:${contact.email}`);
        
        if (id) {
          addInteraction(id, {
            type: 'email',
            date: new Date().toISOString().split('T')[0],
            notes: 'Email initiated from app',
          });
          console.log('[Contact] Email logged for:', contact.name);
        }
        
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (error) {
        console.error('[Contact] Failed to open email:', error);
        Alert.alert('Error', 'Unable to open email app');
      }
    } else {
      Alert.alert('No Email', 'This contact does not have an email address');
    }
  };

  const handleText = async () => {
    if (contact?.phone) {
      try {
        await Linking.openURL(`sms:${contact.phone}`);
        
        if (id) {
          addInteraction(id, {
            type: 'message',
            date: new Date().toISOString().split('T')[0],
            notes: 'Text message initiated from app',
          });
          console.log('[Contact] Text message logged for:', contact.name);
        }
        
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (error) {
        console.error('[Contact] Failed to open messaging:', error);
        Alert.alert('Error', 'Unable to open messaging app');
      }
    } else {
      Alert.alert('No Phone Number', 'This contact does not have a phone number');
    }
  };

  const handleLogInteraction = (type: ContactInteraction['type'], notes: string) => {
    if (!id) return;
    addInteraction(id, {
      type,
      date: new Date().toISOString().split('T')[0],
      notes,
    });
    setShowAddInteraction(false);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleAddMeeting = (
    title: string, 
    date: string, 
    time: string, 
    location: string, 
    agenda: string,
    expectedIncome?: number,
    incomeType?: MeetingIncomeType,
    incomeStatus?: MeetingIncomeStatus
  ) => {
    if (!id) return;
    addMeeting(id, {
      title,
      date,
      time,
      location,
      agenda,
      status: 'scheduled',
      expectedIncome,
      incomeType,
      incomeStatus,
    });
    setShowAddMeeting(false);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleAddFollowUp = (title: string, dueDate: string, priority: ContactFollowUp['priority'], notes: string) => {
    if (!id) return;
    addFollowUp(id, {
      title,
      dueDate,
      priority,
      status: 'pending',
      notes,
    });
    setShowAddFollowUp(false);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleCompleteFollowUp = (followUpId: string) => {
    if (!id) return;
    completeFollowUp(id, followUpId);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleCompleteMeeting = (meetingId: string) => {
    if (!id) return;
    updateMeeting(id, meetingId, { status: 'completed' });
    addInteraction(id, {
      type: 'meeting',
      date: new Date().toISOString().split('T')[0],
      notes: 'Completed scheduled meeting',
    });
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleDeleteContact = () => {
    Alert.alert(
      'Delete Contact',
      `Are you sure you want to delete ${contact?.name}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (id) {
              deleteContact(id);
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
              router.back();
            }
          },
        },
      ]
    );
  };

  const handleUpdateContact = (updates: Partial<Relationship>) => {
    if (!id || !contact) return;
    updateContact(id, updates);
    setShowEditContact(false);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  if (!contact) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={Colors.dark.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Contact Not Found</Text>
        </View>
      </View>
    );
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderOverviewTab = () => (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      {contact.needsAttention && (
        <View style={styles.attentionBanner}>
          <AlertTriangle size={18} color={Colors.dark.warning} />
          <Text style={styles.attentionText}>{contact.attentionReason || 'This contact needs your attention'}</Text>
        </View>
      )}

      <View style={styles.contactInfo}>
        {contact.phone && (
          <TouchableOpacity style={styles.contactRow} onPress={handleCall}>
            <View style={[styles.contactIcon, { backgroundColor: 'rgba(0, 230, 118, 0.15)' }]}>
              <Phone size={18} color={Colors.dark.success} />
            </View>
            <View style={styles.contactDetail}>
              <Text style={styles.contactLabel}>Phone</Text>
              <Text style={styles.contactValue}>{contact.phone}</Text>
            </View>
            <ChevronRight size={18} color={Colors.dark.textTertiary} />
          </TouchableOpacity>
        )}
        {contact.email && (
          <TouchableOpacity style={styles.contactRow} onPress={handleEmail}>
            <View style={[styles.contactIcon, { backgroundColor: 'rgba(0, 212, 255, 0.15)' }]}>
              <Mail size={18} color="#00D4FF" />
            </View>
            <View style={styles.contactDetail}>
              <Text style={styles.contactLabel}>Email</Text>
              <Text style={styles.contactValue}>{contact.email}</Text>
            </View>
            <ChevronRight size={18} color={Colors.dark.textTertiary} />
          </TouchableOpacity>
        )}
        {contact.company && (
          <View style={styles.contactRow}>
            <View style={[styles.contactIcon, { backgroundColor: 'rgba(123, 97, 255, 0.15)' }]}>
              <Building2 size={18} color="#7B61FF" />
            </View>
            <View style={styles.contactDetail}>
              <Text style={styles.contactLabel}>Company</Text>
              <Text style={styles.contactValue}>{contact.company}</Text>
            </View>
          </View>
        )}
        {contact.role && (
          <View style={styles.contactRow}>
            <View style={[styles.contactIcon, { backgroundColor: 'rgba(255, 179, 0, 0.15)' }]}>
              <Briefcase size={18} color="#FFB300" />
            </View>
            <View style={styles.contactDetail}>
              <Text style={styles.contactLabel}>Role</Text>
              <Text style={styles.contactValue}>{contact.role}</Text>
            </View>
          </View>
        )}
      </View>

      {contact.notes && (
        <View style={styles.notesSection}>
          <Text style={styles.notesLabel}>Notes</Text>
          <Text style={styles.notesText}>{contact.notes}</Text>
        </View>
      )}

      {contact.meetings.filter(m => m.status === 'scheduled').length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming Meetings</Text>
          {contact.meetings.filter(m => m.status === 'scheduled').slice(0, 2).map((meeting) => (
            <TouchableOpacity key={meeting.id} style={styles.meetingCard}>
              <View style={styles.meetingHeader}>
                <Calendar size={16} color={Colors.dark.accent} />
                <Text style={styles.meetingTitle}>{meeting.title}</Text>
              </View>
              <Text style={styles.meetingDate}>
                {formatDate(meeting.date)} at {meeting.time}
              </Text>
              {meeting.location && (
                <Text style={styles.meetingLocation}>{meeting.location}</Text>
              )}
              {meeting.agenda && (
                <Text style={styles.meetingAgenda} numberOfLines={2}>{meeting.agenda}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {contact.followUps.filter(f => f.status !== 'completed').length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pending Follow-ups</Text>
          {contact.followUps.filter(f => f.status !== 'completed').slice(0, 2).map((followUp) => (
            <View key={followUp.id} style={styles.followUpCard}>
              <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(followUp.priority) }]} />
              <View style={styles.followUpContent}>
                <Text style={styles.followUpTitle}>{followUp.title}</Text>
                <Text style={[
                  styles.followUpDue,
                  followUp.status === 'overdue' && styles.overdue
                ]}>
                  Due: {formatDate(followUp.dueDate)}
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.completeBtn}
                onPress={() => handleCompleteFollowUp(followUp.id)}
              >
                <CheckCircle2 size={22} color={Colors.dark.success} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {contact.interactions.slice(0, 3).map((interaction) => {
          const Icon = getInteractionIcon(interaction.type);
          return (
            <View key={interaction.id} style={styles.activityItem}>
              <View style={styles.activityIcon}>
                <Icon size={16} color={Colors.dark.textSecondary} />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityType}>{interaction.type.replace('_', ' ')}</Text>
                {interaction.notes && (
                  <Text style={styles.activityNotes} numberOfLines={2}>{interaction.notes}</Text>
                )}
              </View>
              <Text style={styles.activityDate}>{formatDate(interaction.date)}</Text>
            </View>
          );
        })}
      </View>
    </Animated.View>
  );

  const formatTime = (time?: string) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const renderInteractionsTab = () => (
    <View style={styles.tabContent}>
      <TouchableOpacity 
        style={styles.addButton}
        onPress={() => setShowAddInteraction(true)}
      >
        <Plus size={18} color={Colors.dark.text} />
        <Text style={styles.addButtonText}>Log Interaction</Text>
      </TouchableOpacity>

      {contact.interactions.length === 0 ? (
        <View style={styles.emptyState}>
          <MessageCircle size={40} color={Colors.dark.textTertiary} />
          <Text style={styles.emptyTitle}>No interactions yet</Text>
          <Text style={styles.emptySubtitle}>Log your first interaction with {contact.name}</Text>
        </View>
      ) : (
        contact.interactions.map((interaction) => {
          const Icon = getInteractionIcon(interaction.type);
          return (
            <View key={interaction.id} style={styles.interactionCard}>
              <View style={styles.interactionHeader}>
                <View style={styles.interactionTypeIcon}>
                  <Icon size={18} color={Colors.dark.accent} />
                </View>
                <View style={styles.interactionMeta}>
                  <Text style={styles.interactionType}>{interaction.type.replace('_', ' ')}</Text>
                  <Text style={styles.interactionDate}>
                    {formatDate(interaction.date)}
                    {interaction.time && ` at ${formatTime(interaction.time)}`}
                  </Text>
                </View>
                {interaction.duration && (
                  <View style={styles.durationBadge}>
                    <Clock size={12} color={Colors.dark.textSecondary} />
                    <Text style={styles.durationText}>{interaction.duration}min</Text>
                  </View>
                )}
              </View>
              {interaction.notes && (
                <Text style={styles.interactionNotes}>{interaction.notes}</Text>
              )}
              {interaction.outcome && (
                <View style={styles.outcomeBadge}>
                  <Text style={styles.outcomeText}>{interaction.outcome}</Text>
                </View>
              )}
            </View>
          );
        })
      )}
    </View>
  );

  const renderMeetingsTab = () => (
    <View style={styles.tabContent}>
      <TouchableOpacity 
        style={styles.addButton}
        onPress={() => setShowAddMeeting(true)}
      >
        <Plus size={18} color={Colors.dark.text} />
        <Text style={styles.addButtonText}>Schedule Meeting</Text>
      </TouchableOpacity>

      {contact.meetings.length === 0 ? (
        <View style={styles.emptyState}>
          <Calendar size={40} color={Colors.dark.textTertiary} />
          <Text style={styles.emptyTitle}>No meetings scheduled</Text>
          <Text style={styles.emptySubtitle}>Schedule a meeting with {contact.name}</Text>
        </View>
      ) : (
        contact.meetings.map((meeting) => (
          <View key={meeting.id} style={[
            styles.meetingCardFull,
            meeting.status === 'completed' && styles.completedMeeting
          ]}>
            <View style={styles.meetingCardHeader}>
              <View style={[
                styles.meetingStatus,
                { backgroundColor: meeting.status === 'scheduled' ? 'rgba(0, 212, 255, 0.15)' : 'rgba(0, 230, 118, 0.15)' }
              ]}>
                <Text style={[
                  styles.meetingStatusText,
                  { color: meeting.status === 'scheduled' ? '#00D4FF' : Colors.dark.success }
                ]}>
                  {meeting.status}
                </Text>
              </View>
              {meeting.status === 'scheduled' && (
                <TouchableOpacity 
                  style={styles.completeMeetingBtn}
                  onPress={() => handleCompleteMeeting(meeting.id)}
                >
                  <CheckCircle2 size={20} color={Colors.dark.success} />
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.meetingCardTitle}>{meeting.title}</Text>
            <View style={styles.meetingCardDate}>
              <Calendar size={14} color={Colors.dark.textSecondary} />
              <Text style={styles.meetingCardDateText}>
                {formatDate(meeting.date)} at {meeting.time}
              </Text>
            </View>
            {meeting.location && (
              <View style={styles.meetingCardLocation}>
                <Building2 size={14} color={Colors.dark.textSecondary} />
                <Text style={styles.meetingCardLocationText}>{meeting.location}</Text>
              </View>
            )}
            {meeting.agenda && (
              <Text style={styles.meetingCardAgenda}>{meeting.agenda}</Text>
            )}
          </View>
        ))
      )}
    </View>
  );

  const renderFollowUpsTab = () => (
    <View style={styles.tabContent}>
      <TouchableOpacity 
        style={styles.addButton}
        onPress={() => setShowAddFollowUp(true)}
      >
        <Plus size={18} color={Colors.dark.text} />
        <Text style={styles.addButtonText}>Add Follow-up</Text>
      </TouchableOpacity>

      {contact.followUps.length === 0 ? (
        <View style={styles.emptyState}>
          <Flag size={40} color={Colors.dark.textTertiary} />
          <Text style={styles.emptyTitle}>No follow-ups</Text>
          <Text style={styles.emptySubtitle}>Create a follow-up reminder for {contact.name}</Text>
        </View>
      ) : (
        contact.followUps.map((followUp) => (
          <View key={followUp.id} style={[
            styles.followUpCardFull,
            followUp.status === 'completed' && styles.completedFollowUp
          ]}>
            <View style={styles.followUpCardHeader}>
              <View style={[
                styles.priorityBadge,
                { backgroundColor: getPriorityColor(followUp.priority) + '20' }
              ]}>
                <Text style={[styles.priorityText, { color: getPriorityColor(followUp.priority) }]}>
                  {followUp.priority}
                </Text>
              </View>
              {followUp.status !== 'completed' && (
                <TouchableOpacity 
                  style={styles.completeFollowUpBtn}
                  onPress={() => handleCompleteFollowUp(followUp.id)}
                >
                  <CheckCircle2 size={20} color={Colors.dark.success} />
                </TouchableOpacity>
              )}
              {followUp.status === 'completed' && (
                <View style={styles.completedBadge}>
                  <CheckCircle2 size={16} color={Colors.dark.success} />
                  <Text style={styles.completedText}>Done</Text>
                </View>
              )}
            </View>
            <Text style={[
              styles.followUpCardTitle,
              followUp.status === 'completed' && styles.completedTitle
            ]}>{followUp.title}</Text>
            <View style={styles.followUpCardDue}>
              <Calendar size={14} color={followUp.status === 'overdue' ? Colors.dark.error : Colors.dark.textSecondary} />
              <Text style={[
                styles.followUpCardDueText,
                followUp.status === 'overdue' && styles.overdueText
              ]}>
                Due: {formatDate(followUp.dueDate)}
              </Text>
            </View>
            {followUp.notes && (
              <Text style={styles.followUpCardNotes}>{followUp.notes}</Text>
            )}
          </View>
        ))
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={Colors.dark.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contact</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            onPress={() => setShowEditContact(true)} 
            style={styles.headerActionButton}
          >
            <Edit2 size={20} color={Colors.dark.text} />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={handleDeleteContact} 
            style={styles.headerActionButton}
          >
            <Trash2 size={20} color={Colors.dark.error} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileSection}>
          <View style={styles.avatarSection}>
            <Image source={{ uri: contact.avatar }} style={styles.avatar} />
            <View style={[
              styles.scoreRing,
              { 
                borderColor: contact.interactionScore > 70 
                  ? Colors.dark.success 
                  : contact.interactionScore > 40 
                    ? Colors.dark.warning 
                    : Colors.dark.error 
              }
            ]}>
              <Text style={styles.scoreText}>{contact.interactionScore}</Text>
            </View>
          </View>

          <Text style={styles.contactName}>{contact.name}</Text>
          <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(contact.category) + '20' }]}>
            <Text style={[styles.categoryText, { color: getCategoryColor(contact.category) }]}>
              {contact.category}
            </Text>
          </View>

          <View style={styles.lastInteraction}>
            <Clock size={14} color={Colors.dark.textSecondary} />
            <Text style={styles.lastInteractionText}>Last contact: {contact.lastInteraction}</Text>
          </View>

          <View style={styles.quickActions}>
            {contact.phone && (
              <TouchableOpacity style={styles.quickActionBtn} onPress={handleCall}>
                <Phone size={20} color={Colors.dark.success} />
              </TouchableOpacity>
            )}
            {contact.phone && (
              <TouchableOpacity style={styles.quickActionBtn} onPress={handleText}>
                <MessageCircle size={20} color="#00D4FF" />
              </TouchableOpacity>
            )}
            {contact.email && (
              <TouchableOpacity style={styles.quickActionBtn} onPress={handleEmail}>
                <Mail size={20} color={Colors.dark.accent} />
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={styles.quickActionBtn} 
              onPress={() => setShowAddMeeting(true)}
            >
              <Calendar size={20} color="#FFB300" />
            </TouchableOpacity>
          </View>

          {contact.tags.length > 0 && (
            <View style={styles.tagsList}>
              {contact.tags.map((tag, idx) => (
                <View key={idx} style={styles.tag}>
                  <Text style={styles.tagText}>#{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.tabsContainer}>
          {(['overview', 'interactions', 'meetings', 'followups'] as TabType[]).map((tab) => (
            <TouchableOpacity 
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => handleTabPress(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'interactions' && renderInteractionsTab()}
        {activeTab === 'meetings' && renderMeetingsTab()}
        {activeTab === 'followups' && renderFollowUpsTab()}
      </ScrollView>

      <AddInteractionModal
        visible={showAddInteraction}
        onClose={() => setShowAddInteraction(false)}
        onSubmit={handleLogInteraction}
      />

      <AddMeetingModal
        visible={showAddMeeting}
        onClose={() => setShowAddMeeting(false)}
        onSubmit={handleAddMeeting}
      />

      <AddFollowUpModal
        visible={showAddFollowUp}
        onClose={() => setShowAddFollowUp(false)}
        onSubmit={handleAddFollowUp}
      />

      <EditContactModal
        visible={showEditContact}
        onClose={() => setShowEditContact(false)}
        onSubmit={handleUpdateContact}
        contact={contact}
      />
    </View>
  );
}

interface AddInteractionModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (type: ContactInteraction['type'], notes: string) => void;
}

function AddInteractionModal({ visible, onClose, onSubmit }: AddInteractionModalProps) {
  const [type, setType] = useState<ContactInteraction['type']>('call');
  const [notes, setNotes] = useState('');

  const interactionTypes: { type: ContactInteraction['type']; label: string; icon: typeof Phone }[] = [
    { type: 'call', label: 'Call', icon: Phone },
    { type: 'meeting', label: 'Meeting', icon: Users },
    { type: 'message', label: 'Message', icon: MessageCircle },
    { type: 'email', label: 'Email', icon: Mail },
    { type: 'in_person', label: 'In Person', icon: Users },
  ];

  const handleSubmit = () => {
    onSubmit(type, notes);
    setType('call');
    setNotes('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Log Interaction</Text>
          
          <Text style={styles.modalLabel}>Type</Text>
          <View style={styles.typeSelector}>
            {interactionTypes.map((item) => (
              <TouchableOpacity
                key={item.type}
                style={[styles.typeOption, type === item.type && styles.typeOptionActive]}
                onPress={() => setType(item.type)}
              >
                <item.icon size={18} color={type === item.type ? Colors.dark.accent : Colors.dark.textSecondary} />
                <Text style={[styles.typeOptionText, type === item.type && styles.typeOptionTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.modalLabel}>Notes</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="Add notes about this interaction..."
            placeholderTextColor={Colors.dark.textTertiary}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
          />

          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleSubmit}>
              <Text style={styles.modalSubmitText}>Log Interaction</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface AddMeetingModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (
    title: string, 
    date: string, 
    time: string, 
    location: string, 
    agenda: string,
    expectedIncome?: number,
    incomeType?: MeetingIncomeType,
    incomeStatus?: MeetingIncomeStatus
  ) => void;
}

const INCOME_TYPES: { value: MeetingIncomeType; label: string }[] = [
  { value: 'consulting', label: 'Consulting' },
  { value: 'service', label: 'Service' },
  { value: 'product', label: 'Product' },
  { value: 'commission', label: 'Commission' },
  { value: 'retainer', label: 'Retainer' },
  { value: 'project', label: 'Project' },
  { value: 'other', label: 'Other' },
];

const INCOME_STATUSES: { value: MeetingIncomeStatus; label: string; color: string }[] = [
  { value: 'planned', label: 'Planned', color: '#00D4FF' },
  { value: 'closed_paid', label: 'Closed - Paid', color: '#2ED573' },
  { value: 'closed_unpaid', label: 'Closed - Unpaid', color: '#FFB300' },
  { value: 'cancelled', label: 'Cancelled', color: '#FF5252' },
];

function AddMeetingModal({ visible, onClose, onSubmit }: AddMeetingModalProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [agenda, setAgenda] = useState('');
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);
  const [expectedIncome, setExpectedIncome] = useState('');
  const [incomeType, setIncomeType] = useState<MeetingIncomeType | undefined>(undefined);
  const [incomeStatus, setIncomeStatus] = useState<MeetingIncomeStatus>('planned');
  const [showIncomeFields, setShowIncomeFields] = useState(false);

  const handleSubmit = () => {
    if (!title || !date || !time) {
      Alert.alert('Error', 'Please fill in title, date, and time');
      return;
    }
    const incomeAmount = expectedIncome ? parseFloat(expectedIncome) : undefined;
    onSubmit(
      title, 
      date, 
      time, 
      location, 
      agenda,
      incomeAmount,
      incomeType,
      incomeAmount ? incomeStatus : undefined
    );
    setTitle('');
    setDate('');
    setTime('');
    setLocation('');
    setAgenda('');
    setExpectedIncome('');
    setIncomeType(undefined);
    setIncomeStatus('planned');
    setShowIncomeFields(false);
  };

  const handleDateTimeSelect = (selectedDate: string, selectedTime: string) => {
    setDate(selectedDate);
    setTime(selectedTime);
    setShowDateTimePicker(false);
  };

  const formatDisplayDateTime = () => {
    if (!date || !time) return 'Select date & time';
    const dateObj = new Date(date);
    const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    const formattedTime = `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
    return `${formattedDate} at ${formattedTime}`;
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Schedule Meeting</Text>
          
          <Text style={styles.modalLabel}>Title *</Text>
          <TextInput
            style={styles.modalInputSingle}
            placeholder="Meeting title"
            placeholderTextColor={Colors.dark.textTertiary}
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.modalLabel}>Date & Time *</Text>
          <TouchableOpacity 
            style={styles.dateTimeButton}
            onPress={() => setShowDateTimePicker(true)}
          >
            <View style={styles.dateTimeButtonContent}>
              <Calendar size={18} color={date ? Colors.dark.accent : Colors.dark.textTertiary} />
              <Text style={[
                styles.dateTimeButtonText,
                date && styles.dateTimeButtonTextSelected
              ]}>
                {formatDisplayDateTime()}
              </Text>
            </View>
            <ChevronRight size={18} color={Colors.dark.textTertiary} />
          </TouchableOpacity>

          <Text style={styles.modalLabel}>Location</Text>
          <TextInput
            style={styles.modalInputSingle}
            placeholder="Where is the meeting?"
            placeholderTextColor={Colors.dark.textTertiary}
            value={location}
            onChangeText={setLocation}
          />

          <Text style={styles.modalLabel}>Agenda</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="What will you discuss?"
            placeholderTextColor={Colors.dark.textTertiary}
            value={agenda}
            onChangeText={setAgenda}
            multiline
            numberOfLines={3}
          />

          <TouchableOpacity 
            style={styles.incomeToggleBtn}
            onPress={() => setShowIncomeFields(!showIncomeFields)}
          >
            <DollarSign size={18} color={showIncomeFields ? Colors.dark.accent : Colors.dark.textSecondary} />
            <Text style={[styles.incomeToggleText, showIncomeFields && { color: Colors.dark.accent }]}>
              {showIncomeFields ? 'Hide Income Fields' : 'Add Expected Income'}
            </Text>
            <ChevronRight 
              size={16} 
              color={showIncomeFields ? Colors.dark.accent : Colors.dark.textTertiary} 
              style={{ transform: [{ rotate: showIncomeFields ? '90deg' : '0deg' }] }}
            />
          </TouchableOpacity>

          {showIncomeFields && (
            <View style={styles.incomeFieldsContainer}>
              <Text style={styles.modalLabel}>Expected Income ($)</Text>
              <TextInput
                style={styles.modalInputSingle}
                placeholder="0.00"
                placeholderTextColor={Colors.dark.textTertiary}
                value={expectedIncome}
                onChangeText={setExpectedIncome}
                keyboardType="numeric"
              />

              <Text style={styles.modalLabel}>Income Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.incomeTypeScroll}>
                <View style={styles.incomeTypeRow}>
                  {INCOME_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type.value}
                      style={[
                        styles.incomeTypeOption,
                        incomeType === type.value && styles.incomeTypeOptionActive,
                      ]}
                      onPress={() => setIncomeType(type.value)}
                    >
                      <Text style={[
                        styles.incomeTypeText,
                        incomeType === type.value && styles.incomeTypeTextActive,
                      ]}>
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Text style={styles.modalLabel}>Status</Text>
              <View style={styles.incomeStatusRow}>
                {INCOME_STATUSES.map((status) => (
                  <TouchableOpacity
                    key={status.value}
                    style={[
                      styles.incomeStatusOption,
                      incomeStatus === status.value && { backgroundColor: status.color + '20', borderColor: status.color },
                    ]}
                    onPress={() => setIncomeStatus(status.value)}
                  >
                    <Text style={[
                      styles.incomeStatusText,
                      incomeStatus === status.value && { color: status.color },
                    ]}>
                      {status.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleSubmit}>
              <Text style={styles.modalSubmitText}>Schedule</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <DateTimePicker
        visible={showDateTimePicker}
        onClose={() => setShowDateTimePicker(false)}
        onSelect={handleDateTimeSelect}
        initialDate={date}
        initialTime={time}
        title="Schedule Meeting"
      />
    </Modal>
  );
}

interface AddFollowUpModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (title: string, dueDate: string, priority: ContactFollowUp['priority'], notes: string) => void;
}

function AddFollowUpModal({ visible, onClose, onSubmit }: AddFollowUpModalProps) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<ContactFollowUp['priority']>('medium');
  const [notes, setNotes] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const priorities: ContactFollowUp['priority'][] = ['low', 'medium', 'high', 'urgent'];

  const handleSubmit = () => {
    if (!title || !dueDate) {
      Alert.alert('Error', 'Please fill in title and due date');
      return;
    }
    onSubmit(title, dueDate, priority, notes);
    setTitle('');
    setDueDate('');
    setPriority('medium');
    setNotes('');
  };

  const handleDateSelect = (selectedDate: string) => {
    setDueDate(selectedDate);
    setShowDatePicker(false);
  };

  const formatDisplayDate = () => {
    if (!dueDate) return 'Select due date';
    const dateObj = new Date(dueDate);
    return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Add Follow-up</Text>
          
          <Text style={styles.modalLabel}>Title *</Text>
          <TextInput
            style={styles.modalInputSingle}
            placeholder="What needs to be done?"
            placeholderTextColor={Colors.dark.textTertiary}
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.modalLabel}>Due Date *</Text>
          <TouchableOpacity 
            style={styles.dateTimeButton}
            onPress={() => setShowDatePicker(true)}
          >
            <View style={styles.dateTimeButtonContent}>
              <Calendar size={18} color={dueDate ? Colors.dark.accent : Colors.dark.textTertiary} />
              <Text style={[
                styles.dateTimeButtonText,
                dueDate && styles.dateTimeButtonTextSelected
              ]}>
                {formatDisplayDate()}
              </Text>
            </View>
            <ChevronRight size={18} color={Colors.dark.textTertiary} />
          </TouchableOpacity>

          <Text style={styles.modalLabel}>Priority</Text>
          <View style={styles.prioritySelector}>
            {priorities.map((p) => (
              <TouchableOpacity
                key={p}
                style={[
                  styles.priorityOption,
                  priority === p && { backgroundColor: getPriorityColor(p) + '20' }
                ]}
                onPress={() => setPriority(p)}
              >
                <Text style={[
                  styles.priorityOptionText,
                  priority === p && { color: getPriorityColor(p) }
                ]}>
                  {p}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.modalLabel}>Notes</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="Additional details..."
            placeholderTextColor={Colors.dark.textTertiary}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />

          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleSubmit}>
              <Text style={styles.modalSubmitText}>Add Follow-up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <DateTimePicker
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onSelect={handleDateSelect}
        initialDate={dueDate}
        mode="date"
        title="Select Due Date"
      />
    </Modal>
  );
}

interface EditContactModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (updates: Partial<Relationship>) => void;
  contact: Relationship | undefined;
}

function EditContactModal({ visible, onClose, onSubmit, contact }: EditContactModalProps) {
  const [name, setName] = useState(contact?.name || '');
  const [category, setCategory] = useState<Relationship['category']>(contact?.category || 'friend');
  const [phone, setPhone] = useState(contact?.phone || '');
  const [email, setEmail] = useState(contact?.email || '');
  const [company, setCompany] = useState(contact?.company || '');
  const [role, setRole] = useState(contact?.role || '');
  const [notes, setNotes] = useState(contact?.notes || '');
  const [tags, setTags] = useState<string[]>(contact?.tags || []);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (contact) {
      setName(contact.name);
      setCategory(contact.category);
      setPhone(contact.phone || '');
      setEmail(contact.email || '');
      setCompany(contact.company || '');
      setRole(contact.role || '');
      setNotes(contact.notes || '');
      setTags(contact.tags);
    }
  }, [contact, visible]);

  const categories: Relationship['category'][] = ['family', 'friend', 'business', 'mentor', 'colleague'];

  const getCategoryColor = (cat: string) => {
    const colors: Record<string, string> = {
      family: '#FF6B9D',
      friend: '#00D4FF',
      business: '#7B61FF',
      mentor: '#FFB300',
      colleague: '#00E676',
    };
    return colors[cat] || Colors.dark.accent;
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim().toLowerCase())) {
      setTags([...tags, tagInput.trim().toLowerCase()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }

    onSubmit({
      name: name.trim(),
      category,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      company: company.trim() || undefined,
      role: role.trim() || undefined,
      notes: notes.trim() || undefined,
      tags,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.editModalOverlay}>
        <View style={styles.editModalContent}>
          <View style={styles.editModalHeader}>
            <Text style={styles.editModalTitle}>Edit Contact</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={Colors.dark.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.editModalScroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.modalLabel}>Name *</Text>
            <View style={styles.editInputGroup}>
              <View style={styles.editInputIcon}>
                <User size={18} color={Colors.dark.textSecondary} />
              </View>
              <TextInput
                style={styles.editInput}
                placeholder="Name"
                placeholderTextColor={Colors.dark.textTertiary}
                value={name}
                onChangeText={setName}
              />
            </View>

            <Text style={styles.modalLabel}>Category</Text>
            <View style={styles.categoryEditSelector}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryEditOption,
                    category === cat && { backgroundColor: getCategoryColor(cat) + '20' },
                  ]}
                  onPress={() => setCategory(cat)}
                >
                  <Text
                    style={[
                      styles.categoryEditText,
                      category === cat && { color: getCategoryColor(cat) },
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>Phone</Text>
            <View style={styles.editInputGroup}>
              <View style={styles.editInputIcon}>
                <Phone size={18} color={Colors.dark.textSecondary} />
              </View>
              <TextInput
                style={styles.editInput}
                placeholder="Phone number"
                placeholderTextColor={Colors.dark.textTertiary}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>

            <Text style={styles.modalLabel}>Email</Text>
            <View style={styles.editInputGroup}>
              <View style={styles.editInputIcon}>
                <Mail size={18} color={Colors.dark.textSecondary} />
              </View>
              <TextInput
                style={styles.editInput}
                placeholder="Email address"
                placeholderTextColor={Colors.dark.textTertiary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <Text style={styles.modalLabel}>Company</Text>
            <View style={styles.editInputGroup}>
              <View style={styles.editInputIcon}>
                <Building2 size={18} color={Colors.dark.textSecondary} />
              </View>
              <TextInput
                style={styles.editInput}
                placeholder="Company"
                placeholderTextColor={Colors.dark.textTertiary}
                value={company}
                onChangeText={setCompany}
              />
            </View>

            <Text style={styles.modalLabel}>Role</Text>
            <View style={styles.editInputGroup}>
              <View style={styles.editInputIcon}>
                <Briefcase size={18} color={Colors.dark.textSecondary} />
              </View>
              <TextInput
                style={styles.editInput}
                placeholder="Role / Title"
                placeholderTextColor={Colors.dark.textTertiary}
                value={role}
                onChangeText={setRole}
              />
            </View>

            <Text style={styles.modalLabel}>Tags</Text>
            <View style={styles.editInputGroup}>
              <View style={styles.editInputIcon}>
                <Tag size={18} color={Colors.dark.textSecondary} />
              </View>
              <TextInput
                style={styles.editInput}
                placeholder="Add tag"
                placeholderTextColor={Colors.dark.textTertiary}
                value={tagInput}
                onChangeText={setTagInput}
                onSubmitEditing={handleAddTag}
                returnKeyType="done"
              />
              <TouchableOpacity style={styles.addTagInlineBtn} onPress={handleAddTag}>
                <Plus size={18} color={Colors.dark.accent} />
              </TouchableOpacity>
            </View>
            {tags.length > 0 && (
              <View style={styles.editTagsList}>
                {tags.map((tag) => (
                  <View key={tag} style={styles.editTag}>
                    <Text style={styles.editTagText}>#{tag}</Text>
                    <TouchableOpacity onPress={() => handleRemoveTag(tag)}>
                      <X size={14} color={Colors.dark.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <Text style={styles.modalLabel}>Notes</Text>
            <View style={styles.editInputGroupMulti}>
              <View style={[styles.editInputIcon, { alignSelf: 'flex-start', marginTop: 14 }]}>
                <FileText size={18} color={Colors.dark.textSecondary} />
              </View>
              <TextInput
                style={styles.editInputMulti}
                placeholder="Notes about this contact..."
                placeholderTextColor={Colors.dark.textTertiary}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </ScrollView>

          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleSubmit}>
              <Text style={styles.modalSubmitText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    flex: 1,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  avatarSection: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: Colors.dark.accent,
  },
  scoreRing: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    backgroundColor: Colors.dark.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.dark.text,
  },
  contactName: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.dark.text,
    marginBottom: 8,
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600' as const,
    textTransform: 'capitalize',
  },
  lastInteraction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  lastInteractionText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  quickActionBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  tagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.dark.backgroundTertiary,
  },
  tagText: {
    fontSize: 12,
    color: Colors.dark.textTertiary,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: Colors.dark.accentGlow,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.dark.textSecondary,
  },
  tabTextActive: {
    color: Colors.dark.accent,
  },
  tabContent: {
    padding: 16,
  },
  attentionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    margin: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 179, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 179, 0, 0.3)',
  },
  attentionText: {
    flex: 1,
    fontSize: 13,
    color: Colors.dark.warning,
    fontWeight: '500' as const,
  },
  contactInfo: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    overflow: 'hidden',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  contactIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  contactDetail: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 11,
    color: Colors.dark.textTertiary,
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 14,
    color: Colors.dark.text,
    fontWeight: '500' as const,
  },
  notesSection: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  notesLabel: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginBottom: 6,
  },
  notesText: {
    fontSize: 14,
    color: Colors.dark.text,
    lineHeight: 20,
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    marginBottom: 12,
  },
  meetingCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 10,
  },
  meetingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  meetingTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  meetingDate: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginBottom: 4,
  },
  meetingLocation: {
    fontSize: 12,
    color: Colors.dark.textTertiary,
    marginBottom: 4,
  },
  meetingAgenda: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    lineHeight: 18,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  followUpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 10,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  followUpContent: {
    flex: 1,
  },
  followUpTitle: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.dark.text,
  },
  followUpDue: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  overdue: {
    color: Colors.dark.error,
  },
  completeBtn: {
    padding: 8,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 8,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.dark.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  activityContent: {
    flex: 1,
  },
  activityType: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.dark.text,
    textTransform: 'capitalize',
  },
  activityNotes: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  activityDate: {
    fontSize: 11,
    color: Colors.dark.textTertiary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.dark.accentGlow,
    borderWidth: 1,
    borderColor: Colors.dark.accent + '30',
    marginBottom: 16,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  interactionCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 10,
  },
  interactionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  interactionTypeIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.dark.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  interactionMeta: {
    flex: 1,
  },
  interactionType: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    textTransform: 'capitalize',
  },
  interactionDate: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.dark.backgroundTertiary,
  },
  durationText: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
  },
  interactionNotes: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginTop: 10,
    lineHeight: 18,
  },
  outcomeBadge: {
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 230, 118, 0.1)',
    alignSelf: 'flex-start',
  },
  outcomeText: {
    fontSize: 12,
    color: Colors.dark.success,
    fontWeight: '500' as const,
  },
  meetingCardFull: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 10,
  },
  completedMeeting: {
    opacity: 0.6,
  },
  meetingCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  meetingStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  meetingStatusText: {
    fontSize: 11,
    fontWeight: '600' as const,
    textTransform: 'capitalize',
  },
  completeMeetingBtn: {
    padding: 4,
  },
  meetingCardTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    marginBottom: 8,
  },
  meetingCardDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  meetingCardDateText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  meetingCardLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  meetingCardLocationText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  meetingCardAgenda: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    lineHeight: 18,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  followUpCardFull: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 10,
  },
  completedFollowUp: {
    opacity: 0.6,
  },
  followUpCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '600' as const,
    textTransform: 'capitalize',
  },
  completeFollowUpBtn: {
    padding: 4,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  completedText: {
    fontSize: 12,
    color: Colors.dark.success,
    fontWeight: '500' as const,
  },
  followUpCardTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    marginBottom: 8,
  },
  completedTitle: {
    textDecorationLine: 'line-through',
    color: Colors.dark.textTertiary,
  },
  followUpCardDue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  followUpCardDueText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  overdueText: {
    color: Colors.dark.error,
  },
  followUpCardNotes: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    lineHeight: 18,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.dark.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.dark.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.dark.textSecondary,
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: Colors.dark.backgroundTertiary,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: Colors.dark.text,
    marginBottom: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalInputSingle: {
    backgroundColor: Colors.dark.backgroundTertiary,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: Colors.dark.text,
    marginBottom: 16,
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.dark.backgroundTertiary,
  },
  typeOptionActive: {
    backgroundColor: Colors.dark.accentGlow,
    borderWidth: 1,
    borderColor: Colors.dark.accent,
  },
  typeOptionText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  typeOptionTextActive: {
    color: Colors.dark.accent,
    fontWeight: '500' as const,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  prioritySelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  priorityOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.dark.backgroundTertiary,
    alignItems: 'center',
  },
  priorityOptionText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.dark.textSecondary,
    textTransform: 'capitalize',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.dark.backgroundTertiary,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.dark.textSecondary,
  },
  modalSubmitBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.dark.accent,
    alignItems: 'center',
  },
  modalSubmitText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.dark.backgroundTertiary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  dateTimeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateTimeButtonText: {
    fontSize: 15,
    color: Colors.dark.textTertiary,
  },
  dateTimeButtonTextSelected: {
    color: Colors.dark.text,
  },
  incomeToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: Colors.dark.backgroundTertiary,
    marginBottom: 16,
  },
  incomeToggleText: {
    flex: 1,
    fontSize: 14,
    color: Colors.dark.textSecondary,
    fontWeight: '500' as const,
  },
  incomeFieldsContainer: {
    backgroundColor: Colors.dark.backgroundTertiary,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  incomeTypeScroll: {
    marginBottom: 12,
  },
  incomeTypeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  incomeTypeOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  incomeTypeOptionActive: {
    backgroundColor: Colors.dark.accentGlow,
    borderColor: Colors.dark.accent,
  },
  incomeTypeText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.dark.textSecondary,
  },
  incomeTypeTextActive: {
    color: Colors.dark.accent,
  },
  incomeStatusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  incomeStatusOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  incomeStatusText: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: Colors.dark.textSecondary,
  },
  editModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  editModalContent: {
    backgroundColor: Colors.dark.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  editModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  editModalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.dark.text,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.dark.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editModalScroll: {
    padding: 20,
  },
  editInputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.backgroundTertiary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 16,
  },
  editInputGroupMulti: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.backgroundTertiary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 16,
  },
  editInputIcon: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editInput: {
    flex: 1,
    paddingVertical: 14,
    paddingRight: 14,
    fontSize: 15,
    color: Colors.dark.text,
  },
  editInputMulti: {
    flex: 1,
    padding: 14,
    paddingLeft: 0,
    fontSize: 15,
    color: Colors.dark.text,
    minHeight: 100,
  },
  addTagInlineBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryEditSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  categoryEditOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.dark.backgroundTertiary,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  categoryEditText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.dark.textSecondary,
    textTransform: 'capitalize',
  },
  editTagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  editTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.dark.backgroundTertiary,
  },
  editTagText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
});
