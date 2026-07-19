import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Platform,
  PanResponder,
  TextInput,
  Image,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { 
  X, 
  Calendar, 
  PenSquare,
  DollarSign,
  UserPlus,
  Camera,
  Image as ImageIcon,
  Send,
  ArrowLeft,
  Sparkles,
  Video,
  Music,
  Hash,
  AtSign,
  Smile,
  MapPin,
  Upload,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSocial } from '@/contexts/SocialContext';
import { useTheme } from '@/contexts/ThemeContext';

interface QuickAddModalProps {
  visible: boolean;
  onClose: () => void;
}

type ViewState = 'menu' | 'post' | 'story';

const SAMPLE_IMAGES = [
  'https://images.unsplash.com/photo-1574672280600-4accfa5b6f98?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?w=600&h=400&fit=crop',
];

const STORY_BACKGROUNDS = [
  '#1a1a2e',
  '#16213e',
  '#0f3460',
  '#533483',
  '#e94560',
  '#0f4c75',
  '#3282b8',
  '#00b4d8',
  '#06d6a0',
  '#ffd166',
  '#ef476f',
  '#118ab2',
];

export default function QuickAddModal({ visible, onClose }: QuickAddModalProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { createPost, createStory } = useSocial();
  const { colors, isDark } = useTheme();
  
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  
  const [viewState, setViewState] = useState<ViewState>('menu');
  const [postText, setPostText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [storyText, setStoryText] = useState('');
  const [selectedBg, setSelectedBg] = useState(STORY_BACKGROUNDS[0]);

  useEffect(() => {
    if (visible) {
      panY.setValue(0);
      setViewState('menu');
      setPostText('');
      setSelectedImage(null);
      setShowImagePicker(false);
      setStoryText('');
      setSelectedBg(STORY_BACKGROUNDS[0]);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
      ]).start();
    } else {
      slideAnim.setValue(0);
      fadeAnim.setValue(0);
      panY.setValue(0);
      scaleAnim.setValue(0.9);
    }
  }, [visible, slideAnim, fadeAnim, panY, scaleAnim]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  };

  const handleAction = (route: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onClose();
    setTimeout(() => {
      router.push(route as Parameters<typeof router.push>[0]);
    }, 250);
  };

  const handleCreatePost = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setViewState('post');
  };

  const handleCreateStory = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setViewState('story');
  };

  const handleBackToMenu = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setViewState('menu');
    setPostText('');
    setSelectedImage(null);
    setShowImagePicker(false);
    setStoryText('');
  };

  const handleSubmitPost = () => {
    if (!postText.trim()) {
      Alert.alert('Empty Post', 'Please write something to share.');
      return;
    }
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    createPost(postText.trim(), selectedImage || undefined);
    console.log('[QuickAdd] Post created', { postText, selectedImage });
    handleClose();
  };

  const handleSubmitStory = () => {
    if (!storyText.trim()) {
      Alert.alert('Empty Story', 'Please write something to share.');
      return;
    }
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    createStory(undefined, selectedBg, storyText.trim());
    console.log('[QuickAdd] Story created', { storyText, selectedBg });
    handleClose();
  };

  const handleSelectImage = (img: string) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    setSelectedImage(selectedImage === img ? null : img);
    setShowImagePicker(false);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          panY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          Animated.parallel([
            Animated.timing(panY, {
              toValue: 500,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start(() => {
            panY.setValue(0);
            onClose();
          });
        } else {
          Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 10,
          }).start();
        }
      },
    })
  ).current;

  const translateY = Animated.add(
    slideAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [500, 0],
    }),
    panY
  );

  const renderMenu = () => (
    <View style={styles.menuContainer}>
      <View style={styles.modalHandle} />
      
      <View style={styles.menuHeader}>
        <Text style={[styles.menuTitle, { color: colors.text }]}>Create</Text>
        <TouchableOpacity 
          onPress={handleClose} 
          style={[styles.closeButton, { backgroundColor: colors.backgroundSecondary }]}
        >
          <X size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.createSection}>
        <TouchableOpacity 
          style={[styles.createCard, { backgroundColor: isDark ? '#1E3A5F' : '#E8F4FD' }]} 
          onPress={handleCreatePost}
          activeOpacity={0.8}
        >
          <View style={[styles.createIconWrap, { backgroundColor: '#0095F6' }]}>
            <PenSquare size={24} color="#FFFFFF" />
          </View>
          <View style={styles.createCardContent}>
            <Text style={[styles.createCardTitle, { color: colors.text }]}>Post</Text>
            <Text style={[styles.createCardSubtitle, { color: colors.textSecondary }]}>Share your thoughts</Text>
          </View>
          <Sparkles size={18} color="#0095F6" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.createCard, { backgroundColor: isDark ? '#3D1E42' : '#FCE4EC' }]} 
          onPress={handleCreateStory}
          activeOpacity={0.8}
        >
          <View style={[styles.createIconWrap, { backgroundColor: '#E91E63' }]}>
            <Camera size={24} color="#FFFFFF" />
          </View>
          <View style={styles.createCardContent}>
            <Text style={[styles.createCardTitle, { color: colors.text }]}>Story</Text>
            <Text style={[styles.createCardSubtitle, { color: colors.textSecondary }]}>Share a moment</Text>
          </View>
          <Video size={18} color="#E91E63" />
        </TouchableOpacity>
      </View>

      <View style={styles.quickActionsSection}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          <TouchableOpacity
            style={[styles.quickActionItem, { backgroundColor: colors.backgroundSecondary }]}
            onPress={() => handleAction('/(tabs)/profile/add-bill')}
            activeOpacity={0.7}
          >
            <View style={[styles.quickActionIconWrap, { backgroundColor: 'rgba(46, 213, 115, 0.15)' }]}>
              <DollarSign size={22} color="#2ED573" />
            </View>
            <Text style={[styles.quickActionLabel, { color: colors.text }]}>Bill</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickActionItem, { backgroundColor: colors.backgroundSecondary }]}
            onPress={() => handleAction('/(tabs)/profile/add-event')}
            activeOpacity={0.7}
          >
            <View style={[styles.quickActionIconWrap, { backgroundColor: 'rgba(123, 97, 255, 0.15)' }]}>
              <Calendar size={22} color="#7B61FF" />
            </View>
            <Text style={[styles.quickActionLabel, { color: colors.text }]}>Event</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickActionItem, { backgroundColor: colors.backgroundSecondary }]}
            onPress={() => handleAction('/(tabs)/profile/add-contact')}
            activeOpacity={0.7}
          >
            <View style={[styles.quickActionIconWrap, { backgroundColor: 'rgba(255, 152, 0, 0.15)' }]}>
              <UserPlus size={22} color="#FF9800" />
            </View>
            <Text style={[styles.quickActionLabel, { color: colors.text }]}>Contact</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickActionItem, { backgroundColor: colors.backgroundSecondary }]}
            onPress={() => handleAction('/(tabs)/profile/import-lead')}
            activeOpacity={0.7}
          >
            <View style={[styles.quickActionIconWrap, { backgroundColor: 'rgba(0, 212, 255, 0.15)' }]}>
              <Upload size={22} color="#00D4FF" />
            </View>
            <Text style={[styles.quickActionLabel, { color: colors.text }]}>Lead</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderPostCompose = () => (
    <KeyboardAvoidingView 
      style={[styles.fullScreenCompose, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.fullScreenHeader, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity 
          onPress={handleBackToMenu} 
          style={[styles.backButton, { backgroundColor: colors.backgroundSecondary }]}
        >
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.composeTitle, { color: colors.text }]}>New Post</Text>
        <TouchableOpacity
          style={[styles.submitButton, !postText.trim() && styles.submitButtonDisabled]}
          onPress={handleSubmitPost}
          disabled={!postText.trim()}
        >
          <Send size={18} color="#FFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.fullScreenInputArea}>
        <View style={styles.postInputSection}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop' }}
            style={styles.postAvatar}
          />
          <TextInput
            style={[styles.postInputFull, { color: colors.text }]}
            placeholder="What's happening?"
            placeholderTextColor={colors.textTertiary}
            value={postText}
            onChangeText={setPostText}
            multiline
            autoFocus
            textAlignVertical="top"
          />
        </View>

        {selectedImage && (
          <View style={styles.selectedImageContainerFull}>
            <Image source={{ uri: selectedImage }} style={styles.selectedImageFull} />
            <TouchableOpacity 
              style={styles.removeImageBtn} 
              onPress={() => setSelectedImage(null)}
            >
              <X size={16} color="#FFF" />
            </TouchableOpacity>
          </View>
        )}

        {showImagePicker && (
          <View style={[styles.imagePickerContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.imagePickerLabel, { color: colors.textSecondary }]}>Add a photo</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              contentContainerStyle={styles.imagePickerContent}
            >
              {SAMPLE_IMAGES.map((img, i) => (
                <TouchableOpacity 
                  key={i} 
                  onPress={() => handleSelectImage(img)} 
                  style={[
                    styles.imagePickerItem, 
                    selectedImage === img && { borderColor: colors.accent, borderWidth: 2 }
                  ]}
                >
                  <Image source={{ uri: img }} style={styles.imagePickerThumb} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      <View style={[styles.fullScreenFooter, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
        <View style={styles.footerActions}>
          <TouchableOpacity
            style={[styles.footerBtn, showImagePicker && { backgroundColor: colors.accent + '20' }]}
            onPress={() => setShowImagePicker(!showImagePicker)}
          >
            <ImageIcon size={22} color={showImagePicker ? colors.accent : colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.footerBtn}>
            <Hash size={22} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.footerBtn}>
            <AtSign size={22} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.footerBtn}>
            <MapPin size={22} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.footerBtn}>
            <Smile size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <Text style={[styles.charCount, { color: colors.textTertiary }]}>
          {postText.length}/500
        </Text>
      </View>
    </KeyboardAvoidingView>
  );

  const renderStoryCompose = () => (
    <KeyboardAvoidingView 
      style={[styles.fullScreenCompose, { backgroundColor: selectedBg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.fullScreenHeader, { paddingTop: insets.top + 8, borderBottomColor: 'rgba(255,255,255,0.2)' }]}>
        <TouchableOpacity 
          onPress={handleBackToMenu} 
          style={[styles.backButton, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
        >
          <ArrowLeft size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={[styles.composeTitle, { color: '#FFFFFF' }]}>Add Story</Text>
        <TouchableOpacity
          style={[styles.submitButton, !storyText.trim() && styles.submitButtonDisabled]}
          onPress={handleSubmitStory}
          disabled={!storyText.trim()}
        >
          <Send size={18} color="#FFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.storyPreviewFull}>
        <TextInput
          style={styles.storyInput}
          placeholder="Type your story..."
          placeholderTextColor="rgba(255,255,255,0.5)"
          value={storyText}
          onChangeText={setStoryText}
          multiline
          textAlign="center"
          autoFocus
        />
      </View>

      <View style={[styles.bgSelectorContainerFull, { backgroundColor: colors.surface }]}>
        <View style={styles.bgSelectorHeader}>
          <Text style={[styles.bgLabel, { color: colors.textSecondary }]}>Background</Text>
          <View style={styles.storyToolbar}>
            <TouchableOpacity style={styles.toolbarBtn}>
              <Music size={18} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolbarBtn}>
              <Smile size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.bgList}
        >
          {STORY_BACKGROUNDS.map((bg, i) => (
            <TouchableOpacity
              key={i}
              style={[
                styles.bgOption,
                { backgroundColor: bg },
                selectedBg === bg && styles.bgOptionSelected,
              ]}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.selectionAsync();
                setSelectedBg(bg);
              }}
            />
          ))}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );

  if (viewState === 'post' || viewState === 'story') {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent
        onRequestClose={handleBackToMenu}
      >
        {viewState === 'post' && renderPostCompose()}
        {viewState === 'story' && renderStoryCompose()}
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity 
          style={styles.overlayTouch} 
          onPress={handleClose} 
          activeOpacity={1} 
        />
        <Animated.View 
          style={[
            styles.modalContainer,
            { 
              transform: [{ translateY }, { scale: scaleAnim }], 
              backgroundColor: colors.surface, 
              paddingBottom: insets.bottom + 16 
            },
          ]}
          {...panResponder.panHandlers}
        >
          {renderMenu()}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  overlayTouch: {
    flex: 1,
  },
  modalContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: 350,
    maxHeight: '90%',
  },
  fullScreenCompose: {
    flex: 1,
  },
  fullScreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  fullScreenInputArea: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  postInputFull: {
    flex: 1,
    fontSize: 17,
    lineHeight: 24,
    minHeight: 120,
  },
  selectedImageContainerFull: {
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  selectedImageFull: {
    width: '100%',
    height: 200,
    borderRadius: 16,
  },
  imagePickerContainer: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  imagePickerLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    marginBottom: 10,
  },
  fullScreenFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  storyPreviewFull: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  bgSelectorContainerFull: {
    padding: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(128, 128, 128, 0.4)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  menuContainer: {
    paddingHorizontal: 20,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    marginTop: 8,
  },
  menuTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createSection: {
    gap: 12,
    marginBottom: 28,
  },
  createCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 14,
  },
  createIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createCardContent: {
    flex: 1,
  },
  createCardTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    marginBottom: 2,
  },
  createCardSubtitle: {
    fontSize: 13,
  },
  quickActionsSection: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 10,
  },
  quickActionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  composeContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  composeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composeTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  submitButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#0095F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  composeBody: {
    flex: 1,
  },
  postInputSection: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  postAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E0E0E0',
  },
  postInput: {
    flex: 1,
    fontSize: 17,
    lineHeight: 24,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  selectedImageContainer: {
    marginTop: 8,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  selectedImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
  },
  removeImageBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePickerRow: {
    marginTop: 12,
  },
  imagePickerContent: {
    gap: 10,
    paddingVertical: 4,
  },
  imagePickerItem: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  imagePickerThumb: {
    width: 90,
    height: 90,
    borderRadius: 12,
  },
  composeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    borderTopWidth: 1,
    marginTop: 8,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 4,
  },
  footerBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  charCount: {
    fontSize: 13,
  },
  storyComposeContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  storyPreview: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 280,
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  storyInput: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    textAlign: 'center',
    width: '100%',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  bgSelectorContainer: {
    padding: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  bgSelectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  bgLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  storyToolbar: {
    flexDirection: 'row',
    gap: 8,
  },
  toolbarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(128,128,128,0.1)',
  },
  bgList: {
    gap: 12,
    paddingBottom: 8,
  },
  bgOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  bgOptionSelected: {
    borderColor: '#FFFFFF',
    borderWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
});
