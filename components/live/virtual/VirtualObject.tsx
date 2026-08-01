import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Animated,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  Circle,
  Square,
  StickyNote,
  Trophy,
  Armchair,
  Monitor,
  FileText,
  ShoppingBag,
  ImageIcon,
  Trash2,
  RotateCw,
} from 'lucide-react-native';
import { VirtualObject as VObj, ObjectType } from '@/types/virtual-room';

interface Props {
  object: VObj;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<VObj>) => void;
  onDelete: () => void;
}

const MIN_SIZE = 30;

function getObjectIcon(type: ObjectType, size: number) {
  const s = Math.min(size, 28);
  switch (type) {
    case 'ball': return <Circle size={s} color="#FFF" />;
    case 'goal': return <Square size={s} color="#FFF" />;
    case 'trophy': return <Trophy size={s} color="#FFD700" />;
    case 'chair': return <Armchair size={s} color="#6B7280" />;
    case 'table': return <Square size={s} color="#8B7355" />;
    case 'whiteboard': return <Monitor size={s} color="#4B5563" />;
    case 'tv': return <Monitor size={s} color="#374151" />;
    case 'document':
    case 'pdf': return <FileText size={s} color="#DC2626" />;
    case 'sticky_note': return <StickyNote size={s} color="#FBBF24" />;
    case 'video': return <Monitor size={s} color="#7C3AED" />;
    case 'logo':
    case 'product_photo':
    case 'flyer':
    case 'image':
    case 'custom': return <ImageIcon size={s} color="#6B7280" />;
    default: return <ShoppingBag size={s} color="#6B7280" />;
  }
}

function getObjectColor(type: ObjectType): string {
  switch (type) {
    case 'sticky_note': return '#FFF9C4';
    case 'whiteboard': return '#FFFFFF';
    case 'ball': return '#FFFFFF';
    case 'trophy': return '#FFF8E1';
    case 'chair': return '#D7CCC8';
    case 'table': return '#BCAAA4';
    case 'tv': return '#263238';
    case 'document':
    case 'pdf': return '#FFEBEE';
    case 'video': return '#EDE7F6';
    default: return '#F5F5F5';
  }
}

