import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  CheckCircle2, Clock, AlertTriangle, TrendingUp, TrendingDown,
  Users, Calendar, Target, Flag, BarChart3, Edit2, DollarSign,
  ListTodo, Paperclip, ArrowRight, ChevronRight,
} from 'lucide-react-native';
import { usePlan, PlanStage } from '@/contexts/PlanContext';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_GAP = 10;

const STAGES: { key: PlanStage; label: string; icon: string; color: string }[] = [
  { key: 'idea' as PlanStage, label: 'Idea', icon: '💡', color: '#F59E0B' },
  { key: 'build' as PlanStage, label: 'Build', icon: '🔨', color: '#3B82F6' },
  { key: 'assign' as PlanStage, label: 'Assign', icon: '👥', color: '#8B5CF6' },
  { key: 'launch' as PlanStage, label: 'Launch', icon: '🚀', color: '#10B981' },
];

function daysBetween(d1: string, d2: string): number {
  if (!d1 || !d2) return 0;
  const a = new Date(d1), b = new Date(d2);
  return Math.ceil((b.getTime() - a.getTime()) / 86400000);
}

function statusColor(status: string): string {
  switch (status) {
    case 'completed': return '#10B981';
    case 'in_progress': return '#3B82F6';
    case 'waiting': return '#F59E0B';
    case 'needs_review': return '#A855F7';
    default: return '#6B7280';
  }
}

