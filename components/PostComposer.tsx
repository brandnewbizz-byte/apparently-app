// PostComposer.tsx — Instagram-style single-screen post composer
// Replaces the old inline CreatePostModal. Photos + caption + category, one clean screen.
// v2: 9:16 Reels-style preview with nudge reposition

import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Image as RNImage,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Move,
} from 'lucide-react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// 9:16 Reels-style container
const COMPOSER_PADDING = 16;
const CONTAINER_WIDTH = SCREEN_WIDTH - COMPOSER_PADDING * 2;
const FEED_ASPECT = 9 / 16;
const CONTAINER_HEIGHT = Math.round(CONTAINER_WIDTH / FEED_ASPECT);
const CROP_NUDGE = 24; // pixels per reposition step

export const POST_CATEGORIES = [
  { key: 'For Sale', label: '🏷️ For Sale', color: '#4CAF50', bg: '#1B5E20' },
  { key: 'Event', label: '📅 Event', color: '#2196F3', bg: '#0D47A1' },
  { key: 'Question', label: '❓ Question', color: '#FF9800', bg: '#E65100' },
  { key: 'Update', label: '💬 Update', color: '#9C27B0', bg: '#4A148C' },
  { key: 'Showcase', label: '✨ Showcase', color: '#E91E63', bg: '#880E4F' },
  { key: 'Looking For', label: '🔍 Looking For', color: '#00BCD4', bg: '#006064' },
];

interface PostComposerProps {
  visible: boolean;
  onClose: () => void;
  onPost: (data: { caption: string; mediaUri?: string; mediaWidth?: number; mediaHeight?: number; category: string }) => void;
  preloadMediaUri?: string | null;
  preloadMediaWidth?: number;
  preloadMediaHeight?: number;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
}

