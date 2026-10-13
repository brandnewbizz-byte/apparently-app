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
import { useTheme } from '@/contexts/ThemeContext';

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
  const theme = useTheme();
  const isLight = theme.colors.background === '#FFFFFF';

  const colors = {
    bg: theme.colors.background,
    surface: theme.colors.surface || theme.colors.backgroundSecondary,
    surfaceAlt: theme.colors.backgroundTertiary,
    text: theme.colors.text,
    textSecondary: theme.colors.textSecondary,
    textTertiary: theme.colors.textTertiary,
    border: theme.colors.border,
    inputBg: theme.colors.backgroundTertiary,
    accent: theme.colors.accent,
    // Live-specific shades (not in theme, so compute from mode)
    bannerGradient: (isLight ? ['#F8F9FA', '#F0F0F0'] : ['#1F2937', '#111827']) as readonly [string, string, ...string[]],
    bannerBorder: isLight ? '#E5E5E5' : '#1F2937',
    bannerTitle: isLight ? '#1A1A1A' : '#FFF',
    stageCircleInactive: isLight ? '#E5E5E5' : '#1F2937',
    stageCircleBorder: isLight ? '#D1D5DB' : '#374151',
    stageLabelActive: isLight ? '#1A1A1A' : '#FFF',
    stageBridgeInactive: isLight ? '#E5E5E5' : '#1F2937',
    stageBridgeDone: isLight ? '#D1D5DB' : '#1F2937',
    progressBg: isLight ? '#E5E5E5' : '#1F2937',
    statDotTodo: isLight ? '#9CA3AF' : '#6B7280',
    textMuted: isLight ? '#8E8E8E' : '#6B7280',
    tabTextInactive: isLight ? '#9CA3AF' : '#4B5563',
  };

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
        <BarChart3 size={48} color={colors.textTertiary} />
        <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No plan dashboard available</Text>
        <Text style={[styles.emptySub, { color: colors.textSecondary }]}>Create a plan from the room to get started</Text>
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
        colors={colors.bannerGradient}
        style={[styles.stageBanner, { borderColor: colors.bannerBorder }]}
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
        <Text style={[styles.bannerTitle, { color: colors.bannerTitle }]}>{plan.title || 'Untitled Plan'}</Text>
        {plan.goal ? (
          <View style={styles.goalRow}>
            <Target size={13} color="#8B5CF6" />
            <Text style={[styles.goalText, { color: isLight ? '#6B7280' : '#A78BFA' }]} numberOfLines={2}>{plan.goal}</Text>
          </View>
        ) : null}
      </LinearGradient>

      {/* ── Stage Tracker ── */}
      <View style={[styles.trackerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardLabel, { color: colors.textMuted }]}>STAGE PROGRESS</Text>
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
                    !done && !active && { backgroundColor: colors.stageCircleInactive, borderColor: colors.stageCircleBorder },
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
                    active && { color: colors.stageLabelActive, fontWeight: '700' },
                    !done && !active && { color: colors.tabTextInactive },
                  ]}>
                    {s.label}
                  </Text>
                </View>
                {i < 3 && (
                  <View style={[styles.stageBridge, { backgroundColor: done ? s.color : colors.stageBridgeInactive }]} />
                )}
              </React.Fragment>
            );
          })}
        </View>
      </View>

      {/* ── KPI Grid ── */}
      <View style={styles.kpiGrid}>
        <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.kpiIconBox, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
            <ListTodo size={17} color="#3B82F6" />
          </View>
          <Text style={[styles.kpiValue, { color: colors.text }]}>
            <Text style={{ color: '#3B82F6' }}>{m.completed}</Text>
            <Text style={{ color: colors.textTertiary, fontSize: 16 }}>/{m.total}</Text>
          </Text>
          <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Tasks Done</Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.kpiIconBox, { backgroundColor: 'rgba(139,92,246,0.12)' }]}>
            <DollarSign size={17} color="#8B5CF6" />
          </View>
          <Text style={[styles.kpiValue, { color: colors.text }]}>
            <Text style={{ color: m.budgetVariance > 0 ? '#EF4444' : '#8B5CF6' }}>
              ${m.totalSpent.toLocaleString()}
            </Text>
          </Text>
          <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>
            of ${m.totalBudget.toLocaleString() || '0'}
          </Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.kpiIconBox, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
            <Calendar size={17} color="#10B981" />
          </View>
          <Text style={[styles.kpiValue, { color: colors.text }]}>
            <Text style={{ color: m.daysRemaining !== null && m.daysRemaining < 0 ? '#EF4444' : '#10B981' }}>
              {m.daysRemaining !== null ? Math.abs(m.daysRemaining) : '—'}
            </Text>
          </Text>
          <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>
            {m.daysRemaining !== null ? (m.daysRemaining >= 0 ? 'Days Left' : 'Days Overdue') : 'No deadline'}
          </Text>
        </View>
        <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.kpiIconBox, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
            <AlertTriangle size={17} color="#F59E0B" />
          </View>
          <Text style={[styles.kpiValue, { color: colors.text }]}>
            <Text style={{ color: m.overdue > 0 ? '#EF4444' : colors.textTertiary }}>{m.overdue}</Text>
          </Text>
          <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Overdue</Text>
        </View>
      </View>

      {/* ── Progress Bar ── */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Task Completion</Text>
          <Text style={[styles.cardPct, { color: '#8B5CF6' }]}>{plan.progress}%</Text>
        </View>
        <View style={[styles.progressBar, { backgroundColor: colors.progressBg }]}>
          <LinearGradient
            colors={['#8B5CF6', '#6366F1']}
            style={[styles.progressFill, { width: `${plan.progress}%` }]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          />
        </View>
        <View style={[styles.progressStats, { borderTopColor: colors.border }]}>
          <View style={styles.progressStat}>
            <View style={[styles.statDot, { backgroundColor: '#10B981' }]} />
            <Text style={[styles.progressStatText, { color: colors.textSecondary }]}>{m.completed} Done</Text>
          </View>
          <View style={styles.progressStat}>
            <View style={[styles.statDot, { backgroundColor: '#3B82F6' }]} />
            <Text style={[styles.progressStatText, { color: colors.textSecondary }]}>{m.inProgress} Active</Text>
          </View>
          <View style={styles.progressStat}>
            <View style={[styles.statDot, { backgroundColor: colors.statDotTodo }]} />
            <Text style={[styles.progressStatText, { color: colors.textSecondary }]}>{m.total - m.completed - m.inProgress} Todo</Text>
          </View>
        </View>
      </View>

      {/* ── Quick Stats Row ── */}
      <View style={styles.quickStats}>
        <View style={[styles.quickStatCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Users size={15} color={colors.textTertiary} />
          <Text style={[styles.quickStatVal, { color: colors.text }]}>{plan.members.length || 1}</Text>
          <Text style={[styles.quickStatLabel, { color: colors.textSecondary }]}>Members</Text>
        </View>
        <View style={[styles.quickStatCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Flag size={15} color={colors.textTertiary} />
          <Text style={[styles.quickStatVal, { color: colors.text }]}>{m.milestones.length}</Text>
          <Text style={[styles.quickStatLabel, { color: colors.textSecondary }]}>Milestones</Text>
        </View>
        <View style={[styles.quickStatCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Paperclip size={15} color={colors.textTertiary} />
          <Text style={[styles.quickStatVal, { color: colors.text }]}>{m.files}</Text>
          <Text style={[styles.quickStatLabel, { color: colors.textSecondary }]}>Files</Text>
        </View>
        <View style={[styles.quickStatCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Target size={15} color={colors.textTertiary} />
          <Text style={[styles.quickStatVal, { color: colors.text }]}>{m.ideas}</Text>
          <Text style={[styles.quickStatLabel, { color: colors.textSecondary }]}>Ideas</Text>
        </View>
      </View>

      {/* ── Plan Details ── */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Plan Details</Text>
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
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>TITLE</Text>
              <TextInput
                style={[styles.fieldInput, { backgroundColor: isLight ? '#F5F5F5' : '#1F2937', color: colors.text, borderColor: colors.border }]}
                value={title} onChangeText={setTitle}
                placeholderTextColor={colors.textTertiary} placeholder="Project title"
              />
            </View>
            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>GOAL</Text>
              <TextInput
                style={[styles.fieldInput, { backgroundColor: isLight ? '#F5F5F5' : '#1F2937', color: colors.text, borderColor: colors.border }]}
                value={goal} onChangeText={setGoal}
                placeholderTextColor={colors.textTertiary} placeholder="What are we building?"
              />
            </View>
            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>DESCRIPTION</Text>
              <TextInput
                style={[styles.fieldInput, styles.fieldTextarea, { backgroundColor: isLight ? '#F5F5F5' : '#1F2937', color: colors.text, borderColor: colors.border }]}
                value={desc} onChangeText={setDesc}
                placeholderTextColor={colors.textTertiary} placeholder="Describe the project scope and objectives..."
                multiline numberOfLines={3} textAlignVertical="top"
              />
            </View>
            <View style={styles.fieldRow}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>TYPE</Text>
                <TextInput
                  style={[styles.fieldInput, { backgroundColor: isLight ? '#F5F5F5' : '#1F2937', color: colors.text, borderColor: colors.border }]}
                  value={projectType} onChangeText={setProjectType}
                  placeholderTextColor={colors.textTertiary} placeholder="Product Launch"
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>TARGET DATE</Text>
                <TextInput
                  style={[styles.fieldInput, { backgroundColor: isLight ? '#F5F5F5' : '#1F2937', color: colors.text, borderColor: colors.border }]}
                  value={targetDate} onChangeText={setTargetDate}
                  placeholderTextColor={colors.textTertiary} placeholder="YYYY-MM-DD"
                />
              </View>
            </View>
            <View style={styles.editActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)}>
                <Text style={[styles.cancelText, { color: isLight ? '#737373' : '#9CA3AF' }]}>Cancel</Text>
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
                <Text style={[styles.detailVal, { color: colors.text }]}>{plan.goal}</Text>
              </View>
            ) : null}
            {plan.description ? (
              <View style={styles.detailItem}>
                <Text style={styles.detailKey}>Description</Text>
                <Text style={[styles.detailVal, { color: colors.text }]}>{plan.description}</Text>
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
            <Text style={[styles.alertText, { color: m.budgetVariance > 0 ? (isLight ? '#DC2626' : '#FCA5A5') : (isLight ? '#059669' : '#6EE7B7') }]}>
              Budget is {m.budgetVariance > 0 ? 'over' : 'under'} by {Math.abs(m.budgetVariance)}%
              {m.budgetVariance > 0 ? ' — review expenses' : ' — great job!'}
            </Text>
          </View>
        </View>
      )}

      {/* ── Upcoming Milestones ── */}
      {m.milestones.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Upcoming Milestones</Text>
            <ChevronRight size={16} color={colors.textTertiary} />
          </View>
          {m.milestones.filter(t => !t.completed).slice(0, 3).map(item => (
            <View key={item.id} style={[styles.milestoneRow, { borderTopColor: colors.border }]}>
              <Flag size={14} color="#F59E0B" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.milestoneTitle, { color: colors.text }]}>{item.title}</Text>
                {item.date && <Text style={[styles.milestoneDate, { color: colors.textSecondary }]}>{item.date}</Text>}
              </View>
              <ArrowRight size={14} color={colors.textTertiary} />
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
  emptyText: { fontSize: 16, fontWeight: '600' },
  emptySub: { fontSize: 13 },

  // Stage Banner
  stageBanner: {
    borderRadius: 16, padding: 18, gap: 10,
    borderWidth: 1,
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
  bannerTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  goalRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  goalText: { fontSize: 13, fontWeight: '500', flex: 1, lineHeight: 18 },

  // Stage Tracker
  trackerCard: {
    borderRadius: 14, borderWidth: 1, padding: 16,
  },
  cardLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 14 },
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
    flex: 1, borderRadius: 14,
    borderWidth: 1, padding: 12, gap: 6,
  },
  kpiIconBox: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  kpiValue: { fontSize: 18, fontWeight: '800' },
  kpiLabel: { fontSize: 10, fontWeight: '600' },

  // Card
  card: {
    borderRadius: 14,
    borderWidth: 1, padding: 16,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardPct: { fontSize: 18, fontWeight: '800' },

  // Progress
  progressBar: {
    height: 10, borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: { height: 10, borderRadius: 5 },
  progressStats: {
    flexDirection: 'row', gap: 16, marginTop: 12,
    paddingTop: 12, borderTopWidth: 1,
  },
  progressStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statDot: { width: 8, height: 8, borderRadius: 4 },
  progressStatText: { fontSize: 12, fontWeight: '600' },

  // Quick Stats
  quickStats: { flexDirection: 'row', gap: CARD_GAP },
  quickStatCard: {
    flex: 1, borderRadius: 14,
    borderWidth: 1, padding: 12,
    alignItems: 'center', gap: 4,
  },
  quickStatVal: { fontSize: 16, fontWeight: '700' },
  quickStatLabel: { fontSize: 9, fontWeight: '600' },

  // Details
  detailGrid: { gap: 12 },
  detailItem: { gap: 4 },
  detailRow: { flexDirection: 'row', gap: 16 },
  detailKey: { color: '#6B7280', fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  detailVal: { fontSize: 14, fontWeight: '500', lineHeight: 20 },

  // Edit
  editButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editText: { color: '#8B5CF6', fontSize: 12, fontWeight: '600' },
  editForm: { gap: 10 },
  field: { gap: 4 },
  fieldRow: { flexDirection: 'row', gap: 10 },
  fieldLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  fieldInput: {
    fontSize: 14,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1,
  },
  fieldTextarea: { minHeight: 80 },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  cancelText: { fontSize: 14, fontWeight: '600' },
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
    paddingVertical: 10, borderTopWidth: 1,
  },
  milestoneTitle: { fontSize: 13, fontWeight: '600' },
  milestoneDate: { fontSize: 11, fontWeight: '500', marginTop: 2 },
});
