import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  Building2,
  Briefcase,
  Tag,
  FileText,
  X,
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
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import Colors from '@/constants/colors';
import { useLifeCrm } from '@/contexts/LifeCrmContext';
import { Relationship } from '@/mocks/lifeCrmData';

const AVATAR_PLACEHOLDERS = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&h=150&fit=crop',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop',
];

const CATEGORIES: Relationship['category'][] = ['family', 'friend', 'colleague', 'business', 'investor', 'prospect'];

const getCategoryColor = (category: string) => {
  const colors: Record<string, string> = {
    family: '#FF6B9D',
    friend: '#00D4FF',
    colleague: '#00E676',
    business: '#7B61FF',
    investor: '#FFB300',
    prospect: '#00D4FF',
  };
  return colors[category] || Colors.dark.accent;
};

export default function AddContactScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addContact } = useLifeCrm();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<Relationship['category']>('friend');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_PLACEHOLDERS[0]);

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim().toLowerCase())) {
      setTags([...tags, tagInput.trim().toLowerCase()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }

    const today = new Date().toISOString().split('T')[0];

    addContact({
      name: name.trim(),
      avatar: selectedAvatar,
      category,
      lastInteraction: 'Just added',
      lastInteractionDate: today,
      notes: notes.trim() || undefined,
      tags,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      company: company.trim() || undefined,
      role: role.trim() || undefined,
    });

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    router.back();
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={Colors.dark.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Contact</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.avatarSection}>
          <Image source={{ uri: selectedAvatar }} style={styles.avatar} />
          <Text style={styles.avatarLabel}>Choose Avatar</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.avatarPicker}
            contentContainerStyle={styles.avatarPickerContent}
          >
            {AVATAR_PLACEHOLDERS.map((avatar, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.avatarOption,
                  selectedAvatar === avatar && styles.avatarOptionSelected,
                ]}
                onPress={() => setSelectedAvatar(avatar)}
              >
                <Image source={{ uri: avatar }} style={styles.avatarOptionImage} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Info</Text>
          
          <View style={styles.inputGroup}>
            <View style={styles.inputIcon}>
              <User size={18} color={Colors.dark.textSecondary} />
            </View>
            <TextInput
              style={styles.input}
              placeholder="Name *"
              placeholderTextColor={Colors.dark.textTertiary}
              value={name}
              onChangeText={setName}
            />
          </View>

          <Text style={styles.inputLabel}>Category</Text>
          <View style={styles.categorySelector}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryOption,
                  category === cat && { backgroundColor: getCategoryColor(cat) + '20' },
                ]}
                onPress={() => setCategory(cat)}
              >
                <Text
                  style={[
                    styles.categoryText,
                    category === cat && { color: getCategoryColor(cat) },
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Details</Text>

          <View style={styles.inputGroup}>
            <View style={styles.inputIcon}>
              <Phone size={18} color={Colors.dark.textSecondary} />
            </View>
            <TextInput
              style={styles.input}
              placeholder="Phone number"
              placeholderTextColor={Colors.dark.textTertiary}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputIcon}>
              <Mail size={18} color={Colors.dark.textSecondary} />
            </View>
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
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Work Info</Text>

          <View style={styles.inputGroup}>
            <View style={styles.inputIcon}>
              <Building2 size={18} color={Colors.dark.textSecondary} />
            </View>
            <TextInput
              style={styles.input}
              placeholder="Company"
              placeholderTextColor={Colors.dark.textTertiary}
              value={company}
              onChangeText={setCompany}
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputIcon}>
              <Briefcase size={18} color={Colors.dark.textSecondary} />
            </View>
            <TextInput
              style={styles.input}
              placeholder="Role / Title"
              placeholderTextColor={Colors.dark.textTertiary}
              value={role}
              onChangeText={setRole}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tags</Text>
          
          <View style={styles.tagInputContainer}>
            <View style={styles.inputIcon}>
              <Tag size={18} color={Colors.dark.textSecondary} />
            </View>
            <TextInput
              style={styles.tagInput}
              placeholder="Add tag (press enter)"
              placeholderTextColor={Colors.dark.textTertiary}
              value={tagInput}
              onChangeText={setTagInput}
              onSubmitEditing={handleAddTag}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.addTagBtn} onPress={handleAddTag}>
              <Text style={styles.addTagBtnText}>Add</Text>
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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          
          <View style={styles.notesInputGroup}>
            <View style={[styles.inputIcon, { alignSelf: 'flex-start', marginTop: 14 }]}>
              <FileText size={18} color={Colors.dark.textSecondary} />
            </View>
            <TextInput
              style={styles.notesInput}
              placeholder="Add notes about this contact..."
              placeholderTextColor={Colors.dark.textTertiary}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </View>

        <TouchableOpacity style={styles.saveButtonLarge} onPress={handleSave}>
          <Text style={styles.saveButtonLargeText}>Add Contact</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: Colors.dark.accent,
    marginBottom: 12,
  },
  avatarLabel: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginBottom: 12,
  },
  avatarPicker: {
    maxHeight: 60,
  },
  avatarPickerContent: {
    paddingHorizontal: 16,
    gap: 10,
    flexDirection: 'row',
  },
  avatarOption: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarOptionSelected: {
    borderColor: Colors.dark.accent,
  },
  avatarOptionImage: {
    width: '100%',
    height: '100%',
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.dark.text,
    marginBottom: 16,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 12,
  },
  inputIcon: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingRight: 14,
    fontSize: 15,
    color: Colors.dark.text,
  },
  inputLabel: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginBottom: 10,
  },
  categorySelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.dark.textSecondary,
    textTransform: 'capitalize',
  },
  tagInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  tagInput: {
    flex: 1,
    paddingVertical: 14,
    paddingRight: 8,
    fontSize: 15,
    color: Colors.dark.text,
  },
  addTagBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: Colors.dark.accentGlow,
  },
  addTagBtnText: {
    fontSize: 13,
    fontWeight: '500' as const,
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.dark.backgroundTertiary,
  },
  tagText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  notesInputGroup: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  notesInput: {
    flex: 1,
    padding: 14,
    paddingLeft: 0,
    fontSize: 15,
    color: Colors.dark.text,
    minHeight: 100,
  },
  saveButtonLarge: {
    marginHorizontal: 16,
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: Colors.dark.accent,
    alignItems: 'center',
  },
  saveButtonLargeText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.dark.text,
  },
});
