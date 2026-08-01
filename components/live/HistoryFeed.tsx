import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native';
import {
  Clock, Filter, LogIn, LogOut, Edit3, CheckCircle, DollarSign,
  Calendar, Presentation, Vote, FileUp, UserPlus, UserMinus,
  MicOff, Shield, MessageCircle, Lightbulb, FileText, X,
} from 'lucide-react-native';
import type { HistoryAction, HistoryEntry } from '@/hooks/useRoomHistory';

// ── Action icons + labels ──
const ACTION_META: Record<string, { icon: React.FC<{size:number;color:string}>; label: string; color: string }> = {
  user_joined:          { icon: LogIn,       label: 'Joined',            color: '#10B981' },
  user_left:            { icon: LogOut,      label: 'Left',              color: '#EF4444' },
  room_created:         { icon: LogIn,       label: 'Room created',      color: '#F59E0B' },
  resource_uploaded:    { icon: FileUp,      label: 'Uploaded',          color: '#3B82F6' },
  plan_edited:          { icon: Edit3,       label: 'Edited plan',       color: '#8B5CF6' },
  task_added:           { icon: Edit3,       label: 'Task added',        color: '#3B82F6' },
  task_completed:       { icon: CheckCircle, label: 'Task done',         color: '#10B981' },
  task_updated:         { icon: Edit3,       label: 'Task updated',      color: '#3B82F6' },
  task_deleted:         { icon: Edit3,       label: 'Task removed',      color: '#EF4444' },
  budget_updated:        { icon: DollarSign,  label: 'Budget updated',    color: '#F59E0B' },
  timeline_changed:      { icon: Calendar,    label: 'Timeline changed',  color: '#8B5CF6' },
  presentation_started:  { icon: Presentation,label: 'Presenting',        color: '#10B981' },
  presentation_ended:    { icon: Presentation,label: 'Presentation ended',color: '#6B7280' },
  vote_created:          { icon: Vote,        label: 'Vote created',      color: '#8B5CF6' },
  vote_cast:             { icon: Vote,        label: 'Vote cast',         color: '#8B5CF6' },
  vote_decided:          { icon: CheckCircle, label: 'Vote decided',      color: '#10B981' },
  control_requested:     { icon: Shield,      label: 'Requested control', color: '#F59E0B' },
  control_given:         { icon: Shield,      label: 'Control given',    color: '#F59E0B' },
  control_taken:         { icon: Shield,      label: 'Control taken',    color: '#F59E0B' },
  user_muted:            { icon: MicOff,      label: 'Muted',            color: '#F59E0B' },
  user_unmuted:          { icon: MicOff,      label: 'Unmuted',          color: '#10B981' },
  mute_all:              { icon: MicOff,      label: 'Muted all',        color: '#F59E0B' },
  user_removed:          { icon: UserMinus,   label: 'Removed',          color: '#EF4444' },
  role_changed:          { icon: Shield,      label: 'Role changed',     color: '#F59E0B' },
  discussion_open:       { icon: MessageCircle,label: 'Discussion open',  color: '#10B981' },
  discussion_closed:     { icon: MessageCircle,label: 'Discussion closed',color: '#EF4444' },
  section_added:         { icon: Edit3,       label: 'Section added',    color: '#3B82F6' },
  section_updated:       { icon: Edit3,       label: 'Section updated',  color: '#3B82F6' },
  idea_added:            { icon: Lightbulb,   label: 'Idea added',       color: '#F59E0B' },
  idea_voted:            { icon: Vote,        label: 'Idea voted',       color: '#8B5CF6' },
  idea_converted:         { icon: Edit3,       label: 'Idea → task',      color: '#10B981' },
  file_added:            { icon: FileText,     label: 'File added',       color: '#3B82F6' },
  file_deleted:          { icon: FileText,     label: 'File removed',     color: '#EF4444' },
};

// ── Time formatter ──
function formatTime(ts: string): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Filters ──
const FILTER_CATEGORIES = [
  { key: 'all' as const, label: 'All' },
  { key: 'people' as const, label: 'People', actions: ['user_joined','user_left','user_removed','role_changed'] },
  { key: 'edits' as const, label: 'Edits', actions: ['plan_edited','task_added','task_completed','task_updated','task_deleted','section_added','section_updated'] },
  { key: 'presentation' as const, label: 'Present', actions: ['presentation_started','presentation_ended','control_requested','control_given','control_taken'] },
  { key: 'other' as const, label: 'Other', actions: ['vote_created','vote_cast','vote_decided','budget_updated','idea_added','file_added','discussion_open','discussion_closed'] },
];

// ── Props ──
interface HistoryFeedProps {
  entries: HistoryEntry[];
  isLoading?: boolean;
  onRefresh?: () => void;
  maxHeight?: number;
}

// ── Component ──
export function HistoryFeed({ entries, isLoading, onRefresh, maxHeight }: HistoryFeedProps) {
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    if (activeFilter === 'all') return entries;
    const cat = FILTER_CATEGORIES.find(c => c.key === activeFilter);
    if (!cat?.actions) return entries;
    return entries.filter(e => cat.actions!.includes(e.action));
  }, [entries, activeFilter]);

  const renderItem = useCallback(({ item }: { item: HistoryEntry }) => {
    const meta = ACTION_META[item.action];
    if (!meta) return null;
    const Icon = meta.icon;

    return (
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: `${meta.color}15` }]}>
          <Icon size={14} color={meta.color} />
        </View>
        <View style={styles.content}>
          <Text style={styles.userName}>{item.userName || 'Someone'}</Text>
          <Text style={styles.detail}>{item.detail}</Text>
        </View>
        <Text style={styles.time}>{formatTime(item.timestamp)}</Text>
      </View>
    );
  }, []);

  if (isLoading && entries.length === 0) {
    return (
      <View style={styles.empty}>
        <Clock size={32} color="#4B5563" />
        <Text style={styles.emptyText}>Loading history...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, maxHeight ? { maxHeight } : undefined]}>
      {/* Filter tabs */}
      <View style={styles.filterBar}>
        <FlatList
          horizontal
          data={FILTER_CATEGORIES}
          showsHorizontalScrollIndicator={false}
          keyExtractor={c => c.key}
          contentContainerStyle={{ paddingHorizontal: 8, gap: 4 }}
          renderItem={({ item }) => {
            const isActive = activeFilter === item.key;
            return (
              <TouchableOpacity
                style={[styles.filterTab, isActive && styles.filterTabActive]}
                onPress={() => setActiveFilter(item.key)}
              >
                <Text style={[styles.filterLabel, isActive && styles.filterLabelActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* List */}
      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <Clock size={24} color="#4B5563" />
          <Text style={styles.emptyText}>No activity yet</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={e => e.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingVertical: 4 }}
          refreshing={isLoading}
          onRefresh={onRefresh}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterBar: {
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    paddingVertical: 6,
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  filterTabActive: {
    backgroundColor: 'rgba(139,92,246,0.2)',
  },
  filterLabel: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
  },
  filterLabelActive: {
    color: '#A78BFA',
  },

  // Rows
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  content: {
    flex: 1,
  },
  userName: {
    color: '#E5E7EB',
    fontSize: 13,
    fontWeight: '600',
  },
  detail: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  time: {
    color: '#6B7280',
    fontSize: 10,
    marginTop: 2,
    minWidth: 40,
    textAlign: 'right',
  },

  // Empty
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 14,
  },
});
