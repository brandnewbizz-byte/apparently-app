import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, TextInput, ScrollView,
  Image, StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { X, Wrench, Gift, Plus, ImagePlus } from 'lucide-react-native';

import * as localApi from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

interface Props {
  visible: boolean;
  mode: 'skill' | 'bundle';
  onClose: () => void;
}

export default function CreateDealModal({ visible, mode, onClose }: Props) {
  const { colors } = useTheme();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [price, setPrice] = useState('');
  const [icon, setIcon] = useState('🛠️');
  const [image, setImage] = useState<string | null>(null);
  const [items, setItems] = useState<string[]>([]);
  const [itemText, setItemText] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset form whenever the modal opens (with its current mode).
  useEffect(() => {
    if (visible) {
      setTitle('');
      setDesc('');
      setPrice('');
      setIcon(mode === 'skill' ? '🛠️' : '🎁');
      setImage(null);
      setItems([]);
      setItemText('');
      setSaving(false);
    }
  }, [visible, mode]);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]) {
        setImage(result.assets[0].uri);
      }
    } catch {
      // permission denied / picker error — ignore
    }
  };

  const addItem = () => {
    const t = itemText.trim();
    if (!t) return;
    setItems((prev) => [...prev, t]);
    setItemText('');
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Missing', 'Please enter a title.');
      return;
    }
    const priceNum = parseFloat(price) || 0;
    const creator = {
      id: user?.id || 'u-dev',
      name: user?.fullName || 'You',
      avatar: user?.avatar || '',
    };
    setSaving(true);
    try {
      if (mode === 'skill') {
        await localApi.createSkillDeal({
          creator_id: creator.id,
          creator_name: creator.name,
          creator_avatar: creator.avatar,
          title: title.trim(),
          description: desc.trim(),
          price: priceNum,
          icon,
          image_url: image || undefined,
          category: 'Skill',
        });
      } else {
        await localApi.createBundle({
          creator_id: creator.id,
          creator_name: creator.name,
          creator_avatar: creator.avatar,
          title: title.trim(),
          description: desc.trim(),
          price: priceNum,
          items,
          image_url: image || undefined,
          category: 'Bundle',
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch {
      Alert.alert('Error', `Failed to save your ${mode === 'skill' ? 'skill' : 'bundle'}. Please try again.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>
                Create {mode === 'skill' ? 'Skill Deal' : 'Bundle'}
              </Text>
              <TouchableOpacity onPress={onClose}>
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Mode toggle */}
            <View style={styles.modeToggle}>
              <TouchableOpacity
                style={[styles.modeBtn, { backgroundColor: colors.surface, borderColor: colors.border }, mode === 'skill' && { backgroundColor: colors.accentGlow, borderColor: colors.accent }]}
                onPress={() => { /* mode is controlled by parent; read-only toggle for visual clarity */ }}
              >
                <Wrench size={15} color={mode === 'skill' ? colors.accent : colors.textSecondary} />
                <Text style={[styles.modeBtnText, { color: mode === 'skill' ? colors.accent : colors.textSecondary }]}>Skill</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, { backgroundColor: colors.surface, borderColor: colors.border }, mode === 'bundle' && { backgroundColor: colors.accentGlow, borderColor: colors.accent }]}
                onPress={() => { /* mode is controlled by parent */ }}
              >
                <Gift size={15} color={mode === 'bundle' ? colors.accent : colors.textSecondary} />
                <Text style={[styles.modeBtnText, { color: mode === 'bundle' ? colors.accent : colors.textSecondary }]}>Bundle</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.form} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Image */}
              <TouchableOpacity
                style={[styles.imgPicker, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={pickImage}
              >
                {image ? (
                  <Image source={{ uri: image }} style={styles.previewImg} />
                ) : (
                  <>
                    <ImagePlus size={28} color={colors.textTertiary} />
                    <Text style={[styles.imgPickerText, { color: colors.textTertiary }]}>Add image</Text>
                  </>
                )}
                {image ? (
                  <TouchableOpacity style={styles.removeImg} onPress={() => setImage(null)}>
                    <X size={12} color="#FFF" />
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>

              {/* Title */}
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                placeholder={mode === 'skill' ? 'What skill are you offering?' : 'Name your bundle'}
                placeholderTextColor={colors.textTertiary}
                value={title}
                onChangeText={setTitle}
              />

              {/* Description */}
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                placeholder="Describe what's included..."
                placeholderTextColor={colors.textTertiary}
                value={desc}
                onChangeText={setDesc}
                multiline
                numberOfLines={3}
              />

              {/* Price */}
              <View style={styles.priceRow}>
                <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>$</Text>
                <TextInput
                  style={[styles.priceInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  placeholder="0"
                  placeholderTextColor={colors.textTertiary}
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="decimal-pad"
                />
              </View>

              {/* Bundle items */}
              {mode === 'bundle' ? (
                <View style={styles.itemsSection}>
                  <Text style={[styles.itemsLabel, { color: colors.textSecondary }]}>Bundle Items</Text>
                  <View style={styles.addItemRow}>
                    <TextInput
                      style={[styles.itemInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                      placeholder="e.g. Hotel room, Dinner, Chauffeur..."
                      placeholderTextColor={colors.textTertiary}
                      value={itemText}
                      onChangeText={setItemText}
                      onSubmitEditing={addItem}
                    />
                    <TouchableOpacity style={[styles.addItemBtn, { backgroundColor: colors.accent }]} onPress={addItem}>
                      <Plus size={16} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                  {items.map((item, i) => (
                    <View key={i} style={[styles.itemTag, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <Text style={[styles.itemTagText, { color: colors.text }]}>{item}</Text>
                      <TouchableOpacity onPress={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}>
                        <X size={12} color={colors.textTertiary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : null}
            </ScrollView>

            {/* Submit */}
            <TouchableOpacity
              style={[styles.postBtn, (!title.trim() || saving) && { opacity: 0.5 }, { backgroundColor: colors.accent }]}
              onPress={handleSubmit}
              disabled={!title.trim() || saving}
            >
              <Text style={styles.postBtnText}>
                {saving ? 'Posting…' : `Post ${mode === 'skill' ? 'Skill Deal' : 'Bundle'}`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    maxHeight: '90%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modeToggle: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  modeBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  form: {
    flexGrow: 0,
  },
  imgPicker: {
    height: 150,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 14,
  },
  imgPickerText: {
    marginTop: 8,
    fontSize: 13,
  },
  previewImg: {
    width: '100%',
    height: '100%',
  },
  removeImg: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  priceLabel: {
    fontSize: 20,
    fontWeight: '700',
    marginRight: 8,
  },
  priceInput: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  itemsSection: {
    marginBottom: 12,
  },
  itemsLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  addItemRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  itemInput: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  addItemBtn: {
    width: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTag: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6,
  },
  itemTagText: {
    fontSize: 14,
    flex: 1,
  },
  postBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  postBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
