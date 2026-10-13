import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { X, Calendar, User, FileText } from 'lucide-react-native';
import { VirtualObject, ObjectType } from '@/types/virtual-room';

interface Props {
  object: VirtualObject | null;
  visible: boolean;
  onClose: () => void;
}

const TYPE_LABELS: Record<ObjectType, string> = {
  image: 'Image',
  shape: 'Shape',
  sticky_note: 'Sticky Note',
  ball: 'Ball',
  goal: 'Goal',
  trophy: 'Trophy',
  chair: 'Chair',
  table: 'Table',
  whiteboard: 'Whiteboard',
  tv: 'TV',
  document: 'Document',
  pdf: 'PDF',
  video: 'Video',
  logo: 'Logo',
  product_photo: 'Product Photo',
  flyer: 'Flyer',
  custom: 'Custom Object',
};

export default function ObjectInfoPanel({ object, visible, onClose }: Props) {
  if (!object) return null;

  const createdDate = new Date(object.createdAt);

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
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>{object.name}</Text>
              <Text style={styles.typeLabel}>{TYPE_LABELS[object.objectType] || object.objectType}</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={18} color="#737373" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Description */}
            {object.description ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Description</Text>
                <Text style={styles.sectionText}>{object.description}</Text>
              </View>
            ) : null}

            {/* Info Grid */}
            <View style={styles.infoGrid}>
              <View style={styles.infoRow}>
                <User size={14} color="#737373" />
                <Text style={styles.infoLabel}>Uploaded by</Text>
                <Text style={styles.infoValue}>{object.ownerName || 'Unknown'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Calendar size={14} color="#737373" />
                <Text style={styles.infoLabel}>Upload date</Text>
                <Text style={styles.infoValue}>
                  {createdDate.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <FileText size={14} color="#737373" />
                <Text style={styles.infoLabel}>Size</Text>
                <Text style={styles.infoValue}>
                  {Math.round(object.width)} × {Math.round(object.height)} px
                </Text>
              </View>
            </View>

            {/* Notes */}
            {object.notes ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Notes</Text>
                <Text style={styles.sectionText}>{object.notes}</Text>
              </View>
            ) : (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Notes</Text>
                <Text style={styles.emptyText}>No notes added yet.</Text>
              </View>
            )}

            {/* Metadata */}
            {object.metadata && Object.keys(object.metadata).length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Metadata</Text>
                {Object.entries(object.metadata as Record<string, unknown>).map(([k, v]) => (
                  <Text key={k} style={styles.metaRow}>
                    <Text style={styles.metaKey}>{k}: </Text>
                    <Text style={styles.metaValue}>{String(v)}</Text>
                  </Text>
                ))}
              </View>
            ) : null}

            {/* Spacer for bottom */}
            <View style={{ height: 40 }} />
          </ScrollView>
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
    maxHeight: '65%',
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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#262626',
  },
  typeLabel: {
    fontSize: 12,
    color: '#8B5CF6',
    fontWeight: '600',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E8E8E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  sectionText: {
    fontSize: 14,
    color: '#262626',
    lineHeight: 20,
  },
  emptyText: {
    fontSize: 14,
    color: '#B0B0B0',
    fontStyle: 'italic',
  },
  infoGrid: {
    gap: 10,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoLabel: {
    fontSize: 12,
    color: '#8E8E8E',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 12,
    color: '#262626',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  metaRow: {
    fontSize: 11,
    marginBottom: 2,
  },
  metaKey: {
    fontWeight: '600',
    color: '#737373',
  },
  metaValue: {
    color: '#8E8E8E',
  },
});
