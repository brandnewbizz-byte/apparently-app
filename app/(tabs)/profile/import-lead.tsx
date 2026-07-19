import {
  ArrowLeft,
  Upload,
  UserPlus,
  X,
  AlertCircle,
  CheckCircle,
} from 'lucide-react-native';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import Colors from '@/constants/colors';
import { useLifeCrm } from '@/contexts/LifeCrmContext';

interface Lead {
  name: string;
  phone: string;
  email: string;
  source: string;
  tags: string[];
}

export default function ImportLeadScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addContact, relationships } = useLifeCrm();

  const [mode, setMode] = useState<'select' | 'manual' | 'csv'>('select');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [source, setSource] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [csvText, setCsvText] = useState('');
  const [importResults, setImportResults] = useState<{
    success: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  const checkDuplicate = (phone: string, email: string) => {
    return relationships.find(
      (r) =>
        (phone && r.phone === phone.trim()) ||
        (email && r.email === email.trim().toLowerCase())
    );
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim().toLowerCase())) {
      setTags([...tags, tagInput.trim().toLowerCase()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleManualSave = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name required');
      return;
    }

    const existing = checkDuplicate(phone, email);
    if (existing) {
      Alert.alert(
        'Duplicate',
        `Contact exists: ${existing.name}. Merge not yet implemented.`,
        [{ text: 'OK' }]
      );
      return;
    }

    const today = new Date().toISOString().split('T')[0];

    addContact({
      name: name.trim(),
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop',
      category: 'prospect',
      lastInteraction: 'Just added',
      lastInteractionDate: today,
      notes: source.trim() ? `Source: ${source.trim()}` : undefined,
      tags,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
    });

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    router.push('/(tabs)/profile' as any);
  };

  const parseCSV = (text: string): Lead[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const nameIdx = headers.findIndex((h) => h.includes('name'));
    const phoneIdx = headers.findIndex((h) => h.includes('phone'));
    const emailIdx = headers.findIndex((h) => h.includes('email'));
    const sourceIdx = headers.findIndex((h) => h.includes('source'));
    const tagsIdx = headers.findIndex((h) => h.includes('tag'));

    const leads: Lead[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim());
      if (values.length > 0 && values[0]) {
        leads.push({
          name: nameIdx >= 0 ? values[nameIdx] : '',
          phone: phoneIdx >= 0 ? values[phoneIdx] : '',
          email: emailIdx >= 0 ? values[emailIdx] : '',
          source: sourceIdx >= 0 ? values[sourceIdx] : '',
          tags:
            tagsIdx >= 0 && values[tagsIdx]
              ? values[tagsIdx].split(';').map((t) => t.trim())
              : [],
        });
      }
    }
    return leads;
  };

  const handleCSVImport = () => {
    if (!csvText.trim()) {
      Alert.alert('Error', 'Paste CSV data');
      return;
    }

    const leads = parseCSV(csvText);
    if (leads.length === 0) {
      Alert.alert('Error', 'No valid data found');
      return;
    }

    let success = 0;
    let skipped = 0;
    const errors: string[] = [];
    const today = new Date().toISOString().split('T')[0];

    leads.forEach((lead, idx) => {
      if (!lead.name) {
        errors.push(`Row ${idx + 2}: Missing name`);
        return;
      }

      const existing = checkDuplicate(lead.phone, lead.email);
      if (existing) {
        skipped++;
        return;
      }

      try {
        addContact({
          name: lead.name,
          avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop',
          category: 'prospect',
          lastInteraction: 'Imported',
          lastInteractionDate: today,
          notes: lead.source ? `Source: ${lead.source}` : undefined,
          tags: lead.tags,
          phone: lead.phone || undefined,
          email: lead.email || undefined,
        });
        success++;
      } catch {
        errors.push(`Row ${idx + 2}: Import failed`);
      }
    });

    setImportResults({ success, skipped, errors });

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleFinish = () => {
    router.push('/(tabs)/profile' as any);
  };

  if (mode === 'select') {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={Colors.dark.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Import Lead</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.selectContainer}>
          <Text style={styles.selectTitle}>How do you want to add leads?</Text>

          <TouchableOpacity
            style={styles.modeCard}
            onPress={() => setMode('manual')}
            activeOpacity={0.7}
          >
            <View style={[styles.modeIcon, { backgroundColor: '#7B61FF20' }]}>
              <UserPlus size={28} color="#7B61FF" />
            </View>
            <View style={styles.modeContent}>
              <Text style={styles.modeTitle}>Manual Entry</Text>
              <Text style={styles.modeDesc}>Add one lead at a time</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.modeCard}
            onPress={() => setMode('csv')}
            activeOpacity={0.7}
          >
            <View style={[styles.modeIcon, { backgroundColor: '#00D4FF20' }]}>
              <Upload size={28} color="#00D4FF" />
            </View>
            <View style={styles.modeContent}>
              <Text style={styles.modeTitle}>CSV Upload</Text>
              <Text style={styles.modeDesc}>Paste CSV: name, phone, email, source, tags</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (mode === 'manual') {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={() => setMode('select')} style={styles.backButton}>
            <ArrowLeft size={24} color={Colors.dark.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Lead</Text>
          <TouchableOpacity onPress={handleManualSave} style={styles.saveButton}>
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.section}>
            <Text style={styles.label}>Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Lead name"
              placeholderTextColor={Colors.dark.textTertiary}
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              placeholder="Phone number"
              placeholderTextColor={Colors.dark.textTertiary}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor={Colors.dark.textTertiary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Source</Text>
            <TextInput
              style={styles.input}
              placeholder="Where did this lead come from?"
              placeholderTextColor={Colors.dark.textTertiary}
              value={source}
              onChangeText={setSource}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Tags</Text>
            <View style={styles.tagInputRow}>
              <TextInput
                style={styles.tagInputField}
                placeholder="Add tag"
                placeholderTextColor={Colors.dark.textTertiary}
                value={tagInput}
                onChangeText={setTagInput}
                onSubmitEditing={handleAddTag}
                returnKeyType="done"
              />
              <TouchableOpacity style={styles.addBtn} onPress={handleAddTag}>
                <Text style={styles.addBtnText}>Add</Text>
              </TouchableOpacity>
            </View>

            {tags.length > 0 && (
              <View style={styles.tagsList}>
                {tags.map((tag) => (
                  <View key={tag} style={styles.tag}>
                    <Text style={styles.tagText}>#{tag}</Text>
                    <TouchableOpacity onPress={() => handleRemoveTag(tag)}>
                      <X size={14} color={Colors.dark.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  if (mode === 'csv') {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity
            onPress={() => (importResults ? handleFinish() : setMode('select'))}
            style={styles.backButton}
          >
            <ArrowLeft size={24} color={Colors.dark.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>CSV Import</Text>
          {!importResults && (
            <TouchableOpacity onPress={handleCSVImport} style={styles.saveButton}>
              <Text style={styles.saveButtonText}>Import</Text>
            </TouchableOpacity>
          )}
          {importResults && <View style={{ width: 40 }} />}
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {!importResults ? (
            <>
              <View style={styles.infoBox}>
                <AlertCircle size={18} color={Colors.dark.accent} />
                <Text style={styles.infoText}>
                  Paste CSV with headers: name, phone, email, source, tags
                </Text>
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>CSV Data</Text>
                <TextInput
                  style={styles.csvInput}
                  placeholder="name,phone,email,source,tags&#10;John Doe,123-456-7890,john@example.com,Website,lead;new"
                  placeholderTextColor={Colors.dark.textTertiary}
                  value={csvText}
                  onChangeText={setCsvText}
                  multiline
                  textAlignVertical="top"
                />
              </View>
            </>
          ) : (
            <View style={styles.resultsContainer}>
              <View style={styles.resultCard}>
                <CheckCircle size={48} color="#00E676" />
                <Text style={styles.resultTitle}>Import Complete</Text>
                <View style={styles.resultStats}>
                  <View style={styles.resultStat}>
                    <Text style={styles.resultStatValue}>{importResults.success}</Text>
                    <Text style={styles.resultStatLabel}>Added</Text>
                  </View>
                  <View style={styles.resultStat}>
                    <Text style={styles.resultStatValue}>{importResults.skipped}</Text>
                    <Text style={styles.resultStatLabel}>Skipped</Text>
                  </View>
                  {importResults.errors.length > 0 && (
                    <View style={styles.resultStat}>
                      <Text style={styles.resultStatValue}>{importResults.errors.length}</Text>
                      <Text style={styles.resultStatLabel}>Errors</Text>
                    </View>
                  )}
                </View>

                {importResults.errors.length > 0 && (
                  <View style={styles.errorsList}>
                    {importResults.errors.map((err, idx) => (
                      <Text key={idx} style={styles.errorText}>
                        • {err}
                      </Text>
                    ))}
                  </View>
                )}

                <TouchableOpacity style={styles.finishButton} onPress={handleFinish}>
                  <Text style={styles.finishButtonText}>View Prospects</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.dark.accent,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
  selectContainer: {
    flex: 1,
    padding: 20,
  },
  selectTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    marginBottom: 24,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 16,
    gap: 16,
  },
  modeIcon: {
    width: 60,
    height: 60,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeContent: {
    flex: 1,
  },
  modeTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    marginBottom: 4,
  },
  modeDesc: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  section: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.dark.textSecondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.dark.text,
  },
  tagInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tagInputField: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.dark.text,
  },
  addBtn: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.dark.accentGlow,
    justifyContent: 'center',
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.dark.accent,
  },
  tagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.dark.backgroundTertiary,
  },
  tagText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    backgroundColor: Colors.dark.accentGlow,
    borderRadius: 12,
    margin: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.dark.accent,
    lineHeight: 18,
  },
  csvInput: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 16,
    fontSize: 14,
    color: Colors.dark.text,
    minHeight: 200,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  resultsContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  resultCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.dark.text,
    marginTop: 16,
    marginBottom: 24,
  },
  resultStats: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 24,
  },
  resultStat: {
    alignItems: 'center',
  },
  resultStatValue: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: Colors.dark.accent,
  },
  resultStatLabel: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginTop: 4,
  },
  errorsList: {
    width: '100%',
    padding: 16,
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
    marginBottom: 24,
  },
  errorText: {
    fontSize: 12,
    color: '#FF6B9D',
    marginBottom: 4,
  },
  finishButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: Colors.dark.accent,
    alignItems: 'center',
  },
  finishButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
});
