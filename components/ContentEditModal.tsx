import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { X, Save, Trash2, Calendar, DollarSign, MapPin, Edit3 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import Colors from '@/constants/colors';
import type { CalendarEvent, Bill } from '@/mocks/lifeCrmData';

type ContentType = 'event' | 'bill' | 'post' | 'contact';

interface ContentEditModalProps {
  visible: boolean;
  onClose: () => void;
  type: ContentType;
  data: CalendarEvent | Bill | { id: string; content: string } | null;
  onSave: (data: any) => void;
  onDelete: (id: string) => void;
}

export default function ContentEditModal({
  visible,
  onClose,
  type,
  data,
  onSave,
  onDelete,
}: ContentEditModalProps) {
  const [editData, setEditData] = useState<any>(null);

  useEffect(() => {
    if (data) {
      setEditData({ ...data });
    }
  }, [data]);

  const handleSave = () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    if (editData) {
      onSave(editData);
    }
    onClose();
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete ' + type.charAt(0).toUpperCase() + type.slice(1),
      'Are you sure you want to delete this? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }
            if (editData?.id) {
              onDelete(editData.id);
            }
            onClose();
          },
        },
      ]
    );
  };

  const getTitle = () => {
    switch (type) {
      case 'event': return 'Edit Event';
      case 'bill': return 'Edit Bill';
      case 'post': return 'Edit Post';
      case 'contact': return 'Edit Contact';
      default: return 'Edit';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'event': return <Calendar size={24} color={Colors.dark.accent} />;
      case 'bill': return <DollarSign size={24} color="#FF6B9D" />;
      case 'post': return <Edit3 size={24} color={Colors.dark.accent} />;
      default: return <Edit3 size={24} color={Colors.dark.accent} />;
    }
  };

  if (!editData) return null;

  const renderEventFields = () => (
    <>
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Title</Text>
        <TextInput
          style={styles.textInput}
          value={editData.title || ''}
          onChangeText={(text) => setEditData({ ...editData, title: text })}
          placeholder="Event title"
          placeholderTextColor={Colors.dark.textTertiary}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Date</Text>
        <TextInput
          style={styles.textInput}
          value={editData.date || ''}
          onChangeText={(text) => setEditData({ ...editData, date: text })}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={Colors.dark.textTertiary}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Time</Text>
        <TextInput
          style={styles.textInput}
          value={editData.time || ''}
          onChangeText={(text) => setEditData({ ...editData, time: text })}
          placeholder="HH:MM"
          placeholderTextColor={Colors.dark.textTertiary}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Duration (minutes)</Text>
        <TextInput
          style={styles.textInput}
          value={editData.duration?.toString() || ''}
          onChangeText={(text) => setEditData({ ...editData, duration: parseInt(text) || 0 })}
          placeholder="Duration in minutes"
          placeholderTextColor={Colors.dark.textTertiary}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Location (optional)</Text>
        <View style={styles.inputWithIcon}>
          <MapPin size={18} color={Colors.dark.textTertiary} />
          <TextInput
            style={styles.textInputWithIcon}
            value={editData.location || ''}
            onChangeText={(text) => setEditData({ ...editData, location: text })}
            placeholder="Location"
            placeholderTextColor={Colors.dark.textTertiary}
          />
        </View>
      </View>
    </>
  );

  const renderBillFields = () => (
    <>
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Bill Name</Text>
        <TextInput
          style={styles.textInput}
          value={editData.name || ''}
          onChangeText={(text) => setEditData({ ...editData, name: text })}
          placeholder="Bill name"
          placeholderTextColor={Colors.dark.textTertiary}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Amount</Text>
        <View style={styles.inputWithIcon}>
          <DollarSign size={18} color={Colors.dark.textTertiary} />
          <TextInput
            style={styles.textInputWithIcon}
            value={editData.amount?.toString() || ''}
            onChangeText={(text) => setEditData({ ...editData, amount: parseFloat(text) || 0 })}
            placeholder="0.00"
            placeholderTextColor={Colors.dark.textTertiary}
            keyboardType="decimal-pad"
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Due Date</Text>
        <View style={styles.inputWithIcon}>
          <Calendar size={18} color={Colors.dark.textTertiary} />
          <TextInput
            style={styles.textInputWithIcon}
            value={editData.dueDate || ''}
            onChangeText={(text) => setEditData({ ...editData, dueDate: text })}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Colors.dark.textTertiary}
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Category</Text>
        <TextInput
          style={styles.textInput}
          value={editData.category || ''}
          onChangeText={(text) => setEditData({ ...editData, category: text })}
          placeholder="e.g., Utilities, Rent, Subscription"
          placeholderTextColor={Colors.dark.textTertiary}
        />
      </View>

      <View style={styles.toggleGroup}>
        <Text style={styles.inputLabel}>Recurring?</Text>
        <TouchableOpacity
          style={[styles.toggleButton, editData.isRecurring && styles.toggleButtonActive]}
          onPress={() => setEditData({ ...editData, isRecurring: !editData.isRecurring })}
        >
          <Text style={[styles.toggleText, editData.isRecurring && styles.toggleTextActive]}>
            {editData.isRecurring ? 'Yes' : 'No'}
          </Text>
        </TouchableOpacity>
      </View>

      {editData.isRecurring && (
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Frequency</Text>
          <View style={styles.frequencyOptions}>
            {['weekly', 'biweekly', 'monthly', 'yearly'].map((freq) => (
              <TouchableOpacity
                key={freq}
                style={[styles.frequencyChip, editData.frequency === freq && styles.frequencyChipActive]}
                onPress={() => setEditData({ ...editData, frequency: freq })}
              >
                <Text style={[styles.frequencyText, editData.frequency === freq && styles.frequencyTextActive]}>
                  {freq.charAt(0).toUpperCase() + freq.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </>
  );

  const renderPostFields = () => (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>Content</Text>
      <TextInput
        style={[styles.textInput, styles.multilineInput]}
        value={editData.content || ''}
        onChangeText={(text) => setEditData({ ...editData, content: text })}
        placeholder="Write your post..."
        placeholderTextColor={Colors.dark.textTertiary}
        multiline
        numberOfLines={6}
        textAlignVertical="top"
      />
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          style={styles.container}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {getIcon()}
              <Text style={styles.title}>{getTitle()}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={Colors.dark.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {type === 'event' && renderEventFields()}
            {type === 'bill' && renderBillFields()}
            {type === 'post' && renderPostFields()}
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
              <Trash2 size={20} color={Colors.dark.error} />
              <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <LinearGradient
                colors={[Colors.dark.gradient1, Colors.dark.gradient2]}
                style={styles.saveButtonGradient}
              >
                <Save size={20} color={Colors.dark.text} />
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: Colors.dark.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.dark.text,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.backgroundTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 20,
    maxHeight: 400,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.textSecondary,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: Colors.dark.backgroundTertiary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.dark.text,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  multilineInput: {
    height: 150,
    textAlignVertical: 'top',
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.backgroundTertiary,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 10,
  },
  textInputWithIcon: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.dark.text,
  },
  toggleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  toggleButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.dark.backgroundTertiary,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  toggleButtonActive: {
    backgroundColor: Colors.dark.accent + '20',
    borderColor: Colors.dark.accent,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.textSecondary,
  },
  toggleTextActive: {
    color: Colors.dark.accent,
  },
  frequencyOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  frequencyChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: Colors.dark.backgroundTertiary,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  frequencyChipActive: {
    backgroundColor: Colors.dark.accent + '20',
    borderColor: Colors.dark.accent,
  },
  frequencyText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.dark.textSecondary,
  },
  frequencyTextActive: {
    color: Colors.dark.accent,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    gap: 12,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 82, 82, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 82, 82, 0.3)',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.dark.error,
  },
  saveButton: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
});
