// InstagramCamera.tsx — Full-screen camera viewfinder
// Flash toggle · Flip camera · Grid overlay · Pinch-to-zoom · Capture
// 9:16 crop overlay · Swipe-to-dismiss · Post-capture crop
// v2 — iPhone-quality: continuous AF, tap-to-focus, lens stepping, focus indicator

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image as RNImage,
  StatusBar,
  Dimensions,
  Platform,
  GestureResponderEvent,
  Animated,
} from 'react-native';
import { CameraView, CameraType, FlashMode } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import {
  X, Zap, ZapOff, RefreshCw, Grid3x3, Image as ImageIcon,
} from 'lucide-react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ── Constants ──
const FEED_ASPECT = 9 / 16;               // 9:16 Reels-style
const CROP_OVERLAY_TOP = (SCREEN_HEIGHT - SCREEN_WIDTH / FEED_ASPECT) / 2;
const CROP_OVERLAY_BOTTOM = CROP_OVERLAY_TOP;
const SWIPE_THRESHOLD = 100;               // px to trigger dismiss
const FOCUS_SQUARE_SIZE = 72;              // size of tap-to-focus indicator
const FOCUS_ANIM_DURATION = 200;           // ms for focus square appear
const FOCUS_FADE_DELAY = 800;             // ms before focus square fades out

// ── Types ──
export interface CapturedMedia {
  uri: string;
  width: number;
  height: number;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onCapture: (media: CapturedMedia) => void;
  onPickFromGallery: () => void;
}

// Lens presets (0-1 range mapped to device zoom)
const LENS_PRESETS = [
  { label: '0.5', zoom: 0 },       // Ultra-wide
  { label: '1', zoom: 1 / 9 },     // Standard wide (default)
  { label: '2', zoom: 2 / 9 },     // 2× tele
] as const;

