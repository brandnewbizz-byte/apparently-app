import React, { useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { localDateKey } from '@/lib/dates';
import { summarizePlan, formatDuration } from '@/components/planner/planSummary';
import { formatMinutes } from '@/lib/dates';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  Calendar,
  MapPin,
  Car,
  CreditCard,
  Trash2,
  Users,
  Package,
  Truck,
  HelpCircle,
  CheckCircle,
  XCircle,
  AlertCircle,
  Repeat,
} from 'lucide-react-native';

import { useTheme } from '@/contexts/ThemeContext';
import { usePlanner } from '@/contexts/PlannerContext';

const formatDate = (date: Date): string => localDateKey(date);

const getDateLabel = (dateStr: string): string => {
  const date = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  if (dateStr === formatDate(today)) return 'Today';
  if (dateStr === formatDate(tomorrow)) return 'Tomorrow';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
};

const formatTime = (time: string): string => {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
};

export default function PlanDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const { colors } = useTheme();
  const { getPlanById, deletePlan, setPlanStatus } = usePlanner();
  const [isDeleting, setIsDeleting] = useState(false);

  const plan = useMemo(() => getPlanById(planId || ''), [getPlanById, planId]);

  const planDetails = plan?.plan;

  const locationLabels: Record<string, string> = {
    home: 'Home',
    hotel: 'Hotel',
    airbnb: 'Airbnb',
    coffee: 'Coffee Shop',
    coworking: 'Co-working Space',
  };

  const transportLabels: Record<string, string> = {
    none: 'No transportation needed',
    chauffeur: 'Chauffeur Service',
  };

  const paymentLabels: Record<string, string> = {
    cash: 'Cash',
    crypto: 'Cryptocurrency',
    card: 'Credit/Debit Card',
    swap: 'Skill Swap',
  };

  const assistanceLabels: Record<string, string> = {
    va: 'Virtual Assistant',
    delivery: 'Delivery Service',
    errands: 'Errands Runner',
    other: 'Other Assistance',
  };

  const getAssistanceIcon = (type: string) => {
    switch (type) {
      case 'va': return Users;
      case 'delivery': return Package;
      case 'errands': return Truck;
      default: return HelpCircle;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return CheckCircle;
      case 'completed': return CheckCircle;
      case 'cancelled': return XCircle;
      default: return AlertCircle;
    }
  };

  const handleDelete = useCallback(async () => {
    const doDelete = async () => {
      setIsDeleting(true);
      try {
        await deletePlan(planId || '');
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        router.back();
      } catch (e) {
        console.error('[PlanDetail] Delete error:', e);
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      } finally {
        setIsDeleting(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to delete this plan?')) {
        doDelete();
      }
    } else {
      Alert.alert(
        'Delete Plan',
        'Are you sure you want to delete this plan? This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: doDelete },
        ]
      );
    }
  }, [deletePlan, planId, router]);

  if (!plan) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: 'Plan Details' }} />
        <View style={styles.notFound}>
          <AlertCircle size={48} color={colors.textTertiary} />
          <Text style={[styles.notFoundText, { color: colors.text }]}>Plan not found</Text>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.accent }]}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const StatusIcon = getStatusIcon(plan.status);
  const summary = summarizePlan(plan);
  const isBlock = summary.kind === 'block' || summary.kind === 'job' || summary.kind === 'quick';
  const vaSkills: string[] = Array.isArray((planDetails?.va_details as any)?.skills) ? (planDetails!.va_details as any).skills : Array.isArray((planDetails?.va_details as any)?.tools) ? (planDetails!.va_details as any).tools : [];
  const vaTasks = (planDetails?.va_details as any)?.tasks;
  const changeStatus = async (status: 'pending' | 'completed' | 'cancelled') => {
    const ok = await setPlanStatus(plan.id, status);
    if (ok) { if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
    else Alert.alert('Not updated', 'Check your connection and try again.');
  };
  const locationType = planDetails?.location_type || plan.location_type || 'home';
  const transport = planDetails?.transport || plan.transport || 'none';
  const assistance = planDetails?.assistance || [];
  const payment = planDetails?.payment || 'cash';
  const chauffeur = planDetails?.chauffeur;
  const vaDetails = planDetails?.va_details;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: 'Plan Details',
          headerRight: () => (
            <TouchableOpacity
              onPress={handleDelete}
              disabled={isDeleting}
              style={styles.headerDelete}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <Trash2 size={20} color="#EF4444" />
              )}
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[summary.color, summary.color + 'B3']}
          style={styles.headerCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.headerTop}>
            <View style={styles.headerDate}>
              <Calendar size={20} color="#FFF" />
              <Text style={styles.headerDateText}>{getDateLabel(plan.date)}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <StatusIcon size={14} color="#FFF" />
              <Text style={styles.statusText}>{plan.status}</Text>
            </View>
          </View>
          <Text style={styles.headerTitle}>{summary.title}</Text>
          {summary.startMins !== null ? (
            <Text style={styles.headerSub}>
              {formatMinutes(summary.startMins)}{summary.durationMins ? ` – ${formatMinutes(summary.startMins + summary.durationMins)} · ${formatDuration(summary.durationMins)}` : ''}
            </Text>
          ) : null}
          <Text style={styles.headerSub}>
            Created {new Date(plan.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </Text>
        </LinearGradient>

        <View style={styles.statusActions}>
          {plan.status !== 'completed' ? (
            <TouchableOpacity style={[styles.statusAction, { backgroundColor: '#10B981' }]} onPress={() => changeStatus('completed')}>
              <CheckCircle size={18} color="#FFF" />
              <Text style={styles.statusActionText}>Mark done</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.statusAction, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]} onPress={() => changeStatus('pending')}>
              <AlertCircle size={18} color={colors.text} />
              <Text style={[styles.statusActionText, { color: colors.text }]}>Not done yet</Text>
            </TouchableOpacity>
          )}
          {plan.status !== 'cancelled' ? (
            <TouchableOpacity style={[styles.statusAction, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]} onPress={() => changeStatus('cancelled')}>
              <XCircle size={18} color="#EF4444" />
              <Text style={[styles.statusActionText, { color: '#EF4444' }]}>Cancel</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {isBlock ? (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Calendar size={20} color={summary.color} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{summary.label}</Text>
            </View>
            <View style={styles.detailsBox}>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>When</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {getDateLabel(plan.date)}{summary.startMins !== null ? ` · ${formatMinutes(summary.startMins)}` : ''}
                </Text>
              </View>
              {summary.durationMins ? (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Length</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{formatDuration(summary.durationMins)}</Text>
                </View>
              ) : null}
              {summary.subtitle ? (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Details</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{summary.subtitle}</Text>
                </View>
              ) : null}
              {planDetails?.notes ? (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Notes</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{planDetails.notes}</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {!isBlock ? (<>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <MapPin size={20} color={colors.accent} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Location</Text>
          </View>
          <Text style={[styles.sectionValue, { color: colors.text }]}>
            {locationLabels[locationType] || locationType}
          </Text>
          {plan.custom_location && (
            <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
              {plan.custom_location}
            </Text>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Car size={20} color={colors.accent} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Transportation</Text>
          </View>
          <Text style={[styles.sectionValue, { color: colors.text }]}>
            {transportLabels[transport] || transport}
          </Text>

          {chauffeur && transport === 'chauffeur' && (
            <View style={styles.detailsBox}>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Pickup</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {chauffeur.pickupAddress} {chauffeur.pickupZip}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Dropoff</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {chauffeur.dropoffAddress} {chauffeur.dropoffZip}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Time</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {formatTime(chauffeur.pickupTime)}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Trip Type</Text>
                <View style={styles.detailValueRow}>
                  <Repeat size={14} color={chauffeur.roundTrip ? colors.accent : colors.textTertiary} />
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {chauffeur.roundTrip ? 'Round Trip' : 'One Way'}
                  </Text>
                </View>
              </View>
              {chauffeur.notes && (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Notes</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{chauffeur.notes}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {assistance.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Users size={20} color={colors.accent} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Assistance</Text>
            </View>
            <View style={styles.assistanceList}>
              {assistance.map((type, idx) => {
                const Icon = getAssistanceIcon(type);
                return (
                  <View key={idx} style={[styles.assistanceItem, { backgroundColor: colors.accent + '10' }]}>
                    <Icon size={16} color={colors.accent} />
                    <Text style={[styles.assistanceText, { color: colors.text }]}>
                      {assistanceLabels[type] || type}
                    </Text>
                  </View>
                );
              })}
            </View>

            {vaDetails && assistance.includes('va') && (
              <View style={styles.detailsBox}>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Hours</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {vaDetails.hours || '—'} hour{Number(vaDetails.hours) === 1 ? '' : 's'}
                  </Text>
                </View>
                {vaSkills.length > 0 && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Skills</Text>
                    <View style={styles.skillsRow}>
                      {vaSkills.map((skill, idx) => (
                        <View key={idx} style={[styles.skillChip, { backgroundColor: colors.accent + '15' }]}>
                          <Text style={[styles.skillChipText, { color: colors.accent }]}>{skill}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
                {vaTasks && (Array.isArray(vaTasks) ? vaTasks.length > 0 : true) && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Tasks</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>{Array.isArray(vaTasks) ? vaTasks.join(', ') : String(vaTasks)}</Text>
                  </View>
                )}
                {vaDetails.budget && (
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Budget</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>{vaDetails.budget}</Text>
                  </View>
                )}
                {vaDetails.deadline ? (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Deadline</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {/^\d{4}-\d{2}-\d{2}$/.test(vaDetails.deadline) ? getDateLabel(vaDetails.deadline) : vaDetails.deadline}
                  </Text>
                </View>
                ) : null}
              </View>
            )}
          </View>
        )}

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <CreditCard size={20} color={colors.accent} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Payment Method</Text>
          </View>
          <Text style={[styles.sectionValue, { color: colors.text }]}>
            {paymentLabels[payment] || payment}
          </Text>
        </View>

        </>) : null}

        {!isBlock && (assistance.length > 0 || transport === 'chauffeur') ? (
        <View style={[styles.infoCard, { backgroundColor: colors.accent + '10', borderColor: colors.accent + '30' }]}>
          <AlertCircle size={18} color={colors.accent} />
          <Text style={[styles.infoText, { color: colors.text }]}>
            Service requests from this plan have been posted for providers to accept.
          </Text>
        </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statusActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statusAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 14,
  },
  statusActionText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700' as const,
  },
  headerDelete: {
    padding: 8,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  notFoundText: {
    fontSize: 18,
    fontWeight: '600' as const,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600' as const,
  },
  headerCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerDateText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500' as const,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  statusText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600' as const,
    textTransform: 'capitalize',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  headerSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
  },
  section: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  sectionValue: {
    fontSize: 17,
    fontWeight: '500' as const,
  },
  sectionSub: {
    fontSize: 14,
    marginTop: 4,
  },
  detailsBox: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    gap: 12,
  },
  detailRow: {
    gap: 4,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  detailValue: {
    fontSize: 15,
  },
  detailValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  assistanceList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  assistanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 8,
  },
  assistanceText: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  skillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  skillChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  skillChipText: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
