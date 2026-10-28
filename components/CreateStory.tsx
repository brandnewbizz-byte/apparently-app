// CreateStory.tsx — Story composer: camera, gallery or text, with a preview
// before sharing. Saves through SocialContext.createStory (uploads + 24h expiry).

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  Image,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, Image as ImageIcon, X, Type, Palette, ChevronLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import InstagramCamera, { type CapturedMedia } from '@/components/InstagramCamera';
import { useSocial } from '@/contexts/SocialContext';

const BACKGROUNDS = ['#667eea', '#E1306C', '#F77737', '#10B981', '#0EA5E9', '#111111', '#8B5CF6'];

type Step = 'choose' | 'photo' | 'text';

interface CreateStoryProps {
  visible: boolean;
  onClose: () => void;
  onStoryCreated: () => void;
  /** Shown on the "Your story" share button. */
  myAvatar?: string;
  colors?: {
    background?: string;
    text?: string;
    accent?: string;
    surface?: string;
  };
}

const haptic = () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };

export default function CreateStory({ visible, onClose, onStoryCreated, myAvatar, colors: themeColors }: CreateStoryProps) {
  const insets = useSafeAreaInsets();
  const { createStory } = useSocial();
  const [step, setStep] = useState<Step>('choose');
  const [showCamera, setShowCamera] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [overlayText, setOverlayText] = useState('');
  const [editingOverlay, setEditingOverlay] = useState(false);
  const [storyText, setStoryText] = useState('');
  const [bgIndex, setBgIndex] = useState(0);
  const [sharing, setSharing] = useState(false);

  const accent = themeColors?.accent ?? '#0095F6';

  // Fresh composer every time it opens
  useEffect(() => {
    if (visible) {
      setStep('choose');
      setPhotoUri(null);
      setOverlayText('');
      setEditingOverlay(false);
      setStoryText('');
      setSharing(false);
    }
  }, [visible]);

  const choosePhoto = (uri: string) => {
    setPhotoUri(uri);
    setStep('photo');
  };

  const handleCameraCapture = useCallback((media: CapturedMedia) => {
    setShowCamera(false);
    if (media?.uri) choosePhoto(media.uri);
  }, []);

  const pickFromGallery = useCallback(async () => {
    haptic();
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Photos access needed', 'Allow photo access in Settings to add a picture to your story.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.85 });
      if (!result.canceled && result.assets.length > 0) {
        setShowCamera(false);
        choosePhoto(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Couldn’t open your photos', 'Please try again.');
    }
  }, []);

  const share = async () => {
    if (sharing) return;
    const isText = step === 'text';
    if (isText && !storyText.trim()) return;
    if (!isText && !photoUri) return;
    setSharing(true);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const ok = isText
      ? await createStory(undefined, BACKGROUNDS[bgIndex], storyText.trim())
      : await createStory(photoUri!, undefined, overlayText.trim() || undefined);
    setSharing(false);
    if (ok) {
      onStoryCreated();
    } else {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Story not shared', 'Check your connection and try again.');
    }
  };

  const renderShare = (disabled?: boolean) => (
    <TouchableOpacity
      style={[styles.shareBtn, (disabled || sharing) && { opacity: 0.5 }]}
      onPress={share}
      disabled={disabled || sharing}
      accessibilityLabel="Share to your story"
    >
      {myAvatar ? <Image source={{ uri: myAvatar }} style={styles.shareAvatar} /> : <View style={[styles.shareAvatar, { backgroundColor: accent }]} />}
      <Text style={styles.shareText}>{sharing ? 'Sharing…' : 'Your story'}</Text>
      {sharing ? <ActivityIndicator size="small" color="#000" /> : null}
    </TouchableOpacity>
  );

  return (
    <>
      <Modal visible={visible && !showCamera} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onClose}>
        <View style={styles.root}>
          {/* ── Choose ── */}
          {step === 'choose' ? (
            <View style={[styles.flex, { paddingTop: insets.top + 8 }]}>
              <View style={styles.header}>
                <TouchableOpacity onPress={onClose} style={styles.headerBtn} accessibilityLabel="Close">
                  <X size={26} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Add to story</Text>
                <View style={styles.headerBtn} />
              </View>
              <Text style={styles.subtitle}>Shared with your followers for 24 hours</Text>
              <View style={styles.tiles}>
                <TouchableOpacity style={styles.tile} onPress={() => { haptic(); setShowCamera(true); }}>
                  <View style={[styles.tileIcon, { backgroundColor: '#0095F633' }]}><Camera size={28} color="#4FB6FF" /></View>
                  <Text style={styles.tileTitle}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.tile} onPress={pickFromGallery}>
                  <View style={[styles.tileIcon, { backgroundColor: '#8B5CF633' }]}><ImageIcon size={28} color="#B79CFF" /></View>
                  <Text style={styles.tileTitle}>Gallery</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.tile} onPress={() => { haptic(); setStep('text'); }}>
                  <View style={[styles.tileIcon, { backgroundColor: '#E1306C33' }]}><Type size={28} color="#FF7AA8" /></View>
                  <Text style={styles.tileTitle}>Text</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {/* ── Photo preview ── */}
          {step === 'photo' && photoUri ? (
            <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              <View style={[styles.previewTop, { paddingTop: insets.top + 8 }]}>
                <TouchableOpacity onPress={() => setStep('choose')} style={styles.roundBtn} accessibilityLabel="Back">
                  <ChevronLeft size={26} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setEditingOverlay(true)} style={styles.roundBtn} accessibilityLabel="Add text">
                  <Type size={22} color="#FFF" />
                </TouchableOpacity>
              </View>
              {editingOverlay || overlayText ? (
                <View style={styles.overlayWrap} pointerEvents="box-none">
                  <TextInput
                    value={overlayText}
                    onChangeText={setOverlayText}
                    autoFocus={editingOverlay}
                    onBlur={() => setEditingOverlay(false)}
                    placeholder="Type something…"
                    placeholderTextColor="rgba(255,255,255,0.7)"
                    style={styles.overlayInput}
                    multiline
                    maxLength={200}
                  />
                </View>
              ) : null}
              <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 14 }]}>
                {renderShare()}
              </View>
            </KeyboardAvoidingView>
          ) : null}

          {/* ── Text story ── */}
          {step === 'text' ? (
            <KeyboardAvoidingView style={[styles.flex, { backgroundColor: BACKGROUNDS[bgIndex] }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View style={[styles.previewTop, { paddingTop: insets.top + 8 }]}>
                <TouchableOpacity onPress={() => setStep('choose')} style={styles.roundBtn} accessibilityLabel="Back">
                  <ChevronLeft size={26} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { haptic(); setBgIndex((i) => (i + 1) % BACKGROUNDS.length); }} style={styles.roundBtn} accessibilityLabel="Change background">
                  <Palette size={22} color="#FFF" />
                </TouchableOpacity>
              </View>
              <View style={styles.textArea}>
                <TextInput
                  value={storyText}
                  onChangeText={setStoryText}
                  placeholder="Start typing"
                  placeholderTextColor="rgba(255,255,255,0.6)"
                  style={styles.textInput}
                  multiline
                  autoFocus
                  maxLength={280}
                />
              </View>
              <View style={styles.swatches}>
                {BACKGROUNDS.map((c, i) => (
                  <TouchableOpacity key={c} onPress={() => setBgIndex(i)} style={[styles.swatch, { backgroundColor: c }, i === bgIndex && styles.swatchOn]} accessibilityLabel={`Background ${i + 1}`} />
                ))}
              </View>
              <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 14 }]}>
                {renderShare(!storyText.trim())}
              </View>
            </KeyboardAvoidingView>
          ) : null}
        </View>
      </Modal>

      {/* Camera needs its own full-screen modal (it is a plain view) */}
      <Modal visible={visible && showCamera} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={() => setShowCamera(false)}>
        <InstagramCamera
          visible={showCamera}
          onClose={() => setShowCamera(false)}
          onCapture={handleCameraCapture}
          onPickFromGallery={pickFromGallery}
        />
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  subtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center', marginTop: 8 },
  tiles: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginTop: 48, paddingHorizontal: 20 },
  tile: { flex: 1, maxWidth: 120, aspectRatio: 0.85, borderRadius: 18, backgroundColor: '#1C1C1E', alignItems: 'center', justifyContent: 'center', gap: 12 },
  tileIcon: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  tileTitle: { color: '#FFF', fontSize: 15, fontWeight: '700' },

  previewTop: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12 },
  roundBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  overlayWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  overlayInput: {
    color: '#FFF', fontSize: 26, fontWeight: '800', textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6,
  },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'flex-end', paddingHorizontal: 16 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF', borderRadius: 24, paddingLeft: 6, paddingRight: 16, height: 46 },
  shareAvatar: { width: 34, height: 34, borderRadius: 17 },
  shareText: { color: '#000', fontSize: 15, fontWeight: '700' },

  textArea: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  textInput: { color: '#FFF', fontSize: 30, lineHeight: 38, fontWeight: '800', textAlign: 'center' },
  swatches: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 76 },
  swatch: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' },
  swatchOn: { borderColor: '#FFF', transform: [{ scale: 1.2 }] },
});
