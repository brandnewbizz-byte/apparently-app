// CreateStory.tsx — Story creation UI: camera capture or gallery pick
// Uploads to Supabase storage via the existing createStory pipeline.

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Dimensions,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, Image as ImageIcon, X, Flashlight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import InstagramCamera, { type CapturedMedia } from '@/components/InstagramCamera';
import { useSocial } from '@/contexts/SocialContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Props ──

interface CreateStoryProps {
  visible: boolean;
  onClose: () => void;
  onStoryCreated: () => void;
  colors?: {
    background?: string;
    text?: string;
    accent?: string;
    surface?: string;
  };
}

// ── Component ──

export default function CreateStory({
  visible,
  onClose,
  onStoryCreated,
  colors: themeColors,
}: CreateStoryProps) {
  const insets = useSafeAreaInsets();
  const { createStory } = useSocial();
  const [showCamera, setShowCamera] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const bg = themeColors?.background ?? '#000';
  const text = themeColors?.text ?? '#FFF';
  const accent = themeColors?.accent ?? '#2196F3';
  const surface = themeColors?.surface ?? '#1C1C1E';

  // Handle camera capture
  const handleCameraCapture = useCallback(
    async (media: CapturedMedia) => {
      setShowCamera(false);
      await uploadAndCreateStory(media.uri);
    },
    [],
  );

  // Handle gallery pick
  const handleGalleryPick = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.9,
      });

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        await uploadAndCreateStory(asset.uri);
      }
    } catch (err) {
      console.error('[CreateStory] Gallery pick error:', err);
      Alert.alert('Error', 'Failed to pick image from gallery.');
    }
  }, []);

  // Shared upload + create flow
  const uploadAndCreateStory = useCallback(
    async (imageUri: string) => {
      if (!imageUri) return;

      setIsUploading(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      try {
        // Call SocialContext's createStory which handles:
        // - Getting current user ID
        // - Setting expires_at to 24h from now
        // - Inserting into Supabase stories table
        // - Invalidating the stories query cache
        createStory(imageUri);
        onStoryCreated();
      } catch (err) {
        console.error('[CreateStory] Upload error:', err);
        Alert.alert('Error', 'Failed to create story. Please try again.');
      } finally {
        setIsUploading(false);
      }
    },
    [createStory, onStoryCreated],
  );

  return (
    <>
      {/* Main creation modal */}
      <Modal
        visible={visible && !showCamera}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={[styles.modal, { backgroundColor: bg }]}>
          {/* Header */}
          <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
              <X size={24} color={text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: text }]}>
              Add to Story
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={[styles.subtitle, { color: text }]}>
              Share a moment that disappears in 24 hours
            </Text>

            <View style={styles.options}>
              {/* Camera option */}
              <TouchableOpacity
                style={[styles.optionCard, { backgroundColor: surface }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowCamera(true);
                }}
                disabled={isUploading}
              >
                <View style={[styles.optionIcon, { backgroundColor: accent + '20' }]}>
                  <Camera size={30} color={accent} />
                </View>
                <Text style={[styles.optionTitle, { color: text }]}>
                  Take Photo
                </Text>
                <Text style={[styles.optionDesc, { color: '#888' }]}>
                  Use the camera to capture a moment
                </Text>
              </TouchableOpacity>

              {/* Gallery option */}
              <TouchableOpacity
                style={[styles.optionCard, { backgroundColor: surface }]}
                onPress={handleGalleryPick}
                disabled={isUploading}
              >
                <View style={[styles.optionIcon, { backgroundColor: '#8B5CF6' + '20' }]}>
                  <ImageIcon size={30} color="#8B5CF6" />
                </View>
                <Text style={[styles.optionTitle, { color: text }]}>
                  Choose from Gallery
                </Text>
                <Text style={[styles.optionDesc, { color: '#888' }]}>
                  Pick a photo from your library
                </Text>
              </TouchableOpacity>
            </View>

            {/* Uploading indicator */}
            {isUploading && (
              <View style={styles.uploadingBadge}>
                <Flashlight size={16} color={accent} />
                <Text style={[styles.uploadingText, { color: accent }]}>
                  Creating your story...
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Instagram-style camera */}
      <InstagramCamera
        visible={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={handleCameraCapture}
        onPickFromGallery={handleGalleryPick}
      />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  modal: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 40,
    opacity: 0.7,
  },
  options: {
    gap: 16,
  },
  optionCard: {
    borderRadius: 16,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  optionDesc: {
    fontSize: 13,
    marginTop: 3,
  },
  uploadingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 32,
  },
  uploadingText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
