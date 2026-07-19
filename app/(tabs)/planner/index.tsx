import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Wand2,
  MapPin,
  Car,
  CreditCard,
  Clock,
  Trash2,
  Users,
  Package,
  Truck,
  HelpCircle,
  Briefcase,
  LayoutGrid,
  Coffee,
  Dumbbell,
  Book,
  Heart,
  Zap,
  Star,
  ShoppingCart,
  Phone,
} from 'lucide-react-native';

import { useTheme } from '@/contexts/ThemeContext';
import { usePlanner, type Plan } from '@/contexts/PlannerContext';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const formatDate = (date: Date): string => date.toISOString().split('T')[0];

const getDateLabel = (dateStr: string): string => {
  const date = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  if (dateStr === formatDate(today)) return 'Today';
  if (dateStr === formatDate(tomorrow)) return 'Tomorrow';
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const formatTime12 = (time: string): string => {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
};

const getMonthDays = (year: number, month: number): (Date | null)[] => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  
  const days: (Date | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
  
  const remaining = 7 - (days.length % 7);
  if (remaining < 7) {
    for (let i = 0; i < remaining; i++) days.push(null);
  }
  
  return days;
};

interface CalendarProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  datesWithPlans: Set<string>;
  colors: any;
}

function MonthCalendar({ selectedDate, onSelectDate, datesWithPlans, colors }: CalendarProps) {
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date(selectedDate + 'T12:00:00');
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const monthDays = useMemo(
    () => getMonthDays(viewDate.year, viewDate.month),
    [viewDate.year, viewDate.month]
  );

  const todayStr = formatDate(new Date());
  const monthName = new Date(viewDate.year, viewDate.month).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const goToPrev = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    setViewDate(prev => prev.month === 0 
      ? { year: prev.year - 1, month: 11 } 
      : { year: prev.year, month: prev.month - 1 }
    );
  };

  const goToNext = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    setViewDate(prev => prev.month === 11 
      ? { year: prev.year + 1, month: 0 } 
      : { year: prev.year, month: prev.month + 1 }
    );
  };

  const goToToday = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const today = new Date();
    setViewDate({ year: today.getFullYear(), month: today.getMonth() });
    onSelectDate(formatDate(today));
  };

  const rows: (Date | null)[][] = [];
  for (let i = 0; i < monthDays.length; i += 7) {
    rows.push(monthDays.slice(i, i + 7));
  }

  return (
    <View style={[styles.calendar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.calendarHeader}>
        <TouchableOpacity onPress={goToPrev} style={styles.navBtn}>
          <ChevronLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={goToToday}>
          <Text style={[styles.monthTitle, { color: colors.text }]}>{monthName}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={goToNext} style={styles.navBtn}>
          <ChevronRight size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAYS.map(day => (
          <View key={day} style={styles.weekdayCell}>
            <Text style={[styles.weekdayText, { color: colors.textTertiary }]}>{day}</Text>
          </View>
        ))}
      </View>

      {rows.map((row, rowIdx) => (
        <View key={rowIdx} style={styles.calendarRow}>
          {row.map((date, cellIdx) => {
            if (!date) return <View key={`empty-${cellIdx}`} style={styles.dayCell} />;

            const dateStr = formatDate(date);
            const isSelected = dateStr === selectedDate;
            const isToday = dateStr === todayStr;
            const hasPlan = datesWithPlans.has(dateStr);

            return (
              <TouchableOpacity
                key={dateStr}
                style={[
                  styles.dayCell,
                  isSelected && [styles.dayCellSelected, { backgroundColor: colors.accent }],
                ]}
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.selectionAsync();
                  onSelectDate(dateStr);
                }}
              >
                <Text style={[
                  styles.dayText,
                  { color: colors.text },
                  isToday && !isSelected && { color: colors.accent, fontWeight: '700' as const },
                  isSelected && { color: '#FFF', fontWeight: '700' as const },
                ]}>
                  {date.getDate()}
                </Text>
                {hasPlan && (
                  <View style={[
                    styles.planDot,
                    { backgroundColor: isSelected ? '#FFF' : colors.accent },
                  ]} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

interface PlanCardProps {
  plan: Plan;
  onPress: () => void;
  onDelete: () => void;
  colors: any;
}

function PlanCard({ plan, onPress, onDelete, colors }: PlanCardProps) {
  const locationLabels: Record<string, string> = {
    home: 'Home',
    hotel: 'Hotel',
    airbnb: 'Airbnb',
    coffee: 'Coffee Shop',
    coworking: 'Co-working',
  };

  const transportLabels: Record<string, string> = {
    none: 'No transport',
    chauffeur: 'Chauffeur service',
  };

  const BLOCK_CATEGORY_ICONS: Record<string, any> = {
    work: Briefcase,
    personal: Heart,
    health: Dumbbell,
    learning: Book,
    social: Users,
    errands: ShoppingCart,
    calls: Phone,
    focus: Zap,
    break: Coffee,
    other: Star,
  };

  const planDetails = plan.plan;
  const locationType = planDetails?.location_type || plan.location_type || 'home';
  const transport = planDetails?.transport || plan.transport || 'none';
  const assistance = planDetails?.assistance || [];
  const payment = planDetails?.payment || 'cash';
  const customBlock = planDetails?.custom_block;
  const importedJob = planDetails?.imported_job;

  const getAssistanceIcon = (type: string) => {
    switch (type) {
      case 'va': return Users;
      case 'delivery': return Package;
      case 'errands': return Truck;
      default: return HelpCircle;
    }
  };

  const assistanceLabels: Record<string, string> = {
    va: 'Virtual Assistant',
    delivery: 'Delivery',
    errands: 'Errands',
    other: 'Other',
  };

  const handleDelete = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Delete this plan?')) {
        onDelete();
      }
    } else {
      Alert.alert(
        'Delete Plan',
        'Are you sure you want to delete this plan?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: onDelete },
        ]
      );
    }
  };

  const accentColor = customBlock?.category_color || (importedJob ? '#10B981' : colors.accent);
  const BlockIcon = customBlock ? BLOCK_CATEGORY_ICONS[customBlock.category] || Star : null;

  return (
    <TouchableOpacity
      style={[styles.planCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.planAccent, { backgroundColor: accentColor }]} />
      <View style={styles.planContent}>
        <View style={styles.planHeader}>
          <View style={[styles.planBadge, { backgroundColor: accentColor + '15' }]}>
            {customBlock && BlockIcon ? (
              <BlockIcon size={14} color={accentColor} />
            ) : importedJob ? (
              <Briefcase size={14} color={accentColor} />
            ) : (
              <Calendar size={14} color={accentColor} />
            )}
            <Text style={[styles.planBadgeText, { color: accentColor }]}>
              {customBlock ? customBlock.category_label : importedJob ? 'Accepted Job' : getDateLabel(plan.date)}
            </Text>
          </View>
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              handleDelete();
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Trash2 size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.planTitle, { color: colors.text }]}>
          {plan.date_label || `Plan for ${getDateLabel(plan.date)}`}
        </Text>

        {customBlock && (
          <View style={styles.planMeta}>
            <View style={styles.planMetaRow}>
              <Clock size={14} color={colors.textSecondary} />
              <Text style={[styles.planMetaText, { color: colors.textSecondary }]}>
                {customBlock.start_time ? formatTime12(customBlock.start_time) : ''} • {customBlock.duration_minutes}min
              </Text>
            </View>
            {customBlock.location && (
              <View style={styles.planMetaRow}>
                <MapPin size={14} color={colors.textSecondary} />
                <Text style={[styles.planMetaText, { color: colors.textSecondary }]}>
                  {customBlock.location}
                </Text>
              </View>
            )}
            {customBlock.description && (
              <Text style={[styles.planMetaText, { color: colors.textTertiary, marginTop: 4 }]} numberOfLines={2}>
                {customBlock.description}
              </Text>
            )}
          </View>
        )}

        {importedJob && (
          <View style={styles.planMeta}>
            <View style={styles.planMetaRow}>
              <Briefcase size={14} color={colors.textSecondary} />
              <Text style={[styles.planMetaText, { color: colors.textSecondary }]}>
                {importedJob.title || `${importedJob.type} job`}
              </Text>
            </View>
            {importedJob.pickup_location && (
              <View style={styles.planMetaRow}>
                <MapPin size={14} color={colors.textSecondary} />
                <Text style={[styles.planMetaText, { color: colors.textSecondary }]} numberOfLines={1}>
                  {importedJob.pickup_location}
                </Text>
              </View>
            )}
            {importedJob.pickup_time && (
              <View style={styles.planMetaRow}>
                <Clock size={14} color={colors.textSecondary} />
                <Text style={[styles.planMetaText, { color: colors.textSecondary }]}>
                  {importedJob.pickup_time}
                </Text>
              </View>
            )}
          </View>
        )}

        {!customBlock && !importedJob && <View style={styles.planMeta}>
          <View style={styles.planMetaRow}>
            <MapPin size={14} color={colors.textSecondary} />
            <Text style={[styles.planMetaText, { color: colors.textSecondary }]}>
              {locationLabels[locationType] || locationType}
            </Text>
          </View>

          {transport !== 'none' && (
            <View style={styles.planMetaRow}>
              <Car size={14} color={colors.textSecondary} />
              <Text style={[styles.planMetaText, { color: colors.textSecondary }]}>
                {transportLabels[transport] || transport}
              </Text>
            </View>
          )}

          <View style={styles.planMetaRow}>
            <CreditCard size={14} color={colors.textSecondary} />
            <Text style={[styles.planMetaText, { color: colors.textSecondary, textTransform: 'capitalize' }]}>
              {payment}
            </Text>
          </View>
        </View>}

        {assistance && assistance.length > 0 && (
          <View style={styles.assistanceTags}>
            {assistance.map((item, idx) => {
              const Icon = getAssistanceIcon(item);
              return (
                <View key={idx} style={[styles.assistanceTag, { backgroundColor: '#7B61FF15' }]}>
                  <Icon size={12} color="#7B61FF" />
                  <Text style={[styles.assistanceTagText, { color: '#7B61FF' }]}>
                    {assistanceLabels[item] || item}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.planFooter}>
          <Clock size={12} color={colors.textTertiary} />
          <Text style={[styles.planTime, { color: colors.textTertiary }]}>
            {new Date(plan.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: plan.status === 'active' ? '#10B98115' : plan.status === 'completed' ? '#6B728015' : '#F59E0B15' }]}>
            <Text style={[styles.statusText, { color: plan.status === 'active' ? '#10B981' : plan.status === 'completed' ? '#6B7280' : '#F59E0B' }]}>
              {plan.status}
            </Text>
          </View>
        </View>
      </View>
      <ChevronRight size={20} color={colors.textTertiary} style={styles.planChevron} />
    </TouchableOpacity>
  );
}

export default function PlannerScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { plans, deletePlan, getPlansByDate, refetch } = usePlanner();

  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [refreshing, setRefreshing] = useState(false);

  const datesWithPlans = useMemo(() => {
    const dates = new Set<string>();
    plans.forEach(p => dates.add(p.date));
    return dates;
  }, [plans]);

  const datePlans = useMemo(() => getPlansByDate(selectedDate), [getPlansByDate, selectedDate]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    refetch();
    setTimeout(() => setRefreshing(false), 800);
  }, [refetch]);

  const handleDeletePlan = useCallback(async (id: string) => {
    try {
      await deletePlan(id);
      console.log('[Planner] Plan deleted:', id);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      console.error('[Planner] Delete failed:', e);
    }
  }, [deletePlan]);

  const totalPlansCount = plans.length;
  const upcomingPlans = plans.filter(p => new Date(p.date) >= new Date(formatDate(new Date()))).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: 'Planner',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/planner/plan-day' as any);
              }}
              style={[styles.headerBtn, { backgroundColor: colors.accent }]}
            >
              <Plus size={20} color="#FFF" />
            </TouchableOpacity>
          ),
        }}
      />

      <View style={styles.actionCards}>
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push('/planner/plan-day' as any);
          }}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={['#7B61FF', '#A78BFA']}
            style={styles.actionGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Wand2 size={20} color="#FFF" />
            <Text style={styles.actionText}>Plan Day</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push('/planner/add-block' as any);
          }}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={['#8B5CF6', '#7C3AED']}
            style={styles.actionGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <LayoutGrid size={20} color="#FFF" />
            <Text style={styles.actionText}>Add Block</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push('/planner/browse-jobs' as any);
          }}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={['#10B981', '#059669']}
            style={styles.actionGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Briefcase size={20} color="#FFF" />
            <Text style={styles.actionText}>Browse Jobs</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {totalPlansCount > 0 && (
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statNumber, { color: colors.accent }]}>{totalPlansCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Plans</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statNumber, { color: '#10B981' }]}>{upcomingPlans}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Upcoming</Text>
          </View>
        </View>
      )}

      <MonthCalendar
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        datesWithPlans={datesWithPlans}
        colors={colors}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        {datePlans.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.surface }]}>
              <Calendar size={40} color={colors.textTertiary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No plans for {getDateLabel(selectedDate)}</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Tap Plan Your Day to get started
            </Text>
          </View>
        ) : (
          <View style={styles.plansList}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {datePlans.length} plan{datePlans.length > 1 ? 's' : ''} for {getDateLabel(selectedDate)}
            </Text>
            {datePlans.map(plan => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onPress={() => router.push(`/planner/${plan.id}` as any)}
                onDelete={() => handleDeletePlan(plan.id)}
                colors={colors}
              />
            ))}
          </View>
        )}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCards: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 8,
    gap: 10,
  },
  actionCard: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  actionGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 6,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#FFF',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 12,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700' as const,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  calendar: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navBtn: {
    padding: 8,
  },
  monthTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  weekdayText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  calendarRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    minHeight: 40,
  },
  dayCellSelected: {
    borderRadius: 10,
    margin: 2,
  },
  dayText: {
    fontSize: 15,
    fontWeight: '500' as const,
  },
  planDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 3,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 100,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
  },
  plansList: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    marginBottom: 12,
  },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  planAccent: {
    width: 4,
    alignSelf: 'stretch',
  },
  planContent: {
    flex: 1,
    padding: 14,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 6,
  },
  planBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  planTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    marginBottom: 10,
  },
  planMeta: {
    gap: 6,
  },
  planMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planMetaText: {
    fontSize: 13,
  },
  assistanceTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  assistanceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  assistanceTagText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  planFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
  },
  planTime: {
    fontSize: 11,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600' as const,
    textTransform: 'capitalize',
  },
  planChevron: {
    marginRight: 12,
  },
  bottomSpacer: {
    height: 40,
  },
});