export default function OverviewTab() {
  const { plan, updatePlan } = usePlan();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(plan?.title || '');
  const [goal, setGoal] = useState(plan?.goal || '');
  const [desc, setDesc] = useState(plan?.description || '');
  const [projectType, setProjectType] = useState(plan?.projectType || '');
  const [targetDate, setTargetDate] = useState(plan?.targetDate || '');

  const metrics = useMemo(() => {
    if (!plan) return null;
    const tasks = plan.tasks;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const overdue = tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'completed').length;
    const totalSpent = plan.budget?.items?.reduce((s, i) => s + i.actualCost, 0) || 0;
    const totalBudget = plan.budget?.total || 0;
    const budgetVariance = totalBudget > 0 ? Math.round(((totalSpent - totalBudget) / totalBudget) * 100) : 0;
    const daysRemaining = targetDate ? daysBetween(new Date().toISOString().split('T')[0], targetDate) : null;
    const stageIdx = STAGES.findIndex(s => s.key === plan.stage);

    let health: 'on_track' | 'at_risk' | 'delayed' = 'on_track';
    if (overdue > 0) health = 'at_risk';
    if (daysRemaining !== null && daysRemaining < 0) health = 'delayed';
    if (totalBudget > 0 && totalSpent > totalBudget * 1.1) health = 'at_risk';

    return {
      completed, inProgress, total: tasks.length, overdue,
      totalSpent, totalBudget, budgetVariance,
      daysRemaining, health, stageIdx,
      milestones: plan.timeline?.filter(t => t.type === 'milestone') || [],
      ideas: plan.ideas?.length || 0,
      files: plan.files?.length || 0,
    };
  }, [plan, targetDate]);

  if (!plan) {
    return (
      <View style={styles.emptyContainer}>
        <BarChart3 size={48} color="#374151" />
        <Text style={styles.emptyText}>No plan dashboard available</Text>
        <Text style={styles.emptySub}>Create a plan from the room to get started</Text>
      </View>
    );
  }

  const m = metrics;
  if (!m) return null;

  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updatePlan({ title, goal, description: desc, projectType, targetDate });
    setEditing(false);
  };

  const stage = STAGES.find(s => s.key === plan.stage);
  const healthCfg = {
    on_track: { label: 'On Track', color: '#10B981', bg: 'rgba(16,185,129,0.10)', dot: '#10B981' },
    at_risk: { label: 'At Risk', color: '#F59E0B', bg: 'rgba(245,158,11,0.10)', dot: '#F59E0B' },
    delayed: { label: 'Delayed', color: '#EF4444', bg: 'rgba(239,68,68,0.10)', dot: '#EF4444' },
  };

  const h = healthCfg[m.health];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

      {/* ── Stage Banner ── */}
      <LinearGradient
        colors={['#1F2937', '#111827']}
        style={styles.stageBanner}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
      >
        <View style={styles.stageRow}>
          <View style={[styles.stageBadge, { backgroundColor: stage?.color + '20' }]}>
            <Text style={styles.stageBadgeIcon}>{stage?.icon || '📋'}</Text>
            <Text style={[styles.stageBadgeText, { color: stage?.color }]}>{stage?.label || 'Planning'}</Text>
          </View>
          <View style={[styles.healthPill, { backgroundColor: h.bg }]}>
            <View style={[styles.healthDot, { backgroundColor: h.dot }]} />
            <Text style={[styles.healthText, { color: h.color }]}>{h.label}</Text>
          </View>
        </View>
        <Text style={styles.bannerTitle}>{plan.title || 'Untitled Plan'}</Text>
        {plan.goal ? (
          <View style={styles.goalRow}>
            <Target size={13} color="#8B5CF6" />
            <Text style={styles.goalText} numberOfLines={2}>{plan.goal}</Text>
          </View>
        ) : null}
      </LinearGradient>

      {/* ── Stage Tracker ── */}
      <View style={styles.trackerCard}>
        <Text style={styles.cardLabel}>STAGE PROGRESS</Text>
        <View style={styles.stageTracker}>
          {STAGES.map((s, i) => {
            const done = i < (m.stageIdx ?? 0);
            const active = i === (m.stageIdx ?? 0);
            return (
              <React.Fragment key={s.key}>
                <View style={styles.stageItem}>
                  <View style={[
                    styles.stageCircle,
                    done && { backgroundColor: s.color, borderColor: s.color },
                    active && { backgroundColor: s.color + '20', borderColor: s.color, borderWidth: 2 },
                    !done && !active && { backgroundColor: '#1F2937', borderColor: '#374151' },
                  ]}>
                    {done ? (
                      <CheckCircle2 size={16} color="#FFF" />
                    ) : (
                      <Text style={styles.stageIcon}>{s.icon}</Text>
                    )}
                  </View>
                  <Text style={[
                    styles.stageLabel,
                    done && { color: s.color },
                    active && { color: '#FFF', fontWeight: '700' },
                    !done && !active && { color: '#4B5563' },
                  ]}>
                    {s.label}
                  </Text>
                </View>
                {i < 3 && (
                  <View style={[styles.stageBridge, { backgroundColor: done ? s.color : '#1F2937' }]} />
                )}
              </React.Fragment>
            );
          })}
        </View>
      </View>

      {/* ── KPI Grid ── */}
      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <View style={[styles.kpiIconBox, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
            <ListTodo size={17} color="#3B82F6" />
          </View>
          <Text style={styles.kpiValue}>
            <Text style={{ color: '#3B82F6' }}>{m.completed}</Text>
            <Text style={{ color: '#4B5563', fontSize: 16 }}>/{m.total}</Text>
          </Text>
          <Text style={styles.kpiLabel}>Tasks Done</Text>
        </View>
        <View style={styles.kpiCard}>
          <View style={[styles.kpiIconBox, { backgroundColor: 'rgba(139,92,246,0.12)' }]}>
            <DollarSign size={17} color="#8B5CF6" />
          </View>
          <Text style={styles.kpiValue}>
            <Text style={{ color: m.budgetVariance > 0 ? '#EF4444' : '#8B5CF6' }}>
              ${m.totalSpent.toLocaleString()}
            </Text>
          </Text>
          <Text style={styles.kpiLabel}>
            of ${m.totalBudget.toLocaleString() || '0'}
          </Text>
        </View>
        <View style={styles.kpiCard}>
          <View style={[styles.kpiIconBox, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
            <Calendar size={17} color="#10B981" />
          </View>
          <Text style={styles.kpiValue}>
            <Text style={{ color: m.daysRemaining !== null && m.daysRemaining < 0 ? '#EF4444' : '#10B981' }}>
              {m.daysRemaining !== null ? Math.abs(m.daysRemaining) : '—'}
            </Text>
          </Text>
          <Text style={styles.kpiLabel}>
            {m.daysRemaining !== null ? (m.daysRemaining >= 0 ? 'Days Left' : 'Days Overdue') : 'No deadline'}
          </Text>
        </View>
        <View style={styles.kpiCard}>
          <View style={[styles.kpiIconBox, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
            <AlertTriangle size={17} color="#F59E0B" />
          </View>
          <Text style={styles.kpiValue}>
            <Text style={{ color: m.overdue > 0 ? '#EF4444' : '#4B5563' }}>{m.overdue}</Text>
          </Text>
          <Text style={styles.kpiLabel}>Overdue</Text>
        </View>
      </View>

      {/* ── Progress Bar ── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Task Completion</Text>
          <Text style={[styles.cardPct, { color: '#8B5CF6' }]}>{plan.progress}%</Text>
        </View>
        <View style={styles.progressBar}>
          <LinearGradient
            colors={['#8B5CF6', '#6366F1']}
            style={[styles.progressFill, { width: `${plan.progress}%` }]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          />
        </View>
        <View style={styles.progressStats}>
          <View style={styles.progressStat}>
            <View style={[styles.statDot, { backgroundColor: '#10B981' }]} />
            <Text style={styles.progressStatText}>{m.completed} Done</Text>
          </View>
          <View style={styles.progressStat}>
            <View style={[styles.statDot, { backgroundColor: '#3B82F6' }]} />
            <Text style={styles.progressStatText}>{m.inProgress} Active</Text>
          </View>
          <View style={styles.progressStat}>
            <View style={[styles.statDot, { backgroundColor: '#6B7280' }]} />
            <Text style={styles.progressStatText}>{m.total - m.completed - m.inProgress} Todo</Text>
          </View>
        </View>
      </View>

      {/* ── Quick Stats Row ── */}
      <View style={styles.quickStats}>
        <View style={styles.quickStatCard}>
          <Users size={15} color="#9CA3AF" />
          <Text style={styles.quickStatVal}>{plan.members.length || 1}</Text>
          <Text style={styles.quickStatLabel}>Members</Text>
        </View>
        <View style={styles.quickStatCard}>
          <Flag size={15} color="#9CA3AF" />
          <Text style={styles.quickStatVal}>{m.milestones.length}</Text>
          <Text style={styles.quickStatLabel}>Milestones</Text>
        </View>
        <View style={styles.quickStatCard}>
          <Paperclip size={15} color="#9CA3AF" />
          <Text style={styles.quickStatVal}>{m.files}</Text>
          <Text style={styles.quickStatLabel}>Files</Text>
        </View>
        <View style={styles.quickStatCard}>
          <Target size={15} color="#9CA3AF" />
          <Text style={styles.quickStatVal}>{m.ideas}</Text>
          <Text style={styles.quickStatLabel}>Ideas</Text>
        </View>
      </View>

      {/* ── Plan Details ── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Plan Details</Text>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => {
              setTitle(plan.title || '');
              setGoal(plan.goal || '');
              setDesc(plan.description || '');
              setProjectType(plan.projectType || '');
              setTargetDate(plan.targetDate || '');
              setEditing(true);
            }}
          >
            <Edit2 size={13} color="#8B5CF6" />
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
        </View>

        {editing ? (
          <View style={styles.editForm}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>TITLE</Text>
              <TextInput
                style={styles.fieldInput}
                value={title} onChangeText={setTitle}
                placeholderTextColor="#6B7280" placeholder="Project title"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>GOAL</Text>
              <TextInput
                style={styles.fieldInput}
                value={goal} onChangeText={setGoal}
                placeholderTextColor="#6B7280" placeholder="What are we building?"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>DESCRIPTION</Text>
              <TextInput
                style={[styles.fieldInput, styles.fieldTextarea]}
                value={desc} onChangeText={setDesc}
                placeholderTextColor="#6B7280" placeholder="Describe the project scope and objectives..."
                multiline numberOfLines={3} textAlignVertical="top"
              />
            </View>
            <View style={styles.fieldRow}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>TYPE</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={projectType} onChangeText={setProjectType}
                  placeholderTextColor="#6B7280" placeholder="Product Launch"
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>TARGET DATE</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={targetDate} onChangeText={setTargetDate}
                  placeholderTextColor="#6B7280" placeholder="YYYY-MM-DD"
                />
              </View>
            </View>
            <View style={styles.editActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.detailGrid}>
            {plan.goal ? (
              <View style={styles.detailItem}>
                <Text style={styles.detailKey}>Goal</Text>
                <Text style={styles.detailVal}>{plan.goal}</Text>
              </View>
            ) : null}
            {plan.description ? (
              <View style={styles.detailItem}>
                <Text style={styles.detailKey}>Description</Text>
                <Text style={styles.detailVal}>{plan.description}</Text>
              </View>
            ) : null}
            <View style={styles.detailRow}>
              {plan.projectType ? (
                <View style={[styles.detailItem, { flex: 1 }]}>
                  <Text style={styles.detailKey}>Type</Text>
                  <Text style={[styles.detailVal, { color: '#8B5CF6' }]}>{plan.projectType}</Text>
                </View>
              ) : null}
              {plan.targetDate ? (
                <View style={[styles.detailItem, { flex: 1 }]}>
                  <Text style={styles.detailKey}>Target</Text>
                  <Text style={[styles.detailVal, { color: '#10B981' }]}>{plan.targetDate}</Text>
                </View>
              ) : null}
            </View>
          </View>
        )}
      </View>

      {/* ── Budget Variance Alert ── */}
      {m.totalBudget > 0 && Math.abs(m.budgetVariance) >= 5 && (
        <View style={[styles.alertCard, { backgroundColor: m.budgetVariance > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {m.budgetVariance > 0 ? (
              <TrendingUp size={18} color="#EF4444" />
            ) : (
              <TrendingDown size={18} color="#10B981" />
            )}
            <Text style={[styles.alertText, { color: m.budgetVariance > 0 ? '#FCA5A5' : '#6EE7B7' }]}>
              Budget is {m.budgetVariance > 0 ? 'over' : 'under'} by {Math.abs(m.budgetVariance)}%
              {m.budgetVariance > 0 ? ' — review expenses' : ' — great job!'}
            </Text>
          </View>
        </View>
      )}

      {/* ── Upcoming Milestones ── */}
      {m.milestones.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Upcoming Milestones</Text>
            <ChevronRight size={16} color="#6B7280" />
          </View>
          {m.milestones.filter(t => !t.completed).slice(0, 3).map(item => (
            <View key={item.id} style={styles.milestoneRow}>
              <Flag size={14} color="#F59E0B" />
              <View style={{ flex: 1 }}>
                <Text style={styles.milestoneTitle}>{item.title}</Text>
                {item.date && <Text style={styles.milestoneDate}>{item.date}</Text>}
              </View>
              <ArrowRight size={14} color="#4B5563" />
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 14, gap: CARD_GAP },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 },
  emptyText: { color: '#9CA3AF', fontSize: 16, fontWeight: '600' },
  emptySub: { color: '#6B7280', fontSize: 13 },

  // Stage Banner
  stageBanner: {
    borderRadius: 16, padding: 18, gap: 10,
    borderWidth: 1, borderColor: '#1F2937',
  },
  stageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stageBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
  },
  stageBadgeIcon: { fontSize: 14 },
  stageBadgeText: { fontSize: 12, fontWeight: '700' },
  healthPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
  },
  healthDot: { width: 7, height: 7, borderRadius: 4 },
  healthText: { fontSize: 12, fontWeight: '700' },
  bannerTitle: { color: '#FFF', fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  goalRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  goalText: { color: '#A78BFA', fontSize: 13, fontWeight: '500', flex: 1, lineHeight: 18 },

  // Stage Tracker
  trackerCard: {
    backgroundColor: '#111827', borderRadius: 14, borderWidth: 1,
    borderColor: '#1F2937', padding: 16,
  },
  cardLabel: { color: '#6B7280', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 14 },
  stageTracker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  stageItem: { alignItems: 'center', gap: 6 },
  stageCircle: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
  },
  stageIcon: { fontSize: 15 },
  stageLabel: { fontSize: 10, fontWeight: '600' },
  stageBridge: { width: 32, height: 2, marginHorizontal: 2, marginBottom: 22 },

  // KPI Grid
  kpiGrid: { flexDirection: 'row', gap: CARD_GAP },
  kpiCard: {
    flex: 1, backgroundColor: '#111827', borderRadius: 14,
    borderWidth: 1, borderColor: '#1F2937', padding: 12, gap: 6,
  },
  kpiIconBox: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  kpiValue: { fontSize: 18, fontWeight: '800' },
  kpiLabel: { color: '#6B7280', fontSize: 10, fontWeight: '600' },

  // Card
  card: {
    backgroundColor: '#111827', borderRadius: 14,
    borderWidth: 1, borderColor: '#1F2937', padding: 16,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  cardTitle: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  cardPct: { fontSize: 18, fontWeight: '800' },

  // Progress
  progressBar: {
    height: 10, borderRadius: 5, backgroundColor: '#1F2937',
    overflow: 'hidden',
  },
  progressFill: { height: 10, borderRadius: 5 },
  progressStats: {
    flexDirection: 'row', gap: 16, marginTop: 12,
    paddingTop: 12, borderTopWidth: 1, borderTopColor: '#1F2937',
  },
  progressStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statDot: { width: 8, height: 8, borderRadius: 4 },
  progressStatText: { color: '#9CA3AF', fontSize: 12, fontWeight: '600' },

  // Quick Stats
  quickStats: { flexDirection: 'row', gap: CARD_GAP },
  quickStatCard: {
    flex: 1, backgroundColor: '#111827', borderRadius: 14,
    borderWidth: 1, borderColor: '#1F2937', padding: 12,
    alignItems: 'center', gap: 4,
  },
  quickStatVal: { color: '#D1D5DB', fontSize: 16, fontWeight: '700' },
  quickStatLabel: { color: '#6B7280', fontSize: 9, fontWeight: '600' },

  // Details
  detailGrid: { gap: 12 },
  detailItem: { gap: 4 },
  detailRow: { flexDirection: 'row', gap: 16 },
  detailKey: { color: '#6B7280', fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  detailVal: { color: '#D1D5DB', fontSize: 14, fontWeight: '500', lineHeight: 20 },

  // Edit
  editButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editText: { color: '#8B5CF6', fontSize: 12, fontWeight: '600' },
  editForm: { gap: 10 },
  field: { gap: 4 },
  fieldRow: { flexDirection: 'row', gap: 10 },
  fieldLabel: { color: '#6B7280', fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  fieldInput: {
    backgroundColor: '#1F2937', color: '#FFF', fontSize: 14,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: '#374151',
  },
  fieldTextarea: { minHeight: 80 },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  cancelText: { color: '#9CA3AF', fontSize: 14, fontWeight: '600' },
  saveBtn: {
    backgroundColor: '#8B5CF6', paddingVertical: 10,
    paddingHorizontal: 20, borderRadius: 10,
  },
  saveBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },

  // Alert
  alertCard: {
    borderRadius: 14, padding: 14, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  alertText: { flex: 1, fontSize: 13, fontWeight: '600' },

  // Milestones
  milestoneRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#1F2937',
  },
  milestoneTitle: { color: '#D1D5DB', fontSize: 13, fontWeight: '600' },
  milestoneDate: { color: '#6B7280', fontSize: 11, fontWeight: '500', marginTop: 2 },
});