export default function PostComposer({
  visible,
  onClose,
  onPost,
  preloadMediaUri,
  preloadMediaWidth,
  preloadMediaHeight,
  backgroundColor = '#000',
  textColor = '#FFF',
  accentColor = '#2196F3',
}: PostComposerProps) {
  const insets = useSafeAreaInsets();
  const captionRef = useRef<TextInput>(null);
  const [caption, setCaption] = useState('');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaDims, setMediaDims] = useState<{ width: number; height: number } | null>(null);
  const [category, setCategory] = useState('General');
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });

  // Calculate cover sizing for 9:16 container + max pan limits
  const coverCalc = useMemo(() => {
    if (!mediaDims || mediaDims.width === 0 || mediaDims.height === 0) {
      return { displayW: 0, displayH: 0, maxX: 0, maxY: 0 };
    }
    const imgAspect = mediaDims.width / mediaDims.height;
    const containerAspect = FEED_ASPECT; // 9/16
    let displayW: number, displayH: number, maxX: number, maxY: number;
    if (imgAspect > containerAspect) {
      // Image is wider than 9:16 → scale by height, image overflows horizontally
      displayH = CONTAINER_HEIGHT;
      displayW = CONTAINER_HEIGHT * imgAspect;
      maxX = (displayW - CONTAINER_WIDTH) / 2;
      maxY = 0;
    } else {
      // Image is taller than 9:16 → scale by width, image overflows vertically
      displayW = CONTAINER_WIDTH;
      displayH = CONTAINER_WIDTH / imgAspect;
      maxX = 0;
      maxY = (displayH - CONTAINER_HEIGHT) / 2;
    }
    return { displayW, displayH, maxX, maxY };
  }, [mediaDims]);

  const nudgeCrop = (dx: number, dy: number) => {
    setCropOffset(prev => ({
      x: Math.max(-coverCalc.maxX, Math.min(coverCalc.maxX, prev.x + dx)),
      y: Math.max(-coverCalc.maxY, Math.min(coverCalc.maxY, prev.y + dy)),
    }));
  };

  // Reset crop when media changes
  useEffect(() => { setCropOffset({ x: 0, y: 0 }); }, [mediaUri]);

  // Preload media when camera capture provides a photo
  useEffect(() => {
    if (visible && preloadMediaUri) {
      setMediaUri(preloadMediaUri);
      if (preloadMediaWidth && preloadMediaHeight) {
        setMediaDims({ width: preloadMediaWidth, height: preloadMediaHeight });
      }
      setTimeout(() => captionRef.current?.focus(), 300);
    }
  }, [visible, preloadMediaUri, preloadMediaWidth, preloadMediaHeight]);

  const handlePost = () => {
    if (!caption.trim() && !mediaUri) return;
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    onPost({ caption: caption.trim(), mediaUri: mediaUri ?? undefined, mediaWidth: mediaDims?.width, mediaHeight: mediaDims?.height, category });
    // Reset state
    setCaption('');
    setMediaUri(null);
    setMediaDims(null);
    setCropOffset({ x: 0, y: 0 });
    setCategory('General');
  };

  const handleClose = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setCaption('');
    setMediaUri(null);
    setMediaDims(null);
    setCropOffset({ x: 0, y: 0 });
    setCategory('General');
    onClose();
  };

  const canPost = caption.trim().length > 0 || mediaUri != null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={[styles.root, { backgroundColor }]}>
        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={handleClose} style={styles.headerBtn}>
            <Text style={[styles.headerBtnText, { color: textColor, opacity: 0.7 }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: textColor }]}>New Post</Text>
          <TouchableOpacity
            onPress={handlePost}
            disabled={!canPost}
            style={[
              styles.shareBtn,
              { backgroundColor: canPost ? accentColor : 'rgba(255,255,255,0.15)', opacity: canPost ? 1 : 0.5 },
            ]}
          >
            <Text style={[styles.shareBtnText, { color: canPost ? '#FFF' : 'rgba(255,255,255,0.4)' }]}>
              Share
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Body ── */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.body}
        >
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ── Photo Preview (9:16 Reels-style with reposition) ── */}
            {mediaUri ? (
              <View style={styles.photoSection}>
                {/* 9:16 clipped container */}
                <View style={styles.cropContainer}>
                  {mediaDims && coverCalc.displayW > 0 ? (
                    <RNImage
                      source={{ uri: mediaUri }}
                      style={{
                        width: coverCalc.displayW,
                        height: coverCalc.displayH,
                        position: 'absolute',
                        left: -(coverCalc.displayW - CONTAINER_WIDTH) / 2 + cropOffset.x,
                        top: -(coverCalc.displayH - CONTAINER_HEIGHT) / 2 + cropOffset.y,
                      }}
                    />
                  ) : (
                    <RNImage source={{ uri: mediaUri }} style={styles.coverPreview} resizeMode="cover" />
                  )}
                </View>
                {/* Reposition controls */}
                {(coverCalc.maxX > 0 || coverCalc.maxY > 0) && (
                  <View style={styles.repositionRow}>
                    <View style={styles.repositionHint}>
                      <Move size={14} color="rgba(255,255,255,0.5)" />
                      <Text style={styles.repositionHintText}>Reposition</Text>
                    </View>
                    <View style={styles.nudgeRow}>
                      <TouchableOpacity style={styles.nudgeBtn} onPress={() => nudgeCrop(-CROP_NUDGE, 0)}>
                        <ChevronLeft size={18} color="#FFF" />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.nudgeBtn} onPress={() => nudgeCrop(0, -CROP_NUDGE)}>
                        <ChevronUp size={18} color="#FFF" />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.nudgeBtn} onPress={() => nudgeCrop(0, CROP_NUDGE)}>
                        <ChevronDown size={18} color="#FFF" />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.nudgeBtn} onPress={() => nudgeCrop(CROP_NUDGE, 0)}>
                        <ChevronRight size={18} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            ) : (
              <View style={[styles.photoPlaceholder, { borderColor: 'rgba(255,255,255,0.1)' }]}>
                <Text style={styles.photoPlaceholderIcon}>📷</Text>
                <Text style={[styles.photoPlaceholderText, { color: 'rgba(255,255,255,0.3)' }]}>
                  Add a photo
                </Text>
              </View>
            )}

            {/* ── Caption Input ── */}
            <TextInput
              ref={captionRef}
              style={[styles.captionInput, { color: textColor, backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.08)' }]}
              placeholder="Write a caption…"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={caption}
              onChangeText={setCaption}
              multiline
              maxLength={500}
              textAlignVertical="top"
              scrollEnabled={false}
            />

            {/* ── Category Chips ── */}
            <Text style={[styles.sectionLabel, { color: textColor, opacity: 0.5 }]}>CATEGORY</Text>
            <View style={styles.chips}>
              {POST_CATEGORIES.map((cat) => {
                const active = category === cat.key;
                return (
                  <TouchableOpacity
                    key={cat.key}
                    onPress={() => setCategory(active ? 'General' : cat.key)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? cat.bg : 'rgba(255,255,255,0.06)',
                        borderColor: active ? cat.color : 'rgba(255,255,255,0.08)',
                      },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, { color: active ? cat.color : 'rgba(255,255,255,0.5)' }]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerBtn: { paddingVertical: 6, paddingHorizontal: 4, minWidth: 60 },
  headerBtnText: { fontSize: 16, fontWeight: '500' },
  headerTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  shareBtn: {
    paddingHorizontal: 20,
    paddingVertical: 7,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
  },
  shareBtnText: { fontSize: 14, fontWeight: '700' },
  body: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, gap: 16 },
  photoContainer: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
  },
  photo: { width: '100%', aspectRatio: 1 },
  photoPlaceholder: {
    width: '100%',
    height: SCREEN_WIDTH * 0.75,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoPlaceholderIcon: { fontSize: 40 },
  photoPlaceholderText: { fontSize: 15, fontWeight: '500' },
  captionInput: {
    fontSize: 16,
    lineHeight: 22,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 80,
    maxHeight: 140,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: '600' },

  // 9:16 Reels-style reposition controls
  photoSection: { gap: 8 },
  cropContainer: {
    width: CONTAINER_WIDTH,
    height: CONTAINER_HEIGHT,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  coverPreview: { width: '100%', height: '100%' },
  repositionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  repositionHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  repositionHintText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
  nudgeRow: {
    flexDirection: 'row',
    gap: 4,
  },
  nudgeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
