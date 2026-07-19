import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  Calendar,
  Clock,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Plus,
  Briefcase,
  Coffee,
  Dumbbell,
  Book,
  ShoppingCart,
  Phone,
  Users,
  Heart,
  Zap,
  Star,
} from 'lucide-react-native';

import { useTheme } from '@/contexts/ThemeContext';
import { usePlanner } from '@/contexts/PlannerContext';

const BLOCK_CATEGORIES = [
  { id: 'work', label: 'Work', icon: Briefcase, color: '#0EA5E9' },
  { id: 'personal', label: 'Personal', icon: Heart, color: '#EC4899' },
  { id: 'health', label: 'Health', icon: Dumbbell, color: '#10B981' },
  { id: 'learning', label: 'Learning', icon: Book, color: '#8B5CF6' },
  { id: 'social', label: 'Social', icon: Users, color: '#F59E0B' },
  { id: 'errands', label: 'Errands', icon: ShoppingCart, color: '#6366F1' },
  { id: 'calls', label: 'Calls', icon: Phone, color: '#14B8A6' },
  { id: 'focus', label: 'Focus', icon: Zap, color: '#EF4444' },
  { id: 'break', label: 'Break', icon: Coffee, color: '#78716C' },
  { id: 'other', label: 'Other', icon: Star, color: '#6B7280' },
] as const;

const TIME_DURATIONS = [
  { id: '15', label: '15 min' },
  { id: '30', label: '30 min' },
  { id: '60', label: '1 hour' },
  { id: '120', label: '2 hours' },
  { id: '240', label: '4 hours' },
  { id: 'custom', label: 'Custom' },
] as const;

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

interface BlockForm {
  title: string;
  description: string;
  category: string;
  date: string;
  startTime: string;
  duration: string;
  customDuration: string;
  location: string;
  priority: 'low' | 'medium' | 'high';
}

