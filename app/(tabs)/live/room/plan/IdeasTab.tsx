import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Plus, Lightbulb, Image, Link, Mic, FileText, MessageCircle, ThumbsUp, ArrowRight } from 'lucide-react-native';
import { usePlan, IdeaCard } from '@/contexts/PlanContext';
import { useAuth } from '@/contexts/AuthContext';

const IDEA_TYPES: { key: IdeaCard['type']; label: string; icon: string }[] = [
  { key: 'idea', label: 'Idea', icon: '💡' },
  { key: 'note', label: 'Note', icon: '📝' },
  { key: 'question', label: 'Question', icon: '❓' },
  { key: 'inspiration', label: 'Inspiration', icon: '✨' },
  { key: 'link', label: 'Link', icon: '🔗' },
  { key: 'image', label: 'Image', icon: '🖼️' },
];

const REACTION_EMOJIS = ['👍', '❤️', '🔥', '💯', '👏', '🤔', '🎯', '🚀'];

export default function IdeasTab() {
  const { plan, addIdea, voteIdea, reactToIdea, convertIdeaToTask, deleteIdea } = usePlan();
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [ideaType, setIdeaType] = useState<IdeaCard['type']>('idea');

  const ideas = plan?.ideas || [];

  const handleAdd = () => {
    if (!title.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    addIdea({ title: title.trim(), content: content.trim(), type: ideaType });
    setTitle('');
    setContent('');
    setShowForm(false);
  };

  const handleVote = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    voteIdea(id);
  };

  const handleConvert = (id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    convertIdeaToTask(id);
  };

  return (
    <View style={styles.container}>
      {/* Add Button */}
      {!showForm && (
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowForm(true)}
        >
          <Plus size={16} color="#FFF" />
          <Text style={styles.addBtnText}>New Idea</Text>
        </TouchableOpacity>
      )}

      {/* Add Form */}
      {showForm && (
        <View style={styles.formCard}>
          <View style={styles.typeRow}>
            {IDEA_TYPES.slice(0, 4).map(t => (
              <TouchableOpacity
                key={t.key}
                style={[
                  styles.typeChip,
                  ideaType === t.key && { backgroundColor: '#8B5CF6' },
                ]}
                onPress={() => setIdeaType(t.key)}
              >
                <Text style={styles.typeIcon}>{t.icon}</Text>
                <Text style={[
                  styles.typeLabel,
                  { color: ideaType === t.key ? '#FFF' : '#9CA3AF' },
                ]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.formInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Title"
            placeholderTextColor="#6B7280"
          />
          <TextInput
            style={[styles.formInput, styles.formTextarea]}
            value={content}
            onChangeText={setContent}
            placeholder="Add details, links, or notes..."
            placeholderTextColor="#6B7280"
            multiline numberOfLines={3}
            textAlignVertical="top"
          />
          <View style={styles.formActions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setShowForm(false)}
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

      {/* Ideas List */}
      <ScrollView
        style={styles.list}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {ideas.length === 0 && !showForm ? (
          <View style={styles.empty}>
            <Lightbulb size={36} color="#4B5563" />
            <Text style={styles.emptyTitle}>No ideas yet</Text>
            <Text style={styles.emptySub}>Start brainstorming with your team</Text>
          </View>
        ) : (
          ideas.map(idea => {
            const userVoted = user ? idea.votes.includes(user.id) : false;
            const typeMeta = IDEA_TYPES.find(t => t.key === idea.type);
            return (
              <View key={idea.id} style={styles.ideaCard}>
                <View style={styles.ideaHeader}>
                  <Text style={styles.ideaTypeIcon}>{typeMeta?.icon || '💡'}</Text>
                  <Text style={styles.ideaTypeLabel}>{typeMeta?.label || 'Idea'}</Text>
                  <Text style={styles.ideaAuthor}>{idea.authorName}</Text>
                </View>
                <Text style={styles.ideaTitle}>{idea.title}</Text>
                {idea.content ? (
                  <Text style={styles.ideaContent}>{idea.content}</Text>
                ) : null}

                {/* Reactions */}
                {idea.reactions.length > 0 && (
                  <View style={styles.reactionsRow}>
                    {idea.reactions.map(r => (
                      <TouchableOpacity
                        key={r.emoji}
                        style={[
                          styles.reactionChip,
                          user && r.userIds.includes(user.id) && styles.reactionChipActive,
                        ]}
                        onPress={() => reactToIdea(idea.id, r.emoji)}
                      >
                        <Text style={styles.reactionEmoji}>{r.emoji}</Text>
                        <Text style={styles.reactionCount}>{r.userIds.length}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Actions */}
                <View style={styles.ideaActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, userVoted && styles.actionBtnActive]}
                    onPress={() => handleVote(idea.id)}
                  >
                    <ThumbsUp size={14} color={userVoted ? '#8B5CF6' : '#9CA3AF'} />
                    <Text style={[styles.actionText, userVoted && { color: '#8B5CF6' }]}>
                      {idea.votes.length}
                    </Text>
                  </TouchableOpacity>

                  {/* Quick Reactions */}
                  {REACTION_EMOJIS.map(emoji => (
                    <TouchableOpacity
                      key={emoji}
                      style={styles.quickReaction}
                      onPress={() => reactToIdea(idea.id, emoji)}
                    >
                      <Text style={styles.quickReactionText}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}

                  {!idea.convertedToTaskId && (
                    <TouchableOpacity
                      style={styles.convertBtn}
                      onPress={() => handleConvert(idea.id)}
                    >
                      <ArrowRight size={14} color="#10B981" />
                      <Text style={styles.convertText}>Task</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {idea.convertedToTaskId && (
                  <View style={styles.convertedBadge}>
                    <Text style={styles.convertedText}>✅ Converted to task</Text>
                  </View>
                )}
              </View>
            );
          })
        )}
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
    marginBottom: 12,
  },
  addBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  // Form
  formCard: {
    backgroundColor: '#1F2937', borderRadius: 14, padding: 14, gap: 10,
    marginBottom: 12,
  },
  typeRow: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 12, backgroundColor: '#374151',
  },
  typeIcon: { fontSize: 13 },
  typeLabel: { fontSize: 11, fontWeight: '600' },
  formInput: {
    backgroundColor: '#111827', color: '#FFF', fontSize: 15,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10,
  },
  formTextarea: { minHeight: 70 },
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
  // Idea Card
  ideaCard: {
    backgroundColor: '#1F2937', borderRadius: 14, padding: 14,
    marginBottom: 10,
  },
  ideaHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  ideaTypeIcon: { fontSize: 14 },
  ideaTypeLabel: { color: '#8B5CF6', fontSize: 11, fontWeight: '600' },
  ideaAuthor: { color: '#6B7280', fontSize: 11, marginLeft: 'auto' },
  ideaTitle: { color: '#FFF', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  ideaContent: { color: '#9CA3AF', fontSize: 14, lineHeight: 20 },
  reactionsRow: { flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap' },
  reactionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#374151', paddingHorizontal: 8,
    paddingVertical: 4, borderRadius: 12,
  },
  reactionChipActive: { backgroundColor: '#4C1D95' },
  reactionEmoji: { fontSize: 13 },
  reactionCount: { color: '#9CA3AF', fontSize: 11 },
  ideaActions: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 10, flexWrap: 'wrap',
  },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#374151', paddingHorizontal: 10,
    paddingVertical: 6, borderRadius: 10,
  },
  actionBtnActive: { backgroundColor: '#4C1D95' },
  actionText: { color: '#9CA3AF', fontSize: 13, fontWeight: '600' },
  quickReaction: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#374151', alignItems: 'center', justifyContent: 'center',
  },
  quickReactionText: { fontSize: 14 },
  convertBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#064E3B', paddingHorizontal: 10,
    paddingVertical: 6, borderRadius: 10, marginLeft: 'auto',
  },
  convertText: { color: '#10B981', fontSize: 12, fontWeight: '600' },
  convertedBadge: {
    backgroundColor: '#064E3B', paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 8, marginTop: 8, alignSelf: 'flex-start',
  },
  convertedText: { color: '#34D399', fontSize: 11, fontWeight: '600' },
});