export default function VirtualObject({ object, isSelected, onSelect, onUpdate, onDelete }: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const [rotationActive, setRotationActive] = useState(false);

  const posX = useRef(new Animated.Value(0)).current;
  const posY = useRef(new Animated.Value(0)).current;
  const objScale = useRef(new Animated.Value(1)).current;
  const objRot = useRef(new Animated.Value(0)).current;
  const baseX = useRef(object.x);
  const baseY = useRef(object.y);
  const baseW = useRef(object.width);
  const baseH = useRef(object.height);
  const baseRot = useRef(object.rotation);

  // Sync from props
  React.useEffect(() => {
    baseX.current = object.x;
    baseY.current = object.y;
    baseW.current = object.width;
    baseH.current = object.height;
    baseRot.current = object.rotation;
    posX.setValue(0);
    posY.setValue(0);
    objScale.setValue(1);
    objRot.setValue(0);
  }, [object.x, object.y, object.width, object.height, object.rotation]);

  // ── Drag Gesture ──
  const dragGesture = Gesture.Pan()
    .onUpdate(({ translationX, translationY }) => {
      if (rotationActive) {
        // Rotation mode: drag to rotate
        const centerX = baseX.current + baseW.current / 2;
        const centerY = baseY.current + baseH.current / 2;
        const angle = Math.atan2(translationY, translationX) * (180 / Math.PI);
        objRot.setValue(angle);
        return;
      }
      posX.setValue(translationX);
      posY.setValue(translationY);
    })
    .onEnd(({ translationX, translationY }) => {
      if (rotationActive) {
        const angle = Math.atan2(translationY, translationX) * (180 / Math.PI);
        onUpdate({ rotation: baseRot.current + angle });
        setRotationActive(false);
        return;
      }
      const newX = baseX.current + translationX;
      const newY = baseY.current + translationY;
      baseX.current = newX;
      baseY.current = newY;
      posX.setValue(0);
      posY.setValue(0);
      onUpdate({ x: newX, y: newY });
    });

  // ── Resize Gesture ──
  const resizeGesture = Gesture.Pinch()
    .onUpdate(({ scale }) => {
      objScale.setValue(scale);
    })
    .onEnd(({ scale }) => {
      const newW = Math.max(MIN_SIZE, baseW.current * scale);
      const newH = Math.max(MIN_SIZE, baseH.current * scale);
      baseW.current = newW;
      baseH.current = newH;
      objScale.setValue(1);
      onUpdate({ width: newW, height: newH });
    });

  // ── Tap Gesture ──
  const tapGesture = Gesture.Tap()
    .onEnd(() => {
      onSelect();
      setShowMenu(false);
    });

  // ── Long Press ──
  const longPressGesture = Gesture.LongPress()
    .minDuration(500)
    .onEnd(() => {
      setShowMenu(v => !v);
    });

  const composed = Gesture.Race(
    resizeGesture,
    Gesture.Simultaneous(dragGesture, Gesture.Exclusive(tapGesture, longPressGesture)),
  );

  const hasImage = !!object.imageUrl && (
    object.objectType === 'image' ||
    object.objectType === 'logo' ||
    object.objectType === 'product_photo' ||
    object.objectType === 'flyer' ||
    object.objectType === 'custom'
  );

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        style={[
          styles.object,
          {
            left: object.x,
            top: object.y,
            width: object.width,
            height: object.height,
            zIndex: object.zIndex,
            transform: [
              { translateX: posX },
              { translateY: posY },
              { scale: objScale },
              { rotate: `${object.rotation}deg` },
            ] as any,
          },
          isSelected && styles.selected,
          { backgroundColor: getObjectColor(object.objectType) },
        ]}
      >
        {hasImage && object.imageUrl ? (
          <Image
            source={{ uri: object.imageUrl }}
            style={styles.objectImage}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.objectIcon}>
            {getObjectIcon(object.objectType, object.width * 0.5)}
          </View>
        )}

        <Text style={styles.objectName} numberOfLines={1}>
          {object.name}
        </Text>

        {/* ── Selection Handles ── */}
        {isSelected && (
          <>
            {/* Rotation Handle */}
            <TouchableOpacity
              style={styles.rotateHandle}
              onPress={() => setRotationActive(r => !r)}
            >
              <RotateCw size={12} color="#FFF" />
            </TouchableOpacity>
            {/* Corner resize indicators */}
            <View style={[styles.corner, { top: -3, left: -3 }]} />
            <View style={[styles.corner, { top: -3, right: -3 }]} />
            <View style={[styles.corner, { bottom: -3, left: -3 }]} />
            <View style={[styles.corner, { bottom: -3, right: -3 }]} />
          </>
        )}

        {/* ── Long-press Menu ── */}
        {showMenu && (
          <View style={styles.menu}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { setShowMenu(false); onDelete(); }}
            >
              <Trash2 size={14} color="#EF4444" />
              <Text style={styles.menuDeleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  object: {
    position: 'absolute',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  selected: {
    borderColor: '#8B5CF6',
    borderWidth: 2,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  objectImage: {
    width: '100%',
    height: '75%',
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
  },
  objectIcon: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  objectName: {
    fontSize: 8,
    color: '#262626',
    fontWeight: '600',
    paddingHorizontal: 4,
    paddingBottom: 3,
    textAlign: 'center',
  },
  rotateHandle: {
    position: 'absolute',
    top: -22,
    alignSelf: 'center',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 8,
  },
  corner: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#8B5CF6',
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  menu: {
    position: 'absolute',
    bottom: -40,
    alignSelf: 'center',
    backgroundColor: '#FFF',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 10,
    zIndex: 999,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  menuDeleteText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
  },
});
