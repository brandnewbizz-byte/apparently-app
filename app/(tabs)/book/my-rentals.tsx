import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Platform,
  RefreshControl,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Home,
  Car,
  Ship,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Trash2,
  ChevronRight,
  Plus,
  DollarSign,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/contexts/ThemeContext';
import { useBookings, type RentalSubmission, type RentalSubmissionStatus, type ListingCategory } from '@/contexts/BookingsContext';
import CreateRentalModal from '@/components/CreateRentalModal';

type FilterTab = 'all' | RentalSubmissionStatus;

export default function MyRentalsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { getMyRentalSubmissions, deleteRentalSubmission, refreshMyListings } = useBookings();

  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [showCreateRental, setShowCreateRental] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const submissions = getMyRentalSubmissions();

  const filteredSubmissions = useMemo(() => {
    if (activeFilter === 'all') return submissions;
    return submissions.filter(s => s.submissionStatus === activeFilter);
  }, [submissions, activeFilter]);

  const stats = useMemo(() => {
    return {
      total: submissions.length,
      pending: submissions.filter(s => s.submissionStatus === 'pending').length,
      approved: submissions.filter(s => s.submissionStatus === 'approved').length,
      rejected: submissions.filter(s => s.submissionStatus === 'rejected').length,
    };
  }, [submissions]);

  const onPressHaptic = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleDelete = useCallback((submission: RentalSubmission) => {
    onPressHaptic();
    Alert.alert(
      'Delete Submission',
      `Are you sure you want to delete "${submission.title}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteRentalSubmission(submission.id);
            if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  }, [onPressHaptic, deleteRentalSubmission]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refreshMyListings();
    setTimeout(() => setRefreshing(false), 1500);
  }, [refreshMyListings]);

  const getCategoryIcon = (category: ListingCategory) => {
    switch (category) {
      case 'stay': return Home;
      case 'car': return Car;
      case 'boat': return Ship;
      default: return Home;
    }
  };

  const getCategoryLabel = (category: ListingCategory) => {
    switch (category) {
      case 'stay': return 'Property';
      case 'car': return 'Vehicle';
      case 'boat': return 'Boat';
      default: return 'Rental';
    }
  };

  const getStatusConfig = (status: RentalSubmissionStatus) => {
    switch (status) {
      case 'pending':
        return { label: 'Pending Review', color: '#F59E0B', icon: Clock, bgColor: 'rgba(245,158,11,0.1)' };
      case 'approved':
        return { label: 'Approved', color: '#10B981', icon: CheckCircle, bgColor: 'rgba(16,185,129,0.1)' };
      case 'rejected':
        return { label: 'Rejected', color: '#EF4444', icon: XCircle, bgColor: 'rgba(239,68,68,0.1)' };
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const chipBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'My Listings',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          headerRight: () => (
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: colors.accent }]}
              onPress={() => {
                onPressHaptic();
                setShowCreateRental(true);
              }}
            >
              <Plus size={20} color="#fff" />
            </TouchableOpacity>
          ),
        }}
      />

      <View style={[styles.statsRow, { borderBottomColor: colors.border }]}>
        {[
          { key: 'all' as const, label: 'All', count: stats.total },
          { key: 'pending' as const, label: 'Pending', count: stats.pending, color: '#F59E0B' },
          { key: 'approved' as const, label: 'Approved', count: stats.approved, color: '#10B981' },
          { key: 'rejected' as const, label: 'Rejected', count: stats.rejected, color: '#EF4444' },
        ].map((tab) => {
          const isActive = activeFilter === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.statTab,
                isActive && { backgroundColor: tab.color ? `${tab.color}20` : colors.accent + '20' },
              ]}
              onPress={() => {
                onPressHaptic();
                setActiveFilter(tab.key);
              }}
            >
              <Text
                style={[
                  styles.statCount,
                  { color: isActive ? (tab.color || colors.accent) : colors.text },
                ]}
              >
                {tab.count}
              </Text>
              <Text
                style={[
                  styles.statLabel,
                  { color: isActive ? (tab.color || colors.accent) : colors.textSecondary },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        {filteredSubmissions.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
            <AlertCircle size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {activeFilter === 'all' ? 'No Listings Yet' : `No ${activeFilter} listings`}
            </Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {activeFilter === 'all'
                ? 'Submit your first car, home, or boat for rental'
                : `You don't have any ${activeFilter} listings`}
            </Text>
            {activeFilter === 'all' && (
              <TouchableOpacity
                style={[styles.emptyButton, { backgroundColor: colors.accent }]}
                onPress={() => {
                  onPressHaptic();
                  setShowCreateRental(true);
                }}
              >
                <Plus size={18} color="#fff" />
                <Text style={styles.emptyButtonText}>Add Listing</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredSubmissions.map((submission) => {
            const CategoryIcon = getCategoryIcon(submission.category);
            const statusConfig = getStatusConfig(submission.submissionStatus);
            const StatusIcon = statusConfig.icon;

            return (
              <View
                key={submission.id}
                style={[styles.submissionCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
                    <StatusIcon size={14} color={statusConfig.color} />
                    <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.deleteButton, { backgroundColor: 'rgba(239,68,68,0.1)' }]}
                    onPress={() => handleDelete(submission)}
                  >
                    <Trash2 size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>

                <View style={styles.cardBody}>
                  {submission.images.length > 0 ? (
                    <Image source={{ uri: submission.images[0] }} style={styles.cardImage} />
                  ) : (
                    <View style={[styles.cardImagePlaceholder, { backgroundColor: colors.border }]}>
                      <CategoryIcon size={24} color={colors.textTertiary} />
                    </View>
                  )}

                  <View style={styles.cardInfo}>
                    <View style={[styles.categoryChip, { backgroundColor: chipBg }]}>
                      <CategoryIcon size={12} color={colors.textSecondary} />
                      <Text style={[styles.categoryChipText, { color: colors.textSecondary }]}>
                        {getCategoryLabel(submission.category)}
                      </Text>
                    </View>

                    <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
                      {submission.title}
                    </Text>

                    <View style={styles.cardMeta}>
                      <MapPin size={12} color={colors.textSecondary} />
                      <Text style={[styles.cardMetaText, { color: colors.textSecondary }]} numberOfLines={1}>
                        {submission.location}
                      </Text>
                    </View>

                    <View style={styles.cardFooter}>
                      <View style={styles.priceRow}>
                        <DollarSign size={14} color={colors.accent} />
                        <Text style={[styles.cardPrice, { color: colors.accent }]}>
                          {submission.pricePerDay}
                        </Text>
                        <Text style={[styles.cardPriceUnit, { color: colors.textSecondary }]}>/day</Text>
                      </View>
                      <Text style={[styles.cardDate, { color: colors.textTertiary }]}>
                        Submitted {formatDate(submission.submittedAt)}
                      </Text>
                    </View>
                  </View>
                </View>

                {submission.submissionStatus === 'rejected' && submission.rejectionReason && (
                  <View style={[styles.rejectionReason, { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: '#EF4444' }]}>
                    <XCircle size={16} color="#EF4444" />
                    <Text style={[styles.rejectionText, { color: '#EF4444' }]}>
                      {submission.rejectionReason}
                    </Text>
                  </View>
                )}

                {submission.submissionStatus === 'pending' && (
                  <View style={[styles.pendingNote, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
                    <Clock size={14} color="#F59E0B" />
                    <Text style={[styles.pendingNoteText, { color: colors.textSecondary }]}>
                      Your listing is being reviewed by our moderators. This usually takes 24-48 hours.
                    </Text>
                  </View>
                )}

                {submission.submissionStatus === 'approved' && (
                  <View style={[styles.approvedNote, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
                    <CheckCircle size={14} color="#10B981" />
                    <Text style={[styles.approvedNoteText, { color: colors.textSecondary }]}>
                      Your listing is now live and visible to other users.
                    </Text>
                  </View>
                )}
              </View>
            );
          })
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <CreateRentalModal
        visible={showCreateRental}
        onClose={() => setShowCreateRental(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  statTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
  },
  statCount: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  emptyState: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600' as const,
  },
  submissionCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
  },
  cardImage: {
    width: 90,
    height: 90,
    borderRadius: 12,
  },
  cardImagePlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 4,
  },
  categoryChipText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    lineHeight: 20,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  cardMetaText: {
    fontSize: 12,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardPrice: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  cardPriceUnit: {
    fontSize: 12,
    marginLeft: 2,
  },
  cardDate: {
    fontSize: 11,
  },
  rejectionReason: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  rejectionText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  pendingNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 10,
  },
  pendingNoteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  approvedNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 10,
  },
  approvedNoteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
