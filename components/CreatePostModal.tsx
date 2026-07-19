import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Image,
  Platform,
  ScrollView,
  Alert,
  ActionSheetIOS,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { X, Image as ImageIcon, Users, Globe, Camera, Plus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/contexts/ThemeContext';
import { useSocial } from '@/contexts/SocialContext';

interface CreatePostModalProps {
  visible: boolean;
  onClose: () => void;
}

type PrivacyOption = 'public' | 'connections' | 'private';

export default function CreatePostModal({ visible, onClose }: CreatePostModalProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { createPost } = useSocial();
  const inputRef = useRef<TextInput>(null);

  const [content, setContent] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<{ uri: string; type: 'image' | 'video' } | null>(null);
  const [privacy] = useState<PrivacyOption>('public');
  const [mediaLibraryPermission, requestMediaLibraryPermission] = ImagePicker.useMediaLibraryPermissions();
  const [cameraPermission, requestCameraPermission] = ImagePicker.useCameraPermissions();

  useEffect(() => {
    if (visible) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [visible]);

  const handleClose = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setContent('');
    setSelectedMedia(null);
    onClose();
  };

  const handlePost = () => {
    if (!content.trim() && !selectedMedia) {
      Alert.alert('Empty Post', 'Please write something or add media to share.');
      return;
    }

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    createPost(content.trim(), selectedMedia?.uri || undefined);
    
    console.log('[CreatePostModal] Post created', { content, selectedMedia, privacy });
    
    handleClose();
  };

  const handleRemoveMedia = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedMedia(null);
    console.log('[CreatePostModal] Removed media');
  };

  const handlePickFromLibrary = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (Platform.OS !== 'web' && !mediaLibraryPermission?.granted) {
      const { status } = await requestMediaLibraryPermission();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'We need access to your photos to upload media.');
        return;
      }
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false,
        quality: 0.8,
        videoMaxDuration: 60,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const mediaType = asset.type === 'video' ? 'video' : 'image';
        setSelectedMedia({ uri: asset.uri, type: mediaType });
        console.log('[CreatePostModal] Selected media from library:', asset.uri, mediaType);
      }
    } catch (error) {
      console.log('[CreatePostModal] Media picker error:', error);
      Alert.alert('Error', 'Failed to pick media. Please try again.');
    }
  };

  const handleTakePhoto = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (Platform.OS === 'web') {
      Alert.alert('Not Available', 'Camera is not available on web. Please use the gallery.');
      return;
    }

    if (!cameraPermission?.granted) {
      const { status } = await requestCameraPermission();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'We need camera access to take photos.');
        return;
      }
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false,
        quality: 0.8,
        videoMaxDuration: 60,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const mediaType = asset.type === 'video' ? 'video' : 'image';
        setSelectedMedia({ uri: asset.uri, type: mediaType });
        console.log('[CreatePostModal] Captured media from camera:', asset.uri, mediaType);
      }
    } catch (error) {
      console.log('[CreatePostModal] Camera error:', error);
      Alert.alert('Error', 'Failed to capture media. Please try again.');
    }
  };

  const showMediaOptions = () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo/Video', 'Choose from Gallery'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            handleTakePhoto();
          } else if (buttonIndex === 2) {
            handlePickFromLibrary();
          }
        }
      );
    } else {
      Alert.alert(
        'Add Media',
        'Choose an option',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Take Photo/Video', onPress: handleTakePhoto },
          { text: 'Choose from Gallery', onPress: handlePickFromLibrary },
        ]
      );
    }
  };

  const getPrivacyIcon = () => {
    switch (privacy) {
      case 'public':
        return <Globe size={14} color={colors.textSecondary} />;
      case 'connections':
        return <Users size={14} color={colors.textSecondary} />;
      default:
        return <Globe size={14} color={colors.textSecondary} />;
    }
  };

  const getPrivacyLabel = () => {
    switch (privacy) {
      case 'public':
        return 'Public';
      case 'connections':
        return 'Connections';
      default:
        return 'Public';
    }
  };

  const canPost = content.trim() || selectedMedia;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top || 16, borderBottomColor: colors.border }]}>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <X size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Create Post</Text>
          <TouchableOpacity
            style={[
              styles.postButton,
              { backgroundColor: colors.accent },
              !canPost && styles.postButtonDisabled,
            ]}
            onPress={handlePost}
            disabled={!canPost}
          >
            <Text style={styles.postButtonText}>Post</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.attachmentBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <View style={styles.attachmentHeader}>
            <Text style={[styles.attachmentLabel, { color: colors.textSecondary }]}>Add to post</Text>
          </View>
          <View style={styles.attachmentActions}>
            <TouchableOpacity
              style={[styles.attachmentButtonMain, { backgroundColor: colors.accent }]}
              onPress={showMediaOptions}
            >
              <Plus size={20} color="#FFFFFF" />
              <Text style={styles.attachmentButtonMainText}>Add Photo/Video</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.attachmentButtonSecondary, { backgroundColor: colors.accent + '15' }]}
              onPress={handlePickFromLibrary}
            >
              <ImageIcon size={20} color={colors.accent} />
              <Text style={[styles.attachmentButtonSecondaryText, { color: colors.accent }]}>Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.attachmentButtonSecondary, { backgroundColor: '#8B5CF6' + '15' }]}
              onPress={handleTakePhoto}
            >
              <Camera size={20} color="#8B5CF6" />
              <Text style={[styles.attachmentButtonSecondaryText, { color: '#8B5CF6' }]}>Camera</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.userSection}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop' }}
            style={[styles.avatar, { backgroundColor: colors.backgroundTertiary }]}
          />
          <View style={styles.userInfo}>
            <Text style={[styles.userName, { color: colors.text }]}>You</Text>
            <TouchableOpacity style={[styles.privacySelector, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {getPrivacyIcon()}
              <Text style={[styles.privacyText, { color: colors.textSecondary }]}>{getPrivacyLabel()}</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.charCountText, { color: colors.textTertiary }]}>
            {content.length}/500
          </Text>
        </View>

        {selectedMedia && (
          <View style={styles.selectedMediaContainer}>
            <Image source={{ uri: selectedMedia.uri }} style={styles.selectedMedia} resizeMode="contain" />
            {selectedMedia.type === 'video' && (
              <View style={[styles.videoIndicator, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                <Text style={styles.videoIndicatorText}>VIDEO</Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.removeMediaButton, { backgroundColor: colors.background }]}
              onPress={handleRemoveMedia}
            >
              <X size={16} color={colors.text} />
            </TouchableOpacity>
          </View>
        )}

        <ScrollView 
          style={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        >
          <TextInput
            ref={inputRef}
            style={[styles.contentInput, { color: colors.text }]}
            placeholder="What's on your mind?"
            placeholderTextColor={colors.textTertiary}
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
  },
  postButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  postButtonDisabled: {
    opacity: 0.5,
  },
  postButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  scrollContent: {
    flex: 1,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  attachmentBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  attachmentHeader: {
    marginBottom: 10,
  },
  attachmentLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  attachmentActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  attachmentButtonMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
  },
  attachmentButtonMainText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  attachmentButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  attachmentButtonSecondaryText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  userInfo: {
    flex: 1,
    gap: 4,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  privacySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  privacyText: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  charCountText: {
    fontSize: 12,
  },
  contentInput: {
    fontSize: 18,
    lineHeight: 26,
    paddingHorizontal: 16,
    paddingTop: 16,
    minHeight: 150,
  },
  selectedMediaContainer: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative' as const,
  },
  selectedMedia: {
    width: '100%',
    height: undefined,
    aspectRatio: undefined,
    minHeight: 150,
    maxHeight: 400,
    borderRadius: 12,
  },
  videoIndicator: {
    position: 'absolute' as const,
    bottom: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  videoIndicatorText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },
  removeMediaButton: {
    position: 'absolute' as const,
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
});
