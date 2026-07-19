import {
  Calendar,
  Clock,
  MapPin,
  FileText,
  AlertCircle,
  Users,
  DollarSign,
  ChevronRight,
} from 'lucide-react-native';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import Colors from '@/constants/colors';
import { useLifeCrm } from '@/contexts/LifeCrmContext';
import { CalendarEvent, EventPaymentStatus } from '@/mocks/lifeCrmData';
import DateTimePicker from '@/components/DateTimePicker';

const EVENT_TYPES: CalendarEvent['type'][] = ['meeting', 'personal', 'business', 'reminder', 'deadline'];
const PRIORITIES: CalendarEvent['priority'][] = ['low', 'medium', 'high'];
const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

const PAYMENT_STATUSES: { value: EventPaymentStatus; label: string; color: string }[] = [
  { value: 'expected', label: 'Expected', color: '#00D4FF' },
  { value: 'received', label: 'Received', color: '#2ED573' },
  { value: 'overdue', label: 'Overdue', color: '#FF5252' },
];

const getTypeColor = (type: string) => {
  const colors: Record<string, string> = {
    meeting: '#7B61FF',
    personal: '#00D4FF',
    business: '#00E676',
    reminder: '#FFB300',
    deadline: '#FF5252',
  };
  return colors[type] || Colors.dark.accent;
};

const getPriorityColor = (priority: string) => {
  const colors: Record<string, string> = {
    low: '#00D4FF',
    medium: '#FFB300',
    high: '#FF5252',
  };
  return colors[priority] || Colors.dark.accent;
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  });
};

const formatTime = (timeStr: string) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
};

