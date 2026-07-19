import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Animated,
  Platform,
} from 'react-native';
import { Calendar, Clock, X, ChevronLeft, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import Colors from '@/constants/colors';

interface DateTimePickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (date: string, time: string) => void;
  initialDate?: string;
  initialTime?: string;
  mode?: 'date' | 'time' | 'datetime';
  title?: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const generateTimeSlots = () => {
  const slots: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const h = hour.toString().padStart(2, '0');
      const m = minute.toString().padStart(2, '0');
      slots.push(`${h}:${m}`);
    }
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

const formatTimeDisplay = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
};

const getDaysInMonth = (year: number, month: number) => {
  return new Date(year, month + 1, 0).getDate();
};

const getFirstDayOfMonth = (year: number, month: number) => {
  return new Date(year, month, 1).getDay();
};

export default function DateTimePicker({
  visible,
  onClose,
  onSelect,
  initialDate,
  initialTime,
  mode = 'datetime',
  title = 'Select Date & Time',
}: DateTimePickerProps) {
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [selectedTime, setSelectedTime] = useState(initialTime || '09:00');
  const [activeTab, setActiveTab] = useState<'date' | 'time'>(mode === 'time' ? 'time' : 'date');
  
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const timeScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (initialDate) {
      const [year, month, day] = initialDate.split('-').map(Number);
      if (year && month && day) {
        setSelectedYear(year);
        setSelectedMonth(month - 1);
        setSelectedDay(day);
      }
    }
    if (initialTime) {
      setSelectedTime(initialTime);
    }
  }, [initialDate, initialTime]);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      setTimeout(() => {
        const timeIndex = TIME_SLOTS.findIndex(t => t === selectedTime);
        if (timeIndex !== -1 && timeScrollRef.current) {
          timeScrollRef.current.scrollTo({ y: timeIndex * 52 - 104, animated: false });
        }
      }, 300);
    } else {
      slideAnim.setValue(0);
      fadeAnim.setValue(0);
    }
  }, [visible, slideAnim, fadeAnim, selectedTime]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  };

  const handleConfirm = () => {
    const dateStr = `${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}-${selectedDay.toString().padStart(2, '0')}`;
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    onSelect(dateStr, selectedTime);
    handleClose();
  };

  const handlePrevMonth = () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const handleDaySelect = (day: number) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedDay(day);
    if (mode === 'datetime') {
      setActiveTab('time');
    }
  };

  const handleTimeSelect = (time: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedTime(time);
  };

  const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
  const firstDayOfMonth = getFirstDayOfMonth(selectedYear, selectedMonth);
  
  const calendarDays = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarDays.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i);
  }

  const isToday = (day: number) => {
    return day === today.getDate() && 
           selectedMonth === today.getMonth() && 
           selectedYear === today.getFullYear();
  };

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [400, 0],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity style={styles.overlayTouch} onPress={handleClose} activeOpacity={1} />
        <Animated.View style={[styles.modalContainer, { transform: [{ translateY }] }]}>
          <View style={styles.modalHandle} />
          
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <X size={24} color={Colors.dark.text} />
            </TouchableOpacity>
          </View>

          {mode === 'datetime' && (
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'date' && styles.tabActive]}
                onPress={() => setActiveTab('date')}
              >
                <Calendar size={18} color={activeTab === 'date' ? Colors.dark.text : Colors.dark.textSecondary} />
                <Text style={[styles.tabText, activeTab === 'date' && styles.tabTextActive]}>Date</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'time' && styles.tabActive]}
                onPress={() => setActiveTab('time')}
              >
                <Clock size={18} color={activeTab === 'time' ? Colors.dark.text : Colors.dark.textSecondary} />
                <Text style={[styles.tabText, activeTab === 'time' && styles.tabTextActive]}>Time</Text>
              </TouchableOpacity>
            </View>
          )}

          {(activeTab === 'date' || mode === 'date') && (
            <View style={styles.calendarContainer}>
              <View style={styles.monthNavigation}>
                <TouchableOpacity onPress={handlePrevMonth} style={styles.navButton}>
                  <ChevronLeft size={24} color={Colors.dark.text} />
                </TouchableOpacity>
                <Text style={styles.monthYearText}>
                  {MONTHS[selectedMonth]} {selectedYear}
                </Text>
                <TouchableOpacity onPress={handleNextMonth} style={styles.navButton}>
                  <ChevronRight size={24} color={Colors.dark.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.weekDaysRow}>
                {DAYS.map((day) => (
                  <Text key={day} style={styles.weekDayText}>{day}</Text>
                ))}
              </View>

              <View style={styles.daysGrid}>
                {calendarDays.map((day, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.dayCell,
                      day === selectedDay && styles.dayCellSelected,
                      day && isToday(day) && styles.dayCellToday,
                    ]}
                    onPress={() => day && handleDaySelect(day)}
                    disabled={!day}
                  >
                    {day && (
                      <Text style={[
                        styles.dayText,
                        day === selectedDay && styles.dayTextSelected,
                        isToday(day) && day !== selectedDay && styles.dayTextToday,
                      ]}>
                        {day}
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {(activeTab === 'time' || mode === 'time') && (
            <View style={styles.timeContainer}>
              <View style={styles.timeHeader}>
                <Text style={styles.timeLabel}>Select Time</Text>
                <View style={styles.selectedTimeDisplay}>
                  <Clock size={16} color={Colors.dark.accent} />
                  <Text style={styles.selectedTimeText}>{formatTimeDisplay(selectedTime)}</Text>
                </View>
              </View>
              <ScrollView
                ref={timeScrollRef}
                style={styles.timeScrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.timeScrollContent}
              >
                {TIME_SLOTS.map((time) => (
                  <TouchableOpacity
                    key={time}
                    style={[
                      styles.timeSlot,
                      selectedTime === time && styles.timeSlotSelected,
                    ]}
                    onPress={() => handleTimeSelect(time)}
                  >
                    <Text style={[
                      styles.timeSlotText,
                      selectedTime === time && styles.timeSlotTextSelected,
                    ]}>
                      {formatTimeDisplay(time)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={styles.selectedSummary}>
            <View style={styles.summaryItem}>
              <Calendar size={16} color={Colors.dark.textSecondary} />
              <Text style={styles.summaryText}>
                {MONTHS[selectedMonth]} {selectedDay}, {selectedYear}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Clock size={16} color={Colors.dark.textSecondary} />
              <Text style={styles.summaryText}>{formatTimeDisplay(selectedTime)}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
            <Text style={styles.confirmButtonText}>Confirm</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  overlayTouch: {
    flex: 1,
  },
  modalContainer: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '85%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.dark.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.dark.text,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: Colors.dark.accent,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.textSecondary,
  },
  tabTextActive: {
    color: Colors.dark.text,
  },
  calendarContainer: {
    marginBottom: 16,
  },
  monthNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthYearText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  weekDaysRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.dark.textTertiary,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellSelected: {
    backgroundColor: Colors.dark.accent,
    borderRadius: 100,
  },
  dayCellToday: {
    borderWidth: 2,
    borderColor: Colors.dark.accent,
    borderRadius: 100,
  },
  dayText: {
    fontSize: 15,
    color: Colors.dark.text,
    fontWeight: '500' as const,
  },
  dayTextSelected: {
    color: Colors.dark.text,
    fontWeight: '700' as const,
  },
  dayTextToday: {
    color: Colors.dark.accent,
  },
  timeContainer: {
    marginBottom: 16,
  },
  timeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  timeLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  selectedTimeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.dark.accentGlow,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  selectedTimeText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.accent,
  },
  timeScrollView: {
    maxHeight: 260,
  },
  timeScrollContent: {
    paddingVertical: 4,
  },
  timeSlot: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 4,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  timeSlotSelected: {
    backgroundColor: Colors.dark.accentGlow,
    borderColor: Colors.dark.accent,
  },
  timeSlotText: {
    fontSize: 15,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    fontWeight: '500' as const,
  },
  timeSlotTextSelected: {
    color: Colors.dark.accent,
    fontWeight: '600' as const,
  },
  selectedSummary: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    marginBottom: 16,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  confirmButton: {
    backgroundColor: Colors.dark.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
});
