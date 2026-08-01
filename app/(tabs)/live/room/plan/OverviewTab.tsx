import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView,
} from 'react-native';
import { usePlan, PlanStage } from '@/contexts/PlanContext';
import { useTheme } from '@/contexts/ThemeContext';

const STAGES: { key: PlanStage; label: string; icon: string }[] = [
  { key: 'idea' as PlanStage, label: 'Idea', icon: '💡' },
  { key: 'build' as PlanStage, label: 'Build', icon: '🔨' },
  { key: 'assign' as PlanStage, label: 'Assign', icon: '👥' },
  { key: 'launch' as PlanStage, label: 'Launch', icon: '🚀' },
];

export default function OverviewTab() {
  const { plan, updatePlan } = usePlan();
  const { colors } = useTheme();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(plan?.title || '');
  const [goal, setGoal] = useState(plan?.goal || '');
  const [desc, setDesc] = useState(plan?.description || '');
  const [projectType, setProjectType] = useState(plan?.projectType || '');
  const [targetDate, setTargetDate] = useState(plan?.targetDate || '');

  if (!plan) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, { color: '#9CA3AF' }]}>No plan created yet</Text>
      </View>
    );
  }

  const stageIdx = STAGES.findIndex(s => s.key === plan.stage);

  const handleSave = () => {
    updatePlan({ title, goal, description: desc, projectType });
    setEditing(false);
  };

  const completedTasks = plan.tasks.filter(t => t.status === 'completed').length;
  const totalMembers = plan.members.length || 1;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* ── Stage Progress Tracker ── */}
      <View style={styles.stageTracker}>
        {STAGES.map((stage, i) => {
          const isActive = i <= stageIdx;
          const isCurrent = i === stageIdx;
          return (
            <View key={stage.key} style={styles.stageItem}>
              <View style={[
                styles.stageDot,
                { backgroundColor: isActive ? '#8B5CF6' : '#374151' },
                isCurrent && styles.stageDotCurrent,
              ]}>
                <Text style={styles.stageIcon}>{stage.icon}</Text>
              </View>
              <Text style={[styles.stageLabel, {
                color: isActive ? '#D1D5DB' : '#6B7280',
              }]}>
                {stage.label}
              </Text>
              {i < STAGES.length - 1 && (
                <View style={[
                  styles.stageLine,
                  { backgroundColor: i < stageIdx ? '#8B5CF6' : '#374151' },
                ]} />
              )}
            </View>
          );
        })}
      </View>

      {/* ── Progress Bar ── */}
      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text style={[styles.sectionLabel, { color: '#D1D5DB' }]}>Overall Progress</Text>
          <Text style={[styles.progressPct, { color: '#8B5CF6' }]}>{plan.progress}%</Text>
        </View>
        <View style={[styles.progressBar, { backgroundColor: '#374151' }]}>
          <View style={[styles.progressFill, { width: `${plan.progress}%` }]} />
        </View>
        <Text style={[styles.progressMeta, { color: '#6B7280' }]}>
          {completedTasks}/{plan.tasks.length} tasks · {totalMembers} member{totalMembers > 1 ? 's' : ''}
        </Text>
      </View>

      {/* ── Plan Info ── */}
      <View style={styles.section}>
        {editing ? (
          <>
            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: '#9CA3AF' }]}>Plan Title</Text>
              <TextInput
                style={[styles.fieldInput, {
                  backgroundColor: '#1F2937', color: '#FFF', borderColor: '#374151',
                }]}
                value={title} onChangeText={setTitle}
                placeholderTextColor="#6B7280" placeholder="Enter plan title"
              />
            </View>
            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: '#9CA3AF' }]}>Goal</Text>
              <TextInput
                style={[styles.fieldInput, {
                  backgroundColor: '#1F2937', color: '#FFF', borderColor: '#374151',
                }]}
                value={goal} onChangeText={setGoal}
                placeholderTextColor="#6B7280" placeholder="What's the goal?"
              />
            </View>
            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: '#9CA3AF' }]}>Description</Text>
              <TextInput
                style={[styles.fieldInput, styles.fieldTextarea, {
                  backgroundColor: '#1F2937', color: '#FFF', borderColor: '#374151',
                }]}
                value={desc} onChangeText={setDesc}
                placeholderTextColor="#6B7280" placeholder="Describe the project..."
                multiline numberOfLines={3} textAlignVertical="top"
              />
            </View>
            <View style={styles.fieldRow}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={[styles.fieldLabel, { color: '#9CA3AF' }]}>Type</Text>
                <TextInput
                  style={[styles.fieldInput, {
                    backgroundColor: '#1F2937', color: '#FFF', borderColor: '#374151',
                  }]}
                  value={projectType} onChangeText={setProjectType}
                  placeholderTextColor="#6B7280" placeholder="e.g. Product Launch"
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={[styles.fieldLabel, { color: '#9CA3AF' }]}>Target Date</Text>
                <TextInput
                  style={[styles.fieldInput, {
                    backgroundColor: '#1F2937', color: '#FFF', borderColor: '#374151',
                  }]}
                  value={targetDate} onChangeText={setTargetDate}
                  placeholderTextColor="#6B7280" placeholder="YYYY-MM-DD"
                />
              </View>
            </View>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity onPress={() => setEditing(true)}>
              <Text style={[styles.editHint, { color: '#8B5CF6' }]}>Tap to edit</Text>
            </TouchableOpacity>
            <View style={styles.infoBlock}>
              <Text style={[styles.infoTitle, { color: '#FFF' }]}>
                {plan.title || 'Untitled Plan'}
              </Text>
              {plan.goal ? (
                <View style={styles.infoRow}>
                  <Text style={[styles.infoKey, { color: '#9CA3AF' }]}>Goal</Text>
                  <Text style={[styles.infoVal, { color: '#D1D5DB' }]}>{plan.goal}</Text>
                </View>
              ) : null}
              {plan.description ? (
                <View style={styles.infoRow}>
                  <Text style={[styles.infoKey, { color: '#9CA3AF' }]}>Description</Text>
                  <Text style={[styles.infoVal, { color: '#D1D5DB' }]}>{plan.description}</Text>
                </View>
              ) : null}
              {plan.projectType ? (
                <View style={styles.infoRow}>
                  <Text style={[styles.infoKey, { color: '#9CA3AF' }]}>Type</Text>
                  <Text style={[styles.infoVal, { color: '#D1D5DB' }]}>{plan.projectType}</Text>
                </View>
              ) : null}
              {plan.targetDate ? (
                <View style={styles.infoRow}>
                  <Text style={[styles.infoKey, { color: '#9CA3AF' }]}>Target</Text>
                  <Text style={[styles.infoVal, { color: '#D1D5DB' }]}>{plan.targetDate}</Text>
                </View>
              ) : null}
            </View>
          </>
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { fontSize: 15 },
  // Stage Tracker
  stageTracker: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center',
    paddingVertical: 16, marginBottom: 16,
  },
  stageItem: { alignItems: 'center', position: 'relative', width: 72 },
  stageDot: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  stageDotCurrent: {
    borderWidth: 2, borderColor: '#A78BFA',
    shadowColor: '#8B5CF6', shadowOpacity: 0.5, shadowRadius: 8,
  },
  stageIcon: { fontSize: 16 },
  stageLabel: { fontSize: 10, fontWeight: '600', marginTop: 6 },
  stageLine: {
    position: 'absolute', top: 20, left: 56, width: 32, height: 2,
  },
  // Progress
  progressSection: { marginBottom: 20 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  sectionLabel: { fontSize: 13, fontWeight: '600' },
  progressPct: { fontSize: 14, fontWeight: '700' },
  progressBar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: '#8B5CF6' },
  progressMeta: { fontSize: 12, marginTop: 6 },
  // Info
  section: { gap: 14 },
  editHint: { fontSize: 13, fontWeight: '600', marginBottom: 4, alignSelf: 'flex-end' },
  infoBlock: { gap: 12 },
  infoTitle: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  infoRow: { gap: 4 },
  infoKey: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  infoVal: { fontSize: 15, lineHeight: 21 },
  // Edit fields
  field: { gap: 4 },
  fieldRow: { flexDirection: 'row', gap: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  fieldInput: {
    fontSize: 15, paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1,
  },
  fieldTextarea: { minHeight: 80 },
  saveBtn: {
    backgroundColor: '#8B5CF6', paddingVertical: 12,
    borderRadius: 12, alignItems: 'center', marginTop: 8,
  },
  saveBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
});