// ── Component ──
export default function InstagramCamera({ visible, onClose, onCapture, onPickFromGallery }: Props) {
  const cameraRef = useRef<CameraView>(null);
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [showGrid, setShowGrid] = useState(true);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [capturedDimensions, setCapturedDimensions] = useState({ width: 0, height: 0 });
  const [isReady, setIsReady] = useState(false);
  const [permission, setPermission] = useState(false);

  // ── Zoom with lens-step awareness ──
  const DEFAULT_ZOOM = 1 / 9; // 1× standard lens
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const pinchRef = useRef({ initialDistance: 0, initialZoom: 0 });

  // ── Tap-to-focus state ──
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const focusOpacity = useRef(new Animated.Value(0)).current;
  const focusScale = useRef(new Animated.Value(0.5)).current;
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Swipe-to-dismiss state ──
  const swipeTranslateX = useRef(new Animated.Value(0)).current;
  const swipeRef = useRef({ startX: 0, currentX: 0, active: false });

  // ── Permissions ──
  useEffect(() => {
    if (!visible) return;
    (async () => {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      setPermission(status === 'granted');
    })();
  }, [visible]);

  // ── Reset state when modal opens ──
  useEffect(() => {
    if (visible) {
      setCapturedUri(null);
      setIsReady(false);
      setZoom(DEFAULT_ZOOM);
      setFocusPoint(null);
      swipeTranslateX.setValue(0);
    }
  }, [visible]);

  // ── Tap-to-focus animation ──
  const triggerFocusIndicator = useCallback((x: number, y: number) => {
    // Cancel any existing animation
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    
    setFocusPoint({ x, y });
    focusScale.setValue(1.2);
    focusOpacity.setValue(0);
    
    // Animate in: scale down + fade in (emulates iPhone focus lock)
    Animated.parallel([
      Animated.spring(focusScale, {
        toValue: 1.0,
        tension: 200,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(focusOpacity, {
        toValue: 0.9,
        duration: FOCUS_ANIM_DURATION,
        useNativeDriver: true,
      }),
    ]).start();

    // Animate out after delay
    focusTimerRef.current = setTimeout(() => {
      Animated.timing(focusOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        setFocusPoint(null);
      });
    }, FOCUS_FADE_DELAY);
  }, [focusOpacity, focusScale]);

  // ── Pinch-to-zoom helpers ──
  const getTouchDistance = (touches: React.TouchList | any[]) => {
    if (!touches || touches.length < 2) return 0;
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: GestureResponderEvent) => {
    const touches = e.nativeEvent.touches;
    if (touches && touches.length === 2) {
      // Pinch-to-zoom
      pinchRef.current.initialDistance = getTouchDistance(touches);
      pinchRef.current.initialZoom = zoom;
      swipeRef.current.active = false;
    } else if (touches && touches.length === 1) {
      // Single tap → set focus point
      const { pageX, pageY } = touches[0];
      
      // Only focus within the 9:16 crop area
      if (pageY > CROP_OVERLAY_TOP && pageY < SCREEN_HEIGHT - CROP_OVERLAY_BOTTOM) {
        triggerFocusIndicator(pageX, pageY);
        
        // Trigger autofocus on tap (refocus at point)
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      // Also track swipe
      swipeRef.current.startX = pageX;
      swipeRef.current.currentX = pageX;
      swipeRef.current.active = true;
    }
  };

  const handleTouchMove = (e: GestureResponderEvent) => {
    const touches = e.nativeEvent.touches;

    if (touches && touches.length === 2 && pinchRef.current.initialDistance > 0) {
      // Pinch-to-zoom — 2 fingers
      swipeRef.current.active = false;
      const currentDistance = getTouchDistance(touches);
      const scale = currentDistance / pinchRef.current.initialDistance;
      const sensitivity = 1.8;
      const calculated = pinchRef.current.initialZoom + (scale - 1) * sensitivity;
      setZoom(Math.min(1, Math.max(0, calculated)));
    } else if (touches && touches.length === 1 && swipeRef.current.active) {
      // Single-finger swipe
      swipeRef.current.currentX = touches[0].pageX;
      const dx = swipeRef.current.currentX - swipeRef.current.startX;
      // Only track leftward (negative) swipe — Instagram-style dismiss
      if (dx < 0) {
        swipeTranslateX.setValue(dx);
      }
    }
  };

  const handleTouchEnd = () => {
    // Check swipe for dismiss
    if (swipeRef.current.active) {
      const dx = swipeRef.current.currentX - swipeRef.current.startX;
      if (dx < -SWIPE_THRESHOLD) {
        Animated.timing(swipeTranslateX, {
          toValue: -SCREEN_WIDTH,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          onClose();
        });
        return;
      }
      Animated.spring(swipeTranslateX, {
        toValue: 0,
        tension: 100,
        friction: 12,
        useNativeDriver: true,
      }).start();
    }

    pinchRef.current.initialDistance = 0;
    swipeRef.current.active = false;
  };

  // ── Lens step tap (0.5× / 1× / 2×) ──
  const handleLensStep = useCallback((newZoom: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setZoom(newZoom);
  }, []);

  // ── Capture photo ──
  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || !isReady) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      // Take at maximum quality — no skipProcessing, full quality
      const photo = await cameraRef.current.takePictureAsync({
        quality: 1.0,
      });
      const { width: rawW, height: rawH } = photo;

      // ── Crop to Instagram-style 9:16 centered ──
      const targetAspect = FEED_ASPECT; // 9/16 = 0.5625
      const rawAspect = rawW / rawH;

      let cropW: number;
      let cropH: number;
      let originX: number;
      let originY: number;

      if (rawAspect > targetAspect) {
        // Image is wider than 9:16 → crop sides
        cropH = rawH;
        cropW = Math.round(rawH * targetAspect);
        originX = Math.round((rawW - cropW) / 2);
        originY = 0;
      } else {
        // Image is taller than 9:16 → crop top/bottom
        cropW = rawW;
        cropH = Math.round(rawW / targetAspect);
        originX = 0;
        originY = Math.round((rawH - cropH) / 2);
      }

      try {
        const cropped = await manipulateAsync(
          photo.uri,
          [{ crop: { originX, originY, width: cropW, height: cropH } }],
          { compress: 1.0, format: SaveFormat.JPEG },
        );
        setCapturedUri(cropped.uri);
        setCapturedDimensions({ width: cropped.width, height: cropped.height });
      } catch {
        // Fallback: use original with crop dims
        setCapturedUri(photo.uri);
        setCapturedDimensions({ width: cropW, height: cropH });
      }
    } catch (_) {
      // Capture failed silently — stay on camera
    }
  }, [isReady]);

  // ── Use captured photo ──
  const handleUsePhoto = () => {
    if (!capturedUri) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onCapture({
      uri: capturedUri,
      width: capturedDimensions.width,
      height: capturedDimensions.height,
    });
  };

  // ── Retake ──
  const handleRetake = () => {
    setCapturedUri(null);
    setZoom(DEFAULT_ZOOM);
    setFocusPoint(null);
  };

  // ── Flash cycling: off → on → auto → off ──
  const cycleFlash = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFlash((prev) => (prev === 'off' ? 'on' : prev === 'on' ? 'auto' : 'off'));
  };

  // ── Flip camera ──
  const flipCamera = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  };

  // ── Toggle grid ──
  const toggleGrid = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowGrid((prev) => !prev);
  };

  // ── Not visible ──
  if (!visible) return null;

  // ── Permission denied ──
  if (!permission) {
    return (
      <View style={styles.fullScreen}>
        <StatusBar barStyle="light-content" />
        <View style={[styles.fullScreen, styles.centered, { backgroundColor: '#000' }]}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <X size={28} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.permTitle}>Camera Access Needed</Text>
          <Text style={styles.permSub}>
            Allow camera access in your device settings to take photos.
          </Text>
          <TouchableOpacity style={styles.galleryBtnLarge} onPress={onPickFromGallery}>
            <ImageIcon size={20} color="#000" />
            <Text style={styles.galleryBtnLargeText}>Choose from Gallery</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Preview mode (after capture) ──
  if (capturedUri) {
    return (
      <View style={styles.fullScreen}>
        <StatusBar barStyle="light-content" />
        <RNImage source={{ uri: capturedUri }} style={styles.fullScreen} resizeMode="contain" />

        {/* Top bar */}
        <View style={styles.previewTopBar}>
          <TouchableOpacity style={styles.previewBtn} onPress={handleRetake}>
            <X size={26} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.previewTitle}>Preview</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Bottom actions */}
        <View style={styles.previewBottom}>
          <TouchableOpacity style={styles.retakeRow} onPress={handleRetake}>
            <RefreshCw size={20} color="#FFF" />
            <Text style={styles.retakeText}>Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.usePhotoBtn} onPress={handleUsePhoto}>
            <Text style={styles.usePhotoText}>Use Photo</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Camera viewfinder with swipe-to-dismiss ──
  return (
    <Animated.View style={[styles.fullScreen, { transform: [{ translateX: swipeTranslateX }] }]}>
      <StatusBar barStyle="light-content" />

      <CameraView
        ref={cameraRef}
        style={styles.fullScreen}
        facing={facing}
        flash={flash}
        mode="picture"
        ratio="4:3"
        zoom={zoom}
        autofocus="off"
        onCameraReady={() => setIsReady(true)}
      >
        {/* Pinch-to-zoom + tap-to-focus + swipe touch layer */}
        <View
          style={StyleSheet.absoluteFill}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          pointerEvents="auto"
        />

        {/* ── Tap-to-focus indicator (iPhone-style yellow square) ── */}
        {focusPoint && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.focusSquare,
              {
                left: focusPoint.x - FOCUS_SQUARE_SIZE / 2,
                top: focusPoint.y - FOCUS_SQUARE_SIZE / 2,
                opacity: focusOpacity,
                transform: [{ scale: focusScale }],
              },
            ]}
          >
            {/* Outer square */}
            <View style={styles.focusSquareOuter} />
            {/* Inner crosshair */}
            <View style={styles.focusCrosshairH} />
            <View style={styles.focusCrosshairV} />
          </Animated.View>
        )}

        {/* Grid overlay */}
        {showGrid && (
          <View style={styles.gridOverlay}>
            <View style={styles.gridRow}>
              <View style={styles.gridCell} />
              <View style={styles.gridCell} />
              <View style={styles.gridCell} />
            </View>
            <View style={styles.gridRow}>
              <View style={styles.gridCell} />
              <View style={styles.gridCell} />
              <View style={styles.gridCell} />
            </View>
            <View style={styles.gridRow}>
              <View style={styles.gridCell} />
              <View style={styles.gridCell} />
              <View style={styles.gridCell} />
            </View>
          </View>
        )}

        {/* ── 9:16 crop overlay matte ── */}
        <View style={styles.cropMatteTop} pointerEvents="none" />
        <View style={styles.cropMatteBottom} pointerEvents="none" />
        <View style={styles.cropBorderTop} pointerEvents="none" />
        <View style={styles.cropBorderBottom} pointerEvents="none" />

        {/* Top controls */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.topBtn} onPress={onClose}>
            <X size={28} color="#FFF" />
          </TouchableOpacity>

          <View style={styles.topRightControls}>
            <TouchableOpacity style={styles.topBtn} onPress={cycleFlash}>
              {flash === 'off' ? (
                <ZapOff size={20} color="#FFF" />
              ) : flash === 'auto' ? (
                <View style={{ position: 'relative' }}>
                  <Zap size={20} color="#FFD700" />
                  <Text style={styles.flashLabel}>A</Text>
                </View>
              ) : (
                <Zap size={20} color="#FFD700" />
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.topBtn} onPress={toggleGrid}>
              <Grid3x3 size={20} color={showGrid ? '#FFF' : 'rgba(255,255,255,0.35)'} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.topBtn} onPress={flipCamera}>
              <RefreshCw size={22} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Lens stepping buttons (iPhone-style) ── */}
        <View style={styles.lensRow} pointerEvents="box-none">
          {LENS_PRESETS.map((preset) => {
            const isActive = Math.abs(zoom - preset.zoom) < 0.01;
            return (
              <TouchableOpacity
                key={preset.label}
                style={[styles.lensBtn, isActive && styles.lensBtnActive]}
                onPress={() => handleLensStep(preset.zoom)}
                activeOpacity={0.7}
              >
                <Text style={[styles.lensLabel, isActive && styles.lensLabelActive]}>
                  {preset.label}×
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Zoom indicator (shows during pinch or when not at preset) */}
        {!LENS_PRESETS.some(p => Math.abs(zoom - p.zoom) < 0.01) && (
          <View style={styles.zoomIndicator}>
            <Text style={styles.zoomText}>{(0.5 + 4.5 * zoom).toFixed(1)}×</Text>
          </View>
        )}

        {/* Loading overlay */}
        {!isReady && (
          <View style={styles.loadingOverlay}>
            <Text style={styles.loadingText}>Camera loading...</Text>
          </View>
        )}
      </CameraView>

      {/* ── Swipe hint ── */}
      <View style={styles.swipeHint} pointerEvents="none">
        <Text style={styles.swipeHintText}>← Swipe to go back</Text>
      </View>

      {/* Bottom bar — gallery thumb + capture button only */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.galleryThumb} onPress={onPickFromGallery}>
          <View style={styles.galleryThumbInner}>
            <ImageIcon size={22} color="rgba(255,255,255,0.6)" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.captureBtn, { opacity: isReady ? 1 : 0.5 }]}
          onPress={handleCapture}
          disabled={!isReady}
          activeOpacity={0.7}
        >
          <View style={styles.captureBtnInner} />
        </TouchableOpacity>

        {/* Empty spacer to center the capture button */}
        <View style={{ width: 44 }} />
      </View>
    </Animated.View>
  );
}

