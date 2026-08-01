import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Plus, Check, Circle, Trash2 } from 'lucide-react-native';
import { usePlan, TaskItem, Priority, TaskStatus } from '@/contexts/PlanContext';

const PRIORITY_OPTS: { key: Priority; label: string; color: string }[] = [
  { key: 'low', label: 'Low', color: '#6B7280' },
  { key: 'medium', label: 'Medium', color: '#3B82F6' },
  { key: 'high', label: 'High', color: '#F59E0B' },
  { key: 'critical', label: 'Critical', color: '#EF4444' },
];

const STATUS_COLORS: Record<TaskStatus, string> = {
  not_started: '#6B7280',
  in_progress: '#3B82F6',
  waiting: '#F59E0B',
  needs_review: '#A855F7',
  completed: '#10B981',
};

export default function TasksTab() {
  const { plan, addTask, updateTask, deleteTask } = usePlan();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');

  const tasks = plan?.tasks || [];
  const completed = tasks.filter(t => t.status === 'completed').length;

  const handleAdd = () => {
    if (!title.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    addTask({ title: title.trim(), priority });
    setTitle('');
    setPriority('medium');
    setShowForm(false);
  };

  const handleToggle = (task: TaskItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const isCompleted = task.status === 'completed';
    updateTask(task.id, {
      status: isCompleted ? 'not_started' : 'completed',
    });
  };

  const handleDelete = (taskId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    deleteTask(taskId);
  };

  return (
    <View style={styles.container}>
      {/* Summary bar */}
      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          {completed}/{tasks.length} done
        </Text>
        {tasks.length > 0 && (
          <View style={styles.miniBar}>
            <View style={[styles.miniFill, { width: `${tasks.length > 0 ? (completed / tasks.length) * 100 : 0}%` }]} />
          </View>
        )}
      </View>

      {/* Add Button */}
      {!showForm && (
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowForm(true)}
        >
          <Plus size={16} color="#FFF" />
          <Text style={styles.addBtnText}>Add Task</Text>
        </TouchableOpacity>
      )}

      {/* Add Form */}
      {showForm && (
        <View style={styles.formCard}>
          <TextInput
            style={styles.formInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Task title"
            placeholderTextColor="#6B7280"
            autoFocus
          />
          <View style={styles.priorityRow}>
            {PRIORITY_OPTS.map(p => (
              <TouchableOpacity
                key={p.key}
                style={[
                  styles.priorityChip,
                  priority === p.key && { backgroundColor: p.color + '30', borderColor: p.color },
                ]}
                onPress={() => setPriority(p.key)}
              >
                <Text style={[styles.priorityText, { color: p.color }]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.formActions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => { setShowForm(false); setTitle(''); }}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, !title.trim() && { opacity: 0.5 }]}
              onPress={handleAdd}
              disabled={!title.trim()}
            >
              <Text style={styles.submitText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Task List */}
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {tasks.length === 0 ? (
          <View style={styles.empty}>
            <Check size={36} color="#4B5563" />
            <Text style={styles.emptyTitle}>No tasks yet</Text>
            <Text style={styles.emptySub}>Add your first task above</Text>
          </View>
        ) : (
          tasks.map(task => {
            const isCompleted = task.status === 'completed';
            const priorityMeta = PRIORITY_OPTS.find(p => p.key === task.priority);
            return (
              <View key={task.id} style={[styles.taskCard, isCompleted && styles.taskCardDone]}>
                <TouchableOpacity
                  style={[styles.checkbox, isCompleted && { backgroundColor: '#10B981', borderColor: '#10B981' }]}
                  onPress={() => handleToggle(task)}
                >
                  {isCompleted && <Check size={12} color="#FFF" />}
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.taskTitle, isCompleted && styles.taskTitleDone]}>
                    {task.title}
                  </Text>
                </View>
                {priorityMeta && (
                  <View style={[styles.priorityBadge, { backgroundColor: priorityMeta.color + '20' }]}>
                    <Circle size={6} color={priorityMeta.color} fill={priorityMeta.color} />
                  </View>
                )}
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(task.id)}
                >
                  <Trash2 size={14} color="#4B5563" />
                </TouchableOpacity>
              </View>
            );
          })
        )}
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // Summary
  summary: {
    paddingHorizontal: 16, paddingVertical: 10, gap: 6,
  },
  summaryText: {
    color: '#9CA3AF', fontSize: 13, fontWeight: '600',
    textAlign: 'center',
  },
  miniBar: {
    height: 3, borderRadius: 2, backgroundColor: '#1F2937',
    marginHorizontal: 40,
  },
  miniFill: {
    height: 3, borderRadius: 2, backgroundColor: '#10B981',
  },
  // Add
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#8B5CF6', paddingHorizontal: 16,
    paddingVertical: 10, borderRadius: 12, alignSelf: 'center',
    marginVertical: 8,
  },
  addBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  // Form
  formCard: {
    backgroundColor: '#1F2937', borderRadius: 14, padding: 14,
    gap: 10, marginHorizontal: 14, marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#111827', color: '#FFF', fontSize: 15,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10,
  },
  priorityRow: { flexDirection: 'row', gap: 6 },
  priorityChip: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 10, borderWidth: 1, borderColor: 'transparent',
    backgroundColor: '#374151',
  },
  priorityText: { fontSize: 11, fontWeight: '600' },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  cancelBtn: { paddingVertical: 8, paddingHorizontal: 14 },
  cancelText: { color: '#9CA3AF', fontSize: 14, fontWeight: '600' },
  submitBtn: {
    backgroundColor: '#8B5CF6', paddingVertical: 8,
    paddingHorizontal: 20, borderRadius: 10,
  },
  submitText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  // List
  list: { flex: 1 },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { color: '#9CA3AF', fontSize: 16, fontWeight: '600' },
  emptySub: { color: '#6B7280', fontSize: 13 },
  // Task Card
  taskCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1F2937', borderRadius: 12, padding: 12,
    marginHorizontal: 14, marginBottom: 6,
  },
  taskCardDone: { opacity: 0.5 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
    borderColor: '#4B5563', alignItems: 'center', justifyContent: 'center',
  },
  taskTitle: { color: '#FFF', fontSize: 14, fontWeight: '500', flex: 1 },
  taskTitleDone: { textDecorationLine: 'line-through', color: '#6B7280' },
  priorityBadge: {
    width: 22, height: 22, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  deleteBtn: { padding: 4 },
});
