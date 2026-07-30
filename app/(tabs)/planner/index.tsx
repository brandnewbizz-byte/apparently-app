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
  Modal,
  TextInput,
  Image,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
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
  X,
  Edit3,
  DollarSign,
  Tag,
  Search,
  ListFilter,
  MessageSquare,
  UserPlus,
  Camera,
} from 'lucide-react-native';

import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanner, type Plan } from '@/contexts/PlannerContext';
import { useServiceRequests, SERVICE_CATEGORIES, type ServiceCategory, type ServiceRequest, type RequestStatus } from '@/contexts/ServiceRequestContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

const REQUEST_STATUS_COLORS: Record<RequestStatus, string> = {
  open: '#10B981',
  in_progress: '#F59E0B',
  fulfilled: '#6B7280',
  cancelled: '#EF4444',
};

const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
};

const PLAN_CATEGORIES = [
  { key: 'coffee', label: 'Coffee', icon: Coffee, color: '#D97706' },
  { key: 'coworking', label: 'Work', icon: Briefcase, color: '#7C3AED' },
  { key: 'fitness', label: 'Fitness', icon: Dumbbell, color: '#EF4444' },
  { key: 'social', label: 'Social', icon: Users, color: '#3B82F6' },
  { key: 'wellness', label: 'Wellness', icon: Heart, color: '#10B981' },
  { key: 'travel', label: 'Travel', icon: Car, color: '#8B5CF6' },
];

