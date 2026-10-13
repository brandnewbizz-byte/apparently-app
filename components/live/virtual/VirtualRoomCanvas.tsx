import React, { useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  PanResponder,
  TouchableOpacity,
  Text,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { ZoomIn } from 'lucide-react-native';
import EnvironmentBackground from './EnvironmentBackground';
import VirtualObject from './VirtualObject';
import { useVirtualRoom } from '@/contexts/VirtualRoomContext';

const { width: SW, height: SH } = Dimensions.get('window');
const CANVAS_W = SW * 3;
const CANVAS_H = SH * 3;

export default function VirtualRoomCanvas() {
  const {
    environment,
    objects,
    cameraX,
    cameraY,
    cameraScale,
    setCamera,
    resetCamera,
    updateObject,
    selectObject,
    selectedObjectId,
    moveObjectToTop,
    removeObject,
  } = useVirtualRoom();

  // Animated values for smooth camera
  const camX = useRef(new Animated.Value(cameraX)).current;
  const camY = useRef(new Animated.Value(cameraY)).current;
  const camScale = useRef(new Animated.Value(cameraScale)).current;

  // Sync animated values on external change (e.g., reset)
  React.useEffect(() => {
    camX.setValue(cameraX);
    camY.setValue(cameraY);
    camScale.setValue(cameraScale);
  }, [cameraX, cameraY, cameraScale]);

  // ── Canvas Gestures ──
  const pinchGesture = Gesture.Pinch()
    .onUpdate(({ scale }) => {
      const newScale = Math.max(0.3, Math.min(5, cameraScale * scale));
      camScale.setValue(newScale);
      setCamera(cameraX, cameraY, newScale);
    });

  const panGesture = Gesture.Pan()
    .minPointers(2)
    .onUpdate(({ translationX, translationY }) => {
      camX.setValue(cameraX + translationX);
      camY.setValue(cameraY + translationY);
    })
    .onEnd(({ translationX, translationY }) => {
      setCamera(cameraX + translationX, cameraY + translationY, cameraScale);
    });

  const tapGesture = Gesture.Tap()
    .onEnd(() => {
      selectObject(null);
    });

  const composedGestures = Gesture.Simultaneous(
    pinchGesture,
    Gesture.Simultaneous(panGesture, tapGesture),
  );

  // ── Canvas Camera Transform ──
  const cameraTransform = {
    transform: [
      { translateX: camX },
      { translateY: camY },
      { scale: camScale },
    ],
  };

  // ── Background ──
  const envType = environment?.environmentType || 'generic';

  return (
    <View style={styles.container}>
      <GestureDetector gesture={composedGestures}>
        <View style={styles.canvas}>
          <Animated.View style={[styles.camera, cameraTransform]}>
            <EnvironmentBackground type={envType} />
            {objects
              .slice()
              .sort((a, b) => a.zIndex - b.zIndex)
              .map(obj => (
                <VirtualObject
                  key={obj.id}
                  object={obj}
                  isSelected={obj.id === selectedObjectId}
                  onSelect={() => {
                    selectObject(obj.id);
                    moveObjectToTop(obj.id);
                  }}
                  onUpdate={(updates) => updateObject(obj.id, updates)}
                  onDelete={() => removeObject(obj.id)}
                />
              ))}
          </Animated.View>
        </View>
      </GestureDetector>

      {/* ── Reset View Button ── */}
      <TouchableOpacity
        style={styles.resetBtn}
        onPress={() => {
          setCamera(0, 0, 1);
          camX.setValue(0);
          camY.setValue(0);
          camScale.setValue(1);
          resetCamera();
        }}
      >
        <ZoomIn size={18} color="#FFF" />
        <Text style={styles.resetLabel}>Reset</Text>
      </TouchableOpacity>

      {/* ── Zoom Indicator ── */}
      <View style={styles.zoomBadge}>
        <Text style={styles.zoomText}>{Math.round(cameraScale * 100)}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#F0F0F0',
  },
  canvas: {
    flex: 1,
    overflow: 'hidden',
  },
  camera: {
    width: CANVAS_W,
    height: CANVAS_H,
  },
  resetBtn: {
    position: 'absolute',
    bottom: 20,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resetLabel: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  zoomBadge: {
    position: 'absolute',
    top: 10,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  zoomText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
});