// ── Styles ──
const styles = StyleSheet.create({
  fullScreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Permission denied ──
  closeBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 32,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 10,
  },
  permTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  permSub: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
    marginBottom: 24,
  },
  galleryBtnLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 28,
  },
  galleryBtnLargeText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },

  // ── Top bar ──
  topBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 32,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 20,
  },
  topRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  flashLabel: {
    position: 'absolute',
    bottom: -3,
    right: -4,
    color: '#FFD700',
    fontSize: 9,
    fontWeight: '800',
  },

  // ── Tap-to-focus indicator ──
  focusSquare: {
    position: 'absolute',
    width: FOCUS_SQUARE_SIZE,
    height: FOCUS_SQUARE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 25,
  },
  focusSquareOuter: {
    position: 'absolute',
    width: FOCUS_SQUARE_SIZE,
    height: FOCUS_SQUARE_SIZE,
    borderWidth: 2,
    borderColor: '#FFD700',  // iPhone-style yellow
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  focusCrosshairH: {
    position: 'absolute',
    width: 28,
    height: 1,
    backgroundColor: '#FFD700',
    borderRadius: 0.5,
  },
  focusCrosshairV: {
    position: 'absolute',
    width: 1,
    height: 28,
    backgroundColor: '#FFD700',
    borderRadius: 0.5,
  },

  // ── Lens stepping ──
  lensRow: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 120 : 100,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 20,
    padding: 3,
    zIndex: 14,
  },
  lensBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 17,
    minWidth: 44,
    alignItems: 'center',
  },
  lensBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  lensLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '600',
  },
  lensLabelActive: {
    color: '#FFF',
  },

  // ── 9:16 Crop Matte Overlay ──
  cropMatteTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: CROP_OVERLAY_TOP,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 8,
  },
  cropMatteBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: CROP_OVERLAY_BOTTOM > 0 ? CROP_OVERLAY_BOTTOM : 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 8,
  },
  cropBorderTop: {
    position: 'absolute',
    top: CROP_OVERLAY_TOP,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
    zIndex: 8,
  },
  cropBorderBottom: {
    position: 'absolute',
    bottom: CROP_OVERLAY_BOTTOM > 0 ? CROP_OVERLAY_BOTTOM : 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
    zIndex: 8,
  },

  // ── Grid ──
  gridOverlay: {
    position: 'absolute',
    top: CROP_OVERLAY_TOP,
    left: 0,
    right: 0,
    bottom: CROP_OVERLAY_BOTTOM > 0 ? CROP_OVERLAY_BOTTOM : 0,
    zIndex: 7,
  },
  gridRow: {
    flex: 1,
    flexDirection: 'row',
  },
  gridCell: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.16)',
  },

  // ── Loading ──
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    fontWeight: '500',
  },

  // ── Zoom indicator ──
  zoomIndicator: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 170 : 150,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    zIndex: 15,
  },
  zoomText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Swipe hint ──
  swipeHint: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 140 : 120,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    zIndex: 5,
  },
  swipeHintText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '500',
  },

  // ── Bottom bar ──
  bottomBar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 52 : 36,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    zIndex: 20,
  },

  // ── Gallery thumbnail ──
  galleryThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  galleryThumbInner: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Capture button ──
  captureBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureBtnInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF',
  },

  // ── Preview ──
  previewTopBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 32,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  previewBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  previewTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  previewBottom: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 52 : 36,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 32,
    zIndex: 10,
  },
  retakeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  retakeText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '500',
  },
  usePhotoBtn: {
    backgroundColor: '#FFF',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 26,
  },
  usePhotoText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
  },
});