function CreateRequestModal({
  visible, onClose, onCreate, colors, selectedDate,
}: { visible: boolean; onClose: () => void; onCreate: (req: { title: string; description: string; category: ServiceCategory; location: string; date: string; time: string; budgetMin: number; budgetMax: number; image?: string }) => void; colors: any; selectedDate: string }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ServiceCategory>('photography');
  const [location, setLocation] = useState('');
  const [time, setTime] = useState('12:00 PM');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnail, setThumbnail] = useState<string | null>(null);

  const pickThumbnail = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [16, 9],
    });
    if (!result.canceled && result.assets?.[0]) {
      setThumbnail(result.assets[0].uri);
    }
  };

  const handleCreate = () => {
    if (!title.trim()) return;
    if (Platform.OS !== 'web') {
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (_) {}
    }
    onCreate({
      title: title.trim(),
      description: description.trim(),
      category,
      location: location.trim(),
      date: selectedDate,
      time,
      budgetMin: parseInt(budgetMin, 10) || 0,
      budgetMax: parseInt(budgetMax, 10) || 0,
      image: thumbnail || undefined,
    });
    setTitle(''); setDescription(''); setCategory('photography'); setLocation('');
    setTime('12:00 PM'); setBudgetMin(''); setBudgetMax(''); setThumbnail(null);
    onClose();
  };

  const canSubmit = title.trim().length > 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.qpModal, { backgroundColor: colors.background }]}>
        <View style={[styles.qpHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose}><X size={22} color={colors.text} /></TouchableOpacity>
          <Text style={[styles.qpTitle, { color: colors.text }]}>Post Request</Text>
          <TouchableOpacity
            style={[styles.qpSaveBtn, { backgroundColor: canSubmit ? '#F59E0B' : colors.surface, opacity: canSubmit ? 1 : 0.5 }]}
            onPress={handleCreate} disabled={!canSubmit}
          >
            <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 14 }}>Post</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
          <View>
            <Text style={[styles.qpLabel, { color: colors.textSecondary }]}>What do you need?</Text>
            <TextInput
              style={[styles.qpInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="e.g. DJ for Friday night party" placeholderTextColor={colors.textTertiary}
              value={title} onChangeText={setTitle}
            />
          </View>
          {/* Thumbnail */}
          <View>
            <Text style={[styles.qpLabel, { color: colors.textSecondary }]}>Thumbnail (optional)</Text>
            <TouchableOpacity
              onPress={pickThumbnail}
              style={[styles.thumbnailPicker, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              {thumbnail ? (
                <View style={styles.thumbnailPreviewWrap}>
                  <Image source={{ uri: thumbnail }} style={styles.thumbnailPreview} />
                  <View style={[styles.thumbnailOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                    <Text style={styles.thumbnailOverlayText}>Change</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.thumbnailPlaceholder}>
                  <Camera size={20} color={colors.textSecondary} />
                  <Text style={[styles.thumbnailText, { color: colors.textSecondary }]}>Add Image</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
          <View>
            <Text style={[styles.qpLabel, { color: colors.textSecondary }]}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.qpCatGrid}>
                {SERVICE_CATEGORIES.map((cat) => {
                  const active = category === cat.key;
                  return (
                    <TouchableOpacity key={cat.key}
                      style={[styles.qpCatBtn, { backgroundColor: active ? '#F59E0B15' : colors.surface, borderColor: active ? '#F59E0B' : colors.border }]}
                      onPress={() => setCategory(cat.key)}
                    >
                      <Text style={{ fontSize: 16 }}>{cat.icon}</Text>
                      <Text style={[styles.qpCatText, { color: active ? '#F59E0B' : colors.textSecondary }]}>{cat.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
          <View>
            <Text style={[styles.qpLabel, { color: colors.textSecondary }]}>Location</Text>
            <TextInput
              style={[styles.qpInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="e.g. Williamsburg, Brooklyn" placeholderTextColor={colors.textTertiary}
              value={location} onChangeText={setLocation}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.qpLabel, { color: colors.textSecondary }]}>Date</Text>
              <View style={[styles.qpInput, { backgroundColor: colors.surface, borderColor: colors.border, justifyContent: 'center' }]}>
                <Text style={{ color: colors.text, fontSize: 15 }}>{getDateLabel(selectedDate)}</Text>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.qpLabel, { color: colors.textSecondary }]}>Time</Text>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {['9:00 AM', '12:00 PM', '3:00 PM', '6:00 PM', '8:00 PM', '10:00 PM'].map((t) => {
                  const active = time === t;
                  return (
                    <TouchableOpacity key={t}
                      style={[styles.qpTimeBtn, { backgroundColor: active ? '#F59E0B' : colors.surface, borderColor: active ? '#F59E0B' : colors.border }]}
                      onPress={() => setTime(t)}
                    >
                      <Text style={[styles.qpTimeText, { color: active ? '#FFF' : colors.textSecondary }]}>{t}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.qpLabel, { color: colors.textSecondary }]}>Budget Min ($)</Text>
              <TextInput
                style={[styles.qpInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                placeholder="50" placeholderTextColor={colors.textTertiary}
                value={budgetMin} onChangeText={setBudgetMin} keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.qpLabel, { color: colors.textSecondary }]}>Budget Max ($)</Text>
              <TextInput
                style={[styles.qpInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                placeholder="200" placeholderTextColor={colors.textTertiary}
                value={budgetMax} onChangeText={setBudgetMax} keyboardType="numeric"
              />
            </View>
          </View>
          <View>
            <Text style={[styles.qpLabel, { color: colors.textSecondary }]}>Description (optional)</Text>
            <TextInput
              style={[styles.qpInput, styles.qpNotes, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="Details about what you need..." placeholderTextColor={colors.textTertiary}
              value={description} onChangeText={setDescription} multiline textAlignVertical="top"
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function QuickPlanModal({
  visible, onClose, onSave, colors,
}: { visible: boolean; onClose: () => void; onSave: (plan: { title: string; date: string; time: string; category: string; notes: string }) => void; colors: any }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('coffee');
  const [time, setTime] = useState('12:00 PM');
  const [notes, setNotes] = useState('');

  const handleSave = () => {
    if (!title.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave({ title: title.trim(), date: formatDate(new Date()), time, category, notes: notes.trim() });
    setTitle(''); setNotes(''); setCategory('coffee'); setTime('12:00 PM');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.qpModal, { backgroundColor: colors.background }]}>
        <View style={[styles.qpHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose}><X size={22} color={colors.text} /></TouchableOpacity>
          <Text style={[styles.qpTitle, { color: colors.text }]}>Quick Plan</Text>
          <TouchableOpacity
            style={[styles.qpSaveBtn, { backgroundColor: title.trim() ? colors.accent : colors.surface, opacity: title.trim() ? 1 : 0.5 }]}
            onPress={handleSave} disabled={!title.trim()}
          >
            <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 14 }}>Save</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
          <View>
            <Text style={[styles.qpLabel, { color: colors.textSecondary }]}>What?</Text>
            <TextInput
              style={[styles.qpInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="Plan title..." placeholderTextColor={colors.textTertiary}
              value={title} onChangeText={setTitle}
            />
          </View>
          <View>
            <Text style={[styles.qpLabel, { color: colors.textSecondary }]}>Time</Text>
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              {['9:00 AM', '12:00 PM', '3:00 PM', '6:00 PM', '8:00 PM'].map((t) => {
                const active = time === t;
                return (
                  <TouchableOpacity key={t}
                    style={[styles.qpTimeBtn, { backgroundColor: active ? colors.accent : colors.surface, borderColor: active ? colors.accent : colors.border }]}
                    onPress={() => setTime(t)}
                  >
                    <Text style={[styles.qpTimeText, { color: active ? '#FFF' : colors.textSecondary }]}>{t}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <View>
            <Text style={[styles.qpLabel, { color: colors.textSecondary }]}>Category</Text>
            <View style={styles.qpCatGrid}>
              {PLAN_CATEGORIES.map((cat) => {
                const CatIcon = cat.icon;
                const active = category === cat.key;
                return (
                  <TouchableOpacity key={cat.key}
                    style={[styles.qpCatBtn, { backgroundColor: active ? cat.color + '15' : colors.surface, borderColor: active ? cat.color : colors.border }]}
                    onPress={() => setCategory(cat.key)}
                  >
                    <CatIcon size={16} color={cat.color} />
                    <Text style={[styles.qpCatText, { color: active ? cat.color : colors.textSecondary }]}>{cat.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <View>
            <Text style={[styles.qpLabel, { color: colors.textSecondary }]}>Notes (optional)</Text>
            <TextInput
              style={[styles.qpInput, styles.qpNotes, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="Details..." placeholderTextColor={colors.textTertiary}
              value={notes} onChangeText={setNotes} multiline textAlignVertical="top"
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
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
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { plans, deletePlan, createPlan, getPlansByDate, refetch } = usePlanner();

  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [refreshing, setRefreshing] = useState(false);
  const [showQuickPlan, setShowQuickPlan] = useState(false);
  const [mode, setMode] = useState<'mydays' | 'requests' | 'allplans'>('mydays');
  const [showCreateRequest, setShowCreateRequest] = useState(false);

  const { requests, createRequest, deleteRequest, getRequestsByDate } = useServiceRequests();

  const datesWithPlans = useMemo(() => {
    const dates = new Set<string>();
    plans.forEach(p => dates.add(p.date));
    return dates;
  }, [plans]);

  const datePlans = useMemo(() => getPlansByDate(selectedDate), [getPlansByDate, selectedDate]);
  const dateRequests = useMemo(() => getRequestsByDate(selectedDate), [getRequestsByDate, selectedDate]);
  const allRequests = useMemo(() => requests, [requests]);

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

  const handleCreateRequest = useCallback(async (req: { title: string; description: string; category: ServiceCategory; location: string; date: string; time: string; budgetMin: number; budgetMax: number; image?: string }) => {
    try {
      const cat = SERVICE_CATEGORIES.find((c) => c.key === req.category);
      createRequest({
        title: req.title,
        description: req.description,
        category: req.category,
        location: req.location,
        date: req.date,
        time: req.time,
        budgetMin: req.budgetMin,
        budgetMax: req.budgetMax,
        tags: cat ? [cat.label] : [],
        image: req.image,
        creatorId: user?.id || '',
        createdBy: { name: 'You', avatar: '' },
      });
      setMode('requests');
      console.log('[Planner] Service request created:', req.title);
    } catch (e) {
      console.error('[Planner] Create request failed:', e);
    }
  }, [createRequest]);

  const handleQuickCreate = useCallback(async (plan: { title: string; date: string; time: string; category: string; notes: string }) => {
    try {
      await createPlan({
        date: plan.date,
        date_label: `${plan.time} — ${plan.title}`,
        location_type: plan.category === 'coworking' ? 'coworking' : plan.category === 'coffee' ? 'coffee' : 'home',
        transport: 'none',
        plan_details: {
          location_type: plan.category === 'coworking' ? 'coworking' : plan.category === 'coffee' ? 'coffee' : 'home',
          transport: 'none',
          assistance: [],
          payment: 'cash',
        },
      });
      console.log('[Planner] Quick plan created:', plan.title);
    } catch (e) {
      console.error('[Planner] Quick create failed:', e);
    }
  }, [createPlan]);

  const totalPlansCount = plans.length;
  const upcomingPlans = plans.filter(p => new Date(p.date) >= new Date(formatDate(new Date()))).length;
  const activePlans = plans.filter(p => p.status === 'active').length;
  const completedPlans = plans.filter(p => p.status === 'completed').length;

  // Group all plans by date for activity timeline
  const plansByDate = useMemo(() => {
    const grouped: Record<string, Plan[]> = {};
    [...plans].sort((a, b) => b.date.localeCompare(a.date)).forEach(p => {
      if (!grouped[p.date]) grouped[p.date] = [];
      grouped[p.date].push(p);
    });
    return Object.entries(grouped);
  }, [plans]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: 'Planner',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowQuickPlan(true);
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

        {mode === 'requests' && (
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/bundle-builder' as any);
            }}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#0095F6', '#0084D6']}
              style={styles.actionGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Package size={20} color="#FFF" />
              <Text style={styles.actionText}>Build Bundle</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            if (mode === 'requests') {
              setShowCreateRequest(true);
            } else {
              router.push('/planner/browse-jobs' as any);
            }
          }}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={mode === 'requests' ? ['#F59E0B', '#D97706'] : ['#10B981', '#059669']}
            style={styles.actionGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {mode === 'requests' ? <Plus size={20} color="#FFF" /> : <Briefcase size={20} color="#FFF" />}
            <Text style={styles.actionText}>{mode === 'requests' ? 'Post Request' : 'Browse Jobs'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Mode Toggle */}
      <View style={[styles.modeToggle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'mydays' && { backgroundColor: colors.accent }]}
          onPress={() => { setMode('mydays'); if (Platform.OS !== 'web') Haptics.selectionAsync(); }}
        >
          <Calendar size={16} color={mode === 'mydays' ? '#FFF' : colors.textSecondary} />
          <Text style={[styles.modeBtnText, { color: mode === 'mydays' ? '#FFF' : colors.textSecondary }]}>My Day</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'allplans' && { backgroundColor: colors.accent }]}
          onPress={() => { setMode('allplans'); if (Platform.OS !== 'web') Haptics.selectionAsync(); }}
        >
          <LayoutGrid size={16} color={mode === 'allplans' ? '#FFF' : colors.textSecondary} />
          <Text style={[styles.modeBtnText, { color: mode === 'allplans' ? '#FFF' : colors.textSecondary }]}>My Plans</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'requests' && { backgroundColor: colors.accent }]}
          onPress={() => { setMode('requests'); if (Platform.OS !== 'web') Haptics.selectionAsync(); }}
        >
          <Search size={16} color={mode === 'requests' ? '#FFF' : colors.textSecondary} />
          <Text style={[styles.modeBtnText, { color: mode === 'requests' ? '#FFF' : colors.textSecondary }]}>Requests</Text>
          {allRequests.filter(r => r.status === 'open').length > 0 && (
            <View style={styles.modeBadge}>
              <Text style={styles.modeBadgeText}>{allRequests.filter(r => r.status === 'open').length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {(mode === 'mydays' || mode === 'allplans') && totalPlansCount > 0 && (
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statNumber, { color: colors.accent }]}>{totalPlansCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statNumber, { color: '#10B981' }]}>{upcomingPlans}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Upcoming</Text>
          </View>
          {mode === 'allplans' && (
            <>
              <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.statNumber, { color: '#3B82F6' }]}>{activePlans}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Active</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.statNumber, { color: '#6366F1' }]}>{completedPlans}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Done</Text>
              </View>
            </>
          )}
        </View>
      )}

      {mode !== 'allplans' && (
        <MonthCalendar
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          datesWithPlans={datesWithPlans}
          colors={colors}
        />
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        {mode === 'allplans' ? (
          <View style={styles.plansList}>
            {plansByDate.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={[styles.emptyIcon, { backgroundColor: colors.surface }]}>
                  <LayoutGrid size={40} color={colors.textTertiary} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No plans yet</Text>
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                  Tap + to create your first plan
                </Text>
              </View>
            ) : (
              plansByDate.map(([date, datePlanList]) => (
                <View key={date} style={{ marginBottom: 20 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingHorizontal: 4 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{getDateLabel(date)}</Text>
                    <View style={{ height: 1, flex: 1, marginHorizontal: 10, backgroundColor: colors.border }} />
                    <Text style={{ fontSize: 12, color: colors.textTertiary }}>{datePlanList.length} plan{datePlanList.length !== 1 ? 's' : ''}</Text>
                  </View>
                  {datePlanList.map(plan => {
                    const statusColor = plan.status === 'completed' ? '#6366F1' : plan.status === 'active' ? '#10B981' : plan.status === 'cancelled' ? '#EF4444' : '#F59E0B';
                    return (
                      <TouchableOpacity
                        key={plan.id}
                        style={{ flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 6, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
                        onPress={() => router.push(`/planner/${plan.id}` as any)}
                        activeOpacity={0.7}
                      >
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: statusColor, marginRight: 12 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }} numberOfLines={1}>{plan.date_label || 'Plan'}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                            {plan.location_type ? (
                              <Text style={{ fontSize: 12, color: colors.textSecondary }}>{plan.location_type.charAt(0).toUpperCase() + plan.location_type.slice(1)}</Text>
                            ) : null}
                            {plan.transport && plan.transport !== 'none' ? (
                              <Text style={{ fontSize: 11, color: colors.textTertiary }}>· {plan.transport}</Text>
                            ) : null}
                          </View>
                        </View>
                        <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: statusColor + '18' }}>
                          <Text style={{ fontSize: 11, fontWeight: '600', color: statusColor }}>{plan.status}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))
            )}
          </View>
        ) : mode === 'requests' ? (
          <View style={styles.plansList}>
            {allRequests.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={[styles.emptyIcon, { backgroundColor: colors.surface }]}>
                  <Search size={40} color={colors.textTertiary} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No service requests yet</Text>
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                  Tap Post Request to create your first request
                </Text>
              </View>
            ) : (
              <>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {allRequests.length} request{allRequests.length > 1 ? 's' : ''}
                </Text>
                {allRequests.map((req) => {
                  const cat = SERVICE_CATEGORIES.find((c) => c.key === req.category);
                  const statusColor = REQUEST_STATUS_COLORS[req.status];
                  const statusLabel = REQUEST_STATUS_LABELS[req.status];
                  return (
                    <TouchableOpacity
                      key={req.id}
                      style={[styles.requestCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      activeOpacity={0.7}
                    >
                      <View style={styles.requestCardHeader}>
                        <View style={[styles.requestIcon, { backgroundColor: '#F59E0B15' }]}>
                          <Text style={{ fontSize: 22 }}>{cat?.icon || '✨'}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.requestTitle, { color: colors.text }]}>{req.title}</Text>
                          <Text style={[styles.requestLocation, { color: colors.textSecondary }]}>
                            {req.location || 'No location'}
                          </Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: statusColor + '15' }]}>
                          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                        </View>
                      </View>
                      <View style={styles.requestMeta}>
                        <View style={styles.requestMetaRow}>
                          <DollarSign size={13} color={colors.textSecondary} />
                          <Text style={[styles.requestMetaText, { color: colors.textSecondary }]}>
                            ${req.budgetMin}–${req.budgetMax}
                          </Text>
                        </View>
                        <View style={styles.requestMetaRow}>
                          <Clock size={13} color={colors.textSecondary} />
                          <Text style={[styles.requestMetaText, { color: colors.textSecondary }]}>
                            {getDateLabel(req.date)}{req.time ? ` · ${formatTime12(req.time)}` : ''}
                          </Text>
                        </View>
                        {req.responders > 0 && (
                          <View style={styles.requestMetaRow}>
                            <MessageSquare size={13} color={colors.accent} />
                            <Text style={[styles.requestMetaText, { color: colors.accent }]}>
                              {req.responders} responder{req.responders > 1 ? 's' : ''}
                            </Text>
                          </View>
                        )}
                      </View>
                      {req.description ? (
                        <Text style={[styles.requestDescription, { color: colors.textTertiary }]} numberOfLines={2}>
                          {req.description}
                        </Text>
                      ) : null}
                      {req.tags.length > 0 && (
                        <View style={styles.assistanceTags}>
                          {req.tags.map((tag) => (
                            <View key={tag} style={[styles.assistanceTag, { backgroundColor: colors.accent + '15' }]}>
                              <Tag size={10} color={colors.accent} />
                              <Text style={[styles.assistanceTagText, { color: colors.accent }]}>{tag}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
          </View>
        ) : datePlans.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.surface }]}>
              <Calendar size={40} color={colors.textTertiary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No plans for {getDateLabel(selectedDate)}</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Tap + to add a quick plan
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

      {/* Quick Plan Modal */}
      <QuickPlanModal
        visible={showQuickPlan}
        onClose={() => setShowQuickPlan(false)}
        onSave={handleQuickCreate}
        colors={colors}
      />

      {/* Create Request Modal */}
      <CreateRequestModal
        visible={showCreateRequest}
        onClose={() => setShowCreateRequest(false)}
        onCreate={handleCreateRequest}
        colors={colors}
        selectedDate={selectedDate}
      />
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
  // ── Quick Plan Modal ──
  qpModal: { flex: 1 },
  qpHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  qpTitle: { fontSize: 17, fontWeight: '700' },
  qpSaveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  qpLabel: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  qpInput: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  qpNotes: { minHeight: 80 },
  thumbnailPicker: { borderRadius: 12, borderWidth: 1, overflow: 'hidden', marginBottom: 4 },
  thumbnailPreviewWrap: { position: 'relative' },
  thumbnailPreview: { width: '100%', height: 120, resizeMode: 'cover' },
  thumbnailOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 8, alignItems: 'center' },
  thumbnailOverlayText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  thumbnailPlaceholder: { height: 80, alignItems: 'center', justifyContent: 'center', gap: 6 },
  thumbnailText: { fontSize: 14 },
  qpTimeBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  qpTimeText: { fontSize: 13, fontWeight: '600' },
  qpCatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  qpCatBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  qpCatText: { fontSize: 13, fontWeight: '600' },
  // ── Mode Toggle ──
  modeToggle: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modeBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  modeBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  modeBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#FFF',
  },
  // ── Request Cards ──
  requestCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
  },
  requestCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  requestIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    marginBottom: 2,
  },
  requestLocation: {
    fontSize: 12,
  },
  requestMeta: {
    gap: 4,
    marginBottom: 6,
  },
  requestMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  requestMetaText: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  requestDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
});