export default function AddBlockScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { createPlan } = usePlanner();

  const [isSaving, setIsSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());

  const toastAnim = useRef(new Animated.Value(0)).current;
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const [form, setForm] = useState<BlockForm>({
    title: '',
    description: '',
    category: 'work',
    date: formatDate(new Date()),
    startTime: '09:00',
    duration: '60',
    customDuration: '',
    location: '',
    priority: 'medium',
  });

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(toastAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setToastMessage(''));
  }, [toastAnim]);

  const haptic = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const formatTime = (time: string): string => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  };

  const handleSaveBlock = useCallback(async () => {
    if (!form.title.trim()) {
      showToast('Please enter a title', 'error');
      return;
    }

    setIsSaving(true);
    haptic();

    try {
      const categoryConfig = BLOCK_CATEGORIES.find(c => c.id === form.category);
      const durationMinutes = form.duration === 'custom' 
        ? parseInt(form.customDuration, 10) || 60 
        : parseInt(form.duration, 10);

      const planDetails = {
        location_type: 'home' as const,
        transport: 'none' as const,
        assistance: [],
        payment: 'cash' as const,
        custom_block: {
          title: form.title.trim(),
          description: form.description.trim(),
          category: form.category,
          category_label: categoryConfig?.label || 'Other',
          category_color: categoryConfig?.color || '#6B7280',
          start_time: form.startTime,
          duration_minutes: durationMinutes,
          location: form.location.trim(),
          priority: form.priority,
        },
      };

      console.log('[AddBlock] Saving custom block:', planDetails);

      const result = await createPlan({
        date: form.date,
        date_label: form.title.trim(),
        location_type: 'home',
        transport: 'none',
        plan_details: planDetails,
      });

      if (result) {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        showToast('Block added to planner!', 'success');
        setTimeout(() => router.back(), 500);
      } else {
        showToast('Failed to save block', 'error');
      }
    } catch (e: any) {
      console.error('[AddBlock] Error:', e);
      showToast('Error: ' + (e.message || 'Unknown error'), 'error');
    } finally {
      setIsSaving(false);
    }
  }, [form, createPlan, haptic, router, showToast]);

  const renderDatePicker = () => {
    const firstDay = new Date(pickerYear, pickerMonth, 1).getDay();
    const daysInMonth = new Date(pickerYear, pickerMonth + 1, 0).getDate();
    const todayStr = formatDate(new Date());
    const cells = [];

    for (let i = 0; i < firstDay; i++) {
      cells.push(<View key={`e-${i}`} style={styles.dayCell} />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${pickerYear}-${String(pickerMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isSelected = form.date === dateStr;
      const isPast = new Date(dateStr) < new Date(todayStr);

      cells.push(
        <TouchableOpacity
          key={day}
          style={[styles.dayCell, isSelected && { backgroundColor: colors.accent, borderRadius: 8 }]}
          onPress={() => {
            if (!isPast) {
              haptic();
              setForm(prev => ({ ...prev, date: dateStr }));
              setShowDatePicker(false);
            }
          }}
          disabled={isPast}
        >
          <Text style={[
            styles.dayText,
            { color: isPast ? colors.textTertiary : colors.text },
            isSelected && { color: '#FFF', fontWeight: '700' as const },
          ]}>
            {day}
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <View style={[styles.calendarPicker, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.calendarHeader}>
          <TouchableOpacity
            onPress={() => {
              haptic();
              if (pickerMonth === 0) {
                setPickerMonth(11);
                setPickerYear(pickerYear - 1);
              } else {
                setPickerMonth(pickerMonth - 1);
              }
            }}
          >
            <ChevronLeft size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.calendarTitle, { color: colors.text }]}>
            {new Date(pickerYear, pickerMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Text>
          <TouchableOpacity
            onPress={() => {
              haptic();
              if (pickerMonth === 11) {
                setPickerMonth(0);
                setPickerYear(pickerYear + 1);
              } else {
                setPickerMonth(pickerMonth + 1);
              }
            }}
          >
            <ChevronRight size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.weekdays}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <Text key={i} style={[styles.weekday, { color: colors.textTertiary }]}>{d}</Text>
          ))}
        </View>
        <View style={styles.daysGrid}>{cells}</View>
      </View>
    );
  };

  const isToday = form.date === formatDate(new Date());
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = form.date === formatDate(tomorrow);

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen
        options={{
          title: 'Add Custom Block',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
              <ChevronLeft size={24} color={colors.text} />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 180 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>TITLE</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            placeholder="What do you need to do?"
            placeholderTextColor={colors.textTertiary}
            value={form.title}
            onChangeText={t => setForm(prev => ({ ...prev, title: t }))}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>CATEGORY</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
            <View style={styles.categoryRow}>
              {BLOCK_CATEGORIES.map(({ id, label, icon: Icon, color }) => {
                const isSelected = form.category === id;
                return (
                  <TouchableOpacity
                    key={id}
                    style={[
                      styles.categoryChip,
                      { backgroundColor: isSelected ? color : colors.surface, borderColor: isSelected ? color : colors.border },
                    ]}
                    onPress={() => {
                      haptic();
                      setForm(prev => ({ ...prev, category: id }));
                    }}
                  >
                    <Icon size={16} color={isSelected ? '#FFF' : color} />
                    <Text style={[styles.categoryText, { color: isSelected ? '#FFF' : colors.text }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>WHEN</Text>
          <View style={styles.dateChipsRow}>
            <TouchableOpacity
              style={[styles.dateChip, { backgroundColor: isToday ? colors.accent : colors.surface, borderColor: colors.border }]}
              onPress={() => {
                haptic();
                setForm(prev => ({ ...prev, date: formatDate(new Date()) }));
              }}
            >
              <Text style={[styles.dateChipText, { color: isToday ? '#FFF' : colors.text }]}>Today</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dateChip, { backgroundColor: isTomorrow ? colors.accent : colors.surface, borderColor: colors.border }]}
              onPress={() => {
                haptic();
                setForm(prev => ({ ...prev, date: formatDate(tomorrow) }));
              }}
            >
              <Text style={[styles.dateChipText, { color: isTomorrow ? '#FFF' : colors.text }]}>Tomorrow</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dateChip, { backgroundColor: !isToday && !isTomorrow ? colors.accent : colors.surface, borderColor: colors.border }]}
              onPress={() => setShowDatePicker(!showDatePicker)}
            >
              <Calendar size={16} color={!isToday && !isTomorrow ? '#FFF' : colors.textSecondary} />
              <Text style={[styles.dateChipText, { color: !isToday && !isTomorrow ? '#FFF' : colors.text }]}>
                {!isToday && !isTomorrow ? getDateLabel(form.date) : 'Pick'}
              </Text>
            </TouchableOpacity>
          </View>
          {showDatePicker && renderDatePicker()}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>START TIME</Text>
          <TouchableOpacity
            style={[styles.timeButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setShowTimePicker(!showTimePicker)}
          >
            <Clock size={18} color={colors.textSecondary} />
            <Text style={[styles.timeText, { color: colors.text }]}>{formatTime(form.startTime)}</Text>
            <ChevronRight size={18} color={colors.textTertiary} />
          </TouchableOpacity>
          {showTimePicker && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeScroll}>
              {Array.from({ length: 17 }, (_, i) => i + 6).flatMap(h => [0, 30].map(m => {
                const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                const isSelected = form.startTime === time;
                return (
                  <TouchableOpacity
                    key={time}
                    style={[styles.timeChip, { backgroundColor: isSelected ? colors.accent : colors.surface, borderColor: colors.border }]}
                    onPress={() => {
                      haptic();
                      setForm(prev => ({ ...prev, startTime: time }));
                      setShowTimePicker(false);
                    }}
                  >
                    <Text style={{ color: isSelected ? '#FFF' : colors.text, fontSize: 13 }}>{formatTime(time)}</Text>
                  </TouchableOpacity>
                );
              }))}
            </ScrollView>
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>DURATION</Text>
          <View style={styles.durationRow}>
            {TIME_DURATIONS.map(({ id, label }) => {
              const isSelected = form.duration === id;
              return (
                <TouchableOpacity
                  key={id}
                  style={[
                    styles.durationChip,
                    { backgroundColor: isSelected ? colors.accent : colors.surface, borderColor: isSelected ? colors.accent : colors.border },
                  ]}
                  onPress={() => {
                    haptic();
                    setForm(prev => ({ ...prev, duration: id }));
                  }}
                >
                  <Text style={[styles.durationText, { color: isSelected ? '#FFF' : colors.text }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {form.duration === 'custom' && (
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border, marginTop: 12, width: 120 }]}
              placeholder="Minutes"
              placeholderTextColor={colors.textTertiary}
              value={form.customDuration}
              onChangeText={t => setForm(prev => ({ ...prev, customDuration: t.replace(/[^0-9]/g, '') }))}
              keyboardType="numeric"
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>DESCRIPTION (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            placeholder="Add notes or details..."
            placeholderTextColor={colors.textTertiary}
            value={form.description}
            onChangeText={t => setForm(prev => ({ ...prev, description: t }))}
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>LOCATION (optional)</Text>
          <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MapPin size={18} color={colors.textSecondary} />
            <TextInput
              style={[styles.inputInner, { color: colors.text }]}
              placeholder="Where will this happen?"
              placeholderTextColor={colors.textTertiary}
              value={form.location}
              onChangeText={t => setForm(prev => ({ ...prev, location: t }))}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>PRIORITY</Text>
          <View style={styles.priorityRow}>
            {(['low', 'medium', 'high'] as const).map(p => {
              const isSelected = form.priority === p;
              const priorityColors = { low: '#10B981', medium: '#F59E0B', high: '#EF4444' };
              return (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.priorityChip,
                    { 
                      backgroundColor: isSelected ? priorityColors[p] : colors.surface, 
                      borderColor: isSelected ? priorityColors[p] : colors.border,
                    },
                  ]}
                  onPress={() => {
                    haptic();
                    setForm(prev => ({ ...prev, priority: p }));
                  }}
                >
                  <Text style={[styles.priorityText, { color: isSelected ? '#FFF' : colors.text, textTransform: 'capitalize' }]}>{p}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.background, paddingBottom: insets.bottom + 80 }]}>
        <TouchableOpacity
          style={[styles.saveButton, { opacity: isSaving || !form.title.trim() ? 0.6 : 1 }]}
          onPress={handleSaveBlock}
          disabled={isSaving || !form.title.trim()}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#8B5CF6', '#7C3AED']}
            style={styles.saveGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Plus size={20} color="#FFF" />
                <Text style={styles.saveText}>Add Block</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {toastMessage !== '' && (
        <Animated.View
          style={[
            styles.toast,
            {
              backgroundColor: toastType === 'error' ? '#EF4444' : '#10B981',
              opacity: toastAnim,
              transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
            },
          ]}
        >
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 1,
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  inputInner: {
    flex: 1,
    fontSize: 16,
  },
  categoryScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 10,
    paddingRight: 20,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  dateChipsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  dateChipText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  timeText: {
    flex: 1,
    fontSize: 16,
  },
  timeScroll: {
    marginTop: 12,
  },
  timeChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 8,
  },
  durationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  durationChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  durationText: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 12,
  },
  priorityChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  priorityText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  calendarPicker: {
    marginTop: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  weekdays: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 14,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  saveButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  saveGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  saveText: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#FFF',
  },
  toast: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 20,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  toastText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFF',
  },
});
