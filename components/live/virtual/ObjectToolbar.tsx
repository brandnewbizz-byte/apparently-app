import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  Plus,
  Image as ImageIcon,
  Square,
  StickyNote,
  Trophy,
  Circle,
  Monitor,
  FileText,
  ShoppingBag,
  X,
  Camera,
} from 'lucide-react-native';
import { useVirtualRoom } from '@/contexts/VirtualRoomContext';
import { ObjectType, DEFAULT_OBJECT_SIZE } from '@/types/virtual-room';

interface ToolItem {
  type: ObjectType;
  label: string;
  icon: React.ReactNode;
  color: string;
}

const TOOLS: ToolItem[] = [
  { type: 'image', label: 'Image', icon: <ImageIcon size={20} color="#8B5CF6" />, color: '#EDE9FE' },
  { type: 'sticky_note', label: 'Note', icon: <StickyNote size={20} color="#F59E0B" />, color: '#FEF3C7' },
  { type: 'shape', label: 'Shape', icon: <Square size={20} color="#10B981" />, color: '#D1FAE5' },
  { type: 'ball', label: 'Ball', icon: <Circle size={20} color="#EF4444" />, color: '#FEE2E2' },
  { type: 'trophy', label: 'Trophy', icon: <Trophy size={20} color="#F59E0B" />, color: '#FFF7ED' },
  { type: 'chair', label: 'Chair', icon: <Square size={20} color="#6B7280" />, color: '#F3F4F6' },
  { type: 'table', label: 'Table', icon: <Square size={20} color="#8B7355" />, color: '#F5F0EB' },
  { type: 'whiteboard', label: 'Board', icon: <Monitor size={20} color="#3B82F6" />, color: '#DBEAFE' },
  { type: 'tv', label: 'TV', icon: <Monitor size={20} color="#374151" />, color: '#E5E7EB' },
  { type: 'document', label: 'Document', icon: <FileText size={20} color="#DC2626" />, color: '#FEE2E2' },
  { type: 'logo', label: 'Logo', icon: <ShoppingBag size={20} color="#7C3AED" />, color: '#EDE9FE' },
  { type: 'flyer', label: 'Flyer', icon: <FileText size={20} color="#EC4899" />, color: '#FCE7F3' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  canvasCenterX: number;
  canvasCenterY: number;
}

export default function ObjectToolbar({ visible, onClose, canvasCenterX, canvasCenterY }: Props) {
  const { addObject, uploadImage } = useVirtualRoom();
  const [expanded, setExpanded] = useState(false);

  const handleAddObject = (type: ObjectType) => {
    if (type === 'image') {
      handlePickImage();
    } else {
      addObject(type, canvasCenterX, canvasCenterY);
      onClose();
    }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera roll access is required to upload images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const name = asset.fileName || `Upload ${new Date().toLocaleTimeString()}`;
      await uploadImage(asset.uri, name);
      onClose();
    }
  };

  const handleOpenCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const name = `Photo ${new Date().toLocaleTimeString()}`;
      await uploadImage(asset.uri, name);
      onClose();
    }
  };

  const displayTools = expanded ? TOOLS : TOOLS.slice(0, 5);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} />

        <View style={styles.panel}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Add to Room</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={16} color="#737373" />
            </TouchableOpacity>
          </View>

          {/* Camera & Gallery quick actions */}
          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.quickBtn} onPress={handleOpenCamera}>
              <Camera size={20} color="#8B5CF6" />
              <Text style={styles.quickLabel}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickBtn} onPress={handlePickImage}>
              <ImageIcon size={20} color="#10B981" />
              <Text style={styles.quickLabel}>Gallery</Text>
            </TouchableOpacity>
          </View>

          {/* Object Grid */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.toolGrid}
          >
            {displayTools.map(tool => (
              <TouchableOpacity
                key={tool.type}
                style={[styles.toolItem, { backgroundColor: tool.color }]}
                onPress={() => handleAddObject(tool.type)}
              >
                {tool.icon}
                <Text style={styles.toolLabel}>{tool.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Show More */}
          {!expanded && TOOLS.length > 5 && (
            <TouchableOpacity
              style={styles.expandBtn}
              onPress={() => setExpanded(true)}
            >
              <Plus size={14} color="#8B5CF6" />
              <Text style={styles.expandText}>More objects</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  panel: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 20,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DBDBDB',
    alignSelf: 'center',
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#262626',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  quickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
  },
  quickLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#262626',
  },
  toolGrid: {
    paddingHorizontal: 16,
    gap: 10,
  },
  toolItem: {
    width: 72,
    height: 72,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  toolLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#374151',
  },
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
  },
  expandText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8B5CF6',
  },
});
