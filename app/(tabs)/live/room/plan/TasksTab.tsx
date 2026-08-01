import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Modal,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Plus, Check, Circle, Clock, AlertCircle, ChevronDown, Trash2, User } from 'lucide-react-native';
import { usePlan, TaskItem, Priority, TaskStatus } from '@/contexts/PlanContext';

const STATUS_OPTS: { key: TaskStatus; label: string; color: string }[] = [
  { key: 'not_started', label: 'Not Started', color: '#6B7280' },
  { key: 'in_progress', label: 'In Progress', color: '#3B82F6' },
  { key: 'waiting', label: 'Waiting', color: '#F59E0B' },
  { key: 'needs_review', label: 'Needs Review', color: '#A855F7' },
  { key: 'completed', label: 'Completed', color: '#10B981' },
];

const PRIORITY_OPTS: { key: Priority; label: string; color: string }[] = [
  { key: 'low', label: 'Low', color: '#6B7280' },
  { key: 'medium', label: 'Medium', color: '#3B82F6' },
  { key: 'high', label: 'High', color: '#F59E0B' },
  { key: 'critical', label: 'Critical', color: '#EF4444' },
];

export default function TasksTab() {
  const { plan, addTask, updateTask, deleteTask } = usePlan();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);

  const tasks = plan?.tasks || [];
  const filtered = filterStatus
    ? tasks.filter(t => t.status === filterStatus)
    : tasks;

  const handleAdd = () => {
    if (!title.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    addTask({ title: title.trim(), description: desc.trim(), priority });
    setTitle(''); setDesc(''); setPriority('medium'); setShowForm(false);
  };

  const handleStatusChange = (taskId: string, status: TaskStatus) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateTask(taskId, { status });
  };

  const handleDelete = (taskId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    deleteTask(taskId);
  };

  const statusCounts = STATUS_OPTS.map(s => ({
    ...s, count: tasks.filter(t => t.status === s.key).length,
  }));

  return (
    <View style={styles.container}>
      {/* Status Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={{ gap: 6, paddingHorizontal: 12 }}
      >
        <TouchableOpacity
          style={[styles.filterChip, !filterStatus && styles.filterChipActive]}
          onPress={() => setFilterStatus(null)}
        >
          <Text style={[styles.filterText, !filterStatus && styles.filterTextActive]}>
            All ({tasks.length})
          </Text>
        </TouchableOpacity>
        {statusCounts.map(s => (
          <TouchableOpacity
            key={s.key}
            style={[styles.filterChip, filterStatus === s.key && { borderColor: s.color }]}
            onPress={() => setFilterStatus(filterStatus === s.key ? null : s.key)}
          >
            <Circle size={8} color={s.color} fill={s.color} />
            <Text style={styles.filterText}>{s.label} ({s.count})</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

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
          />
          <TextInput
            style={[styles.formInput, styles.formTextarea]}
            value={desc}
            onChangeText={setDesc}
            placeholder="Description (optional)"
            placeholderTextColor="#6B7280"
            multiline numberOfLines={2}
            textAlignVertical="top"
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
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForm(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, !title.trim() && { opacity: 0.5 }]}
              onPress={handleAdd}
            >
              <Text style={styles.submitText}>Add Task</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Task List */}
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Check size={36} color="#4B5563" />
            <Text style={styles.emptyTitle}>
              {filterStatus ? `No ${STATUS_OPTS.find(s => s.key === filterStatus)?.label} tasks` : 'No tasks yet'}
            </Text>
            <Text style={styles.emptySub}>Add tasks to start tracking progress</Text>
          </View>
        ) : (
          filtered.map(task => {
            const status = STATUS_OPTS.find(s => s.key === task.status);
            const priorityMeta = PRIORITY_OPTS.find(p => p.key === task.priority);
            const isCompleted = task.status === 'completed';
            return (
              <TouchableOpacity
                key={task.id}
                style={[styles.taskCard, isCompleted && styles.taskCardDone]}
                onPress={() => setEditingTask(task)}
                activeOpacity={0.8}
              >
                <View style={styles.taskHeader}>
                  <TouchableOpacity
                    style={[styles.checkbox, isCompleted && { backgroundColor: '#10B981', borderColor: '#10B981' }]}
                    onPress={() => handleStatusChange(task.id, isCompleted ? 'not_started' : 'completed')}
                  >
                    {isCompleted && <Check size={12} color="#FFF" />}
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.taskTitle, isCompleted && styles.taskTitleDone]}>
                      {task.title}
                    </Text>
                    {task.description ? (
                      <Text style={[styles.taskDesc, isCompleted && styles.taskDescDone]} numberOfLines={2}>
                        {task.description}
                      </Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(task.id)}
                  >
                    <Trash2 size={14} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                <View style={styles.taskMeta}>
                  {priorityMeta && (
                    <View style={[styles.metaChip, { backgroundColor: priorityMeta.color + '20' }]}>
                      <Text style={[styles.metaText, { color: priorityMeta.color }]}>{priorityMeta.label}</Text>
                    </View>
                  )}
                  {status && (
                    <View style={[styles.metaChip, { backgroundColor: status.color + '20' }]}>
                      <Circle size={6} color={status.color} fill={status.color} />
                      <Text style={[styles.metaText, { color: status.color }]}>{status.label}</Text>
                    </View>
                  )}
                  {task.assignedTo && (
                    <View style={styles.metaChip}>
                      <User size={10} color="#9CA3AF" />
                      <Text style={styles.metaText}>{task.assignedTo}</Text>
                    </View>
                  )}
                  {task.dueDate && (
                    <View style={styles.metaChip}>
                      <Clock size={10} color="#F59E0B" />
                      <Text style={styles.metaText}>{task.dueDate}</Text>
                    </View>
                  )}
                </View>

                {/* Quick status change buttons */}
                {editingTask?.id === task.id && (
                  <View style={styles.editPanel}>
                    <Text style={styles.editPanelLabel}>Change status:</Text>
                    <View style={styles.statusRow}>
                      {STATUS_OPTS.map(s => (
                        <TouchableOpacity
                          key={s.key}
                          style={[
                            styles.statusChip,
                            task.status === s.key && { backgroundColor: s.color + '30', borderColor: s.color },
                          ]}
                          onPress={() => handleStatusChange(task.id, s.key)}
                        >
                          <Text style={[styles.statusText, { color: s.color }]}>{s.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <View style={styles.field}>
                      <Text style={styles.fieldLabel}>Assigned To</Text>
                      <TextInput
                        style={styles.fieldInput}
                        value={task.assignedTo || ''}
                        onChangeText={(v) => updateTask(task.id, { assignedTo: v })}
                        placeholder="Name"
                        placeholderTextColor="#6B7280"
                      />
                    </View>
                    <View style={styles.field}>
                      <Text style={styles.fieldLabel}>Due Date</Text>
                      <TextInput
                        style={styles.fieldInput}
                        value={task.dueDate || ''}
                        onChangeText={(v) => updateTask(task.id, { dueDate: v })}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor="#6B7280"
                      />
                    </View>
                    <TouchableOpacity
                      style={styles.doneEditBtn}
                      onPress={() => setEditingTask(null)}
                    >
                      <Text style={styles.doneEditText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
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
  // Filter
  filterScroll: { paddingVertical: 10 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 16, backgroundColor: '#1F2937', borderWidth: 1,
    borderColor: 'transparent',
  },
  filterChipActive: { backgroundColor: '#8B5CF6' },
  filterText: { color: '#9CA3AF', fontSize: 12, fontWeight: '600' },
  filterTextActive: { color: '#FFF' },
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
    gap: 10, marginHorizontal: 12, marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#111827', color: '#FFF', fontSize: 15,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10,
  },
  formTextarea: { minHeight: 60 },
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
    backgroundColor: '#1F2937', borderRadius: 14, padding: 14,
    marginHorizontal: 12, marginBottom: 8,
  },
  taskCardDone: { opacity: 0.6 },
  taskHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
    borderColor: '#4B5563', alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  taskTitle: { color: '#FFF', fontSize: 15, fontWeight: '600', flex: 1 },
  taskTitleDone: { textDecorationLine: 'line-through', color: '#6B7280' },
  taskDesc: { color: '#9CA3AF', fontSize: 13, marginTop: 3 },
  taskDescDone: { color: '#4B5563' },
  deleteBtn: { padding: 4 },
  taskMeta: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#374151', paddingHorizontal: 8,
    paddingVertical: 3, borderRadius: 8,
  },
  metaText: { color: '#9CA3AF', fontSize: 11, fontWeight: '500' },
  // Edit panel
  editPanel: {
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#374151', gap: 8,
  },
  editPanelLabel: { color: '#9CA3AF', fontSize: 12, fontWeight: '600' },
  statusRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  statusChip: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1, borderColor: 'transparent',
    backgroundColor: '#374151',
  },
  statusText: { fontSize: 11, fontWeight: '600' },
  field: { gap: 4 },
  fieldLabel: { color: '#6B7280', fontSize: 11, fontWeight: '600' },
  fieldInput: {
    backgroundColor: '#111827', color: '#FFF', fontSize: 14,
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8,
  },
  doneEditBtn: {
    backgroundColor: '#8B5CF6', paddingVertical: 8,
    borderRadius: 10, alignItems: 'center',
  },
  doneEditText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
});
