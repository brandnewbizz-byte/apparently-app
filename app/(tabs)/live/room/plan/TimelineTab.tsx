import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Plus, Calendar, Flag, Target, Users, Rocket, Clock, Check } from 'lucide-react-native';
import { usePlan, TimelineItem } from '@/contexts/PlanContext';

const TYPE_META: Record<string, { icon: any; color: string }> = {
  stage: { icon: Flag, color: '#8B5CF6' },
  task: { icon: Check, color: '#3B82F6' },
  milestone: { icon: Target, color: '#F59E0B' },
  deadline: { icon: Clock, color: '#EF4444' },
  meeting: { icon: Users, color: '#10B981' },
  launch: { icon: Rocket, color: '#A855F7' },
};

const TYPES = Object.keys(TYPE_META);

export default function TimelineTab() {
  const { plan, addTimelineItem, updateTimelineItem } = usePlan();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('task');
  const [date, setDate] = useState('');
  const [desc, setDesc] = useState('');

  const items = plan?.timeline || [];
  const sorted = [...items].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const handleAdd = () => {
    if (!title.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    addTimelineItem({
      title: title.trim(),
      type: type as TimelineItem['type'],
      date: date || new Date().toISOString().split('T')[0],
      description: desc.trim(),
    });
    setTitle(''); setType('task'); setDate(''); setDesc('');
    setShowForm(false);
  };

  const handleToggle = (id: string, completed: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateTimelineItem(id, { completed: !completed });
  };

  return (
    <View style={styles.container}>
      {!showForm && (
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(true)}>
          <Plus size={16} color="#FFF" />
          <Text style={styles.addBtnText}>Add Item</Text>
        </TouchableOpacity>
      )}

      {showForm && (
        <View style={styles.formCard}>
          <TextInput
            style={styles.formInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Title"
            placeholderTextColor="#6B7280"
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll}>
            {TYPES.map(t => {
              const meta = TYPE_META[t];
              const Icon = meta.icon;
              return (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeChip, type === t && { backgroundColor: meta.color + '30', borderColor: meta.color }]}
                  onPress={() => setType(t)}
                >
                  <Icon size={12} color={meta.color} />
                  <Text style={[styles.typeLabel, { color: meta.color }]}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={styles.formRow}>
            <TextInput
              style={[styles.formInput, { flex: 1 }]}
              value={date}
              onChangeText={setDate}
              placeholder="Date (YYYY-MM-DD)"
              placeholderTextColor="#6B7280"
            />
          </View>
          <TextInput
            style={[styles.formInput, styles.formTextarea]}
            value={desc}
            onChangeText={setDesc}
            placeholder="Description (optional)"
            placeholderTextColor="#6B7280"
            multiline numberOfLines={2}
            textAlignVertical="top"
          />
          <View style={styles.formActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForm(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, !title.trim() && { opacity: 0.5 }]}
              onPress={handleAdd}
            >
              <Text style={styles.submitText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {sorted.length === 0 ? (
          <View style={styles.empty}>
            <Calendar size={36} color="#4B5563" />
            <Text style={styles.emptyTitle}>Timeline is empty</Text>
            <Text style={styles.emptySub}>Add milestones, deadlines, and events</Text>
          </View>
        ) : (
          <View style={styles.timelineTrack}>
            {sorted.map((item, i) => {
              const meta = TYPE_META[item.type] || TYPE_META.task;
              const Icon = meta.icon;
              return (
                <View key={item.id} style={styles.timelineItem}>
                  <View style={styles.timelineLine}>
                    <TouchableOpacity
                      style={[
                        styles.timelineDot,
                        { backgroundColor: item.completed ? '#10B981' : meta.color },
                      ]}
                      onPress={() => handleToggle(item.id, item.completed)}
                    >
                      <Icon size={12} color="#FFF" />
                    </TouchableOpacity>
                    {i < sorted.length - 1 && (
                      <View style={[
                        styles.timelineConnector,
                        { backgroundColor: '#374151' },
                      ]} />
                    )}
                  </View>
                  <View style={[
                    styles.timelineCard,
                    item.completed && styles.timelineCardDone,
                  ]}>
                    <View style={styles.timelineCardHeader}>
                      <Text style={[styles.timelineTitle, item.completed && styles.timelineTitleDone]}>
                        {item.title}
                      </Text>
                      <View style={[styles.timelineBadge, { backgroundColor: meta.color + '20' }]}>
                        <Text style={[styles.timelineBadgeText, { color: meta.color }]}>
                          {item.type}
                        </Text>
                      </View>
                    </View>
                    {item.date && (
                      <Text style={styles.timelineDate}>{item.date}</Text>
                    )}
                    {item.description ? (
                      <Text style={styles.timelineDesc}>{item.description}</Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#8B5CF6', paddingHorizontal: 16,
    paddingVertical: 10, borderRadius: 12, alignSelf: 'center',
    marginVertical: 8,
  },
  addBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  formCard: { backgroundColor: '#1F2937', borderRadius: 14, padding: 14, gap: 10, marginBottom: 10 },
  formInput: { backgroundColor: '#111827', color: '#FFF', fontSize: 15, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  formTextarea: { minHeight: 60 },
  typeScroll: { marginVertical: 2 },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: 'transparent', backgroundColor: '#374151', marginRight: 6 },
  typeLabel: { fontSize: 11, fontWeight: '600' },
  formRow: { flexDirection: 'row', gap: 8 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  cancelBtn: { paddingVertical: 8, paddingHorizontal: 14 },
  cancelText: { color: '#9CA3AF', fontSize: 14, fontWeight: '600' },
  submitBtn: { backgroundColor: '#8B5CF6', paddingVertical: 8, paddingHorizontal: 20, borderRadius: 10 },
  submitText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  list: { flex: 1 },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { color: '#9CA3AF', fontSize: 16, fontWeight: '600' },
  emptySub: { color: '#6B7280', fontSize: 13 },
  timelineTrack: { paddingLeft: 10 },
  timelineItem: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  timelineLine: { alignItems: 'center', width: 32 },
  timelineDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  timelineConnector: { width: 2, flex: 1, minHeight: 20 },
  timelineCard: { backgroundColor: '#1F2937', borderRadius: 12, padding: 12, flex: 1, marginBottom: 10 },
  timelineCardDone: { opacity: 0.5 },
  timelineCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timelineTitle: { color: '#FFF', fontSize: 14, fontWeight: '600', flex: 1 },
  timelineTitleDone: { textDecorationLine: 'line-through' },
  timelineBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  timelineBadgeText: { fontSize: 10, fontWeight: '600' },
  timelineDate: { color: '#6B7280', fontSize: 11, fontWeight: '500', marginTop: 4 },
  timelineDesc: { color: '#9CA3AF', fontSize: 13, marginTop: 4 },
});
