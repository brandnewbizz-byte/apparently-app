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
        <View style={styles.formCard}>
          <TextInput
            style={styles.formInput}
            value={name}
            onChangeText={setName}
            placeholder="Resource name"
            placeholderTextColor="#6B7280"
          />
          <TextInput
            style={styles.formInput}
            value={url}
            onChangeText={setUrl}
            placeholder="URL (paste link)"
            placeholderTextColor="#6B7280"
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
              <Text style={styles.cancelText}>Cancel</Text>
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
            <File size={36} color="#4B5563" />
            <Text style={styles.emptyTitle}>No resources yet</Text>
            <Text style={styles.emptySub}>
              Upload images, docs, links, and more to share with your team
            </Text>
          </View>
        ) : (
          files.map(file => {
            const meta = FILE_TYPE_ICONS[file.type] || FILE_TYPE_ICONS.other;
            const Icon = meta.icon;
            return (
              <View key={file.id} style={styles.fileCard}>
                <View style={[styles.fileIcon, { backgroundColor: meta.color + '20' }]}>
                  <Icon size={20} color={meta.color} />
                </View>
                <View style={styles.fileInfo}>
                  <Text style={styles.fileName}>{file.name}</Text>
                  <Text style={styles.fileTypeLabel}>{file.type}</Text>
                  <Text style={styles.fileUrl} numberOfLines={1}>{file.url}</Text>
                </View>
                <TouchableOpacity style={styles.fileAction} onPress={() => handleDelete(file.id)}>
                  <Trash2 size={16} color="#6B7280" />
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
  formCard: { backgroundColor: '#1F2937', borderRadius: 14, padding: 14, gap: 10, marginBottom: 10 },
  formInput: { backgroundColor: '#111827', color: '#FFF', fontSize: 15, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  typeChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: 'transparent', backgroundColor: '#374151', marginRight: 6 },
  typeText: { fontSize: 11, fontWeight: '600' },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  cancelBtn: { paddingVertical: 8, paddingHorizontal: 14 },
  cancelText: { color: '#9CA3AF', fontSize: 14, fontWeight: '600' },
  submitBtn: { backgroundColor: '#8B5CF6', paddingVertical: 8, paddingHorizontal: 20, borderRadius: 10 },
  submitText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  list: { flex: 1 },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { color: '#9CA3AF', fontSize: 16, fontWeight: '600' },
  emptySub: { color: '#6B7280', fontSize: 13, textAlign: 'center', paddingHorizontal: 20 },
  fileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#1F2937', borderRadius: 14, padding: 14,
    marginBottom: 8,
  },
  fileIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  fileInfo: { flex: 1, gap: 2 },
  fileName: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  fileTypeLabel: { color: '#6B7280', fontSize: 11, fontWeight: '500' },
  fileUrl: { color: '#4B5563', fontSize: 11 },
  fileAction: { padding: 6 },
});