export default function AddEventScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addCalendarEvent } = useLifeCrm();

  const [title, setTitle] = useState('');
  const [type, setType] = useState<CalendarEvent['type']>('meeting');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState(60);
  const [location, setLocation] = useState('');
  const [priority, setPriority] = useState<CalendarEvent['priority']>('medium');
  const [attendees, setAttendees] = useState('');
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);
  const [showIncomeFields, setShowIncomeFields] = useState(false);
  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomeSource, setIncomeSource] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<EventPaymentStatus>('expected');

  const handleCancel = () => {
    router.push('/(tabs)/profile' as any);
  };

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    const parsedIncome = incomeAmount ? parseFloat(incomeAmount) : undefined;
    
    const newEvent: CalendarEvent = {
      id: `e-${Date.now()}`,
      title: title.trim(),
      type,
      date,
      time,
      duration,
      location: location.trim() || undefined,
      priority,
      isCompleted: false,
      attendees: attendees ? attendees.split(',').map(a => a.trim()).filter(Boolean) : undefined,
      incomeAmount: parsedIncome,
      incomeSource: incomeSource.trim() || undefined,
      paymentStatus: parsedIncome ? paymentStatus : undefined,
    };

    addCalendarEvent(newEvent);

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    router.push('/(tabs)/profile' as any);
  };

  const handleDateTimeSelect = (selectedDate: string, selectedTime: string) => {
    setDate(selectedDate);
    setTime(selectedTime);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Event</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Event Details</Text>

          <View style={styles.inputGroup}>
            <View style={styles.inputIcon}>
              <FileText size={18} color={Colors.dark.textSecondary} />
            </View>
            <TextInput
              style={styles.input}
              placeholder="Event title *"
              placeholderTextColor={Colors.dark.textTertiary}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          <Text style={styles.inputLabel}>Event Type</Text>
          <View style={styles.typeSelector}>
            {EVENT_TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                style={[
                  styles.typeOption,
                  type === t && { backgroundColor: getTypeColor(t) + '20', borderColor: getTypeColor(t) },
                ]}
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    Haptics.selectionAsync();
                  }
                  setType(t);
                }}
              >
                <Text
                  style={[
                    styles.typeText,
                    type === t && { color: getTypeColor(t) },
                  ]}
                >
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Date & Time</Text>

          <TouchableOpacity 
            style={styles.dateTimeSelector}
            onPress={() => setShowDateTimePicker(true)}
          >
            <View style={styles.dateTimeSelectorLeft}>
              <View style={[styles.dateTimeIcon, { backgroundColor: 'rgba(123, 97, 255, 0.15)' }]}>
                <Calendar size={20} color="#7B61FF" />
              </View>
              <View style={styles.dateTimeInfo}>
                <Text style={styles.dateTimeLabel}>Date</Text>
                <Text style={styles.dateTimeValue}>{formatDate(date)}</Text>
              </View>
            </View>
            <View style={styles.dateTimeSelectorRight}>
              <View style={[styles.dateTimeIcon, { backgroundColor: 'rgba(0, 212, 255, 0.15)' }]}>
                <Clock size={20} color="#00D4FF" />
              </View>
              <View style={styles.dateTimeInfo}>
                <Text style={styles.dateTimeLabel}>Time</Text>
                <Text style={styles.dateTimeValue}>{formatTime(time)}</Text>
              </View>
            </View>
          </TouchableOpacity>

          <Text style={styles.inputLabel}>Duration</Text>
          <View style={styles.durationSelector}>
            {DURATION_OPTIONS.map((d) => (
              <TouchableOpacity
                key={d}
                style={[
                  styles.durationOption,
                  duration === d && styles.durationOptionSelected,
                ]}
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    Haptics.selectionAsync();
                  }
                  setDuration(d);
                }}
              >
                <Text
                  style={[
                    styles.durationText,
                    duration === d && styles.durationTextSelected,
                  ]}
                >
                  {d >= 60 ? `${d / 60}h` : `${d}m`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location & Attendees</Text>

          <View style={styles.inputGroup}>
            <View style={styles.inputIcon}>
              <MapPin size={18} color={Colors.dark.textSecondary} />
            </View>
            <TextInput
              style={styles.input}
              placeholder="Location (optional)"
              placeholderTextColor={Colors.dark.textTertiary}
              value={location}
              onChangeText={setLocation}
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputIcon}>
              <Users size={18} color={Colors.dark.textSecondary} />
            </View>
            <TextInput
              style={styles.input}
              placeholder="Attendees (comma-separated)"
              placeholderTextColor={Colors.dark.textTertiary}
              value={attendees}
              onChangeText={setAttendees}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Income Tracking</Text>
          
          <TouchableOpacity 
            style={styles.incomeToggleBtn}
            onPress={() => setShowIncomeFields(!showIncomeFields)}
          >
            <View style={[styles.incomeToggleIcon, { backgroundColor: showIncomeFields ? 'rgba(46, 213, 115, 0.15)' : 'rgba(138, 138, 143, 0.15)' }]}>
              <DollarSign size={18} color={showIncomeFields ? '#2ED573' : Colors.dark.textSecondary} />
            </View>
            <View style={styles.incomeToggleContent}>
              <Text style={[styles.incomeToggleTitle, showIncomeFields && { color: '#2ED573' }]}>
                {showIncomeFields ? 'Income Fields Active' : 'Add Income Details'}
              </Text>
              <Text style={styles.incomeToggleSubtitle}>
                Track expected earnings from this event
              </Text>
            </View>
            <ChevronRight 
              size={18} 
              color={showIncomeFields ? '#2ED573' : Colors.dark.textTertiary} 
              style={{ transform: [{ rotate: showIncomeFields ? '90deg' : '0deg' }] }}
            />
          </TouchableOpacity>

          {showIncomeFields && (
            <View style={styles.incomeFieldsContainer}>
              <View style={styles.inputGroup}>
                <View style={styles.inputIcon}>
                  <DollarSign size={18} color="#2ED573" />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Income amount"
                  placeholderTextColor={Colors.dark.textTertiary}
                  value={incomeAmount}
                  onChangeText={setIncomeAmount}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.inputIcon}>
                  <FileText size={18} color={Colors.dark.textSecondary} />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Income source/description"
                  placeholderTextColor={Colors.dark.textTertiary}
                  value={incomeSource}
                  onChangeText={setIncomeSource}
                />
              </View>

              <Text style={styles.inputLabel}>Payment Status</Text>
              <View style={styles.paymentStatusSelector}>
                {PAYMENT_STATUSES.map((status) => (
                  <TouchableOpacity
                    key={status.value}
                    style={[
                      styles.paymentStatusOption,
                      paymentStatus === status.value && { backgroundColor: status.color + '20', borderColor: status.color },
                    ]}
                    onPress={() => {
                      if (Platform.OS !== 'web') {
                        Haptics.selectionAsync();
                      }
                      setPaymentStatus(status.value);
                    }}
                  >
                    <Text
                      style={[
                        styles.paymentStatusText,
                        paymentStatus === status.value && { color: status.color },
                      ]}
                    >
                      {status.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Priority</Text>

          <View style={styles.prioritySelector}>
            {PRIORITIES.map((p) => (
              <TouchableOpacity
                key={p}
                style={[
                  styles.priorityOption,
                  priority === p && { backgroundColor: getPriorityColor(p) + '20', borderColor: getPriorityColor(p) },
                ]}
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    Haptics.selectionAsync();
                  }
                  setPriority(p);
                }}
              >
                <AlertCircle
                  size={16}
                  color={priority === p ? getPriorityColor(p) : Colors.dark.textSecondary}
                />
                <Text
                  style={[
                    styles.priorityText,
                    priority === p && { color: getPriorityColor(p) },
                  ]}
                >
                  {p}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.saveButtonLarge} onPress={handleSave}>
          <Text style={styles.saveButtonLargeText}>Add Event</Text>
        </TouchableOpacity>
      </ScrollView>

      <DateTimePicker
        visible={showDateTimePicker}
        onClose={() => setShowDateTimePicker(false)}
        onSelect={handleDateTimeSelect}
        initialDate={date}
        initialTime={time}
        title="Select Date & Time"
      />
    </View>
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
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.dark.surface,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.textSecondary,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.dark.accent,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    marginBottom: 16,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 12,
  },
  inputIcon: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingRight: 14,
    fontSize: 15,
    color: Colors.dark.text,
  },
  inputLabel: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginBottom: 10,
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  typeText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.dark.textSecondary,
    textTransform: 'capitalize',
  },
  dateTimeSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  dateTimeSelectorLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  dateTimeSelectorRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  dateTimeIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateTimeInfo: {
    flex: 1,
  },
  dateTimeLabel: {
    fontSize: 11,
    color: Colors.dark.textTertiary,
    marginBottom: 2,
  },
  dateTimeValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  durationSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  durationOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  durationOptionSelected: {
    backgroundColor: Colors.dark.accentGlow,
    borderColor: Colors.dark.accent,
  },
  durationText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.dark.textSecondary,
  },
  durationTextSelected: {
    color: Colors.dark.accent,
  },
  prioritySelector: {
    flexDirection: 'row',
    gap: 10,
  },
  priorityOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  priorityText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.dark.textSecondary,
    textTransform: 'capitalize',
  },
  saveButtonLarge: {
    marginHorizontal: 16,
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: Colors.dark.accent,
    alignItems: 'center',
  },
  saveButtonLargeText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  incomeToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  incomeToggleIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  incomeToggleContent: {
    flex: 1,
  },
  incomeToggleTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  incomeToggleSubtitle: {
    fontSize: 12,
    color: Colors.dark.textTertiary,
    marginTop: 2,
  },
  incomeFieldsContainer: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: 'rgba(46, 213, 115, 0.3)',
  },
  paymentStatusSelector: {
    flexDirection: 'row',
    gap: 10,
  },
  paymentStatusOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
  },
  paymentStatusText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.dark.textSecondary,
  },
});
