import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Plus, File, Image, Link, Video, FileText, Trash2, ExternalLink,
} from 'lucide-react-native';
import { usePlan, FileRef } from '@/contexts/PlanContext';
import { useTheme } from '@/contexts/ThemeContext';

const FILE_TYPE_ICONS: Record<string, { icon: any; color: string }> = {
  image: { icon: Image, color: '#3B82F6' },
  video: { icon: Video, color: '#EF4444' },
  pdf: { icon: FileText, color: '#F59E0B' },
  document: { icon: FileText, color: '#10B981' },
  spreadsheet: { icon: File, color: '#10B981' },
  link: { icon: Link, color: '#8B5CF6' },
  design: { icon: Image, color: '#A855F7' },
  voice: { icon: File, color: '#EC4899' },
  supplier: { icon: File, color: '#6B7280' },
  other: { icon: File, color: '#6B7280' },
};

export default function FilesTab() {
  const { plan, addFile, deleteFile } = usePlan();
  const theme = useTheme();
  const isLight = theme.colors.background === '#FFFFFF';

  const colors = {
    text: theme.colors.text,
    textSecondary: theme.colors.textSecondary,
    textTertiary: theme.colors.textTertiary,
    border: theme.colors.border,
    surface: theme.colors.surface || theme.colors.backgroundSecondary,
    formBg: isLight ? '#F5F5F5' : '#1F2937',
    formInputBg: isLight ? '#FFFFFF' : '#111827',
    chipBg: isLight ? '#E5E5E5' : '#374151',
  };

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [fileType, setFileType] = useState('other');

  const files = plan?.files || [];

  const handleAdd = () => {
    if (!name.trim() || !url.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    addFile({
      name: name.trim(),
      type: fileType,
      url: url.trim(),
      attachedTo: { type: 'section', id: '' },
    });
    setName(''); setUrl(''); setFileType('other');
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    deleteFile(id);
  };

  const typeKeys = Object.keys(FILE_TYPE_ICONS);

  return (
    <View style={styles.container}>
      {!showForm && (
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(true)}>
          <Plus size={16} color="#FFF" />
          <Text style={styles.addBtnText}>Add Resource</Text>
        </TouchableOpacity>
      )}

      {showForm && (
        <View style={[styles.formCard, { backgroundColor: colors.formBg, borderColor: colors.border }]}>
          <TextInput
            style={[styles.formInput, { backgroundColor: colors.formInputBg, color: colors.text, borderColor: colors.border }]}
            value={name}
            onChangeText={setName}
            placeholder="Resource name"
            placeholderTextColor={colors.textTertiary}
          />
          <TextInput
            style={[styles.formInput, { backgroundColor: colors.formInputBg, color: colors.text, borderColor: colors.border }]}
            value={url}
            onChangeText={setUrl}
            placeholder="URL (paste link)"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {typeKeys.map(t => {
              const meta = FILE_TYPE_ICONS[t];
              return (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.typeChip,
                    { backgroundColor: colors.chipBg },
                    fileType === t && { backgroundColor: meta.color + '30', borderColor: meta.color },
                  ]}
                  onPress={() => setFileType(t)}
                >
                  <Text style={[styles.typeText, { color: meta.color }]}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={styles.formActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForm(false)}>
              <Text style={[styles.cancelText, { color: colors.textTertiary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, (!name.trim() || !url.trim()) && { opacity: 0.5 }]}
              onPress={handleAdd}
            >
              <Text style={styles.submitText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {files.length === 0 ? (
          <View style={styles.empty}>
            <File size={36} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.textTertiary }]}>No resources yet</Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
              Upload images, docs, links, and more to share with your team
            </Text>
          </View>
        ) : (
          files.map(file => {
            const meta = FILE_TYPE_ICONS[file.type] || FILE_TYPE_ICONS.other;
            const Icon = meta.icon;
            return (
              <View key={file.id} style={[styles.fileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.fileIcon, { backgroundColor: meta.color + '20' }]}>
                  <Icon size={20} color={meta.color} />
                </View>
                <View style={styles.fileInfo}>
                  <Text style={[styles.fileName, { color: colors.text }]}>{file.name}</Text>
                  <Text style={[styles.fileTypeLabel, { color: colors.textSecondary }]}>{file.type}</Text>
                  <Text style={[styles.fileUrl, { color: colors.textTertiary }]} numberOfLines={1}>{file.url}</Text>
                </View>
                <TouchableOpacity style={styles.fileAction} onPress={() => handleDelete(file.id)}>
                  <Trash2 size={16} color={colors.textTertiary} />
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
  container: { flex: 1, padding: 12 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#8B5CF6', paddingHorizontal: 16,
    paddingVertical: 10, borderRadius: 12, alignSelf: 'center',
    marginVertical: 8,
  },
  addBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  formCard: { borderRadius: 14, padding: 14, gap: 10, marginBottom: 10, borderWidth: 1 },
  formInput: { fontSize: 15, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  typeChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: 'transparent', marginRight: 6 },
  typeText: { fontSize: 11, fontWeight: '600' },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  cancelBtn: { paddingVertical: 8, paddingHorizontal: 14 },
  cancelText: { fontSize: 14, fontWeight: '600' },
  submitBtn: { backgroundColor: '#8B5CF6', paddingVertical: 8, paddingHorizontal: 20, borderRadius: 10 },
  submitText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  list: { flex: 1 },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
  emptySub: { fontSize: 13, textAlign: 'center', paddingHorizontal: 20 },
  fileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, padding: 14,
    marginBottom: 8, borderWidth: 1,
  },
  fileIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  fileInfo: { flex: 1, gap: 2 },
  fileName: { fontSize: 14, fontWeight: '600' },
  fileTypeLabel: { fontSize: 11, fontWeight: '500' },
  fileUrl: { fontSize: 11 },
  fileAction: { padding: 6 },
});
