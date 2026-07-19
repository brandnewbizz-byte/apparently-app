import {
  DollarSign,
  Calendar,
  Tag,
  RefreshCw,
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
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import Colors from '@/constants/colors';
import { useLifeCrm } from '@/contexts/LifeCrmContext';
import { Bill } from '@/mocks/lifeCrmData';
import DateTimePicker from '@/components/DateTimePicker';

const BILL_CATEGORIES: Bill['category'][] = ['utilities', 'subscription', 'loan', 'insurance', 'rent', 'other'];
const FREQUENCIES: NonNullable<Bill['frequency']>[] = ['weekly', 'monthly', 'quarterly', 'yearly'];

const getCategoryColor = (category: string) => {
  const colors: Record<string, string> = {
    utilities: '#00D4FF',
    subscription: '#7B61FF',
    loan: '#FF5252',
    insurance: '#00E676',
    rent: '#FFB300',
    other: Colors.dark.textSecondary,
  };
  return colors[category] || Colors.dark.accent;
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

export default function AddBillScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addBill } = useLifeCrm();

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [category, setCategory] = useState<Bill['category']>('utilities');
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<NonNullable<Bill['frequency']>>('monthly');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleCancel = () => {
    router.push('/(tabs)/profile' as any);
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a bill name');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    const newBill: Omit<Bill, 'id'> = {
      name: name.trim(),
      amount: parsedAmount,
      dueDate,
      category,
      isPaid: false,
      isRecurring,
      frequency: isRecurring ? frequency : undefined,
    };

    addBill(newBill);

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    router.push('/(tabs)/profile' as any);
  };

  const handleDateSelect = (selectedDate: string) => {
    setDueDate(selectedDate);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Bill</Text>
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
          <Text style={styles.sectionTitle}>Bill Details</Text>

          <View style={styles.inputGroup}>
            <View style={styles.inputIcon}>
              <Tag size={18} color={Colors.dark.textSecondary} />
            </View>
            <TextInput
              style={styles.input}
              placeholder="Bill name *"
              placeholderTextColor={Colors.dark.textTertiary}
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputIcon}>
              <DollarSign size={18} color={Colors.dark.textSecondary} />
            </View>
            <TextInput
              style={styles.input}
              placeholder="Amount *"
              placeholderTextColor={Colors.dark.textTertiary}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
          </View>

          <TouchableOpacity 
            style={styles.dateSelector}
            onPress={() => setShowDatePicker(true)}
          >
            <View style={[styles.dateIcon, { backgroundColor: 'rgba(255, 107, 157, 0.15)' }]}>
              <Calendar size={20} color="#FF6B9D" />
            </View>
            <View style={styles.dateInfo}>
              <Text style={styles.dateLabel}>Due Date</Text>
              <Text style={styles.dateValue}>{formatDate(dueDate)}</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Category</Text>

          <View style={styles.categorySelector}>
            {BILL_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryOption,
                  category === cat && { backgroundColor: getCategoryColor(cat) + '20', borderColor: getCategoryColor(cat) },
                ]}
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    Haptics.selectionAsync();
                  }
                  setCategory(cat);
                }}
              >
                <Text
                  style={[
                    styles.categoryText,
                    category === cat && { color: getCategoryColor(cat) },
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recurring Bill</Text>

          <View style={styles.recurringToggle}>
            <View style={styles.recurringInfo}>
              <RefreshCw size={20} color={Colors.dark.accent} />
              <View style={styles.recurringText}>
                <Text style={styles.recurringTitle}>Recurring Payment</Text>
                <Text style={styles.recurringSubtitle}>This bill repeats on a schedule</Text>
              </View>
            </View>
            <Switch
              value={isRecurring}
              onValueChange={(value) => {
                if (Platform.OS !== 'web') {
                  Haptics.selectionAsync();
                }
                setIsRecurring(value);
              }}
              trackColor={{ false: Colors.dark.border, true: Colors.dark.accent }}
              thumbColor={Colors.dark.text}
            />
          </View>

          {isRecurring && (
            <View style={styles.frequencySelector}>
              {FREQUENCIES.map((freq) => (
                <TouchableOpacity
                  key={freq}
                  style={[
                    styles.frequencyOption,
                    frequency === freq && styles.frequencyOptionSelected,
                  ]}
                  onPress={() => {
                    if (Platform.OS !== 'web') {
                      Haptics.selectionAsync();
                    }
                    setFrequency(freq);
                  }}
                >
                  <Text
                    style={[
                      styles.frequencyText,
                      frequency === freq && styles.frequencyTextSelected,
                    ]}
                  >
                    {freq}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.saveButtonLarge} onPress={handleSave}>
          <Text style={styles.saveButtonLargeText}>Add Bill</Text>
        </TouchableOpacity>
      </ScrollView>

      <DateTimePicker
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onSelect={(date) => handleDateSelect(date)}
        initialDate={dueDate}
        mode="date"
        title="Select Due Date"
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
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  dateIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateInfo: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    color: Colors.dark.textTertiary,
    marginBottom: 2,
  },
  dateValue: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  categorySelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.dark.textSecondary,
    textTransform: 'capitalize',
  },
  recurringToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  recurringInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recurringText: {
    gap: 2,
  },
  recurringTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  recurringSubtitle: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  frequencySelector: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  frequencyOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  frequencyOptionSelected: {
    backgroundColor: Colors.dark.accentGlow,
    borderColor: Colors.dark.accent,
  },
  frequencyText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.dark.textSecondary,
    textTransform: 'capitalize',
  },
  frequencyTextSelected: {
    color: Colors.dark.accent,
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
});
